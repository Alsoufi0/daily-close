"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  CreditCard,
  Download,
  Gift,
  Loader2,
  Mail,
  QrCode,
  ScanLine,
  Send,
  TrendingUp,
  Trophy
} from "lucide-react";
import { useLanguage } from "../language-provider";

const PDF_HREF = "/daily-close-partner-program.pdf";

type Status = "idle" | "loading" | "sent" | "fallback" | "error";
type Audience = "1-5" | "6-20" | "21-50" | "50+";

const audienceOptions: Array<{ value: Audience; labelKey: string }> = [
  { value: "1-5", labelKey: "partners.audience1" },
  { value: "6-20", labelKey: "partners.audience2" },
  { value: "21-50", labelKey: "partners.audience3" },
  { value: "50+", labelKey: "partners.audience4" }
];

export function Partners() {
  const { t } = useLanguage();

  const steps = [
    { icon: QrCode, titleKey: "partners.step1Title", bodyKey: "partners.step1Body" },
    { icon: ScanLine, titleKey: "partners.step2Title", bodyKey: "partners.step2Body" },
    { icon: CreditCard, titleKey: "partners.step3Title", bodyKey: "partners.step3Body" },
    { icon: TrendingUp, titleKey: "partners.step4Title", bodyKey: "partners.step4Body" }
  ];

  const bonuses = [
    { amount: "$100", noteKey: "partners.bonus1" },
    { amount: "$300", noteKey: "partners.bonus2" },
    { amount: "$750", noteKey: "partners.bonus3" }
  ];

  const mathBars = [
    { amount: "$870", count: "10", h: "20%" },
    { amount: "$2,175", count: "25", h: "50%" },
    { amount: "$4,350", count: "50", h: "100%" }
  ];

  return (
    <main>
      {/* Hero — deep-green anchor */}
      <section className="bg-deepgreen text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-gold">
            <BadgePercent size={14} aria-hidden />
            {t("partners.eyebrow")}
          </span>
          <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t("partners.heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-white/80">
            {t("partners.heroBody")}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#apply"
              className="focus-ring inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-gold px-7 text-base font-black text-deepgreen shadow-sm hover:bg-gold/90"
            >
              {t("partners.heroApply")} <ArrowRight size={18} aria-hidden />
            </a>
            <a
              href={PDF_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-white/25 px-7 text-base font-black text-white hover:bg-white/10"
            >
              <Download size={18} aria-hidden /> {t("partners.heroDownload")}
            </a>
          </div>

          {/* Quick facts */}
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            <Fact title={t("partners.fact1Title")} body={t("partners.fact1Body")} />
            <Fact title={t("partners.fact2Title")} body={t("partners.fact2Body")} />
            <Fact title={t("partners.fact3Title")} body={t("partners.fact3Body")} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("partners.howEyebrow")} title={t("partners.howTitle")} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.titleKey} className="relative rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-leaf/10 text-leaf">
                  <step.icon size={22} aria-hidden />
                </span>
                <span className="font-serif text-2xl font-bold text-ink/25">{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-black text-ink">{t(step.titleKey)}</h3>
              <p className="mt-1.5 text-sm font-bold leading-6 text-ink/60">{t(step.bodyKey)}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm font-bold text-ink/55">
          {t("partners.howFoot")}
        </p>
      </section>

      {/* What you earn */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHead eyebrow={t("partners.earnEyebrow")} title={t("partners.earnTitle")} />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <EarnCard
              big="25%"
              label={t("partners.earnY1Label")}
              body={t("partners.earnY1Body")}
              accent
            />
            <EarnCard big="15%" label={t("partners.earnY2Label")} body={t("partners.earnY2Body")} />
            <div className="flex flex-col justify-center rounded-2xl border border-ink/10 bg-smoke p-7">
              <div className="flex items-center gap-2 text-leaf">
                <CreditCard size={20} aria-hidden />
                <p className="text-base font-black">{t("partners.earnPaidTitle")}</p>
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-ink/70">{t("partners.earnPaidBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Volume bonuses */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("partners.bonusEyebrow")} title={t("partners.bonusTitle")} />
        <p className="mx-auto mt-3 max-w-2xl text-center text-base font-bold text-ink/60">
          {t("partners.bonusBody")}
        </p>
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {bonuses.map((b) => (
            <div key={b.amount} className="rounded-2xl border border-gold/30 bg-white p-7 text-center shadow-sm">
              <Gift size={24} className="mx-auto text-gold" aria-hidden />
              <p className="mt-3 font-serif text-4xl font-bold text-ink">{b.amount}</p>
              <p className="mt-1 text-sm font-bold text-ink/60">{t(b.noteKey)}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-2 text-center text-sm font-black text-gold">
          <Trophy size={16} aria-hidden /> {t("partners.bonusFoot")}
        </p>
      </section>

      {/* The math */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHead eyebrow={t("partners.mathEyebrow")} title={t("partners.mathTitle")} />
          <div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            {/* Bars */}
            <div className="rounded-2xl border border-ink/10 bg-smoke p-7">
              <p className="text-sm font-black text-ink">{t("partners.mathCol")}</p>
              <div className="mt-8 flex h-56 items-end justify-around gap-4">
                {mathBars.map((bar) => (
                  <div key={bar.count} className="flex h-full flex-1 flex-col items-center justify-end">
                    <p className="mb-2 text-lg font-black text-ink">{bar.amount}</p>
                    <div
                      className="w-full max-w-[84px] rounded-t-lg bg-leaf"
                      style={{ height: bar.h }}
                    />
                    <p className="mt-2 text-xs font-bold text-ink/55">
                      {bar.count} {t("partners.storesWord")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* Per store */}
            <div className="flex flex-col justify-center rounded-2xl bg-deepgreen p-7 text-white">
              <p className="text-base font-black">{t("partners.mathPerStoreTitle")}</p>
              <dl className="mt-5 space-y-3">
                <Row k={`${t("partners.mathY1")} · 25%`} v="≈ $87" />
                <Row k={`${t("partners.mathY2")} · 15%`} v="≈ $52" />
                <div className="my-3 h-px bg-white/15" />
                <Row k={t("partners.mathTotal")} v="≈ $139" accent />
              </dl>
              <p className="mt-6 text-xs font-bold leading-5 text-white/60">{t("partners.mathFoot")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Apply form */}
      <section id="apply" className="scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <SectionHead eyebrow={t("partners.applyEyebrow")} title={t("partners.applyTitle")} left />
            <p className="mt-4 max-w-xl text-lg font-bold leading-8 text-ink/70">
              {t("partners.applyBody")}
            </p>
            <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-leaf">
                <Download size={18} aria-hidden />
                <p className="text-base font-black">{t("partners.pdfTitle")}</p>
              </div>
              <p className="mt-1.5 text-sm font-bold leading-6 text-ink/60">{t("partners.pdfBody")}</p>
              <a
                href={PDF_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-ink/15 px-4 font-black text-ink hover:bg-smoke"
              >
                <Download size={16} aria-hidden /> {t("partners.pdfCta")}
              </a>
            </div>
          </div>

          <PartnerForm />
        </div>
      </section>
    </main>
  );
}

function PartnerForm() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [audience, setAudience] = useState<Audience>("1-5");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const audienceLabel = t(
    audienceOptions.find((option) => option.value === audience)?.labelKey || "partners.audience1"
  );

  const mailto = useMemo(() => {
    const body = [
      `${t("partners.formName")}: ${name}`,
      `${t("partners.formEmail")}: ${email}`,
      `${t("partners.formPhone")}: ${phone || "-"}`,
      `${t("partners.formCompany")}: ${company || "-"}`,
      `${t("partners.formAudience")}: ${audienceLabel}`,
      "",
      message
    ].join("\n");
    return `mailto:dailyclose@yahoo.com?subject=${encodeURIComponent(
      t("partners.mailSubject")
    )}&body=${encodeURIComponent(body)}`;
  }, [audienceLabel, company, email, message, name, phone, t]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      audience: audienceLabel,
      message: message.trim()
    };
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      window.location.href = mailto;
      setStatus("fallback");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/notifications/partner-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("partners.formFailed"));
      if (data?.sent) {
        setStatus("sent");
      } else {
        window.location.href = mailto;
        setStatus("fallback");
      }
    } catch (err: any) {
      setError(err?.message || t("partners.formFailed"));
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-leaf/25 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={44} className="text-leaf" aria-hidden />
        <p className="mt-4 max-w-sm text-lg font-black text-ink">{t("partners.formSent")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("partners.formName")}>
          <input
            required
            className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t("partners.formEmail")}>
          <input
            required
            type="email"
            autoComplete="email"
            className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={t("partners.formPhone")}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+15551234567"
            className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field label={t("partners.formAudience")}>
          <select
            className="focus-ring h-12 w-full rounded-lg border border-ink/15 bg-white px-4 font-bold"
            value={audience}
            onChange={(event) => setAudience(event.target.value as Audience)}
          >
            {audienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t("partners.formCompany")} className="mt-4">
        <input
          className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
          placeholder={t("partners.formCompanyPh")}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </Field>

      <Field label={t("partners.formMessage")} className="mt-4">
        <textarea
          rows={5}
          className="focus-ring w-full rounded-lg border border-ink/15 px-4 py-3 font-bold leading-6"
          placeholder={t("partners.formMessagePh")}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>

      {status === "fallback" ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-700">
          <Mail size={18} aria-hidden />
          {t("partners.formFallback")}
        </div>
      ) : null}
      {status === "error" && error ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === "loading"}
          className="focus-ring inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white shadow-sm disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} aria-hidden />}
          {status === "loading" ? t("partners.formSending") : t("partners.formSubmit")}
        </button>
        <a
          href={mailto}
          className="focus-ring inline-flex h-14 items-center justify-center rounded-lg border-2 border-ink/15 bg-white px-5 font-black text-ink"
        >
          {t("partners.formEmailDirect")}
        </a>
      </div>
    </form>
  );
}

function SectionHead({
  eyebrow,
  title,
  left = false
}: {
  eyebrow: string;
  title: string;
  left?: boolean;
}) {
  return (
    <div className={left ? "" : "mx-auto max-w-2xl text-center"}>
      <p className="text-sm font-black uppercase tracking-widest text-leaf">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
    </div>
  );
}

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-1.5 text-sm font-bold leading-6 text-white/70">{body}</p>
    </div>
  );
}

function EarnCard({
  big,
  label,
  body,
  accent = false
}: {
  big: string;
  label: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border-2 border-leaf bg-leaf/5 p-7"
          : "rounded-2xl border border-ink/10 bg-smoke p-7"
      }
    >
      <p className="font-serif text-6xl font-bold text-leaf">{big}</p>
      <p className="mt-2 text-lg font-black text-ink">{label}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-ink/60">{body}</p>
    </div>
  );
}

function Row({ k, v, accent = false }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={accent ? "text-base font-black text-gold" : "text-sm font-bold text-white/75"}>{k}</dt>
      <dd className={accent ? "text-2xl font-black text-white" : "text-lg font-black text-white"}>{v}</dd>
    </div>
  );
}

function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-black text-ink">{label}</span>
      {children}
    </label>
  );
}
