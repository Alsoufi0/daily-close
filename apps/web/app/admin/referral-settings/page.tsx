"use client";

import { useEffect, useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { RequireAuth } from "../../../components/require-auth";
import { useSession } from "../../../lib/use-session";
import { ApiError, getReferralSettings, updateReferralSettings } from "../../../lib/api-client";

function SettingsInner() {
  const session = useSession();
  const [ratePct, setRatePct] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getReferralSettings(session.token)
      .then((s) => !cancelled && setRatePct(String((s.defaultCommissionRate * 100).toFixed(2))))
      .catch(() => !cancelled && setRatePct("25"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSaving(true);
    setMsg(null);
    try {
      const pct = Number(ratePct);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) throw new Error("Rate must be 0–100%.");
      const s = await updateReferralSettings(session.token, pct / 100);
      setRatePct(String((s.defaultCommissionRate * 100).toFixed(2)));
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-lg font-black text-ink">
        <Settings size={18} aria-hidden /> Referral settings
      </h1>
      <form onSubmit={save} className="max-w-md space-y-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-ink/75">Default commission rate (%)</span>
          <input
            value={ratePct}
            onChange={(e) => setRatePct(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-lg border border-ink/15 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-ink/50">
            Applied to every partner that has no per-partner override. Existing commission rows keep
            the rate they were created with.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white hover:bg-leaf/90 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={15} aria-hidden />} Save
          </button>
          {msg && <span className="text-sm text-ink/60">{msg}</span>}
        </div>
      </form>
    </div>
  );
}

export default function ReferralSettingsPage() {
  return (
    <RequireAuth allowedRoles={["SUPER_ADMIN"]}>
      <SettingsInner />
    </RequireAuth>
  );
}
