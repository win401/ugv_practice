import DeviceStatus from "./DeviceStatus";
import "./App.css";

function App() {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><div className="brand">UGV PRACTICE</div><p>운영 대시보드 · 첫 데모</p></header>
      <section className="page-heading" aria-labelledby="page-title">
        <div><p className="eyebrow">FLEET OVERVIEW</p><h1 id="page-title">주행 시뮬레이션</h1><p className="page-description">UGV-01의 고정 경로 A → B → C 주행을 확인합니다.</p></div>
        <p className="environment-badge">DEMO</p>
      </section>
      <DeviceStatus />
    </main>
  );
}

export default App;
