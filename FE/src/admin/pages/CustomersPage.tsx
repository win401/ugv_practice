import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import Dropdown from "../../components/Dropdown";
import { isDemoSession } from "../../api/client";
import type { NewCustomer, Role, User } from "../../api/types";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { formatPhone, isPhone } from "../../lib/phone";
import type { PageProps } from "../AdminApp";
import {
  Badge,
  byId,
  CustomerBadge,
  Drawer,
  gardensOf,
  matches,
  Rows,
  SearchBox,
} from "../ui";

/** 공백을 뺀 영문·숫자·특수문자 8~16자. 서버도 같은 규칙으로 검사한다. */
const PASSWORD_RULE = /^[!-~]{8,16}$/;

const PHONE_PROBLEM = "연락처 형식을 확인해 주세요. 예: 010-1234-5678";

/** 행 안의 버튼을 눌렀을 때 행 전체의 상세 열기가 같이 실행되지 않게 한다. */
const stop = (e: SyntheticEvent) => e.stopPropagation();

export default function CustomersPage({ store, open }: PageProps) {
  const { data } = store;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDialog();
  // 삭제와 비밀번호 다시 설정은 실제 서버에만 있다.
  const real = !isDemoSession();
  const editing = byId([...data.admins, ...data.customers], editingId);

  // 삭제 전에 한 번 더 묻는다. 정원이 있으면 정원도 함께 지워진다는 것을 알린다.
  async function remove(account: User) {
    const count = gardensOf(data, account.id).length;
    const who = `${account.name}(${account.email})`;
    const accepted = await confirm({
      title: "계정 삭제",
      message:
        count > 0
          ? `${who} 계정에 정원 ${count}곳이 등록돼 있습니다. 삭제하면 정원 ${count}곳도 함께 삭제되고 되돌릴 수 없습니다. 삭제할까요?`
          : `${who} 계정을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`,
      confirmLabel: "삭제",
      tone: "danger",
    });
    if (accepted) store.deleteCustomer(account.id);
  }

  const actions = (account: User) => (
    <td className="adm-row-actions" onClick={stop} onKeyDown={stop}>
      <div>
        <button
          className="adm-icon-btn"
          aria-label={`${account.name} 계정 수정`}
          title="수정"
          onClick={() => setEditingId(account.id)}
        >
          <Pencil size={15} />
        </button>
        {real && (
          <button
            className="adm-icon-btn adm-icon-danger"
            aria-label={`${account.name} 계정 삭제`}
            title={
              account.id === store.me.id
                ? "자기 계정은 삭제할 수 없습니다."
                : "삭제"
            }
            disabled={account.id === store.me.id || store.busy}
            onClick={() => remove(account)}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </td>
  );

  const shown = (c: {
    status: string;
    name: string;
    email: string;
    phone: string;
    id: string;
  }) =>
    (status === "all" || c.status === status) &&
    matches(q, c.name, c.email, c.phone, c.id);
  const admins = data.admins.filter(shown);
  const rows = data.customers.filter(shown);

  return (
    <div className="adm-stack">
      <div className="adm-toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="이름·이메일·연락처 검색"
        />
        <Dropdown
          label="상태"
          className="adm-filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "전체 상태" },
            { value: "active", label: "이용 중" },
            { value: "suspended", label: "정지" },
          ]}
        />
        <button
          className="primary-button adm-add"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={15} /> 운영자 추가
        </button>
      </div>

      {adding && (
        <AddCustomerForm
          taken={data.customers.map((c) => c.email)}
          onCancel={() => setAdding(false)}
          busy={store.busy}
          withPassword={!isDemoSession()}
          onSubmit={(c) =>
            store.forms.addCustomer(c).then((failed) => {
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
              <th>계정</th>
              <th>역할</th>
              <th>연락처</th>
              <th>정원</th>
              <th>장비</th>
              <th>가입일</th>
              <th>상태</th>
              <th className="adm-row-actions">관리</th>
            </tr>
          </thead>
          <tbody>
            {/* 관리자 계정은 시험용 정원만 있고, 이 화면에서 정지하지 않는다. */}
            {admins.map((a) => (
              <tr key={a.id} className="adm-row-static">
                <td>
                  <strong>{a.name}</strong>
                  <small>{a.email}</small>
                </td>
                <td>
                  <Badge tone="info">관리자</Badge>
                </td>
                <td>{a.phone}</td>
                <td>{gardensOf(data, a.id).length}곳</td>
                <td>-</td>
                <td>{a.joined}</td>
                <td>
                  <CustomerBadge status={a.status} />
                </td>
                {actions(a)}
              </tr>
            ))}
            {rows.map((c) => {
              const gardens = gardensOf(data, c.id);
              const devices = new Set(
                gardens.map((g) => g.deviceId).filter(Boolean),
              );
              return (
                <tr
                  key={c.id}
                  onClick={() => open("customer", c.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && open("customer", c.id)}
                >
                  <td>
                    <strong>{c.name}</strong>
                    <small>{c.email}</small>
                  </td>
                  <td>
                    <Badge tone="muted">운영자</Badge>
                  </td>
                  <td>{c.phone}</td>
                  <td>{gardens.length}곳</td>
                  <td>{devices.size ? [...devices].join(", ") : "-"}</td>
                  <td>{c.joined}</td>
                  <td>
                    <CustomerBadge status={c.status} />
                  </td>
                  {actions(c)}
                </tr>
              );
            })}
            {rows.length + admins.length === 0 && (
              <tr>
                <td colSpan={8} className="adm-empty">
                  조건에 맞는 계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditAccount
          // 다른 계정을 열면 입력값을 새로 시작한다.
          key={editing.id}
          account={editing}
          busy={store.busy}
          withPassword={real}
          onClose={() => setEditingId(null)}
          onSave={(patch) =>
            store.forms.updateCustomer(editing.id, patch).then((failed) => {
              if (!failed) setEditingId(null);
              return failed;
            })
          }
        />
      )}
      {dialog}
    </div>
  );
}

/** 계정 수정 창. 이름·연락처를 고치고, 실제 서버 계정이면 비밀번호도 다시 정한다. */
function EditAccount({
  account,
  busy,
  withPassword,
  onClose,
  onSave,
}: {
  account: User;
  busy: boolean;
  withPassword: boolean;
  onClose: () => void;
  /** 실패하면 안내 문장을, 성공하면 null 을 돌려준다. */
  onSave: (patch: {
    name?: string;
    phone?: string;
    password?: string;
  }) => Promise<string | null>;
}) {
  // 서버가 거절한 이유. 창 안에 보여 준다.
  const [failed, setFailed] = useState("");
  const [name, setName] = useState(account.name);
  // 저장된 값이 "-"이거나 하이픈이 없어도 같은 형식으로 맞춰서 시작한다.
  const savedPhone = formatPhone(account.phone);
  const [phone, setPhone] = useState(savedPhone);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const patch = {
    ...(name.trim() !== account.name ? { name: name.trim() } : {}),
    ...(phone !== savedPhone ? { phone } : {}),
    ...(password ? { password } : {}),
  };
  const problem = !name.trim()
    ? "이름을 입력해 주세요."
    : name.trim().length > 50
      ? "이름은 50자 이하로 입력해 주세요."
      : phone && !isPhone(phone)
        ? PHONE_PROBLEM
        : password && !PASSWORD_RULE.test(password)
          ? "비밀번호는 영문·숫자·특수문자 8~16자로 입력해 주세요."
          : password !== confirm
            ? "비밀번호 확인이 일치하지 않습니다."
            : "";
  const unchanged = Object.keys(patch).length === 0;
  return (
    <Drawer
      title="계정 수정"
      sub={account.role === "admin" ? "관리자" : "운영자"}
      onClose={onClose}
    >
      <Rows rows={[["이메일", account.email]]} />
      <form
        className="adm-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem && !unchanged)
            onSave(patch).then((message) => setFailed(message ?? ""));
        }}
      >
        <label>
          <span>이름 (필수)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>연락처</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
        </label>
        {withPassword && (
          <>
            <label>
              <span>새 비밀번호</span>
              <input
                type="password"
                autoComplete="new-password"
                maxLength={16}
                placeholder="바꾸지 않으려면 비워 둡니다"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              <span>새 비밀번호 확인</span>
              <input
                type="password"
                autoComplete="new-password"
                maxLength={16}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          </>
        )}
        <div className="adm-form-foot">
          <p role="status">{problem || failed}</p>
          <button type="button" className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={!!problem || unchanged || busy}
          >
            저장
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function AddCustomerForm({
  taken,
  busy,
  withPassword,
  onCancel,
  onSubmit,
}: {
  taken: string[];
  /** 요청을 처리하는 중이면 추가 버튼을 잠근다. */
  busy: boolean;
  /** 실제 서버 계정일 때만 역할과 비밀번호를 받는다. 가상 데이터는 운영자·기본 비밀번호로 만든다. */
  withPassword: boolean;
  onCancel: () => void;
  /** 실패하면 안내 문장을, 성공하면 null 을 돌려준다. */
  onSubmit: (c: NewCustomer) => Promise<string | null>;
}) {
  // 서버가 거절한 이유. 폼 안에 보여 준다.
  const [failed, setFailed] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const problem = !name.trim()
    ? "이름을 입력해 주세요."
    : !/^\S+@\S+\.\S+$/.test(email.trim())
      ? "이메일 형식을 확인해 주세요."
      : taken.includes(email.trim())
        ? "이미 등록된 이메일입니다."
        : phone && !isPhone(phone)
          ? PHONE_PROBLEM
          : !withPassword
            ? ""
            : !PASSWORD_RULE.test(password)
              ? "비밀번호는 영문·숫자·특수문자 8~16자로 입력해 주세요."
              : password !== confirm
                ? "비밀번호 확인이 일치하지 않습니다."
                : "";
  return (
    <form
      className="adm-card adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem)
          onSubmit({
            name: name.trim(),
            email: email.trim(),
            // 가상 데이터는 빈 연락처를 "-"로 둔다.
            phone: phone || (withPassword ? "" : "-"),
            ...(withPassword ? { role, password } : {}),
          }).then((message) => setFailed(message ?? ""));
      }}
    >
      <h2>{withPassword ? "새 계정" : "새 운영자 계정"}</h2>
      <div className="adm-form-grid">
        <label>
          <span>이름 (필수)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>이메일 (필수)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          <span>연락처</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
        </label>
        {withPassword && (
          <>
            <label>
              <span>역할</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="operator">운영자</option>
                <option value="admin">관리자</option>
              </select>
            </label>
            <label>
              <span>비밀번호 (필수)</span>
              <input
                type="password"
                autoComplete="new-password"
                maxLength={16}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              <span>비밀번호 확인 (필수)</span>
              <input
                type="password"
                autoComplete="new-password"
                maxLength={16}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          </>
        )}
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
          추가
        </button>
      </div>
    </form>
  );
}
