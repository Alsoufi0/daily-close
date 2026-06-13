"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RefQr } from "../../../../components/ref-qr";
import { useSession } from "../../../../lib/use-session";
import {
  ApiError,
  PartnerFunnel,
  ReferredAccount,
  getPartnerFunnel,
  getPartnerReferrals,
  updatePartner
} from "../../../../lib/api-client";

function StatusPill({ status, inTrial }: { status: string; inTrial: boolean }) {
  const label = inTrial ? "In trial" : status.charAt(0) + status.slice(1).toLowerCase();
  const cls = inTrial
    ? "bg-amber-100 text-amber-700"
    : status === "ACTIVE"
      ? "bg-leaf/10 text-leaf"
      : status === "PAST_DUE"
        ? "bg-orange-100 text-orange-700"
        : "bg-ink/10 text-ink/55";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

function refUrl(refCode: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/r/${refCode}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-ink/45">{label}</div>
      <div className="mt-1 text-2xl font-black text-ink">{value}</div>
    </div>
  );
}

function FunnelInner() {
  const params = useParams();
  const id = String(params?.id || "");
  const session = useSession();
  const [data, setData] = useState<PartnerFunnel | null>(null);
  const [accounts, setAccounts] = useState<ReferredAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratePct, setRatePct] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!session.token) return;
    try {
      const [d, accts] = await Promise.all([
        getPartnerFunnel(session.token, id),
        getPartnerReferrals(session.token, id)
      ]);
      setData(d);
      setAccounts(accts);
      setRatePct(d.partner.commissionRate === null ? "" : String(d.partner.commissionRate * 100));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, id]);

  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSavingRate(true);
    setMsg(null);
    try {
      const trimmed = ratePct.trim();
      const commissionRate = trimmed === "" ? null : Number(trimmed) / 100;
      if (commissionRate !== null && (Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 1)) {
        throw new Error("Rate must be 0–100%.");
      }
      await updatePartner(session.token, id, { commissionRate });
      setMsg("Saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSavingRate(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }
  if (!data) {
    return <p className="text-ink/55">Partner not found.</p>;
  }

  const { partner, funnel } = data;
  return (
    <div className="space-y-6">
      <Link href="/console/partners" className="inline-flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-leaf">
        <ArrowLeft size={15} aria-hidden /> All partners
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-ink">{partner.name}</h1>
          <p className="text-sm text-ink/55">
            Code <code className="font-mono">{partner.refCode}</code> ·{" "}
            {partner.active ? "Active" : "Inactive"}
          </p>
          {partner.contact && <p className="text-sm text-ink/55">{partner.contact}</p>}
          {partner.payoutDetails && (
            <p className="text-sm text-ink/55">Payout: {partner.payoutDetails}</p>
          )}
        </div>
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <RefQr url={refUrl(partner.refCode)} label={partner.name} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Scanned" value={funnel.scanned} />
        <Stat label="Signed up" value={funnel.signedUp} />
        <Stat label="In trial" value={funnel.inTrial} />
        <Stat label="Active" value={funnel.active} />
        <Stat label="This month" value={`$${funnel.thisMonthPayout.toFixed(2)}`} />
        <Stat label="Lifetime earned" value={`$${funnel.lifetimeApprovedOrPaid.toFixed(2)}`} />
      </div>

      <form onSubmit={saveRate} className="max-w-md space-y-2 rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-ink/75">Commission rate override (%)</span>
          <input
            value={ratePct}
            onChange={(e) => setRatePct(e.target.value)}
            inputMode="decimal"
            placeholder="Blank = platform default"
            className="w-full rounded-lg border border-ink/15 px-3 py-2"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingRate}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white hover:bg-leaf/90 disabled:opacity-60"
          >
            {savingRate && <Loader2 className="animate-spin" size={15} aria-hidden />} Save rate
          </button>
          {msg && <span className="text-sm text-ink/60">{msg}</span>}
        </div>
      </form>

      {/* Referred accounts roster — who actually subscribed & stayed */}
      <div>
        <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-ink/55">
          Referred accounts
        </h2>
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payments</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                    No one has signed up through this partner yet.
                  </td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr key={a.ownerId} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-bold text-ink">
                      {a.stores[0] || a.name}
                    </div>
                    {a.email && <div className="text-xs text-ink/50">{a.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={a.status} inTrial={a.inTrial} />
                  </td>
                  <td className="px-4 py-3 text-ink/80">
                    {a.payments}
                    <span className="text-ink/40"> paid</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-ink">${a.totalCommission.toFixed(2)}</td>
                  <td className="px-4 py-3 text-ink/60">
                    {a.joinedAt ? new Date(a.joinedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink/45">
          "Payments" = real monthly invoices paid (retention). "Active" means they're subscribed and
          still paying right now; "In trial" = signed up, not yet billed.
        </p>
      </div>
    </div>
  );
}

// Auth + console chrome are provided by app/console/layout.tsx.
export default FunnelInner;
