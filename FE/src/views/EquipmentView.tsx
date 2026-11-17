import {
  Activity,
  BatteryFull,
  Check,
  Crosshair,
  Droplet,
  Radio,
  X,
} from "lucide-react";
import ugvImage from "../assets/ugv.webp";
import { agoOf, clockOf } from "../data/controlExample";
import type { IrrigationSimulation } from "../hooks/useIrrigationSimulation";
import type { Freshness, Positioning } from "../types/control";

const FRESHNESS: Record<Freshness, { label: string; tone: string }> = {
  current: { label: "현재 상태", tone: "ok" },
  stale: { label: "오래된 값", tone: "warn" },
  lost: { label: "연결 상실", tone: "bad" },
  none: { label: "미수신", tone: "muted" },
};
const POSITIONING: Record<Positioning, string> = {
  ok: "정상 예시",
  degraded: "저하",
  none: "없음",
  stale: "오래된 값",
};

/** 화면 03 장비 상태와 시작 조건 */
export default function EquipmentView({
  simulation,
}: {
  simulation: IrrigationSimulation;
}) {
  const {
    selected,
    activeRun,
    active,
    jobDevice: device,
    freshness,
    positioning,
    lastReport,
    now,
    checks,
  } = simulation;
  const fresh = FRESHNESS[freshness];
  const pump = activeRun?.pump ?? { requested: null, confirmed: "off" };
  const old = freshness !== "current";
  return (
    <>
      <div className="section-intro">
        <div>
          <h2>ROVEN</h2>
        </div>
        <span className={`tag ${fresh.tone}`}>
          {device ? fresh.label : "미배정"}
        </span>
      </div>
      <div className="vehicle-stage compact">
        <div className="vehicle-orbit" />
        <img className="vehicle" src={ugvImage} alt="ROVEN 장비 외형" />
      </div>
      <div className="device-heading">
        <strong>{device?.id ?? "배정된 장비 없음"}</strong>
        <span>관수 장비 · 가상 모델</span>
      </div>
      {device ? (
        <>
          <section className="report-card">
            <div className="report-head">
              <h3>최신 장비 보고</h3>
              <span className="tag muted">시뮬레이션</span>
            </div>
            <p className="report-time">
              {lastReport
                ? `관측 ${clockOf(lastReport - 800)} / 수신 ${clockOf(lastReport)} · ${agoOf(lastReport, now)}`
                : "아직 수신한 보고가 없습니다"}
            </p>
            <div className="metric-grid">
              <div className={`metric-card ${old ? "is-old" : ""}`}>
                <span>
                  <span className="card-icon green">
                    <BatteryFull size={16} />
                  </span>
                  배터리
                </span>
                <strong>
                  {device.battery}
                  <small>%</small>
                </strong>
                <p>{old ? "마지막 수신값 · 현재값 아님" : "측정값 예시"}</p>
              </div>
              <div className={`metric-card ${old ? "is-old" : ""}`}>
                <span>
                  <span className="card-icon">
                    <Radio size={16} />
                  </span>
                  펌프
                </span>
                <strong className="text-metric">
                  {pump.confirmed === "on"
                    ? "ON"
                    : pump.confirmed === "off"
                      ? "OFF"
                      : "미확인"}
                </strong>
                <p>
                  장비 보고 확인
                  {pump.requested && pump.requested !== pump.confirmed
                    ? ` · ${pump.requested.toUpperCase()} 요청 중`
                    : ""}
                </p>
              </div>
              <div className={`metric-card ${old ? "is-old" : ""}`}>
                <span>
                  <span className="card-icon">
                    <Crosshair size={16} />
                  </span>
                  측위 상태
                </span>
                <strong className="text-metric">
                  {POSITIONING[positioning]}
                </strong>
                <p>판정 기준 HW 협의(D03)</p>
              </div>
              <div className="metric-card">
                <span>
                  <span className="card-icon sky">
                    <Droplet size={16} />
                  </span>
                  물 잔량
                </span>
                <strong className="text-metric">측정 미지원</strong>
                <p>0%와 다름 · 계측 지원 협의(D05)</p>
              </div>
            </div>
          </section>
          <section className="check-card">
            <h3>실행 전 확인 · {selected.name}</h3>
            <ul>
              {checks.map((c) => (
                <li key={c.label}>
                  <span>{c.label}</span>
                  <strong className={c.ok ? "ok" : "bad"}>
                    {c.ok ? <Check size={13} /> : <X size={13} />}
                    {c.ok ? "확인" : "미충족"}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
          <div className="detail-card">
            <h3>장비 정보</h3>
            {[
              ["장비 ID", device.id],
              ["모델", "ROVEN · 가상 모델"],
              ["펌웨어", device.firmware],
              [
                "작업 정원",
                activeRun ? `${active.name} · 회차 ${activeRun.id}` : "대기",
              ],
              [
                "지원 능력",
                "배터리 · 펌프 확인 / 물 계측 미지원 / 복귀 협의 전",
              ],
              ["보고 출처", "시뮬레이션 (실장비 아님)"],
            ].map(([l, v]) => (
              <div key={l}>
                <span>{l}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">
          {selected.name}에 배정된 장비가 없습니다. 관리자가 장비를 배정하면
          여기에 상태가 표시됩니다.
        </p>
      )}
      <div className="demo-explanation">
        <Activity size={17} />
        <p>
          센서·오차·임계값은 최신 HW 사양으로 확정합니다. 미지원·미수신·오래된
          값을 구분해 표시하며, 화면의 값은 모두 시뮬레이션 예시입니다.
        </p>
      </div>
    </>
  );
}
