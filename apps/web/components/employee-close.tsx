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
  Receipt,
  Upload
} from "lucide-react";
import { clsx } from "clsx";
import { formatMoney, formatMoneyExact, toMoney } from "@smokeshop/shared/utils/money";
import { scannedReport } from "../lib/mock-data";
import { ApiError, finishDailyClose, uploadReport } from "../lib/api-client";
import { preprocessReceipt } from "../lib/preprocess-image";
import { useSession } from "../lib/use-session";
import { MetricCard } from "./metric-card";
import { useLanguage } from "./language-provider";

type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "finish" | "blocked";

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
  const [expenses, setExpenses] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    // toMoney parses strings like "1,169.27" / "$1169" / "1 169" safely.
    // Pre-fix this used bare Number() which returns NaN on commas → falls
    // through `|| 0` and silently zeros the field, producing a fake
    // -$1,169 shortage when the register actually matched.
    const expectedCash = toMoney(cashSales) - toMoney(refunds) - toMoney(expenses);
    const countedTotal = toMoney(cashCounted) + toMoney(safeDrop);
    return { expectedCash, difference: countedTotal - expectedCash };
  }, [cashCounted, cashSales, expenses, refunds, safeDrop]);

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

  async function submitClose() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await finishDailyClose(session.token, {
        storeId: activeStore.id,
        employeeId,
        date: new Date().toISOString(),
        cashSales: toMoney(cashSales),
        cardSales: toMoney(cardSales),
        totalSales: toMoney(totalSales),
        tax: toMoney(tax),
        refunds: toMoney(refunds),
        discounts: scannedReport.discounts,
        countedCash: toMoney(cashCounted),
        safeDropAmount: toMoney(safeDrop),
        expenses: toMoney(expenses),
        notes
      });
      setStep("finish");
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

  function reset() {
    setStep("start");
    setReportReady(false);
    setSubmitError(null);
  }

  return (
    <section className="space-y-5" dir={dir}>
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-leaf">
          {session.profile?.name ? `${t("closing.hi")} ${session.profile.name}` : t("closing.employeeView")}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {t("closing.closeStore")} {activeStore.storeName}
        </h1>
        <p className="mt-1 text-base font-bold text-ink/65">{t("closing.followSteps")}</p>

        {availableStores.length > 1 ? (
          <label className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-ink/70">
            <span>{t("common.store")}:</span>
            <select
              className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1 font-black"
              value={storeIdx}
              onChange={(e) => setStoreIdx(Number(e.target.value))}
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
            <MoneyInput label={t("closing.expenses")} value={expenses} onChange={setExpenses} />
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
            <button
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-lg font-black text-white disabled:opacity-60"
              onClick={submitClose}
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
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
