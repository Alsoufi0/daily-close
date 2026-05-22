"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, UserPlus } from "lucide-react";
import { createBrowserSupabase } from "../../lib/supabase-browser";
import { bootstrapOwner } from "../../lib/api-client";

type Status = "idle" | "loading" | "needs_confirm" | "done" | "error";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured in this environment.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "STORE_OWNER" },
        emailRedirectTo: `${window.location.origin}/setup`
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    // If Supabase requires email confirmation, session is null. Otherwise we get a session.
    if (!data.session) {
      setStatus("needs_confirm");
      return;
    }

    try {
      await bootstrapOwner(data.session.access_token, name);
      window.localStorage.setItem("smokeshop-token", data.session.access_token);
      window.location.href = "/setup";
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Could not finish setting up your account.");
    }
  }

  if (status === "needs_confirm") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-leaf/30 bg-leaf/5 p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-leaf" size={48} aria-hidden />
          <h1 className="mt-3 text-2xl font-black">Check your email</h1>
          <p className="mt-2 text-base font-bold text-ink/65">
            We sent a confirmation link to <strong>{email}</strong>. Click it to finish creating your account.
          </p>
          <Link
            href="/"
            className="focus-ring mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-ink/15 bg-white px-5 font-black text-ink"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
            <UserPlus size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-black">Start your free trial</h1>
            <p className="text-sm font-semibold text-ink/60">14 days, no card required.</p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 text-sm font-bold text-ink/70">
          <li className="flex items-center gap-2">
            <Sparkles size={14} className="text-leaf" /> Multi-store dashboard
          </li>
          <li className="flex items-center gap-2">
            <Sparkles size={14} className="text-leaf" /> Daily close from any phone
          </li>
          <li className="flex items-center gap-2">
            <Sparkles size={14} className="text-leaf" /> CSV export + missed-close alerts
          </li>
        </ul>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm font-black">Your name</span>
            <input
              required
              autoFocus
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-black">Password</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-1 block text-xs font-bold text-ink/55">At least 8 characters.</span>
          </label>

          {status === "error" && message ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{message}</div>
          ) : null}

          <button
            type="submit"
            disabled={status === "loading"}
            className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white shadow-sm disabled:opacity-60"
          >
            {status === "loading" ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <ArrowRight size={20} aria-hidden />
            )}
            {status === "loading" ? "Creating account…" : "Create my account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm font-bold text-ink/65">
          Already have an account?{" "}
          <Link href="/" className="text-leaf underline">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs font-bold text-ink/55">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy</Link>.
        </p>
      </div>
    </main>
  );
}
