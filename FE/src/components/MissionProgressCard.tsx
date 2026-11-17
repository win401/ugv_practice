import { Check, Droplets, MapPin, Radio, Route } from "lucide-react";
import { useId } from "react";
import type { Freshness, PointResult, Run } from "../types/control";
import type { GardenMapVehicle } from "../types/gardenMap";
import "../styles/mission-progress.css";

export interface MissionProgressCardProps {
  run: Run;
  gardenName: string;
  vehicle: GardenMapVehicle | null;
  progress: number;
  doneCount: number;
  freshness: Freshness;
  lastReport: number | null;
  now: number;
}

type DisplayStatus = { state: GardenMapVehicle["status"]; label: string };

const positive = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
const seconds = (value: number) => `${Math.floor(positive(value))}초`;

function statusOf(run: Run, vehicle: GardenMapVehicle | null): DisplayStatus {
  if (run.endedAt !== null) {
    return run.endReason === "complete"
      ? { state: "done", label: "작업 완료" }
      : {
          state: "stopped",
          label: run.endReason === "user" ? "사용자 종료" : "작업 종료",
        };
  }
  if (run.halt === "lost")
    return { state: "unknown", label: "연결 끊김 · 상태 확인" };
  if (run.halt === "fault")
    return { state: "unknown", label: "장비 이상 · 상태 확인" };
  if (run.halt === "estop") return { state: "stopped", label: "안전정지" };
  if (run.halt === "paused") return { state: "paused", label: "일시정지" };

  const mapState = vehicle?.source === "mission" ? vehicle.status : null;
  if (mapState === "lost")
    return { state: "unknown", label: "연결 끊김 · 상태 확인" };
  if (mapState === "fault")
    return { state: "unknown", label: "장비 이상 · 상태 확인" };
  if (mapState === "unknown") return { state: "unknown", label: "상태 확인" };
  if (mapState === "paused") return { state: "paused", label: "일시정지" };
  if (mapState === "stopped") return { state: "stopped", label: "정지됨" };
  if (run.stage === "water" && run.pump.confirmed !== "on")
    return { state: "idle", label: "관수 시작 확인 중" };
  if (run.stage === "next" && run.pump.confirmed !== "off")
    return {
      state: mapState ?? (run.pump.confirmed === "on" ? "watering" : "idle"),
      label: "관수 종료 확인 중",
    };
  if (run.stage === "stop") return { state: "idle", label: "정차 · 관수 준비" };
  if (run.stage === "next")
    return {
      state: "idle",
      label:
        run.current + 1 < run.points.length
          ? "다음 지점 준비"
          : "작업 종료 확인 중",
    };
  if (run.stage === "water") {
    const side = vehicle?.wateringSide;
    return {
      state: "watering",
      label: `관수 중${side ? ` · ${side === "left" ? "왼쪽" : "오른쪽"}` : ""}`,
    };
  }
  if (run.stage === "move")
    return mapState === "idle"
      ? { state: "idle", label: "도착 확인 중" }
      : { state: "moving", label: "이동 중" };
  return { state: "idle", label: "작업 상태 확인 중" };
}

function pointState(
  run: Run,
  point: PointResult,
  index: number,
  status: DisplayStatus,
) {
  const current = run.endedAt === null && index === run.current;
  if (point.status === "done")
    return {
      state: "done",
      label:
        current && run.stage === "next" && run.pump.confirmed !== "off"
          ? "완료 · 종료 확인"
          : "완료",
    };
  if (point.status === "unknown" || (current && status.state === "unknown"))
    return { state: "unknown", label: "미확인" };
  if (current)
    return {
      state: "current",
      label:
        status.state === "paused"
          ? "일시정지"
          : status.state === "stopped"
            ? "정지"
            : run.stage === "move"
              ? "이동 목표"
              : run.stage === "stop"
                ? "관수 준비"
                : run.stage === "water"
                  ? run.pump.confirmed === "on"
                    ? "관수 중"
                    : "시작 확인"
                  : run.stage === "next"
                    ? "종료 확인"
                    : "결과 확인",
    };
  if (point.status === "partial")
    return { state: "partial", label: "부분 완료" };
  if (point.status === "failed") return { state: "failed", label: "실패" };
  if (point.status === "skipped") return { state: "skipped", label: "미수행" };
  if (run.endedAt !== null || point.status === "watering")
    return { state: "unknown", label: "미확인" };
  return { state: "waiting", label: "대기" };
}

function reportAge(lastReport: number | null, now: number) {
  if (lastReport === null) return "보고 미수신";
  const elapsed = Math.floor(positive(now - lastReport) / 1000);
  if (elapsed < 1) return "방금 보고 수신";
  if (elapsed < 60) return `${elapsed}초 전 보고 수신`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}분 전 보고 수신`;
  return `${Math.floor(elapsed / 3600)}시간 전 보고 수신`;
}

/** A read-only run snapshot. The parent owns reporting, progress and all timers. */
export default function MissionProgressCard({
  run,
  gardenName,
  vehicle,
  progress,
  doneCount,
  freshness,
  lastReport,
  now,
}: MissionProgressCardProps) {
  const id = useId();
  const status = statusOf(run, vehicle);
  const current = run.points[run.current];
  const previous = run.current > 0 ? run.points[run.current - 1] : null;
  const ended = run.endedAt !== null;
  const stale = freshness !== "current" || run.halt === "lost";
  const completed = Math.min(
    run.points.length,
    Math.floor(positive(doneCount)),
  );
  const overall = Math.min(100, Math.floor(positive(progress)));
  const watered = positive(current?.watered ?? 0);
  const planned = positive(current?.planned ?? 0);
  const wateringPercent = planned
    ? Math.min(100, (watered / planned) * 100)
    : 0;
  const stoppedBetweenPoints =
    !!run.movement &&
    (ended || !!run.halt) &&
    run.movement.elapsedMs < run.movement.durationMs &&
    Math.hypot(
      run.movement.to[0] - run.movement.from[0],
      run.movement.to[1] - run.movement.from[1],
    ) > 0;
  const inSegment = run.stage === "move" || stoppedBetweenPoints;
  const position =
    freshness === "none" && lastReport === null
      ? "위치 보고가 아직 없습니다."
      : !current
        ? "확인된 지점이 없습니다."
        : inSegment
          ? `${previous?.name ?? "출발 위치"} → ${current.name} 사이`
          : current.name;
  const positionLabel = stale
    ? "마지막 확인 위치"
    : ended
      ? "종료 위치"
      : inSegment && status.state === "moving"
        ? "이동 구간"
        : "현재 위치";

  return (
    <section
      className="mission-progress-card"
      data-run-id={run.id}
      data-status={status.state}
      data-freshness={freshness}
      aria-labelledby={`${id}-title`}
    >
      <div className="mission-progress-heading">
        <span className="mission-progress-icon">
          <Route size={18} />
        </span>
        <div>
          <p>미션 진행 현황</p>
          <h3 id={`${id}-title`} title={run.missionName}>
            {run.missionName}
          </h3>
        </div>
      </div>
      <dl className="mission-progress-meta">
        <div>
          <dt>작업 정원</dt>
          <dd title={gardenName}>{gardenName}</dd>
        </div>
        <div>
          <dt>장비</dt>
          <dd>{run.deviceId}</dd>
        </div>
      </dl>
      <span className="mission-progress-status" data-state={status.state}>
        <i aria-hidden="true" />
        {status.label}
      </span>

      <div className="mission-progress-position">
        <MapPin size={15} aria-hidden="true" />
        <div>
          <span>{positionLabel}</span>
          <strong>{position}</strong>
        </div>
      </div>

      <div className="mission-progress-overall">
        <div className="mission-progress-total">
          <span id={`${id}-overall-label`}>전체 완료율</span>
          <strong>
            {overall}
            <small>%</small>
          </strong>
        </div>
        <div
          className="mission-progress-track"
          role="progressbar"
          aria-labelledby={`${id}-overall-label`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={overall}
          aria-valuetext={`계획 ${run.points.length}곳 중 ${completed}곳 완료, ${overall}%`}
        >
          <span style={{ width: `${overall}%` }} />
        </div>
        <p className="mission-progress-caption">
          완료 지점{" "}
          <strong>
            {completed} / {run.points.length}곳
          </strong>{" "}
          기준
          {ended && run.endReason !== "complete" ? " · 종료 시점의 결과" : ""}
        </p>
      </div>

      {current && (
        <div className="mission-progress-water">
          <div className="mission-progress-water-heading">
            <Droplets size={15} aria-hidden="true" />
            <span id={`${id}-water-label`}>
              {stale
                ? "마지막 확인 관수"
                : ended
                  ? "마지막 지점 관수"
                  : "현재 지점 관수"}
            </span>
            <strong>
              {seconds(watered)} <small>/ {seconds(planned)}</small>
            </strong>
          </div>
          <p>{current.name}</p>
          <div
            className="mission-progress-track mission-progress-water-track"
            role="progressbar"
            aria-labelledby={`${id}-water-label`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(wateringPercent)}
            aria-valuetext={`${current.name}, 계획 ${seconds(planned)} 중 ${seconds(watered)} 확인`}
          >
            <span style={{ width: `${wateringPercent}%` }} />
          </div>
          <small className="mission-progress-water-note">
            {stale
              ? "마지막 보고 값입니다. 현재 관수 상태를 확인해야 합니다."
              : "보고로 확인된 누적 관수 시간입니다."}
          </small>
        </div>
      )}

      <div className="mission-progress-list-heading">
        <h4>작업 경로</h4>
        <span>{run.points.length}개 지점</span>
      </div>
      <ol className="mission-progress-stops">
        {run.points.map((point, index) => {
          const result = pointState(run, point, index, status);
          const isCurrent = !ended && index === run.current;
          return (
            <li
              key={point.pointId}
              className="mission-progress-stop"
              data-point-state={result.state}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className="mission-progress-point-number"
                aria-hidden="true"
              >
                {result.state === "done" ? <Check size={12} /> : index + 1}
              </span>
              <div className="mission-progress-point-copy">
                <strong title={point.name}>{point.name}</strong>
                <small>
                  {seconds(point.watered)} / {seconds(point.planned)}
                </small>
              </div>
              <span className="mission-progress-point-status">
                {result.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mission-progress-report">
        <Radio size={13} aria-hidden="true" />
        <span>{reportAge(lastReport, now)}</span>
        {freshness === "stale" && <strong>갱신 지연</strong>}
        {freshness === "lost" && <strong>연결 끊김</strong>}
      </div>
    </section>
  );
}
