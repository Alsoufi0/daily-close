"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, ImageIcon, Loader2, X } from "lucide-react";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import {
  ApiError,
  downloadAllReceipts,
  downloadReceipt,
  listReceipts,
  ReceiptRow
} from "../../../lib/api-client";
import { useSession } from "../../../lib/use-session";
import { useLanguage } from "../../../components/language-provider";
import { RequireAuth } from "../../../components/require-auth";

function todayMinus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function ReceiptsView() {
  const session = useSession();
  const { t, dir } = useLanguage();
  const [storeId, setStoreId] = useState<string>("");
  const [from, setFrom] = useState<string>(todayMinus(7));
  const [to, setTo] = useState<string>(todayMinus(0));
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReceiptRow | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const stores = session.stores;

  async function onDownloadAll() {
    if (!session.token || !storeId) return;
    setDownloadingAll(true);
    setError(null);
    try {
      await downloadAllReceipts(session.token, { storeId, from, to });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("receipts.loadFailed"));
    } finally {
      setDownloadingAll(false);
    }
  }

  useEffect(() => {
    if (!storeId && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, storeId]);

  useEffect(() => {
    if (!session.token || !storeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listReceipts(session.token, { storeId, from, to })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t("receipts.loadFailed"));
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.token, storeId, from, to, t]);

  const activeStoreName = useMemo(
    () => stores.find((s) => s.id === storeId)?.storeName ?? "",
    [stores, storeId]
  );

  return (
    <section className="space-y-5" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/owner"
            className="focus-ring inline-flex items-center gap-1 text-sm font-black text-ink/65 hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden />
            {t("nav.owner")}
          </Link>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            {t("receipts.title")}
          </h1>
        </div>
        <button
          type="button"
          onClick={onDownloadAll}
          disabled={!storeId || downloadingAll || rows.length === 0}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-3 text-sm font-black text-ink disabled:opacity-50 sm:w-auto sm:py-2"
        >
          {downloadingAll ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
          {t("receipts.downloadAll")}
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-ink/55">
            {t("receipts.store")}
          </span>
          <select
            className="focus-ring mt-1 h-12 w-full rounded-lg border border-ink/15 bg-white px-3 font-black"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-ink/55">
            {t("receipts.from")}
          </span>
          <input
            type="date"
            className="focus-ring mt-1 h-12 w-full rounded-lg border border-ink/15 px-3 font-black"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-ink/55">
            {t("receipts.to")}
          </span>
          <input
            type="date"
            className="focus-ring mt-1 h-12 w-full rounded-lg border border-ink/15 px-3 font-black"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-xl bg-smoke p-6 text-ink/70">
          <Loader2 className="animate-spin" size={22} aria-hidden />
          <span className="font-black">{t("common.loading")}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-white p-10 text-center">
          <ImageIcon className="mx-auto text-ink/40" size={36} aria-hidden />
          <p className="mt-3 font-black text-ink/70">{t("receipts.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="focus-ring overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-smoke">
                <img
                  src={row.imageUrl}
                  alt={`${row.storeName} ${row.closeDate}`}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.opacity = "0.3";
                  }}
                />
              </div>
              <div className="space-y-1 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-ink/55">
                  {row.closeDate}
                </p>
                <p className="text-base font-black text-ink">
                  {row.employeeName || activeStoreName || t("receipts.unknownEmployee")}
                </p>
                {row.dailyClose ? (
                  <p className="text-sm font-bold text-ink/65">
                    {t("receipts.totalSales")}: {formatMoney(row.dailyClose.totalSales)}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <ReceiptDetail
          receipt={selected}
          token={session.token}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}

function ReceiptDetail({
  receipt,
  token,
  onClose
}: {
  receipt: ReceiptRow;
  token: string | undefined;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dc = receipt.dailyClose;
  const [downloading, setDownloading] = useState(false);
  async function onDownload() {
    setDownloading(true);
    try {
      await downloadReceipt(token, receipt.id);
    } catch {
      // No-op — the detail modal already shows the image, the user can
      // right-click → Save As as a fallback. Keeping this quiet avoids a
      // toast for a feature they only just discovered.
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-ink/55">
              {receipt.closeDate}
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">{receipt.storeName}</h2>
            {receipt.employeeName ? (
              <p className="text-sm font-bold text-ink/65">
                {t("receipts.employee")}: {receipt.employeeName}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-black text-ink disabled:opacity-50"
            >
              {downloading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
              {t("receipts.download")}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.cancel")}
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-ink/15 text-ink/70 hover:bg-smoke"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <img
          src={receipt.imageUrl}
          alt={receipt.storeName}
          className="mx-auto max-h-[55vh] w-auto rounded-lg border border-ink/10"
        />
        {dc ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailRow label={t("receipts.totalSales")} value={formatMoney(dc.totalSales)} />
            <DetailRow label={t("common.cash")} value={formatMoney(dc.cashSales)} />
            <DetailRow label={t("common.card")} value={formatMoney(dc.cardSales)} />
            <DetailRow
              label={t("closing.difference")}
              value={formatMoneyExact(dc.difference)}
              tone={dc.difference < 0 ? "bad" : "good"}
            />
            <DetailRow label={t("common.status")} value={dc.status} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-smoke p-3">
      <p className="text-xs font-black uppercase tracking-wide text-ink/55">{label}</p>
      <p
        className={`mt-1 text-lg font-black ${
          tone === "bad" ? "text-warning" : tone === "good" ? "text-leaf" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <RequireAuth allowedRoles={["STORE_OWNER", "SUPER_ADMIN"]}>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <ReceiptsView />
      </main>
    </RequireAuth>
  );
}
