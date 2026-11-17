import { useCallback, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Trash2, X } from "lucide-react";
import "../styles/confirm-dialog.css";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

/** A modal confirmation; cancel is the initial and Escape/backdrop action. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const handlers = useRef({ onConfirm, onCancel });
  const restore = useRef<(() => void) | null>(null);
  const settled = useRef(false);
  const backdropDown = useRef(false);
  handlers.current = { onConfirm, onCancel };

  const finish = useCallback((accepted: boolean) => {
    if (settled.current) return;
    settled.current = true;
    // Restore before resolving the caller, so a keyboard navigation caller can
    // subsequently focus its new destination without the dialog overriding it.
    restore.current?.();
    if (accepted) handlers.current.onConfirm();
    else handlers.current.onCancel();
  }, []);

  useLayoutEffect(() => {
    settled.current = false;
    const previousFocus = document.activeElement;
    const focusAncestors: HTMLElement[] = [];
    if (previousFocus instanceof HTMLElement) {
      for (
        let parent = previousFocus.parentElement;
        parent;
        parent = parent.parentElement
      )
        focusAncestors.push(parent);
    }
    const backdrop = backdropRef.current!;
    const dialog = dialogRef.current!;
    const previousOverflow = document.body.style.overflow;
    const siblings = [...document.body.children]
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node !== backdrop,
      )
      .map((node) => ({ node, inert: node.inert }));
    siblings.forEach(({ node }) => {
      node.inert = true;
    });
    document.body.style.overflow = "hidden";
    let restored = false;
    restore.current = () => {
      if (restored) return;
      restored = true;
      siblings.forEach(({ node, inert }) => {
        node.inert = inert;
      });
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      } else {
        // A menu item may disappear while the dialog is open; return to a
        // surviving control in its nearest surviving container instead.
        for (const ancestor of focusAncestors) {
          if (!ancestor.isConnected) continue;
          const fallback = [
            ...ancestor.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]',
            ),
          ].find(
            (node) =>
              !backdrop.contains(node) && node.getClientRects().length > 0,
          );
          if (fallback) {
            fallback.focus({ preventScroll: true });
            break;
          }
        }
      }
    };
    cancelRef.current?.focus({ preventScroll: true });

    const keydown = (event: KeyboardEvent) => {
      if (settled.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish(false);
        return;
      }
      if (event.key !== "Tab") return;
      event.stopImmediatePropagation();
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (
        !settled.current &&
        event.target instanceof Node &&
        !dialog.contains(event.target)
      ) {
        cancelRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", containFocus, true);
    return () => {
      settled.current = true;
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", containFocus, true);
      restore.current?.();
      restore.current = null;
    };
  }, [finish]);

  const Icon = tone === "danger" ? Trash2 : CircleHelp;
  return createPortal(
    <div
      className="confirm-backdrop"
      ref={backdropRef}
      onPointerDown={(event) => {
        backdropDown.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropDown.current && event.target === event.currentTarget)
          finish(false);
        backdropDown.current = false;
      }}
    >
      <section
        ref={dialogRef}
        className={`confirm-dialog confirm-dialog-${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="confirm-close"
          aria-label="확인창 닫기"
          onClick={() => finish(false)}
        >
          <X size={18} />
        </button>
        <span className="confirm-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="confirm-actions">
          <button
            type="button"
            ref={cancelRef}
            className="confirm-cancel"
            onClick={() => finish(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-accept"
            onClick={() => finish(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
