import type { ApiClient } from "./client";
import { gardenAreasApi } from "./gardenAreas";
import { gardenDetailApi } from "./gardenDetail";
import { gardenZonesApi } from "./gardenZoneEdits";
import { normalizeOperatingGarden } from "./operatingGardenGeometry";
import { createSeed, DEFAULT_PASSWORD, type DemoDb } from "./seed";
import { clock, DEMO_DATE, now, today } from "./time";
import { ApiError, type Garden, type User } from "./types";

/**
 * 브라우저 안의 가상 서버. 데이터는 localStorage 한 곳에 두어 고객 화면과
 * 관리자 화면(다른 탭 포함)이 같은 값을 본다. 권한 검사도 실제 서버가 할 일을
 * 흉내 낸다. 단, 브라우저 안에서 도는 코드라 보안 장치는 아니다.
 */

const DB_KEY = "saemgil-db-v2";
// 로그인은 탭마다 따로 둔다(sessionStorage). 한 탭은 관리자, 다른 탭은 운영자로 열어
// 두 화면을 나란히 볼 수 있다. 실제 서버에서는 쿠키 세션이나 토큰으로 바꾼다.
const SESSION_KEY = "saemgil-session-v1";

const listeners = new Set<() => void>();
let db: DemoDb = loadDb();

function loadDb(): DemoDb {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) return JSON.parse(saved) as DemoDb;
  } catch {
    // 저장소를 못 쓰는 환경이면 시연 데이터로 시작한다.
  }
  return createSeed();
}

function emit() {
  listeners.forEach((l) => l());
}

/** 데이터를 바꾸고 저장한 뒤 화면들에 알린다. */
function mutate<T>(change: (d: DemoDb) => T): T {
  const next = structuredClone(db);
  const result = change(next);
  db = next;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // 저장에 실패해도 이 탭에서는 계속 쓸 수 있다.
  }
  emit();
  return result;
}

// 다른 탭에서 데이터가 바뀌면 다시 읽는다.
window.addEventListener("storage", (e) => {
  if (e.key !== DB_KEY) return;
  db = loadDb();
  emit();
});

const copy = <T>(v: T): T => structuredClone(v);

function sessionUser(): User | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return db.users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

function requireRole(role: User["role"]): User {
  const user = sessionUser();
  if (!user) throw new ApiError(401, "로그인이 필요합니다.");
  if (user.status !== "active") throw new ApiError(403, "정지된 계정입니다.");
  if (user.role !== role) throw new ApiError(403, "권한이 없습니다.");
  return user;
}

/** 운영 화면 API: 운영자 또는 관리자 */
function requireOperator(): User {
  const user = sessionUser();
  if (!user) throw new ApiError(401, "로그인이 필요합니다.");
  if (user.status !== "active") throw new ApiError(403, "정지된 계정입니다.");
  return user;
}

function nextId(ids: string[], prefix: string, width: number) {
  const n = Math.max(0, ...ids.map((id) => Number(id.replace(/\D/g, ""))));
  return `${prefix}${String(n + 1).padStart(width, "0")}`;
}

function find<T extends { id: string }>(list: T[], id: string, what: string) {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ApiError(404, `${what}을(를) 찾을 수 없습니다.`);
  return item;
}

/** 장비가 맡은 정원의 고객. 장비는 한 고객의 정원만 맡는다. */
function deviceOwner(d: DemoDb, deviceId: string) {
  return d.gardens.find((g) => g.deviceId === deviceId)?.customerId;
}

/** 운영자 본인의 정원만 돌려준다. 남의 정원이면 없는 것처럼 404. 관리자는 모든 정원. */
function ownGarden(d: DemoDb, user: User, gardenId: string): Garden {
  const g = d.gardens.find(
    (x) =>
      x.id === gardenId && (user.role === "admin" || x.customerId === user.id),
  );
  if (!g || g.status === "inactive")
    throw new ApiError(404, "정원을 찾을 수 없습니다.");
  return g;
}

// 비동기 함수로 감싸 실제 서버 호출과 같은 모양(Promise, 예외 = 거절)으로 맞춘다.
const run = <T>(fn: () => T) => new Promise<T>((ok) => ok(fn()));

export const mockApi: ApiClient = {
  gardenDetail: gardenDetailApi,
  gardenAreas: gardenAreasApi,
  gardenZones: gardenZonesApi,
  auth: {
    session: () => run(() => copy(sessionUser())),
    login: (email, password) =>
      run(() => {
        const user = db.users.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
        );
        if (!user || db.passwords[user.id] !== password)
          throw new ApiError(401, "이메일 또는 비밀번호가 맞지 않습니다.");
        if (user.status !== "active")
          throw new ApiError(403, "정지된 계정입니다. 관리자에게 문의하세요.");
        sessionStorage.setItem(SESSION_KEY, user.id);
        emit();
        return copy(user);
      }),
    logout: () =>
      run(() => {
        sessionStorage.removeItem(SESSION_KEY);
        emit();
      }),
  },

  operator: {
    dashboard: (customerId) =>
      run(() => {
        const user = requireOperator();
        const visible = (id: string) =>
          db.gardens.filter(
            (g) => g.customerId === id && g.status !== "inactive",
          );
        // 관리자는 처음에 자기 정원을 보고, 정원이 있는 고객을 골라 그 고객의 화면도 볼 수 있다.
        const customers =
          user.role === "admin"
            ? [
                { id: user.id, name: `${user.name} (내 정원)` },
                ...db.users
                  .filter((u) => u.role === "operator" && visible(u.id).length)
                  .map((u) => ({ id: u.id, name: u.name })),
              ]
            : [];
        const owner =
          user.role === "admin"
            ? ((customers.find((c) => c.id === customerId) ?? customers[0])
                ?.id ?? "")
            : user.id;
        const gardens = visible(owner).map(normalizeOperatingGarden);
        const ids = new Set(gardens.map((g) => g.id));
        const deviceIds = new Set(gardens.map((g) => g.deviceId));
        return copy({
          user,
          gardens,
          devices: db.devices.filter((v) => deviceIds.has(v.id)),
          records: db.records.filter((r) => ids.has(r.gardenId)),
          ...(user.role === "admin" && {
            viewAs: { customerId: owner, customers },
          }),
        });
      }),

    startWork: (gardenId) =>
      run(() => {
        const user = requireOperator();
        mutate((d) => {
          const g = ownGarden(d, user, gardenId);
          if (g.status !== "active")
            throw new ApiError(409, "관리자 승인 후 관수할 수 있습니다.");
          if (!g.deviceId)
            throw new ApiError(409, "이 정원에 배정된 장비가 없습니다.");
          const v = find(d.devices, g.deviceId, "장비");
          if (!v.online)
            throw new ApiError(409, "장비와 연결되어 있지 않습니다.");
          if (v.state === "fault")
            throw new ApiError(409, "장비에 장애가 있어 시작할 수 없습니다.");
          if (v.state === "working" && v.activeGardenId !== g.id)
            throw new ApiError(409, "장비가 다른 정원에서 작업 중입니다.");
          v.state = "working";
          v.activeGardenId = g.id;
          v.lastSeen = now();
        });
      }),

    finishWork: (input) =>
      run(() => {
        const user = requireOperator();
        return mutate((d) => {
          const g = ownGarden(d, user, input.gardenId);
          const v =
            d.devices.find((x) => x.activeGardenId === g.id) ??
            d.devices.find((x) => x.id === g.deviceId);
          const record = {
            id: Date.now(),
            gardenId: g.id,
            deviceId: v?.id ?? "-",
            date: DEMO_DATE,
            time: clock(),
            minutes: input.minutes,
            water: input.water,
            complete: input.complete,
          };
          d.records.unshift(record);
          g.lastWork = `${record.date} ${record.time}`;
          if (v && v.state === "working") {
            v.state = "idle";
            v.activeGardenId = null;
            v.lastSeen = now();
          }
          return copy(record);
        });
      }),
  },

  admin: {
    snapshot: () =>
      run(() => {
        requireRole("admin");
        return copy({
          admins: db.users.filter((u) => u.role === "admin"),
          customers: db.users.filter((u) => u.role === "operator"),
          gardens: db.gardens.map(normalizeOperatingGarden),
          devices: db.devices,
        });
      }),

    addCustomer: (input) =>
      run(() => {
        requireRole("admin");
        return mutate((d) => {
          if (d.users.some((u) => u.email === input.email))
            throw new ApiError(409, "이미 등록된 이메일입니다.");
          const user: User = {
            ...input,
            id: nextId(
              d.users.filter((u) => u.role === "operator").map((u) => u.id),
              "C",
              3,
            ),
            role: "operator",
            joined: today(),
            status: "active",
          };
          d.users.push(user);
          d.passwords[user.id] = DEFAULT_PASSWORD;
          return copy(user);
        });
      }),

    addGarden: (input) =>
      run(() => {
        requireRole("admin");
        return mutate((d) => {
          const owner = d.users.find((u) => u.id === input.customerId);
          if (!owner) throw new ApiError(404, "계정을 찾을 수 없습니다.");
          const name = input.name.trim();
          if (!name) throw new ApiError(400, "정원 이름을 입력해 주세요.");
          if (!(input.area > 0))
            throw new ApiError(400, "정원 면적은 0보다 커야 합니다.");
          if (
            d.gardens.some(
              (g) =>
                g.customerId === owner.id &&
                g.status !== "inactive" &&
                g.name === name,
            )
          )
            throw new ApiError(409, "이 고객에게 같은 이름의 정원이 있습니다.");
          if (input.deviceId) {
            find(d.devices, input.deviceId, "장비");
            const other = deviceOwner(d, input.deviceId);
            if (other && other !== owner.id)
              throw new ApiError(409, "다른 고객의 정원을 맡은 장비입니다.");
          }
          const garden: Garden = {
            ...input,
            name,
            id: nextId(
              d.gardens.map((g) => g.id),
              "G",
              3,
            ),
            region: input.address.split(" ").slice(0, 2).join(" "),
            registered: today(),
            // 관리자가 직접 등록하므로 바로 사용 중이다.
            status: "active",
            lastWork: null,
            failures: 0,
          };
          d.gardens.push(garden);
          return copy(garden);
        });
      }),

    updateCustomer: (id, patch) =>
      run(() => {
        requireRole("admin");
        mutate((d) => {
          const u = find(d.users, id, "고객");
          // 역할과 id 는 바꿀 수 없다.
          Object.assign(u, { ...patch, id: u.id, role: u.role });
        });
      }),

    updateGarden: (id, patch) =>
      run(() => {
        requireRole("admin");
        mutate((d) => {
          const g = find(d.gardens, id, "정원");
          const ownerChanged =
            patch.customerId !== undefined && patch.customerId !== g.customerId;
          if (ownerChanged) find(d.users, patch.customerId!, "고객");
          const next = { ...g, ...patch, id: g.id };
          // 소유자가 바뀌면 이전 고객의 장비를 계속 쓰지 않도록 배정을 푼다.
          if (ownerChanged) next.deviceId = null;
          if (next.deviceId && next.deviceId !== g.deviceId) {
            find(d.devices, next.deviceId, "장비");
            const owner = deviceOwner(d, next.deviceId);
            if (owner && owner !== next.customerId)
              throw new ApiError(
                409,
                "다른 고객의 정원을 맡고 있는 장비입니다.",
              );
          }
          Object.assign(g, next);
          // 작업 중이던 정원에서 장비가 빠지면 작업도 멈춘다.
          for (const v of d.devices)
            if (v.activeGardenId === g.id && v.id !== g.deviceId) {
              v.state = "idle";
              v.activeGardenId = null;
            }
        });
      }),

    registerDevice: (serial, firmware) =>
      run(() => {
        requireRole("admin");
        return mutate((d) => {
          if (d.devices.some((v) => v.serial === serial))
            throw new ApiError(409, "이미 등록된 시리얼 번호입니다.");
          const device = {
            id: nextId(
              d.devices.map((v) => v.id),
              "ROVEN-",
              2,
            ),
            serial,
            firmware,
            online: false,
            state: "idle" as const,
            battery: 100,
            water: 0,
            lastSeen: "-",
            registered: today(),
            activeGardenId: null,
          };
          d.devices.push(device);
          return copy(device);
        });
      }),

    updateDevice: (id, patch) =>
      run(() => {
        requireRole("admin");
        mutate((d) => {
          const v = find(d.devices, id, "장비");
          Object.assign(v, { ...patch, id: v.id });
        });
      }),

    releaseDevice: (id) =>
      run(() => {
        requireRole("admin");
        mutate((d) => {
          const v = find(d.devices, id, "장비");
          for (const g of d.gardens) if (g.deviceId === id) g.deviceId = null;
          v.state = "idle";
          v.activeGardenId = null;
        });
      }),

    resetDemo: () =>
      run(() => {
        requireRole("admin");
        mutate((d) => Object.assign(d, createSeed()));
      }),
  },

  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
