import { useEffect, useRef, useState } from "react";
import type { GardenZoneDrawing } from "../types/gardenMap";

/** Draft points use the overview map projection. */
export default function ZoneBoundaryDrawing({
  drawing,
  scale,
}: {
  drawing: GardenZoneDrawing;
  scale: number;
}) {
  const current = useRef(drawing);
  current.current = drawing;
  const [focused, setFocused] = useState(false);
  const gesture = useRef<{
    pointerId: number;
    element: SVGGElement;
    surface: SVGSVGElement;
    start: [number, number];
    moved: boolean;
  } | null>(null);
  const points = drawing.points.map((point) => point.join(",")).join(" ");
  const canClose = drawing.points.length >= 3;
  const inverseScale = 1 / Math.max(0.00001, scale);
  function finish() {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    if (active.element.hasPointerCapture(active.pointerId))
      active.element.releasePointerCapture(active.pointerId);
    active.surface.dispatchEvent(new CustomEvent("garden-boundary-drag-end"));
  }
  useEffect(() => {
    const blur = () => finish();
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur);
      finish();
    };
  }, []);

  return (
    <g
      className="zone-boundary-drawing"
      data-testid="zone-boundary-drawing"
      data-point-count={drawing.points.length}
      role="group"
      aria-label={`새 관수 구역 경계. ${drawing.points.length}개 점을 놓았습니다.`}
      pointerEvents="none"
    >
      {canClose && (
        <polygon
          points={points}
          fill="#245bff"
          fillOpacity={0.12}
          stroke="none"
          pointerEvents="none"
        />
      )}
      {drawing.points.length > 1 && (
        <>
          <polyline
            points={points}
            fill="none"
            stroke="#fff"
            strokeWidth={5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#245bff"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </>
      )}
      {canClose && (
        <line
          x1={drawing.points.at(-1)![0]}
          y1={drawing.points.at(-1)![1]}
          x2={drawing.points[0][0]}
          y2={drawing.points[0][1]}
          stroke="#245bff"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      {drawing.points.map((point, index) => {
        const closingPoint = index === 0 && canClose;
        return (
          <g
            key={index}
            className={`zone-drawing-point${closingPoint ? " is-close-point" : ""}`}
            data-testid="zone-drawing-point"
            data-x={point[0]}
            data-y={point[1]}
            data-zone-drawing-handle={closingPoint ? "close" : undefined}
            transform={`translate(${point.join(" ")}) scale(${inverseScale})`}
            role={closingPoint ? "button" : undefined}
            tabIndex={closingPoint ? 0 : undefined}
            aria-label={closingPoint ? "첫 점으로 경계 닫기" : undefined}
            pointerEvents={closingPoint ? "all" : "none"}
            style={{
              cursor: closingPoint ? "default" : undefined,
              touchAction: "none",
              outline: "none",
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPointerDown={(event) => {
              if (!closingPoint) return;
              event.preventDefault();
              event.stopPropagation();
              if (event.button !== 0 || gesture.current) return;
              const surface = event.currentTarget.ownerSVGElement;
              if (!surface) return;
              surface.dispatchEvent(
                new CustomEvent("garden-boundary-drag-start"),
              );
              gesture.current = {
                pointerId: event.pointerId,
                element: event.currentTarget,
                surface,
                start: [event.clientX, event.clientY],
                moved: false,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.focus({ preventScroll: true });
            }}
            onPointerMove={(event) => {
              const active = gesture.current;
              if (!active || active.pointerId !== event.pointerId) return;
              event.preventDefault();
              event.stopPropagation();
              if (
                Math.hypot(
                  event.clientX - active.start[0],
                  event.clientY - active.start[1],
                ) > 6
              )
                active.moved = true;
            }}
            onPointerUp={(event) => {
              const active = gesture.current;
              if (!active || active.pointerId !== event.pointerId) return;
              event.preventDefault();
              event.stopPropagation();
              const close = !active.moved && current.current.points.length >= 3;
              finish();
              if (close) current.current.onClose();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              if (gesture.current?.pointerId === event.pointerId) finish();
            }}
            onLostPointerCapture={finish}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (!closingPoint || (event.key !== "Enter" && event.key !== " "))
                return;
              event.preventDefault();
              event.stopPropagation();
              current.current.onClose();
            }}
          >
            {closingPoint && <title>첫 점을 눌러 경계 닫기</title>}
            {closingPoint && (
              <circle r={15} fill="transparent" pointerEvents="all" />
            )}
            {closingPoint && (
              <circle
                r={10}
                fill="#fff"
                fillOpacity={0.9}
                stroke="#245bff"
                strokeWidth={focused ? 3 : 1.5}
                pointerEvents="none"
              />
            )}
            <rect
              x={-4}
              y={-4}
              width={8}
              height={8}
              fill={index === 0 ? "#245bff" : "#fff"}
              stroke={index === 0 ? "#fff" : "#245bff"}
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
