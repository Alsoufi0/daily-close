"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../language-provider";
import { PhoneFrame } from "./phone-frame";

export function HowItWorks() {
  const { t } = useLanguage();
  const steps = [
    { title: t("marketing.step1Title"), body: t("marketing.step1Body") },
    { title: t("marketing.step2Title"), body: t("marketing.step2Body") },
    { title: t("marketing.step3Title"), body: t("marketing.step3Body") },
    { title: t("marketing.step4Title"), body: t("marketing.step4Body") }
  ];

  return (
    <main className="w-full">
      <header className="mx-auto max-w-2xl px-4 pb-2 pt-12 text-center sm:px-6 lg:pt-16">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.howEyebrow")}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-ink sm:text-5xl">{t("marketing.howTitle")}</h1>
        <p className="mt-4 text-lg font-bold text-ink/70">{t("marketing.howBody")}</p>
      </header>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <PhoneFrame
          mode="loop"
          src="/videos/hero-demo.mp4"
          poster="/videos/posters/hero-demo.jpg"
          label={t("marketing.heroDemoCaption")}
          caption={t("marketing.heroDemoCaption")}
          comingSoonText={t("marketing.tutComingSoon")}
        />

        <ol className="space-y-5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf font-black text-white">
                {i + 1}
              </span>
              <div>
                <h2 className="text-xl font-black text-ink">{s.title}</h2>
                <p className="mt-1 text-base font-bold text-ink/65">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <section className="mx-auto w-full max-w-4xl px-4 py-12 text-center sm:px-6">
        <h2 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{t("marketing.ctaTitle")}</h2>
        <p className="mt-3 text-lg font-bold text-ink/70">{t("marketing.ctaBody")}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-leaf px-6 py-3 text-base font-black text-white hover:bg-leaf/90"
          >
            {t("marketing.ctaPrimary")} <ArrowRight size={18} aria-hidden />
          </Link>
          <Link
            href="/tutorials"
            className="focus-ring inline-flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-6 py-3 text-base font-black text-ink hover:bg-smoke"
          >
            {t("marketing.navTutorials")}
          </Link>
        </div>
      </section>
    </main>
  );
}
