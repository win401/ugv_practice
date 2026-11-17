import type { Device, Garden, GardenGeometry, User, WorkRecord } from "./types";

/**
 * 가상 서버의 시연 데이터. 고객·주소·연락처·비밀번호는 모두 예시다.
 * 모든 정원이 같은 예시 항공사진 위에 그려지므로, 다른 고객의 정원은 세 구역 모양을 나눠 쓴다.
 */

const rose: GardenGeometry = {
  shape:
    "M815 440Q815 425 800 425L660 410Q650 410 640 416L575 465Q565 472 565 485L570 640Q570 655 585 655L675 655Q685 655 692 648L810 535Q815 530 815 520Z",
  label: [689, 449],
  route: [
    [600, 480],
    [775, 480],
    [775, 535],
    [605, 535],
    [600, 595],
    [715, 595],
  ],
};
const flowers: GardenGeometry = {
  shape:
    "M265 215L150 222Q138 224 140 238L155 390L200 535Q210 545 225 535L280 440Q288 425 284 410L280 230Q280 215 265 215Z",
  label: [144, 214],
  route: [
    [260, 290],
    [260, 420],
    [215, 495],
    [210, 370],
    [210, 255],
    [165, 255],
    [175, 375],
  ],
};
const lawn: GardenGeometry = {
  shape:
    "M415 115Q415 105 400 102L230 88Q215 88 218 105Q225 140 238 165Q280 195 284 240L284 320L310 330Q340 250 400 215Q430 195 425 170Z",
  label: [296, 96],
  route: [
    [390, 160],
    [255, 150],
    [275, 190],
    [370, 195],
    [305, 250],
    [300, 315],
  ],
};

export type DemoDb = {
  users: User[];
  /** 사용자 id → 비밀번호. 가상 서버에서만 쓰며 응답에 담지 않는다. */
  passwords: Record<string, string>;
  gardens: Garden[];
  devices: Device[];
  records: WorkRecord[];
};

/** 관리자가 새로 만든 고객 계정의 첫 비밀번호 */
export const DEFAULT_PASSWORD = "demo1234";

/** 로그인 화면에 보여 줄 시연 계정 */
export const demoAccounts = [
  {
    label: "관리자 (개발자)",
    email: "admin@saemgil.dev",
    password: "admin1234",
  },
  {
    label: "운영자 · 김정원",
    email: "garden.kim@example.com",
    password: DEFAULT_PASSWORD,
  },
];

export function createSeed(): DemoDb {
  const users: User[] = [
    {
      id: "A001",
      role: "admin",
      name: "관리자",
      email: "admin@saemgil.dev",
      phone: "-",
      joined: "2026.08.01",
      status: "active",
    },
    {
      id: "C001",
      role: "operator",
      name: "김정원",
      email: "garden.kim@example.com",
      phone: "010-0000-1001",
      joined: "2026.09.02",
      status: "active",
    },
  ];
  const passwords = Object.fromEntries(
    users.map((u) => [
      u.id,
      u.role === "admin" ? "admin1234" : DEFAULT_PASSWORD,
    ]),
  );

  const gardens: Garden[] = [
    // 관리자(개발자)가 시험용으로 쓰는 가상 정원. 장비는 김정원 고객이 쓰고 있어 배정하지 않았다.
    {
      ...flowers,
      id: "G004",
      name: "시험 정원 A",
      customerId: "A001",
      region: "서울 강남구",
      address: "서울특별시 강남구 · 예시 주소",
      area: 150,
      flower: "허브 · 초화류",
      deviceId: null,
      registered: "2026.08.01",
      status: "active",
      lastWork: null,
      failures: 0,
    },
    {
      ...lawn,
      id: "G005",
      name: "시험 정원 B",
      customerId: "A001",
      region: "서울 강남구",
      address: "서울특별시 강남구 · 예시 주소",
      area: 210,
      flower: "잔디 · 관목",
      deviceId: null,
      registered: "2026.08.01",
      status: "active",
      lastWork: null,
      failures: 0,
    },
    {
      ...rose,
      id: "G001",
      name: "장미 정원",
      customerId: "C001",
      region: "서울 성동구",
      address: "서울특별시 성동구 · 예시 주소",
      area: 240,
      flower: "장미 · 수국",
      deviceId: "ROVEN-01",
      registered: "2026.09.02",
      status: "active",
      lastWork: "2026.11.03 16:40",
      failures: 1,
    },
    {
      ...flowers,
      id: "G002",
      name: "초화 정원",
      customerId: "C001",
      region: "서울 성동구",
      address: "서울특별시 성동구 · 예시 주소",
      area: 180,
      flower: "라벤더 · 초화류",
      deviceId: "ROVEN-01",
      registered: "2026.09.02",
      status: "active",
      lastWork: "2026.11.04 09:20",
      failures: 0,
    },
    {
      ...lawn,
      id: "G003",
      name: "잔디 정원",
      customerId: "C001",
      region: "서울 성동구",
      address: "서울특별시 성동구 · 예시 주소",
      area: 320,
      flower: "잔디 · 조경수",
      deviceId: "ROVEN-01",
      registered: "2026.09.03",
      status: "active",
      lastWork: "2026.11.04 08:30",
      failures: 0,
    },
  ];

  const devices: Device[] = [
    {
      id: "ROVEN-01",
      serial: "RV-2609-0001",
      firmware: "1.4.2",
      online: true,
      // 고객 화면은 장미 정원 관수가 진행 중인 장면으로 시작한다.
      state: "working",
      battery: 82,
      water: 64,
      lastSeen: "2026.11.10 14:32",
      registered: "2026.08.28",
      activeGardenId: "G001",
    },
  ];

  const records: WorkRecord[] = [
    {
      id: 3,
      gardenId: "G002",
      deviceId: "ROVEN-01",
      date: "2026.11.04",
      time: "09:20",
      minutes: 18,
      water: 36,
      complete: true,
    },
    {
      id: 2,
      gardenId: "G003",
      deviceId: "ROVEN-01",
      date: "2026.11.04",
      time: "08:30",
      minutes: 26,
      water: 52,
      complete: true,
    },
    {
      id: 1,
      gardenId: "G001",
      deviceId: "ROVEN-01",
      date: "2026.11.03",
      time: "16:40",
      minutes: 7,
      water: 14,
      complete: false,
    },
  ];

  return { users, passwords, gardens, devices, records };
}
