import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "../api/gardenDetail";
import type { GardenZoneEditor } from "../types/gardenMap";
import {
  findClosestZoneBoundaryPoint,
  getZoneBoundaryHandles,
  getZoneBoundarySegments,
} from "../lib/zoneGeometry";

type InsertPreview = { segmentId: string; t: number; point: Point };
type Gesture = {
  pointerId: number;
  element: SVGElement;
  surface: SVGSVGElement;
} & (
  | {
      kind: "move";
      id: string;
      origin: Point;
      offset: Point;
      onEnd: () => void;
    }
  | {
      kind: "segment";
      action: "add" | "curve";
      segmentId: string;
      start: Point;
      moved: boolean;
    }
);
const directions: Record<string, Point> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Shared image-coordinate handles; the enclosing SVG supplies the current projection. */
export default function ZoneBoundaryEditor({
  editor,
  scale,
}: {
  editor: GardenZoneEditor;
  scale: number;
}) {
  const group = useRef<SVGGElement>(null);
  const current = useRef({ editor, scale });
  current.current = { editor, scale };
  const handles = useMemo(
    () => getZoneBoundaryHandles(editor.shape),
    [editor.shape],
  );
  const segments = useMemo(
    () => getZoneBoundarySegments(editor.shape),
    [editor.shape],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<InsertPreview | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const inverseScale = 1 / Math.max(0.00001, scale);

  function position(clientX: number, clientY: number): Point | null {
    const matrix = group.current?.getScreenCTM();
    if (!matrix) return null;
    try {
      const point = new DOMPoint(clientX, clientY).matrixTransform(
        matrix.inverse(),
      );
      return Number.isFinite(point.x) && Number.isFinite(point.y)
        ? [point.x, point.y]
        : null;
    } catch {
      return null;
    }
  }
  function freezeMap() {
    const surface = group.current?.ownerSVGElement;
    if (surface)
      surface.dispatchEvent(new CustomEvent("garden-boundary-drag-start"));
    return surface;
  }
  function finish() {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    if (active.element.hasPointerCapture(active.pointerId))
      active.element.releasePointerCapture(active.pointerId);
    active.surface.dispatchEvent(new CustomEvent("garden-boundary-drag-end"));
    if (active.kind === "move") active.onEnd();
    setActiveId(null);
  }
  useEffect(() => {
    const blur = () => finish();
    const clear = () => {
      finish();
      pendingFocus.current = null;
      setSelectedId(null);
      setFocusedId(null);
      setFocusedSegmentId(null);
      setHoveredSegmentId(null);
      setPreview(null);
      if (
        document.activeElement instanceof SVGElement &&
        group.current?.contains(document.activeElement)
      )
        document.activeElement.blur();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("garden-boundary-clear-selection", clear);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("garden-boundary-clear-selection", clear);
      finish();
    };
  }, [editor.zoneId]);

  useEffect(() => {
    finish();
    setPreview(null);
    setFocusedSegmentId(null);
    setHoveredSegmentId(null);
  }, [editor.tool]);

  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (!id || !handles.some((handle) => handle.id === id)) return;
    const handle = group.current?.querySelector<SVGGElement>(
      `[data-zone-handle="${id}"]`,
    );
    if (!handle) return;
    pendingFocus.current = null;
    handle.focus({ preventScroll: true });
  }, [handles]);

  function nearby(clientX: number, clientY: number): InsertPreview | null {
    const point = position(clientX, clientY);
    if (!point) return null;
    const match = findClosestZoneBoundaryPoint(
      current.current.editor.shape,
      point,
    );
    if (
      !match ||
      match.t <= 0.0001 ||
      match.t >= 0.9999 ||
      match.distance * current.current.scale > 12
    )
      return null;
    // An existing anchor should be selected, not duplicated by a nearly coincident insertion.
    if (
      getZoneBoundaryHandles(current.current.editor.shape).some(
        (handle) =>
          handle.kind === "anchor" &&
          Math.hypot(
            handle.point[0] - match.point[0],
            handle.point[1] - match.point[1],
          ) *
            current.current.scale <
            12,
      )
    )
      return null;
    return { segmentId: match.segmentId, t: match.t, point: match.point };
  }
  function insert(point: InsertPreview) {
    const id = current.current.editor.onInsert(point.segmentId, point.t);
    setPreview(null);
    if (id) {
      pendingFocus.current = id;
      setSelectedId(id);
      setFocusedId(id);
    }
  }
  function convert(segmentId: string) {
    current.current.editor.onConvert(segmentId);
    const id = `${segmentId}:0`;
    pendingFocus.current = id;
    setSelectedId(id);
    setFocusedId(id);
    setPreview(null);
    // Existing curves already have this control; newly converted lines focus after render.
    const handle = group.current?.querySelector<SVGGElement>(
      `[data-zone-handle="${id}"][data-kind="control"]`,
    );
    if (handle) {
      pendingFocus.current = null;
      handle.focus({ preventScroll: true });
    }
  }
  function move(event: ReactPointerEvent<SVGGElement>) {
    const active = gesture.current;
    if (
      !active ||
      active.kind !== "move" ||
      active.pointerId !== event.pointerId
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const point = position(event.clientX, event.clientY);
    if (!point) return;
    const next: Point = [
      point[0] + active.offset[0],
      point[1] + active.offset[1],
    ];
    if (event.shiftKey) {
      if (
        Math.abs(next[0] - active.origin[0]) >=
        Math.abs(next[1] - active.origin[1])
      )
        next[1] = active.origin[1];
      else next[0] = active.origin[0];
    }
    current.current.editor.onMove(active.id, next);
  }

  return (
    <g
      ref={group}
      className="zone-boundary-editor"
      data-testid="zone-boundary-editor"
      data-editing-zone={editor.zoneId}
      data-editor-tool={editor.tool}
      role="group"
      aria-label="구역 경계 편집. 사각형은 경계, 작은 원은 곡선 모양을 조절합니다."
    >
      {editor.tool !== "select" &&
        segments.map((segment, index) => (
          <path
            key={segment.id}
            className={`zone-boundary-segment-target zone-boundary-${editor.tool === "add" ? "insert" : "curve"}-target`}
            data-testid={
              editor.tool === "add"
                ? "zone-boundary-insert-target"
                : "zone-boundary-curve-target"
            }
            data-zone-insert={editor.tool === "add" ? segment.id : undefined}
            data-zone-curve={editor.tool === "curve" ? segment.id : undefined}
            data-segment-kind={segment.kind}
            d={segment.shape}
            fill="none"
            stroke="transparent"
            strokeWidth={22}
            vectorEffect="non-scaling-stroke"
            pointerEvents="stroke"
            role="button"
            tabIndex={0}
            aria-label={
              editor.tool === "add"
                ? `경계선 ${index + 1}에 점 추가. Enter로 중간에 추가`
                : segment.kind === "L" || segment.kind === "Z"
                  ? `경계선 ${index + 1}을 곡선으로 변경. Enter로 변경`
                  : `곡선 ${index + 1} 조절점 선택. Enter로 선택`
            }
            style={{
              cursor: editor.tool === "add" ? "crosshair" : "default",
              pointerEvents: "stroke",
              touchAction: "none",
              outline: "none",
            }}
            onFocus={() => setFocusedSegmentId(segment.id)}
            onBlur={() => setFocusedSegmentId(null)}
            onPointerEnter={(event) => {
              setHoveredSegmentId(segment.id);
              if (!gesture.current && editor.tool === "add")
                setPreview(nearby(event.clientX, event.clientY));
            }}
            onPointerLeave={() => {
              if (!gesture.current) {
                setPreview(null);
                setHoveredSegmentId(null);
              }
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              if (event.button !== 0 || gesture.current) return;
              const surface = freezeMap();
              if (!surface) return;
              gesture.current = {
                kind: "segment",
                action: editor.tool === "curve" ? "curve" : "add",
                segmentId: segment.id,
                pointerId: event.pointerId,
                element: event.currentTarget,
                surface,
                start: [event.clientX, event.clientY],
                moved: false,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              if (editor.tool === "add")
                setPreview(nearby(event.clientX, event.clientY));
              else setHoveredSegmentId(segment.id);
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              const active = gesture.current;
              if (
                active?.kind === "segment" &&
                active.pointerId === event.pointerId
              ) {
                event.preventDefault();
                if (
                  Math.hypot(
                    event.clientX - active.start[0],
                    event.clientY - active.start[1],
                  ) > 6
                )
                  active.moved = true;
              }
              if (
                editor.tool === "add" &&
                (!active || active.kind === "segment")
              )
                setPreview(nearby(event.clientX, event.clientY));
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              event.preventDefault();
              const active = gesture.current;
              if (
                !active ||
                active.kind !== "segment" ||
                active.pointerId !== event.pointerId
              )
                return;
              const point =
                !active.moved && active.action === "add"
                  ? nearby(event.clientX, event.clientY)
                  : null;
              finish();
              if (!active.moved && active.action === "curve")
                convert(active.segmentId);
              else if (point) insert(point);
              else setPreview(null);
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              if (gesture.current?.pointerId === event.pointerId) {
                finish();
                setPreview(null);
              }
            }}
            onLostPointerCapture={() => finish()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              // Other keys reach the window-level tool and undo shortcuts.
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              if (editor.tool === "curve") {
                convert(segment.id);
                return;
              }
              const id = current.current.editor.onInsert(segment.id, 0.5);
              if (id) {
                pendingFocus.current = id;
                setSelectedId(id);
                setFocusedId(id);
                setPreview(null);
              }
            }}
          />
        ))}
      {editor.tool !== "select" &&
        (focusedSegmentId || (editor.tool === "curve" && hoveredSegmentId)) && (
          <path
            className="zone-boundary-insert-focus"
            data-testid="zone-boundary-insert-focus"
            d={
              segments.find(
                (segment) =>
                  segment.id === (focusedSegmentId || hoveredSegmentId),
              )?.shape
            }
            fill="none"
            stroke="#245bff"
            strokeWidth={3}
            strokeDasharray="5 3"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
            aria-hidden="true"
          />
        )}
      {handles
        .filter((handle) => handle.kind === "control" && handle.anchor)
        .map((handle) => (
          <line
            key={`guide-${handle.id}`}
            className="zone-boundary-guide"
            x1={handle.anchor![0]}
            y1={handle.anchor![1]}
            x2={handle.point[0]}
            y2={handle.point[1]}
            stroke="#245bff"
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ))}
      {editor.tool === "add" && preview && (
        <g
          className="zone-boundary-insert-preview"
          data-testid="zone-boundary-insert-preview"
          data-segment-id={preview.segmentId}
          data-t={preview.t}
          data-x={preview.point[0]}
          data-y={preview.point[1]}
          transform={`translate(${preview.point.join(" ")}) scale(${inverseScale})`}
          pointerEvents="none"
          aria-hidden="true"
        >
          <rect
            x={-6}
            y={-6}
            width={12}
            height={12}
            fill="#fff"
            stroke="#245bff"
            strokeWidth={2}
          />
          <path
            d="M-3 0H3M0-3V3"
            style={{ pointerEvents: "none" }}
            fill="none"
            stroke="#245bff"
            strokeWidth={1.5}
          />
        </g>
      )}
      {[...handles]
        .sort(
          (a, b) => Number(a.kind === "anchor") - Number(b.kind === "anchor"),
        )
        .map((handle, index) => (
          <g
            key={handle.id}
            className={`zone-boundary-handle is-${handle.kind}${activeId === handle.id ? " is-dragging" : ""}${selectedId === handle.id ? " is-selected" : ""}`}
            data-testid="zone-boundary-handle"
            data-zone-handle={handle.id}
            data-kind={handle.kind}
            data-x={handle.point[0]}
            data-y={handle.point[1]}
            transform={`translate(${handle.point.join(" ")}) scale(${inverseScale})`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === handle.id}
            aria-label={`${handle.kind === "anchor" ? "경계점" : "곡선 조절점"} ${index + 1}. 방향키로 이동, Shift로 크게 이동`}
            style={{
              cursor: activeId === handle.id ? "move" : "default",
              touchAction: "none",
              outline: "none",
            }}
            onFocus={() => {
              setFocusedId(handle.id);
              setSelectedId(handle.id);
            }}
            onBlur={() => setFocusedId(null)}
            onPointerEnter={() => {
              setPreview(null);
              setHoveredSegmentId(null);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              if (event.button !== 0 || gesture.current) return;
              const surface = freezeMap();
              if (!surface) return;
              const point = position(event.clientX, event.clientY);
              if (!point) {
                surface.dispatchEvent(
                  new CustomEvent("garden-boundary-drag-end"),
                );
                return;
              }
              event.currentTarget.focus({ preventScroll: true });
              current.current.editor.onMoveStart();
              gesture.current = {
                kind: "move",
                id: handle.id,
                pointerId: event.pointerId,
                element: event.currentTarget,
                surface,
                origin: [...handle.point],
                offset: [
                  handle.point[0] - point[0],
                  handle.point[1] - point[1],
                ],
                onEnd: current.current.editor.onMoveEnd,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              setActiveId(handle.id);
              setSelectedId(handle.id);
              setPreview(null);
            }}
            onPointerMove={move}
            onPointerUp={(event) => {
              event.stopPropagation();
              if (gesture.current?.pointerId !== event.pointerId) return;
              move(event);
              finish();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              if (gesture.current?.pointerId === event.pointerId) finish();
            }}
            onLostPointerCapture={() => finish()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              const direction = directions[event.key];
              if (!direction) return;
              event.preventDefault();
              event.stopPropagation();
              const step = event.shiftKey ? 10 : 1;
              current.current.editor.onMoveStart();
              current.current.editor.onMove(handle.id, [
                handle.point[0] + direction[0] * step,
                handle.point[1] + direction[1] * step,
              ]);
              current.current.editor.onMoveEnd();
            }}
          >
            <title>
              {handle.kind === "anchor" ? "경계 위치 조절" : "곡선 모양 조절"} ·
              드래그 또는 방향키 · Shift로 축 고정
            </title>
            <circle
              r={handle.kind === "anchor" ? 13 : 10}
              fill="transparent"
              pointerEvents="all"
            />
            {focusedId === handle.id && (
              <rect
                x={-10}
                y={-10}
                width={20}
                height={20}
                rx={2}
                fill="none"
                stroke="#245bff"
                strokeOpacity={0.3}
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
            {handle.kind === "anchor" ? (
              <rect
                className="zone-boundary-handle-dot"
                x={-5}
                y={-5}
                width={10}
                height={10}
                fill={selectedId === handle.id ? "#245bff" : "#fff"}
                stroke="#245bff"
                strokeWidth={2}
                pointerEvents="none"
              />
            ) : (
              <circle
                className="zone-boundary-handle-dot"
                r={4}
                fill={selectedId === handle.id ? "#a176d0" : "#f7f0ff"}
                stroke="#a176d0"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
          </g>
        ))}
    </g>
  );
}
