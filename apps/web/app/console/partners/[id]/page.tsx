"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RefQr } from "../../../../components/ref-qr";
import { useSession } from "../../../../lib/use-session";
import { ApiError, PartnerFunnel, getPartnerFunnel, updatePartner } from "../../../../lib/api-client";

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
  const [loading, setLoading] = useState(true);
  const [ratePct, setRatePct] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!session.token) return;
    try {
      const d = await getPartnerFunnel(session.token, id);
      setData(d);
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
    </div>
  );
}

// Auth + console chrome are provided by app/console/layout.tsx.
export default FunnelInner;
