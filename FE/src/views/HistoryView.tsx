import { ChevronDown, Clock3 } from "lucide-react";
import { useState } from "react";
import { DEMO_DATE } from "../api/time";
import Dropdown from "../components/Dropdown";
import { POINT_STATUS_LABEL, durationOf } from "../data/controlExample";
import type { IrrigationSimulation } from "../hooks/useIrrigationSimulation";
import type { RunDetail } from "../types/control";

const END_TAG: Record<RunDetail["endReason"], { label: string; tone: string }> =
  {
    complete: { label: "정상 완료", tone: "ok" },
    user: { label: "사용자 종료", tone: "warn" },
    remote: { label: "장비 작업 중지", tone: "muted" },
  };

/** "2026.11.04" → 그날 00:00(KST)의 일 수. 날짜 경계 비교에 쓴다. */
const dayOf = (date: string) => {
  const [y, m, d] = date.split(".").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

/** 화면 04 작업 이력과 회차 상세 */
export default function HistoryView({
  simulation,
}: {
  simulation: IrrigationSimulation;
}) {
  const { records, details, gardens, selected } = simulation;
  const [period, setPeriod] = useState("week");
  const [garden, setGarden] = useState(selected.id);
  const [result, setResult] = useState("all");
  const [env, setEnv] = useState("simulation");
  const [expanded, setExpanded] = useState<number | null>(null);

  const today = dayOf(DEMO_DATE);
  const filtered =
    env !== "simulation"
      ? []
      : records.filter((r) => {
          const d = details[r.id];
          const day = dayOf(r.date);
          // 시작일 00:00 포함 ~ 종료일 다음 날 00:00 제외
          const inPeriod =
            period === "all" ||
            (period === "today"
              ? day === today
              : day > today - 7 && day <= today);
          const reason = d?.endReason ?? (r.complete ? "complete" : "user");
          const unknown = d?.points.some((p) => p.status === "unknown") ?? true;
          return (
            inPeriod &&
            (garden === "all" || r.gardenId === garden) &&
            (result === "all" ||
              (result === "unknown" ? unknown : reason === result))
          );
        });
  const withDetail = filtered.filter((r) => details[r.id]);
  const watered = withDetail.reduce(
    (s, r) => s + details[r.id].points.reduce((a, p) => a + p.watered, 0),
    0,
  );
  const missing = filtered.length - withDetail.length;

  return (
    <>
      <div className="section-intro">
        <div>
          <h2>작업 이력</h2>
        </div>
        <span className="tag muted">SIMULATOR</span>
      </div>
      <div className="history-filters grid">
        <Dropdown
          label="조회 기간"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: `오늘 · ${DEMO_DATE.slice(5)}` },
            { value: "week", label: "최근 7일" },
            { value: "all", label: "전체 기간" },
          ]}
        />
        <Dropdown
          label="정원"
          value={garden}
          onChange={setGarden}
          options={[
            { value: "all", label: "전체 정원" },
            ...gardens.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
        <Dropdown
          label="회차 결과"
          value={result}
          onChange={setResult}
          options={[
            { value: "all", label: "전체 결과" },
            { value: "complete", label: "정상 완료" },
            { value: "user", label: "사용자 종료" },
            { value: "unknown", label: "결과 미수신 포함" },
          ]}
        />
        <Dropdown
          label="환경"
          value={env}
          onChange={setEnv}
          options={[
            { value: "simulation", label: "시뮬레이션" },
            { value: "device", label: "실제 장비" },
          ]}
        />
      </div>
      <div className="history-stats">
        <div>
          <span>회차</span>
          <strong>
            {filtered.length}
            <small>건</small>
          </strong>
        </div>
        <div>
          <span>관수 누적</span>
          <strong>
            {Math.round(watered / 60)}
            <small>분</small>
          </strong>
        </div>
        <div>
          <span>물 사용량</span>
          <strong className="text-stat">측정 미지원</strong>
        </div>
      </div>
      {missing > 0 && (
        <p className="subtle-note">
          상세 기록이 없는 회차 {missing}건은 관수 누적에서 빠졌습니다.
        </p>
      )}
      <div className="section-label">
        <h3>회차 목록</h3>
        <span>최신순</span>
      </div>
      <div className="history-list">
        {env !== "simulation" ? (
          <p className="empty-state">
            실제 장비 기록이 없습니다. 장비 연동 후 표시됩니다.
          </p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">선택한 조건의 회차가 없어요.</p>
        ) : (
          filtered.map((r) => {
            const d = details[r.id];
            const tag =
              END_TAG[d?.endReason ?? (r.complete ? "complete" : "user")];
            const count = (s: string) =>
              d?.points.filter((p) => p.status === s).length ?? 0;
            const summary = d
              ? [
                  ["완료", count("done")],
                  ["부분", count("partial")],
                  ["미수행", count("skipped")],
                  ["미수신", count("unknown")],
                ]
                  .filter(([, n]) => n)
                  .map(([l, n]) => `${l} ${n}`)
                  .join(" · ")
              : "지점 결과 없음";
            const open = expanded === r.id;
            return (
              <article
                key={r.id}
                className={`history-item ${open ? "open" : ""}`}
              >
                <button
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : r.id)}
                >
                  <span>
                    <strong>{d?.missionName ?? `${r.zone} 관수`}</strong>
                    <small>
                      {d
                        ? `${d.runId} · 미션 v${d.missionVersion}`
                        : `${r.date} ${r.time}`}
                    </small>
                    <small>{summary}</small>
                  </span>
                  <span className={`tag ${tag.tone}`}>{tag.label}</span>
                  <ChevronDown size={15} className={open ? "rotated" : ""} />
                </button>
                {open && (
                  <div className="history-detail">
                    {[
                      ["시작", `${r.date} ${r.time}`],
                      ["정원 · 장비", `${r.zone} · ${r.deviceId}`],
                      ["종료 사유", tag.label],
                      [
                        "실제 관수 누적",
                        d
                          ? durationOf(
                              d.points.reduce((a, p) => a + p.watered, 0),
                            )
                          : "상세 없음",
                      ],
                      ["측정 물 사용량", "측정 미지원"],
                      ["복귀 결과", "미적용 · 협의 전"],
                      [
                        "출처",
                        d?.source === "device" ? "실제 장비" : "시뮬레이션",
                      ],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <span>{l}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                    {d && (
                      <ol className="point-chips">
                        {d.points.map((p, i) => (
                          <li key={p.pointId} className={`point-${p.status}`}>
                            <span>지점 {i + 1}</span>
                            <strong>{POINT_STATUS_LABEL[p.status]}</strong>
                          </li>
                        ))}
                      </ol>
                    )}
                    <p>
                      같은 미션도 실행 회차마다 따로 기록합니다. 결과 미수신은
                      완료나 미수행으로 바꾸지 않습니다.
                    </p>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
      <div className="subtle-note">
        <Clock3 size={15} />
        <span>시연 기준일 {DEMO_DATE} · KST · 이 브라우저에 저장</span>
      </div>
    </>
  );
}
