"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Eye,
  EyeOff,
  LockKeyhole,
  Smartphone,
  Store,
  TrendingUp
} from "lucide-react";
import { createBrowserSupabase } from "../lib/supabase-browser";

const FEATURES = [
  {
    icon: Clock,
    title: "Close in 2 minutes",
    body: "Employees upload the POS report, count cash, and submit — straight from their phone."
  },
  {
    icon: TrendingUp,
    title: "Owner sees everything",
    body: "Today's sales, which stores closed, and any cash that's missing — in one glance."
  },
  {
    icon: BadgeCheck,
    title: "Built for accountants",
    body: "Secure auth, full audit trail, CSV export, missed-close alerts — ready for your books."
  }
];

export function ProductionLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") setExpired(true);

    // Pre-warm the API so the post-login dashboard load is fast.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      fetch(`${apiUrl}/health`, { cache: "no-store" }).catch(() => {
        /* ignore */
      });
    }
  }, []);

  async function login() {
    setLoading(true);
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("Supabase not configured — opening demo mode.");
      window.location.href = "/demo";
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error || !data.session) {
      setMessage(error?.message || "Login failed. Check your email and password.");
      return;
    }

    window.localStorage.setItem("dailyclose-token", data.session.access_token);
    window.location.href = "/owner";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-14 lg:px-8">
      {/* Phone-only condensed hero so the sign-in stays the focus. */}
      <div className="mb-5 lg:hidden">
        <span className="inline-flex items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-leaf">
          <Store size={14} aria-hidden />
          Daily Close
        </span>
        <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-ink">
          Daily closing, <span className="text-leaf">done in minutes.</span>
        </h1>
      </div>
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
        {/* Marketing column — hidden on phone so the sign-in is the focus. */}
        <div className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-leaf">
            <Store size={14} aria-hidden />
            Multi-store · iOS · Android · Web
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-ink sm:text-6xl">
            Daily closing for smoke shops, <span className="text-leaf">done in minutes.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-ink/70 sm:mt-5 sm:text-xl sm:leading-8">
            Stop chasing paper sheets and late-night phone calls. Employees close the store from their phone. You see the truth.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                  <Icon size={18} aria-hidden />
                </div>
                <p className="mt-3 text-base font-black text-ink">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink/65">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-xl border border-ink/10 bg-white/70 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
              <Smartphone size={20} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-black text-ink">iOS & Android apps</p>
              <p className="text-sm font-semibold text-ink/65">Same login, same data — built with Expo for store submission.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
              <LockKeyhole size={22} aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-black">Sign in</h2>
              <p className="text-sm font-semibold text-ink/60">Owner or employee account</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-black">Email</span>
              <input
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black">Password</span>
              <div className="relative mt-2">
                <input
                  className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 pr-12 font-bold"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink/55 hover:bg-smoke"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          </div>

          {expired ? (
            <p className="mt-3 rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
              Your session expired. Please sign in again.
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 rounded-lg bg-smoke p-3 text-sm font-bold text-ink/70">{message}</p>
          ) : null}

          <div className="mt-5 grid gap-3">
            <button
              className="focus-ring flex h-14 items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-60"
              onClick={login}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading ? <ArrowRight size={22} aria-hidden /> : null}
            </button>
            <Link
              className="focus-ring flex h-14 items-center justify-center gap-2 rounded-lg border-2 border-leaf bg-white text-lg font-black text-leaf hover:bg-leaf/5"
              href="/signup"
            >
              Create account · 14-day free trial
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs font-bold">
            <Link href="/forgot-password" className="text-ink/65 hover:text-ink underline">
              Forgot password?
            </Link>
            <span className="text-ink/55">
              <Link href="/terms" className="underline">Terms</Link>
              <span className="mx-1">·</span>
              <Link href="/privacy" className="underline">Privacy</Link>
              <span className="mx-1">·</span>
              <Link href="/demo" className="underline">Demo</Link>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
