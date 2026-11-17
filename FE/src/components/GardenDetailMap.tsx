import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "../api/gardenDetail";
import type { GardenMapSceneProps } from "../types/gardenMap";
import GardenMapScene from "./GardenMapScene";
import {
  type GardenMapFrame as Frame,
  measureGardenFrame as measureFrame,
  gardenFrameCenter as centerOf,
  fittedGardenCamera as fittedCamera,
  boundedGardenCamera as boundedCamera,
  GARDEN_DETAIL_ZOOM,
} from "../lib/gardenCamera";
import {
  interpolateMapCamera,
  MAP_CAMERA_DURATION,
  prefersReducedMapMotion,
} from "../lib/mapCameraMotion";

type Props = {
  scene: Omit<GardenMapSceneProps, "scale" | "compact">;
  zoom: number;
  onZoom: (zoom: number) => void;
  cameraReset: number;
  focusRobot: number;
};
type Gesture = {
  start: Point;
  camera: Point;
  scale: number;
  moved: boolean;
  pinch?: { distance: number; zoom: number; anchor: Point };
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);
const length = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export default function GardenDetailMap({
  scene,
  zoom,
  onZoom,
  cameraReset,
  focusRobot,
}: Props) {
  const { data } = scene;
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState<Frame>({
    width: 1536,
    height: 1024,
    free: { x: 24, y: 100, width: 1000, height: 680 },
    baseScale: 1,
    surface: { width: 1100, height: 1024 },
  });
  const [camera, setCamera] = useState<Point>([
    data.width / 2,
    data.height / 2,
  ]);
  const [displayZoom, setDisplayZoom] = useState(
    clamp(zoom, GARDEN_DETAIL_ZOOM.min, GARDEN_DETAIL_ZOOM.max),
  );
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const movedCamera = useRef(false);
  const previousFocusRequest = useRef(focusRobot);
  const gesture = useRef<Gesture | null>(null);
  const cameraRef = useRef(camera);
  const frameRef = useRef(frame);
  const zoomRef = useRef(
    clamp(zoom, GARDEN_DETAIL_ZOOM.min, GARDEN_DETAIL_ZOOM.max),
  );
  const targetZoomRef = useRef(
    clamp(zoom, GARDEN_DETAIL_ZOOM.min, GARDEN_DETAIL_ZOOM.max),
  );
  const animationFrame = useRef(0);
  const firstFit = useRef(true);
  const dataRef = useRef(data);
  const onZoomRef = useRef(onZoom);
  const poseRef = useRef(scene.vehicle.point);
  dataRef.current = data;
  onZoomRef.current = onZoom;
  poseRef.current = scene.vehicle.point;

  function cancelCameraMotion(syncTarget = false) {
    cancelAnimationFrame(animationFrame.current);
    animationFrame.current = 0;
    if (syncTarget && targetZoomRef.current !== zoomRef.current) {
      targetZoomRef.current = zoomRef.current;
      onZoomRef.current(zoomRef.current);
    }
  }

  function writeCamera(next: Point, nextZoom: number) {
    const bounded = boundedCamera(
      next,
      frameRef.current,
      nextZoom,
      dataRef.current,
    );
    cameraRef.current = bounded;
    zoomRef.current = nextZoom;
    setCamera(bounded);
    setDisplayZoom(nextZoom);
  }

  function moveCamera(next: Point, nextZoom = zoomRef.current) {
    cancelCameraMotion();
    targetZoomRef.current = nextZoom;
    writeCamera(next, nextZoom);
  }

  function animateCamera(next: Point, nextZoom: number, animate = true) {
    cancelCameraMotion();
    targetZoomRef.current = nextZoom;
    const from = { camera: cameraRef.current, zoom: zoomRef.current };
    const to = {
      camera: boundedCamera(next, frameRef.current, nextZoom, dataRef.current),
      zoom: nextZoom,
    };
    if (!animate || prefersReducedMapMotion()) {
      writeCamera(to.camera, to.zoom);
      return;
    }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / MAP_CAMERA_DURATION);
      const pose = interpolateMapCamera(from, to, progress);
      writeCamera(pose.camera, pose.zoom);
      animationFrame.current = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    animationFrame.current = requestAnimationFrame(tick);
  }

  useLayoutEffect(() => () => cancelCameraMotion(), []);

  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const update = () => {
      cancelCameraMotion(true);
      const nextFrame = measureFrame(svg, dataRef.current);
      frameRef.current = nextFrame;
      setFrame(nextFrame);
      const nextCamera = boundedCamera(
        movedCamera.current
          ? cameraRef.current
          : fittedCamera(nextFrame, dataRef.current),
        nextFrame,
        zoomRef.current,
        dataRef.current,
      );
      cameraRef.current = nextCamera;
      setCamera(nextCamera);
    };
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    const owner = svg.closest(".app") ?? document;
    for (const selector of [
      ".panel",
      ".topbar",
      ".map-toolbar",
      ".map-heading",
      ".map-mode",
      ".map-controls",
    ]) {
      const element = owner.querySelector(selector);
      if (element) observer.observe(element);
    }
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [data.width, data.height, data.imageRevision]);

  useLayoutEffect(() => {
    const nextZoom = clamp(
      zoom,
      GARDEN_DETAIL_ZOOM.min,
      GARDEN_DETAIL_ZOOM.max,
    );
    if (nextZoom === targetZoomRef.current) return;
    movedCamera.current = true;
    animateCamera(cameraRef.current, nextZoom);
  }, [zoom]);

  useLayoutEffect(() => {
    // A remounted detail view starts with the whole garden in view.
    onZoomRef.current(1);
    movedCamera.current = false;
    animateCamera(
      fittedCamera(frameRef.current, dataRef.current),
      1,
      !firstFit.current,
    );
    firstFit.current = false;
  }, [cameraReset]);

  useLayoutEffect(() => {
    // Counters persist in the parent across tab switches; only a new request focuses.
    if (focusRobot === previousFocusRequest.current) return;
    previousFocusRequest.current = focusRobot;
    if (focusRobot === 0) return;
    movedCamera.current = true;
    const nextZoom = Math.max(2, targetZoomRef.current);
    onZoomRef.current(nextZoom);
    animateCamera(poseRef.current, nextZoom);
  }, [focusRobot]);

  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (pointers.current.size) return;
      const rect = svg.getBoundingClientRect();
      const cursor: Point = [
        event.clientX - rect.left,
        event.clientY - rect.top,
      ];
      const center = centerOf(frameRef.current);
      const oldScale = frameRef.current.baseScale * zoomRef.current;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const nextZoom = clamp(
        targetZoomRef.current * Math.exp(-delta * 0.0016),
        GARDEN_DETAIL_ZOOM.min,
        GARDEN_DETAIL_ZOOM.max,
      );
      const nextScale = frameRef.current.baseScale * nextZoom;
      const anchor: Point = [
        cameraRef.current[0] + (cursor[0] - center[0]) / oldScale,
        cameraRef.current[1] + (cursor[1] - center[1]) / oldScale,
      ];
      movedCamera.current = true;
      animateCamera(
        [
          anchor[0] - (cursor[0] - center[0]) / nextScale,
          anchor[1] - (cursor[1] - center[1]) / nextScale,
        ],
        nextZoom,
      );
      onZoomRef.current(nextZoom);
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, []);

  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const beginPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b || !gesture.current) return;
    const center = centerOf(frameRef.current);
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
  };
  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    } else {
      gesture.current = {
        start: [...pointers.current.values()][0],
        camera: cameraRef.current,
        scale: frameRef.current.baseScale * zoomRef.current,
        moved: true,
      };
      if (pointers.current.size > 1) beginPinch();
    }
  };
  const actualZoom = displayZoom;
  const scale = frame.baseScale * actualZoom;
  const freeCenter = centerOf(frame);
  const offset: Point = [
    freeCenter[0] - camera[0] * scale,
    freeCenter[1] - camera[1] * scale,
  ];

  return (
    <svg
      ref={svgRef}
      className={`garden-map detail-garden-map${dragging ? " is-panning" : ""}`}
      data-testid="garden-detail-map"
      data-zoom={actualZoom}
      data-zoom-target={clamp(
        zoom,
        GARDEN_DETAIL_ZOOM.min,
        GARDEN_DETAIL_ZOOM.max,
      )}
      data-image-revision={data.imageRevision}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      preserveAspectRatio="none"
      role="group"
      tabIndex={0}
      aria-label="정원 상세 예시 화면. 드래그로 이동하고 휠이나 확대 버튼으로 확대할 수 있습니다."
      style={{
        touchAction: "none",
        userSelect: "none",
        cursor: dragging ? "grabbing" : "grab",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Gestures take over the currently rendered view, never the zoom target.
        cancelCameraMotion(true);
        const point = pointerPoint(event);
        pointers.current.set(event.pointerId, point);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointers.current.size === 1) {
          gesture.current = {
            start: point,
            camera: cameraRef.current,
            scale: frameRef.current.baseScale * zoomRef.current,
            moved: false,
          };
        } else beginPinch();
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId) || !gesture.current) return;
        const point = pointerPoint(event);
        pointers.current.set(event.pointerId, point);
        const active = gesture.current;
        if (pointers.current.size > 1 && active.pinch) {
          const [a, b] = [...pointers.current.values()];
          const center = centerOf(frameRef.current);
          const nextZoom = clamp(
            (active.pinch.zoom * length(a, b)) / active.pinch.distance,
            GARDEN_DETAIL_ZOOM.min,
            GARDEN_DETAIL_ZOOM.max,
          );
          const nextScale = frameRef.current.baseScale * nextZoom;
          movedCamera.current = true;
          moveCamera(
            [
              active.pinch.anchor[0] -
                ((a[0] + b[0]) / 2 - center[0]) / nextScale,
              active.pinch.anchor[1] -
                ((a[1] + b[1]) / 2 - center[1]) / nextScale,
            ],
            nextZoom,
          );
          onZoomRef.current(nextZoom);
        } else if (active.moved || length(active.start, point) > 5) {
          active.moved = true;
          movedCamera.current = true;
          setDragging(true);
          moveCamera([
            active.camera[0] - (point[0] - active.start[0]) / active.scale,
            active.camera[1] - (point[1] - active.start[1]) / active.scale,
          ]);
        }
      }}
      onPointerUp={(event) => endPointer(event)}
      onPointerCancel={(event) => endPointer(event)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const direction: Record<string, Point> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const delta = direction[event.key];
        if (delta) {
          event.preventDefault();
          cancelCameraMotion(true);
          movedCamera.current = true;
          moveCamera([
            cameraRef.current[0] + (delta[0] * 50) / scale,
            cameraRef.current[1] + (delta[1] * 50) / scale,
          ]);
        } else if (["+", "=", "-"].includes(event.key)) {
          event.preventDefault();
          onZoomRef.current(
            clamp(
              targetZoomRef.current * (event.key === "-" ? 1 / 1.2 : 1.2),
              GARDEN_DETAIL_ZOOM.min,
              GARDEN_DETAIL_ZOOM.max,
            ),
          );
        }
      }}
    >
      <title>정원 상세 예시와 UGV 상태</title>
      <g
        className="detail-map-camera"
        transform={`translate(${offset.join(" ")}) scale(${scale})`}
      >
        <GardenMapScene
          {...scene}
          selectable={false}
          scale={scale}
          compact={frame.free.width < 500 || actualZoom < 1.6}
        />
      </g>
    </svg>
  );
}
