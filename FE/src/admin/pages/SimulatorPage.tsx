import { RotateCcw, Zap } from "lucide-react";
import { useState } from "react";
import Dropdown from "../../components/Dropdown";
import type { PageProps } from "../AdminApp";
import type { Device, DeviceState } from "../types";
import { now } from "../useAdminData";
import {
  Badge,
  byId,
  DeviceBadge,
  deviceIssues,
  gardensServedBy,
  ownerOfDevice,
} from "../ui";

const presets: { label: string; patch: Partial<Device> }[] = [
  { label: "배터리 부족", patch: { battery: 12 } },
  { label: "물 부족", patch: { water: 6 } },
  { label: "통신 끊김", patch: { online: false } },
  { label: "장애 발생", patch: { state: "fault", activeGardenId: null } },
  {
    label: "정상 복구",
    patch: { online: true, state: "idle", battery: 90, water: 80 },
  },
];

const states: { value: DeviceState; label: string }[] = [
  { value: "idle", label: "대기" },
  { value: "working", label: "작업 중" },
  { value: "charging", label: "충전 중" },
  { value: "fault", label: "장애" },
];

export default function SimulatorPage({ store, open }: PageProps) {
  const { data } = store;
  const [id, setId] = useState(data.devices[0]?.id ?? "");
  const [confirmReset, setConfirmReset] = useState(false);
  const v = byId(data.devices, id);
  if (!v) return <p className="adm-empty">장비가 없습니다.</p>;

  const gardens = gardensServedBy(data, v.id).filter(
    (g) => g.status === "active",
  );
  const owner = ownerOfDevice(data, v.id);
  const issues = deviceIssues(v);
  // 장비가 보낸 값처럼 보이도록, 바꿀 때마다 수신 시각도 갱신한다.
  const set = (patch: Partial<Device>) =>
    store.updateDevice(v.id, {
      ...patch,
      lastSeen: patch.online === false ? v.lastSeen : now(),
    });

  return (
    <div className="adm-stack">
      <p className="adm-note">
        여기서 바꾼 값은 고객 화면에도 바로 반영됩니다. 다른 탭에서 운영자로
        로그인해 두면 함께 확인할 수 있습니다. 실제 장비로는 아무것도 보내지
        않습니다.
      </p>

      <div className="adm-sim">
        <section className="adm-card adm-sim-controls">
          <div className="adm-sim-row">
            <span>장비</span>
            <Dropdown
              label="시뮬레이션 장비"
              className="adm-filter"
              value={v.id}
              onChange={setId}
              options={data.devices.map((d) => ({ value: d.id, label: d.id }))}
            />
          </div>

          <div className="adm-sim-group">
            <h3>빠른 상황</h3>
            <div className="adm-chips">
              {presets.map((p) => (
                <button
                  key={p.label}
                  className="adm-chip"
                  onClick={() => set(p.patch)}
                >
                  <Zap size={13} /> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="adm-sim-group">
            <h3>통신</h3>
            <div className="adm-seg">
              <button
                className={v.online ? "on" : undefined}
                onClick={() => set({ online: true })}
              >
                연결
              </button>
              <button
                className={!v.online ? "on" : undefined}
                onClick={() => set({ online: false })}
              >
                끊김
              </button>
            </div>
          </div>

          <div className="adm-sim-group">
            <h3>동작 상태</h3>
            <div className="adm-seg">
              {states.map((s) => (
                <button
                  key={s.value}
                  className={v.state === s.value ? "on" : undefined}
                  disabled={s.value === "working" && gardens.length === 0}
                  onClick={() =>
                    set({
                      state: s.value,
                      activeGardenId:
                        s.value === "working"
                          ? (v.activeGardenId ?? gardens[0].id)
                          : null,
                    })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            {v.state === "working" && gardens.length > 1 && (
              <Dropdown
                label="작업 정원"
                className="adm-filter adm-sim-sub"
                value={v.activeGardenId ?? gardens[0].id}
                onChange={(g) => set({ activeGardenId: g })}
                options={gardens.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}
            {gardens.length === 0 && (
              <p className="adm-hint">
                사용 중인 정원에 배정되어야 작업을 시작할 수 있습니다.
              </p>
            )}
          </div>

          {(
            [
              ["battery", "배터리"],
              ["water", "물 잔량"],
            ] as const
          ).map(([key, label]) => (
            <div className="adm-sim-group" key={key}>
              <h3>
                {label} <b>{v[key]}%</b>
              </h3>
              <input
                type="range"
                min={0}
                max={100}
                value={v[key]}
                aria-label={label}
                onChange={(e) => set({ [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </section>

        <section className="adm-card adm-sim-preview">
          <h2>현재 상태</h2>
          <div className="adm-sim-id">
            <strong>{v.id}</strong>
            <DeviceBadge device={v} />
          </div>
          <dl className="adm-rows">
            <div>
              <dt>고객</dt>
              <dd>{owner?.name ?? "미배정"}</dd>
            </div>
            <div>
              <dt>작업 정원</dt>
              <dd>{byId(data.gardens, v.activeGardenId)?.name ?? "-"}</dd>
            </div>
            <div>
              <dt>마지막 수신</dt>
              <dd>{v.lastSeen}</dd>
            </div>
          </dl>
          <h3>관리자에게 보이는 경고</h3>
          {issues.length ? (
            <div className="adm-chips">
              {issues.map((i) => (
                <Badge key={i.text} tone={i.tone}>
                  {i.text}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="adm-empty">경고 없음</p>
          )}
          <button
            className="secondary-button"
            onClick={() => open("device", v.id)}
          >
            장비 상세 보기
          </button>
        </section>
      </div>

      <section className="adm-card adm-danger">
        <div>
          <h2>전체 데이터 초기화</h2>
          <p>고객·정원·장비를 처음 시연 데이터로 되돌립니다.</p>
        </div>
        {confirmReset ? (
          <div className="adm-confirm">
            <button
              className="secondary-button"
              onClick={() => setConfirmReset(false)}
            >
              취소
            </button>
            <button
              className="adm-danger-btn"
              onClick={() => {
                store.reset();
                setConfirmReset(false);
              }}
            >
              초기화
            </button>
          </div>
        ) : (
          <button
            className="secondary-button"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw size={14} /> 초기화
          </button>
        )}
      </section>
    </div>
  );
}
