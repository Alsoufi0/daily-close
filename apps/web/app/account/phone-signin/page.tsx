"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { RequireAuth } from "../../../components/require-auth";
import { useLanguage } from "../../../components/language-provider";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  addPhoneLoginConfirm,
  addPhoneLoginRequest,
  getPhoneLoginStatus
} from "../../../lib/api-client";

export default function PhoneSignInPage() {
  return (
    <RequireAuth>
      <PhoneSignInInner />
    </RequireAuth>
  );
}

// Lets an owner who signed up with email attach a verified phone so they can
// later sign in with the SMS code. Two steps: enter the number → receive a code
// → verify. Mirrors the mobile Settings → Phone sign-in screen.
function PhoneSignInInner() {
  const session = useSession();
  const { t, dir } = useLanguage();
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "verify">("enter");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) return;
    let cancelled = false;
    getPhoneLoginStatus(session.token)
      .then((data) => {
        if (cancelled) return;
        setLinkedPhone(data.phone);
        if (data.phone) setPhone(data.phone);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("phoneSignin.loadFailed"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token, t]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const r = await addPhoneLoginRequest(session.token, phone.trim());
      if (r.sent) {
        setStep("verify");
        setMessage(t("phoneSignin.codeSent"));
      } else {
        setError(r.message || t("phoneSignin.codeFailed"));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("phoneSignin.codeFailed"));
    } finally {
      setSending(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setConfirming(true);
    setError(null);
    setMessage(null);
    try {
      const r = await addPhoneLoginConfirm(session.token, { phone: phone.trim(), code: code.trim() });
      setLinkedPhone(r.phone);
      setStep("enter");
      setCode("");
      setMessage(t("phoneSignin.linked"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("phoneSignin.codeInvalid"));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6" dir={dir}>
      <Link
        href="/account"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-black text-ink/65 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden /> {t("common.back")}
      </Link>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
            <Smartphone size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-black">{t("phoneSignin.title")}</h1>
            <p className="text-sm font-semibold text-ink/60">{t("phoneSignin.subtitle")}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-smoke p-6 text-sm font-bold text-ink/60">
            <Loader2 className="animate-spin" size={18} /> {t("common.loading")}
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {linkedPhone ? (
              <div className="flex items-center gap-2 rounded-lg bg-leaf/10 p-3 text-sm font-bold text-leaf">
                <CheckCircle2 size={16} /> {t("phoneSignin.currentlyLinked")}: {linkedPhone}
              </div>
            ) : null}

            <form onSubmit={step === "enter" ? sendCode : confirm} className="space-y-5">
              <label className="block">
                <span className="text-sm font-black">{t("phoneSignin.numberLabel")}</span>
                <input
                  className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold disabled:bg-smoke disabled:text-ink/60"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={step !== "enter"}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+15551234567"
                />
                <p className="mt-1 text-xs font-bold text-ink/55">{t("phoneSignin.numberHelp")}</p>
              </label>

              {step === "verify" ? (
                <label className="block">
                  <span className="text-sm font-black">{t("auth.sixDigitCode")}</span>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 text-center text-xl font-black tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </label>
              ) : null}

              {message ? (
                <div className="flex items-center gap-2 rounded-lg bg-leaf/10 p-3 text-sm font-bold text-leaf">
                  <CheckCircle2 size={16} /> {message}
                </div>
              ) : null}
              {error ? <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</div> : null}

              {step === "enter" ? (
                <button
                  type="submit"
                  disabled={sending || !phone.trim()}
                  className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
                >
                  {sending ? <Loader2 className="animate-spin" size={20} /> : null}
                  {linkedPhone ? t("phoneSignin.updateNumber") : t("phoneSignin.addNumber")}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={confirming || code.length < 6}
                    className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
                  >
                    {confirming ? <Loader2 className="animate-spin" size={20} /> : null}
                    {confirming ? t("auth.verifying") : t("phoneSignin.confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("enter");
                      setCode("");
                      setError(null);
                    }}
                    disabled={confirming}
                    className="focus-ring flex h-12 w-full items-center justify-center rounded-lg border-2 border-ink/15 bg-white text-base font-black text-ink disabled:opacity-60"
                  >
                    {t("common.back")}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
