import { useEffect } from "react";
import { Square } from "lucide-react";

export default function StopWorkDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        document.querySelector<HTMLButtonElement>(".stop-button")?.focus();
      }
      if (event.key === "Tab") {
        const buttons =
          document.querySelectorAll<HTMLButtonElement>(".modal button");
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="modal-icon">
          <Square size={22} />
        </span>
        <h2 id="stop-title">이 회차를 종료할까요?</h2>
        <p>
          장비 정지·펌프 OFF·결과를 확인한 뒤 회차를 끝냅니다.
          <br />
          부분 수행과 남은 지점 결과는 이력에 보존됩니다.
        </p>
        <div>
          <button className="secondary-button" autoFocus onClick={onClose}>
            계속 보기
          </button>
          <button className="primary-button" onClick={onConfirm}>
            종료 요청
          </button>
        </div>
      </div>
    </div>
  );
}
