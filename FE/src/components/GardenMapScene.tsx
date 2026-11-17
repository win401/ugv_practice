import type { Point } from "../api/gardenDetail";
import type { GardenMapSceneProps } from "../types/gardenMap";
import GardenVehicleMarker from "./GardenVehicleMarker";
import ZoneBoundaryEditor from "./ZoneBoundaryEditor";
import ZoneBoundaryDrawing from "./ZoneBoundaryDrawing";

const pointsOf = (points: Point[]) =>
  points.map((point) => point.join(",")).join(" ");

/** The enclosing map supplies scene coordinates, projection and gestures. */
export default function GardenMapScene({
  data,
  selectedIds,
  onToggle,
  route,
  stops,
  vehicle,
  scale,
  selectable = true,
  compact = true,
  showImage = true,
  zoneEditor,
  zoneDrawing,
}: GardenMapSceneProps) {
  selectable = selectable && !showImage;
  const inverseScale = 1 / Math.max(0.0001, scale);

  return (
    <g
      className="garden-map-scene"
      data-image-revision={data.imageRevision}
      data-vehicle-source={vehicle.source}
    >
      {showImage && (
        <image
          className="garden-scene-image detail-map-surface"
          href={data.imageUrl}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      )}
      {data.zones.map((zone) => {
        const selected = selectedIds.includes(zone.id);
        const shortName = zone.name
          .replace(/^원형정원\s+/, "")
          .replace("정원 남측 화단", " 화단");
        const label = compact ? zone.letter : `${zone.letter} · ${shortName}`;
        const labelWidth = compact ? 26 : 42 + shortName.length * 11;
        return (
          <g
            key={zone.id}
            className={`map-zone detail-map-zone${selected ? " selected" : ""}`}
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={`${zone.name} 관수 구역 ${selected ? "선택 해제" : "선택"}`}
            aria-pressed={selectable ? selected : undefined}
            data-zone-id={zone.id}
            pointerEvents={selectable ? undefined : "none"}
            onClick={(event) => {
              // Pointer taps are delegated by the outer canvas, so drag never selects.
              if (selectable && event.detail === 0) onToggle(zone.id);
            }}
            onKeyDown={(event) => {
              if (selectable && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onToggle(zone.id);
              }
            }}
          >
            <title>{`${zone.letter} · ${zone.name}${!showImage && zone.coordinateAccuracy === "illustrative" ? " · 예시 경계" : ""}`}</title>
            {!showImage && (
              <path
                d={
                  zoneEditor?.zoneId === zone.id ? zoneEditor.shape : zone.shape
                }
                fill={selected ? "#245bff" : "#ffffff"}
                fillOpacity={selected ? 0.23 : 0.06}
                stroke={selected ? "#245bff" : "#ffffff"}
                strokeWidth={selected ? 3 : 2}
                strokeDasharray={selected ? undefined : "6 5"}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <g
              transform={`translate(${zone.label.join(" ")}) scale(${inverseScale})`}
              className="detail-zone-label"
            >
              <rect
                x={-labelWidth / 2}
                y={-13}
                width={labelWidth}
                height={26}
                rx={13}
                fill={selected ? "#245bff" : "#fffffff2"}
              />
              <text
                textAnchor="middle"
                y={4}
                fill={selected ? "#fff" : "#18181b"}
                fontSize={11}
                fontWeight={650}
              >
                {label}
              </text>
            </g>
          </g>
        );
      })}
      <g pointerEvents="none" className="detail-route">
        {route.length > 1 && (
          <>
            <polyline
              points={pointsOf(route)}
              fill="none"
              stroke="#fff"
              strokeWidth={7}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.92}
            />
            <polyline
              points={pointsOf(route)}
              fill="none"
              stroke="#245bff"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="8 6"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {vehicle.trail.length > 1 && (
          <polyline
            className="garden-vehicle-trail"
            points={pointsOf(vehicle.trail)}
            fill="none"
            stroke="#ff6b35"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {stops.map((stop) => (
          <g
            key={stop.id}
            className="garden-map-stop"
            data-stop-id={stop.id}
            data-x={stop.point[0]}
            data-y={stop.point[1]}
            transform={`translate(${stop.point.join(" ")}) scale(${inverseScale})`}
          >
            {stop.selected && (
              <circle r={17} fill="none" stroke="#fff" strokeWidth={3} />
            )}
            <circle r={11} fill="#245bff" stroke="#fff" strokeWidth={2} />
            <text
              textAnchor="middle"
              y={4}
              fill="#fff"
              fontSize={11}
              fontWeight={700}
            >
              {stop.label}
            </text>
          </g>
        ))}
      </g>
      <GardenVehicleMarker vehicle={vehicle} inverseScale={inverseScale} />
      {!showImage && zoneDrawing && (
        <ZoneBoundaryDrawing drawing={zoneDrawing} scale={scale} />
      )}
      {!showImage && zoneEditor && (
        <ZoneBoundaryEditor editor={zoneEditor} scale={scale} />
      )}
    </g>
  );
}
