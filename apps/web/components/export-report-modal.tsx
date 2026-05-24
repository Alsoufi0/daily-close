"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, X } from "lucide-react";
import { clsx } from "clsx";
import {
  downloadReport,
  listEmployees,
  listStores,
  type ReportExportFilters,
  type StoreRecord
} from "../lib/api-client";
import { useLanguage } from "./language-provider";

type Quick = "last-day" | "last-week" | "last-month" | "custom";

export function ExportReportModal({ token, onClose }: { token?: string; onClose: () => void }) {
  const { t, lang, dir } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const [quick, setQuick] = useState<Quick>("last-week");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [storeId, setStoreId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingType, setLoadingType] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([listStores(token), listEmployees(token)])
      .then(([storeRows, employeeRows]) => {
        if (cancelled) return;
        setStores(storeRows);
        setEmployees(employeeRows.map((employee: any) => ({ id: employee.id, name: employee.name || employee.email })));
      })
      .catch(() => {
        if (!cancelled) {
          setStores([]);
          setEmployees([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filters = useMemo<ReportExportFilters>(() => {
    const base: ReportExportFilters = {
      lang,
      storeId: storeId || undefined,
      employeeId: employeeId || undefined
    };
    if (quick === "custom") return { ...base, from, to };
    return { ...base, quick };
  }, [employeeId, from, lang, quick, storeId, to]);

  async function exportFile(type: "csv" | "pdf") {
    setError("");
    setLoadingType(type);
    try {
      const blob = await downloadReport(token, type, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `daily-close-report.${type}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("reports.failed"));
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" dir={dir}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-leaf">{t("common.export")}</p>
            <h2 className="text-2xl font-black">{t("reports.title")}</h2>
          </div>
          <button onClick={onClose} className="focus-ring rounded-lg p-2 text-ink/60 hover:bg-smoke" aria-label={t("common.cancel")}>
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="text-xs font-black uppercase text-ink/55">{t("reports.quick")}</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["last-day", t("reports.lastDay")],
                ["last-week", t("reports.lastWeek")],
                ["last-month", t("reports.lastMonth")],
                ["custom", t("reports.custom")]
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setQuick(value as Quick)}
                  className={clsx(
                    "focus-ring rounded-lg border px-3 py-3 text-sm font-black",
                    quick === value ? "border-leaf bg-leaf text-white" : "border-ink/10 bg-white text-ink hover:bg-smoke"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {quick === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("reports.from")} value={from} onChange={setFrom} type="date" />
              <Field label={t("reports.to")} value={to} onChange={setTo} type="date" />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-ink">
              {t("reports.store")}
              <select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="focus-ring rounded-lg border border-ink/10 px-3 py-3">
                <option value="">{t("reports.allStores")}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              {t("reports.employee")}
              <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="focus-ring rounded-lg border border-ink/10 px-3 py-3">
                <option value="">{t("reports.allEmployees")}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</div> : null}

          <div className="grid grid-cols-2 gap-3">
            <ExportButton type="csv" label={t("reports.csv")} loading={loadingType === "csv"} disabled={Boolean(loadingType)} onClick={() => exportFile("csv")} />
            <ExportButton type="pdf" label={t("reports.pdf")} loading={loadingType === "pdf"} disabled={Boolean(loadingType)} onClick={() => exportFile("pdf")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (value: string) => void; type: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-ink">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} className="focus-ring rounded-lg border border-ink/10 px-3 py-3" />
    </label>
  );
}

function ExportButton({ label, loading, disabled, onClick, type }: { label: string; loading: boolean; disabled: boolean; onClick: () => void; type: "csv" | "pdf" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focus-ring flex items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70"
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : type === "pdf" ? <FileText size={18} /> : <Download size={18} />}
      {label}
    </button>
  );
}
