"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { createBrowserSupabase } from "../../lib/supabase-browser";

type Mode = "email" | "phone";
type Phase = "form" | "code" | "emailSent";

export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setPhase("form");
    setError("");
    setCode("");
  }

  function clientOrFail() {
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setError("Supabase is not configured in this environment.");
      return null;
    }
    return supabase;
  }

  // Email reset — Supabase emails a recovery link that lands on
  // /account/password (a session is established from the link there).
  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = clientOrFail();
    if (!supabase) return;
    const redirectTo = `${window.location.origin}/account/password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPhase("emailSent");
  }

  // Phone reset — phone-only owners/employees have no email, so we send an
  // SMS one-time code. shouldCreateUser:false means forgot-password never
  // creates an account; it only texts existing users. Verifying the code
  // signs the user in, then we send them to /account/password to set a new one.
  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = clientOrFail();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
      options: { shouldCreateUser: false }
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPhase("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = clientOrFail();
    if (!supabase) return;
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: code.trim(),
      type: "sms"
    });
    if (error || !data.session) {
      setLoading(false);
      setError(error?.message || "That code is invalid or expired. Try again.");
      return;
    }
    window.localStorage.setItem("dailyclose-token", data.session.access_token);
    window.location.href = "/account/password";
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
            {mode === "email" ? <Mail size={22} aria-hidden /> : <Phone size={22} aria-hidden />}
          </span>
          <div>
            <h1 className="text-2xl font-black">Reset your password</h1>
            <p className="text-sm font-semibold text-ink/60">
              {mode === "email" ? "We'll email you a reset link." : "We'll text you a code to verify."}
            </p>
          </div>
        </div>

        {phase === "emailSent" ? (
          <div className="mt-6 rounded-xl bg-leaf/5 p-4 text-leaf">
            <p className="text-lg font-black">Check your email.</p>
            <p className="mt-1 text-sm font-bold text-ink/65">
              If email delivery is enabled, a reset link will arrive at{" "}
              <strong>{email}</strong>. Employees can also ask the owner to reset their password from Admin.
            </p>
          </div>
        ) : (
          <>
            {/* Mode toggle — hidden once an SMS code has been sent */}
            {phase === "form" ? (
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-smoke p-1 text-sm font-black">
                <button
                  type="button"
                  onClick={() => switchMode("email")}
                  className={`focus-ring flex h-10 items-center justify-center gap-2 rounded-lg ${
                    mode === "email" ? "bg-white text-ink shadow-sm" : "text-ink/55"
                  }`}
                >
                  <Mail size={16} aria-hidden /> Email
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("phone")}
                  className={`focus-ring flex h-10 items-center justify-center gap-2 rounded-lg ${
                    mode === "phone" ? "bg-white text-ink shadow-sm" : "text-ink/55"
                  }`}
                >
                  <Phone size={16} aria-hidden /> Phone
                </button>
              </div>
            ) : null}

            {mode === "email" ? (
              <form onSubmit={sendEmail} className="mt-5 space-y-4">
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
                {error ? (
                  <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            ) : phase === "form" ? (
              <form onSubmit={sendCode} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-black">Phone number</span>
                  <input
                    type="tel"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+15551234567"
                    className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <span className="mt-1 block text-xs font-bold text-ink/55">
                    Include the country code, like +1 for the US.
                  </span>
                </label>
                {error ? (
                  <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="mt-5 space-y-4">
                <p className="text-sm font-bold text-ink/65">
                  We texted a code to <strong>{phone}</strong>. Enter it below to set a new password.
                </p>
                <label className="block">
                  <span className="text-sm font-black">6-digit code</span>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-4 text-center text-lg font-black tracking-[0.4em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </label>
                {error ? (
                  <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
                >
                  {loading ? "Verifying…" : "Verify & continue"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("phone")}
                  className="focus-ring w-full text-center text-xs font-bold text-ink/55 underline"
                >
                  Use a different number
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
