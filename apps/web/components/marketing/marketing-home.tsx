"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  Building2,
  Camera,
  Coins,
  Download
} from "lucide-react";
import { useLanguage } from "../language-provider";
import { useSession } from "../../lib/use-session";
import { landingPath } from "../../lib/session-roles";
import { PhoneFrame } from "./phone-frame";
import { StoreBadges } from "./store-badges";

export function MarketingHome() {
  const { t } = useLanguage();
  const session = useSession();
  const signedIn = Boolean(session.profile);
  const dashHref = landingPath(session.profile);

  return (
    <main className="w-full">
      {/* Hero */}
      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-8 overflow-hidden px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-16 -z-10 h-72 w-72 rounded-full bg-leaf/10 blur-3xl"
        />
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.heroEyebrow")}</p>
          <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t("marketing.heroTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-lg font-bold text-ink/70">{t("marketing.heroBody")}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {signedIn ? (
              <Link
                href={dashHref}
                className="focus-ring inline-flex items-center gap-2 rounded-xl bg-leaf px-6 py-3 text-base font-black text-white shadow-sm hover:bg-leaf/90"
              >
                {t("marketing.goToDashboard")} <ArrowRight size={18} aria-hidden />
              </Link>
            ) : (
              <Link
                href="/signup"
                className="focus-ring inline-flex items-center gap-2 rounded-xl bg-leaf px-6 py-3 text-base font-black text-white shadow-sm hover:bg-leaf/90"
              >
                {t("marketing.heroPrimaryCta")} <ArrowRight size={18} aria-hidden />
              </Link>
            )}
            <Link
              href="/how-it-works"
              className="focus-ring inline-flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-6 py-3 text-base font-black text-ink hover:bg-smoke"
            >
              {t("marketing.heroSecondaryCta")}
            </Link>
          </div>
          <p className="mt-4 text-sm font-bold text-ink/55">{t("marketing.heroNote")}</p>
          <div className="mt-8">
            <StoreBadges />
          </div>
        </div>

        {/* On desktop, right-align the hero phone within its column so it sits
            toward the page edge (balances the text-heavy left column); stays
            centered on mobile. */}
        <PhoneFrame
          mode="loop"
          src="/videos/hero-demo.mp4"
          poster="/videos/posters/hero-demo.jpg"
          caption={t("marketing.heroDemoCaption")}
          label={t("marketing.heroDemoCaption")}
          comingSoonText={t("marketing.tutComingSoon")}
          className="lg:mr-0"
        />
      </section>

      {/* Trust line */}
      <p className="mx-auto max-w-6xl px-4 pb-2 text-center text-sm font-black uppercase tracking-wide text-ink/45 sm:px-6">
        {t("marketing.trustLine")}
      </p>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{t("marketing.featuresTitle")}</h2>
          <p className="mt-3 text-base font-bold text-ink/65">{t("marketing.featuresBody")}</p>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-3">
          <Feature icon={<Camera size={22} />} title={t("marketing.featureScanTitle")} body={t("marketing.featureScanBody")} />
          <Feature icon={<Coins size={22} />} title={t("marketing.featureCashTitle")} body={t("marketing.featureCashBody")} />
          <Feature icon={<BarChart3 size={22} />} title={t("marketing.featureDashTitle")} body={t("marketing.featureDashBody")} />
          <Feature icon={<BellRing size={22} />} title={t("marketing.featureAlertsTitle")} body={t("marketing.featureAlertsBody")} />
          <Feature icon={<Download size={22} />} title={t("marketing.featureExportTitle")} body={t("marketing.featureExportBody")} />
          <Feature icon={<Building2 size={22} />} title={t("marketing.featureMultiTitle")} body={t("marketing.featureMultiBody")} />
        </div>
      </section>

      {/* How it works teaser */}
      <section className="bg-leaf/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.howEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t("marketing.howTitle")}</h2>
          </div>
          <ol className="mt-7 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
            <Step n={1} title={t("marketing.step1Title")} body={t("marketing.step1Body")} />
            <Step n={2} title={t("marketing.step2Title")} body={t("marketing.step2Body")} />
            <Step n={3} title={t("marketing.step3Title")} body={t("marketing.step3Body")} />
            <Step n={4} title={t("marketing.step4Title")} body={t("marketing.step4Body")} />
          </ol>
          <div className="mt-8 text-center">
            <Link href="/how-it-works" className="focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-base font-black text-leaf hover:underline">
              {t("marketing.heroSecondaryCta")} <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Tutorials teaser */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.tutEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t("marketing.tutTitle")}</h2>
          <p className="mt-3 text-base font-bold text-ink/65">{t("marketing.tutBody")}</p>
        </div>
        {/* Mobile: horizontal swipe/flip carousel (peeks the next card) so the
            three tall phone demos don't stack into a very long page. Desktop:
            unchanged 3-up grid. */}
        <div className="-mx-4 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:px-0 sm:pb-0">
          <div className="w-[78%] shrink-0 snap-center sm:w-auto">
            <PhoneFrame mode="tutorial" src="/videos/get-started.mp4" poster="/videos/posters/get-started.jpg" caption={t("marketing.tutGetStartedTitle")} label={t("marketing.tutGetStartedTitle")} comingSoonText={t("marketing.tutComingSoon")} />
          </div>
          <div className="w-[78%] shrink-0 snap-center sm:w-auto">
            <PhoneFrame mode="tutorial" src="/videos/create-store.mp4" poster="/videos/posters/create-store.jpg" caption={t("marketing.tutCreateStoreTitle")} label={t("marketing.tutCreateStoreTitle")} comingSoonText={t("marketing.tutComingSoon")} />
          </div>
          <div className="w-[78%] shrink-0 snap-center sm:w-auto">
            <PhoneFrame mode="tutorial" src="/videos/download-reports.mp4" poster="/videos/posters/download-reports.jpg" caption={t("marketing.tutReportsTitle")} label={t("marketing.tutReportsTitle")} comingSoonText={t("marketing.tutComingSoon")} />
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link href="/tutorials" className="focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-base font-black text-leaf hover:underline">
            {t("marketing.navTutorials")} <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-ink text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-10 text-center sm:gap-6 sm:px-6 sm:py-14">
          <p className="text-sm font-black uppercase tracking-wide text-white/70">{t("marketing.pricingEyebrow")}</p>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t("marketing.pricingTitle")}</h2>
          <p className="flex items-baseline gap-2 text-4xl font-black sm:text-5xl">
            {t("marketing.priceAmount")}
            <span className="text-base font-bold text-white/70">{t("marketing.pricePer")}</span>
          </p>
          <p className="text-sm font-bold text-white/70">{t("marketing.priceTrial")}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-leaf px-6 py-3 text-base font-black text-white hover:bg-leaf/90">
              {t("marketing.pricingCta")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/pricing" className="focus-ring inline-flex items-center gap-2 rounded-xl border-2 border-white/25 px-6 py-3 text-base font-black text-white hover:bg-white/10">
              {t("marketing.navPricing")}
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-16">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf/10 text-leaf">
          <BadgeCheck size={28} aria-hidden />
        </span>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t("marketing.ctaTitle")}</h2>
        <p className="mt-3 text-lg font-bold text-ink/70">{t("marketing.ctaBody")}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href={signedIn ? dashHref : "/signup"} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-leaf px-6 py-3 text-base font-black text-white hover:bg-leaf/90">
            {signedIn ? t("marketing.goToDashboard") : t("marketing.ctaPrimary")} <ArrowRight size={18} aria-hidden />
          </Link>
          <Link href="/contact" className="focus-ring inline-flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-6 py-3 text-base font-black text-ink hover:bg-smoke">
            {t("marketing.ctaSecondary")}
          </Link>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf/10 text-leaf sm:h-11 sm:w-11">{icon}</span>
      <h3 className="mt-3 text-base font-black text-ink sm:mt-4 sm:text-lg">{title}</h3>
      <p className="mt-1.5 text-sm font-bold text-ink/65">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf font-black text-white">{n}</span>
      <h3 className="mt-3 text-base font-black text-ink sm:mt-4">{title}</h3>
      <p className="mt-1.5 text-sm font-bold text-ink/65">{body}</p>
    </li>
  );
}
