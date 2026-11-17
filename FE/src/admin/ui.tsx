import { Search, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type {
  AdminData,
  AdminGarden,
  Customer,
  Device,
  GardenStatus,
} from "./types";

export type Tone = "ok" | "info" | "warn" | "bad" | "muted";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`adm-badge ${tone}`}>{children}</span>;
}

export function deviceStatus(v: Device): { label: string; tone: Tone } {
  if (!v.online) return { label: "오프라인", tone: "muted" };
  if (v.state === "fault") return { label: "장애", tone: "bad" };
  if (v.state === "working") return { label: "작업 중", tone: "info" };
  if (v.state === "charging") return { label: "충전 중", tone: "ok" };
  return { label: "대기", tone: "ok" };
}

export function DeviceBadge({ device }: { device: Device }) {
  const s = deviceStatus(device);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const gardenStatusLabel: Record<GardenStatus, [string, Tone]> = {
  active: ["사용 중", "ok"],
  pending: ["승인 대기", "warn"],
  inactive: ["비활성", "muted"],
};

export function GardenBadge({ status }: { status: GardenStatus }) {
  const [label, tone] = gardenStatusLabel[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function CustomerBadge({ status }: { status: Customer["status"] }) {
  return status === "active" ? (
    <Badge tone="ok">이용 중</Badge>
  ) : (
    <Badge tone="muted">정지</Badge>
  );
}

/** 관리자가 들여다봐야 할 장비 문제. 위에서부터 심각한 순서. */
export function deviceIssues(v: Device): { text: string; tone: Tone }[] {
  const list: { text: string; tone: Tone }[] = [];
  if (!v.online) list.push({ text: "통신 끊김", tone: "bad" });
  if (v.state === "fault") list.push({ text: "장애 발생", tone: "bad" });
  if (v.battery < 20) list.push({ text: `배터리 ${v.battery}%`, tone: "warn" });
  if (v.water < 15) list.push({ text: `물 잔량 ${v.water}%`, tone: "warn" });
  return list;
}

export function gardenIssues(g: AdminGarden): { text: string; tone: Tone }[] {
  const list: { text: string; tone: Tone }[] = [];
  if (g.status === "pending")
    list.push({ text: "등록 승인 대기", tone: "warn" });
  if (g.status === "active" && !g.deviceId)
    list.push({ text: "장비 미배정", tone: "warn" });
  if (g.failures >= 2)
    list.push({ text: `최근 7일 실패 ${g.failures}회`, tone: "bad" });
  return list;
}

export function Meter({ value, low }: { value: number; low: number }) {
  return (
    <span className="adm-meter">
      <span>
        <i
          className={value < low ? "low" : undefined}
          style={{ width: `${value}%` }}
        />
      </span>
      <b>{value}%</b>
    </span>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="adm-search">
      <Search size={15} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Drawer({
  title,
  sub,
  onClose,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="adm-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button
            className="adm-icon-btn"
            aria-label="닫기"
            onClick={onClose}
            autoFocus
          >
            <X size={18} />
          </button>
        </header>
        <div className="adm-drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="adm-rows">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 표 셀 안에서 다른 상세로 넘어가는 링크 버튼. */
export function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="adm-link"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function byId<T extends { id: string }>(list: T[], id: string | null) {
  return list.find((x) => x.id === id);
}

export function matches(q: string, ...fields: (string | undefined)[]) {
  const s = q.trim().toLowerCase();
  return !s || fields.some((f) => f?.toLowerCase().includes(s));
}

export function gardensOf(data: AdminData, customerId: string) {
  return data.gardens.filter((g) => g.customerId === customerId);
}

export function gardensServedBy(data: AdminData, deviceId: string) {
  return data.gardens.filter((g) => g.deviceId === deviceId);
}

/** 정원 주인이 될 수 있는 계정. 운영자와, 시험용 정원을 갖는 관리자다. */
export function accountById(data: AdminData, id: string | null) {
  return byId(data.customers, id) ?? byId(data.admins, id);
}

/** 계정 이름. 관리자는 운영자와 구분되게 표시한다. */
export function accountName(account: Customer) {
  return account.role === "admin" ? `${account.name} (관리자)` : account.name;
}

/** 장비를 맡긴 계정. 장비는 한 계정의 정원만 맡는다. */
export function ownerOfDevice(data: AdminData, deviceId: string) {
  const g = data.gardens.find((x) => x.deviceId === deviceId);
  return g ? accountById(data, g.customerId) : undefined;
}
