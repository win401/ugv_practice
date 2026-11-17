/**
 * 관수 미션·회차·명령·장비 보고 화면 모델. 기능명세서 V2.1의 용어를 따른다.
 * 지금은 브라우저 안 시뮬레이션이 채우고, 백엔드 연동 때 API 타입으로 옮긴다.
 */

/** 회차의 실행 단계 (화면 01) */
export type RunStage = "move" | "stop" | "water" | "next" | "end";

/** 지점별 결과. 미확인(unknown)은 완료·미수행·0으로 바꾸지 않는다. */
export type PointStatus =
  | "done"
  | "watering"
  | "waiting"
  | "partial"
  | "failed"
  | "skipped"
  | "unknown";

export type MissionPoint = {
  /** 지점을 옮기거나 순서를 바꿔도 유지되는 ID */
  id: string;
  name: string;
  /** 관수 시간(초). 양의 정수. 실제 기준은 D04 협의. */
  seconds: number;
  /** 지도 표시 위치. 장비로 보내는 좌표가 아니다(F-108, D02 협의). */
  x: number;
  y: number;
};

/** 종료 정책. null 이면 미정이라 실행할 수 없다 (D09). */
export type EndPolicy = "stay" | "return" | null;

/** 저장 → 검증 → 장비 수락 단계 (화면 02) */
export type MissionState =
  | "saved"
  | "verifying"
  | "awaiting"
  | "accepted"
  | "rejected"
  | "noResponse";

export type Mission = {
  id: string;
  gardenId: string;
  name: string;
  version: number;
  points: MissionPoint[];
  endPolicy: EndPolicy;
  state: MissionState;
  /** 거부·무응답 사유 */
  reason?: string;
};

export type PointResult = {
  pointId: string;
  name: string;
  /** 계획 관수 시간(초) */
  planned: number;
  /** 장비가 확정한 관수 누적(초) */
  watered: number;
  status: PointStatus;
};

/** 정상 경로 밖에서 회차를 멈춘 이유 */
export type RunHalt = "paused" | "estop" | "lost" | "fault" | null;

export type EndReason = "complete" | "user" | "remote";

export type PumpState = "on" | "off" | null;

/** 시연용 이미지 좌표에서의 이동 시간. 실제 장비 속도·주행 명령이 아니다. */
export type RunMovement = {
  from: [number, number];
  to: [number, number];
  elapsedMs: number;
  durationMs: number;
  /** null이면 정지된 구간이다. 재개 시 누적 시간부터 이어간다. */
  startedAt: number | null;
};

export type Run = {
  /** 회차 ID. 예: 2026-11-04-01 */
  id: string;
  missionId: string;
  missionName: string;
  missionVersion: number;
  gardenId: string;
  deviceId: string;
  stage: RunStage;
  /** 진행 중인 지점의 순서(0부터) */
  current: number;
  points: PointResult[];
  /** 실행 당시 지점 위치(고정본). 미션을 고쳐도 바뀌지 않는다. */
  route: number[][];
  /** 가상 장비가 다음 보고에서 이동을 계산할 때 사용하는 구간 시간. */
  movement?: RunMovement;
  /** 마지막 이동 보고로 확정된 지도 경로 진행률(0~100). */
  reportedProgress?: number;
  halt: RunHalt;
  /** 통신 상실 뒤 보고 수신이 다시 시작되었는지. 재개와는 별개다. */
  reconnected: boolean;
  pump: { requested: PumpState; confirmed: PumpState };
  startedAt: number;
  endedAt: number | null;
  endReason: EndReason | null;
  source: "simulation" | "device";
};

export type CommandKind = "pause" | "resume" | "end" | "estop";

/** 요청 기록 → 장비 수신(ACK) → 장비 확인. ACK 는 수행 완료가 아니다. */
export type CommandStatus =
  | "requested"
  | "acked"
  | "confirmed"
  | "rejected"
  | "timeout";

export type Command = {
  id: string;
  kind: CommandKind;
  status: CommandStatus;
  requestedAt: number;
  updatedAt: number;
};

/** 장비 보고의 신선도 (F-402) */
export type Freshness = "current" | "stale" | "lost" | "none";

export type Positioning = "ok" | "degraded" | "none" | "stale";

/** 회차 이력 상세. 백엔드 연동 전에는 이 브라우저에 저장한다. */
export type RunDetail = {
  recordId: number;
  runId: string;
  missionName: string;
  missionVersion: number;
  endReason: EndReason;
  points: PointResult[];
  source: "simulation" | "device";
};

/** 안전·결과 알림 (F-609). 읽음과 해결은 별개다. */
export type ControlEvent = {
  id: string;
  kind: "safety" | "result" | "command";
  title: string;
  detail: string;
  at: number;
  resolved: boolean;
};
