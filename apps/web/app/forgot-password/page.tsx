"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { createBrowserSupabase } from "../../lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured in this environment.");
      return;
    }
    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-black text-ink/65 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden /> Back to sign in
      </Link>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
            <Mail size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-black">Reset your password</h1>
            <p className="text-sm font-semibold text-ink/60">We'll email you a reset link.</p>
          </div>
        </div>

        {status === "sent" ? (
          <div className="mt-6 rounded-xl bg-leaf/5 p-4 text-leaf">
            <p className="text-lg font-black">Check your email.</p>
            <p className="mt-1 text-sm font-bold text-ink/65">
              We sent a reset link to <strong>{email}</strong>. The link expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-black">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {status === "error" ? (
              <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{message}</p>
            ) : null}
            <button
              type="submit"
              disabled={status === "loading"}
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
            >
              {status === "loading" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
