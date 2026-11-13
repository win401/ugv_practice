import { useEffect, useState } from "react";

type RunStatus = "idle" | "running" | "completed";

type RunState = {
  id: number | null;
  status: RunStatus;
  progress: number;
  position: "A" | "B" | "C";
};

const initialRun: RunState = { id: null, status: "idle", progress: 0, position: "A" };

function getInitialRun(): RunState {
  const runId = new URLSearchParams(window.location.search).get("run");
  return runId === "42"
    ? { id: 42, status: "completed", progress: 100, position: "C" }
    : initialRun;
}

export default function DeviceStatus() {
  const [run, setRun] = useState<RunState>(getInitialRun);

  useEffect(() => {
    if (run.status !== "running") return;

    const middle = window.setTimeout(() => setRun((current) => ({ ...current, progress: 50, position: "B" })), 3000);
    const complete = window.setTimeout(() => setRun({ id: 42, status: "completed", progress: 100, position: "C" }), 6000);
    return () => { window.clearTimeout(middle); window.clearTimeout(complete); };
  }, [run.status]);

  function startRun() {
    window.history.replaceState({}, "", "?run=42");
    setRun({ id: 42, status: "running", progress: 0, position: "A" });
  }

  function resetRun() {
    window.history.replaceState({}, "", window.location.pathname);
    setRun(initialRun);
  }

  const statusText = run.status === "running" ? "주행 중" : run.status === "completed" ? "주행 완료" : "대기 중";
  const vehiclePosition = run.position === "A" ? "path-start" : run.position === "B" ? "path-middle" : "path-end";

  return (
    <section className="simulation-layout" aria-labelledby="simulation-title">
      <div className="route-panel">
        <div className="panel-heading"><div><p className="eyebrow">DEMO ROUTE V1</p><h2 id="simulation-title">고정 경로 주행</h2></div><span className={`run-chip ${run.status}`}>{statusText}</span></div>
        <div className="map-canvas" aria-label="A에서 B를 거쳐 C로 이동하는 UGV-01 경로">
          <svg viewBox="0 0 680 330" role="img" aria-label="A 0,0에서 B 10,0을 거쳐 C 10,5로 이어진 경로">
            <path className="route-line" d="M 100 230 H 490 V 80" />
            <circle className="waypoint" cx="100" cy="230" r="13" /><circle className="waypoint" cx="490" cy="230" r="13" /><circle className="waypoint" cx="490" cy="80" r="13" />
            <text x="100" y="270" textAnchor="middle">A · 0, 0</text><text x="490" y="270" textAnchor="middle">B · 10, 0</text><text x="520" y="85">C · 10, 5</text>
            <g className={`ugv-marker ${vehiclePosition}`}><rect x="-19" y="-14" width="38" height="28" rx="7" /><path d="M -8 -19 L 8 -19 L 13 -14 H -13 Z" /></g>
          </svg>
        </div>
        <div className="route-legend"><span><i className="legend-line" /> 지정 경로</span><span><i className="legend-vehicle" /> UGV-01</span></div>
      </div>

      <aside className="run-panel">
        <div><p className="eyebrow">UGV-01</p><h2>실행 상태</h2></div>
        <dl className="run-details"><div><dt>실행 ID</dt><dd>{run.id ?? "시작 전"}</dd></div><div><dt>현재 위치</dt><dd>{run.position}</dd></div><div><dt>진행률</dt><dd>{run.progress}%</dd></div></dl>
        <div className="progress-track" aria-label={`진행률 ${run.progress}%`}><span style={{ width: `${run.progress}%` }} /></div>
        <p className="run-help">시작 후 3초에 B, 6초에 C 지점에 도달합니다.</p>
        <button className="start-button" disabled={run.status === "running"} onClick={startRun} type="button">{run.status === "running" ? "주행 중" : run.status === "completed" ? "다시 시작" : "주행 시작"}</button>
        {run.status !== "idle" && <button className="reset-button" onClick={resetRun} type="button">목업 초기화</button>}
      </aside>
    </section>
  );
}
