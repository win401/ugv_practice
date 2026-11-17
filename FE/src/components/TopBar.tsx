import {
  BatteryFull,
  BatteryLow,
  Bell,
  LayoutDashboard,
  LogOut,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { isDemoSession } from "../api/client";
import type { Device, OperatorDashboard, User } from "../api/types";
import logo from "../assets/SAEMGIL_logo_white.webp";
import type { Tab } from "../types/dashboard";
type TopBarProps = {
  bell: boolean;
  read: boolean;
  setBell: (value: boolean) => void;
  setTab: (value: Tab) => void;
  user: User;
  device: Device | null;
  onLogout: () => void;
  /** 관리자가 운영 화면을 볼 때 보고 있는 고객 */
  viewAs?: OperatorDashboard["viewAs"];
  onCustomer?: (id: string) => void;
  mapNavigation?: ReactNode;
};
export default function TopBar({
  bell,
  read,
  setBell,
  setTab,
  user,
  device,
  onLogout,
  viewAs,
  onCustomer,
  mapNavigation,
}: TopBarProps) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setTab("info");
        }}
      >
        <img className="brand-logo" src={logo} alt="SAEMGIL" />
      </a>
      {mapNavigation && (
        <div className="header-map-navigation">{mapNavigation}</div>
      )}
      <div className="header-end">
        {viewAs && (
          <label className="view-as">
            <span>고객 화면</span>
            <select
              value={viewAs.customerId}
              onChange={(e) => onCustomer?.(e.target.value)}
              aria-label="운영 화면으로 볼 고객"
            >
              {viewAs.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {/* 가상 데이터 계정에서만 보인다. 실제 서버 계정의 값은 서버에 저장된 것이다. */}
        {isDemoSession() && (
          <span className="demo-chip">
            <span />
            가상 데이터
          </span>
        )}
        <div className="header-divider" />
        {device && (
          <>
            <span className={device.online ? "connected" : "connected off"}>
              {device.online ? <Wifi size={15} /> : <WifiOff size={15} />}
              {device.online ? "연결 정상" : "연결 끊김"}
            </span>
            <span className="header-battery">
              {device.battery < 20 ? (
                <BatteryLow size={19} />
              ) : (
                <BatteryFull size={19} />
              )}
              {device.battery}%
            </span>
          </>
        )}
        <button
          className="icon-button bell-button"
          aria-label="알림 확인"
          aria-expanded={bell}
          onClick={() => setBell(!bell)}
        >
          <Bell size={19} />
          {!read && <i />}
        </button>
        <div className="account" ref={menuRef}>
          <button
            className="avatar"
            aria-label={`${user.name} 계정 메뉴`}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {user.name.slice(0, 1)}
          </button>
          {menu && (
            <div className="account-menu">
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "관리자 · " : ""}
                {user.email}
              </small>
              {user.role === "admin" && (
                <button onClick={() => navigate("/admin")}>
                  <LayoutDashboard size={14} />
                  관리자 페이지
                </button>
              )}
              <button onClick={onLogout}>
                <LogOut size={14} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
