"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  Sparkles,
  UserPlus
} from "lucide-react";
import { createBrowserSupabase } from "../../lib/supabase-browser";
import { ApiError, bootstrapOwner, confirmSignup, readRefCookie, requestSignup } from "../../lib/api-client";
import { useLanguage } from "../../components/language-provider";

type Status = "idle" | "loading" | "needs_confirm" | "done" | "error";
type SignupMode = "email" | "phone";

export default function SignupPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<SignupMode>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // First-touch referral code dropped by /r/[code]. Shown for reassurance; it's
  // attached to the signup request automatically by the API client.
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    setRefCode(readRefCookie() ?? null);
  }, []);

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

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (mode === "email" && !trimmedEmail) {
      setStatus("error");
      setMessage("Enter your email.");
      return;
    }
    if (mode === "phone" && !trimmedPhone) {
      setStatus("error");
      setMessage("Enter your phone number with country code.");
      return;
    }

    try {
      // Send a verification code. The account is created only after the code is
      // confirmed below — nothing is created if the user abandons here.
      const r = await requestSignup({
        name,
        email: mode === "email" ? trimmedEmail : undefined,
        phone: mode === "phone" ? trimmedPhone : undefined,
        password
      });
      if (r.sent) {
        setStatus("needs_confirm");
      } else {
        setStatus("error");
        setMessage(r.message || "Could not send your verification code.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiError ? err.message : "Could not create your account.");
    }
  }

  async function verifySignup(event: React.FormEvent) {
    event.preventDefault();
    setVerifyingPhone(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setVerifyingPhone(false);
      setStatus("error");
      setMessage("Supabase is not configured in this environment.");
      return;
    }
    try {
      // Verify the code → the API creates the account and returns a session.
      const result = await confirmSignup({
        name,
        email: mode === "email" ? email.trim() : undefined,
        phone: mode === "phone" ? phone.trim() : undefined,
        password,
        code: phoneCode.trim()
      });
      const verified = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: result.type
      });
      if (verified.error || !verified.data.session) {
        setVerifyingPhone(false);
        setStatus("needs_confirm");
        setMessage(verified.error?.message || t("auth.phoneCodeFailed"));
        return;
      }
      await bootstrapOwner(verified.data.session.access_token, name);
      window.localStorage.setItem("dailyclose-token", verified.data.session.access_token);
      window.location.href = "/setup";
    } catch (err: any) {
      setVerifyingPhone(false);
      setStatus("needs_confirm");
      setMessage(err?.message || t("auth.phoneCodeFailed"));
    }
  }

  if (status === "needs_confirm") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-leaf/30 bg-leaf/5 p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-leaf" size={48} aria-hidden />
          <h1 className="mt-3 text-2xl font-black">
            {mode === "phone" ? "Confirm your number" : "Check your email"}
          </h1>
          <p className="mt-2 text-base font-bold text-ink/65">
            {mode === "phone" ? (
              <>
                We texted a 6-digit code to <strong>{phone}</strong>. Enter it below to finish
                creating your account.
              </>
            ) : (
              <>
                We emailed a 6-digit code to <strong>{email}</strong>. Enter it below to finish
                creating your account.
              </>
            )}
          </p>
          <form onSubmit={verifySignup} className="mt-5 space-y-3 text-left">
            <label className="block">
              <span className="text-sm font-black">{t("auth.sixDigitCode")}</span>
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 text-center text-xl font-black tracking-widest"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </label>
            {message ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{message}</div>
            ) : null}
            <button
              type="submit"
              disabled={verifyingPhone || phoneCode.length < 6}
              className="focus-ring flex h-12 w-full items-center justify-center rounded-lg bg-leaf font-black text-white disabled:opacity-60"
            >
              {verifyingPhone ? t("auth.verifying") : t("auth.verifyContinue")}
            </button>
          </form>
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
            <h1 className="text-2xl font-black">{t("auth.startTrial")}</h1>
            <p className="text-sm font-semibold text-ink/60">{t("auth.trialNoCard")}</p>
          </div>
        </div>

        {refCode && (
          <div className="mt-4 rounded-lg border border-leaf/30 bg-leaf/5 px-3 py-2 text-sm font-bold text-leaf">
            You were referred by a partner — welcome!
          </div>
        )}

        <ul className="mt-4 space-y-1.5 text-sm font-bold text-ink/70">
          <li className="flex items-center gap-2">
            <Sparkles size={14} className="text-leaf" /> {t("billing.multiStoreDashboard")}
          </li>
          <li className="flex items-center gap-2">
            <Sparkles size={14} className="text-leaf" /> {t("auth.dailyCloseAnyPhone")}
          </li>
          <li className="flex items-center gap-2">
            <Sparkles size={14} className="text-leaf" /> {t("auth.csvMissedAlerts")}
          </li>
        </ul>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm font-black">{t("auth.yourName")}</span>
            <input
              required
              autoFocus
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone p-1">
            <button
              type="button"
              onClick={() => setMode("email")}
              className={`focus-ring flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black ${
                mode === "email" ? "bg-white text-ink shadow-sm" : "text-ink/60"
              }`}
            >
              <Mail size={16} aria-hidden />
              {t("auth.email")}
            </button>
            <button
              type="button"
              onClick={() => setMode("phone")}
              className={`focus-ring flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black ${
                mode === "phone" ? "bg-white text-ink shadow-sm" : "text-ink/60"
              }`}
            >
              <Phone size={16} aria-hidden />
              {t("auth.phone")}
            </button>
          </div>

          {mode === "email" ? (
            <label className="block">
              <span className="text-sm font-black">{t("auth.email")}</span>
              <input
                required
                type="email"
                autoComplete="email"
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-black">{t("auth.phoneNumber")}</span>
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <span className="mt-1 block text-xs font-bold text-ink/55">
                {t("auth.phoneCountryHelp")}
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-sm font-black">{t("auth.password")}</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-1 block text-xs font-bold text-ink/55">{t("auth.atLeast8CharsShort")}</span>
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
            {status === "loading" ? t("auth.creatingAccount") : t("auth.createMyAccount")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm font-bold text-ink/65">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="text-leaf underline">
            {t("auth.signIn")}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs font-bold text-ink/55">
          {t("auth.byCreatingAgree")}{" "}
          <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy</Link>.
        </p>
      </div>
    </main>
  );
}
