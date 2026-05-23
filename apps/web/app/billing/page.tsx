"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, Loader2, Sparkles, TimerReset } from "lucide-react";
import { useSession } from "../../lib/use-session";
import { getSubscription, startSubscriptionCheckout, SubscriptionView } from "../../lib/api-client";
import { RequireAuth } from "../../components/require-auth";

const demoSub: SubscriptionView = {
  status: "TRIALING",
  plan: "Standard",
  trialEndsAt: new Date(Date.now() + 12 * 86_400_000).toISOString(),
  daysLeftInTrial: 12,
  active: true,
  checkoutUrl: null,
  portalUrl: null
};

export default function BillingPage() {
  return (
    <RequireAuth>
      <BillingPageInner />
    </RequireAuth>
  );
}

function BillingPageInner() {
  const session = useSession();
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function startCheckout() {
    if (!session.token) return;
    setStarting(true);
    setStartError(null);
    try {
      const { url } = await startSubscriptionCheckout(session.token);
      window.location.href = url;
    } catch (err: any) {
      setStartError(err?.message || "Could not start checkout.");
      setStarting(false);
    }
  }

  useEffect(() => {
    if (session.mode === "loading") return;
    if (!session.token) {
      setSub(demoSub);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getSubscription(session.token)
      .then((s) => !cancelled && setSub(s))
      .catch(() => !cancelled && setSub(demoSub))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.mode, session.token]);

  if (loading || !sub) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-ink/10 bg-white p-8 text-center text-sm font-bold text-ink/55">
          <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
          Loading subscription…
        </div>
      </main>
    );
  }

  const trialStatus = sub.status === "TRIALING";
  const expired = !sub.active;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">Billing</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Your subscription</h1>
        <p className="mt-1 text-base font-bold text-ink/65">
          $29 per store, per month. Billed monthly. Cancel anytime.
        </p>
      </header>

      <div
        className={
          expired
            ? "rounded-2xl border border-warning/40 bg-red-50 p-6 shadow-sm"
            : trialStatus
              ? "rounded-2xl border border-leaf/30 bg-leaf/5 p-6 shadow-sm"
              : "rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
        }
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
              {expired ? (
                <span className="text-warning">Subscription expired</span>
              ) : trialStatus ? (
                <>
                  <Sparkles size={14} className="text-leaf" /> <span className="text-leaf">Free trial</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-leaf" /> <span className="text-leaf">Active</span>
                </>
              )}
            </p>
            <h2 className="mt-1 text-2xl font-black">{sub.plan} plan</h2>
            {trialStatus && sub.daysLeftInTrial !== null ? (
              <p className="mt-1 text-base font-bold text-ink/70">
                {sub.daysLeftInTrial === 0
                  ? "Trial ends today."
                  : `${sub.daysLeftInTrial} day${sub.daysLeftInTrial === 1 ? "" : "s"} left in trial.`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row">
            <button
              onClick={startCheckout}
              disabled={starting || !session.token}
              className="focus-ring inline-flex h-12 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white disabled:opacity-60"
            >
              {starting ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
              {starting ? "Starting…" : expired ? "Choose plan" : trialStatus ? "Start paid plan" : "Update payment"}
            </button>
            {startError ? (
              <span className="text-xs font-bold text-warning">{startError}</span>
            ) : null}
            {sub.portalUrl ? (
              <a
                href={sub.portalUrl}
                className="focus-ring inline-flex h-12 items-center gap-2 rounded-lg border border-ink/15 bg-white px-4 font-black text-ink hover:bg-smoke"
              >
                Manage billing
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <FeatureCard icon={<TimerReset size={20} />} title="Daily close in 2 min" body="Employees finish closing from their phone." />
        <FeatureCard icon={<CheckCircle2 size={20} />} title="Multi-store dashboard" body="See sales, missing cash, alerts — all in one screen." />
        <FeatureCard icon={<CreditCard size={20} />} title="Audit-ready CSV" body="Export every close for your accountant." />
      </section>

      <p className="mt-8 text-center text-xs font-bold text-ink/55">
        Questions? <Link href="/terms" className="underline">Terms</Link> ·{" "}
        <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
        {icon}
      </span>
      <p className="mt-3 text-base font-black">{title}</p>
      <p className="mt-1 text-sm font-bold text-ink/65">{body}</p>
    </div>
  );
}
