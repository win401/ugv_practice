import { Plus } from "lucide-react";
import { useState } from "react";
import Dropdown from "../../components/Dropdown";
import type { PageProps } from "../AdminApp";
import {
  deviceStatus,
  DeviceBadge,
  gardensServedBy,
  LinkButton,
  matches,
  Meter,
  accountName,
  ownerOfDevice,
  SearchBox,
} from "../ui";

export default function DevicesPage({ store, open }: PageProps) {
  const { data } = store;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);

  const rows = data.devices.filter((v) => {
    const owner = ownerOfDevice(data, v.id);
    const s = deviceStatus(v).label;
    return (
      (status === "all" || (status === "unassigned" ? !owner : s === status)) &&
      matches(q, v.id, v.serial, owner?.name, v.firmware)
    );
  });

  return (
    <div className="adm-stack">
      <div className="adm-toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="장비 번호·시리얼·고객 검색"
        />
        <Dropdown
          label="상태"
          className="adm-filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "전체 상태" },
            ...["작업 중", "대기", "충전 중", "장애", "오프라인"].map((s) => ({
              value: s,
              label: s,
            })),
            { value: "unassigned", label: "미배정 (재고)" },
          ]}
        />
        <button
          className="primary-button adm-add"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={15} /> 장비 등록
        </button>
      </div>

      {adding && (
        <RegisterForm
          nextId={`ROVEN-${String(
            Math.max(
              0,
              ...data.devices.map((v) => Number(v.id.split("-")[1])),
            ) + 1,
          ).padStart(2, "0")}`}
          taken={data.devices.map((v) => v.serial)}
          onCancel={() => setAdding(false)}
          busy={store.busy}
          onSubmit={(serial, fw) =>
            store.forms.registerDevice(serial, fw).then((failed) => {
              if (!failed) setAdding(false);
              return failed;
            })
          }
        />
      )}

      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>장비</th>
              <th>고객 · 정원</th>
              <th>배터리</th>
              <th>물 잔량</th>
              <th>마지막 수신</th>
              <th>펌웨어</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const owner = ownerOfDevice(data, v.id);
              const gardens = gardensServedBy(data, v.id);
              return (
                <tr
                  key={v.id}
                  tabIndex={0}
                  onClick={() => open("device", v.id)}
                  onKeyDown={(e) => e.key === "Enter" && open("device", v.id)}
                >
                  <td>
                    <strong>{v.id}</strong>
                    <small>{v.serial}</small>
                  </td>
                  <td>
                    {owner ? (
                      <>
                        {/* 상세 창은 운영자 계정에만 있다. */}
                        {owner.role === "operator" ? (
                          <LinkButton
                            onClick={() => open("customer", owner.id)}
                          >
                            {owner.name}
                          </LinkButton>
                        ) : (
                          <strong>{accountName(owner)}</strong>
                        )}
                        <small>{gardens.map((g) => g.name).join(", ")}</small>
                      </>
                    ) : (
                      <span className="adm-muted">미배정</span>
                    )}
                  </td>
                  <td>
                    <Meter value={v.battery} low={20} />
                  </td>
                  <td>
                    <Meter value={v.water} low={15} />
                  </td>
                  <td>{v.lastSeen}</td>
                  <td>{v.firmware}</td>
                  <td>
                    <DeviceBadge device={v} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="adm-empty">
                  조건에 맞는 장비가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegisterForm({
  nextId,
  taken,
  busy,
  onCancel,
  onSubmit,
}: {
  nextId: string;
  taken: string[];
  /** 요청을 처리하는 중이면 등록 버튼을 잠근다. */
  busy: boolean;
  onCancel: () => void;
  /** 실패하면 안내 문장을, 성공하면 null 을 돌려준다. */
  onSubmit: (serial: string, firmware: string) => Promise<string | null>;
}) {
  // 서버가 거절한 이유. 폼 안에 보여 준다.
  const [failed, setFailed] = useState("");
  const [serial, setSerial] = useState("");
  const [fw, setFw] = useState("1.4.2");
  const s = serial.trim().toUpperCase();
  const problem = !s
    ? "시리얼 번호를 입력해 주세요."
    : taken.includes(s)
      ? "이미 등록된 시리얼 번호입니다."
      : !fw.trim()
        ? "펌웨어 버전을 입력해 주세요."
        : "";
  return (
    <form
      className="adm-card adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem)
          onSubmit(s, fw.trim()).then((message) => setFailed(message ?? ""));
      }}
    >
      <h2>
        새 장비 등록{" "}
        <span className="adm-muted">· {nextId} 번호가 붙습니다</span>
      </h2>
      <div className="adm-form-grid">
        <label>
          <span>시리얼 번호 (필수)</span>
          <input
            value={serial}
            placeholder="예: RV-2611-0006"
            onChange={(e) => setSerial(e.target.value)}
          />
        </label>
        <label>
          <span>펌웨어 버전</span>
          <input value={fw} onChange={(e) => setFw(e.target.value)} />
        </label>
      </div>
      <div className="adm-form-foot">
        <p role="status">{problem || failed}</p>
        <button type="button" className="secondary-button" onClick={onCancel}>
          취소
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={!!problem || busy}
        >
          등록
        </button>
      </div>
    </form>
  );
}
