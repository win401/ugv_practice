import { GARDEN_IMAGE } from "./gardenImage";

/** All operational-map positions use pixels of the current detail image. */
export const MAP_IMAGE = {
  x: 0,
  y: 0,
  width: GARDEN_IMAGE.width,
  height: GARDEN_IMAGE.height,
};
export type MapPoint = [number, number];
export type MapFrame = {
  width: number;
  height: number;
  baseScale: number;
  free: { left: number; top: number; right: number; bottom: number };
  surface: { width: number; height: number };
};

export const mapCenter = (frame: MapFrame): MapPoint => [
  (frame.free.left + frame.free.right) / 2,
  (frame.free.top + frame.free.bottom) / 2,
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Initial fit centers the one photograph in the entire SVG, not just its free area. */
export function fitMapCamera(frame: MapFrame): MapPoint {
  const center = mapCenter(frame);
  return [
    MAP_IMAGE.width / 2 + (center[0] - frame.width / 2) / frame.baseScale,
    MAP_IMAGE.height / 2 +
      (center[1] - frame.surface.height / 2) / frame.baseScale,
  ];
}

export function boundMapCamera(
  camera: MapPoint,
  frame: MapFrame,
  zoom: number,
): MapPoint {
  const scale = frame.baseScale * zoom;
  const center = mapCenter(frame);
  return [
    clamp(
      camera[0],
      center[0] / scale,
      MAP_IMAGE.width - (frame.surface.width - center[0]) / scale,
    ),
    clamp(
      camera[1],
      center[1] / scale,
      MAP_IMAGE.height - (frame.surface.height - center[1]) / scale,
    ),
  ];
}

/** One image fills the full viewport. Panning can bring either edge into the
 * unobstructed map area; the panel gutter uses its neutral background. */
export function measureMapFrame(svg: SVGSVGElement): MapFrame {
  const map = svg.getBoundingClientRect();
  const width = Math.max(1, map.width);
  const height = Math.max(1, map.height);
  const owner = svg.closest(".app");
  const rectOf = (selector: string) => {
    const element = owner?.querySelector(selector);
    if (!element?.getClientRects().length || element.closest(".adm-modal"))
      return null;
    return element.getBoundingClientRect();
  };
  // Admin's embedded drawing canvas must ignore the workspace's floating panel.
  const embedded = !!svg.closest(".adm-garden-map-frame");
  const panel = embedded ? null : rectOf(".panel");
  const toolbar = embedded ? null : rectOf(".map-toolbar");
  const controls = embedded ? null : rectOf(".map-controls");
  const topbar = embedded ? null : rectOf(".topbar");
  const edge = embedded
    ? 12
    : Number.parseFloat(
        getComputedStyle(svg).getPropertyValue("--workspace-edge"),
      ) || 20;
  const stacked = !!panel && panel.width > width * 0.75;
  let top = Math.max(edge, (topbar?.bottom ?? map.top) - map.top + 12);
  let right = panel && !stacked ? panel.left - map.left - 12 : width - edge;
  let bottom = panel && stacked ? panel.top - map.top - 12 : height - edge;
  if (toolbar) top = Math.max(top, toolbar.bottom - map.top + 12);
  if (controls) {
    if (stacked) bottom = Math.min(bottom, controls.top - map.top - 8);
    else right = Math.min(right, controls.left - map.left - 12);
  }
  const coverHeight =
    panel && stacked ? Math.min(height, panel.top - map.top) : height;
  return {
    width,
    height,
    baseScale: Math.max(
      width / MAP_IMAGE.width,
      coverHeight / MAP_IMAGE.height,
    ),
    free: {
      left: edge,
      top: Math.min(top, height - 60),
      right: Math.max(edge + 80, right),
      bottom: Math.max(top + 60, bottom),
    },
    surface: {
      width: panel && !stacked ? Math.min(width, panel.left - map.left) : width,
      height: panel && stacked ? Math.min(height, panel.top - map.top) : height,
    },
  };
}
