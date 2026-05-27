"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, Pencil, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import { deleteDailyClose, getOwnerHistory, HistoryRow } from "../lib/api-client";
import { EditCloseModal } from "./edit-close-modal";

const ranges = [7, 14, 30] as const;
type Range = typeof ranges[number];

export function HistoryPanel({ token }: { token?: string }) {
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
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl bg-ink/10 sm:grid-cols-3">
          <div className="bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-ink/55">Total Sales</p>
            <p className="mt-1 text-2xl font-black">{formatMoney(totalSales)}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-ink/55">Shortages</p>
            <p
              className={clsx(
                "mt-1 text-2xl font-black",
                totalShortage < 0 ? "text-warning" : "text-leaf"
              )}
            >
              {formatMoney(totalShortage)}
            </p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-ink/55">Closes</p>
            <p className="mt-1 text-2xl font-black">{rows.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-ink/55">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            <span className="text-sm font-bold">Loading history…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-ink/55">
            No closes recorded in this range yet.
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left">
              <thead className="border-y border-ink/5 bg-smoke text-xs font-black uppercase tracking-wide text-ink/55">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Store</th>
                  <th className="px-4 py-2.5 text-right">Sales</th>
                  <th className="px-4 py-2.5 text-right">Diff</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5 text-sm font-bold">
                {rows.map((r) => (
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
                        aria-label="Edit close"
                        className="focus-ring rounded-lg p-2 text-ink/60 hover:bg-smoke hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => requestDelete(r)}
                        disabled={deleting === r.id}
                        aria-label="Delete close"
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
            {rows.map((r) => (
              <div
                key={r.id}
                className="focus-ring block w-full p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-ink">{r.storeName}</p>
                    <p className="mt-0.5 text-xs font-bold text-ink/55">{r.date}</p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-smoke p-3">
                    <p className="text-xs font-black uppercase text-ink/55">Sales</p>
                    <p className="text-lg font-black">{formatMoney(r.totalSales)}</p>
                  </div>
                  <div className="rounded-lg bg-smoke p-3">
                    <p className="text-xs font-black uppercase text-ink/55">Diff</p>
                    <p
                      className={clsx(
                        "text-lg font-black",
                        r.difference < 0 ? "text-warning" : r.difference > 0 ? "text-leaf" : "text-ink/55"
                      )}
                    >
                      {formatMoneyExact(r.difference)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(r)} className="focus-ring flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white">
                    Edit
                  </button>
                  <button onClick={() => requestDelete(r)} disabled={deleting === r.id} className="focus-ring flex-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-black text-warning disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
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
            Delete close
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="focus-ring rounded-lg p-1 text-ink/40 hover:bg-smoke hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-ink/65">
          Delete the close for <strong className="text-ink">{row.storeName}</strong> on{" "}
          <strong className="text-ink">{row.date}</strong>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring h-10 rounded-lg border border-ink/15 bg-white px-4 text-sm font-black text-ink hover:bg-smoke"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="focus-ring h-10 rounded-lg bg-warning px-4 text-sm font-black text-white hover:bg-warning/90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: HistoryRow["status"] }) {
  const map: Record<HistoryRow["status"], { label: string; cls: string }> = {
    CLOSED: { label: "Closed", cls: "bg-leaf/10 text-leaf" },
    SHORT: { label: "Short", cls: "bg-red-50 text-warning" },
    OVER: { label: "Over", cls: "bg-yellow-50 text-gold" },
    PENDING: { label: "Pending", cls: "bg-smoke text-ink/60" }
  };
  const { label, cls } = map[status];
  return <span className={clsx("rounded-full px-2 py-0.5 text-xs font-black", cls)}>{label}</span>;
}
