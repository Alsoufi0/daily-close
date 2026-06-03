"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useLanguage } from "../language-provider";

export function Pricing() {
  const { t } = useLanguage();
  const includes = [
    t("marketing.pricingInc1"),
    t("marketing.pricingInc2"),
    t("marketing.pricingInc3"),
    t("marketing.pricingInc4"),
    t("marketing.pricingInc5"),
    t("marketing.pricingInc6")
  ];
  const faqs = [
    { q: t("marketing.faqQ1"), a: t("marketing.faqA1") },
    { q: t("marketing.faqQ2"), a: t("marketing.faqA2") },
    { q: t("marketing.faqQ3"), a: t("marketing.faqA3") },
    { q: t("marketing.faqQ4"), a: t("marketing.faqA4") }
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.pricingEyebrow")}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-ink sm:text-5xl">{t("marketing.pricingTitle")}</h1>
        <p className="mt-4 text-lg font-bold text-ink/70">{t("marketing.pricingBody")}</p>
      </header>

      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-leaf/25 bg-white p-8 shadow-sm">
        <p className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-black text-ink">{t("marketing.priceAmount")}</span>
          <span className="text-base font-bold text-ink/60">{t("marketing.pricePer")}</span>
        </p>
        <p className="mt-2 text-center text-sm font-bold text-ink/60">{t("marketing.priceTrial")}</p>
        <Link
          href="/signup"
          className="focus-ring mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-leaf py-3.5 text-base font-black text-white hover:bg-leaf/90"
        >
          {t("marketing.pricingCta")} <ArrowRight size={18} aria-hidden />
        </Link>

        <p className="mt-6 text-sm font-black uppercase tracking-wide text-ink/55">{t("marketing.pricingIncludes")}</p>
        <ul className="mt-3 space-y-2">
          {includes.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm font-bold text-ink/75">
              <Check size={18} className="mt-0.5 shrink-0 text-leaf" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <section className="mx-auto mt-14 max-w-2xl">
        <h2 className="text-center text-2xl font-black tracking-tight text-ink">{t("marketing.faqTitle")}</h2>
        <dl className="mt-6 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
              <dt className="text-base font-black text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-sm font-bold text-ink/65">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
