import type {
  Mission,
  PointResult,
  PointStatus,
  RunDetail,
} from "../types/control";
import type { Zone } from "../types/dashboard";

/**
 * 화면 시연용 예시 값. 지점 이름·60초·보고 주기는 확정 사양이 아니다.
 * 관수 기준은 D04, 좌표는 D01·D02, 보고 주기는 D07 협의 뒤 바꾼다.
 */

export const EXAMPLE_SECONDS = 60;
/** 장비 상태 보고 주기(ms) 예시 */
export const REPORT_INTERVAL = 2000;
/** 보고 1회마다 늘어나는 관수 누적(초). 시연을 위해 실제보다 빠르게 둔다. */
export const WATER_PER_REPORT = 15;
/** 마지막 보고 후 이 시간이 지나면 오래된 값으로 본다(ms) */
export const STALE_AFTER = 6000;
/** 명령 응답을 기다리는 시간(ms). 지나면 응답 미수신으로 표시한다. */
export const COMMAND_TIMEOUT = 4000;

const POINT_NAMES = [
  "구역 입구",
  "중앙 화단",
  "남측 화단",
  "서측 화단",
  "출구 화단",
  "동측 화단",
  "북측 화단",
];

export const pointName = (i: number) => POINT_NAMES[i] ?? `지점 ${i + 1}`;

/** 정원의 예시 경로에서 지점 다섯 곳을 뽑아 저장된 미션(v3)을 만든다. */
export function exampleMission(garden: Zone): Mission {
  const points = garden.route.slice(0, 5).map(([x, y], i) => ({
    id: `${garden.id}-P${i + 1}`,
    name: pointName(i),
    seconds: EXAMPLE_SECONDS,
    x,
    y,
  }));
  return {
    id: `M-${garden.id}`,
    gardenId: garden.id,
    name: `${garden.name} 오전 관수`,
    version: 3,
    points,
    endPolicy: "stay",
    state: "saved",
  };
}

function results(mission: Mission, statuses: PointStatus[]): PointResult[] {
  return mission.points.map((p, i) => {
    const status = statuses[i] ?? "waiting";
    return {
      pointId: p.id,
      name: p.name,
      planned: p.seconds,
      watered: status === "done" ? p.seconds : status === "partial" ? 40 : 0,
      status,
    };
  });
}

/** 처음부터 진행 중인 회차를 보여 줄 때의 지점 결과 (5곳 중 2곳 완료, 3번 관수 중) */
export function exampleRunPoints(mission: Mission): PointResult[] {
  const points = results(mission, ["done", "done", "watering"]);
  if (points[2]) points[2].watered = 30;
  return points;
}

/** 시드 이력(가상 서버의 기록 1~3번)에 붙이는 회차 상세 */
export function seedRunDetails(gardens: Zone[]): Record<number, RunDetail> {
  const byId = (id: string) => gardens.find((g) => g.id === id);
  const make = (
    recordId: number,
    gardenId: string,
    runId: string,
    statuses: PointStatus[],
    endReason: RunDetail["endReason"],
  ): [number, RunDetail] | null => {
    const garden = byId(gardenId);
    if (!garden) return null;
    const mission = exampleMission(garden);
    return [
      recordId,
      {
        recordId,
        runId,
        missionName: mission.name,
        missionVersion: mission.version,
        endReason,
        points: results(mission, statuses),
        source: "simulation",
      },
    ];
  };
  const all = Array(5).fill("done") as PointStatus[];
  return Object.fromEntries(
    [
      make(3, "G002", "2026-11-04-02", all, "complete"),
      make(2, "G003", "2026-11-04-01", all, "complete"),
      make(
        1,
        "G001",
        "2026-11-03-01",
        ["done", "done", "partial", "skipped", "skipped"],
        "user",
      ),
    ].filter((x): x is [number, RunDetail] => x !== null),
  );
}

export const POINT_STATUS_LABEL: Record<PointStatus, string> = {
  done: "완료",
  watering: "관수 중",
  waiting: "대기",
  partial: "부분 수행",
  failed: "실패",
  skipped: "미수행",
  unknown: "결과 미수신",
};

export const STAGES = [
  { id: "move", label: "이동" },
  { id: "stop", label: "정차" },
  { id: "water", label: "관수" },
  { id: "next", label: "다음" },
  { id: "end", label: "종료" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** 10:31:10 형식 (KST 화면 표시) */
export function clockOf(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 초를 "2분 30초" 형식으로 */
export function durationOf(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? (s ? `${m}분 ${s}초` : `${m}분`) : `${s}초`;
}

/** 마지막 보고 후 지난 시간 */
export function agoOf(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  return s < 60 ? `${s}초 전` : `${Math.floor(s / 60)}분 전`;
}
