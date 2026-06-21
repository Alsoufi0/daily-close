"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  type LucideIcon,
  Percent,
  QrCode,
  ShieldCheck,
  Users,
  Wallet
} from "lucide-react";
import { useSession } from "../../lib/use-session";
import {
  PartnerRecord,
  getCommissionSummary,
  getReferralSettings,
  listPartners
} from "../../lib/api-client";

type Summary = Record<string, { count: number; amount: number }>;

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "amber" | "leaf";
}) {
  const toneMap = {
    default: "text-ink/40",
    amber: "text-amber-500",
    leaf: "text-leaf"
  } as const;
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-ink/45">{label}</div>
        <Icon size={16} className={toneMap[tone]} aria-hidden />
      </div>
      <div className="mt-1.5 text-2xl font-black text-ink">{value}</div>
      {sub && <div className="text-xs text-ink/50">{sub}</div>}
    </div>
  );
}

function ConsoleHome() {
  const session = useSession();
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      listPartners(session.token),
      getCommissionSummary(session.token),
      getReferralSettings(session.token).catch(() => null)
    ])
      .then(([ps, sum, settings]) => {
        if (cancelled) return;
        setPartners(ps);
        setSummary(sum);
        setRate(settings?.defaultCommissionRate ?? null);
      })
      .catch(() => !cancelled && setPartners([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const stats = useMemo(() => {
    const activePartners = partners.filter((p) => p.active).length;
    const totalScans = partners.reduce((n, p) => n + (p.scanCount ?? 0), 0);
    const referred = partners.reduce((n, p) => n + (p.referredOwnerCount ?? 0), 0);
    const pending = summary.PENDING ?? { count: 0, amount: 0 };
    const approved = summary.APPROVED ?? { count: 0, amount: 0 };
    const paid = summary.PAID ?? { count: 0, amount: 0 };
    return { activePartners, totalScans, referred, pending, approved, paid };
  }, [partners, summary]);

  const topPartners = useMemo(
    () => [...partners].sort((a, b) => (b.scanCount ?? 0) - (a.scanCount ?? 0)).slice(0, 5),
    [partners]
  );

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }

  const firstName = (session.profile?.name || "").split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black text-ink">
          <ShieldCheck size={18} aria-hidden /> Overview
        </h1>
        <p className="text-sm text-ink/55">
          {firstName ? `Welcome back, ${firstName}. ` : ""}
          Referral program at a glance.
        </p>
      </div>

      {/* Needs-attention banner */}
      {stats.pending.count > 0 ? (
        <Link
          href="/console/payouts"
          className="focus-ring flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:bg-amber-100"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-amber-500" aria-hidden />
            <div className="text-sm font-bold text-amber-800">
              {stats.pending.count} commission{stats.pending.count === 1 ? "" : "s"} (${stats.pending.amount.toFixed(2)})
              waiting for your approval
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-black text-amber-700">
            Review <ArrowRight size={13} aria-hidden />
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-leaf/20 bg-leaf/5 px-4 py-3">
          <CheckCircle2 size={18} className="text-leaf" aria-hidden />
          <div className="text-sm font-bold text-leaf">Nothing waiting for approval — you're all caught up.</div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Partners"
          value={String(partners.length)}
          sub={`${stats.activePartners} active`}
          icon={Handshake}
        />
        <Kpi label="QR scans" value={String(stats.totalScans)} sub="all-time" icon={QrCode} />
        <Kpi label="Referred accounts" value={String(stats.referred)} sub="signed up via a partner" icon={Users} />
        <Kpi
          label="Awaiting approval"
          value={`$${stats.pending.amount.toFixed(2)}`}
          sub={`${stats.pending.count} row(s)`}
          icon={Clock}
          tone="amber"
        />
        <Kpi
          label="Approved, owed"
          value={`$${stats.approved.amount.toFixed(2)}`}
          sub={`${stats.approved.count} to pay out`}
          icon={Wallet}
        />
        <Kpi
          label="Paid lifetime"
          value={`$${stats.paid.amount.toFixed(2)}`}
          sub={rate != null ? `Default rate ${(rate * 100).toFixed(0)}%` : undefined}
          icon={CheckCircle2}
          tone="leaf"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/console/partners", label: "Manage partners", desc: "Add, edit, get QR codes", icon: Handshake },
          { href: "/console/payouts", label: "Payouts & ledger", desc: "Approve and mark paid", icon: Wallet },
          { href: "/console/referral-settings", label: "Referral rate", desc: "Default commission %", icon: Percent }
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="focus-ring group flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-ink/20 hover:shadow"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
              <Icon size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-sm font-black text-ink">
                {label}
                <ArrowRight
                  size={13}
                  className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden
                />
              </div>
              <div className="truncate text-xs text-ink/50">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Top partners */}
      <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <h2 className="text-sm font-black text-ink">Top partners by scans</h2>
          <Link href="/console/partners" className="text-xs font-bold text-leaf hover:underline">
            View all
          </Link>
        </div>
        {topPartners.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink/50">
            No partners yet. Add your first one to start tracking referrals.
          </div>
        ) : (
          <ul className="divide-y divide-ink/5">
            {topPartners.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{p.name}</div>
                  <div className="text-xs text-ink/50">
                    Code {p.refCode}
                    {!p.active && <span className="ml-2 text-rose-500">inactive</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-ink">{p.scanCount ?? 0}</div>
                  <div className="text-[11px] text-ink/45">scans</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Auth + console chrome are provided by app/console/layout.tsx.
export default ConsoleHome;
