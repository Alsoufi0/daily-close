"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLanguage } from "./language-provider";

// Accessible, in-app confirmation dialog — the styled replacement for
// window.confirm(). Mirrors the close-delete modal in history-panel so delete
// actions across the app look and behave the same (focus trap on confirm,
// Escape to cancel, click-outside to cancel).
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 id="confirm-dialog-title" className="text-lg font-black text-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("common.close")}
            className="focus-ring rounded-lg p-1 text-ink/40 hover:bg-smoke hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-ink/65">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring h-10 rounded-lg border border-ink/15 bg-white px-4 text-sm font-black text-ink hover:bg-smoke"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`focus-ring h-10 rounded-lg px-4 text-sm font-black text-white ${
              tone === "danger" ? "bg-warning hover:bg-warning/90" : "bg-leaf hover:bg-leaf/90"
            }`}
          >
            {confirmLabel ?? t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
