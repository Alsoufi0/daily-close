"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, CreditCard, Gift, Loader2, Sparkles, TimerReset } from "lucide-react";
import { useSession } from "../../lib/use-session";
import {
  getMyReferral,
  getSubscription,
  openBillingPortal,
  pauseStore,
  ReferralSummary,
  resumeStore,
  startSubscriptionCheckout,
  SubscriptionView
} from "../../lib/api-client";
import { RequireAuth } from "../../components/require-auth";
import { isAccountOwner } from "../../lib/session-roles";

const demoSub: SubscriptionView = {
  status: "TRIALING",
  plan: "Standard",
  trialEndsAt: new Date(Date.now() + 12 * 86_400_000).toISOString(),
  daysLeftInTrial: 12,
  active: true,
  activeStoreCount: 1,
  pausedStoreCount: 0,
  billedStoreQuantity: 1,
  stores: [{ id: "demo-1", storeName: "Your store", paused: false }],
  unitAmountCents: 4999,
  priceId: null,
  checkoutUrl: null,
  portalUrl: null
};

export default function BillingPage() {
  // Any signed-in user can land here: owners to manage billing, and
  // employees/managers when a guarded action 402'd because the owner's plan
  // lapsed (api-client redirects 402 → /billing). The inner view branches by
  // role so non-owners get an "ask the owner" notice instead of a checkout
  // they can't use — and we must NOT restrict roles here, or employees would
  // be bounced to /close and never see why their close was blocked.
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

  const [portalLoading, setPortalLoading] = useState(false);
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const referralLink =
    referral && typeof window !== "undefined"
      ? `${window.location.origin}/r/${referral.code}`
      : referral
        ? `https://dailyclose.us/r/${referral.code}`
        : "";

  async function copyReferral() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the input stays selectable.
    }
  }

  // Pause/resume a store from the billing page. After the toggle we re-fetch the
  // subscription so the counts (and the Stripe quantity) reflect the change.
  async function toggleStorePause(store: { id: string; paused: boolean }) {
    if (!session.token) return;
    setBusyStoreId(store.id);
    setStartError(null);
    try {
      if (store.paused) await resumeStore(session.token, store.id);
      else await pauseStore(session.token, store.id);
      const fresh = await getSubscription(session.token);
      setSub(fresh);
    } catch (err: any) {
      setStartError(err?.message || "Could not update the store.");
    } finally {
      setBusyStoreId(null);
    }
  }

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

  // Update card / view invoices / cancel — all inside the Stripe portal. We
  // mint the session on demand, so it works without a static portal URL.
  async function manageBilling() {
    if (!session.token) return;
    setPortalLoading(true);
    setStartError(null);
    try {
      const { url } = await openBillingPortal(session.token);
      window.location.href = url;
    } catch (err: any) {
      setStartError(err?.message || "Could not open billing portal.");
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    if (session.mode === "loading") return;
    // Only account owners have a subscription to load; for employees/managers
    // /subscriptions/me 403s, so skip the fetch and render the notice below.
    if (!isAccountOwner(session.profile)) {
      setLoading(false);
      return;
    }
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
    // Referral summary is non-blocking: the card only renders if it loads.
    getMyReferral(session.token)
      .then((r) => !cancelled && setReferral(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.mode, session.token, session.profile?.role]);

  // Employees / per-store managers don't manage billing. They only reach this
  // page when a guarded action 402'd — i.e. the store owner's plan lapsed — so
  // tell them what's happening and what to do, rather than a checkout they
  // can't use. (Their data is preserved; access returns when the owner renews.)
  if (session.mode !== "loading" && !isAccountOwner(session.profile)) {
    return <EmployeeBillingNotice />;
  }

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
  const pastDue = sub.status === "PAST_DUE";
  // "Expired" = no usable subscription (canceled/incomplete), NOT merely a
  // failed renewal — past-due still has portal access to fix the card.
  const expired = !sub.active && !pastDue;
  // An existing Stripe customer (active or past-due) manages/updates their card
  // through the billing PORTAL — never a brand-new checkout (which would try to
  // charge again). Only new/expired subscriptions go through checkout.
  // Active or past-due owners manage their card / cancel through the Stripe
  // portal (minted on demand — no static URL needed). Trial/expired go to
  // checkout to (re)subscribe.
  const portalAction = sub.status === "ACTIVE" || pastDue;
  const unitPrice = `$${(sub.unitAmountCents / 100).toFixed(2)}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">Billing</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Your subscription</h1>
        <p className="mt-1 text-base font-bold text-ink/65">
          $49.99 per store, per month. Billed monthly. Cancel anytime.
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
            {portalAction ? (
              // Active or past-due → open the Stripe billing portal to update
              // their card, view invoices, or cancel. No new charge.
              <button
                onClick={manageBilling}
                disabled={portalLoading || !session.token}
                className="focus-ring inline-flex h-12 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white disabled:opacity-60"
              >
                {portalLoading ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                {portalLoading ? "Opening…" : pastDue ? "Update payment & reactivate" : "Manage payment & cancel"}
              </button>
            ) : (
              // New / trialing / expired → start (or restart) a checkout.
              <button
                onClick={startCheckout}
                disabled={starting || !session.token}
                className="focus-ring inline-flex h-12 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white disabled:opacity-60"
              >
                {starting ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                {starting ? "Starting…" : expired ? "Choose plan" : "Start paid plan"}
              </button>
            )}
            {startError ? (
              <span className="text-xs font-bold text-warning">{startError}</span>
            ) : null}
          </div>
        </div>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <BillingStat label="Active stores" value={String(sub.activeStoreCount)} />
        <BillingStat label="Stores billed" value={String(sub.billedStoreQuantity)} />
        <BillingStat label="Price per store" value={unitPrice} />
      </section>
      <p className="mt-3 rounded-xl border border-leaf/20 bg-leaf/5 p-3 text-sm font-bold text-ink/70">
        Adding a store asks for confirmation and updates your monthly bill automatically.
      </p>

      {(sub.stores ?? []).length > 0 ? (
        <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black">Your stores</h3>
            {(sub.pausedStoreCount ?? 0) > 0 ? (
              <span className="text-xs font-black uppercase tracking-wide text-ink/55">
                {sub.pausedStoreCount} paused · not billed
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-bold text-ink/60">
            Pause any store you&apos;re not paying for right now. Paused stores aren&apos;t billed and
            can&apos;t record closes, but their history is kept — resume anytime.
          </p>
          <ul className="mt-4 divide-y divide-ink/10">
            {(sub.stores ?? []).map((store) => (
              <li key={store.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-ink">{store.storeName}</p>
                  <p
                    className={
                      store.paused
                        ? "text-xs font-black uppercase tracking-wide text-ink/45"
                        : "text-xs font-black uppercase tracking-wide text-leaf"
                    }
                  >
                    {store.paused ? "Paused · not billed" : "Active · billed"}
                  </p>
                </div>
                <button
                  onClick={() => toggleStorePause(store)}
                  disabled={busyStoreId === store.id || !session.token}
                  className={
                    store.paused
                      ? "focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-leaf px-4 text-sm font-black text-white disabled:opacity-60"
                      : "focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-ink/15 px-4 text-sm font-black text-ink disabled:opacity-60"
                  }
                >
                  {busyStoreId === store.id ? <Loader2 className="animate-spin" size={16} /> : null}
                  {store.paused ? "Resume" : "Pause"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {referral ? (
        <section className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Gift size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-black">Refer a shop owner, get free store-months</h3>
              <p className="mt-1 text-sm font-bold text-ink/65">
                Share your link. When a shop owner you refer makes their first payment, you earn a
                free month for every store they pay for — applied as credit on your next bill.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={referralLink}
              onFocus={(e) => e.currentTarget.select()}
              className="focus-ring h-12 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 font-bold text-ink/80"
              aria-label="Your referral link"
            />
            <button
              onClick={copyReferral}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gold px-4 font-black text-white"
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BillingStat label="Friends joined" value={String(referral.referralCount)} />
            <BillingStat
              label="Credit earned"
              value={`$${(referral.earnedCents / 100).toFixed(2)}`}
            />
          </div>
          {referral.pendingCents > 0 ? (
            <p className="mt-3 text-xs font-bold text-ink/55">
              ${(referral.pendingCents / 100).toFixed(2)} will apply to your bill once you start a
              paid plan.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <FeatureCard icon={<TimerReset size={20} />} title="Daily close in 2 min" body="Employees finish closing from their phone." />
        <FeatureCard icon={<CheckCircle2 size={20} />} title="Multi-store dashboard" body="See sales, missing cash, and alerts, all in one screen." />
        <FeatureCard icon={<CreditCard size={20} />} title="Audit-ready CSV" body="Export every close for your accountant." />
      </section>

      <p className="mt-8 text-center text-xs font-bold text-ink/55">
        Questions? <Link href="/terms" className="underline">Terms</Link> ·{" "}
        <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </main>
  );
}

function EmployeeBillingNotice() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-warning/40 bg-red-50 p-6 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-warning">
          <TimerReset size={16} /> Store plan paused
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Billing is managed by the store owner</h1>
        <p className="mt-3 text-base font-bold text-ink/70">
          If a close was just blocked, this store&apos;s subscription has lapsed. Please ask
          the store owner to renew it. You won&apos;t be able to submit closes until the plan
          is active again.
        </p>
        <p className="mt-2 text-base font-bold text-ink/70">
          Nothing is lost: all of your closes and data are safe and will be right here once
          the owner reactivates the plan.
        </p>
        <div className="mt-5">
          <Link
            href="/close"
            className="focus-ring inline-flex h-12 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white"
          >
            Back to closing
          </Link>
        </div>
      </div>
    </main>
  );
}

function BillingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-ink/55">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
    </div>
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
