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
import { useLanguage, LanguageSelect } from "./language-provider";

const FEATURES = [
  { icon: Clock, titleKey: "home.featureCloseTitle", bodyKey: "home.featureCloseBody" },
  { icon: TrendingUp, titleKey: "home.featureOwnerTitle", bodyKey: "home.featureOwnerBody" },
  { icon: BadgeCheck, titleKey: "home.featureBooksTitle", bodyKey: "home.featureBooksBody" }
];

export function ProductionLogin() {
  const { t, dir } = useLanguage();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") setExpired(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      fetch(`${apiUrl}/health`, { cache: "no-store" }).catch(() => {});
    }
  }, []);

  async function login() {
    setLoading(true);
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage(t("auth.demoFallback"));
      window.location.href = "/demo";
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error || !data.session) {
      setMessage(error?.message || t("auth.loginFailed"));
      return;
    }

    window.localStorage.setItem("dailyclose-token", data.session.access_token);
    window.location.href = "/owner";
  }

  async function sendPhoneCode() {
    setLoading(true);
    setMessage("");
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setMessage(t("auth.buildMisconfigured"));
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
    setLoading(false);
    if (error) {
      setMessage(error.message || t("auth.phoneCodeFailed"));
      return;
    }
    setPhoneCodeSent(true);
    setMessage(t("auth.phoneCodeSent"));
  }

  async function verifyPhoneCode() {
    setLoading(true);
    setMessage("");
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setMessage(t("auth.buildMisconfigured"));
      return;
    }
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: phoneCode.trim(),
      type: "sms"
    });
    setLoading(false);
    if (error || !data.session) {
      setMessage(error?.message || t("auth.phoneCodeFailed"));
      return;
    }
    window.location.href = "/owner";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-14 lg:px-8" dir={dir}>
      <div className="mb-5 flex justify-end">
        <LanguageSelect />
      </div>
      <div className="mb-5 lg:hidden">
        <span className="inline-flex items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-leaf">
          <Store size={14} aria-hidden />
          {t("brand.name")}
        </span>
        <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-ink">
          {t("home.mobileHero")}
        </h1>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
        <div className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-leaf">
            <Store size={14} aria-hidden />
            {t("home.platforms")}
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-ink sm:text-6xl">
            {t("home.hero")}
          </h1>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-ink/70 sm:mt-5 sm:text-xl sm:leading-8">
            {t("home.value")}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-sm font-black text-ink/75">
            {t("home.price")}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, titleKey, bodyKey }) => (
              <div key={titleKey} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                  <Icon size={18} aria-hidden />
                </div>
                <p className="mt-3 text-base font-black text-ink">{t(titleKey)}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink/65">{t(bodyKey)}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-xl border border-ink/10 bg-white/70 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
              <Smartphone size={20} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-black text-ink">{t("home.mobileApps")}</p>
              <p className="text-sm font-semibold text-ink/65">{t("home.mobileAppsBody")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
              <LockKeyhole size={22} aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-black">{t("auth.signIn")}</h2>
              <p className="text-sm font-semibold text-ink/60">{t("auth.ownerEmployeeAccount")}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 rounded-xl bg-smoke p-1 text-sm font-black">
            <button
              type="button"
              onClick={() => setAuthMode("email")}
              className={authMode === "email" ? "rounded-lg bg-white px-3 py-2 shadow-sm" : "px-3 py-2 text-ink/55"}
            >
              {t("auth.email")}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("phone")}
              className={authMode === "phone" ? "rounded-lg bg-white px-3 py-2 shadow-sm" : "px-3 py-2 text-ink/55"}
            >
              {t("auth.phone")}
            </button>
          </div>

          {authMode === "email" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-black">{t("auth.email")}</span>
                <input
                  className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black">{t("nav.password")}</span>
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
                    aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
                    className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink/55 hover:bg-smoke"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-black">{t("auth.phone")}</span>
                <input
                  className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+15551234567"
                />
              </label>
              {phoneCodeSent ? (
                <label className="block">
                  <span className="text-sm font-black">{t("auth.smsCode")}</span>
                  <input
                    className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
              ) : null}
            </div>
          )}

          {expired ? (
            <p className="mt-3 rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
              {t("auth.sessionExpired")}
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 rounded-lg bg-smoke p-3 text-sm font-bold text-ink/70">{message}</p>
          ) : null}

          <div className="mt-5 grid gap-3">
            <button
              className="focus-ring flex h-14 items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-60"
              onClick={authMode === "email" ? login : phoneCodeSent ? verifyPhoneCode : sendPhoneCode}
              disabled={loading}
            >
              {loading
                ? t("auth.signingIn")
                : authMode === "phone" && !phoneCodeSent
                  ? t("auth.sendSmsCode")
                  : authMode === "phone"
                    ? t("auth.verifySmsCode")
                    : t("auth.signIn")}
              {!loading ? <ArrowRight size={22} aria-hidden /> : null}
            </button>
            <Link
              className="focus-ring flex h-14 items-center justify-center gap-2 rounded-lg border-2 border-leaf bg-white text-lg font-black text-leaf hover:bg-leaf/5"
              href="/signup"
            >
              {t("auth.createTrial")}
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs font-bold">
            <Link href="/forgot-password" className="text-ink/65 hover:text-ink underline">
              {t("auth.forgotPassword")}
            </Link>
            <span className="text-ink/55">
              <Link href="/terms" className="underline">{t("legal.terms")}</Link>
              <span className="mx-1">·</span>
              <Link href="/privacy" className="underline">{t("legal.privacy")}</Link>
              <span className="mx-1">·</span>
              <Link href="/demo" className="underline">{t("nav.demo")}</Link>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
