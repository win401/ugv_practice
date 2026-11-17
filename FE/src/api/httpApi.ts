import type { ApiClient } from "./client";
import { gardenAreasApi } from "./gardenAreas";
import { gardenDetailApi } from "./gardenDetail";
import { gardenZonesApi } from "./gardenZoneEdits";
import { http } from "./http";
import {
  ApiError,
  type AddressResult,
  type Device,
  type Garden,
  type GardenGeo,
  type User,
} from "./types";

/**
 * 실제 서버(BE)를 부르는 구현. 가상 서버(mock.ts)와 같은 ApiClient 를 따른다.
 * 서버가 주는 값을 화면이 쓰는 모양으로 바꾼다: id 는 글자로, 날짜는 2026.11.13 형식으로.
 * 서버에 아직 없는 기능은 안내 문장과 함께 거절한다. 서버 API가 생기는 대로 채운다.
 */

type ServerUser = Omit<User, "id" | "joined"> & { id: number; joined: string };

type ServerDevice = Omit<
  Device,
  "lastSeen" | "registered" | "activeGardenId"
> & {
  /** 2026-11-13T15:40:12 형식. 수신한 적이 없으면 null */
  lastSeen: string | null;
  registered: string;
  activeGardenId: number | null;
};

type ServerGarden = Pick<
  Garden,
  "name" | "address" | "flower" | "area" | "status" | "deviceId"
> & {
  id: number;
  customerId: number;
  registered: string;
  centerLat: number;
  centerLng: number;
  boundary: GardenGeo["boundary"];
  geojson: GardenGeo["geojson"];
};

/** 2026-11-13 → 2026.11.13 */
const toDate = (iso: string) => iso.slice(0, 10).replaceAll("-", ".");

const toUser = (u: ServerUser): User => ({
  ...u,
  id: String(u.id),
  joined: toDate(u.joined),
});

const toDevice = (v: ServerDevice): Device => ({
  ...v,
  lastSeen: v.lastSeen
    ? `${toDate(v.lastSeen)} ${v.lastSeen.slice(11, 16)}`
    : "-",
  registered: toDate(v.registered),
  activeGardenId: v.activeGardenId === null ? null : String(v.activeGardenId),
});

const toGarden = (g: ServerGarden): Garden => ({
  id: String(g.id),
  customerId: String(g.customerId),
  name: g.name,
  address: g.address,
  // 지역은 저장하지 않고 주소 앞 두 마디로 만든다.
  region: g.address.split(" ").slice(0, 2).join(" "),
  area: g.area,
  flower: g.flower,
  deviceId: g.deviceId,
  registered: toDate(g.registered),
  status: g.status,
  // 작업 기록은 장비 연동 때 생긴다.
  lastWork: null,
  failures: 0,
  // 사진 기준 자료는 가상 데이터에만 있다. 실제 정원은 위경도(geo)를 쓴다.
  shape: "",
  label: [0, 0],
  route: [],
  geo: {
    center: [g.centerLng, g.centerLat],
    boundary: g.boundary,
    geojson: g.geojson,
  },
});

/** 보낸 값 중 서버가 고칠 수 있는 것만 남긴다. */
function pick<T extends object>(patch: T, keys: (keyof T)[]) {
  return Object.fromEntries(
    keys.filter((k) => k in patch).map((k) => [k, patch[k]]),
  );
}

export const httpApi: ApiClient = {
  // 사진 기준 정원 계획 시연. 서버에 저장하지 않는 화면 기능이라 가상 서버와 같은 것을 쓴다.
  gardenDetail: gardenDetailApi,
  gardenAreas: gardenAreasApi,
  gardenZones: gardenZonesApi,

  auth: {
    session: () =>
      http<ServerUser>("GET", "/api/auth/me").then(toUser, (e) => {
        // 로그인하지 않았거나(401) 정지된 계정(403)이면 로그인 화면으로 보낸다.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403))
          return null;
        throw e;
      }),
    login: (email, password) =>
      http<ServerUser>("POST", "/api/auth/login", {
        email: email.trim(),
        password,
      }).then(toUser),
    logout: () => http<void>("POST", "/api/auth/logout"),
  },

  operator: {
    dashboard: async (customerId) => {
      const d = await http<{
        user: ServerUser;
        gardens: ServerGarden[];
        devices: ServerDevice[];
        viewAs?: {
          customerId: number;
          customers: { id: number; name: string }[];
        };
      }>("GET", "/api/me/dashboard", undefined, {
        // 없으면(빈 글자 포함) 조건 없이 보낸다.
        customerId: customerId || undefined,
      });
      return {
        user: toUser(d.user),
        gardens: d.gardens.map(toGarden),
        devices: d.devices.map(toDevice),
        // 작업 기록은 장비 연동 때 생긴다.
        records: [],
        ...(d.viewAs && {
          viewAs: {
            customerId: String(d.viewAs.customerId),
            customers: d.viewAs.customers.map((c) => ({
              id: String(c.id),
              name: c.name,
            })),
          },
        }),
      };
    },
    // 실제 장비에 명령을 보내는 기능은 장비 연동 때 붙인다. 그때까지 실제 계정은 관수를 시작할 수 없다.
    startWork: () =>
      Promise.reject(new ApiError(501, "관수 실행은 장비 연동 후 제공됩니다.")),
    finishWork: () =>
      Promise.reject(new ApiError(501, "관수 실행은 장비 연동 후 제공됩니다.")),
  },

  admin: {
    snapshot: async () => {
      const [users, gardens, devices] = await Promise.all([
        http<ServerUser[]>("GET", "/api/admin/users"),
        http<ServerGarden[]>("GET", "/api/admin/gardens"),
        http<ServerDevice[]>("GET", "/api/admin/devices"),
      ]);
      const all = users.map(toUser);
      return {
        admins: all.filter((u) => u.role === "admin"),
        customers: all.filter((u) => u.role === "operator"),
        gardens: gardens.map(toGarden),
        devices: devices.map(toDevice),
      };
    },
    addCustomer: (input) =>
      http<ServerUser>("POST", "/api/admin/users", {
        email: input.email,
        password: input.password,
        role: input.role ?? "operator",
        name: input.name,
        phone: input.phone,
      }).then(toUser),
    addGarden: (input) =>
      input.geo
        ? http<ServerGarden>("POST", "/api/admin/gardens", {
            customerId: Number(input.customerId),
            name: input.name,
            address: input.address,
            flower: input.flower,
            area: input.area,
            deviceId: input.deviceId,
            centerLat: input.geo.center[1],
            centerLng: input.geo.center[0],
            boundary: input.geo.boundary,
            geojson: input.geo.geojson,
          }).then(toGarden)
        : Promise.reject(
            new ApiError(400, "지도에 정원 경계를 그리고 닫아 주세요."),
          ),
    searchAddress: (query) =>
      http<AddressResult[]>("GET", "/api/admin/geocode", undefined, { query }),
    updateCustomer: async (id, patch) => {
      // 이메일과 역할은 서버에서 바꾸지 않는다.
      await http(
        "PATCH",
        `/api/admin/users/${id}`,
        pick(patch, ["name", "phone", "status", "password"]),
      );
    },
    deleteCustomer: (id) => http<void>("DELETE", `/api/admin/users/${id}`),
    updateGarden: async (id, patch) => {
      await http("PATCH", `/api/admin/gardens/${id}`, {
        ...pick(patch, [
          "name",
          "address",
          "flower",
          "area",
          "status",
          "deviceId",
          "customerId",
        ]),
        // 위치와 경계는 서버가 넷을 함께 받는다. 하나만 바뀌면 지도 위치와 모양이 어긋난다.
        ...(patch.geo && {
          centerLat: patch.geo.center[1],
          centerLng: patch.geo.center[0],
          boundary: patch.geo.boundary,
          geojson: patch.geo.geojson,
        }),
      });
    },
    deleteGarden: (id) => http<void>("DELETE", `/api/admin/gardens/${id}`),
    registerDevice: (serial, firmware) =>
      http<ServerDevice>("POST", "/api/admin/devices", {
        serial,
        firmware,
      }).then(toDevice),
    updateDevice: async (id, patch) => {
      await http(
        "PATCH",
        `/api/admin/devices/${id}`,
        pick(patch, [
          "firmware",
          "online",
          "state",
          "battery",
          "water",
          "activeGardenId",
        ]),
      );
    },
    releaseDevice: async (id) => {
      await http("POST", `/api/admin/devices/${id}/release`);
    },
    resetDemo: () =>
      Promise.reject(
        new ApiError(400, "초기화는 가상 데이터에서만 쓸 수 있습니다."),
      ),
  },

  // 실제 서버는 변경을 알려 주지 않는다. 등록·수정 뒤에 화면이 직접 다시 불러온다.
  onChange: () => () => {},
};
