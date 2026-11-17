import type { DetailMapData, DetailZone, Point } from "./gardenDetail";
import type {
  GardenZoneFeatureCollection,
  GardenZoneRecord,
} from "../types/gardenZone";
import {
  labelForZoneShape,
  parseZonePath,
  serializeZonePath,
  validateZoneShape,
  type ZonePathCommand,
} from "../lib/zoneGeometry";
import {
  isGardenZonePosition,
  projectGardenZone,
  unprojectGardenZone,
} from "../lib/gardenZoneProjection";
import { zoneShapeToGeoJSON } from "../lib/zoneGeoJson";
import { gardenImageToLatLng } from "../lib/gardenGeoFrame";

export type GardenZoneEditsSnapshot = {
  zones: DetailZone[];
  revision: string;
  records: GardenZoneRecord[];
};
export type GardenZoneEditInput = { id: string; name: string; shape: string };
export type CreateGardenZoneInput = { name: string; shape: string };
type Envelope = {
  version: 3;
  scopeId: string;
  mapId: string;
  revision: string;
  /** Only edited seeds and user-created zones are persisted. */
  records: GardenZoneRecord[];
};
const DEFAULT_MAP_ID = "suncheon-garden-detail";
const MAX_CUSTOM_ZONES = 100;
const MAX_STORAGE_CHARACTERS = 6_000_000;
const CUSTOM_DESCRIPTION = "직접 추가한 관수 구역 · 관수 지점 연결 전";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function identifier(value: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new Error("구역을 저장할 사용자와 지도 정보를 확인해 주세요.");
  return value.trim();
}
export function gardenZoneEditsStorageKey(
  scopeId: string,
  mapId = DEFAULT_MAP_ID,
): string {
  return `saemgil-garden-zone-edits-v3:${[scopeId, mapId].map((value) => encodeURIComponent(identifier(value))).join(":")}`;
}
export function legacyGardenZoneEditsStorageKey(
  scopeId: string,
  imageRevision: string,
): string {
  return `saemgil-garden-zone-edits-v1:${[scopeId, imageRevision].map((value) => encodeURIComponent(identifier(value))).join(":")}`;
}
export function imageGardenZoneEditsStorageKey(
  scopeId: string,
  imageRevision: string,
  mapId: string,
): string {
  return `saemgil-garden-zone-edits-v2:${[scopeId, mapId, imageRevision].map((value) => encodeURIComponent(identifier(value))).join(":")}`;
}
function nameOf(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 50 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error("구역 이름은 공백을 제외하고 1~50자로 입력해 주세요.");
  return value.trim();
}
function pointOf(value: unknown, data: DetailMapData): Point {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((n) => typeof n === "number" && Number.isFinite(n)) ||
    value[0] < 0 ||
    value[1] < 0 ||
    value[0] > data.width ||
    value[1] > data.height
  )
    throw new Error("구역 이름표 위치가 올바르지 않습니다.");
  return [value[0], value[1]];
}
function timestampOf(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error("구역 저장 시간이 올바르지 않습니다.");
  return value;
}
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
function fromLegacyPoint(point: Point): Point {
  const [lat, lng] = gardenImageToLatLng(point);
  return [lng, lat];
}
function geographicShape(boundary: ZonePathCommand[]) {
  return serializeZonePath(
    boundary.map(({ kind, points }) => ({
      kind,
      points: points.map(projectGardenZone),
    })),
  );
}
function legacyZone(data: DetailMapData, zone: DetailZone): DetailZone {
  if (data.mapId !== DEFAULT_MAP_ID)
    throw new Error("이 지도에는 이전 경계의 좌표 변환이 등록되지 않았습니다.");
  return {
    ...zone,
    shape: geographicShape(
      parseZonePath(zone.shape).map(({ kind, points }) => ({
        kind,
        points: points.map(fromLegacyPoint),
      })),
    ),
    label: projectGardenZone(fromLegacyPoint(zone.label)),
  };
}
function toRecord(
  data: DetailMapData,
  zone: DetailZone,
  createdAt: string | null = null,
  updatedAt: string | null = null,
  accuracy: "illustrative" | "map-edited" = "illustrative",
  boundary: ZonePathCommand[] = parseZonePath(zone.shape).map(
    ({ kind, points }) => ({
      kind,
      points: points.map(unprojectGardenZone),
    }),
  ),
  label: Point = unprojectGardenZone(zone.label),
): GardenZoneRecord {
  const origin = zone.origin === "custom" ? "custom" : "seed";
  const name = nameOf(zone.name);
  if (
    !boundary.every(({ points }) => points.every(isGardenZonePosition)) ||
    !isGardenZonePosition(label)
  )
    throw new Error("지도에서 유효한 위도·경도 위치를 선택해 주세요.");
  const shape = geographicShape(boundary);
  validateZoneShape(shape);
  return {
    schemaVersion: 3,
    id: zone.id,
    mapId: data.mapId,
    name,
    displayCode: zone.letter,
    origin,
    description: zone.description,
    label,
    boundary,
    geojson: {
      type: "Feature",
      id: zone.id,
      geometry: zoneShapeToGeoJSON(shape, unprojectGardenZone),
      properties: {
        zoneId: zone.id,
        mapId: data.mapId,
        name,
        displayCode: zone.letter,
        origin,
        coordinateAccuracy: accuracy,
        navigationReady: false,
      },
    },
    routing: {
      status: zone.stopNode ? "configured" : "unassigned",
      stopNodeId: zone.stopNode,
    },
    createdAt,
    updatedAt,
  };
}
function toView(item: GardenZoneRecord, seed?: DetailZone): DetailZone {
  return {
    ...(seed ?? { origin: "custom" as const }),
    id: item.id,
    name: item.name,
    letter: item.displayCode,
    description: item.description,
    shape: geographicShape(item.boundary),
    label: projectGardenZone(item.label),
    coordinateAccuracy: item.geojson.properties.coordinateAccuracy,
    stopNode: item.routing.stopNodeId,
  };
}
function parseSavedRecord(
  value: unknown,
  data: DetailMapData,
  legacy: boolean,
): GardenZoneRecord {
  if (
    !isRecord(value) ||
    value.schemaVersion !== (legacy ? 2 : 3) ||
    typeof value.id !== "string" ||
    value.mapId !== data.mapId ||
    !isRecord(value.routing)
  )
    throw new Error();
  const seed = data.zones.find((zone) => zone.id === value.id);
  if (
    (seed
      ? value.origin !== "seed"
      : value.origin !== "custom" ||
        !/^zone-[A-Za-z0-9-]{8,100}$/.test(value.id)) ||
    typeof value.displayCode !== "string" ||
    !/^[A-Z]{1,4}$/.test(value.displayCode) ||
    (seed && value.displayCode !== seed.letter)
  )
    throw new Error();
  const stopNode = seed?.stopNode ?? null;
  const description = seed?.description ?? CUSTOM_DESCRIPTION;
  if (
    value.routing.stopNodeId !== stopNode ||
    value.routing.status !== (stopNode ? "configured" : "unassigned") ||
    value.description !== description
  )
    throw new Error();
  const createdAt = timestampOf(value.createdAt);
  const updatedAt = timestampOf(value.updatedAt);
  if (!seed && (!createdAt || !updatedAt)) throw new Error();
  if (createdAt && updatedAt && createdAt > updatedAt) throw new Error();
  const zone = {
    id: value.id,
    name: nameOf(value.name),
    letter: value.displayCode,
    description,
    stopNode,
    origin: seed ? ("seed" as const) : ("custom" as const),
  };
  if (legacy) {
    const editor = value.editorGeometry;
    if (
      !isRecord(editor) ||
      editor.type !== "svg-path" ||
      editor.coordinateSpace !== "image-pixels" ||
      editor.imageRevision !== data.imageRevision ||
      editor.width !== data.width ||
      editor.height !== data.height ||
      typeof editor.path !== "string"
    )
      throw new Error();
    validateZoneShape(editor.path, data.width, data.height);
    return toRecord(
      data,
      legacyZone(data, {
        ...zone,
        shape: editor.path,
        label: pointOf(value.label, data),
      }),
      createdAt,
      updatedAt,
    );
  }
  const feature = value.geojson;
  const label = value.label;
  const boundary = value.boundary;
  if (
    !isRecord(feature) ||
    !isRecord(feature.properties) ||
    !isGardenZonePosition(label) ||
    !Array.isArray(boundary) ||
    boundary.length > 256 ||
    !boundary.every(
      (command) =>
        isRecord(command) &&
        typeof command.kind === "string" &&
        ["M", "L", "C", "Q", "Z"].includes(command.kind) &&
        Array.isArray(command.points) &&
        command.points.length ===
          ({ M: 1, L: 1, C: 3, Q: 2, Z: 0 }[command.kind] ?? -1) &&
        command.points.every(isGardenZonePosition),
    )
  )
    throw new Error();
  const accuracy = feature.properties.coordinateAccuracy;
  if (accuracy !== "illustrative" && accuracy !== "map-edited")
    throw new Error();
  const commands: ZonePathCommand[] = boundary;
  const expected = toRecord(
    data,
    {
      ...zone,
      shape: geographicShape(commands),
      label: projectGardenZone(label),
    },
    createdAt,
    updatedAt,
    accuracy,
    commands,
    label,
  );
  if (
    feature.type !== "Feature" ||
    feature.id !== zone.id ||
    !isRecord(feature.geometry) ||
    feature.geometry.type !== expected.geojson.geometry.type ||
    JSON.stringify(feature.geometry.coordinates) !==
      JSON.stringify(expected.geojson.geometry.coordinates) ||
    Object.entries(expected.geojson.properties).some(
      ([key, val]) =>
        (feature.properties as Record<string, unknown>)[key] !== val,
    )
  )
    throw new Error();
  return expected;
}
function emptyEnvelope(scopeId: string, data: DetailMapData): Envelope {
  return {
    version: 3,
    scopeId: identifier(scopeId),
    mapId: data.mapId,
    revision: "",
    records: [],
  };
}
function revisionOf(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 100)
    throw new Error();
  return value;
}
function parseEnvelope(
  raw: string,
  scopeId: string,
  data: DetailMapData,
  version: 2 | 3,
): Envelope {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    value.version !== version ||
    value.scopeId !== identifier(scopeId) ||
    value.mapId !== data.mapId ||
    (version === 2 && value.imageRevision !== data.imageRevision) ||
    !Array.isArray(value.records) ||
    value.records.length > data.zones.length + MAX_CUSTOM_ZONES
  )
    throw new Error();
  const records = value.records.map((item) =>
    parseSavedRecord(item, data, version === 2),
  );
  const ids = new Set<string>(),
    codes = new Set(data.zones.map((zone) => zone.letter));
  for (const item of records) {
    if (
      ids.has(item.id) ||
      (item.origin === "custom" && codes.has(item.displayCode))
    )
      throw new Error();
    ids.add(item.id);
    codes.add(item.displayCode);
  }
  if (
    records.filter((item) => item.origin === "custom").length > MAX_CUSTOM_ZONES
  )
    throw new Error();
  return {
    ...emptyEnvelope(scopeId, data),
    revision: revisionOf(value.revision),
    records,
  };
}
function parseV1(raw: string, scopeId: string, data: DetailMapData): Envelope {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.imageRevision !== data.imageRevision ||
    !Array.isArray(value.zones) ||
    value.zones.length > data.zones.length
  )
    throw new Error();
  const ids = new Set<string>();
  const records = value.zones.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      typeof item.shape !== "string"
    )
      throw new Error();
    const seed = data.zones.find((zone) => zone.id === item.id);
    if (!seed) throw new Error();
    ids.add(item.id);
    validateZoneShape(item.shape, data.width, data.height);
    return toRecord(
      data,
      legacyZone(data, {
        ...seed,
        name: nameOf(item.name),
        shape: item.shape,
        label: pointOf(item.label, data),
      }),
    );
  });
  return {
    ...emptyEnvelope(scopeId, data),
    revision: revisionOf(value.revision),
    records,
  };
}
function read(scopeId: string, data: DetailMapData): Envelope {
  const key = gardenZoneEditsStorageKey(scopeId, data.mapId);
  let raw: string | null;
  let version = 3;
  try {
    raw = globalThis.localStorage.getItem(key);
    if (raw === null && data.mapId === DEFAULT_MAP_ID) {
      raw = globalThis.localStorage.getItem(
        imageGardenZoneEditsStorageKey(scopeId, data.imageRevision, data.mapId),
      );
      version = 2;
      if (raw === null) {
        raw = globalThis.localStorage.getItem(
          legacyGardenZoneEditsStorageKey(scopeId, data.imageRevision),
        );
        version = 1;
      }
    }
  } catch {
    throw new Error(
      "저장한 구역을 읽지 못했습니다. 브라우저 저장소 사용 설정을 확인해 주세요.",
    );
  }
  if (raw === null) return emptyEnvelope(scopeId, data);
  try {
    if (raw.length > MAX_STORAGE_CHARACTERS) throw new Error();
    return version === 1
      ? parseV1(raw, scopeId, data)
      : parseEnvelope(raw, scopeId, data, version === 2 ? 2 : 3);
  } catch {
    throw new Error(
      "저장된 구역 자료를 읽을 수 없습니다. 기존 자료를 덮어쓰지 않았습니다. 다른 브라우저에서 확인하거나 저장 자료를 점검해 주세요.",
    );
  }
}
function snapshot(
  data: DetailMapData,
  saved: Envelope,
): GardenZoneEditsSnapshot {
  const edits = new Map(saved.records.map((zone) => [zone.id, zone]));
  const records = data.zones.map(
    (zone) => edits.get(zone.id) ?? toRecord(data, legacyZone(data, zone)),
  );
  records.push(...saved.records.filter((zone) => zone.origin === "custom"));
  return {
    revision: saved.revision,
    records,
    zones: records.map((item) =>
      toView(
        item,
        data.zones.find((zone) => zone.id === item.id),
      ),
    ),
  };
}
function assertRevision(current: Envelope, expectedRevision: string) {
  if (current.revision !== expectedRevision)
    throw new Error(
      "다른 탭에서 구역이 변경되었습니다. 편집을 취소하고 최신 구역을 확인한 뒤 다시 수정해 주세요.",
    );
}
function write(data: DetailMapData, next: Envelope): GardenZoneEditsSnapshot {
  // Build the result before committing, so derived-geometry errors cannot fail after a write.
  const result = snapshot(data, next);
  try {
    const text = JSON.stringify(next);
    if (text.length > MAX_STORAGE_CHARACTERS) throw new Error();
    globalThis.localStorage.setItem(
      gardenZoneEditsStorageKey(next.scopeId, data.mapId),
      text,
    );
  } catch {
    throw new Error(
      "구역을 저장하지 못했습니다. 브라우저 저장 공간과 사용 설정을 확인해 주세요. 편집 내용은 유지됩니다.",
    );
  }
  return result;
}
export function defaultGardenZoneEdits(
  scopeId: string,
  data: DetailMapData,
): GardenZoneEditsSnapshot {
  return snapshot(data, emptyEnvelope(scopeId, data));
}
export function loadGardenZoneEdits(
  scopeId: string,
  data: DetailMapData,
): GardenZoneEditsSnapshot {
  return snapshot(data, read(scopeId, data));
}
export function saveGardenZoneEdit(
  scopeId: string,
  data: DetailMapData,
  edit: GardenZoneEditInput,
  expectedRevision: string,
): GardenZoneEditsSnapshot {
  const name = nameOf(edit.name);
  const current = read(scopeId, data);
  assertRevision(current, expectedRevision);
  const previous = current.records.find((zone) => zone.id === edit.id);
  const seed = data.zones.find((zone) => zone.id === edit.id);
  if (!previous && !seed)
    throw new Error("지도에 없는 구역은 수정할 수 없습니다.");
  const saved = previous ?? toRecord(data, legacyZone(data, seed!));
  const source = toView(saved, seed);
  validateZoneShape(edit.shape);
  const boundaryChanged = edit.shape !== source.shape;
  const label =
    edit.shape === source.shape
      ? ([...source.label] as Point)
      : labelForZoneShape(edit.shape, source.label);
  const updated = toRecord(
    data,
    { ...source, name, shape: edit.shape, label },
    saved.createdAt,
    new Date(
      Math.max(
        Date.now(),
        Date.parse(saved.updatedAt ?? saved.createdAt ?? "") || 0,
      ),
    ).toISOString(),
    boundaryChanged
      ? "map-edited"
      : saved.geojson.properties.coordinateAccuracy,
    boundaryChanged ? undefined : saved.boundary,
    boundaryChanged ? undefined : saved.label,
  );
  return write(data, {
    ...current,
    revision: newId(),
    records: [
      ...current.records.filter((zone) => zone.id !== edit.id),
      updated,
    ],
  });
}
function nextCode(used: Set<string>): string {
  for (let index = 1; index < 10000; index++) {
    let n = index,
      code = "";
    while (n) {
      n--;
      code = String.fromCharCode(65 + (n % 26)) + code;
      n = Math.floor(n / 26);
    }
    if (!used.has(code)) return code;
  }
  throw new Error("새 구역에 사용할 표시 문자를 만들 수 없습니다.");
}
export function createGardenZone(
  scopeId: string,
  data: DetailMapData,
  input: CreateGardenZoneInput,
  expectedRevision: string,
): GardenZoneEditsSnapshot {
  const name = nameOf(input.name);
  validateZoneShape(input.shape);
  const current = read(scopeId, data);
  assertRevision(current, expectedRevision);
  if (
    current.records.filter((zone) => zone.origin === "custom").length >=
    MAX_CUSTOM_ZONES
  )
    throw new Error("직접 추가할 수 있는 구역은 최대 100개입니다.");
  const ids = new Set([
    ...data.zones.map((zone) => zone.id),
    ...current.records.map((zone) => zone.id),
  ]);
  let id = `zone-${newId()}`;
  for (let attempt = 0; ids.has(id); attempt++) {
    if (attempt >= 4)
      throw new Error("새 구역 ID를 생성하지 못했습니다. 다시 시도해 주세요.");
    id = `zone-${newId()}`;
  }
  const letter = nextCode(
    new Set([
      ...data.zones.map((zone) => zone.letter),
      ...current.records.map((zone) => zone.displayCode),
    ]),
  );
  const now = new Date().toISOString();
  const added = toRecord(
    data,
    {
      id,
      letter,
      name,
      description: CUSTOM_DESCRIPTION,
      shape: input.shape,
      label: labelForZoneShape(input.shape, [NaN, NaN]),
      stopNode: null,
      origin: "custom",
    },
    now,
    now,
    "map-edited",
  );
  return write(data, {
    ...current,
    revision: newId(),
    records: [...current.records, added],
  });
}
/** Standard GeoJSON only. DTO editor curves/timestamps remain in the separate API record. */
export function exportGardenZoneFeatureCollection(
  value: GardenZoneEditsSnapshot | readonly GardenZoneRecord[],
): GardenZoneFeatureCollection {
  const records = "records" in value ? value.records : value;
  return {
    type: "FeatureCollection",
    features: records.map((item) => structuredClone(item.geojson)),
  };
}

/** Replace this browser adapter with HTTP while keeping view/hook contracts stable. */
export const gardenZonesApi = {
  async read(scopeId: string, data: DetailMapData) {
    return loadGardenZoneEdits(scopeId, data);
  },
  async update(
    scopeId: string,
    data: DetailMapData,
    input: GardenZoneEditInput,
    expectedRevision: string,
  ) {
    return saveGardenZoneEdit(scopeId, data, input, expectedRevision);
  },
  async create(
    scopeId: string,
    data: DetailMapData,
    input: CreateGardenZoneInput,
    expectedRevision: string,
  ) {
    return createGardenZone(scopeId, data, input, expectedRevision);
  },
};
