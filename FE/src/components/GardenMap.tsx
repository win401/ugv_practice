import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { GARDEN_IMAGE } from "../lib/gardenImage";
import { headingAt, pointAt } from "../lib/gardenRoute";
import {
  boundMapCamera,
  fitMapCamera,
  mapCenter,
  MAP_IMAGE,
  measureMapFrame,
} from "../lib/mapView";
import type { MapFrame, MapPoint } from "../lib/mapView";
import type { Mode, Zone } from "../types/dashboard";

const toPoints = (points: number[][]) =>
  points.map((p) => p.join(",")).join(" ");
const clampZoom = (value: number) => Math.min(4, Math.max(1, value));
const length = (a: MapPoint, b: MapPoint) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
type Gesture = {
  start: MapPoint;
  camera: MapPoint;
  scale: number;
  gardenId: string | null;
  moved: boolean;
  pinch?: { distance: number; zoom: number; anchor: MapPoint };
};

export default function GardenMap({
  gardens,
  zone,
  setZone,
  progress,
  mode,
  activeZone,
  zoom,
  onZoom,
  cameraReset = 0,
  schematic,
  draft,
  addDraftPoint,
  deviceLabel,
  robotRoute,
  markers,
  onPick,
}: {
  gardens: Zone[];
  zone: string;
  setZone: (id: string) => void;
  progress: number;
  mode: Mode;
  activeZone: string;
  zoom: number;
  onZoom?: (zoom: number) => void;
  cameraReset?: number;
  schematic: boolean;
  draft: number[][] | null;
  addDraftPoint: (point: number[]) => void;
  deviceLabel: string | null;
  robotRoute?: number[][];
  markers?: { x: number; y: number; tone: string; selected?: boolean }[];
  onPick?: (point: number[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const [frame, setFrame] = useState<MapFrame>({
    width: MAP_IMAGE.width,
    height: MAP_IMAGE.height,
    baseScale: 1,
    free: { left: 24, top: 100, right: 1100, bottom: 1000 },
    surface: { width: MAP_IMAGE.width, height: MAP_IMAGE.height },
  });
  const [camera, setCamera] = useState<MapPoint>([
    MAP_IMAGE.width / 2,
    MAP_IMAGE.height / 2,
  ]);
  const [localZoom, setLocalZoom] = useState(clampZoom(zoom));
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef(frame);
  const cameraRef = useRef(camera);
  const zoomRef = useRef(clampZoom(zoom));
  const onZoomRef = useRef(onZoom);
  const pointers = useRef(new Map<number, MapPoint>());
  const gesture = useRef<Gesture | null>(null);
  const movedCamera = useRef(false);
  onZoomRef.current = onZoom;

  function moveCamera(
    next: MapPoint,
    nextZoom = zoomRef.current,
    userDriven = true,
  ) {
    if (userDriven) movedCamera.current = true;
    const bounded = boundMapCamera(next, frameRef.current, nextZoom);
    cameraRef.current = bounded;
    setCamera(bounded);
  }
  function changeZoom(next: number, userDriven = true) {
    if (userDriven) movedCamera.current = true;
    const bounded = clampZoom(next);
    zoomRef.current = bounded;
    setLocalZoom(bounded);
    onZoomRef.current?.(bounded);
  }

  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const update = () => {
      const next = measureMapFrame(svg);
      frameRef.current = next;
      setFrame(next);
      moveCamera(
        movedCamera.current ? cameraRef.current : fitMapCamera(next),
        zoomRef.current,
        false,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    const owner = svg.closest(".app");
    if (!svg.closest(".adm-garden-map-frame")) {
      for (const selector of [
        ".panel",
        ".topbar",
        ".map-toolbar",
        ".map-controls",
      ]) {
        const element = owner?.querySelector(selector);
        if (element) observer.observe(element);
      }
    }
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  useLayoutEffect(() => {
    const nextZoom = clampZoom(zoom);
    if (nextZoom !== zoomRef.current) movedCamera.current = true;
    zoomRef.current = nextZoom;
    setLocalZoom(nextZoom);
    moveCamera(cameraRef.current, nextZoom, false);
  }, [zoom]);
  useLayoutEffect(() => {
    movedCamera.current = false;
    changeZoom(1, false);
    moveCamera(fitMapCamera(frameRef.current), 1, false);
  }, [cameraReset]);
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (pointers.current.size) return;
      const rect = svg.getBoundingClientRect();
      const cursor: MapPoint = [
        event.clientX - rect.left,
        event.clientY - rect.top,
      ];
      const center = mapCenter(frameRef.current);
      const scale = frameRef.current.baseScale * zoomRef.current;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const nextZoom = clampZoom(zoomRef.current * Math.exp(-delta * 0.0016));
      const nextScale = frameRef.current.baseScale * nextZoom;
      const anchor: MapPoint = [
        cameraRef.current[0] + (cursor[0] - center[0]) / scale,
        cameraRef.current[1] + (cursor[1] - center[1]) / scale,
      ];
      changeZoom(nextZoom);
      moveCamera(
        [
          anchor[0] - (cursor[0] - center[0]) / nextScale,
          anchor[1] - (cursor[1] - center[1]) / nextScale,
        ],
        nextZoom,
      );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, []);

  const pointOf = (event: ReactPointerEvent<SVGSVGElement>): MapPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  function beginPinch() {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b || !gesture.current) return;
    const center = mapCenter(frameRef.current);
    const scale = frameRef.current.baseScale * zoomRef.current;
    gesture.current.moved = true;
    gesture.current.pinch = {
      distance: Math.max(1, length(a, b)),
      zoom: zoomRef.current,
      anchor: [
        cameraRef.current[0] + ((a[0] + b[0]) / 2 - center[0]) / scale,
        cameraRef.current[1] + ((a[1] + b[1]) / 2 - center[1]) / scale,
      ],
    };
  }
  function endPointer(
    event: ReactPointerEvent<SVGSVGElement>,
    cancelled = false,
  ) {
    if (!pointers.current.has(event.pointerId)) return;
    const active = gesture.current;
    const tap =
      !cancelled && pointers.current.size === 1 && active && !active.moved;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (tap) {
      const matrix = worldRef.current?.getScreenCTM();
      if ((draft || onPick) && matrix) {
        const point = new DOMPoint(
          event.clientX,
          event.clientY,
        ).matrixTransform(matrix.inverse());
        if (
          point.x >= 0 &&
          point.y >= 0 &&
          point.x <= MAP_IMAGE.width &&
          point.y <= MAP_IMAGE.height
        ) {
          const picked = [Math.round(point.x), Math.round(point.y)];
          if (draft) addDraftPoint(picked);
          else onPick?.(picked);
        }
      } else if (active.gardenId) setZone(active.gardenId);
    }
    if (!pointers.current.size) {
      gesture.current = null;
      setDragging(false);
    } else {
      gesture.current = {
        start: [...pointers.current.values()][0],
        camera: cameraRef.current,
        scale: frameRef.current.baseScale * zoomRef.current,
        gardenId: null,
        moved: true,
      };
      if (pointers.current.size > 1) beginPinch();
    }
  }
  const scale = frame.baseScale * localZoom;
  const center = mapCenter(frame);
  const offset = [center[0] - camera[0] * scale, center[1] - camera[1] * scale];
  const route =
    robotRoute ?? gardens.find((g) => g.id === activeZone)?.route ?? [];
  const showRoute = route.length > 1;
  const [x, y] = showRoute ? pointAt(progress, route) : [0, 0];
  const heading = showRoute ? headingAt(progress, route) : 0;
  const reached = Math.floor((progress / 100) * (route.length - 1)) + 1;
  return (
    <svg
      className={`garden-map operating-garden-map ${schematic ? "schematic" : ""} ${draft || onPick ? "drawing" : ""}`}
      ref={svgRef}
      data-zoom={localZoom}
      data-image-revision={GARDEN_IMAGE.revision}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      preserveAspectRatio="none"
      aria-label="정원 이미지 위 미션 지도. 지점 선택은 클릭, 지도 이동은 드래그, 확대는 휠이나 확대 버튼을 사용하세요."
      role="group"
      tabIndex={0}
      style={{
        touchAction: "none",
        userSelect: "none",
        cursor: dragging ? "grabbing" : draft || onPick ? "crosshair" : "grab",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const point = pointOf(event);
        pointers.current.set(event.pointerId, point);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointers.current.size === 1) {
          const target =
            event.target instanceof Element
              ? event.target.closest("[data-garden-id]")
              : null;
          gesture.current = {
            start: point,
            camera: cameraRef.current,
            scale: frameRef.current.baseScale * zoomRef.current,
            gardenId: target?.getAttribute("data-garden-id") ?? null,
            moved: false,
          };
        } else beginPinch();
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId) || !gesture.current) return;
        const point = pointOf(event);
        pointers.current.set(event.pointerId, point);
        const active = gesture.current;
        if (pointers.current.size > 1 && active.pinch) {
          const [a, b] = [...pointers.current.values()];
          const c = mapCenter(frameRef.current);
          const nextZoom = clampZoom(
            (active.pinch.zoom * length(a, b)) / active.pinch.distance,
          );
          const s = frameRef.current.baseScale * nextZoom;
          changeZoom(nextZoom);
          moveCamera(
            [
              active.pinch.anchor[0] - ((a[0] + b[0]) / 2 - c[0]) / s,
              active.pinch.anchor[1] - ((a[1] + b[1]) / 2 - c[1]) / s,
            ],
            nextZoom,
          );
        } else if (active.moved || length(active.start, point) > 5) {
          active.moved = true;
          setDragging(true);
          moveCamera([
            active.camera[0] - (point[0] - active.start[0]) / active.scale,
            active.camera[1] - (point[1] - active.start[1]) / active.scale,
          ]);
        }
      }}
      onPointerUp={(event) => endPointer(event)}
      onPointerCancel={(event) => endPointer(event, true)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const directions: Record<string, MapPoint> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const direction = directions[event.key];
        if (direction) {
          event.preventDefault();
          moveCamera([
            cameraRef.current[0] + (direction[0] * 50) / scale,
            cameraRef.current[1] + (direction[1] * 50) / scale,
          ]);
        } else if (["+", "=", "-"].includes(event.key)) {
          event.preventDefault();
          changeZoom(zoomRef.current * (event.key === "-" ? 1 / 1.2 : 1.2));
          moveCamera(cameraRef.current);
        }
      }}
    >
      <g
        ref={worldRef}
        className="operating-map-scene"
        transform={`translate(${offset.join(" ")}) scale(${scale})`}
      >
        <image
          className="garden-decoration operating-map-image"
          href={GARDEN_IMAGE.url}
          {...MAP_IMAGE}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
        {gardens.map((s) => (
          <g
            key={s.id}
            role="button"
            tabIndex={0}
            aria-label={`${s.name} 선택`}
            data-garden-id={s.id}
            onClick={(event) => {
              if (event.detail === 0) setZone(s.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setZone(s.id);
              }
            }}
            className={`map-zone ${zone === s.id ? "selected" : ""}`}
          >
            <path
              d={s.shape}
              fill={zone === s.id ? "#245bff" : "#ffffff"}
              fillOpacity={zone === s.id ? ".24" : ".12"}
              stroke={zone === s.id ? "#245bff" : "#ffffff"}
              strokeWidth={zone === s.id ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={zone === s.id ? "0" : "6 5"}
            />
            <g
              transform={`translate(${s.label.join(" ")}) scale(${1 / scale})`}
            >
              <rect
                x={-10}
                y={-21}
                width={46 + s.name.length * 16}
                height={33}
                rx={16}
                fill={zone === s.id ? "#245bff" : "#fffffff0"}
              />
              <text
                x={5}
                y={0}
                fill={zone === s.id ? "#fff" : "#18181b"}
                fontSize={13}
                fontWeight={600}
              >
                {s.letter}　{s.name}
              </text>
            </g>
          </g>
        ))}
        {showRoute && (
          <g pointerEvents="none">
            <polyline
              points={toPoints(route)}
              fill="none"
              stroke="#fff"
              strokeWidth="6"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              opacity=".75"
            />
            <polyline
              points={toPoints(route)}
              fill="none"
              stroke="#245bff"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              opacity=".55"
            />
            <polyline
              points={toPoints([...route.slice(0, reached), [x, y]])}
              fill="none"
              stroke="#245bff"
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {!markers &&
              route.map(([nx, ny], i) => (
                <circle
                  key={i}
                  cx={nx}
                  cy={ny}
                  r="5.5"
                  fill="#fff"
                  stroke="#245bff"
                  strokeWidth="2.5"
                />
              ))}
          </g>
        )}
        {markers && markers.length > 0 && (
          <g pointerEvents="none" className="map-markers">
            <polyline
              points={toPoints(markers.map((m) => [m.x, m.y]))}
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeDasharray="5 5"
              opacity=".9"
            />
            {markers.map((m, i) => (
              <g
                key={i}
                transform={`translate(${m.x} ${m.y}) scale(${1 / scale})`}
              >
                {m.selected && (
                  <circle
                    r="19"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle
                  r="13"
                  className={`marker-${m.tone}`}
                  stroke="#fff"
                  strokeWidth="2.5"
                />
                <text
                  y="4.5"
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="700"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </g>
        )}
        {showRoute && deviceLabel && (
          <g
            transform={`translate(${x} ${y}) scale(${1 / scale})`}
            className={mode === "running" ? "map-robot running" : "map-robot"}
            pointerEvents="none"
          >
            <circle
              className="robot-pulse"
              r="28"
              fill="#ff6b35"
              opacity=".2"
            />
            <circle r="19" fill="#ff6b35" stroke="#fff" strokeWidth="2" />
            <g className="robot-body" transform={`rotate(${heading})`}>
              <rect x="-13" y="-9" width="6" height="19" rx="3" fill="#fff" />
              <rect x="7" y="-9" width="6" height="19" rx="3" fill="#fff" />
              <rect
                x="-8"
                y="-11"
                width="16"
                height="22"
                rx="5"
                fill="#fff"
                stroke="#ff6b35"
              />
              <path d="M-3-5H3" stroke="#ff6b35" strokeWidth="2" />
            </g>
            <rect
              x="-39"
              y="-57"
              width="78"
              height="25"
              rx="12"
              fill="#18181b"
            />
            <text
              x="0"
              y="-40"
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="600"
            >
              {deviceLabel}
            </text>
          </g>
        )}
        {draft && (
          <g pointerEvents="none">
            <polygon
              points={toPoints(draft)}
              fill="#ff6b35"
              fillOpacity=".25"
              stroke="#ff6b35"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="6 5"
            />
            {draft.map(([px, py], i) => (
              <circle
                key={i}
                cx={px}
                cy={py}
                r="6"
                fill="#fff"
                stroke="#ff6b35"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}
