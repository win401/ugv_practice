import { Check, ChevronRight, Leaf, Radio, ShieldAlert } from "lucide-react";
import {
  POINT_STATUS_LABEL,
  STAGES,
  agoOf,
  durationOf,
} from "../data/controlExample";
import {
  COMMAND_LABEL,
  type IrrigationSimulation,
} from "../hooks/useIrrigationSimulation";
import type { Command, PointResult, Run } from "../types/control";

type WorkViewProps = {
  simulation: IrrigationSimulation;
  zone: string;
  chooseZone: (id: string) => void;
  openMission: () => void;
};

const COMMAND_STATUS: Record<Command["status"], string> = {
  requested: "요청 기록 · 장비 확인 대기",
  acked: "장비 수신(ACK) · 수행 확인 대기",
  confirmed: "장비 확인 완료",
  rejected: "장비 거부",
  timeout: "응답 미수신 · 수행 여부 미확인",
};

const END_LABEL = {
  complete: "정상 완료",
  user: "사용자 종료",
  remote: "장비 작업 중지",
} as const;

function pointLabel(run: Run, p: PointResult, i: number) {
  if (!run.endedAt && i === run.current && p.status === "waiting")
    return run.stage === "move" ? "이동 중" : "정차";
  return POINT_STATUS_LABEL[p.status];
}

/** 화면 01 작업 관제 */
export default function WorkView({
  simulation,
  zone,
  chooseZone,
  openMission,
}: WorkViewProps) {
  const {
    gardens,
    selected,
    active,
    run,
    activeRun,
    status,
    mode,
    progress,
    doneCount,
    command,
    lastReport,
    freshness,
    now,
    alertKind,
    alert,
    reopenAlert,
    mission,
  } = simulation;
  const stageIndex = run
    ? run.endedAt
      ? STAGES.length - 1
      : STAGES.findIndex((s) => s.id === run.stage)
    : -1;
  const current = run && !run.endedAt ? run.points[run.current] : null;
  const watered = run?.points.reduce((s, p) => s + p.watered, 0) ?? 0;
  const elapsed = run
    ? Math.floor(((run.endedAt ?? now) - run.startedAt) / 1000)
    : 0;
  return (
    <>
      <div className="section-intro run-intro">
        <div>
          <span className="eyebrow">{run ? active.name : selected.name}</span>
          <h2>{run ? run.missionName : mission.name}</h2>
          <p className="run-meta">
            {run
              ? `실행 회차 ${run.id} · 미션 v${run.missionVersion}`
              : `저장 미션 v${mission.version} · 실행 회차 없음`}
          </p>
        </div>
        <span className={`status-pill ${mode}`}>
          <i />
          {status}
        </span>
      </div>

      {alertKind && !alert && (
        <button className="safety-banner" onClick={reopenAlert}>
          <ShieldAlert size={16} />
          <span>
            <strong>{status} · 안전 상태 확인 필요</strong>
            <small>자동 재개하지 않습니다. 눌러서 안내 보기</small>
          </span>
          <ChevronRight size={15} />
        </button>
      )}

      {run ? (
        <>
          <section className="run-card">
            <div className="run-card-head">
              <h3>
                <span className="num">1</span>현재 실행 단계
              </h3>
              {run.endedAt && (
                <span className="tag muted">{END_LABEL[run.endReason!]}</span>
              )}
            </div>
            <ol className="stage-steps">
              {STAGES.map((s, i) => (
                <li
                  key={s.id}
                  className={
                    i === stageIndex ? "on" : i < stageIndex ? "past" : ""
                  }
                  aria-current={i === stageIndex ? "step" : undefined}
                >
                  {s.label}
                </li>
              ))}
            </ol>
            <div className="run-count">
              <span>완료 지점</span>
              <strong>
                {doneCount} <small>/ {run.points.length}</small>
              </strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="완료 지점 비율"
            >
              <div style={{ width: `${progress}%` }} />
            </div>
            <dl className="run-facts">
              <div>
                <dt>현재 지점</dt>
                <dd>
                  {current
                    ? `${run.current + 1} ${current.name} · ${pointLabel(run, current, run.current)}`
                    : "-"}
                </dd>
              </div>
              <div>
                <dt>경과 시간</dt>
                <dd>{durationOf(elapsed)}</dd>
              </div>
              <div>
                <dt>관수 누적</dt>
                <dd>{durationOf(watered)} · 장비 확정값</dd>
              </div>
            </dl>
          </section>

          <section className="run-card">
            <div className="run-card-head">
              <h3>
                <span className="num">2</span>지점별 결과
              </h3>
              <span className="run-card-sub">{progress}%</span>
            </div>
            <ul className="point-results">
              {run.points.map((p, i) => {
                const label = pointLabel(run, p, i);
                const live = !run.endedAt && i === run.current;
                return (
                  <li key={p.pointId} className={live ? "live" : ""}>
                    <span className="point-num">{i + 1}</span>
                    <span className="point-name">
                      {p.name}
                      <small>
                        {p.watered > 0
                          ? `${durationOf(p.watered)} / ${durationOf(p.planned)}`
                          : `계획 ${durationOf(p.planned)}`}
                      </small>
                    </span>
                    <span
                      className={`tag point-${live && p.status === "waiting" ? "moving" : p.status}`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="report-strip">
            <Radio size={15} />
            <div>
              <strong>
                장비 상태 보고{" "}
                {freshness === "lost"
                  ? "끊김"
                  : lastReport
                    ? `수신 · ${agoOf(lastReport, now)}`
                    : "미수신"}
              </strong>
              <p>
                {command
                  ? `${COMMAND_LABEL[command.kind]} · ${COMMAND_STATUS[command.status]}`
                  : "요청 처리와 실제 장비 확인 상태를 구분합니다."}
              </p>
            </div>
          </div>
        </>
      ) : (
        <section className="run-card run-empty">
          <p>
            진행 중인 회차가 없습니다. 미션을 검증하고 장비 수락을 확인한 뒤
            실행할 수 있습니다.
          </p>
          <button className="secondary-button" onClick={openMission}>
            미션 편집·실행으로 이동
            <ChevronRight size={14} />
          </button>
        </section>
      )}

      <div className="section-label">
        <h3>
          정원 <small>{gardens.length}곳</small>
        </h3>
        {/* 정원 등록은 관리자 페이지(정원 관리)에서 관리자가 한다. */}
        <span>등록·변경은 관리자에게 요청</span>
      </div>
      <div className="zone-list">
        {gardens.map((z) => (
          <button
            key={z.id}
            className={`zone-row ${zone === z.id ? "selected" : ""}`}
            onClick={() => chooseZone(z.id)}
          >
            <span
              className="zone-letter"
              style={{ background: z.color + "22", color: z.color }}
            >
              {z.letter}
            </span>
            <span className="zone-copy">
              <strong>
                {z.name}
                {activeRun?.gardenId === z.id && <small>현재 회차</small>}
                {z.status === "pending" && <small>승인 대기</small>}
              </strong>
              <span>
                {z.flower} <b>·</b> {z.area}m²
              </span>
            </span>
            {zone === z.id ? (
              <span className="selected-dot">
                <Check size={12} />
              </span>
            ) : (
              <ChevronRight size={15} />
            )}
          </button>
        ))}
      </div>
      <div className="subtle-note">
        <Leaf size={15} />
        <span>
          {activeRun && activeRun.gardenId !== selected.id
            ? `정원을 바꿔 봐도 정지·종료 대상은 ${active.name} 회차입니다.`
            : selected.status === "pending"
              ? "관리자가 확인하고 장비를 배정하면 관수할 수 있어요."
              : !selected.deviceId
                ? "이 정원에 배정된 장비가 없어요. 관리자에게 문의해 주세요."
                : "정원을 선택하면 지도에서 위치를 확인할 수 있어요."}
        </span>
      </div>
    </>
  );
}
