"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { formatMoneyExact, toMoney } from "@smokeshop/shared/utils/money";
import { ApiError, editDailyClose, HistoryRow } from "../lib/api-client";
import { useLanguage } from "./language-provider";

export function EditCloseModal({
  row,
  token,
  onClose,
  onSaved
}: {
  row: HistoryRow;
  token?: string;
  onClose: () => void;
  onSaved: (updated: HistoryRow) => void;
}) {
  const { t } = useLanguage();
  const [cashSales, setCashSales] = useState(String(row.cashSales));
  const [cardSales, setCardSales] = useState(String(row.cardSales));
  const [totalSales, setTotalSales] = useState(String(row.totalSales));
  const [countedCash, setCountedCash] = useState(String(row.countedCash ?? row.cashSales - row.difference));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const localUpdate = {
      ...row,
      cashSales: toMoney(cashSales),
      cardSales: toMoney(cardSales),
      totalSales: toMoney(totalSales),
      countedCash: toMoney(countedCash)
    };
    if (!token) {
      onSaved(localUpdate);
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated: any = await editDailyClose(token, row.id, {
        cashSales: localUpdate.cashSales,
        cardSales: localUpdate.cardSales,
        totalSales: localUpdate.totalSales,
        countedCash: localUpdate.countedCash,
        notes
      });
      onSaved({
        ...localUpdate,
        difference: updated.difference ?? row.difference,
        status: updated.status ?? row.status
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("history.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-leaf">{t("history.editClose")}</p>
            <h2 className="text-xl font-black">{row.storeName} - {row.date}</h2>
            <p className="mt-1 text-xs font-bold text-ink/55">
              {t("history.originalDifference")}: {formatMoneyExact(row.difference)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="focus-ring rounded-lg p-2 text-ink/55 hover:bg-smoke"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-lg border border-warning/30 bg-red-50 p-2 text-sm font-bold text-warning">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("closing.cashSales")} value={cashSales} onChange={setCashSales} />
          <Field label={t("closing.cardSales")} value={cardSales} onChange={setCardSales} />
          <Field label={t("closing.totalSales")} value={totalSales} onChange={setTotalSales} />
          <Field label={t("closing.cashCounted")} value={countedCash} onChange={setCountedCash} />
        </div>

        <label className="mt-3 block">
          <span className="text-sm font-black">{t("history.editReason")}</span>
          <textarea
            className="focus-ring mt-2 min-h-16 w-full rounded-lg border border-ink/15 p-3 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("history.editReasonPlaceholder")}
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="focus-ring h-11 flex-1 rounded-lg border-2 border-ink/15 bg-white font-black text-ink hover:bg-smoke"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="focus-ring flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {saving ? t("admin.saving") : t("admin.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-ink/55">{label}</span>
      <input
        className="focus-ring mt-1 h-11 w-full rounded-lg border border-ink/15 px-3 text-lg font-black"
        inputMode="decimal"
        value={value}
        onFocus={(e) => {
          if (e.currentTarget.value === "0") e.currentTarget.select();
        }}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
