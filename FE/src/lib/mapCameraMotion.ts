import type { Point } from "../api/gardenDetail";

export type MapCameraPose = { camera: Point; zoom: number };
export const MAP_CAMERA_DURATION = 180;

export const prefersReducedMapMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Interpolate inverse zoom so a wheel's image anchor stays under its cursor. */
export function interpolateMapCamera(
  from: MapCameraPose,
  to: MapCameraPose,
  progress: number,
): MapCameraPose {
  const t = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - t) ** 3;
  return {
    camera: [
      from.camera[0] + (to.camera[0] - from.camera[0]) * eased,
      from.camera[1] + (to.camera[1] - from.camera[1]) * eased,
    ],
    zoom: 1 / (1 / from.zoom + (1 / to.zoom - 1 / from.zoom) * eased),
  };
}
