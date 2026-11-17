import { GARDEN_IMAGE } from "./gardenImage";
import type { Point } from "../api/gardenDetail";

/**
 * Illustrative placement, not georeferencing or a navigation transform.
 * Two approximate Suncheon landmarks orient an axis-aligned Web Mercator frame.
 * One least-squares scale preserves the photograph's aspect ratio; the landmarks
 * therefore need not coincide exactly with their real-world positions.
 */
const RADIUS = 6378137;
const radians = Math.PI / 180;
const project = ([latitude, longitude]: Point): Point => [
  RADIUS * longitude * radians,
  RADIUS * Math.log(Math.tan(Math.PI / 4 + (latitude * radians) / 2)),
];
const unproject = ([x, y]: Point): Point => [
  (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) / radians,
  x / RADIUS / radians,
];
const anchors = [
  { pixel: [558, 521] as Point, geo: [34.92963, 127.50741] as Point },
  { pixel: [850, 367] as Point, geo: [34.92985, 127.50802] as Point },
];
const [a, b] = anchors.map((anchor) => project(anchor.geo));
const dx = anchors[1].pixel[0] - anchors[0].pixel[0];
const dy = anchors[0].pixel[1] - anchors[1].pixel[1];
const scale = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) / (dx * dx + dy * dy);
const pixelMid: Point = [
  (anchors[0].pixel[0] + anchors[1].pixel[0]) / 2,
  (anchors[0].pixel[1] + anchors[1].pixel[1]) / 2,
];
const worldMid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export function gardenImageToLatLng([x, y]: Point): Point {
  return unproject([
    worldMid[0] + (x - pixelMid[0]) * scale,
    worldMid[1] - (y - pixelMid[1]) * scale,
  ]);
}

export function gardenLatLngToImage(geo: Point): Point {
  const world = project(geo);
  return [
    pixelMid[0] + (world[0] - worldMid[0]) / scale,
    pixelMid[1] - (world[1] - worldMid[1]) / scale,
  ];
}

/** Leaflet bounds: south-west followed by north-east. */
export const GARDEN_ILLUSTRATION_BOUNDS: [Point, Point] = [
  gardenImageToLatLng([0, GARDEN_IMAGE.height]),
  gardenImageToLatLng([GARDEN_IMAGE.width, 0]),
];
