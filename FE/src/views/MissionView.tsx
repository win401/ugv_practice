import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { pointName } from "../data/controlExample";
import type { IrrigationSimulation } from "../hooks/useIrrigationSimulation";
import type { EndPolicy, Mission } from "../types/control";

import type { MissionDraft } from "../types/missionDraft";
import { isDirty } from "../lib/missionDraft";

/** 관수 시간 예시 범위(초). 실제 상하한은 D04 협의 후 정한다. */
const SECONDS_MAX = 600;

type Problem = { field: string; message: string };

function validate(draft: MissionDraft): Problem[] {
  const problems: Problem[] = [];
  const name = draft.name.trim();
  if (!name || name.length > 100)
    problems.push({
      field: "mission-name",
      message: "미션 이름은 1~100자로 입력하세요.",
    });
  if (draft.points.length === 0)
    problems.push({
      field: "mission-add",
      message: "관수 지점을 1개 이상 추가하세요.",
    });
  draft.points.forEach((p, i) => {
    if (!p.name.trim() || p.name.trim().length > 100)
      problems.push({
        field: `point-name-${p.id}`,
        message: `지점 ${i + 1}: 이름은 1~100자입니다.`,
      });
    const s = p.seconds.trim();
    if (!/^\d+$/.test(s) || +s <= 0 || +s > SECONDS_MAX)
      problems.push({
        field: `point-sec-${p.id}`,
        message: `지점 ${i + 1}: 관수 시간은 1~${SECONDS_MAX} 사이 정수(초)입니다.`,
      });
  });
  if (!draft.endPolicy)
    problems.push({
      field: "mission-end",
      message: "종료 정책을 선택하세요. 미정이면 실행할 수 없습니다.",
    });
  return problems;
}

const STATE_TEXT: Record<Mission["state"], string> = {
  saved: "경로 검증 대기",
  verifying: "경로·조건 검사 중…",
  awaiting: "장비의 미션 수락을 기다리는 중…",
  accepted: "장비가 미션을 수락했습니다",
  rejected: "검증 거부",
  noResponse: "장비 무응답",
};

/** 화면 02 관수 미션 편집. 패널 본문과 하단 버튼을 함께 그린다. */
export default function MissionView({
  simulation,
  draft,
  setDraft,
  onStarted,
}: {
  simulation: IrrigationSimulation;
  draft: MissionDraft;
  setDraft: (update: (d: MissionDraft) => MissionDraft) => void;
  onStarted: () => void;
}) {
  const {
    missionOf,
    gardens,
    activeRun,
    saveMission,
    verifyMission,
    cancelPrepared,
    startRun,
  } = simulation;
  const mission = missionOf(draft.gardenId)!;
  const garden = gardens.find((g) => g.id === draft.gardenId)!;
  const dirty = isDirty(draft, mission);
  const problems = validate(draft);
  const [showProblems, setShowProblems] = useState(false);
  const [starting, setStarting] = useState(false);
  const errorOf = (field: string) =>
    showProblems ? problems.find((p) => p.field === field)?.message : undefined;
  const selected = draft.points.find((p) => p.id === draft.selectedId) ?? null;
  const selectedIndex = draft.points.findIndex(
    (p) => p.id === draft.selectedId,
  );

  const patchPoint = (
    id: string,
    patch: Partial<MissionDraft["points"][number]>,
  ) =>
    setDraft((d) => ({
      ...d,
      points: d.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  const move = (i: number, by: number) =>
    setDraft((d) => {
      const points = [...d.points];
      const [p] = points.splice(i, 1);
      points.splice(i + by, 0, p);
      return { ...d, points };
    });
  function addPoint() {
    setDraft((d) => {
      const last = d.points[d.points.length - 1];
      const base = last ?? { x: garden.label[0] + 40, y: garden.label[1] + 50 };
      const used = new Set(d.points.map((p) => p.id));
      let k = d.points.length + 1;
      while (used.has(`${d.gardenId}-P${k}`)) k += 1;
      const id = `${d.gardenId}-P${k}`;
      return {
        ...d,
        points: [
          ...d.points,
          {
            id,
            name: pointName(d.points.length),
            seconds: "60",
            x: base.x + 18,
            y: base.y + 18,
          },
        ],
        selectedId: id,
      };
    });
  }
  function removePoint(id: string) {
    setDraft((d) => {
      const points = d.points.filter((p) => p.id !== id);
      return { ...d, points, selectedId: points[0]?.id ?? null };
    });
  }
  function save() {
    if (problems.length) {
      setShowProblems(true);
      // 상단 요약을 보여 주고 첫 오류 입력칸으로 이동한다.
      window.setTimeout(() => {
        const first = problems[0];
        const point = draft.points.find((p) => first.field.endsWith(p.id));
        if (point) setDraft((d) => ({ ...d, selectedId: point.id }));
        window.setTimeout(
          () => document.getElementById(first.field)?.focus(),
          0,
        );
      }, 0);
      return;
    }
    setShowProblems(false);
    saveMission(draft.gardenId, {
      name: draft.name.trim(),
      endPolicy: draft.endPolicy,
      points: draft.points.map((p) => ({
        ...p,
        name: p.name.trim(),
        seconds: +p.seconds,
      })),
    });
  }

  const inFlight =
    mission.state === "verifying" || mission.state === "awaiting";
  const verifyReason = dirty
    ? "수정 내용을 먼저 저장하세요."
    : activeRun
      ? "진행 중인 회차가 끝난 뒤 검증할 수 있습니다."
      : inFlight
        ? "검증이 진행 중입니다."
        : mission.state === "accepted"
          ? "이미 수락된 미션입니다."
          : problems.length
            ? "입력 오류를 먼저 고치세요."
            : null;
  const runReason = dirty
    ? "저장·검증 후 실행할 수 있습니다."
    : activeRun
      ? "장비에 끝나지 않은 회차가 있습니다."
      : mission.state !== "accepted"
        ? "장비가 이 버전을 수락해야 실행할 수 있습니다."
        : null;

  return (
    <>
      <div className="panel-body">
        <div className="section-intro run-intro">
          <div>
            <span className="eyebrow">미션 편집 · {garden.name}</span>
            <h2>{draft.name.trim() || "이름 없는 미션"}</h2>
            <p className="run-meta">
              지점과 순서를 정하고 관수 조건을 입력합니다.
            </p>
          </div>
          <span className="tag info">
            v{mission.version}
            {dirty ? " · 수정됨" : ""}
          </span>
        </div>

        {showProblems && problems.length > 0 && (
          <div className="form-summary" role="alert">
            <strong>입력 오류 {problems.length}건</strong>
            <ul>
              {problems.map((p) => (
                <li key={p.field}>{p.message}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="field">
          <span>미션 이름</span>
          <input
            id="mission-name"
            value={draft.name}
            maxLength={120}
            aria-invalid={!!errorOf("mission-name")}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {errorOf("mission-name") && (
            <small className="field-error">{errorOf("mission-name")}</small>
          )}
        </label>

        <section className="run-card">
          <div className="run-card-head">
            <h3>
              <span className="num">1</span>방문 지점과 순서
            </h3>
            <button
              id="mission-add"
              className="garden-add-button"
              onClick={addPoint}
            >
              <Plus size={13} />
              지점 추가
            </button>
          </div>
          {draft.points.length === 0 ? (
            <p className="empty-state">
              관수 지점이 없습니다. 지점을 추가하세요.
            </p>
          ) : (
            <ol className="mission-points">
              {draft.points.map((p, i) => (
                <li
                  key={p.id}
                  className={p.id === draft.selectedId ? "selected" : ""}
                >
                  <button
                    className="mission-point-main"
                    aria-pressed={p.id === draft.selectedId}
                    onClick={() =>
                      setDraft((d) => ({ ...d, selectedId: p.id }))
                    }
                  >
                    <span className="point-num">{i + 1}</span>
                    <span className="point-name">{p.name || "이름 없음"}</span>
                    <strong>{p.seconds || "-"}초</strong>
                  </button>
                  <span className="mission-point-order">
                    <button
                      className="icon-button"
                      aria-label={`${i + 1}번 지점 위로`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${i + 1}번 지점 아래로`}
                      disabled={i === draft.points.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {selected && (
          <section className="run-card">
            <div className="run-card-head">
              <h3>
                <span className="num">2</span>선택 지점 관수 조건
              </h3>
              <span className="run-card-sub">지점 {selectedIndex + 1}</span>
            </div>
            <label className="field">
              <span>지점 이름</span>
              <input
                id={`point-name-${selected.id}`}
                value={selected.name}
                maxLength={120}
                aria-invalid={!!errorOf(`point-name-${selected.id}`)}
                onChange={(e) =>
                  patchPoint(selected.id, { name: e.target.value })
                }
              />
              {errorOf(`point-name-${selected.id}`) && (
                <small className="field-error">
                  {errorOf(`point-name-${selected.id}`)}
                </small>
              )}
            </label>
            <label className="field">
              <span>시간 기준 (초)</span>
              <input
                id={`point-sec-${selected.id}`}
                inputMode="numeric"
                value={selected.seconds}
                aria-invalid={!!errorOf(`point-sec-${selected.id}`)}
                onChange={(e) =>
                  patchPoint(selected.id, { seconds: e.target.value })
                }
              />
              {errorOf(`point-sec-${selected.id}`) && (
                <small className="field-error">
                  {errorOf(`point-sec-${selected.id}`)}
                </small>
              )}
              <small className="field-hint">
                설정량(L) 기준은 유량계 지원 시 적용합니다 (D05).
              </small>
            </label>
            <div className="note-box warn">
              60초는 화면 예시값입니다. 실제 조건은 현대건설 자문·HW 협의 후
              확정합니다 (D04).
            </div>
            <div className="mission-point-tools">
              <span>
                <MapPin size={13} />
                지도를 누르면 이 지점의 위치를 옮깁니다.
              </span>
              <button
                className="text-danger"
                onClick={() => removePoint(selected.id)}
              >
                <Trash2 size={13} />
                지점 삭제
              </button>
            </div>
          </section>
        )}

        <label className="field">
          <span>종료 정책</span>
          <select
            id="mission-end"
            value={draft.endPolicy ?? ""}
            aria-invalid={!!errorOf("mission-end")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                endPolicy: (e.target.value || null) as EndPolicy,
              }))
            }
          >
            <option value="">선택하세요 (미정이면 실행 불가)</option>
            <option value="stay">마지막 지점에서 정지</option>
            <option value="return" disabled>
              기지 복귀 · 협의 전 (D09)
            </option>
          </select>
          {errorOf("mission-end") && (
            <small className="field-error">{errorOf("mission-end")}</small>
          )}
        </label>

        <div className={`state-box ${mission.state}`}>
          <span className="num">3</span>
          <div>
            <strong>
              {dirty
                ? "수정됨 · 저장하면 새 버전이 됩니다"
                : `${STATE_TEXT[mission.state]} · 미션 v${mission.version}`}
            </strong>
            <p>
              {dirty
                ? `저장하면 v${mission.version + 1}이 되고 검증·수락을 다시 받아야 합니다.`
                : (mission.reason ??
                  (mission.state === "accepted"
                    ? "실행하면 이 버전의 고정본으로 회차가 만들어집니다."
                    : "장비가 미션 수락을 확인한 뒤 출발합니다."))}
            </p>
          </div>
        </div>
        <p className="subtle-note">
          지점을 잇는 선은 방문 순서 표시이며 실제 실행 경로와 다릅니다. 경로
          생성과 좌표는 협의(D02) 후 연동합니다.
        </p>
      </div>
      <div className="panel-footer">
        <div className="action-row mission-actions">
          <button className="secondary-button" disabled={!dirty} onClick={save}>
            미션 저장
          </button>
          {mission.state === "accepted" || inFlight ? (
            <button
              className="secondary-button"
              disabled={mission.state === "verifying"}
              onClick={() => cancelPrepared(draft.gardenId)}
            >
              준비 취소
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={!!verifyReason}
              onClick={() => verifyMission(draft.gardenId)}
            >
              검증 요청
            </button>
          )}
          <button
            className="primary-button"
            disabled={!!runReason || starting}
            onClick={() => {
              setStarting(true);
              startRun(draft.gardenId).then((ok) => {
                setStarting(false);
                if (ok) onStarted();
              });
            }}
          >
            실행
          </button>
        </div>
        <p>
          <span className="footer-dot" />
          {runReason ??
            (mission.state === "accepted" ? null : verifyReason) ??
            "실제 장비로 명령을 전송하지 않는 데모입니다."}
        </p>
      </div>
    </>
  );
}
