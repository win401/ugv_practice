import { useLayoutEffect, useRef, useState } from "react";
import type { GardenMapVehicle } from "../types/gardenMap";
import "../styles/garden-vehicle.css";

const statusNames: Record<GardenMapVehicle["status"], string> = {
  idle: "대기 중",
  moving: "이동 중",
  watering: "관수 중",
  paused: "일시정지",
  stopped: "정지됨",
  done: "작업 완료",
  unknown: "상태 미확인",
  estop: "안전정지",
  lost: "통신 끊김",
  fault: "장비 이상",
};

/** Position and state come from the workspace; this marker never advances a run. */
export default function GardenVehicleMarker({
  vehicle,
  inverseScale,
}: {
  vehicle: GardenMapVehicle;
  inverseScale: number;
}) {
  const watering = vehicle.status === "watering";
  const unknown =
    vehicle.status === "unknown" ||
    vehicle.status === "lost" ||
    vehicle.status === "fault";
  const color = watering ? "#245bff" : unknown ? "#71717a" : "#ff6b35";
  const bubbleColor = "#18181b";
  const statusDot = watering
    ? "#4d8dff"
    : vehicle.status === "moving"
      ? "#ff6b35"
      : null;
  const immediateStatus = !vehicle.moving && !watering;
  const sideName =
    vehicle.wateringSide === "left"
      ? "왼쪽"
      : vehicle.wateringSide === "right"
        ? "오른쪽"
        : null;
  const statusLabel = `${statusNames[vehicle.status]}${watering && sideName ? ` · ${sideName}` : ""}`;
  const [labelWidth, setLabelWidth] = useState(() =>
    Math.max(
      98,
      vehicle.label.length * 8 + 24,
      statusLabel.length * 10 + 24 + (statusDot ? 18 : 0),
    ),
  );
  const nameRef = useRef<SVGTextElement>(null);
  const statusRef = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active) return;
      const nameWidth = nameRef.current?.getComputedTextLength() ?? 0;
      const statusWidth = statusRef.current?.getComputedTextLength() ?? 0;
      if (nameWidth || statusWidth)
        setLabelWidth(
          Math.max(98, Math.ceil(Math.max(nameWidth, statusWidth) + 24)),
        );
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
    };
  }, [vehicle.label, statusLabel, statusDot]);

  return (
    <g
      transform={`translate(${vehicle.point.join(" ")}) scale(${inverseScale})`}
      className={`map-robot detail-map-robot garden-vehicle-marker${vehicle.moving ? " running" : ""}`}
      data-x={vehicle.point[0]}
      data-y={vehicle.point[1]}
      data-vehicle-source={vehicle.source}
      data-heading={vehicle.heading}
      data-state={vehicle.status}
      data-watering-side={vehicle.wateringSide ?? "none"}
      role="img"
      aria-label={`${vehicle.label}, ${statusLabel}`}
      pointerEvents="none"
    >
      <title>{`${vehicle.label} · ${statusLabel}`}</title>
      <circle
        className={vehicle.moving ? "robot-pulse" : undefined}
        r={25}
        fill={color}
        opacity={0.18}
      />
      {/* Forward is local -Y; the spray rotates with the chassis, not the screen. */}
      <g
        className="garden-vehicle-heading"
        transform={`rotate(${vehicle.heading})`}
      >
        {watering && vehicle.wateringSide && (
          <g
            className="garden-water-spray"
            data-spray-side={vehicle.wateringSide}
            transform={
              vehicle.wateringSide === "left" ? "scale(-1 1)" : undefined
            }
          >
            <path
              className="garden-water-fan"
              d="M13-4 57-27Q75 0 57 27L13 4Z"
              fill="#245bff"
              fillOpacity={0.24}
              stroke="#b8d7ff"
              strokeWidth={1}
              strokeOpacity={0.7}
            />
            <g
              className="garden-water-stream"
              fill="none"
              stroke="#77c8ff"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M17-3Q35-8 53-21M19 0H62M17 3Q35 8 53 21" />
            </g>
            <g className="garden-water-droplets" fill="#d6f1ff">
              <circle cx={35} cy={-12} r={2.1} />
              <circle cx={48} cy={-20} r={2.5} />
              <circle cx={41} cy={0} r={2.6} />
              <circle cx={57} cy={0} r={2} />
              <circle cx={35} cy={12} r={2.1} />
              <circle cx={48} cy={20} r={2.5} />
            </g>
          </g>
        )}
        <circle
          className="garden-vehicle-body"
          r={17}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
        />
        <path d="M0-28 5-21H-5Z" fill={color} stroke="#fff" strokeWidth={1.5} />
        <rect x={-11} y={-8} width={5} height={17} rx={2} fill="#fff" />
        <rect x={6} y={-8} width={5} height={17} rx={2} fill="#fff" />
        <rect
          x={-7}
          y={-10}
          width={14}
          height={21}
          rx={4}
          fill="#fff"
          stroke={color}
          strokeWidth={1.5}
        />
        <path d="M-3-4H3" stroke={color} strokeWidth={2} />
      </g>
      <g
        className="garden-vehicle-bubble"
        style={{ transform: `translateY(${watering ? -36 : 0}px)` }}
      >
        <rect
          className="garden-vehicle-bubble-shell"
          x={-labelWidth / 2}
          y={-83}
          width={labelWidth}
          height={43}
          rx={12}
          fill={bubbleColor}
          style={{ x: `${-labelWidth / 2}px`, width: `${labelWidth}px` }}
        />
        <path d="M-5-41 0-35 5-41Z" fill={bubbleColor} />
        <g
          key={`${vehicle.label}:${vehicle.status}:${sideName ?? "none"}`}
          className={`garden-vehicle-bubble-content${immediateStatus ? " is-immediate" : ""}`}
        >
          <text
            ref={nameRef}
            className="garden-vehicle-name"
            textAnchor="middle"
            y={-67}
            fill="#fff"
            fillOpacity={0.78}
            fontSize={9}
            fontWeight={550}
          >
            {vehicle.label}
          </text>
          <text
            ref={statusRef}
            className="garden-vehicle-status"
            textAnchor="middle"
            y={-50}
            fill="#fff"
            fontSize={11}
            fontWeight={700}
          >
            {statusDot && (
              <tspan
                className={`garden-vehicle-status-dot${watering ? " garden-vehicle-watering-dot" : ""}`}
                fill={statusDot}
                fontSize={10}
                aria-hidden="true"
              >
                ●
              </tspan>
            )}
            <tspan dx={statusDot ? 6 : undefined}>{statusLabel}</tspan>
          </text>
        </g>
      </g>
    </g>
  );
}
