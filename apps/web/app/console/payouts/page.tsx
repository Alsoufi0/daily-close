"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Plus } from "lucide-react";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  CommissionRecord,
  PartnerRecord,
  createCommissionAdjustment,
  getCommissionSummary,
  listCommissions,
  listPartners,
  updateCommissionStatus
} from "../../../lib/api-client";

const STATUS_FILTERS = ["PENDING", "APPROVED", "PAID", "REVERSED", ""] as const;

function StatusBadge({ status }: { status: CommissionRecord["status"] }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-sky-100 text-sky-700",
    PAID: "bg-leaf/10 text-leaf",
    REVERSED: "bg-rose-100 text-rose-700"
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${map[status]}`}>{status}</span>;
}

function PayoutsInner() {
  const session = useSession();
  const [rows, setRows] = useState<CommissionRecord[]>([]);
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, { count: number; amount: number }>>({});
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [loading, setLoading] = useState(true);

  const [adjPartner, setAdjPartner] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjMsg, setAdjMsg] = useState<string | null>(null);
  const [showAdj, setShowAdj] = useState(false);

  async function refresh() {
    if (!session.token) return;
    const [list, sum] = await Promise.all([
      listCommissions(session.token, statusFilter ? { status: statusFilter } : {}),
      getCommissionSummary(session.token)
    ]);
    setRows(list);
    setSummary(sum);
  }

  useEffect(() => {
    if (!session.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      listCommissions(session.token, statusFilter ? { status: statusFilter } : {}),
      getCommissionSummary(session.token),
      listPartners(session.token)
    ])
      .then(([list, sum, ps]) => {
        if (cancelled) return;
        setRows(list);
        setSummary(sum);
        setPartners(ps);
      })
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token, statusFilter]);

  async function act(row: CommissionRecord, status: "APPROVED" | "PAID" | "REVERSED") {
    if (!session.token) return;
    let payoutReference: string | undefined;
    if (status === "PAID") {
      const ref = window.prompt("Payout reference (transaction id, check #, etc.):");
      if (!ref) return;
      payoutReference = ref;
    }
    try {
      await updateCommissionStatus(session.token, row.id, status, payoutReference);
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not update.");
    }
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setAdjMsg(null);
    try {
      const amount = Number(adjAmount);
      if (Number.isNaN(amount) || amount === 0) throw new Error("Enter a non-zero amount.");
      if (!adjPartner) throw new Error("Pick a partner.");
      if (adjNote.trim().length < 2) throw new Error("Add a short reason.");
      await createCommissionAdjustment(session.token, {
        partnerId: adjPartner,
        amount,
        note: adjNote.trim()
      });
      setAdjAmount("");
      setAdjNote("");
      setShowAdj(false);
      await refresh();
    } catch (err) {
      setAdjMsg(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }

  const summaryCards = useMemo(
    () =>
      (["PENDING", "APPROVED", "PAID", "REVERSED"] as const).map((s) => ({
        status: s,
        count: summary[s]?.count ?? 0,
        amount: summary[s]?.amount ?? 0
      })),
    [summary]
  );

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-black text-ink">
          <CreditCard size={18} aria-hidden /> Payouts
        </h1>
        <button
          type="button"
          onClick={() => setShowAdj((s) => !s)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-sm font-black text-ink/75 hover:bg-smoke"
        >
          <Plus size={16} aria-hidden /> Adjustment
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {summaryCards.map((c) => (
          <div key={c.status} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-ink/45">{c.status}</div>
            <div className="mt-1 text-xl font-black text-ink">${c.amount.toFixed(2)}</div>
            <div className="text-xs text-ink/50">{c.count} row(s)</div>
          </div>
        ))}
      </div>

      {showAdj && (
        <form onSubmit={submitAdjustment} className="space-y-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-ink/75">
            Manual adjustment — positive = bonus, negative = clawback.
          </p>
          {adjMsg && <p className="text-sm font-semibold text-rose-600">{adjMsg}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Partner</span>
              <select
                value={adjPartner}
                onChange={(e) => setAdjPartner(e.target.value)}
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
              >
                <option value="">Select…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.refCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Amount ($)</span>
              <input
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 25 or -49.99"
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Reason</span>
              <input
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
                placeholder="Signup bonus / refund clawback…"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="focus-ring rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white hover:bg-leaf/90"
            >
              Add to ledger
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdj(false);
                setAdjMsg(null);
                setAdjAmount("");
                setAdjNote("");
                setAdjPartner("");
              }}
              className="focus-ring rounded-lg border border-ink/15 px-4 py-2 text-sm font-bold text-ink/70 hover:bg-smoke"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || "ALL"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s
                ? "rounded-lg bg-leaf/10 px-3 py-1.5 text-sm font-bold text-leaf"
                : "rounded-lg px-3 py-1.5 text-sm font-bold text-ink/55 hover:bg-smoke"
            }
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                  No commissions{statusFilter ? ` with status ${statusFilter}` : ""} yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-bold text-ink">
                  {r.partner?.name || r.partnerId}
                  {r.note && <div className="text-xs font-normal text-ink/50">{r.note}</div>}
                </td>
                <td className="px-4 py-3 text-ink/70">{r.period}</td>
                <td className="px-4 py-3 text-ink/70">
                  {r.kind === "ADJUSTMENT" ? "Adjustment" : `Commission · ${(r.rate * 100).toFixed(1)}%`}
                </td>
                <td className={`px-4 py-3 font-bold ${r.amount < 0 ? "text-rose-600" : "text-ink"}`}>
                  ${r.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {r.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => act(r, "APPROVED")}
                        className="focus-ring rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-bold text-ink/70 hover:bg-smoke"
                      >
                        Approve
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => act(r, "PAID")}
                        className="focus-ring rounded-lg bg-leaf px-2.5 py-1 text-xs font-bold text-white hover:bg-leaf/90"
                      >
                        Mark paid
                      </button>
                    )}
                    {r.status !== "REVERSED" && r.status !== "PAID" && (
                      <button
                        type="button"
                        onClick={() => act(r, "REVERSED")}
                        className="focus-ring rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Reverse
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Auth + console chrome are provided by app/console/layout.tsx.
export default PayoutsInner;
