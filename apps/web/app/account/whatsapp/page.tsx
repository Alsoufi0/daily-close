"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { RequireAuth } from "../../../components/require-auth";
import { useLanguage } from "../../../components/language-provider";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  getWhatsAppSettings,
  updateWhatsAppSettings,
  type WhatsAppSettings
} from "../../../lib/api-client";

export default function WhatsAppSettingsPage() {
  return (
    <RequireAuth allowedRoles={["STORE_OWNER", "SUPER_ADMIN"]}>
      <WhatsAppSettingsInner />
    </RequireAuth>
  );
}

function WhatsAppSettingsInner() {
  const session = useSession();
  const { t, dir } = useLanguage();
  const [settings, setSettings] = useState<WhatsAppSettings>({
    whatsappPhone: "",
    whatsappAlertsEnabled: false,
    whatsappCloseAlertsEnabled: false,
    whatsappReportsEnabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) return;
    let cancelled = false;
    getWhatsAppSettings(session.token)
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("common.error"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token, t]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateWhatsAppSettings(session.token, settings);
      setSettings(updated);
      setMessage(t("settings.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6" dir={dir}>
      <Link
        href="/owner"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-black text-ink/65 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden /> Back
      </Link>

      <form onSubmit={save} className="mt-6 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
            <MessageCircle size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-black">{t("settings.whatsappTitle")}</h1>
            <p className="text-sm font-semibold text-ink/60">{t("settings.whatsappSubtitle")}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-smoke p-6 text-sm font-bold text-ink/60">
            <Loader2 className="animate-spin" size={18} />
            {t("common.loading")}
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-black">{t("settings.whatsappPhone")}</span>
              <input
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={settings.whatsappPhone || ""}
                onChange={(event) => setSettings((prev) => ({ ...prev, whatsappPhone: event.target.value }))}
                inputMode="tel"
                placeholder="+15551234567"
              />
              <p className="mt-1 text-xs font-bold text-ink/55">{t("settings.whatsappPhoneHelp")}</p>
            </label>

            <Toggle
              label={t("settings.missedAlerts")}
              checked={settings.whatsappAlertsEnabled}
              onChange={(checked) => setSettings((prev) => ({ ...prev, whatsappAlertsEnabled: checked }))}
            />
            <Toggle
              label={t("settings.closeAlerts")}
              checked={settings.whatsappCloseAlertsEnabled}
              onChange={(checked) => setSettings((prev) => ({ ...prev, whatsappCloseAlertsEnabled: checked }))}
            />
            <Toggle
              label={t("settings.weeklyMonthlyReports")}
              checked={settings.whatsappReportsEnabled}
              onChange={(checked) => setSettings((prev) => ({ ...prev, whatsappReportsEnabled: checked }))}
            />

            {message ? (
              <div className="flex items-center gap-2 rounded-lg bg-leaf/10 p-3 text-sm font-bold text-leaf">
                <CheckCircle2 size={16} /> {message}
              </div>
            ) : null}
            {error ? <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</div> : null}

            <button
              type="submit"
              disabled={saving}
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : null}
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 p-4">
      <span className="text-sm font-black text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 accent-leaf"
      />
    </label>
  );
}
