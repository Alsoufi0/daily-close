"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, Pencil, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import { deleteDailyClose, getOwnerHistory, HistoryRow } from "../lib/api-client";
import { useShowMore } from "../lib/use-show-more";
import { EditCloseModal } from "./edit-close-modal";
import { ListRevealControls } from "./show-more-button";
import { useLanguage } from "./language-provider";

const ranges = [7, 14, 30] as const;
type Range = typeof ranges[number];

export function HistoryPanel({ token }: { token?: string }) {
  const { t } = useLanguage();
  const [days, setDays] = useState<Range>(7);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HistoryRow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Audit fix #5: replaces window.confirm() with an accessible modal so
  // mobile + keyboard users get a real dialog instead of a native prompt.
  const [pendingDelete, setPendingDelete] = useState<HistoryRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOwnerHistory(token, days)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  const totalSales = rows.reduce((sum, r) => sum + r.totalSales, 0);
  const totalShortage = rows.reduce((sum, r) => sum + Math.min(r.difference, 0), 0);
  const { visible, hasMore, remaining, canShowLess, showMore, showLess } = useShowMore(rows, 5, days);

  function requestDelete(row: HistoryRow) {
    if (!token) return;
    setPendingDelete(row);
  }

  async function confirmDelete() {
    const row = pendingDelete;
    if (!row || !token) return;
    setDeleting(row.id);
    setPendingDelete(null);
    try {
      await deleteDailyClose(token, row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} aria-hidden className="text-leaf" />
          <h2 className="text-2xl font-black">History</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-ink/10 bg-white p-1">
          {ranges.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                "focus-ring rounded-md px-3 py-1 text-xs font-black",
                d === days ? "bg-leaf text-white" : "text-ink/60 hover:bg-smoke"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-t-xl bg-ink/10">
          <div className="bg-white p-3 sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-ink/55 sm:text-xs">{t("dashboard.totalSales")}</p>
            <p className="mt-1 text-lg font-black sm:text-2xl">{formatMoney(totalSales)}</p>
          </div>
          <div className="bg-white p-3 sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-ink/55 sm:text-xs">{t("dashboard.shortages")}</p>
            <p
              className={clsx(
                "mt-1 text-lg font-black sm:text-2xl",
                totalShortage < 0 ? "text-warning" : "text-leaf"
              )}
            >
              {formatMoney(totalShortage)}
            </p>
          </div>
          <div className="bg-white p-3 sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-ink/55 sm:text-xs">{t("dashboard.closes")}</p>
            <p className="mt-1 text-lg font-black sm:text-2xl">{rows.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-ink/55">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            <span className="text-sm font-bold">{t("history.loading")}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-ink/55">
            {t("history.empty")}
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left">
              <thead className="border-y border-ink/5 bg-smoke text-xs font-black uppercase tracking-wide text-ink/55">
                <tr>
                  <th className="px-4 py-2.5">{t("reports.closeDate")}</th>
                  <th className="px-4 py-2.5">{t("common.store")}</th>
                  <th className="px-4 py-2.5 text-right">{t("common.sales")}</th>
                  <th className="px-4 py-2.5 text-right">{t("closing.difference")}</th>
                  <th className="px-4 py-2.5">{t("common.status")}</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5 text-sm font-bold">
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-ink/70 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2.5 text-ink">{r.storeName}</td>
                    <td className="px-4 py-2.5 text-right font-black">{formatMoney(r.totalSales)}</td>
                    <td
                      className={clsx(
                        "px-4 py-2.5 text-right font-black",
                        r.difference < 0 ? "text-warning" : r.difference > 0 ? "text-leaf" : "text-ink/55"
                      )}
                    >
                      {formatMoneyExact(r.difference)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        aria-label={t("history.editClose")}
                        className="focus-ring rounded-lg p-2 text-ink/60 hover:bg-smoke hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => requestDelete(r)}
                        disabled={deleting === r.id}
                        aria-label={t("history.deleteClose")}
                        className="focus-ring rounded-lg p-2 text-warning/70 hover:bg-red-50 hover:text-warning disabled:opacity-50"
                      >
                        {deleting === r.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-ink/5 sm:hidden">
            {visible.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-sm font-black text-ink">{r.storeName}</p>
                    <span className="shrink-0">
                      <StatusPill status={r.status} />
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-ink/55">{r.date}</p>
                </div>
                <div className="shrink-0 text-right leading-tight">
                  <p className="text-sm font-black text-ink">{formatMoney(r.totalSales)}</p>
                  <p
                    className={clsx(
                      "text-xs font-black",
                      r.difference < 0 ? "text-warning" : r.difference > 0 ? "text-leaf" : "text-ink/55"
                    )}
                  >
                    {formatMoneyExact(r.difference)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => setEditing(r)}
                    aria-label={t("history.editClose")}
                    className="focus-ring rounded-lg p-2 text-ink/60 hover:bg-smoke hover:text-ink"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => requestDelete(r)}
                    disabled={deleting === r.id}
                    aria-label={t("history.deleteClose")}
                    className="focus-ring rounded-lg p-2 text-warning/70 hover:bg-red-50 hover:text-warning disabled:opacity-50"
                  >
                    {deleting === r.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3">
            <ListRevealControls
              hasMore={hasMore}
              canShowLess={canShowLess}
              remaining={remaining}
              onShowMore={showMore}
              onShowLess={showLess}
              showMoreLabel={t("common.showMore")}
              showLessLabel={t("common.showLess")}
            />
          </div>
          </>
        )}
      </div>

      {editing ? (
        <EditCloseModal
          row={editing}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(updated) =>
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
          }
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          row={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}

function ConfirmDeleteModal({
  row,
  onCancel,
  onConfirm
}: {
  row: HistoryRow;
  onCancel: () => void;
  onConfirm: () => void;
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
      aria-labelledby="delete-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="delete-confirm-title" className="text-lg font-black text-ink">
            {t("history.deleteClose")}
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
        <p className="mt-3 text-sm font-bold text-ink/65">
          {t("history.deleteConfirm")
            .replace("{store}", row.storeName)
            .replace("{date}", row.date)}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring h-10 rounded-lg border border-ink/15 bg-white px-4 text-sm font-black text-ink hover:bg-smoke"
          >
            {t("common.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="focus-ring h-10 rounded-lg bg-warning px-4 text-sm font-black text-white hover:bg-warning/90"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: HistoryRow["status"] }) {
  const { t } = useLanguage();
  const map: Record<HistoryRow["status"], { label: string; cls: string }> = {
    CLOSED: { label: t("dashboard.closed"), cls: "bg-leaf/10 text-leaf" },
    SHORT: { label: t("dashboard.short"), cls: "bg-red-50 text-warning" },
    OVER: { label: t("dashboard.over"), cls: "bg-yellow-50 text-gold" },
    PENDING: { label: t("dashboard.pending"), cls: "bg-smoke text-ink/60" }
  };
  const { label, cls } = map[status];
  return <span className={clsx("rounded-full px-2 py-0.5 text-xs font-black", cls)}>{label}</span>;
}
