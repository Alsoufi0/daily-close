"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
  getOwnerDashboard,
  listEmployees,
  listStores,
  markNotificationRead
} from "../lib/api-client";
import { useSession } from "../lib/use-session";
import { MetricCard } from "./metric-card";
import { HistoryPanel } from "./history-panel";
import { ExportReportModal } from "./export-report-modal";
import { useLanguage } from "./language-provider";

export function OwnerDashboard() {
  const session = useSession();
  const { t, lang } = useLanguage();
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  async function manualRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const data = await getOwnerDashboard(session.token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("dashboard.refreshFailed"));
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
        setError(err instanceof ApiError ? err.message : t("dashboard.loadFailed"));
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
    // Poll every 30s (was 15s — audit #9.1). The on-visible handler below
    // gives an instant refresh when the user returns to the tab, so 30s
    // doesn't make the dashboard feel stale; it just halves load on Render.
    timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      load(false);
    }, 30_000);

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session.mode, session.token, t]);

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
      setError(err instanceof ApiError ? err.message : t("dashboard.dismissFailed"));
    } finally {
      setDismissing(null);
    }
  }

  if (loading && !summary) return <DashboardSkeleton />;
  if (!summary) {
    return (
      <div className="rounded-xl border border-warning/30 bg-red-50 p-4 text-sm font-bold text-warning">
        {error || t("dashboard.loadFailed")}
      </div>
    );
  }

  const ownerName = session.profile?.name ?? t("dashboard.fallbackName");
  const modeLabel = session.mode === "production" ? t("dashboard.productionData") : t("dashboard.demoData");
  const today = new Date().toLocaleDateString(lang, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black uppercase tracking-wide text-leaf sm:text-sm">
            <span>{t("dashboard.welcome")} {ownerName}</span>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-leaf/40" aria-hidden />
            <span className="text-ink/55">{modeLabel}</span>
            {loading ? <Loader2 className="animate-spin text-ink/40" size={14} aria-hidden /> : null}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-4xl">
            {t("dashboard.title")}
          </h1>
          <p className="mt-1 text-sm font-bold text-ink/65 sm:text-base">
            {today} · {t("dashboard.updatesEvery15")}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            aria-label={t("common.refresh")}
            className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-3 font-bold text-ink hover:bg-smoke disabled:opacity-60"
          >
            <RefreshCcw
              size={16}
              aria-hidden
              className={refreshing ? "animate-spin" : undefined}
            />
            <span className="sm:hidden">{t("common.refresh")}</span>
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="focus-ring inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-3 font-bold text-white hover:bg-ink/90 disabled:opacity-60 sm:flex-none sm:px-4"
          >
            {t("common.export")}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={t("dashboard.salesToday")} value={formatMoney(summary.totalSales)} />
        <MetricCard
          label={t("dashboard.storesClosed")}
          value={`${summary.storesClosed}/${summary.totalStores}`}
          tone={allClosed ? "good" : "warning"}
        />
        <MetricCard
          label={t("dashboard.missingCash")}
          value={formatMoney(summary.missingCash)}
          tone={summary.missingCash < 0 ? "bad" : "good"}
        />
        <MetricCard
          label={t("dashboard.needsAttention")}
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
              <p className="text-sm font-bold text-ink/65">{t("dashboard.callStore")}</p>
            </div>
            <button
              onClick={() => dismissAlert(visibleAlerts[0].id)}
              disabled={dismissing === visibleAlerts[0].id}
              aria-label={t("dashboard.dismissAlert")}
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
              <p className="text-lg font-black leading-snug">{t("dashboard.noMissedAlerts")}</p>
              <p className="text-sm font-bold text-ink/65">{t("dashboard.everyStoreReported")}</p>
            </div>
          </div>
        )}

        {shortageStore ? (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-red-50 p-4 text-warning">
            <XCircle size={26} aria-hidden className="mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-lg font-black leading-snug">
                {shortageStore.storeName} {t("dashboard.isShort")} {formatMoney(shortageStore.difference)}
              </p>
              <p className="text-sm font-bold text-ink/65">{t("dashboard.cashLower")}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-leaf/30 bg-green-50 p-4 text-leaf">
            <CheckCircle2 size={26} aria-hidden className="mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-lg font-black leading-snug">{t("dashboard.noCashShortage")}</p>
              <p className="text-sm font-bold text-ink/65">{t("dashboard.cashMatches")}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-black">{t("dashboard.storeComparison")}</h2>
        {summary.stores.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center">
            <p className="text-lg font-black">{t("admin.noStores")}</p>
            <p className="mt-1 text-sm font-bold text-ink/60">
              {t("dashboard.noStoresBody")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summary.stores.map((store) => {
              const barWidth = store.closedToday ? Math.max(6, (store.totalSales / maxSales) * 100) : 0;
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
                        <CheckCircle2 size={14} aria-hidden /> {t("dashboard.closed")}
                      </span>
                    ) : needsClosing ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-black text-gold">
                        <AlertTriangle size={14} aria-hidden /> {t("dashboard.needsClosing")}
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-smoke px-2 py-1 text-[11px] font-black text-ink/60 sm:text-xs">
                        {t("dashboard.open")} · {t("dashboard.closesAt")} {store.closeTime ?? "23:30"}
                      </span>
                    )}
                  </div>

                  <p className="mt-5 text-xs font-black uppercase tracking-wide text-ink/55">{t("dashboard.salesToday")}</p>
                  <p className="text-3xl font-black tracking-tight sm:text-4xl">
                    {store.closedToday ? formatMoney(store.totalSales) : "—"}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-smoke">
                    <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${barWidth}%` }} aria-hidden />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-smoke p-3">
                      <p className="text-xs font-black uppercase text-ink/55">{t("common.cash")}</p>
                      <p className="text-xl font-black">{store.closedToday ? formatMoney(store.cashSales) : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-smoke p-3">
                      <p className="text-xs font-black uppercase text-ink/55">{t("common.card")}</p>
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
                        ? `${t("dashboard.cashDifference")}: ${formatMoney(store.difference)}`
                        : needsClosing
                        ? t("dashboard.closeNotSubmitted")
                        : `${t("dashboard.closeDueAt")} ${store.closeTime ?? "23:30"}`}
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
              <p className="text-base font-black">{t("dashboard.runMoreStores")}</p>
              <p className="text-sm font-bold text-ink/65">
                {t("dashboard.addNextStore")}
              </p>
            </div>
            <span className="hidden sm:inline text-sm font-black">{t("dashboard.addStore")}</span>
          </a>
        ) : null}
      </div>

      <HistoryPanel token={session.token} />
      {exportOpen ? <ExportReportModal token={session.token} onClose={() => setExportOpen(false)} /> : null}
    </section>
  );
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
