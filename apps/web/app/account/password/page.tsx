"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "../../../lib/supabase-browser";

export default function ChangePasswordPage() {
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
    </main>
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
