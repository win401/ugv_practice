import type { Point } from "../api/gardenDetail";
import type { ZonePathCommand } from "../lib/zoneGeometry";
import type { ZoneGeoJSONGeometry } from "../lib/zoneGeoJson";

export type GardenZoneOrigin = "seed" | "custom";
export interface GardenZoneFeature {
  type: "Feature";
  id: string;
  geometry: ZoneGeoJSONGeometry;
  properties: {
    zoneId: string;
    mapId: string;
    name: string;
    displayCode: string;
    origin: GardenZoneOrigin;
    coordinateAccuracy: "illustrative" | "map-edited";
    navigationReady: false;
  };
}
export interface GardenZoneFeatureCollection {
  type: "FeatureCollection";
  features: GardenZoneFeature[];
}

/** Serializable API/DB transfer object. It contains no browser or React state. */
export interface GardenZoneRecord {
  schemaVersion: 3;
  id: string;
  mapId: string;
  name: string;
  displayCode: string;
  origin: GardenZoneOrigin;
  description: string;
  label: Point;
  /** Geographic anchors and curve controls in WGS84 [longitude, latitude]. */
  boundary: ZonePathCommand[];
  /** Derived from the geographic boundary for interchange. */
  geojson: GardenZoneFeature;
  routing: {
    status: "configured" | "unassigned";
    stopNodeId: string | null;
  };
  /** Seed/v1 timestamps are unknown, so null is kept instead of invented dates. */
  createdAt: string | null;
  updatedAt: string | null;
}
