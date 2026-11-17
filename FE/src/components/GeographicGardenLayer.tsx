import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as L from "leaflet";
import GardenMapScene from "./GardenMapScene";
import { projectGardenZone } from "../lib/gardenZoneProjection";
import type { Point } from "../api/gardenDetail";
import type { GardenMapSceneProps } from "../types/gardenMap";

type Props = {
  map: L.Map;
  scene: Omit<GardenMapSceneProps, "scale" | "compact">;
  onPick?: (point: Point) => void;
  interactive?: boolean;
};

/** Draw the geographic scene in a viewport-sized Leaflet overlay. */
export default function GeographicGardenLayer({
  map,
  scene,
  onPick,
  interactive = true,
}: Props) {
  const [container, setContainer] = useState<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(1);
  const current = useRef({ scene, onPick, interactive });
  current.current = { scene, onPick, interactive };

  useEffect(() => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "suncheon-illustration-layer");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "전체 지도 관수 구역과 UGV");
    svg.style.userSelect = "none";
    const overlay = L.svgOverlay(svg, map.getBounds().pad(0.25), {
      interactive: true,
      bubblingMouseEvents: true,
      opacity: 1,
      className: "suncheon-illustration-overlay",
    }).addTo(map);
    setContainer(svg);
    let frame = 0;
    let disposed = false;
    const measure = () => {
      const bounds = map.getBounds().pad(0.25);
      const [left, top] = projectGardenZone([
        bounds.getWest(),
        bounds.getNorth(),
      ]);
      const [right, bottom] = projectGardenZone([
        bounds.getEast(),
        bounds.getSouth(),
      ]);
      svg.setAttribute(
        "viewBox",
        `${left} ${top} ${right - left} ${bottom - top}`,
      );
      overlay.setBounds(bounds);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const matrix = svg.getScreenCTM();
        if (matrix) setScale(Math.max(0.00001, Math.hypot(matrix.a, matrix.b)));
      });
    };
    map.on("zoomend moveend resize viewreset", measure);
    measure();

    const handlers = [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.scrollWheelZoom,
      map.boxZoom,
      map.keyboard,
    ];
    let enabledBeforeDrag: boolean[] | null = null;
    const boundaryDragStart = () => {
      if (enabledBeforeDrag) return;
      map.stop();
      enabledBeforeDrag = handlers.map((handler) => handler.enabled());
      handlers.forEach((handler) => handler.disable());
    };
    const boundaryDragEnd = () => {
      const previous = enabledBeforeDrag;
      enabledBeforeDrag = null;
      previous?.forEach((enabled, index) => {
        if (enabled) handlers[index].enable();
      });
    };
    svg.addEventListener("garden-boundary-drag-start", boundaryDragStart);
    svg.addEventListener("garden-boundary-drag-end", boundaryDragEnd);

    const pointers = new Map<number, Point>();
    let start: Point | null = null;
    let moved = false;
    let suppressUntil = 0;
    let lastHandled: { point: Point; time: number } | null = null;
    let releasedPoint: { point: Point; time: number } | null = null;
    const down = (event: PointerEvent) => {
      if (
        enabledBeforeDrag ||
        (event.target instanceof Element &&
          event.target.closest(
            "[data-zone-handle], [data-zone-insert], [data-zone-curve], [data-zone-drawing-handle]",
          ))
      )
        return;
      if (event.button !== 0) return;
      if (pointers.size === 0) {
        start = [event.clientX, event.clientY];
        moved = false;
        suppressUntil = 0;
        releasedPoint = null;
      }
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size > 1) moved = true;
      // Pointer events keep bubbling so Leaflet can pan and pinch normally.
    };
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (
        start &&
        Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5
      )
        moved = true;
    };
    const up = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (event.type === "pointercancel") moved = true;
      if (moved) suppressUntil = performance.now() + 250;
      if (!pointers.size) {
        start = null;
        // MouseEvent coordinates can be rounded to whole CSS pixels. Preserve
        // the pointer position so scaled-map edits stay at the chosen point.
        releasedPoint = !moved
          ? { point: [event.clientX, event.clientY], time: performance.now() }
          : null;
      }
    };
    const click = (event: MouseEvent) => {
      // React handle events must receive the click; never treat it as a zone tap.
      if (
        event.target instanceof Element &&
        event.target.closest(
          "[data-zone-handle], [data-zone-insert], [data-zone-curve], [data-zone-drawing-handle]",
        )
      )
        return;
      if (enabledBeforeDrag) return;
      const props = current.current;
      if (!props.interactive) return;
      const now = performance.now();
      const repeated =
        event.detail > 1 &&
        lastHandled &&
        now - lastHandled.time < 500 &&
        Math.hypot(
          event.clientX - lastHandled.point[0],
          event.clientY - lastHandled.point[1],
        ) < 5;
      if (moved || now < suppressUntil || repeated) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const handled = {
        point: [event.clientX, event.clientY] as Point,
        time: now,
      };
      if (props.onPick) {
        lastHandled = handled;
        const position =
          event.detail > 0 &&
          releasedPoint &&
          performance.now() - releasedPoint.time < 500
            ? releasedPoint.point
            : [event.clientX, event.clientY];
        const container = map.getContainer();
        const rect = container.getBoundingClientRect();
        const latLng = map.containerPointToLatLng([
          position[0] - rect.left - container.clientLeft,
          position[1] - rect.top - container.clientTop,
        ]);
        props.onPick(projectGardenZone([latLng.lng, latLng.lat]));
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const target =
        event.target instanceof Element
          ? event.target.closest("[data-zone-id]")
          : null;
      const id = target?.getAttribute("data-zone-id");
      if (id && props.scene.selectable !== false) {
        lastHandled = handled;
        props.scene.onToggle(id);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const mapContainer = map.getContainer();
    mapContainer.addEventListener("pointerdown", down, true);
    mapContainer.addEventListener("click", click, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      disposed = true;
      boundaryDragEnd();
      svg.removeEventListener("garden-boundary-drag-start", boundaryDragStart);
      svg.removeEventListener("garden-boundary-drag-end", boundaryDragEnd);
      cancelAnimationFrame(frame);
      map.off("zoomend moveend resize viewreset", measure);
      mapContainer.removeEventListener("pointerdown", down, true);
      mapContainer.removeEventListener("click", click, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      overlay.remove();
      setContainer(null);
    };
  }, [map]);

  return (
    <>
      {container &&
        createPortal(
          <GardenMapScene
            {...scene}
            showImage={false}
            scale={scale}
            compact={scale < 0.75}
            selectable={interactive && !onPick && scene.selectable !== false}
            onToggle={(id) => {
              if (current.current.interactive && !current.current.onPick)
                current.current.scene.onToggle(id);
            }}
          />,
          container,
        )}
      <div
        className="suncheon-illustration-badge"
        style={{
          position: "absolute",
          zIndex: 450,
          left: "var(--suncheon-free-x)",
          bottom: "calc(var(--suncheon-credit-bottom) + 32px)",
          padding: "5px 8px",
          background: "#fffffff0",
          borderRadius: 4,
          color: "#33463b",
          fontSize: 9,
          lineHeight: 1.5,
          pointerEvents: "none",
        }}
      >
        UGV 위치는 시뮬레이션
      </div>
    </>
  );
}
