import {
  validateGardenAreaBoundary,
  type GeoPoint,
} from "../lib/gardenAreaGeometry";

export type { GeoPoint } from "../lib/gardenAreaGeometry";

export interface GardenArea {
  id: string;
  name: string;
  boundary: GeoPoint[];
  detailKind: "illustration" | "satellite";
  isExample: boolean;
  createdAt: string;
}

export interface CreateGardenAreaInput {
  name: string;
  boundary: GeoPoint[];
}

type StoredAreas = { version: 1; areas: GardenArea[] };
type AreaErrorCode =
  | "INVALID_INPUT"
  | "STORAGE_UNAVAILABLE"
  | "CORRUPT_STORAGE"
  | "STORAGE_FULL"
  | "NOT_FOUND";

export class GardenAreaError extends Error {
  readonly code: AreaErrorCode;

  constructor(code: AreaErrorCode, message: string) {
    super(message);
    this.name = "GardenAreaError";
    this.code = code;
  }
}

export const GARDEN_AREAS_STORAGE_PREFIX = "saemgil-garden-areas-v1:";
const EXAMPLE_CREATED_AT = "2026-11-12T00:00:00.000Z";

// Approximate examples traced manually from the V-world satellite view north
// of the eastern park's lake. Screen pixels were converted using its Web
// Mercator tiles; these are not surveyed or official garden boundaries.
// Legacy examples remain in storage for compatibility. The shared image scene
// replaces their display; custom geographic boundaries are managed separately.
const examples: GardenArea[] = [
  {
    id: "example-circle",
    name: "원형 화단 · 시안",
    boundary: [
      [34.929908, 127.507383],
      [34.929881, 127.50756],
      [34.929785, 127.507708],
      [34.929633, 127.507769],
      [34.929507, 127.507735],
      [34.929404, 127.507595],
      [34.929356, 127.507418],
      [34.929389, 127.507236],
      [34.929492, 127.50712],
      [34.929622, 127.507056],
      [34.929763, 127.50708],
      [34.929859, 127.507214],
    ],
    detailKind: "illustration",
    isExample: true,
    createdAt: EXAMPLE_CREATED_AT,
  },
  {
    id: "example-rose",
    name: "장미 정원 · 시안",
    boundary: [
      [34.930026, 127.507938],
      [34.930018, 127.508078],
      [34.929956, 127.508169],
      [34.92985, 127.508217],
      [34.929765, 127.50815],
      [34.929708, 127.508035],
      [34.929727, 127.507928],
      [34.929802, 127.507834],
      [34.92991, 127.507815],
      [34.929993, 127.507869],
    ],
    detailKind: "satellite",
    isExample: true,
    createdAt: EXAMPLE_CREATED_AT,
  },
  {
    id: "example-lakeside",
    name: "산책 정원 · 시안",
    boundary: [
      [34.929809, 127.506141],
      [34.929829, 127.50652],
      [34.929859, 127.506879],
      [34.929754, 127.506943],
      [34.929624, 127.506874],
      [34.929496, 127.506753],
      [34.929505, 127.506541],
      [34.929584, 127.506334],
      [34.929686, 127.506216],
    ],
    detailKind: "satellite",
    isExample: true,
    createdAt: EXAMPLE_CREATED_AT,
  },
];

const copyArea = (area: GardenArea): GardenArea => ({
  ...area,
  boundary: area.boundary.map(([latitude, longitude]) => [latitude, longitude]),
});

function validateName(input: unknown): string {
  if (typeof input !== "string") {
    throw new GardenAreaError("INVALID_INPUT", "정원 이름을 입력해 주세요.");
  }
  const name = input.trim();
  if (Array.from(name).length < 1 || Array.from(name).length > 30) {
    throw new GardenAreaError(
      "INVALID_INPUT",
      "정원 이름은 1~30자로 입력해 주세요.",
    );
  }
  return name;
}

function keyOf(scopeId: string): string {
  if (
    typeof scopeId !== "string" ||
    !scopeId.trim() ||
    scopeId.trim().length > 200
  ) {
    throw new GardenAreaError(
      "INVALID_INPUT",
      "정원을 불러올 사용자 정보가 없습니다.",
    );
  }
  try {
    return `${GARDEN_AREAS_STORAGE_PREFIX}${encodeURIComponent(scopeId.trim())}`;
  } catch {
    throw new GardenAreaError(
      "INVALID_INPUT",
      "사용자 식별 정보가 올바르지 않습니다.",
    );
  }
}

function storage(): Storage {
  try {
    if (typeof globalThis.localStorage === "undefined") throw new Error();
    return globalThis.localStorage;
  } catch {
    throw new GardenAreaError(
      "STORAGE_UNAVAILABLE",
      "브라우저 저장소에 접근할 수 없습니다. 저장소 허용 설정을 확인해 주세요.",
    );
  }
}

function parseStoredArea(input: unknown): GardenArea {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error();
  const value = input as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 200 ||
    typeof value.isExample !== "boolean" ||
    (value.detailKind !== "illustration" && value.detailKind !== "satellite") ||
    (value.detailKind === "illustration" &&
      (value.id !== "example-circle" || !value.isExample)) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    throw new Error();
  }
  return {
    id: value.id,
    name: validateName(value.name),
    boundary: validateGardenAreaBoundary(value.boundary),
    detailKind: value.detailKind,
    isExample: value.isExample,
    createdAt: value.createdAt,
  };
}

function load(store: Storage, key: string): GardenArea[] {
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    throw new GardenAreaError(
      "STORAGE_UNAVAILABLE",
      "저장한 정원 목록을 읽지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.",
    );
  }
  // Reading the first example list must not write or modify any browser data.
  if (raw === null) return examples.map(copyArea);
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      throw new Error();
    const envelope = saved as Record<string, unknown>;
    if (envelope.version !== 1 || !Array.isArray(envelope.areas))
      throw new Error();
    const areas = envelope.areas.map(parseStoredArea);
    if (new Set(areas.map((area) => area.id)).size !== areas.length)
      throw new Error();
    return areas;
  } catch {
    // Never silently replace invalid saved drawings with example data.
    throw new GardenAreaError(
      "CORRUPT_STORAGE",
      "저장된 정원 목록의 형식이 올바르지 않습니다. 기존 데이터를 덮어쓰지 않았습니다.",
    );
  }
}

function save(store: Storage, key: string, areas: GardenArea[]) {
  const record: StoredAreas = { version: 1, areas };
  try {
    store.setItem(key, JSON.stringify(record));
  } catch (reason) {
    const errorName =
      reason && typeof reason === "object" && "name" in reason
        ? reason.name
        : "";
    if (
      errorName === "QuotaExceededError" ||
      errorName === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      throw new GardenAreaError(
        "STORAGE_FULL",
        "브라우저 저장 공간이 부족해 정원을 저장하지 못했습니다. 공간을 확보한 뒤 다시 시도해 주세요.",
      );
    }
    throw new GardenAreaError(
      "STORAGE_UNAVAILABLE",
      "정원 변경 내용을 저장하지 못했습니다. 브라우저 저장소 허용 설정을 확인해 주세요.",
    );
  }
}

/**
 * Browser-only mock API. A scope separates each user's/customer's local demo
 * list; this is not server authorization. It never reads or writes saemgil-db-v2,
 * operational missions, device commands, or the production backend.
 */
export const gardenAreasApi = {
  async list(scopeId: string): Promise<GardenArea[]> {
    const key = keyOf(scopeId);
    return load(storage(), key).map(copyArea);
  },

  async create(
    scopeId: string,
    input: CreateGardenAreaInput,
  ): Promise<GardenArea> {
    const key = keyOf(scopeId);
    const name = validateName(input?.name);
    let boundary: GeoPoint[];
    try {
      boundary = validateGardenAreaBoundary(input?.boundary);
    } catch (reason) {
      throw new GardenAreaError(
        "INVALID_INPUT",
        reason instanceof Error
          ? reason.message
          : "정원 경계를 다시 확인해 주세요.",
      );
    }
    const store = storage();
    const areas = load(store, key);
    if (typeof globalThis.crypto?.randomUUID !== "function") {
      throw new GardenAreaError(
        "INVALID_INPUT",
        "정원 식별자를 만들 수 없습니다. 최신 브라우저에서 다시 시도해 주세요.",
      );
    }
    const id = `garden-area-${globalThis.crypto.randomUUID()}`;
    if (areas.some((area) => area.id === id)) {
      throw new GardenAreaError(
        "INVALID_INPUT",
        "정원 식별자가 중복되었습니다. 다시 시도해 주세요.",
      );
    }
    const area: GardenArea = {
      id,
      name,
      boundary,
      detailKind: "satellite",
      isExample: false,
      createdAt: new Date().toISOString(),
    };
    save(store, key, [...areas, area]);
    return copyArea(area);
  },

  async remove(scopeId: string, id: string): Promise<void> {
    const key = keyOf(scopeId);
    const store = storage();
    const areas = load(store, key);
    if (typeof id !== "string" || !areas.some((area) => area.id === id)) {
      throw new GardenAreaError(
        "NOT_FOUND",
        "삭제할 정원을 찾지 못했습니다. 목록을 다시 확인해 주세요.",
      );
    }
    save(
      store,
      key,
      areas.filter((area) => area.id !== id),
    );
  },
};
