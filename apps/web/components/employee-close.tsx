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
import { formatMoney } from "@smokeshop/shared/utils/money";
import { scannedReport } from "../lib/mock-data";
import { ApiError, finishDailyClose, uploadReport } from "../lib/api-client";
import { preprocessReceipt } from "../lib/preprocess-image";
import { useSession } from "../lib/use-session";
import { MetricCard } from "./metric-card";

type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "finish" | "blocked";

const STEPS: { key: Exclude<Step, "start" | "blocked">; label: string; short: string }[] = [
  { key: "upload", label: "Upload POS Report", short: "Upload" },
  { key: "sales", label: "Check Sales Numbers", short: "Sales" },
  { key: "cash", label: "Count Cash", short: "Cash" },
  { key: "expenses", label: "Add Expenses", short: "Expenses" },
  { key: "finish", label: "Finish Closing", short: "Finish" }
];

function stepIndex(step: Step) {
  if (step === "start" || step === "blocked") return -1;
  return STEPS.findIndex((s) => s.key === step);
}

export function EmployeeClose() {
  const session = useSession();
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
    const expectedCash = Number(cashSales || 0) - Number(refunds || 0) - Number(expenses || 0);
    const countedTotal = Number(cashCounted || 0) + Number(safeDrop || 0);
    return { expectedCash, difference: countedTotal - expectedCash };
  }, [cashCounted, cashSales, expenses, refunds, safeDrop]);

  const currentIndex = stepIndex(step);
  const availableStores = session.stores.length > 0
    ? session.stores
    : session.profile?.storeId
      ? [{ id: session.profile.storeId, storeName: "My Store" }]
      : [{ id: "store-1", storeName: "Store #1" }];
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
            base64Data: await fileToDataUrl(file),
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
      setUploadError(err?.message || "Upload failed. Please try again.");
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
        cashSales: Number(cashSales || 0),
        cardSales: Number(cardSales || 0),
        totalSales: Number(totalSales || 0),
        tax: Number(tax || 0),
        refunds: Number(refunds || 0),
        discounts: scannedReport.discounts,
        countedCash: Number(cashCounted || 0),
        safeDropAmount: Number(safeDrop || 0),
        expenses: Number(expenses || 0),
        notes
      });
      setStep("finish");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && /already.*closed/i.test(err.message)) {
        setStep("blocked");
      } else {
        setSubmitError(err instanceof ApiError ? err.message : "Could not submit close. Try again.");
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
    <section className="space-y-5">
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-leaf">
          {session.profile?.name ? `Hi ${session.profile.name}` : "Employee view"}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Close {activeStore.storeName}
        </h1>
        <p className="mt-1 text-base font-bold text-ink/65">Follow one simple step at a time.</p>

        {availableStores.length > 1 ? (
          <label className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-ink/70">
            <span>Store:</span>
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
                aria-label="Back to previous step"
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink/15 text-ink/70 hover:bg-smoke"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
            ) : null}
            <h2 className="text-2xl font-black">
              {step === "start"
                ? "Ready to close?"
                : step === "blocked"
                  ? "Already closed today"
                  : STEPS[currentIndex]?.label}
            </h2>
          </div>
          {step !== "start" && step !== "blocked" ? (
            <p className="text-sm font-black text-ink/60">
              Step {currentIndex + 1} of {STEPS.length}
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
              Start Closing
            </button>
            <p className="text-center text-base font-bold text-ink/60">
              Takes about 2 minutes. You can edit any number before submitting.
            </p>
          </div>
        ) : null}

        {step === "blocked" ? (
          <div className="space-y-4 rounded-xl bg-yellow-50 p-6 text-center">
            <CheckCircle2 className="mx-auto text-gold" size={48} aria-hidden />
            <h3 className="text-2xl font-black text-ink">This store is already closed for today.</h3>
            <p className="text-base font-bold text-ink/65">
              If you need to change a submitted close, ask the owner to edit it from the dashboard.
            </p>
            <button
              className="focus-ring h-12 rounded-lg bg-leaf px-5 font-black text-white"
              onClick={reset}
            >
              Back to Start
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
                Take Photo
              </button>
              <button
                type="button"
                disabled={isReading}
                className="focus-ring flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/25 bg-smoke p-4 text-xl font-black text-ink hover:bg-ink/5 disabled:opacity-60"
                onClick={() => libraryInputRef.current?.click()}
              >
                <Upload size={32} aria-hidden />
                Upload Report
              </button>
            </div>

            {previewUrl ? (
              <div className="rounded-xl border border-ink/10 bg-white p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink/55">Preview</p>
                <img src={previewUrl} alt="POS report preview" className="mx-auto max-h-64 rounded-lg" />
              </div>
            ) : null}

            {isReading ? (
              <div className="flex items-center gap-3 rounded-xl bg-yellow-50 p-4 text-gold">
                <Loader2 className="animate-spin" size={24} aria-hidden />
                <p className="text-lg font-black">Uploading & reading report…</p>
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
                      ? "Report uploaded — numbers filled in."
                      : "Photo saved. Enter the numbers from your report on the next step."}
                  </p>
                </div>
                {ocrRawText ? (
                  <details className="mt-3 rounded-lg bg-white p-3 text-ink/75">
                    <summary className="cursor-pointer text-sm font-black text-ink/80">
                      OCR read this — tap to see what we got from the photo
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5">
                      {ocrRawText.length > 0
                        ? ocrRawText
                        : "(OCR returned no text — the photo may be too dark, blurry, or rotated. Try retaking under more light.)"}
                    </pre>
                  </details>
                ) : null}
                <button
                  className="focus-ring mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white"
                  onClick={() => setStep("sales")}
                >
                  Enter Sales Numbers
                  <ChevronRight size={22} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "sales" ? (
          <div className="space-y-4 fade-in">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Cash Sales" value={cashSales} onChange={setCashSales} />
              <MoneyInput label="Card Sales" value={cardSales} onChange={setCardSales} />
              <MoneyInput label="Total Sales" value={totalSales} onChange={setTotalSales} />
              <MoneyInput label="Tax" value={tax} onChange={setTax} />
              <MoneyInput label="Refunds" value={refunds} onChange={setRefunds} />
            </div>
            <button
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white"
              onClick={() => setStep("cash")}
            >
              Numbers Look Right
              <ChevronRight size={22} aria-hidden />
            </button>
          </div>
        ) : null}

        {step === "cash" ? (
          <div className="space-y-4 fade-in">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Cash Counted" value={cashCounted} onChange={setCashCounted} />
              <MoneyInput label="Safe Drop" value={safeDrop} onChange={setSafeDrop} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Expected Cash" value={formatMoney(result.expectedCash)} />
              <MetricCard
                label="Difference"
                value={formatMoney(result.difference)}
                tone={result.difference < 0 ? "bad" : "good"}
              />
            </div>
            <button
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white"
              onClick={() => setStep("expenses")}
            >
              Add Expenses
              <ChevronRight size={22} aria-hidden />
            </button>
          </div>
        ) : null}

        {step === "expenses" ? (
          <div className="space-y-4 fade-in">
            <MoneyInput label="Expenses" value={expenses} onChange={setExpenses} />
            <label className="block">
              <span className="text-base font-black">Notes</span>
              <textarea
                className="focus-ring mt-2 min-h-28 w-full rounded-lg border border-ink/15 p-4 text-lg"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
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
              {submitting ? "Submitting…" : "Finish Closing"}
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
                ? `Cash Shortage: ${formatMoney(result.difference)}`
                : "Store Closed Successfully"}
            </h2>
            <p className="text-base font-bold text-ink/65">Owner dashboard is updated.</p>
            <button
              className="focus-ring h-12 rounded-lg bg-leaf px-5 font-black text-white"
              onClick={reset}
            >
              Start Over
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the photo. Please try again."));
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
          const canJump = isDone; // only allow going back to completed steps
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
                aria-label={`Go back to ${s.label}`}
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
                <span className="hidden sm:inline">{s.short}</span>
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
