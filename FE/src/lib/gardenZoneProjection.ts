import type { Point } from "../api/gardenDetail";

const radians = Math.PI / 180;
const scale = 2 ** 28 / (2 * Math.PI);
const originLng = 127.508;
const mercatorY = (latitude: number) =>
  Math.asinh(Math.tan(latitude * radians));
const originY = mercatorY(34.93);

/** Local Web Mercator coordinates at zoom 20, used only to draw and edit. */
export function projectGardenZone([lng, lat]: Point): Point {
  return [
    (lng - originLng) * radians * scale,
    (originY - mercatorY(lat)) * scale,
  ];
}

/** WGS84 [longitude, latitude]. */
export function unprojectGardenZone([x, y]: Point): Point {
  return [
    originLng + x / scale / radians,
    Math.atan(Math.sinh(originY - y / scale)) / radians,
  ];
}

export function isGardenZonePosition(point: unknown): point is Point {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    point.every(Number.isFinite) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 85.05112878
  );
}
