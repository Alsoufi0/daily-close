"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileImage,
  Loader2,
  PencilLine,
  Plus,
  Receipt,
  Trash2,
  Upload
} from "lucide-react";
import { clsx } from "clsx";
import { formatMoney, formatMoneyExact, netProfit, toMoney } from "@smokeshop/shared/utils/money";
import { suggestBusinessDate, shouldConfirmBusinessDate, storeLocalDateToUtcNoon } from "@smokeshop/shared/timezones";
import { scannedReport } from "../lib/mock-data";
import { ApiError, finishDailyClose, uploadReport } from "../lib/api-client";
import { preprocessReceipt } from "../lib/preprocess-image";
import { useSession } from "../lib/use-session";
import { MetricCard } from "./metric-card";
import { useLanguage } from "./language-provider";

type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "finish" | "blocked";

interface ExpenseRow {
  id: string;
  category: string;
  amount: string;
  description?: string;
}

const EXPENSE_CATEGORIES = [
  { value: "Supplies", labelKey: "closing.expenseSupplies" },
  { value: "Lottery payout", labelKey: "closing.expenseLottery" },
  { value: "Repair", labelKey: "closing.expenseRepair" },
  { value: "Check", labelKey: "closing.expenseCheck" },
  { value: "Cash paid out", labelKey: "closing.expenseCashPaidOut" },
  { value: "Other", labelKey: "closing.expenseOther" }
] as const;

function newExpenseRow(): ExpenseRow {
  const id =
    typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, category: "Supplies", amount: "0" };
}

const STEPS: {
  key: Exclude<Step, "start" | "blocked">;
  labelKey: string;
  shortKey: string;
}[] = [
  { key: "upload", labelKey: "closing.upload", shortKey: "closing.stepShortUpload" },
  { key: "sales", labelKey: "closing.sales", shortKey: "closing.stepShortSales" },
  { key: "cash", labelKey: "closing.cash", shortKey: "closing.stepShortCash" },
  { key: "expenses", labelKey: "closing.expenses", shortKey: "closing.stepShortExpenses" },
  { key: "finish", labelKey: "closing.finish", shortKey: "closing.stepShortFinish" }
];

function stepIndex(step: Step) {
  if (step === "start" || step === "blocked") return -1;
  return STEPS.findIndex((s) => s.key === step);
}

export function EmployeeClose() {
  const session = useSession();
  const { t, dir } = useLanguage();
  const [step, setStep] = useState<Step>("start");
  const [storeIdx, setStoreIdx] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  // All numbers start blank (0). They get populated either by the OCR parser
  // when auto-fill is enabled, or by the employee typing them from the photo.
  const [cashSales, setCashSales] = useState("0");
  const [cardSales, setCardSales] = useState("0");
  const [totalSales, setTotalSales] = useState("0");
  const [tax, setTax] = useState("0");
  const [refunds, setRefunds] = useState("0");
  const [cashCounted, setCashCounted] = useState("0");
  const [safeDrop, setSafeDrop] = useState("0");
  const [expenseItems, setExpenseItems] = useState<ExpenseRow[]>([]);
  const [scanningIdx, setScanningIdx] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [confirmingBusinessDate, setConfirmingBusinessDate] = useState(false);
  const [businessDate, setBusinessDate] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const expensesTotal = useMemo(
    () => expenseItems.reduce((sum, item) => sum + toMoney(item.amount), 0),
    [expenseItems]
  );

  const result = useMemo(() => {
    // toMoney parses strings like "1,169.27" / "$1169" / "1 169" safely.
    // Pre-fix this used bare Number() which returns NaN on commas → falls
    // through `|| 0` and silently zeros the field, producing a fake
    // -$1,169 shortage when the register actually matched.
    const expectedCash = toMoney(cashSales) - toMoney(refunds) - expensesTotal;
    const countedTotal = toMoney(cashCounted) + toMoney(safeDrop);
    return { expectedCash, difference: countedTotal - expectedCash };
  }, [cashCounted, cashSales, expensesTotal, refunds, safeDrop]);

  const currentIndex = stepIndex(step);
  const availableStores = session.stores.length > 0
    ? session.stores
    : session.profile?.storeId
      ? [{ id: session.profile.storeId, storeName: t("closing.myStore") }]
      : [{ id: "store-1", storeName: t("closing.defaultStore") }];
  const activeStore = availableStores[storeIdx] ?? availableStores[0];
  const employeeId = session.profile?.employeeId ?? "employee-maya";

  async function handleFile(rawFile: File | null) {
    if (!rawFile) return;
    setUploadError(null);
    setIsReading(true);
    setReportReady(false);
    setPreviewUrl(URL.createObjectURL(rawFile));
    try {
      // Whiten the paper + bump contrast client-side before upload — phone
      // photos of thermal receipts are otherwise too low-contrast for OCR.
      const file = await preprocessReceipt(rawFile);
      const upload = session.token
        ? {
            base64Data: await fileToDataUrl(file, t("closing.fileReadFailed")),
            fileName: file.name,
            contentType: file.type || "image/jpeg"
          }
        : undefined;
      const parsed = await uploadReport(session.token, activeStore.id, upload);
      setCashSales(String(parsed.cashSales));
      setCardSales(String(parsed.cardSales));
      setTotalSales(String(parsed.totalSales));
      setTax(String(parsed.tax));
      setRefunds(String(parsed.refunds));
      setOcrRawText(parsed.rawText ?? null);
      setReportReady(true);
    } catch (err: any) {
      setUploadError(err?.message || t("closing.uploadFailed"));
    } finally {
      setIsReading(false);
    }
  }

  // Scan an expense document: OCR reads a single amount and pre-fills the row's
  // amount (still editable). The photo is saved as an expense receipt and shows
  // up on the Receipts page under Expenses.
  async function handleExpenseFile(idx: number, rawFile: File | null) {
    if (!rawFile || !session.token) return;
    setUploadError(null);
    setScanningIdx(idx);
    try {
      const file = await preprocessReceipt(rawFile);
      const upload = {
        base64Data: await fileToDataUrl(file, t("closing.fileReadFailed")),
        fileName: file.name,
        contentType: file.type || "image/jpeg"
      };
      const res = await uploadReport(session.token, activeStore.id, upload, "expense");
      if (res.amount != null) {
        setExpenseItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, amount: String(res.amount) } : it))
        );
      } else {
        setUploadError(t("closing.scanNoAmountBody"));
      }
    } catch (err: any) {
      setUploadError(err?.message || t("closing.uploadFailed"));
    } finally {
      setScanningIdx(null);
    }
  }

  async function requestSubmitClose() {
    const suggested = suggestBusinessDate(activeStore);
    const needsConfirm = shouldConfirmBusinessDate(activeStore, suggested);
    if (needsConfirm && !confirmingBusinessDate) {
      setBusinessDate(suggested);
      setConfirmingBusinessDate(true);
      return;
    }
    await submitClose(businessDate || suggested);
  }

  async function submitClose(closeDate: string) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await finishDailyClose(session.token, {
        storeId: activeStore.id,
        employeeId,
        date: storeLocalDateToUtcNoon(closeDate, activeStore.timezone),
        cashSales: toMoney(cashSales),
        cardSales: toMoney(cardSales),
        totalSales: toMoney(totalSales),
        tax: toMoney(tax),
        refunds: toMoney(refunds),
        discounts: scannedReport.discounts,
        countedCash: toMoney(cashCounted),
        safeDropAmount: toMoney(safeDrop),
        expenses: expensesTotal,
        expenseItems: expenseItems
          .filter((item) => toMoney(item.amount) > 0 || item.category === "Other")
          .map((item) => ({
            category: item.category,
            amount: toMoney(item.amount),
            description: item.description?.trim() || undefined
          })),
        notes
      });
      setStep("finish");
      setConfirmingBusinessDate(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && /already.*closed/i.test(err.message)) {
        setStep("blocked");
      } else {
        setSubmitError(err instanceof ApiError ? err.message : t("closing.submitFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Clear ALL close-specific fields. Used after a completed close AND when the
  // user switches stores — previously reset() only touched step/reportReady,
  // so the prior store's photo, OCR numbers, expenses, and notes bled into the
  // next store's close (wrong + dangerous: an employee could submit Store B
  // with Store A's figures).
  function resetForm() {
    setReportReady(false);
    setCashSales("0");
    setCardSales("0");
    setTotalSales("0");
    setTax("0");
    setRefunds("0");
    setCashCounted("0");
    setSafeDrop("0");
    setExpenseItems([]);
    setNotes("");
    setPreviewUrl(null);
    setOcrRawText(null);
    setUploadError(null);
    setSubmitError(null);
    setConfirmingBusinessDate(false);
    setBusinessDate("");
  }

  function reset() {
    setStep("start");
    resetForm();
  }

  function changeStore(idx: number) {
    if (idx === storeIdx) return;
    setStoreIdx(idx);
    // Starting a fresh store → wipe the form and return to step 1 so nothing
    // carries over from the previous store's close.
    setStep("start");
    resetForm();
  }

  return (
    <section className="space-y-5" dir={dir}>
      <div>
        <p className="text-base font-bold text-ink/65">{t("closing.followSteps")}</p>

        {availableStores.length > 1 ? (
          <label className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-ink/70">
            <span>{t("common.store")}:</span>
            <select
              className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1 font-black"
              value={storeIdx}
              onChange={(e) => changeStore(Number(e.target.value))}
            >
              {availableStores.map((s, i) => (
                <option key={s.id} value={i}>{s.storeName}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {step !== "start" && step !== "blocked" ? (
        <StepProgress current={currentIndex} onJump={(k) => setStep(k as Step)} />
      ) : null}

      <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {step !== "start" && step !== "blocked" && step !== "finish" && currentIndex > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const prev = STEPS[currentIndex - 1]?.key;
                  if (prev) setStep(prev);
                }}
                aria-label={t("closing.backPreviousStep")}
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/15 text-ink/70 hover:bg-smoke"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
            ) : null}
            <h2 className="text-2xl font-black">
              {step === "start"
                ? t("closing.ready")
                : step === "blocked"
                  ? t("closing.alreadyClosed")
                  : t(STEPS[currentIndex]?.labelKey ?? "closing.start")}
            </h2>
          </div>
          {step !== "start" && step !== "blocked" ? (
            <p className="text-sm font-black text-ink/60">
              {t("closing.step")} {currentIndex + 1} {t("closing.of")} {STEPS.length}
            </p>
          ) : null}
        </div>

        {step === "start" ? (
          <div className="grid gap-4 fade-in">
            <button
              className="focus-ring flex min-h-28 w-full items-center justify-center gap-3 rounded-xl bg-leaf px-6 text-2xl font-black text-white shadow-sm transition-transform active:scale-[0.99]"
              onClick={() => setStep("upload")}
            >
              <Receipt size={32} aria-hidden />
              {t("closing.start")}
            </button>
            <p className="text-center text-base font-bold text-ink/60">
              {t("closing.followSteps")}
            </p>
          </div>
        ) : null}

        {step === "blocked" ? (
          <div className="space-y-4 rounded-xl bg-yellow-50 p-6 text-center">
            <CheckCircle2 className="mx-auto text-gold" size={48} aria-hidden />
            <h3 className="text-2xl font-black text-ink">{t("closing.alreadyClosed")}</h3>
            <p className="text-base font-bold text-ink/65">
              {t("closing.alreadyClosedBody")}
            </p>
            <button
              className="focus-ring h-12 rounded-lg bg-leaf px-5 font-black text-white"
              onClick={reset}
            >
              {t("closing.backStart")}
            </button>
          </div>
        ) : null}

        {step === "upload" ? (
          <div className="space-y-4 fade-in">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isReading}
                className="focus-ring flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-leaf bg-leaf/5 p-4 text-xl font-black text-leaf hover:bg-leaf/10 disabled:opacity-60"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={32} aria-hidden />
                {t("closing.takePhoto")}
              </button>
              <button
                type="button"
                disabled={isReading}
                className="focus-ring flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/25 bg-smoke p-4 text-xl font-black text-ink hover:bg-ink/5 disabled:opacity-60"
                onClick={() => libraryInputRef.current?.click()}
              >
                <Upload size={32} aria-hidden />
                {t("closing.uploadReport")}
              </button>
            </div>

            {previewUrl ? (
              <div className="rounded-xl border border-ink/10 bg-white p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink/55">{t("closing.preview")}</p>
                <img src={previewUrl} alt={t("closing.posPreviewAlt")} className="mx-auto max-h-64 rounded-lg" />
              </div>
            ) : null}

            {isReading ? (
              <div className="flex items-center gap-3 rounded-xl bg-yellow-50 p-4 text-gold">
                <Loader2 className="animate-spin" size={24} aria-hidden />
                <p className="text-lg font-black">{t("closing.reading")}</p>
              </div>
            ) : null}

            {uploadError ? (
              <div className="rounded-xl border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
                {uploadError}
              </div>
            ) : null}

            {reportReady ? (
              <div className="rounded-xl bg-leaf/5 p-4 text-leaf">
                <div className="flex items-center gap-2">
                  <FileImage size={22} aria-hidden />
                  <p className="text-lg font-black">
                    {Number(cashSales || 0) > 0
                      ? t("closing.reportFilled")
                      : t("closing.photoSaved")}
                  </p>
                </div>
                {ocrRawText ? (
                  <details className="mt-3 rounded-lg bg-white p-3 text-ink/75">
                    <summary className="cursor-pointer text-sm font-black text-ink/80">
                      {t("closing.ocrDetails")}
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5">
                      {ocrRawText.length > 0
                        ? ocrRawText
                        : t("closing.ocrEmpty")}
                    </pre>
                  </details>
                ) : null}
                <button
                  className="focus-ring mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white"
                  onClick={() => setStep("sales")}
                >
                  {t("closing.enterSales")}
                  <ChevronRight size={22} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "sales" ? (
          <div className="space-y-4 fade-in">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput label={t("closing.cashSales")} value={cashSales} onChange={setCashSales} />
              <MoneyInput label={t("closing.cardSales")} value={cardSales} onChange={setCardSales} />
              <MoneyInput label={t("closing.totalSales")} value={totalSales} onChange={setTotalSales} />
              <MoneyInput label={t("closing.tax")} value={tax} onChange={setTax} />
              <MoneyInput label={t("closing.refunds")} value={refunds} onChange={setRefunds} />
            </div>
            <button
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white"
              onClick={() => setStep("cash")}
            >
              {t("closing.numbersRight")}
              <ChevronRight size={22} aria-hidden />
            </button>
          </div>
        ) : null}

        {step === "cash" ? (
          <div className="space-y-4 fade-in">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput label={t("closing.cashCounted")} value={cashCounted} onChange={setCashCounted} />
              <MoneyInput label={t("closing.safeDrop")} value={safeDrop} onChange={setSafeDrop} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Cents always shown — see formatMoneyExact docstring. */}
              <MetricCard label={t("closing.expectedCash")} value={formatMoneyExact(result.expectedCash)} />
              <MetricCard
                label={t("closing.difference")}
                value={formatMoneyExact(result.difference)}
                tone={result.difference < 0 ? "bad" : "good"}
              />
            </div>
            <button
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white"
              onClick={() => setStep("expenses")}
            >
              {t("closing.expenses")}
              <ChevronRight size={22} aria-hidden />
            </button>
          </div>
        ) : null}

        {step === "expenses" ? (
          <div className="space-y-4 fade-in">
            <div className="space-y-3">
              {expenseItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink/20 bg-smoke p-4 text-center text-sm font-bold text-ink/60">
                  {t("closing.noExpenses")}
                </p>
              ) : null}
              {expenseItems.map((item, idx) => (
                <div key={item.id} className="rounded-xl border border-ink/10 bg-white p-3 shadow-sm">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-ink/55">
                        {t("closing.expenseCategory")}
                      </span>
                      <select
                        className="focus-ring mt-1 h-12 w-full rounded-lg border border-ink/15 bg-white px-3 text-base font-black"
                        value={item.category}
                        onChange={(event) => {
                          const next = [...expenseItems];
                          next[idx] = { ...item, category: event.target.value };
                          setExpenseItems(next);
                        }}
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {t(cat.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-ink/55">
                        {t("closing.expenseAmount")}
                      </span>
                      <input
                        className="focus-ring mt-1 h-12 w-full rounded-lg border border-ink/15 px-3 text-xl font-black"
                        inputMode="decimal"
                        value={item.amount}
                        onFocus={(event) => {
                          if (event.currentTarget.value === "0") event.currentTarget.select();
                        }}
                        onChange={(event) => {
                          const next = [...expenseItems];
                          next[idx] = { ...item, amount: event.target.value };
                          setExpenseItems(next);
                        }}
                      />
                    </label>
                    <label
                      aria-label={t("closing.scanExpense")}
                      className="focus-ring flex h-12 cursor-pointer items-center justify-center gap-1.5 self-end rounded-lg border border-leaf bg-leaf/5 px-3 text-sm font-black text-leaf hover:bg-leaf/10"
                    >
                      {scanningIdx === idx ? (
                        <Loader2 className="animate-spin" size={16} aria-hidden />
                      ) : (
                        <Camera size={16} aria-hidden />
                      )}
                      <span className="hidden sm:inline">{t("closing.scanExpense")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        disabled={scanningIdx !== null}
                        onChange={(event) => {
                          handleExpenseFile(idx, event.target.files?.[0] ?? null);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setExpenseItems(expenseItems.filter((_, i) => i !== idx))}
                      aria-label={t("closing.removeExpense")}
                      className="focus-ring flex h-12 w-12 items-center justify-center self-end rounded-lg border border-ink/15 text-ink/60 hover:bg-smoke"
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </div>
                  {item.category === "Other" ? (
                    <label className="mt-2 block">
                      <span className="text-xs font-black uppercase tracking-wide text-ink/55">
                        {t("closing.expenseDescription")}
                      </span>
                      <input
                        className="focus-ring mt-1 h-11 w-full rounded-lg border border-ink/15 px-3 text-base font-bold"
                        value={item.description ?? ""}
                        onChange={(event) => {
                          const next = [...expenseItems];
                          next[idx] = { ...item, description: event.target.value };
                          setExpenseItems(next);
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setExpenseItems([...expenseItems, newExpenseRow()])}
                className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-leaf/40 bg-leaf/5 px-4 font-black text-leaf hover:bg-leaf/10"
              >
                <Plus size={18} aria-hidden />
                {t("closing.addExpense")}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label={t("closing.expensesTotal")} value={formatMoney(expensesTotal)} />
              <MetricCard
                label={t("closing.netProfit")}
                value={formatMoney(
                  netProfit({
                    totalSales: toMoney(totalSales),
                    tax: toMoney(tax),
                    refunds: toMoney(refunds),
                    expenses: expensesTotal
                  })
                )}
              />
            </div>
            <label className="block">
              <span className="text-base font-black">{t("closing.notes")}</span>
              <textarea
                className="focus-ring mt-2 min-h-28 w-full rounded-lg border border-ink/15 p-4 text-lg"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("common.optional")}
              />
            </label>
            {submitError ? (
              <div className="rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
                {submitError}
              </div>
            ) : null}
            {confirmingBusinessDate ? (
              <div className="rounded-xl border border-gold/30 bg-yellow-50 p-4 text-ink">
                <p className="text-lg font-black">{t("closing.confirmBusinessDate")}</p>
                <p className="mt-1 text-sm font-bold text-ink/65">
                  {t("closing.confirmBusinessDateBody")}
                </p>
                <label className="mt-3 block">
                  <span className="text-sm font-black">{t("closing.closingDate")}</span>
                  <input
                    type="date"
                    className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 text-lg font-black"
                    value={businessDate}
                    onChange={(event) => setBusinessDate(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            <button
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-lg font-black text-white disabled:opacity-60"
              onClick={requestSubmitClose}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="animate-spin" size={22} aria-hidden /> : <CheckCircle2 size={22} aria-hidden />}
              {submitting ? t("closing.submitting") : t("closing.finish")}
            </button>
          </div>
        ) : null}

        {step === "finish" ? (
          <div className="space-y-4 rounded-xl bg-smoke p-6 text-center">
            {result.difference < 0 ? (
              <Banknote className="mx-auto text-warning" size={56} aria-hidden />
            ) : (
              <CheckCircle2 className="mx-auto text-leaf" size={56} aria-hidden />
            )}
            <h2 className="text-3xl font-black">
              {result.difference < 0
                ? `${t("closing.cashShortage")}: ${formatMoneyExact(result.difference)}`
                : t("closing.success")}
            </h2>
            <p className="text-base font-bold text-ink/65">{t("closing.ownerUpdated")}</p>
            <button
              className="focus-ring h-12 rounded-lg bg-leaf px-5 font-black text-white"
              onClick={reset}
            >
              {t("closing.startOver")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function fileToDataUrl(file: File, errorMessage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(errorMessage));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function StepProgress({
  current,
  onJump
}: {
  current: number;
  onJump: (key: (typeof STEPS)[number]["key"]) => void;
}) {
  const { t } = useLanguage();
  const pct = ((current + 1) / STEPS.length) * 100;
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-sm">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-smoke">
        <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${pct}%` }} aria-hidden />
      </div>
      <ol className="mt-3 flex items-center justify-between gap-1 text-[11px] font-black uppercase tracking-wide">
        {STEPS.map((s, i) => {
          const isDone = i < current;
          const isCurrent = i === current;
          const canJump = isDone;
          return (
            <li
              key={s.key}
              className={clsx(
                "flex flex-1 items-center gap-1.5",
                isCurrent ? "text-leaf" : isDone ? "text-ink/70" : "text-ink/40"
              )}
            >
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump(s.key)}
                aria-label={`${t("closing.goBackToStep")} ${t(s.labelKey)}`}
                className={clsx(
                  "focus-ring flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors",
                  canJump ? "cursor-pointer hover:bg-smoke" : "cursor-default"
                )}
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                    isCurrent
                      ? "bg-leaf text-white"
                      : isDone
                        ? "bg-leaf/15 text-leaf"
                        : "bg-smoke text-ink/40"
                  )}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{t(s.shortKey)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-base font-black">
        <PencilLine size={18} aria-hidden />
        {label}
      </span>
      <input
        className="focus-ring mt-2 h-14 w-full rounded-lg border border-ink/15 px-4 text-2xl font-black"
        inputMode="decimal"
        value={value}
        onFocus={(event) => {
          if (event.currentTarget.value === "0") event.currentTarget.select();
        }}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
