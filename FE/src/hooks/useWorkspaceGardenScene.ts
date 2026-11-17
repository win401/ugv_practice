import type { Point } from "../api/gardenDetail";
import type { Tab } from "../types/dashboard";
import type { GardenMapSceneProps, GardenMapVehicle } from "../types/gardenMap";
import type { MissionDraft } from "../types/missionDraft";
import type { IrrigationSimulation } from "./useIrrigationSimulation";
import { useGardenDetail } from "./useGardenDetail";
import { useReportedMapProgress } from "./useReportedMapProgress";
import { gardenImageToLatLng } from "../lib/gardenGeoFrame";
import { projectGardenZone } from "../lib/gardenZoneProjection";
import { pointAt, headingAt } from "../lib/gardenRoute";

function projectSimulatedPoint(point: Point): Point {
  const [lat, lng] = gardenImageToLatLng(point);
  return projectGardenZone([lng, lat]);
}

/** Shared selection and reports; each map supplies its own geometry. */
export function useWorkspaceGardenScene(
  simulation: IrrigationSimulation,
  tab: Tab,
  draft: MissionDraft | null,
  scopeId: string,
  editingEnabled: boolean,
) {
  const detail = useGardenDetail(scopeId, !!simulation.activeRun);
  const { data, plan, illustrationData } = detail;
  const run = simulation.run;
  const confirmed =
    !!simulation.activeRun &&
    !!run &&
    !run.halt &&
    simulation.freshness === "current" &&
    run.points[run.current]?.status !== "unknown";
  const canMove = confirmed && (run.stage === "move" || run.stage === "stop");
  const displayedProgress = useReportedMapProgress(
    run?.id,
    simulation.mapProgress,
    canMove,
  );

  if (!illustrationData) return { detail, overview: null, illustration: null };

  let vehicle: GardenMapVehicle;
  if (run) {
    const route = run.route.map(([x, y]): Point => [x, y]);
    const point: Point =
      route.length > 1
        ? (pointAt(displayedProgress, route) as Point)
        : (route[0] ?? illustrationData.dock);
    const segment = Math.floor(
      (displayedProgress / 100) * Math.max(0, route.length - 1),
    );
    const watering =
      confirmed &&
      run.pump.confirmed === "on" &&
      (run.stage === "water" || run.stage === "next");
    const movement = run.movement;
    const moving =
      canMove &&
      (displayedProgress !== simulation.mapProgress ||
        (run.stage === "move" &&
          !!movement &&
          (movement.from[0] !== movement.to[0] ||
            movement.from[1] !== movement.to[1])));
    const status: GardenMapVehicle["status"] =
      run.halt === "estop"
        ? "estop"
        : run.halt === "lost" ||
            (simulation.activeRun && simulation.freshness === "lost")
          ? "lost"
          : run.halt === "fault"
            ? "fault"
            : run.endedAt
              ? run.endReason === "complete"
                ? "done"
                : "stopped"
              : run.halt === "paused"
                ? "paused"
                : !confirmed
                  ? "unknown"
                  : watering
                    ? "watering"
                    : moving
                      ? "moving"
                      : "idle";
    vehicle = {
      point,
      heading:
        route.length > 1
          ? headingAt(Math.max(0, displayedProgress - 0.000001), route)
          : 0,
      trail: [...route.slice(0, segment + 1), point],
      moving,
      label: run.deviceId,
      source: "mission",
      status,
      // Until device telemetry is available, alternating nozzle sides are mock data.
      wateringSide: watering
        ? run.current % 2 === 0
          ? "left"
          : "right"
        : null,
    };
  } else {
    vehicle = {
      point: illustrationData.dock,
      heading: 0,
      trail: [],
      moving: false,
      label: simulation.device?.id ?? "UGV · 시연",
      source: "idle",
      status:
        simulation.device && simulation.freshness !== "current"
          ? simulation.freshness === "lost"
            ? "lost"
            : "unknown"
          : "idle",
      wateringSide: null,
    };
  }

  const editing = editingEnabled && tab === "mission" && !!draft;
  const plannedRoute: Point[] =
    run && (simulation.activeRun || !plan)
      ? run.route.map(([x, y]) => [x, y])
      : (plan?.points ?? []);
  const route: Point[] = editing
    ? draft.points.map(({ x, y }) => [x, y])
    : plannedRoute;
  const stops = editing
    ? draft.points.map((p, i) => ({
        id: p.id,
        point: [p.x, p.y] as Point,
        label: String(i + 1),
        selected: p.id === draft.selectedId,
      }))
    : run && (simulation.activeRun || !plan)
      ? run.route.map(([x, y], i) => ({
          id: `run-${i}`,
          point: [x, y] as Point,
          label: String(i + 1),
        }))
      : (plan?.stops.map((p, i) => ({
          id: p.zoneId,
          point: p.point,
          label: String(i + 1),
        })) ?? []);
  const overview: Omit<GardenMapSceneProps, "scale" | "compact"> = {
    data: data ?? { ...illustrationData, zones: [] },
    selectedIds: detail.selectedIds,
    onToggle: detail.toggle,
    route: route.map(projectSimulatedPoint),
    stops: stops.map((stop) => ({
      ...stop,
      point: projectSimulatedPoint(stop.point),
    })),
    vehicle: {
      ...vehicle,
      point: projectSimulatedPoint(vehicle.point),
      trail: vehicle.trail.map(projectSimulatedPoint),
    },
    selectable: editingEnabled && !editing && !detail.editor.draft,
    zoneDrawing:
      editingEnabled && detail.editor.drawing && !simulation.activeRun
        ? {
            points: detail.editor.drawingPoints,
            onClose: detail.editor.finishDrawing,
          }
        : undefined,
    zoneEditor:
      editingEnabled &&
      detail.editor.draft &&
      !detail.editor.drawing &&
      !simulation.activeRun
        ? {
            zoneId: detail.editor.draft.id,
            shape: detail.editor.draft.shape,
            tool: detail.editor.tool,
            onMove: detail.editor.moveHandle,
            onMoveStart: detail.editor.startMove,
            onMoveEnd: detail.editor.endMove,
            onInsert: detail.editor.insertPoint,
            onConvert: detail.editor.convertSegment,
          }
        : undefined,
  };
  const insideIllustration = ([x, y]: Point): Point => [
    Math.max(12, Math.min(illustrationData.width - 12, x)),
    Math.max(12, Math.min(illustrationData.height - 12, y)),
  ];
  const illustration: typeof overview = {
    data: {
      ...illustrationData,
      zones: illustrationData.zones.map((zone) => ({
        ...zone,
        name: data?.zones.find(({ id }) => id === zone.id)?.name ?? zone.name,
      })),
    },
    selectedIds: detail.selectedIds,
    onToggle: () => {},
    selectable: false,
    route: plannedRoute.map(insideIllustration),
    stops: [],
    vehicle: {
      ...vehicle,
      point: insideIllustration(vehicle.point),
      trail: vehicle.trail.map(insideIllustration),
    },
  };
  return { detail, overview, illustration };
}
