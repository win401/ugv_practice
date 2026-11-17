import type { Point } from "../api/gardenDetail";
import type { GardenGeo } from "../api/types";
import { zoneShapeToGeoJSON } from "./zoneGeoJson";
import {
  getZoneBoundarySegments,
  parseZonePath,
  serializeZonePath,
} from "./zoneGeometry";

/**
 * 위성지도에 그리는 정원 경계의 좌표 계산.
 * 그리고 고치는 동안은 평면 좌표(기준점에서 떨어진 거리)를 쓰고, 저장할 때 위경도로 바꾼다.
 * 평면 좌표는 관수 구역 편집과 같은 경계 계산(zoneGeometry)을 그대로 쓰기 위한 것이다.
 * 위경도 좌표의 순서는 [경도, 위도]다.
 */

const RADIANS = Math.PI / 180;
/** 웹 지도 확대 20단계의 화소 크기. 한국 위도에서 1화소가 약 12cm다. */
const SCALE = 2 ** 28 / (2 * Math.PI);
export const PLANE_ZOOM = 20;
const EARTH_RADIUS = 6378137;

const mercatorY = (latitude: number) =>
  Math.asinh(Math.tan(latitude * RADIANS));
const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

export type Plane = {
  /** [경도, 위도] → 평면 좌표. 경계 글자가 길어지지 않게 소수 둘째 자리(약 1mm)까지만 둔다. */
  project(position: Point): Point;
  /** 평면 좌표 → [경도, 위도]. 소수 일곱째 자리(약 1cm)까지 둔다. */
  unproject(point: Point): Point;
};

/** 기준점 주변의 평면. 기준점이 가까울수록 좌표 숫자가 작아진다. */
export function planeAt([originLng, originLat]: Point): Plane {
  const originY = mercatorY(originLat);
  return {
    project: ([lng, lat]) => [
      round((lng - originLng) * RADIANS * SCALE, 2),
      round((originY - mercatorY(lat)) * SCALE, 2),
    ],
    unproject: ([x, y]) => [
      round(originLng + x / SCALE / RADIANS, 7),
      round(Math.atan(Math.sinh(originY - y / SCALE)) / RADIANS, 7),
    ],
  };
}

/** 경계를 지도에 그릴 점들. 곡선은 잘게 나눈다. 검사는 하지 않아 잘못된 경계도 그려 볼 수 있다. */
export function boundaryPreview(shape: string, plane: Plane): Point[] {
  const steps = 24;
  const ring: Point[] = [];
  for (const segment of getZoneBoundarySegments(shape)) {
    const controls = [segment.start, ...segment.controls, segment.end];
    const count = segment.controls.length ? steps : 1;
    for (let step = ring.length ? 1 : 0; step <= count; step++) {
      // 조절점들을 같은 비율로 계속 이어 가면 곡선 위의 한 점이 나온다.
      let points = controls;
      while (points.length > 1)
        points = points
          .slice(0, -1)
          .map(
            (p, i): Point => [
              p[0] + (points[i + 1][0] - p[0]) * (step / count),
              p[1] + (points[i + 1][1] - p[1]) * (step / count),
            ],
          );
      ring.push(plane.unproject(points[0]));
    }
  }
  return ring;
}

/** 닫힌 경계의 넓이(m²)와 무게중심. 정원 크기에서는 지구가 평평하다고 봐도 오차가 작다. */
function measure(ring: Point[]): { area: number; center: Point } {
  const [lng0, lat0] = ring[0];
  const meters = ring.map(
    ([lng, lat]): Point => [
      (lng - lng0) * RADIANS * EARTH_RADIUS * Math.cos(lat0 * RADIANS),
      (lat - lat0) * RADIANS * EARTH_RADIUS,
    ],
  );
  let doubled = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < meters.length - 1; i++) {
    const [x1, y1] = meters[i];
    const [x2, y2] = meters[i + 1];
    const cross = x1 * y2 - x2 * y1;
    doubled += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  const centerMeters: Point = doubled
    ? [cx / (3 * doubled), cy / (3 * doubled)]
    : [0, 0];
  return {
    area: Math.abs(doubled) / 2,
    center: [
      round(
        lng0 +
          centerMeters[0] / (RADIANS * EARTH_RADIUS * Math.cos(lat0 * RADIANS)),
        7,
      ),
      round(lat0 + centerMeters[1] / (RADIANS * EARTH_RADIUS), 7),
    ],
  };
}

/**
 * 저장된 경계를 다시 고칠 수 있게 평면 좌표의 경계로 되돌린다. gardenGeoFromShape 의 반대 방향이다.
 * 기준점은 경계의 첫 점이다(그릴 때도 첫 점을 기준점으로 삼는다).
 */
export function shapeFromGardenGeo(geo: GardenGeo): {
  origin: Point;
  shape: string;
} {
  const first = geo.boundary[0];
  if (first?.kind !== "M" || first.points.length !== 1)
    throw new Error(
      "저장된 경계를 읽지 못했습니다. 경계를 지우고 다시 그려 주세요.",
    );
  const origin: Point = [first.points[0][0], first.points[0][1]];
  const plane = planeAt(origin);
  return {
    origin,
    shape: serializeZonePath(
      geo.boundary.map((command) => ({
        kind: command.kind,
        points: command.points.map(([lng, lat]) => plane.project([lng, lat])),
      })),
    ),
  };
}

/**
 * 그린 경계를 서버에 저장할 모양으로 바꾼다.
 * 경계가 서로 교차하는 등 저장할 수 없는 모양이면 안내 문장과 함께 실패한다.
 */
export function gardenGeoFromShape(
  shape: string,
  plane: Plane,
): { geo: GardenGeo; area: number } {
  const geojson = zoneShapeToGeoJSON(shape, plane.unproject);
  if (geojson.type !== "Polygon")
    throw new Error("정원 경계는 닫힌 구역 하나로 그려 주세요.");
  const { area, center } = measure(geojson.coordinates[0] as Point[]);
  if (area < 1)
    throw new Error("정원이 너무 작습니다. 경계를 더 넓게 그려 주세요.");
  return {
    area,
    geo: {
      center,
      boundary: parseZonePath(shape).map((command) => ({
        kind: command.kind,
        points: command.points.map(plane.unproject),
      })),
      geojson: { type: "Polygon", coordinates: geojson.coordinates },
    },
  };
}
