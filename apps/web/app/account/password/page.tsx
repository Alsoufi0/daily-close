"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { createBrowserSupabase } from "../../../lib/supabase-browser";
import { deleteMyAccount } from "../../../lib/api-client";
import { useSession } from "../../../lib/use-session";
import { RequireAuth } from "../../../components/require-auth";
import { useLanguage } from "../../../components/language-provider";

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordPageInner />
    </RequireAuth>
  );
}

function ChangePasswordPageInner() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("done");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <Link
        href="/owner"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-black text-ink/65 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden /> Back
      </Link>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
            <ShieldCheck size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-black">Change password</h1>
            <p className="text-sm font-semibold text-ink/60">Use at least 8 characters.</p>
          </div>
        </div>

        {status === "done" ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-leaf/5 p-6 text-center text-leaf">
            <CheckCircle2 size={48} aria-hidden />
            <p className="text-lg font-black text-ink">Password updated.</p>
            <Link
              href="/owner"
              className="focus-ring inline-flex h-12 items-center justify-center rounded-lg bg-leaf px-5 font-black text-white"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field
              label="New password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              trailing={
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="focus-ring rounded-md p-2 text-ink/55 hover:bg-smoke"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            <Field
              label="Confirm new password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
            />
            {status === "error" && message ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{message}</div>
            ) : null}
            <button
              type="submit"
              disabled={status === "loading"}
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
            >
              {status === "loading" ? <Loader2 className="animate-spin" size={20} /> : null}
              {status === "loading" ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>

      <DeleteAccountSection />
    </main>
  );
}

// Apple Guideline 5.1.1(v) requires in-app account deletion. Two-step: an
// open-the-form button, then a typed confirmation ("DELETE") before the actual
// API call, so a stray tap can't wipe an account.
function DeleteAccountSection() {
  const session = useSession();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDelete() {
    setError(null);
    setBusy(true);
    try {
      await deleteMyAccount(session.token);
      // Sign out locally + bounce to the home page. The Supabase auth user is
      // already gone server-side, so the next call would 401 anyway.
      try {
        const supabase = createBrowserSupabase();
        await supabase?.auth.signOut();
      } catch {
        /* ignore */
      }
      window.localStorage.removeItem("dailyclose-token");
      window.location.replace("/?deleted=1");
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || t("account.deleteFailed"));
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-warning/30 bg-red-50 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <Trash2 size={22} aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-black text-warning">{t("account.deleteSection")}</h2>
          <p className="text-sm font-semibold text-ink/70">
            {t("account.deleteIntro")}
          </p>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-ring mt-4 inline-flex h-11 items-center gap-2 rounded-lg border-2 border-warning bg-white px-5 font-black text-warning hover:bg-warning/5"
        >
          <Trash2 size={16} aria-hidden /> {t("account.deleteSection")}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-black text-ink">
            {t("account.deleteConfirmLabel")}
            <input
              autoFocus
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 bg-white px-4 font-bold tracking-widest"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </label>
          {error ? <p className="text-sm font-bold text-warning">{error}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setError(null);
              }}
              disabled={busy}
              className="focus-ring h-11 flex-1 rounded-lg border-2 border-ink/15 bg-white font-black text-ink hover:bg-smoke disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={runDelete}
              disabled={busy || confirm !== "DELETE"}
              className="focus-ring flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-warning font-black text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
              {busy ? t("account.deleting") : t("account.permanentlyDelete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  type,
  autoComplete,
  value,
  onChange,
  trailing
}: {
  label: string;
  type: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{label}</span>
      <div className="relative mt-2">
        <input
          required
          minLength={8}
          type={type}
          autoComplete={autoComplete}
          className={`focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold ${trailing ? "pr-12" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {trailing ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
    </label>
  );
}
