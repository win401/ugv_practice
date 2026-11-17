import { httpApi } from "./httpApi";
import { mockApi } from "./mock";
import { createSeed, type DemoDb } from "./seed";
import type { gardenAreasApi } from "./gardenAreas";
import type { gardenDetailApi } from "./gardenDetail";
import type { gardenZonesApi } from "./gardenZoneEdits";
import type {
  AddressResult,
  AdminSnapshot,
  Device,
  FinishWork,
  Garden,
  NewCustomer,
  AdminNewGarden,
  OperatorDashboard,
  User,
  WorkRecord,
} from "./types";

/**
 * 화면이 부르는 API 함수 목록. 화면은 이 인터페이스만 알고, 실제 구현은 바꿔 끼운다.
 * 구현은 브라우저 안의 가상 서버(mock.ts)와 실제 서버(httpApi.ts) 두 가지이고,
 * 아래 `api` 가 로그인한 계정에 따라 고른다. 경로 대응은 docs/api.md 참고.
 */
export interface ApiClient {
  /** Image-based garden planning demo; no device commands or persisted missions. */
  gardenDetail: typeof gardenDetailApi;
  gardenAreas: typeof gardenAreasApi;
  gardenZones: typeof gardenZonesApi;
  auth: {
    /** 로그인한 사용자. 없으면 null */
    session(): Promise<User | null>;
    login(email: string, password: string): Promise<User>;
    logout(): Promise<void>;
  };
  /**
   * 운영 화면. 운영자는 내 정원과 장비만 다룬다.
   * 관리자도 호출할 수 있고, customerId 로 고른 고객의 정원을 본다.
   */
  operator: {
    dashboard(customerId?: string): Promise<OperatorDashboard>;
    startWork(gardenId: string): Promise<void>;
    finishWork(input: FinishWork): Promise<WorkRecord>;
  };
  /** 관리자(개발자) 전용. */
  admin: {
    snapshot(): Promise<AdminSnapshot>;
    addCustomer(input: NewCustomer): Promise<User>;
    /** 고객의 정원 등록. 정원 등록은 관리자만 한다. */
    addGarden(input: AdminNewGarden): Promise<Garden>;
    /** 이름·연락처·정지 여부를 고친다. password 는 새 비밀번호이고 실제 서버에서만 받는다. */
    updateCustomer(
      id: string,
      patch: Partial<User> & { password?: string },
    ): Promise<void>;
    /** 정원 등록 화면의 주소·장소 검색. 실제 서버에만 있다. */
    searchAddress?(query: string): Promise<AddressResult[]>;
    /** 계정과 그 계정의 정원을 함께 지운다. 실제 서버에만 있다(가상 서버는 정지만 한다). */
    deleteCustomer?(id: string): Promise<void>;
    /** geo 를 보내면 위치와 경계도 바꾼다. 실제 서버에서만 받는다. */
    updateGarden(id: string, patch: Partial<Garden>): Promise<void>;
    /** 정원을 지운다. 작업 중이던 장비는 대기로 바뀐다. 실제 서버에만 있다. */
    deleteGarden?(id: string): Promise<void>;
    registerDevice(serial: string, firmware: string): Promise<Device>;
    updateDevice(id: string, patch: Partial<Device>): Promise<void>;
    /** 장비를 맡은 모든 정원에서 회수한다. */
    releaseDevice(id: string): Promise<void>;
    /** 시연 데이터로 되돌린다. 실제 서버에는 두지 않는 개발용 기능. */
    resetDemo(): Promise<void>;
  };
  /**
   * 데이터가 바뀌었을 때 알림을 받는다. 가상 서버는 변경 즉시(다른 탭 포함) 알리고,
   * 실제 서버에서는 주기적 재조회나 서버 푸시로 바꾼다.
   */
  onChange(listener: () => void): () => void;
}

/**
 * 가상 데이터에 있는 계정인지. 시연 계정과, 시연 관리자가 이 브라우저에서 추가한 고객이 해당한다.
 * 가상 서버가 데이터를 저장하는 곳(mock.ts 의 DB_KEY)을 같이 읽는다.
 */
const MOCK_DB_KEY = "saemgil-db-v2";
function isMockEmail(email: string) {
  const wanted = email.trim().toLowerCase();
  let users = createSeed().users;
  try {
    const saved = localStorage.getItem(MOCK_DB_KEY);
    if (saved) users = (JSON.parse(saved) as DemoDb).users;
  } catch {
    // 저장소를 못 읽으면 시연 계정만 가상 데이터로 본다.
  }
  return users.some((u) => u.email.toLowerCase() === wanted);
}

/**
 * 지금 로그인한 계정이 가상 데이터 계정인지. 화면이 시작할 때 부르는 auth.session 이 정한다.
 * 가상 데이터 안내 문구처럼 계정 종류에 따라 달라지는 화면 표시에 쓴다.
 */
let demoSession = false;
export const isDemoSession = () => demoSession;

/** 이 탭이 가상 서버에 로그인돼 있으면 가상 서버를, 아니면 실제 서버를 쓴다. */
const current = () =>
  mockApi.auth.session().then((user) => (user ? mockApi : httpApi));

/** 한 묶음의 함수들을 부를 때마다 current() 가 고른 쪽으로 넘긴다. */
function routed<G extends "operator" | "admin">(group: G): ApiClient[G] {
  type Fn = (...args: unknown[]) => Promise<unknown>;
  return Object.fromEntries(
    // 실제 서버에만 있는 함수도 있어 실제 서버 쪽 목록을 기준으로 한다.
    Object.keys(httpApi[group]).map((name) => [
      name,
      (...args: unknown[]) =>
        current().then((client) =>
          (client[group] as unknown as Record<string, Fn>)[name](...args),
        ),
    ]),
  ) as unknown as ApiClient[G];
}

/**
 * 화면이 쓰는 API. 로그인한 계정에 따라 구현을 고른다.
 * - 가상 데이터에 있는 계정: 가상 서버(mock.ts). 실제 서버를 부르지 않는다.
 * - 그 외 계정: 실제 서버(httpApi.ts).
 * 로그인·로그아웃은 페이지를 새로 불러오므로(App.tsx) 한 화면에서 두 쪽이 섞이지 않는다.
 */
export const api: ApiClient = {
  gardenDetail: mockApi.gardenDetail,
  gardenAreas: mockApi.gardenAreas,
  gardenZones: mockApi.gardenZones,
  auth: {
    session: () =>
      mockApi.auth.session().then((user) => {
        demoSession = user !== null;
        return user ?? httpApi.auth.session();
      }),
    login: (email, password) =>
      (isMockEmail(email) ? mockApi : httpApi).auth.login(email, password),
    logout: () => current().then((client) => client.auth.logout()),
  },
  operator: routed("operator"),
  admin: routed("admin"),
  // 가상 서버의 변경 알림. 실제 서버는 알림이 없어 화면이 직접 다시 불러온다.
  onChange: mockApi.onChange,
};
