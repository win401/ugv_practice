import { ChevronRight } from "lucide-react";
import type { PageProps } from "../AdminApp";
import type { Section } from "../types";
import {
  Badge,
  byId,
  DeviceBadge,
  deviceIssues,
  deviceStatus,
  gardenIssues,
} from "../ui";

export default function OverviewPage({
  store,
  open,
  go,
}: PageProps & { go: (s: Section) => void }) {
  const { admins, customers, gardens, devices } = store.data;
  const accounts = [...admins, ...customers];
  const count = (label: string) =>
    devices.filter((v) => deviceStatus(v).label === label).length;
  const deviceAlerts = devices
    .map((v) => ({ v, issues: deviceIssues(v) }))
    .filter((x) => x.issues.length);
  const gardenAlerts = gardens
    .map((g) => ({ g, issues: gardenIssues(g) }))
    .filter((x) => x.issues.length);

  const tiles: {
    label: string;
    value: number;
    section: Section;
    sub: string;
  }[] = [
    {
      label: "계정",
      value: accounts.length,
      section: "customers",
      sub: `관리자 ${admins.length} · 운영자 ${customers.length}${accounts.some((a) => a.status === "suspended") ? ` · 정지 ${accounts.filter((a) => a.status === "suspended").length}` : ""}`,
    },
    {
      label: "정원",
      value: gardens.length,
      section: "gardens",
      sub: `승인 대기 ${gardens.filter((g) => g.status === "pending").length} · 장비 미배정 ${gardens.filter((g) => g.status === "active" && !g.deviceId).length}`,
    },
    {
      label: "장비",
      value: devices.length,
      section: "devices",
      sub: `작업 중 ${count("작업 중")} · 대기 ${count("대기") + count("충전 중")}`,
    },
    {
      label: "확인 필요",
      value: deviceAlerts.length + gardenAlerts.length,
      section: "devices",
      sub: `오프라인 ${count("오프라인")} · 장애 ${count("장애")}`,
    },
  ];

  return (
    <div className="adm-stack">
      <div className="adm-tiles">
        {tiles.map((t) => (
          <button
            key={t.label}
            className="adm-tile"
            onClick={() => go(t.section)}
          >
            <span>{t.label}</span>
            <strong>{t.value}</strong>
            <small>{t.sub}</small>
          </button>
        ))}
      </div>

      <div className="adm-two">
        <section className="adm-card">
          <h2>확인이 필요한 장비</h2>
          {deviceAlerts.length === 0 ? (
            <p className="adm-empty">문제가 있는 장비가 없습니다.</p>
          ) : (
            <ul className="adm-list">
              {deviceAlerts.map(({ v, issues }) => (
                <li key={v.id}>
                  <button onClick={() => open("device", v.id)}>
                    <span className="adm-list-main">
                      <strong>{v.id}</strong>
                      <DeviceBadge device={v} />
                    </span>
                    <span className="adm-list-tags">
                      {issues.map((i) => (
                        <Badge key={i.text} tone={i.tone}>
                          {i.text}
                        </Badge>
                      ))}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card">
          <h2>확인이 필요한 정원</h2>
          {gardenAlerts.length === 0 ? (
            <p className="adm-empty">문제가 있는 정원이 없습니다.</p>
          ) : (
            <ul className="adm-list">
              {gardenAlerts.map(({ g, issues }) => (
                <li key={g.id}>
                  <button onClick={() => open("garden", g.id)}>
                    <span className="adm-list-main">
                      <strong>{g.name}</strong>
                      <small>{byId(customers, g.customerId)?.name}</small>
                    </span>
                    <span className="adm-list-tags">
                      {issues.map((i) => (
                        <Badge key={i.text} tone={i.tone}>
                          {i.text}
                        </Badge>
                      ))}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
