import { Bot, ChevronRight } from "lucide-react";
import type { IrrigationSimulation } from "../hooks/useIrrigationSimulation";

export default function InfoView({
  simulation,
  todayDone,
  openDevice,
}: {
  simulation: IrrigationSimulation;
  todayDone: number;
  openDevice: () => void;
}) {
  const { selected, active, busy, mode, status, device } = simulation;
  const rows = [
    ["주요 식재", selected.flower],
    ["정원 면적", `${selected.area} m²`],
    ["오늘의 관수", `${todayDone}회 완료`],
  ];
  return (
    <>
      <div className="info-title">
        <h2>{selected.name}</h2>
        <p>{selected.address}</p>
      </div>
      <dl className="info-rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="info-section-label">
        <span className="eyebrow">장비</span>
        <span className={`status-pill ${mode}`}>
          <i />
          {status}
        </span>
      </div>
      <button className="info-device" onClick={openDevice}>
        <span className="info-device-icon">
          <Bot size={18} />
        </span>
        <span className="info-device-copy">
          <strong>{device?.id ?? "배정된 장비 없음"}</strong>
          <small>
            {!device
              ? "관리자가 장비를 배정하면 표시됩니다"
              : !device.online
                ? "연결 끊김"
                : `배터리 ${device.battery}% · ${busy ? `${active.name} 작업 중` : "대기 중"}`}
          </small>
        </span>
        <ChevronRight size={16} />
      </button>
    </>
  );
}
