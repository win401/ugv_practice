import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import Dropdown from "../../components/Dropdown";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import AddGardenForm from "../AddGardenForm";
import AddGeoGardenForm from "../AddGeoGardenForm";
import { isDemoSession } from "../../api/client";
import type { PageProps } from "../AdminApp";
import type { AdminGarden } from "../types";
import {
  Badge,
  byId,
  GardenBadge,
  gardenIssues,
  LinkButton,
  matches,
  SearchBox,
} from "../ui";

// 관리 칸의 버튼을 눌러도 행의 상세(옆 창)가 열리지 않게 한다.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export default function GardensPage({
  store,
  open,
  editingId,
  onEdit,
  onEditDone,
}: PageProps & {
  /** 수정 중인 정원. 옆 창의 정보 수정에서도 열리므로 관리자 화면이 들고 있다. */
  editingId: string | null;
  onEdit: (id: string) => void;
  onEditDone: () => void;
}) {
  const { data } = store;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [device, setDevice] = useState("all");
  const [region, setRegion] = useState("all");
  const [adding, setAdding] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  // 위성지도 수정과 삭제는 실제 서버에만 있다. 가상 데이터는 옆 창의 정보 수정을 쓴다.
  const real = !isDemoSession();
  const editing = real ? byId(data.gardens, editingId) : undefined;
  // 정원 수정에서 변경 취소를 누른 횟수. 바뀌면 수정 폼을 새로 만든다.
  const [resetCount, setResetCount] = useState(0);
  // 수정하고 돌아왔을 때 등록 폼이 열려 있지 않게 한다.
  if (editing && adding) setAdding(false);
  const regions = [...new Set(data.gardens.map((g) => g.region))];

  // 지우기 전에 이 정원에 연결된 장비를 알려 주고 한 번 더 묻는다.
  async function remove(g: AdminGarden) {
    const working = data.devices.find((v) => v.activeGardenId === g.id);
    const accepted = await confirm({
      title: "정원 삭제",
      message: working
        ? `${g.name} 정원에서 장비(${working.id})가 작업 중입니다. 삭제하면 장비는 대기로 바뀌고 정원은 되돌릴 수 없습니다. 삭제할까요?`
        : g.deviceId
          ? `${g.name} 정원에 배정된 장비(${g.deviceId})가 있습니다. 삭제하면 배정이 해제되고 되돌릴 수 없습니다. 삭제할까요?`
          : `${g.name} 정원을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`,
      confirmLabel: "삭제",
      tone: "danger",
    });
    if (!accepted) return;
    if (g.id === editingId) onEditDone();
    store.deleteGarden(g.id);
  }

  const rows = data.gardens.filter((g) => {
    const owner =
      byId(data.customers, g.customerId) ?? byId(data.admins, g.customerId);
    return (
      (status === "all" || g.status === status) &&
      (region === "all" || g.region === region) &&
      (device === "all" ||
        (device === "assigned" ? !!g.deviceId : !g.deviceId)) &&
      matches(q, g.name, owner?.name, g.address, g.region, g.flower)
    );
  });

  // 정원 수정은 목록을 숨기고 따로 보여 준다. 목록으로는 "목록으로" 버튼이나 저장으로만 돌아간다.
  if (editing)
    return (
      <div className="adm-stack">
        <div className="adm-toolbar">
          <button className="secondary-button" onClick={onEditDone}>
            <ArrowLeft size={15} /> 목록으로
          </button>
        </div>
        <AddGeoGardenForm
          // 변경 취소를 누르면 폼을 새로 만들어 입력값과 경계를 저장된 값으로 되돌린다.
          key={`${editing.id}:${resetCount}`}
          data={data}
          garden={editing}
          busy={store.busy}
          onCancel={() => setResetCount((n) => n + 1)}
          onSubmit={(input) =>
            store.forms
              .updateGarden(editing.id, {
                name: input.name,
                address: input.address,
                flower: input.flower,
                area: input.area,
                ...(input.geo && { geo: input.geo }),
              })
              .then((failed) => {
                if (!failed) onEditDone();
                return failed;
              })
          }
        />
      </div>
    );

  return (
    <div className="adm-stack">
      <div className="adm-toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="정원 이름·고객·주소·식재 검색"
        />
        <Dropdown
          label="상태"
          className="adm-filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "전체 상태" },
            { value: "active", label: "사용 중" },
            { value: "pending", label: "승인 대기" },
            { value: "inactive", label: "비활성" },
          ]}
        />
        <Dropdown
          label="장비 배정"
          className="adm-filter"
          value={device}
          onChange={setDevice}
          options={[
            { value: "all", label: "장비 전체" },
            { value: "assigned", label: "배정됨" },
            { value: "none", label: "미배정" },
          ]}
        />
        <Dropdown
          label="지역"
          className="adm-filter"
          value={region}
          onChange={setRegion}
          options={[
            { value: "all", label: "전체 지역" },
            ...regions.map((r) => ({ value: r, label: r })),
          ]}
        />
        <button
          className="primary-button adm-add"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          <Plus size={15} /> 정원 등록
        </button>
      </div>

      {/* 가상 데이터는 예시 항공사진에, 실제 서버는 위성지도에 위경도로 그린다. */}
      {adding &&
        (isDemoSession() ? (
          <AddGardenForm
            data={data}
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              store
                .addGarden(input)
                .then((failed) => !failed && setAdding(false))
            }
          />
        ) : (
          <AddGeoGardenForm
            data={data}
            busy={store.busy}
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              store.forms.addGarden(input).then((failed) => {
                if (!failed) setAdding(false);
                return failed;
              })
            }
          />
        ))}

      <p className="adm-count">{rows.length}곳</p>

      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>정원</th>
              <th>소유 고객</th>
              <th>지역</th>
              <th>면적</th>
              <th>장비</th>
              <th>최근 작업</th>
              <th>상태</th>
              {real && <th className="adm-row-actions">관리</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const owner = byId(data.customers, g.customerId);
              const adminOwner = byId(data.admins, g.customerId);
              const issues = gardenIssues(g).filter(
                (i) => i.text !== "등록 승인 대기",
              );
              return (
                <tr
                  key={g.id}
                  tabIndex={0}
                  onClick={() => open("garden", g.id)}
                  onKeyDown={(e) => e.key === "Enter" && open("garden", g.id)}
                >
                  <td>
                    <strong>{g.name}</strong>
                    <small>{g.flower}</small>
                  </td>
                  <td>
                    {owner ? (
                      <LinkButton onClick={() => open("customer", owner.id)}>
                        {owner.name}
                      </LinkButton>
                    ) : (
                      adminOwner && `${adminOwner.name} (관리자)`
                    )}
                  </td>
                  <td>{g.region}</td>
                  <td>{g.area}m²</td>
                  <td>
                    {g.deviceId ? (
                      <LinkButton onClick={() => open("device", g.deviceId!)}>
                        {g.deviceId}
                      </LinkButton>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{g.lastWork ?? "-"}</td>
                  <td>
                    <span className="adm-cell-tags">
                      <GardenBadge status={g.status} />
                      {issues.map((i) => (
                        <Badge key={i.text} tone={i.tone}>
                          {i.text}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  {real && (
                    <td
                      className="adm-row-actions"
                      onClick={stop}
                      onKeyDown={stop}
                    >
                      <div>
                        <button
                          className="adm-icon-btn"
                          aria-label={`${g.name} 정원 수정`}
                          title="수정"
                          onClick={() => {
                            setAdding(false);
                            onEdit(g.id);
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="adm-icon-btn adm-icon-danger"
                          aria-label={`${g.name} 정원 삭제`}
                          title="삭제"
                          disabled={store.busy}
                          onClick={() => remove(g)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={real ? 8 : 7} className="adm-empty">
                  조건에 맞는 정원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}
