import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { DEMO_DATE } from "../api/time";
import type { Device, OperatorDashboard } from "../api/types";
import { errorMessage } from "../api/useApiData";
import {
  COMMAND_TIMEOUT,
  REPORT_INTERVAL,
  STALE_AFTER,
  WATER_PER_REPORT,
  exampleMission,
  exampleRunPoints,
  seedRunDetails,
} from "../data/controlExample";
import type {
  Command,
  CommandKind,
  ControlEvent,
  EndReason,
  Freshness,
  Mission,
  MissionPoint,
  EndPolicy,
  Positioning,
  Run,
  RunDetail,
} from "../types/control";
import type { Mode, RecordItem, Zone } from "../types/dashboard";
import {
  createRunMovement,
  freezeRunMovement,
  movementElapsed,
  resumeRunMovement,
  runMapProgress,
} from "../lib/runMovement";

const letterAt = (i: number) =>
  i < 26 ? String.fromCharCode(65 + i) : String(i + 1);

const DETAILS_KEY = "saemgil-run-details-v1";

function loadDetails(): Record<number, RunDetail> {
  try {
    return JSON.parse(localStorage.getItem(DETAILS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveDetails(details: Record<number, RunDetail>) {
  try {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
  } catch {
    // 저장할 수 없어도 화면은 동작한다.
  }
}

type Ctl = { run: Run | null; command: Command | null };

const pending = (c: Command | null) =>
  !!c && (c.status === "requested" || c.status === "acked");

function newRun(
  mission: Mission,
  deviceId: string,
  id: string,
  midway = false,
): Run {
  const t = Date.now();
  const route = mission.points.map((p) => [p.x, p.y]);
  const current = midway ? Math.min(2, Math.max(0, route.length - 1)) : 0;
  return {
    id,
    missionId: mission.id,
    missionName: mission.name,
    missionVersion: mission.version,
    gardenId: mission.gardenId,
    deviceId,
    stage: midway ? "water" : "move",
    current,
    points: midway
      ? exampleRunPoints(mission).map((p, i) =>
          i === current
            ? { ...p, status: "watering", watered: Math.min(p.planned, 30) }
            : p,
        )
      : mission.points.map((p) => ({
          pointId: p.id,
          name: p.name,
          planned: p.seconds,
          watered: 0,
          status: "waiting",
        })),
    route,
    movement: midway ? undefined : createRunMovement(route, current, t),
    halt: null,
    reconnected: false,
    pump: midway
      ? { requested: "on", confirmed: "on" }
      : { requested: null, confirmed: null },
    startedAt: midway ? t - 4 * 60 * 1000 : t,
    endedAt: null,
    endReason: null,
    source: "simulation",
  };
}

/** 회차를 끝낸다. 수행을 모르는 지점은 미확인으로 남긴다. */
function finalize(run: Run, reason: EndReason, t: number): Run {
  // 통신이 끊긴 뒤 보고를 다시 받지 못했다면 장비가 무엇을 했는지 알 수 없다.
  const unknown = run.halt === "lost" && !run.reconnected;
  return {
    ...run,
    stage: "end",
    movement: freezeRunMovement(run.movement, t),
    endedAt: t,
    endReason: reason,
    pump: { requested: "off", confirmed: unknown ? null : "off" },
    points: run.points.map((p, i) => {
      if (p.status === "done") return p;
      if (reason === "complete") return { ...p, status: "done" };
      if (unknown) return { ...p, status: "unknown" };
      if (i === run.current && p.watered > 0)
        return { ...p, status: "partial" };
      return { ...p, status: "skipped" };
    }),
  };
}

/** 장비 보고 1회만큼 회차를 진행한다. 화면 타이머가 아니라 보고로만 바뀐다. */
function advance(run: Run, t: number): Run {
  const points = run.points.map((p) => ({ ...p }));
  const p = points[run.current];
  if (!p) return finalize(run, "complete", t);
  switch (run.stage) {
    case "move": {
      const movement =
        run.movement ?? createRunMovement(run.route, run.current, t);
      if (movementElapsed(movement, t) < movement.durationMs)
        return run.movement ? run : { ...run, movement };
      return {
        ...run,
        stage: "stop",
        movement: freezeRunMovement(movement, t),
      };
    }
    case "stop":
      p.status = "watering";
      return {
        ...run,
        stage: "water",
        points,
        pump: { requested: "on", confirmed: null },
      };
    case "water":
      if (run.pump.confirmed !== "on")
        return { ...run, pump: { requested: "on", confirmed: "on" } };
      p.status = "watering";
      p.watered = Math.min(p.planned, p.watered + WATER_PER_REPORT);
      if (p.watered >= p.planned) {
        p.status = "done";
        return {
          ...run,
          points,
          stage: "next",
          pump: { requested: "off", confirmed: "on" },
        };
      }
      return { ...run, points };
    case "next": {
      // 펌프 OFF 확인 뒤에만 다음 지점으로 이동한다.
      const off = {
        ...run,
        pump: { requested: "off" as const, confirmed: "off" as const },
      };
      if (run.current + 1 < run.points.length) {
        const current = run.current + 1;
        return {
          ...off,
          current,
          stage: "move",
          movement: createRunMovement(run.route, current, t),
        };
      }
      return finalize(off, "complete", t);
    }
    default:
      return run;
  }
}

function applyCommand(run: Run | null, kind: CommandKind, t: number) {
  if (!run || run.endedAt) return run;
  switch (kind) {
    case "pause":
      return {
        ...run,
        halt: "paused" as const,
        movement: freezeRunMovement(run.movement, t),
        pump: { requested: "off" as const, confirmed: "off" as const },
      };
    case "resume":
      return {
        ...run,
        halt: null,
        movement:
          run.stage === "move"
            ? resumeRunMovement(run.movement, t)
            : run.movement,
      };
    case "estop":
      return {
        ...run,
        halt: "estop" as const,
        movement: freezeRunMovement(run.movement, t),
        pump: { requested: "off" as const, confirmed: "off" as const },
      };
    case "end":
      return finalize(run, "user", t);
  }
}

function onReport(s: Ctl, t: number): Ctl {
  const { command } = s;
  if (command && pending(command)) {
    if (command.status === "requested")
      return { ...s, command: { ...command, status: "acked", updatedAt: t } };
    return {
      run: applyCommand(s.run, command.kind, t),
      command: { ...command, status: "confirmed", updatedAt: t },
    };
  }
  const run = s.run;
  if (!run || run.endedAt) return s;
  if (run.halt === "lost") return { ...s, run: { ...run, reconnected: true } };
  if (run.halt) return s;
  const next = advance(run, t);
  return { ...s, run: { ...next, reportedProgress: runMapProgress(next, t) } };
}

/**
 * 고객 화면의 관수 관제 시뮬레이션.
 * 정원·장비·이력은 API에서 받고, 회차 진행·명령 확인·장비 보고는 브라우저 안에서 흉내 낸다.
 * 단계·관수 누적·완료는 장비 보고(예시 주기 2초)로 바뀌고,
 * 지도 위치도 보고를 받을 때 갱신한다.
 */
export function useIrrigationSimulation(
  zone: string,
  data: OperatorDashboard,
  reload: () => void = () => {},
) {
  const gardens: Zone[] = useMemo(
    () =>
      data.gardens.map((g, i) => ({
        id: g.id,
        letter: letterAt(i),
        name: g.name,
        area: g.area,
        flower: g.flower,
        address: g.address,
        color: "#52525b",
        status: g.status,
        deviceId: g.deviceId,
        shape: g.shape,
        label: g.label,
        route: g.route,
      })),
    [data.gardens],
  );
  const records: RecordItem[] = useMemo(
    () =>
      data.records.map((r) => ({
        ...r,
        zone: gardens.find((g) => g.id === r.gardenId)?.name ?? "-",
      })),
    [data.records, gardens],
  );
  const working = data.devices.find(
    (v) =>
      v.state === "working" && gardens.some((g) => g.id === v.activeGardenId),
  );

  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [missions, setMissions] = useState<Record<string, Mission>>({});
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [details, setDetails] = useState<Record<number, RunDetail>>(() => ({
    ...seedRunDetails(gardens),
    ...loadDetails(),
  }));
  const [lastReport, setLastReport] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState("");
  const seq = useRef(0);

  const missionOf = (gardenId: string): Mission | null => {
    if (missions[gardenId]) return missions[gardenId];
    const g = gardens.find((x) => x.id === gardenId);
    return g ? exampleMission(g) : null;
  };
  // 회차 ID 는 재실행마다 새로 붙이고, 이 화면에서 쓴 번호를 다시 쓰지 않는다.
  const todayCount = data.records.filter((r) => r.date === DEMO_DATE).length;
  const runIdOf = (n: number) =>
    `${DEMO_DATE.replace(/\./g, "-")}-${String(n).padStart(2, "0")}`;
  // 처음부터 진행 중인 회차가 있으면 그 회차가 오늘 번호 하나를 쓴다.
  const lastRunSeq = useRef(working ? todayCount + 1 : 0);
  const nextRunId = () => {
    lastRunSeq.current = Math.max(todayCount, lastRunSeq.current) + 1;
    return runIdOf(lastRunSeq.current);
  };

  const [ctl, setCtl] = useState<Ctl>(() => {
    if (!working) return { run: null, command: null };
    const g = gardens.find((x) => x.id === working.activeGardenId)!;
    return {
      run: newRun(exampleMission(g), working.id, runIdOf(todayCount + 1), true),
      command: null,
    };
  });
  const { run, command } = ctl;
  const activeRun = run && !run.endedAt ? run : null;

  const selected = gardens.find((g) => g.id === zone) ?? gardens[0]!;
  const active = gardens.find((g) => g.id === run?.gardenId) ?? selected;
  const findDevice = (id: string | null | undefined): Device | null =>
    data.devices.find((v) => v.id === id) ?? null;
  /** 선택한 정원을 맡은 장비 */
  const device = findDevice(selected.deviceId);
  /** 진행 중인 회차의 장비. 회차가 없으면 선택한 정원의 장비 */
  const jobDevice = activeRun ? findDevice(activeRun.deviceId) : device;
  const liveOnline = !!jobDevice?.online;
  const liveFault = jobDevice?.state === "fault";

  // 화면의 "n초 전" 표시와 명령 응답 대기 시간을 위한 시계
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 장비 상태 보고 수신 (예시 주기). 연결이 끊기면 보고가 오지 않는다.
  useEffect(() => {
    if (!jobDevice || !liveOnline) return;
    const report = () => {
      const t = Date.now();
      setLastReport(t);
      setCtl((s) => onReport(s, t));
    };
    report();
    const timer = window.setInterval(report, REPORT_INTERVAL);
    return () => window.clearInterval(timer);
  }, [jobDevice?.id, liveOnline]);

  function pushEvent(e: Omit<ControlEvent, "id" | "at" | "resolved">) {
    setEvents((list) => [
      {
        ...e,
        id: `E${Date.now()}${list.length}`,
        at: Date.now(),
        resolved: false,
      },
      ...list,
    ]);
  }

  // 응답이 오지 않는 명령은 시간이 지나면 응답 미수신으로 표시한다. 미실행을 뜻하지 않는다.
  useEffect(() => {
    if (!command || !pending(command) || liveOnline) return;
    if (now - command.requestedAt < COMMAND_TIMEOUT) return;
    setCtl((s) =>
      s.command?.id === command.id
        ? { ...s, command: { ...command, status: "timeout", updatedAt: now } }
        : s,
    );
    pushEvent({
      kind: "command",
      title: `${COMMAND_LABEL[command.kind]} 응답 미수신`,
      detail: "장비 응답이 없습니다. 실제 수행 여부는 확인되지 않았습니다.",
    });
  }, [now, command, liveOnline]);

  // 통신 상실·장비 이상을 회차에 반영한다. 복구되어도 자동 재개하지 않는다.
  const activeId = activeRun?.id;
  useEffect(() => {
    if (!activeRun) return;
    if (
      !liveOnline &&
      activeRun.halt !== "lost" &&
      activeRun.halt !== "estop"
    ) {
      setCtl((s) =>
        s.run && !s.run.endedAt
          ? {
              ...s,
              run: {
                ...s.run,
                halt: "lost",
                reconnected: false,
                movement: freezeRunMovement(s.run.movement, Date.now()),
              },
            }
          : s,
      );
      setDismissed("");
      pushEvent({
        kind: "safety",
        title: `${activeRun.deviceId} 통신 끊김`,
        detail: "실제 주행·펌프 정지 여부는 확인되지 않았습니다.",
      });
    } else if (
      liveFault &&
      activeRun.halt !== "fault" &&
      activeRun.halt !== "estop"
    ) {
      setCtl((s) =>
        s.run && !s.run.endedAt
          ? {
              ...s,
              run: {
                ...s.run,
                halt: "fault",
                movement: freezeRunMovement(s.run.movement, Date.now()),
              },
            }
          : s,
      );
      setDismissed("");
      pushEvent({
        kind: "safety",
        title: `${activeRun.deviceId} 장비 이상`,
        detail: "장비가 이상 상태를 보고했습니다. 현장 확인이 필요합니다.",
      });
    }
  }, [liveOnline, liveFault, activeId]);

  // 다른 곳(관리자 화면)에서 장비 작업을 시작하거나 멈추면 따라간다.
  const ctlRef = useRef(ctl);
  ctlRef.current = ctl;
  const starting = useRef(false);
  const workingKey = working ? `${working.id}:${working.activeGardenId}` : "";
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    if (starting.current) return;
    const current = ctlRef.current.run;
    const live = current && !current.endedAt ? current : null;
    if (working) {
      if (live) return;
      const mission = missionOf(working.activeGardenId!);
      if (!mission) return;
      setCtl({ run: newRun(mission, working.id, nextRunId()), command: null });
      setToast("장비가 관수 작업을 시작했습니다.");
    } else if (live && !live.halt && liveOnline && !liveFault) {
      setCtl((s) =>
        s.run && !s.run.endedAt
          ? { ...s, run: finalize(s.run, "remote", Date.now()) }
          : s,
      );
      setToast("장비 작업이 중지되었습니다.");
    }
  }, [workingKey]);

  // 회차가 끝나면 이력을 한 번만 남긴다.
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (!run?.endedAt || recorded.current.has(run.id)) return;
    recorded.current.add(run.id);
    setEvents((list) =>
      list.map((e) => (e.kind === "safety" ? { ...e, resolved: true } : e)),
    );
    // 정상 완료·사용자 종료·장비 쪽 중지 모두 회차 이력으로 남긴다 (F-501).
    const watered = run.points.reduce((s, p) => s + p.watered, 0);
    const complete = run.endReason === "complete";
    pushEvent({
      kind: "result",
      title: `${active.name} ${complete ? "관수 완료" : "작업 종료"}`,
      detail: `회차 ${run.id} · 완료 ${run.points.filter((p) => p.status === "done").length}/${run.points.length} 지점`,
    });
    if (run.endReason !== "remote")
      setToast(complete ? "관수 회차를 완료했습니다." : "회차를 종료했습니다.");
    const ended = run;
    api.operator
      .finishWork({
        gardenId: ended.gardenId,
        minutes: Math.max(
          1,
          Math.ceil((ended.endedAt! - ended.startedAt) / 60000),
        ),
        // 물 사용량은 측정 미지원이라 화면에 쓰지 않는다. 가상 서버 기록 형식만 맞춘다.
        water: Math.round(watered / 30),
        complete,
      })
      .then(
        (record) =>
          setDetails((d) => {
            const next = {
              ...d,
              [record.id]: {
                recordId: record.id,
                runId: ended.id,
                missionName: ended.missionName,
                missionVersion: ended.missionVersion,
                endReason: ended.endReason!,
                points: ended.points,
                source: ended.source,
              },
            };
            saveDetails(next);
            return next;
          }),
        (e) => setToast(errorMessage(e)),
      );
  }, [run?.endedAt]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ── 미션 (화면 02) ─────────────────────────────

  const setMission = (gardenId: string, patch: Partial<Mission>) =>
    setMissions((m) => {
      const base = m[gardenId] ?? missionOf(gardenId);
      return base ? { ...m, [gardenId]: { ...base, ...patch } } : m;
    });

  function saveMission(
    gardenId: string,
    draft: { name: string; points: MissionPoint[]; endPolicy: EndPolicy },
  ) {
    const base = missionOf(gardenId);
    if (!base) return;
    setMission(gardenId, {
      ...draft,
      version: base.version + 1,
      state: "saved",
      reason: undefined,
    });
    setToast(
      `미션 v${base.version + 1}을 저장했습니다. 장비로 전송하지 않았습니다.`,
    );
  }

  const latest = useRef(data);
  latest.current = data;
  /** 검증 → 준비 회차 → 장비 수락 확인. 거부·무응답이면 실행할 수 없다. */
  function verifyMission(gardenId: string) {
    setMission(gardenId, { state: "verifying", reason: undefined });
    window.setTimeout(() => {
      const d = latest.current;
      const g = d.gardens.find((x) => x.id === gardenId);
      const v = d.devices.find((x) => x.id === g?.deviceId);
      const busyRun = ctlRef.current.run && !ctlRef.current.run.endedAt;
      const reason =
        !g || g.status !== "active"
          ? "관리자 승인 전인 정원입니다."
          : !v
            ? "배정된 장비가 없습니다."
            : busyRun
              ? "장비에 끝나지 않은 회차가 있습니다."
              : v.state === "fault"
                ? "장비 이상 상태라 미션을 받을 수 없습니다."
                : null;
      if (reason) return setMission(gardenId, { state: "rejected", reason });
      setMission(gardenId, { state: "awaiting" });
      window.setTimeout(() => {
        const dv = latest.current.devices.find((x) => x.id === v!.id);
        if (!dv?.online)
          return setMission(gardenId, {
            state: "noResponse",
            reason: "장비 응답이 없습니다. 연결 상태를 확인하세요.",
          });
        setMission(gardenId, { state: "accepted" });
      }, 1200);
    }, 900);
  }

  /** START 를 보내기 전인 준비 회차를 취소한다. */
  function cancelPrepared(gardenId: string) {
    setMission(gardenId, { state: "saved", reason: undefined });
    setToast("준비 회차를 취소했습니다. 장비로 실행 명령을 보내지 않았습니다.");
  }

  /** 수락된 미션으로 회차를 시작한다. 성공하면 true. */
  async function startRun(gardenId: string) {
    const mission = missionOf(gardenId);
    if (!mission || mission.state !== "accepted" || activeRun) return false;
    const g = gardens.find((x) => x.id === gardenId);
    starting.current = true;
    try {
      await api.operator.startWork(gardenId);
      setCtl({
        run: newRun(mission, g!.deviceId!, nextRunId()),
        command: null,
      });
      // 수락은 준비 회차 1개에만 유효하다. 다음 실행은 다시 검증한다.
      setMission(gardenId, { state: "saved" });
      setToast(`${mission.name} 회차를 시작했습니다.`);
      return true;
    } catch (e) {
      setToast(errorMessage(e));
      return false;
    } finally {
      starting.current = false;
    }
  }

  // ── 조작 명령 (화면 01·05) ─────────────────────

  function issue(kind: CommandKind) {
    if (!activeRun) return;
    if (pending(command) && !(kind === "estop" && command!.kind !== "estop")) {
      setToast("이전 요청을 처리하는 중입니다.");
      return;
    }
    const t = Date.now();
    seq.current += 1;
    setCtl((s) => ({
      run:
        kind === "estop" && s.run
          ? { ...s.run, pump: { ...s.run.pump, requested: "off" } }
          : s.run,
      command: {
        id: `CMD-${seq.current}`,
        kind,
        status: "requested",
        requestedAt: t,
        updatedAt: t,
      },
    }));
    if (kind === "estop") {
      setDismissed("");
      pushEvent({
        kind: "safety",
        title: "비상정지 요청",
        detail: `${activeRun.deviceId} · 회차 ${activeRun.id}`,
      });
    }
  }

  function refresh() {
    reload();
    setToast("최신 상태를 다시 조회했습니다. 장비로 명령을 보내지 않았습니다.");
  }

  // ── 화면 표시 값 ───────────────────────────────

  const freshness: Freshness = !jobDevice
    ? "none"
    : !jobDevice.online
      ? "lost"
      : lastReport === null
        ? "none"
        : now - lastReport > STALE_AFTER
          ? "stale"
          : "current";
  const positioning: Positioning =
    freshness === "current" ? "ok" : freshness === "stale" ? "stale" : "none";

  const alertKind =
    activeRun &&
    (activeRun.halt === "estop" ||
      activeRun.halt === "lost" ||
      activeRun.halt === "fault")
      ? activeRun.halt
      : activeRun && command?.kind === "estop" && command.status !== "confirmed"
        ? "estop"
        : null;
  const alertKey = alertKind && activeRun ? `${activeRun.id}:${alertKind}` : "";
  const alert = alertKind && dismissed !== alertKey ? alertKind : null;

  const mission = missionOf(selected.id)!;
  const checks = [
    {
      label: "정원 승인·장비 배정",
      ok: selected.status === "active" && !!device,
    },
    {
      label: `미션 v${mission.version} 수락`,
      ok: mission.state === "accepted",
    },
    { label: "최신 상태 수신", ok: freshness === "current" },
    { label: "진행 중인 회차 없음", ok: !activeRun },
    {
      label: "안전정지 해제",
      ok: device?.state !== "fault" && activeRun?.halt !== "estop",
    },
  ];

  const n = run?.points.length ?? 0;
  const doneCount = run?.points.filter((p) => p.status === "done").length ?? 0;
  /** 완료 지점 ÷ 계획 지점 × 100, 소수점 버림 */
  const progress = n ? Math.floor((doneCount / n) * 100) : 0;
  const mapProgress =
    run?.reportedProgress ?? runMapProgress(run, run?.startedAt ?? 0);

  const mode: Mode = activeRun
    ? activeRun.halt
      ? "paused"
      : "running"
    : run?.endReason === "complete"
      ? "done"
      : "ready";
  const status = activeRun
    ? (HALT_LABEL[activeRun.halt ?? ""] ??
      STAGE_STATUS[activeRun.stage] ??
      "관수 중")
    : run?.endedAt
      ? run.endReason === "complete"
        ? "작업 완료"
        : "작업 종료"
      : "작업 대기";

  return {
    user: data.user,
    gardens,
    selected,
    active,
    activeZone: active.id,
    device,
    jobDevice,
    busy: !!activeRun,
    mode,
    status,
    progress,
    mapProgress,
    doneCount,
    records,
    details,
    toast,
    setToast,
    now,
    run,
    activeRun,
    command,
    issue,
    refresh,
    lastReport,
    freshness,
    positioning,
    checks,
    alert,
    alertKind,
    dismissAlert: () => setDismissed(alertKey),
    reopenAlert: () => setDismissed(""),
    events,
    missionOf,
    mission,
    saveMission,
    verifyMission,
    cancelPrepared,
    startRun,
  };
}

const HALT_LABEL: Record<string, string> = {
  paused: "일시정지",
  estop: "안전정지",
  lost: "통신 끊김",
  fault: "장비 이상",
};
const STAGE_STATUS: Record<string, string> = {
  move: "이동 중",
  stop: "정차",
  water: "관수 중",
  next: "다음 지점",
  end: "종료 중",
};
export const COMMAND_LABEL: Record<CommandKind, string> = {
  pause: "일시정지",
  resume: "재개",
  end: "작업 종료",
  estop: "비상정지",
};

export type IrrigationSimulation = ReturnType<typeof useIrrigationSimulation>;
