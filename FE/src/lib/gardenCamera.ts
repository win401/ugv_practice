import type { Point } from "../api/gardenDetail";

export const GARDEN_DETAIL_ZOOM = { min: 1, max: 8, step: 1.25 } as const;

type GardenImageSize = { width: number; height: number };

export type GardenMapFrame = {
  width: number;
  height: number;
  free: { x: number; y: number; width: number; height: number };
  baseScale: number;
  surface: { width: number; height: number };
};
const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

export const gardenFrameCenter = (frame: GardenMapFrame): Point => [
  frame.free.x + frame.free.width / 2,
  frame.free.y + frame.free.height / 2,
];

/** Overlay geometry is measured in screen pixels; map geometry stays in image pixels. */
export function measureGardenFrame(
  element: SVGSVGElement | HTMLElement,
  data: GardenImageSize,
): GardenMapFrame {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const owner = element.closest(".app") ?? document;
  const box = (selector: string, outsidePanel = false) => {
    const element = owner.querySelector(selector);
    if (
      !element?.getClientRects().length ||
      (outsidePanel && element.closest(".panel"))
    )
      return null;
    return element.getBoundingClientRect();
  };
  const panel = box(".panel");
  const stacked = !!panel && panel.width > width * 0.75;
  const padding =
    Number.parseFloat(
      getComputedStyle(element).getPropertyValue("--workspace-edge"),
    ) || 20;
  const left = padding;
  let right = width - padding;
  let top = Math.max(
    padding,
    (box(".topbar")?.bottom ?? rect.top) - rect.top + 12,
  );
  let bottom = height - padding;
  if (panel) {
    if (stacked) bottom = Math.min(bottom, panel.top - rect.top - 12);
    else right = Math.min(right, panel.left - rect.left - 12);
  }
  const toolbar = box(".map-toolbar", true);
  if (toolbar) top = Math.max(top, toolbar.bottom - rect.top + 12);
  else {
    for (const selector of [".map-heading", ".map-mode"]) {
      const overlay = box(selector, true);
      if (
        !overlay ||
        overlay.left - rect.left >= right ||
        overlay.right <= rect.left + left
      )
        continue;
      if (overlay.top - rect.top < height * 0.45)
        top = Math.max(top, overlay.bottom - rect.top + 12);
      else bottom = Math.min(bottom, overlay.top - rect.top - 12);
    }
  }
  const controls = box(".map-controls", true);
  if (controls) {
    if (stacked) bottom = Math.min(bottom, controls.top - rect.top - 8);
    else right = Math.min(right, controls.left - rect.left - 12);
  }
  const free = {
    x: left,
    y: Math.min(top, height - 60),
    width: Math.max(80, right - left),
    height: Math.max(60, bottom - top),
  };
  // The photograph covers the whole visible map, including the header/toolbars.
  // The panel hides the remaining portion; use that boundary when clamping pan.
  const surface = {
    width: panel && !stacked ? Math.min(width, panel.left - rect.left) : width,
    height: panel && stacked ? Math.min(height, panel.top - rect.top) : height,
  };
  return {
    width,
    height,
    free,
    surface,
    // One image covers the visible map. A stacked panel does not force extra zoom.
    baseScale: Math.max(width / data.width, surface.height / data.height),
  };
}

/** Fit the photograph once; never fill the edges with a second fixed photograph. */
export function fittedGardenCamera(
  frame: GardenMapFrame,
  data: GardenImageSize,
): Point {
  const center = gardenFrameCenter(frame);
  return [
    data.width / 2 + (center[0] - frame.width / 2) / frame.baseScale,
    data.height / 2 + (center[1] - frame.surface.height / 2) / frame.baseScale,
  ];
}

export function boundedGardenCamera(
  camera: Point,
  frame: GardenMapFrame,
  zoom: number,
  data: GardenImageSize,
): Point {
  const scale = frame.baseScale * zoom;
  const center = gardenFrameCenter(frame);
  return [
    clamp(
      camera[0],
      center[0] / scale,
      data.width - (frame.surface.width - center[0]) / scale,
    ),
    clamp(
      camera[1],
      center[1] / scale,
      data.height - (frame.surface.height - center[1]) / scale,
    ),
  ];
}
