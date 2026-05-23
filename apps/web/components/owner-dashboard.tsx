"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCcw,
  Store,
  X,
  XCircle
} from "lucide-react";
import { formatMoney } from "@smokeshop/shared/utils/money";
import type { OwnerDashboardSummary } from "@smokeshop/shared/types";
import {
  ApiError,
  downloadTodayCsv,
  getDemoDashboard,
  getOwnerDashboard,
  listEmployees,
  listStores,
  markNotificationRead
} from "../lib/api-client";
import { useSession } from "../lib/use-session";
import { MetricCard } from "./metric-card";
import { HistoryPanel } from "./history-panel";

const today = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric"
});

export function OwnerDashboard() {
  const session = useSession();
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function manualRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const data = await getOwnerDashboard(session.token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not refresh");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (session.mode === "loading") return;
    if (
      session.mode === "production" &&
      session.profile?.role === "STORE_OWNER" &&
      session.stores.length === 0
    ) {
      window.location.replace("/setup");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load(initial: boolean) {
      if (initial) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getOwnerDashboard(session.token);
        if (cancelled) return;
        setSummary(data);
        if (!initial) setError(null);
      } catch (err) {
        if (cancelled) return;
        if (initial) setSummary(getDemoDashboard());
        setError(err instanceof ApiError ? err.message : "Could not load dashboard");
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    }

    load(true);
    // Pre-fetch admin lists in the background so the Admin tab loads instantly.
    if (session.token) {
      listStores(session.token).catch(() => {});
      listEmployees(session.token).catch(() => {});
    }
    timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      load(false);
    }, 15_000);

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session.mode, session.token]);

  const allClosed = summary && summary.storesClosed === summary.totalStores;
  const shortageStore = summary?.stores.find((store) => store.difference < 0);
  const maxSales = useMemo(
    () => Math.max(1, ...(summary?.stores.map((s) => (s.closedToday ? s.totalSales : 0)) ?? [])),
    [summary]
  );
  const visibleAlerts = summary?.alerts.filter((a) => a.status !== "READ") ?? [];

  async function dismissAlert(id: string) {
    if (!session.token) {
      setSummary((prev) =>
        prev ? { ...prev, alerts: prev.alerts.filter((a) => a.id !== id) } : prev
      );
      return;
    }
    setDismissing(id);
    try {
      await markNotificationRead(session.token, id);
      setSummary((prev) =>
        prev
          ? { ...prev, alerts: prev.alerts.map((a) => (a.id === id ? { ...a, status: "READ" } : a)) }
          : prev
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not dismiss alert");
    } finally {
      setDismissing(null);
    }
  }

  async function exportCsv() {
    setDownloading(true);
    try {
      const blob = await downloadTodayCsv(session.token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-close-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download CSV");
    } finally {
      setDownloading(false);
    }
  }

  if (loading && !summary) return <DashboardSkeleton />;
  if (!summary) return null;

  const ownerName = session.profile?.name ?? "there";
  const modeLabel = session.mode === "production" ? "Production data" : "Demo data";

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black uppercase tracking-wide text-leaf sm:text-sm">
            <span>Welcome, {ownerName}</span>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-leaf/40" aria-hidden />
            <span className="text-ink/55">{modeLabel}</span>
            {loading ? <Loader2 className="animate-spin text-ink/40" size={14} aria-hidden /> : null}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-4xl">
            Today's Store Close
          </h1>
          <p className="mt-1 text-sm font-bold text-ink/65 sm:text-base">
            {today} · updates every 15 seconds
          </p>
        </div>
        <div className="flex w-full min-w-0 gap-2 sm:w-auto">
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-3 font-bold text-ink hover:bg-smoke disabled:opacity-60"
          >
            <RefreshCcw
              size={16}
              aria-hidden
              className={refreshing ? "animate-spin" : undefined}
            />
            <span className="sm:hidden">Refresh</span>
          </button>
          <button
            onClick={exportCsv}
            disabled={downloading}
            className="focus-ring inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-3 font-bold text-white hover:bg-ink/90 disabled:opacity-60 sm:flex-none sm:px-4"
          >
            {downloading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Download size={18} aria-hidden />}
            {downloading ? "Downloading…" : "Export CSV"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Today's Sales" value={formatMoney(summary.totalSales)} />
        <MetricCard
          label="Stores Closed"
          value={`${summary.storesClosed}/${summary.totalStores}`}
          tone={allClosed ? "good" : "warning"}
        />
        <MetricCard
          label="Missing Cash"
          value={formatMoney(summary.missingCash)}
          tone={summary.missingCash < 0 ? "bad" : "good"}
        />
        <MetricCard
          label="Needs Attention"
          value={String(summary.needsAttention)}
          tone={summary.needsAttention === 0 ? "good" : "warning"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {visibleAlerts.length > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-yellow-50 p-4 text-gold">
            <AlertTriangle size={26} aria-hidden className="mt-0.5" />
            <div className="flex-1 space-y-0.5">
              <p className="text-lg font-black leading-snug">{visibleAlerts[0].message}</p>
              <p className="text-sm font-bold text-ink/65">Call the store or remind the employee.</p>
            </div>
            <button
              onClick={() => dismissAlert(visibleAlerts[0].id)}
              disabled={dismissing === visibleAlerts[0].id}
              aria-label="Dismiss alert"
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-gold hover:bg-yellow-100 disabled:opacity-50"
            >
              {dismissing === visibleAlerts[0].id ? (
                <Loader2 className="animate-spin" size={16} aria-hidden />
              ) : (
                <X size={16} aria-hidden />
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-leaf/30 bg-green-50 p-4 text-leaf">
            <CheckCircle2 size={26} aria-hidden className="mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-lg font-black leading-snug">No missed close alerts.</p>
              <p className="text-sm font-bold text-ink/65">Every assigned store has reported in.</p>
            </div>
          </div>
        )}

        {shortageStore ? (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-red-50 p-4 text-warning">
            <XCircle size={26} aria-hidden className="mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-lg font-black leading-snug">
                {shortageStore.storeName} is short {formatMoney(shortageStore.difference)}
              </p>
              <p className="text-sm font-bold text-ink/65">Cash counted is lower than expected.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-leaf/30 bg-green-50 p-4 text-leaf">
            <CheckCircle2 size={26} aria-hidden className="mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-lg font-black leading-snug">No cash shortage today.</p>
              <p className="text-sm font-bold text-ink/65">Counted cash matches expected for every store.</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-black">Store Comparison</h2>
        {summary.stores.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center">
            <p className="text-lg font-black">No stores yet.</p>
            <p className="mt-1 text-sm font-bold text-ink/60">
              Add your first store from the admin panel to start tracking closes.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summary.stores.map((store) => {
              const barWidth = store.closedToday ? Math.max(6, (store.totalSales / maxSales) * 100) : 0;
              // Past-close is authoritative from the API using the store timezone.
              // Never infer this from the owner's browser timezone.
              const pastClose = Boolean(store.pastCloseTime);
              const needsClosing = !store.closedToday && pastClose;
              const diffTone =
                !store.closedToday
                  ? needsClosing ? "warning" : "neutral"
                  : store.difference < 0 ? "bad" : "good";
              return (
                <article
                  key={store.id}
                  className="flex min-w-0 flex-col rounded-xl border border-ink/10 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-smoke text-ink">
                        <Store size={18} aria-hidden />
                      </span>
                      <h3 className="min-w-0 text-lg font-black leading-tight sm:text-xl">{store.storeName}</h3>
                    </div>
                    {store.closedToday ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-leaf/10 px-2 py-1 text-xs font-black text-leaf">
                        <CheckCircle2 size={14} aria-hidden /> Closed
                      </span>
                    ) : needsClosing ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-black text-gold">
                        <AlertTriangle size={14} aria-hidden /> Close not submitted
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-smoke px-2 py-1 text-[11px] font-black text-ink/60 sm:text-xs">
                        Open · closes {store.closeTime ?? "23:30"}
                      </span>
                    )}
                  </div>

                  <p className="mt-5 text-xs font-black uppercase tracking-wide text-ink/55">Sales Today</p>
                  <p className="text-3xl font-black tracking-tight sm:text-4xl">
                    {store.closedToday ? formatMoney(store.totalSales) : "—"}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-smoke">
                    <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${barWidth}%` }} aria-hidden />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-smoke p-3">
                      <p className="text-xs font-black uppercase text-ink/55">Cash</p>
                      <p className="text-xl font-black">{store.closedToday ? formatMoney(store.cashSales) : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-smoke p-3">
                      <p className="text-xs font-black uppercase text-ink/55">Card</p>
                      <p className="text-xl font-black">{store.closedToday ? formatMoney(store.cardSales) : "—"}</p>
                    </div>
                  </div>

                  <div
                    className={
                      diffTone === "bad"
                        ? "mt-4 rounded-lg bg-red-50 p-3 text-warning"
                        : diffTone === "good"
                        ? "mt-4 rounded-lg bg-green-50 p-3 text-leaf"
                        : diffTone === "warning"
                        ? "mt-4 rounded-lg bg-yellow-50 p-3 text-gold"
                        : "mt-4 rounded-lg bg-smoke p-3 text-ink/65"
                    }
                  >
                    <p className="text-sm font-black">
                      {store.closedToday
                        ? `Cash difference: ${formatMoney(store.difference)}`
                        : needsClosing
                        ? "Today's close hasn't been submitted yet"
                        : `Today's close due at ${store.closeTime ?? "23:30"}`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {summary.stores.length === 1 ? (
          <a
            href="/admin/stores"
            className="focus-ring mt-3 flex items-center justify-between gap-3 rounded-xl border border-leaf/30 bg-leaf/5 p-4 text-leaf hover:bg-leaf/10"
          >
            <div>
              <p className="text-base font-black">Run more than one store?</p>
              <p className="text-sm font-bold text-ink/65">
                Add your next store — multi-store totals, missed-close alerts, and one weekly summary email come included.
              </p>
            </div>
            <span className="hidden sm:inline text-sm font-black">Add store →</span>
          </a>
        ) : null}
      </div>

      <HistoryPanel token={session.token} />
    </section>
  );
}

function isPastCloseTimeLocal(closeTime?: string): boolean {
  if (!closeTime) return false;
  const [hh, mm] = closeTime.split(":").map((x) => Number(x) || 0);
  const raw = hh * 60 + mm;
  // Stores closing 00:00–05:59 are conceptually end-of-day for the *previous*
  // business day; shift past 24h so we don't false-positive all day long.
  const closeMin = raw < 6 * 60 ? raw + 24 * 60 : raw;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= closeMin;
}

function DashboardSkeleton() {
  return (
    <section className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-40 rounded bg-smoke" />
        <div className="mt-2 h-9 w-72 rounded bg-smoke" />
        <div className="mt-2 h-4 w-32 rounded bg-smoke" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-ink/10 bg-smoke" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-60 rounded-xl border border-ink/10 bg-smoke" />
        ))}
      </div>
    </section>
  );
}
