/**
 * 고객 화면과 관리자 화면이 함께 쓰는 데이터 모델.
 * 백엔드 API의 요청·응답 형태와 같게 유지한다. 계약은 docs/api.md 참고.
 */

export type Role = "admin" | "operator";

/** 관리자(개발자) 또는 운영자(정원주인) 계정. 비밀번호는 응답에 담지 않는다. */
export type User = {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  joined: string;
  status: "active" | "suspended";
};

export type GardenStatus = "active" | "pending" | "inactive";

/** 지도 위 구역 경계(SVG path)와 이름표 위치, 예시 관수 경로. */
export type GardenGeometry = {
  shape: string;
  label: number[];
  route: number[][];
};

/**
 * 실제 정원의 위치와 경계. 좌표 순서는 [경도, 위도]다. 가상 데이터의 정원에는 없다.
 * boundary 는 화면에서 그린 원본(M 시작, L 직선, Q·C 곡선, Z 닫기), geojson 은 곡선을 직선으로 나눈 Polygon.
 */
export type GardenGeo = {
  center: [number, number];
  boundary: { kind: "M" | "L" | "Q" | "C" | "Z"; points: number[][] }[];
  geojson: { type: "Polygon"; coordinates: number[][][] };
};

export type Garden = GardenGeometry & {
  geo?: GardenGeo;
  id: string;
  name: string;
  /** 소유 운영자 */
  customerId: string;
  region: string;
  address: string;
  area: number;
  flower: string;
  /** 한 대의 ROVEN이 같은 고객의 여러 정원을 맡을 수 있다. */
  deviceId: string | null;
  registered: string;
  status: GardenStatus;
  lastWork: string | null;
  /** 최근 7일 작업 실패 횟수 */
  failures: number;
};

export type DeviceState = "idle" | "working" | "charging" | "fault";

export type Device = {
  id: string;
  serial: string;
  firmware: string;
  online: boolean;
  state: DeviceState;
  battery: number;
  water: number;
  lastSeen: string;
  registered: string;
  /** 작업 중일 때 작업하는 정원 */
  activeGardenId: string | null;
};

export type WorkRecord = {
  id: number;
  gardenId: string;
  deviceId: string;
  date: string;
  time: string;
  minutes: number;
  water: number;
  complete: boolean;
};

/** 운영자 화면에 필요한 내 정원·장비·기록. */
export type OperatorDashboard = {
  user: User;
  gardens: Garden[];
  devices: Device[];
  records: WorkRecord[];
  /** 관리자가 운영 화면을 볼 때만 있다. 보고 있는 고객과 고를 수 있는 고객 목록. */
  viewAs?: {
    customerId: string;
    customers: { id: string; name: string }[];
  };
};

/** 관리자 화면에 필요한 전체 데이터. customers 는 운영자 계정만 담는다. */
export type AdminSnapshot = {
  /** 관리자 계정. 계정 관리 목록에 함께 보여 준다. */
  admins: User[];
  customers: User[];
  gardens: Garden[];
  devices: Device[];
};

export type NewGarden = GardenGeometry &
  Pick<Garden, "name" | "address" | "flower" | "area"> & {
    /** 실제 서버에 등록할 때의 위경도 위치와 경계 */
    geo?: GardenGeo;
  };

/** 주소 검색 결과 한 건. 좌표는 WGS84다. */
export type AddressResult = {
  title: string;
  address: string;
  lat: number;
  lng: number;
};

/** 관리자가 고객의 정원을 등록할 때. 장비는 등록하면서 바로 배정할 수 있다. */
export type AdminNewGarden = NewGarden &
  Pick<Garden, "customerId" | "deviceId">;

/**
 * 새 계정. 비밀번호와 역할은 실제 서버에서만 받는다.
 * 가상 서버는 운영자로 만들고 시연용 기본 비밀번호를 쓴다.
 */
export type NewCustomer = Pick<User, "name" | "email" | "phone"> & {
  password?: string;
  role?: Role;
};

export type FinishWork = {
  gardenId: string;
  minutes: number;
  water: number;
  complete: boolean;
};

/** 서버가 거절했거나 처리하지 못한 요청. status 는 HTTP 상태 코드다. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
