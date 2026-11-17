import { RefreshCw, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { agoOf, clockOf } from "../data/controlExample";
import type { Command, Run } from "../types/control";

type Kind = "estop" | "lost" | "fault";

const TITLE: Record<Kind, string> = {
  lost: "장비와 통신이 끊겼습니다",
  fault: "장비 이상이 보고되었습니다",
  estop: "비상정지를 요청했습니다",
};

/** 관제 요청 기록 · 장비 확인을 분리해 보여 준다. 기록만으로 정지 완료라고 쓰지 않는다. */
function stopRows(kind: Kind, run: Run, command: Command | null) {
  const stop =
    command &&
    (command.kind === "estop" ||
      command.kind === "pause" ||
      command.kind === "end")
      ? command
      : null;
  const request = stop
    ? { label: "전송 요청 기록", tone: "info" }
    : { label: "요청 없음", tone: "muted" };
  const confirm =
    kind === "lost" && !run.reconnected
      ? { label: "응답 미수신", tone: "warn" }
      : stop?.status === "confirmed"
        ? { label: "장비 정지 확인", tone: "ok" }
        : stop?.status === "acked"
          ? { label: "장비 수신(ACK) · 정지 미확인", tone: "warn" }
          : stop?.status === "timeout"
            ? { label: "응답 미수신", tone: "warn" }
            : stop
              ? { label: "확인 대기", tone: "warn" }
              : kind === "fault"
                ? { label: "장비 보고 확인", tone: "info" }
                : { label: "해당 없음", tone: "muted" };
  return { request, confirm };
}

export default function SafetyAlert({
  kind,
  run,
  command,
  lastReport,
  now,
  onRefresh,
  onClose,
}: {
  kind: Kind;
  run: Run;
  command: Command | null;
  lastReport: number | null;
  now: number;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [procedure, setProcedure] = useState(false);
  const { request, confirm } = stopRows(kind, run, command);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const unconfirmed = confirm.tone !== "ok";
  return (
    <div className="modal-backdrop safety-backdrop">
      <section
        className="safety-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="safety-title"
        aria-describedby="safety-body"
      >
        <button
          className="icon-button safety-close"
          aria-label="안내 닫기"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <span className="safety-tag">
          <ShieldAlert size={14} />
          안전 상태 확인 필요
        </span>
        <h2 id="safety-title">
          {kind === "lost" && run.reconnected
            ? "통신이 복구되었습니다"
            : TITLE[kind]}
        </h2>
        <p id="safety-body">
          {kind === "lost" && run.reconnected ? (
            <>
              장비 보고 수신이 다시 시작되었습니다.{" "}
              <strong>작업은 재개되지 않았습니다.</strong> 현장과 장비 상태를
              확인한 뒤 종료 여부를 결정하세요.
            </>
          ) : unconfirmed ? (
            <>
              {kind === "fault"
                ? "장비가 이상 상태를 보고했습니다. "
                : request.tone === "muted"
                  ? "장비 상태 보고가 끊겼습니다. "
                  : "관제에서 정지를 요청했지만 "}
              <strong>
                {request.tone === "muted" && kind !== "fault"
                  ? "실제 주행·펌프 상태는 확인되지 않았습니다."
                  : "실제 주행·펌프 정지 여부는 확인되지 않았습니다."}
              </strong>{" "}
              합의된 현장 안전 절차로 장비 상태를 확인하세요.
            </>
          ) : (
            <>
              장비가 주행·펌프 정지를 보고했습니다. 현장 확인 뒤 운영자가 다음
              조치를 결정합니다.
            </>
          )}
        </p>
        <dl className="safety-rows">
          <div>
            <dt>관제 정지 요청</dt>
            <dd>
              <span className={`tag ${request.tone}`}>{request.label}</span>
            </dd>
          </div>
          <div>
            <dt>장비 정지 확인</dt>
            <dd>
              <span className={`tag ${confirm.tone}`}>{confirm.label}</span>
            </dd>
          </div>
          <div>
            <dt>최근 장비 보고</dt>
            <dd>
              <strong>
                {lastReport
                  ? `${clockOf(lastReport)} · ${agoOf(lastReport, now)}`
                  : "수신 기록 없음"}
              </strong>
            </dd>
          </div>
          <div>
            <dt>대상</dt>
            <dd>
              <strong>
                {run.deviceId} · 회차 {run.id}
              </strong>
            </dd>
          </div>
        </dl>
        <p className="safety-note">
          재연결되어도 자동으로 재개하지 않습니다. 장비의 안전정지 해제 조건을
          확인한 뒤 운영자가 결정합니다.
        </p>
        {procedure && (
          <ol className="safety-procedure">
            <li>
              현장 담당자가 장비 위치로 이동해 주행·펌프 정지를 눈으로
              확인합니다.
            </li>
            <li>장비의 현장 정지 버튼 상태와 표시등을 확인합니다.</li>
            <li>
              확인 결과를 담당자에게 알리고, 관제에서 상태를 다시 조회합니다.
            </li>
            <li>담당자·해제 절차는 협의(D08·D12) 후 확정합니다.</li>
          </ol>
        )}
        <div className="safety-actions">
          <button
            className="primary-button"
            aria-expanded={procedure}
            onClick={() => setProcedure(!procedure)}
          >
            현장 확인 절차
          </button>
          <button className="secondary-button" onClick={onRefresh}>
            <RefreshCw size={14} />
            상태 다시 조회
          </button>
          <button
            className="secondary-button"
            disabled
            title="자동·원격 재개를 제공하지 않습니다"
          >
            재개 불가
          </button>
        </div>
        <p className="safety-foot">
          현장 조치 담당·정지 시간·해제 절차는 공동 협의 필요
        </p>
      </section>
    </div>
  );
}
