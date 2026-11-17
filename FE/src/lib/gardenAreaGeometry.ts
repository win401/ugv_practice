/** Leaflet coordinate order: latitude, longitude, in degrees. */
export type GeoPoint = [number, number];

type XY = [number, number];
const EPSILON = 1e-10;

const cross = (a: XY, b: XY, c: XY) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function onSegment(a: XY, b: XY, point: XY) {
  return (
    Math.abs(cross(a, b, point)) <= EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - EPSILON &&
    point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON &&
    point[1] <= Math.max(a[1], b[1]) + EPSILON
  );
}

function segmentsIntersect(a: XY, b: XY, c: XY, d: XY) {
  const abc = cross(a, b, c);
  const abd = cross(a, b, d);
  const cda = cross(c, d, a);
  const cdb = cross(c, d, b);
  const opposite = (first: number, second: number) =>
    (first > EPSILON && second < -EPSILON) ||
    (first < -EPSILON && second > EPSILON);
  return (
    (opposite(abc, abd) && opposite(cda, cdb)) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}

/**
 * Validate a small local garden polygon. The returned list is open: its first
 * point is not repeated at the end; the map closes the final edge when drawing.
 * This checks drawing geometry, not surveyed boundaries or vehicle clearance.
 */
export function validateGardenAreaBoundary(input: unknown): GeoPoint[] {
  if (!Array.isArray(input) || input.length < 3 || input.length > 30) {
    throw new Error("정원 경계는 서로 다른 꼭짓점 3~30개로 그려 주세요.");
  }
  const boundary: GeoPoint[] = input.map((point: unknown) => {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== "number" ||
      typeof point[1] !== "number" ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      point[0] < -90 ||
      point[0] > 90 ||
      point[1] < -180 ||
      point[1] > 180
    ) {
      throw new Error("정원 경계의 위도·경도 값이 올바르지 않습니다.");
    }
    return [point[0], point[1]];
  });
  if (
    new Set(boundary.map((point) => point.join(","))).size !== boundary.length
  ) {
    throw new Error("정원 경계에 같은 꼭짓점을 두 번 넣을 수 없습니다.");
  }

  // Translate and normalize first, avoiding cancellation between the large
  // absolute longitude/latitude values of a small drawn garden.
  const latitudes = boundary.map((point) => point[0]);
  const longitudes = boundary.map((point) => point[1]);
  const minLat = Math.min(...latitudes);
  const minLng = Math.min(...longitudes);
  const scale = Math.max(
    Math.max(...latitudes) - minLat,
    Math.max(...longitudes) - minLng,
  );
  if (scale === 0) throw new Error("면적이 있는 정원 경계를 그려 주세요.");
  const points: XY[] = boundary.map(([lat, lng]) => [
    (lng - minLng) / scale,
    (lat - minLat) / scale,
  ]);

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index + points.length - 1) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const backtracks =
      (previous[0] - current[0]) * (next[0] - current[0]) +
      (previous[1] - current[1]) * (next[1] - current[1]);
    if (
      Math.abs(cross(previous, current, next)) <= EPSILON &&
      backtracks > EPSILON
    ) {
      throw new Error("정원 경계의 선이 서로 겹치지 않도록 그려 주세요.");
    }
    for (let other = index + 1; other < points.length; other += 1) {
      const nextIndex = (index + 1) % points.length;
      const otherNext = (other + 1) % points.length;
      if (nextIndex === other || otherNext === index) continue;
      if (segmentsIntersect(current, next, points[other], points[otherNext])) {
        throw new Error(
          "정원 경계의 선이 교차하거나 겹치지 않도록 그려 주세요.",
        );
      }
    }
  }

  const twiceArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  if (Math.abs(twiceArea) <= EPSILON) {
    throw new Error(
      "꼭짓점이 한 줄에 놓였습니다. 면적이 있는 정원 경계를 그려 주세요.",
    );
  }
  return boundary;
}
