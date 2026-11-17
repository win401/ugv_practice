import type { DetailMapData, Point } from "../api/gardenDetail";

/** The same reported pose, projected into each map’s scene. */
export interface GardenMapVehicle {
  point: Point;
  heading: number;
  trail: Point[];
  moving: boolean;
  label: string;
  source: "mission" | "idle";
  status:
    | "idle"
    | "moving"
    | "watering"
    | "paused"
    | "stopped"
    | "done"
    | "unknown"
    | "estop"
    | "lost"
    | "fault";
  /** Relative to the chassis heading; never relative to the screen. */
  wateringSide: "left" | "right" | null;
}

export interface GardenMapStop {
  id: string;
  point: Point;
  label: string;
  selected?: boolean;
}

export interface GardenZoneEditor {
  zoneId: string;
  shape: string;
  tool: "select" | "add" | "curve";
  onMoveStart: () => void;
  onMoveEnd: () => void;
  onInsert: (segmentId: string, t: number) => string | null;
  onConvert: (segmentId: string) => void;
  onMove: (handleId: string, point: Point) => void;
}

export interface GardenZoneDrawing {
  points: Point[];
  onClose: () => void;
}

/** The parent owns selection, route planning, simulation and all camera state. */
export interface GardenMapSceneProps {
  data: DetailMapData;
  selectedIds: string[];
  onToggle: (id: string) => void;
  route: Point[];
  stops: GardenMapStop[];
  vehicle: GardenMapVehicle;
  /** Effective screen pixels per unit in the scene. */
  scale: number;
  selectable?: boolean;
  compact?: boolean;
  /** The geographic map keeps its satellite basemap visible. */
  showImage?: boolean;
  zoneEditor?: GardenZoneEditor;
  zoneDrawing?: GardenZoneDrawing;
}
