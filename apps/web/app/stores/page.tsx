"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Plus,
  Search,
  Store as StoreIcon,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { OwnerDashboardSummary, StoreSummary } from "@dailyclose/shared/types";
import { formatMoney, formatMoneyExact } from "@dailyclose/shared/utils/money";
import { ApiError, getOwnerDashboard } from "../../lib/api-client";
import { useSession } from "../../lib/use-session";
import { isAccountOwner } from "../../lib/session-roles";
import { useShowMore } from "../../lib/use-show-more";
import { useLanguage } from "../../components/language-provider";
import { ShowMoreButton } from "../../components/show-more-button";
import { RequireAuth } from "../../components/require-auth";

type View = "grid" | "list";
type Filter = "all" | "closed" | "needs" | "open";

export default function StoresPage() {
  return (
    <RequireAuth allowedRoles={["STORE_OWNER", "SUPER_ADMIN"]} allowManagers>
      <StoresPageInner />
    </RequireAuth>
  );
}

// Status of a store for "today", derived from the live dashboard summary.
function storeStatus(s: StoreSummary): Filter {
  if (s.closedToday) return "closed";
  if (s.pastCloseTime) return "needs";
  return "open";
}

function StoresPageInner() {
  const session = useSession();
  // Only the account owner can add stores; per-store managers can't create.
  const accountOwner = isAccountOwner(session.profile);
  const { t, dir } = useLanguage();
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    // Wait for the auth token to resolve before fetching — on first render it's
    // briefly undefined, and firing then would set a spurious "Please sign in."
    // error that lingered even after the real fetch succeeded. RequireAuth
    // handles the genuinely-unauthenticated case.
    if (!session.token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOwnerDashboard(session.token)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load stores");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const stores = summary?.stores ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (filter !== "all" && storeStatus(s) !== filter) return false;
      if (q && !s.storeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stores, query, filter]);

  const { visible, hasMore, remaining, showMore } = useShowMore(filtered, 9);

  const counts = useMemo(
    () => ({
      all: stores.length,
      closed: stores.filter((s) => storeStatus(s) === "closed").length,
      needs: stores.filter((s) => storeStatus(s) === "needs").length,
      open: stores.filter((s) => storeStatus(s) === "open").length
    }),
    [stores]
  );

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("stores.filterAll") },
    { key: "closed", label: t("dashboard.closed") },
    { key: "needs", label: t("dashboard.needsClosing") },
    { key: "open", label: t("dashboard.open") }
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" dir={dir}>
      {/* Header band — a leaf-tinted gradient gives the page atmosphere
          instead of a flat white slab, while staying on-brand. */}
      <header className="relative overflow-hidden rounded-3xl border border-leaf/15 bg-gradient-to-br from-leaf/10 via-white to-white p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-leaf/10 blur-2xl"
        />
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-1.5 text-sm font-black text-ink/60 hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden /> {t("common.back") || "Dashboard"}
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-leaf">{t("stores.title")}</p>
            <h1 className="mt-1 flex items-baseline gap-3 text-4xl font-black tracking-tight text-ink sm:text-5xl">
              <span className="tabular-nums">{counts.all}</span>
              <span className="text-lg font-black text-ink/50 sm:text-xl">{t("stores.title")}</span>
            </h1>
          </div>
          {accountOwner ? (
            <Link
              href="/admin/stores"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-leaf px-5 font-black text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Plus size={18} aria-hidden /> {t("dashboard.addStore")}
            </Link>
          ) : null}
        </div>
      </header>

      {/* Controls: search · filter chips · view toggle */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex-1 lg:max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("stores.search")}
            className="focus-ring h-12 w-full rounded-full border border-ink/15 bg-white pl-10 pr-4 font-bold"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  filter === f.key
                    ? "focus-ring inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-sm font-black text-white"
                    : "focus-ring inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-sm font-black text-ink/70 hover:bg-smoke"
                }
              >
                {f.label}
                <span className={filter === f.key ? "text-white/70" : "text-ink/40"}>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          <div className="flex shrink-0 rounded-full border border-ink/15 bg-white p-1">
            <button
              onClick={() => setView("grid")}
              aria-label={t("stores.grid")}
              aria-pressed={view === "grid"}
              className={`focus-ring flex h-9 w-9 items-center justify-center rounded-full ${view === "grid" ? "bg-leaf text-white" : "text-ink/50 hover:text-ink"}`}
            >
              <LayoutGrid size={18} aria-hidden />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label={t("stores.list")}
              aria-pressed={view === "list"}
              className={`focus-ring flex h-9 w-9 items-center justify-center rounded-full ${view === "list" ? "bg-leaf text-white" : "text-ink/50 hover:text-ink"}`}
            >
              <ListIcon size={18} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <section className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-white py-20 font-black text-ink/50">
            <Loader2 className="animate-spin" size={20} aria-hidden /> …
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-warning/30 bg-red-50 p-6 font-bold text-warning">{error}</div>
        ) : stores.length === 0 ? (
          <EmptyState t={t} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-ink/10 bg-white p-10 text-center font-black text-ink/50">
            {t("stores.noMatch")}
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((s, i) => (
                <StoreCard key={s.id} store={s} index={i} t={t} />
              ))}
            </div>
            <ShowMoreButton hasMore={hasMore} remaining={remaining} onShowMore={showMore} />
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
              {visible.map((s, i) => (
                <StoreRow key={s.id} store={s} index={i} t={t} last={i === visible.length - 1} />
              ))}
            </div>
            <ShowMoreButton hasMore={hasMore} remaining={remaining} onShowMore={showMore} />
          </>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ store, t }: { store: StoreSummary; t: (k: string) => string }) {
  const status = storeStatus(store);
  if (status === "closed")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-leaf/10 px-2.5 py-1 text-xs font-black text-leaf">
        <CheckCircle2 size={13} aria-hidden /> {t("dashboard.closed")}
      </span>
    );
  if (status === "needs")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-black text-gold">
        <AlertTriangle size={13} aria-hidden /> {t("dashboard.needsClosing")}
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-smoke px-2.5 py-1 text-xs font-black text-ink/60">
      {t("dashboard.open")}
    </span>
  );
}

function accentClass(store: StoreSummary): string {
  const status = storeStatus(store);
  if (status === "closed") return "bg-leaf";
  if (status === "needs") return "bg-gold";
  return "bg-ink/15";
}

function StoreCard({ store, index, t }: { store: StoreSummary; index: number; t: (k: string) => string }) {
  const net = store.netProfit;
  return (
    <article
      className="fade-in group relative flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${accentClass(store)}`} />
      <div className="flex items-start justify-between gap-2 p-4 pb-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke text-ink transition-colors group-hover:bg-leaf/10 group-hover:text-leaf">
            <StoreIcon size={18} aria-hidden />
          </span>
          <h3 className="min-w-0 truncate text-lg font-black leading-tight">{store.storeName}</h3>
        </div>
        <StatusBadge store={store} t={t} />
      </div>

      <div className="p-4 pt-3">
        <p className="text-xs font-black uppercase tracking-wide text-ink/50">{t("dashboard.salesToday")}</p>
        <p className="text-3xl font-black tracking-tight">{store.closedToday ? formatMoney(store.totalSales) : "—"}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-smoke px-3 py-2">
            <p className="text-[11px] font-black uppercase text-ink/50">{t("dashboard.expenses")}</p>
            <p className="font-black">{store.closedToday ? formatMoney(store.expenses) : "—"}</p>
          </div>
          <div className="rounded-lg bg-smoke px-3 py-2">
            <p className="text-[11px] font-black uppercase text-ink/50">{t("dashboard.netProfit")}</p>
            <p className={`flex items-center gap-1 font-black ${net < 0 ? "text-warning" : "text-leaf"}`}>
              {store.closedToday ? (
                <>
                  {net < 0 ? <TrendingDown size={13} aria-hidden /> : <TrendingUp size={13} aria-hidden />}
                  {formatMoney(net)}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        {store.closedToday ? (
          <p className={`mt-3 text-sm font-bold ${store.difference < 0 ? "text-warning" : store.difference > 0 ? "text-gold" : "text-ink/55"}`}>
            {t("dashboard.cashDifference")}: {formatMoneyExact(store.difference)}
          </p>
        ) : (
          <p className="mt-3 text-sm font-bold text-ink/55">
            {t("dashboard.closeDueAt")} {store.closeTime ?? "23:30"}
          </p>
        )}
      </div>
    </article>
  );
}

function StoreRow({
  store,
  index,
  last,
  t
}: {
  store: StoreSummary;
  index: number;
  last: boolean;
  t: (k: string) => string;
}) {
  return (
    <div
      className={`fade-in flex flex-col gap-3 p-4 transition-colors hover:bg-smoke/60 sm:flex-row sm:items-center sm:justify-between ${last ? "" : "border-b border-ink/10"}`}
      style={{ animationDelay: `${Math.min(index, 16) * 30}ms` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className={`h-9 w-1.5 shrink-0 rounded-full ${accentClass(store)}`} />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-smoke text-ink">
          <StoreIcon size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate font-black">{store.storeName}</p>
          <div className="mt-0.5">
            <StatusBadge store={store} t={t} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:flex sm:items-center sm:gap-8 sm:text-right">
        <Stat label={t("dashboard.salesToday")} value={store.closedToday ? formatMoney(store.totalSales) : "—"} />
        <Stat label={t("dashboard.expenses")} value={store.closedToday ? formatMoney(store.expenses) : "—"} />
        <Stat
          label={t("dashboard.netProfit")}
          value={store.closedToday ? formatMoney(store.netProfit) : "—"}
          tone={store.closedToday ? (store.netProfit < 0 ? "bad" : "good") : undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 sm:min-w-[88px]">
      <p className="text-[11px] font-black uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`font-black ${tone === "bad" ? "text-warning" : tone === "good" ? "text-leaf" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-12 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf/10 text-leaf">
        <StoreIcon size={26} aria-hidden />
      </span>
      <p className="mt-4 text-xl font-black">{t("admin.noStores")}</p>
      <p className="mt-1 font-bold text-ink/60">{t("dashboard.noStoresBody")}</p>
      <Link
        href="/admin/stores"
        className="focus-ring mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-leaf px-6 font-black text-white"
      >
        <Plus size={18} aria-hidden /> {t("dashboard.addStore")}
      </Link>
    </div>
  );
}
