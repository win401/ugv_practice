import {
  Bot,
  LogOut,
  FlaskConical,
  LayoutDashboard,
  Sprout,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { isDemoSession } from "../api/client";
import type { User } from "../api/types";
import logo from "../assets/SAEMGIL_logo.webp";
import { CustomerDetail, DeviceDetail, GardenDetail } from "./details";
import CustomersPage from "./pages/CustomersPage";
import DevicesPage from "./pages/DevicesPage";
import GardensPage from "./pages/GardensPage";
import OverviewPage from "./pages/OverviewPage";
import SimulatorPage from "./pages/SimulatorPage";
import type { Detail, Section } from "./types";
import { useAdminData, type AdminStore } from "./useAdminData";

const sections: {
  id: Section;
  label: string;
  desc: string;
  icon: typeof Users;
}[] = [
  {
    id: "overview",
    label: "전체 현황",
    desc: "계정·정원·장비 상태와 확인이 필요한 항목",
    icon: LayoutDashboard,
  },
  {
    id: "customers",
    label: "계정 관리",
    desc: "관리자·운영자(정원주인) 계정과 정원·장비 연결 현황",
    icon: Users,
  },
  {
    id: "gardens",
    label: "정원 관리",
    desc: "고객 정원 등록·검토·수정·장비 배정",
    icon: Sprout,
  },
  {
    id: "devices",
    label: "장비 관리",
    desc: "ROVEN 등록과 실시간 상태, 정원 배정",
    icon: Bot,
  },
  {
    id: "sim",
    label: "시뮬레이션",
    desc: "가상 장비 상태를 바꿔 여러 상황을 시험",
    icon: FlaskConical,
  },
];

function sectionFromHash(): Section {
  const h = window.location.hash.slice(1);
  return sections.some((s) => s.id === h) ? (h as Section) : "overview";
}

export default function AdminApp({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const { data, loadError, error, busy, clearError, actions, forms } =
    useAdminData();
  const [section, setSection] = useState<Section>(sectionFromHash);
  const [detail, setDetail] = useState<Detail | null>(null);
  // 정원 관리에서 수정 중인 정원. 목록의 수정 버튼과 옆 창의 정보 수정이 함께 연다.
  const [editingGarden, setEditingGarden] = useState<string | null>(null);

  useEffect(() => {
    // 정원 관리로 옮기며 수정 폼을 연 경우(editGarden)에도 이 알림이 뒤늦게 오므로, 정원 관리를 떠날 때만 닫는다.
    const onHash = () => {
      const next = sectionFromHash();
      setSection(next);
      if (next !== "gardens") setEditingGarden(null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(s: Section) {
    window.location.hash = s;
    setSection(s);
    setDetail(null);
    setEditingGarden(null);
  }

  // 옆 창을 닫고 정원 관리로 옮겨 수정 폼을 연다. 다른 메뉴의 옆 창에서 와도 같다.
  function editGarden(id: string) {
    go("gardens");
    setEditingGarden(id);
  }

  const open = (kind: Detail["kind"], id: string) => setDetail({ kind, id });
  const close = () => setDetail(null);
  const current = sections.find((s) => s.id === section)!;
  // 정원 관리에서 수정 중인 정원(실제 계정만). GardensPage 가 수정 화면을 보여 주는 조건과 같다.
  const editingTarget =
    section === "gardens" && !isDemoSession()
      ? data?.gardens.find((g) => g.id === editingGarden)
      : undefined;
  const store: AdminStore | null = data && {
    ...actions,
    forms,
    data,
    busy,
    me: user,
  };

  return (
    <div className="adm">
      <aside className="adm-nav">
        <div className="adm-brand">
          <img src={logo} alt="SAEMGIL" />
          <span>ADMIN</span>
        </div>
        <nav aria-label="관리자 메뉴">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={id === section ? "active" : undefined}
              aria-current={id === section ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="adm-nav-foot">
          <Link className="adm-to-ops" to="/">
            운영 화면으로
          </Link>
          <div className="adm-user">
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <button
              className="adm-icon-btn"
              aria-label="로그아웃"
              title="로그아웃"
              onClick={onLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
          {isDemoSession() && (
            <p>모든 값은 이 브라우저에만 저장되는 가상 데이터입니다.</p>
          )}
        </div>
      </aside>
      <main className="adm-main">
        <header className="adm-head">
          {editingTarget ? (
            // 정원 수정은 목록과 다른 화면이라는 것이 보이게 제목을 바꾼다.
            <>
              <h1>정원 수정</h1>
              <p>정원 관리 · {editingTarget.name}</p>
            </>
          ) : (
            <>
              <h1>{current.label}</h1>
              <p>{current.desc}</p>
            </>
          )}
        </header>
        {error && (
          <div className="adm-error" role="alert">
            <span>{error}</span>
            <button
              className="adm-icon-btn"
              aria-label="닫기"
              onClick={clearError}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {!store ? (
          <p className="adm-empty">
            {loadError ?? "데이터를 불러오는 중입니다…"}
          </p>
        ) : (
          <AdminSections
            section={section}
            store={store}
            open={open}
            go={go}
            editingGarden={editingGarden}
            onEditGarden={setEditingGarden}
            onEditGardenDone={() => setEditingGarden(null)}
          />
        )}
      </main>
      {store && detail?.kind === "customer" && (
        <CustomerDetail
          id={detail.id}
          store={store}
          open={open}
          onClose={close}
        />
      )}
      {store && detail?.kind === "garden" && (
        <GardenDetail
          id={detail.id}
          store={store}
          open={open}
          onClose={close}
          // 실제 계정은 위성지도에서 경계까지 고치는 정원 수정 폼을 연다.
          onEdit={isDemoSession() ? undefined : editGarden}
        />
      )}
      {store && detail?.kind === "device" && (
        <DeviceDetail
          id={detail.id}
          store={store}
          open={open}
          onClose={close}
        />
      )}
    </div>
  );
}

function AdminSections({
  section,
  go,
  editingGarden,
  onEditGarden,
  onEditGardenDone,
  ...props
}: PageProps & {
  section: Section;
  go: (s: Section) => void;
  editingGarden: string | null;
  onEditGarden: (id: string) => void;
  onEditGardenDone: () => void;
}) {
  if (section === "customers") return <CustomersPage {...props} />;
  if (section === "gardens")
    return (
      <GardensPage
        {...props}
        editingId={editingGarden}
        onEdit={onEditGarden}
        onEditDone={onEditGardenDone}
      />
    );
  if (section === "devices") return <DevicesPage {...props} />;
  if (section === "sim") return <SimulatorPage {...props} />;
  return <OverviewPage {...props} go={go} />;
}

export type PageProps = {
  store: AdminStore;
  open: (kind: Detail["kind"], id: string) => void;
};
