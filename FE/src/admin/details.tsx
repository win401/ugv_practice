import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import Dropdown from "../components/Dropdown";
import type { PageProps } from "./AdminApp";
import type { AdminGarden } from "./types";
import {
  accountName,
  Badge,
  byId,
  CustomerBadge,
  DeviceBadge,
  deviceIssues,
  Drawer,
  GardenBadge,
  gardenIssues,
  gardensOf,
  gardensServedBy,
  LinkButton,
  Meter,
  ownerOfDevice,
  Rows,
} from "./ui";

type DetailProps = PageProps & { id: string; onClose: () => void };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="adm-drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function LinkList({
  items,
}: {
  items: { key: string; main: ReactNode; side?: ReactNode; go: () => void }[];
}) {
  if (!items.length) return <p className="adm-empty">없음</p>;
  return (
    <ul className="adm-list">
      {items.map((i) => (
        <li key={i.key}>
          <button onClick={i.go}>
            <span className="adm-list-main">{i.main}</span>
            <span className="adm-list-tags">{i.side}</span>
            <ChevronRight size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CustomerDetail({ id, store, open, onClose }: DetailProps) {
  const { data } = store;
  const c = byId(data.customers, id);
  if (!c) return null;
  const gardens = gardensOf(data, c.id);
  const deviceIds = [
    ...new Set(gardens.map((g) => g.deviceId).filter((x): x is string => !!x)),
  ];
  return (
    <Drawer title={c.name} sub={`고객 · ${c.id}`} onClose={onClose}>
      <Rows
        rows={[
          ["상태", <CustomerBadge status={c.status} />],
          ["이메일", c.email],
          ["연락처", c.phone],
          ["가입일", c.joined],
        ]}
      />
      <Section title={`정원 ${gardens.length}곳`}>
        <LinkList
          items={gardens.map((g) => ({
            key: g.id,
            main: <strong>{g.name}</strong>,
            side: <GardenBadge status={g.status} />,
            go: () => open("garden", g.id),
          }))}
        />
      </Section>
      <Section title={`장비 ${deviceIds.length}대`}>
        <LinkList
          items={deviceIds.map((d) => {
            const v = byId(data.devices, d)!;
            return {
              key: d,
              main: <strong>{d}</strong>,
              side: <DeviceBadge device={v} />,
              go: () => open("device", d),
            };
          })}
        />
      </Section>
      <Section title="계정 관리">
        {c.status === "active" ? (
          <button
            className="secondary-button"
            onClick={() => store.updateCustomer(c.id, { status: "suspended" })}
          >
            계정 정지
          </button>
        ) : (
          <button
            className="primary-button"
            onClick={() => store.updateCustomer(c.id, { status: "active" })}
          >
            정지 해제
          </button>
        )}
      </Section>
    </Drawer>
  );
}

export function GardenDetail({
  id,
  store,
  open,
  onClose,
  onEdit,
}: DetailProps & {
  /** 있으면 정보 수정이 옆 창 대신 정원 관리의 정원 수정 폼을 연다(실제 계정). */
  onEdit?: (id: string) => void;
}) {
  const { data } = store;
  const g = byId(data.gardens, id);
  const [editing, setEditing] = useState(false);
  if (!g) return null;
  const owner = byId(data.customers, g.customerId);
  const adminOwner = byId(data.admins, g.customerId);
  const issues = gardenIssues(g);
  // 다른 고객의 정원을 맡고 있는 장비는 고를 수 없다.
  const deviceOptions = data.devices.filter((v) => {
    const o = ownerOfDevice(data, v.id);
    return !o || o.id === g.customerId;
  });
  const update = (patch: Partial<AdminGarden>) =>
    store.updateGarden(g.id, patch);

  return (
    <Drawer title={g.name} sub={`정원 · ${g.id}`} onClose={onClose}>
      {issues.length > 0 && (
        <div className="adm-chips">
          {issues.map((i) => (
            <Badge key={i.text} tone={i.tone}>
              {i.text}
            </Badge>
          ))}
        </div>
      )}

      {g.status === "pending" && (
        <div className="adm-callout">
          <p>고객이 새로 등록한 정원입니다. 내용을 확인하고 승인해 주세요.</p>
          <div className="adm-confirm">
            <button
              className="secondary-button"
              onClick={() => update({ status: "inactive" })}
            >
              반려
            </button>
            <button
              className="primary-button"
              onClick={() => update({ status: "active" })}
            >
              승인
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <GardenEditForm
          garden={g}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            update(patch);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <Rows
            rows={[
              ["상태", <GardenBadge status={g.status} />],
              [
                "소유 고객",
                owner ? (
                  <LinkButton onClick={() => open("customer", owner.id)}>
                    {owner.name}
                  </LinkButton>
                ) : adminOwner ? (
                  `${adminOwner.name} (관리자)`
                ) : (
                  "-"
                ),
              ],
              ["지역", g.region],
              ["주소", g.address],
              ["면적", `${g.area}m²`],
              ["주요 식재", g.flower],
              ["등록일", g.registered],
              ["최근 작업", g.lastWork ?? "-"],
              ["최근 7일 실패", `${g.failures}회`],
            ]}
          />
          <button
            className="secondary-button"
            onClick={() => (onEdit ? onEdit(g.id) : setEditing(true))}
          >
            정보 수정
          </button>
        </>
      )}

      <Section title="장비 배정">
        <Dropdown
          label="배정 장비"
          className="adm-filter"
          value={g.deviceId ?? ""}
          onChange={(v) => update({ deviceId: v || null })}
          options={[
            { value: "", label: "배정 안 함" },
            ...deviceOptions.map((v) => ({
              value: v.id,
              label: ownerOfDevice(data, v.id) ? v.id : `${v.id} (재고)`,
            })),
          ]}
        />
        {g.deviceId && (
          <LinkButton onClick={() => open("device", g.deviceId!)}>
            {g.deviceId} 상세 보기
          </LinkButton>
        )}
      </Section>

      <Section title="소유권 이전">
        <Dropdown
          label="소유 고객"
          className="adm-filter"
          value={g.customerId}
          onChange={(c) => update({ customerId: c })}
          // 정원 등록과 같은 목록: 이용 중인 운영자와 관리자. 지금 주인은 정지 계정이어도 보여 준다.
          options={[...data.customers, ...data.admins]
            .filter((c) => c.status === "active" || c.id === g.customerId)
            .map((c) => ({
              value: c.id,
              label: `${accountName(c)} · ${c.email}`,
            }))}
        />
        <p className="adm-hint">
          다른 고객에게 옮기면 장비 배정이 함께 해제됩니다.
        </p>
      </Section>

      <Section title="사용 상태">
        {g.status === "inactive" ? (
          <button
            className="primary-button"
            onClick={() => update({ status: "active" })}
          >
            다시 사용
          </button>
        ) : (
          g.status === "active" && (
            <button
              className="secondary-button"
              onClick={() => update({ status: "inactive" })}
            >
              비활성화
            </button>
          )
        )}
      </Section>
    </Drawer>
  );
}

function GardenEditForm({
  garden,
  onCancel,
  onSave,
}: {
  garden: AdminGarden;
  onCancel: () => void;
  onSave: (patch: Partial<AdminGarden>) => void;
}) {
  const [name, setName] = useState(garden.name);
  const [region, setRegion] = useState(garden.region);
  const [address, setAddress] = useState(garden.address);
  const [flower, setFlower] = useState(garden.flower);
  const [area, setArea] = useState(String(garden.area));
  const problem = !name.trim()
    ? "정원 이름을 입력해 주세요."
    : !(Number(area) > 0)
      ? "면적을 확인해 주세요."
      : "";
  return (
    <form
      className="adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem)
          onSave({
            name: name.trim(),
            region: region.trim(),
            address: address.trim(),
            flower: flower.trim(),
            area: Number(area),
          });
      }}
    >
      {(
        [
          ["정원 이름", name, setName],
          ["지역", region, setRegion],
          ["주소", address, setAddress],
          ["주요 식재", flower, setFlower],
          ["면적 m²", area, setArea],
        ] as const
      ).map(([label, value, set]) => (
        <label key={label}>
          <span>{label}</span>
          <input
            value={value}
            inputMode={label === "면적 m²" ? "decimal" : undefined}
            onChange={(e) => set(e.target.value)}
          />
        </label>
      ))}
      <div className="adm-form-foot">
        <p role="status">{problem}</p>
        <button type="button" className="secondary-button" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="primary-button" disabled={!!problem}>
          저장
        </button>
      </div>
    </form>
  );
}

export function DeviceDetail({ id, store, open, onClose }: DetailProps) {
  const { data } = store;
  const v = byId(data.devices, id);
  if (!v) return null;
  const owner = ownerOfDevice(data, v.id);
  const gardens = gardensServedBy(data, v.id);
  const issues = deviceIssues(v);
  // 장비는 한 고객의 정원만 맡는다. 고객이 정해지면 그 고객의 정원만 추가할 수 있다.
  const addable = data.gardens.filter(
    (g) =>
      g.deviceId !== v.id &&
      g.status !== "inactive" &&
      (!owner || g.customerId === owner.id),
  );

  return (
    <Drawer title={v.id} sub={`장비 · ${v.serial}`} onClose={onClose}>
      <div className="adm-chips">
        <DeviceBadge device={v} />
        {issues.map((i) => (
          <Badge key={i.text} tone={i.tone}>
            {i.text}
          </Badge>
        ))}
      </div>
      <Rows
        rows={[
          ["배터리", <Meter value={v.battery} low={20} />],
          ["물 잔량", <Meter value={v.water} low={15} />],
          ["작업 정원", byId(data.gardens, v.activeGardenId)?.name ?? "-"],
          ["마지막 수신", v.lastSeen],
          ["펌웨어", v.firmware],
          ["등록일", v.registered],
          [
            "고객",
            // 상세 창은 운영자 계정에만 있다.
            owner?.role === "operator" ? (
              <LinkButton onClick={() => open("customer", owner.id)}>
                {owner.name}
              </LinkButton>
            ) : owner ? (
              accountName(owner)
            ) : (
              "미배정 (재고)"
            ),
          ],
        ]}
      />

      <Section title={`맡은 정원 ${gardens.length}곳`}>
        <LinkList
          items={gardens.map((g) => ({
            key: g.id,
            main: <strong>{g.name}</strong>,
            side: (
              <button
                className="adm-link"
                onClick={(e) => {
                  e.stopPropagation();
                  store.updateGarden(g.id, { deviceId: null });
                }}
              >
                해제
              </button>
            ),
            go: () => open("garden", g.id),
          }))}
        />
        {addable.length > 0 && (
          <Dropdown
            label="정원 추가"
            className="adm-filter"
            value=""
            onChange={(gid) =>
              gid && store.updateGarden(gid, { deviceId: v.id })
            }
            options={[
              { value: "", label: "정원 추가 배정…" },
              ...addable.map((g) => ({
                value: g.id,
                label: `${g.name} · ${byId(data.customers, g.customerId)?.name}${g.deviceId ? ` (${g.deviceId}에서 이동)` : ""}`,
              })),
            ]}
          />
        )}
      </Section>

      <Section title="원격 명령">
        <div className="adm-confirm start">
          <button
            className="secondary-button"
            disabled={!v.online || v.state !== "working"}
            onClick={() =>
              store.updateDevice(v.id, { state: "idle", activeGardenId: null })
            }
          >
            작업 중지
          </button>
          <button
            className="secondary-button"
            disabled={!v.online || v.state === "charging"}
            onClick={() =>
              store.updateDevice(v.id, {
                state: "charging",
                activeGardenId: null,
              })
            }
          >
            기지 복귀
          </button>
          <button
            className="secondary-button"
            disabled={gardens.length === 0}
            onClick={() => store.releaseDevice(v.id)}
          >
            전체 회수
          </button>
        </div>
        {!v.online && (
          <p className="adm-hint">
            통신이 끊긴 장비에는 명령을 보낼 수 없습니다.
          </p>
        )}
      </Section>
    </Drawer>
  );
}
