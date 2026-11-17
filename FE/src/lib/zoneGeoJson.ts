import type { Point } from "../api/gardenDetail";
import { getZoneBoundarySegments } from "./zoneGeometry";

export type ZoneGeoJSONGeometry =
  | { type: "Polygon"; coordinates: Point[][] }
  | { type: "MultiPolygon"; coordinates: Point[][][] };

/** Export approximation in image pixels, not a claim of geographic accuracy. */
export const ZONE_GEOJSON_PIXEL_TOLERANCE = 0.25;
export const ZONE_GEOJSON_POINT_LIMIT = 4096;
const MAX_DEPTH = 20;
const EPSILON = 1e-10;
const copy = (p: Point): Point => [p[0], p[1]];
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const topologyError = () =>
  new Error(
    "겹치거나 교차하는 경계는 내보낼 수 없습니다. 구역 안의 구멍과 겹치는 조각은 아직 지원하지 않습니다.",
  );
const complexityError = () =>
  new Error(
    "경계가 너무 복잡해 내보낼 수 없습니다. 경계 점이나 곡선을 줄여 주세요.",
  );

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.min(
        1,
        Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function split(points: Point[]): [Point[], Point[]] {
  const left = [copy(points[0])],
    right = [copy(points.at(-1)!)];
  while (points.length > 1) {
    points = points
      .slice(0, -1)
      .map(
        (p, i): Point => [
          p[0] / 2 + points[i + 1][0] / 2,
          p[1] / 2 + points[i + 1][1] / 2,
        ],
      );
    left.push(copy(points[0]));
    right.unshift(copy(points.at(-1)!));
  }
  return [left, right];
}

/** Translate before summing to avoid cancellation near longitude 127 / latitude 35. */
function area(ring: Point[]) {
  const origin = ring[0];
  return (
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return (
        sum +
        (p[0] - origin[0]) * (q[1] - origin[1]) -
        (q[0] - origin[0]) * (p[1] - origin[1])
      );
    }, 0) / 2
  );
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function onSegment(p: Point, a: Point, b: Point) {
  return (
    Math.abs(cross(a, b, p)) <= EPSILON &&
    p[0] >= Math.min(a[0], b[0]) - EPSILON &&
    p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    p[1] >= Math.min(a[1], b[1]) - EPSILON &&
    p[1] <= Math.max(a[1], b[1]) + EPSILON
  );
}
function touches(a: Point, b: Point, c: Point, d: Point) {
  if (
    Math.max(a[0], b[0]) + EPSILON < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) + EPSILON < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) + EPSILON < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) + EPSILON < Math.min(a[1], b[1])
  )
    return false;
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  return (
    (abC * abD < 0 && cdA * cdB < 0) ||
    onSegment(c, a, b) ||
    onSegment(d, a, b) ||
    onSegment(a, c, d) ||
    onSegment(b, c, d)
  );
}
function inside(point: Point, ring: Point[]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}

/** Work at unit scale so topology checks apply to both pixels and small degree ranges. */
function assertSimpleDisjoint(rings: Point[][]) {
  const points = rings.flat();
  const minX = Math.min(...points.map((p) => p[0])),
    minY = Math.min(...points.map((p) => p[1]));
  const scale = Math.max(
    ...points.map((p) => p[0] - minX),
    ...points.map((p) => p[1] - minY),
  );
  if (!Number.isFinite(scale) || scale <= 0) throw topologyError();
  const normalized = rings.map((ring) =>
    ring.map((p): Point => [(p[0] - minX) / scale, (p[1] - minY) / scale]),
  );
  for (let part = 0; part < normalized.length; part++) {
    const ring = normalized[part];
    if (ring.length < 3 || Math.abs(area(ring)) < 1e-14) throw topologyError();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        c = ring[(i + 2) % ring.length];
      if (
        same(a, b) ||
        (Math.abs(cross(a, b, c)) <= EPSILON &&
          (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) <
            -EPSILON)
      )
        throw topologyError();
      for (let j = i + 2; j < ring.length; j++) {
        if (i === 0 && j === ring.length - 1) continue;
        if (touches(a, b, ring[j], ring[(j + 1) % ring.length]))
          throw topologyError();
      }
      for (let other = part + 1; other < normalized.length; other++) {
        const next = normalized[other];
        for (let j = 0; j < next.length; j++) {
          if (touches(a, b, next[j], next[(j + 1) % next.length]))
            throw topologyError();
        }
      }
    }
    for (let other = part + 1; other < normalized.length; other++) {
      const next = normalized[other];
      if (inside(ring[0], next) || inside(next[0], ring)) throw topologyError();
    }
  }
}

/**
 * RFC 7946 geometry with [longitude, latitude] positions and CCW exterior rings.
 * Every SVG subpath must be a disjoint exterior: holes are not inferred.
 * The caller owns georeferencing accuracy; generated-image coordinates remain illustrative.
 * Curves are approximated only in this export. The editable SVG stays unchanged.
 */
export function zoneShapeToGeoJSON(
  shape: string,
  projector: (point: Point) => [number, number],
): ZoneGeoJSONGeometry {
  getZoneBoundarySegments(shape); // Validate the full SVG before splitting subpaths.
  if (typeof projector !== "function")
    throw new Error("지도 좌표 변환 정보를 확인해 주세요.");
  let pointCount = 0;
  const rings = shape
    .split(/(?=M)/)
    .filter((part) => part.trim())
    .map((part) => {
      const segments = getZoneBoundarySegments(part);
      if (!segments.length) throw topologyError();
      const ring: Point[] = [];
      const append = (point: Point) => {
        if (ring.length && same(ring.at(-1)!, point)) return;
        if (++pointCount > ZONE_GEOJSON_POINT_LIMIT) throw complexityError();
        ring.push(copy(point));
      };
      const flatten = (points: Point[], depth: number) => {
        const deviation = Math.max(
          0,
          ...points
            .slice(1, -1)
            .map((p) => segmentDistance(p, points[0], points.at(-1)!)),
        );
        if (!Number.isFinite(deviation)) throw complexityError();
        // The Bézier lies within its control polygon, bounding distance to this chord.
        if (deviation <= ZONE_GEOJSON_PIXEL_TOLERANCE) {
          append(points.at(-1)!);
          return;
        }
        if (depth >= MAX_DEPTH) throw complexityError();
        const [left, right] = split(points);
        flatten(left, depth + 1);
        flatten(right, depth + 1);
      };
      append(segments[0].start);
      for (const segment of segments)
        flatten([segment.start, ...segment.controls, segment.end], 0);
      if (!same(ring[0], ring.at(-1)!)) append(ring[0]);
      ring.pop(); // Topology routines use open rings; closure is appended after projection.
      return ring;
    });
  assertSimpleDisjoint(rings);
  const projected = rings.map((ring) =>
    ring.map((point): Point => {
      let value: Point;
      try {
        value = projector(copy(point));
      } catch {
        throw new Error(
          "지도 좌표를 변환하지 못했습니다. 지도 연결 정보를 확인해 주세요.",
        );
      }
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        !value.every(Number.isFinite) ||
        Math.abs(value[0]) > 180 ||
        Math.abs(value[1]) > 90
      )
        throw new Error(
          "GeoJSON에는 유효한 WGS84 경도·위도 좌표가 필요합니다.",
        );
      return copy(value);
    }),
  );
  for (const ring of projected) {
    if (
      ring.some((p, i) => Math.abs(p[0] - ring[(i + 1) % ring.length][0]) > 180)
    )
      throw new Error("날짜 변경선을 가로지르는 구역은 지원하지 않습니다.");
  }
  assertSimpleDisjoint(projected);
  const closed = projected.map((ring) => {
    const exterior = area(ring) < 0 ? [...ring].reverse() : ring;
    return [...exterior, copy(exterior[0])];
  });
  return closed.length === 1
    ? { type: "Polygon", coordinates: [closed[0]] }
    : { type: "MultiPolygon", coordinates: closed.map((ring) => [ring]) };
}
