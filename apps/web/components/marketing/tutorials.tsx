"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../language-provider";
import { PhoneFrame } from "./phone-frame";

export function Tutorials() {
  const { t } = useLanguage();
  const videos = [
    {
      src: "/videos/get-started.mp4",
      poster: "/videos/posters/get-started.jpg",
      title: t("marketing.tutGetStartedTitle"),
      body: t("marketing.tutGetStartedBody")
    },
    {
      src: "/videos/create-store.mp4",
      poster: "/videos/posters/create-store.jpg",
      title: t("marketing.tutCreateStoreTitle"),
      body: t("marketing.tutCreateStoreBody")
    },
    {
      src: "/videos/download-reports.mp4",
      poster: "/videos/posters/download-reports.jpg",
      title: t("marketing.tutReportsTitle"),
      body: t("marketing.tutReportsBody")
    }
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.tutEyebrow")}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-ink sm:text-5xl">{t("marketing.tutTitle")}</h1>
        <p className="mt-4 text-lg font-bold text-ink/70">{t("marketing.tutBody")}</p>
      </header>

      <div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v, i) => (
          <div key={v.src} className="flex flex-col items-center">
            <PhoneFrame
              mode="tutorial"
              src={v.src}
              poster={v.poster}
              label={v.title}
              comingSoonText={t("marketing.tutComingSoon")}
            />
            <div className="mt-5 max-w-xs text-center">
              <p className="text-xs font-black uppercase tracking-wide text-leaf">{`0${i + 1}`}</p>
              <h2 className="mt-1 text-xl font-black text-ink">{v.title}</h2>
              <p className="mt-1.5 text-sm font-bold text-ink/65">{v.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 flex flex-col items-center gap-4 rounded-2xl border border-leaf/20 bg-leaf/5 p-8 text-center">
        <h2 className="text-2xl font-black text-ink">{t("marketing.ctaTitle")}</h2>
        <p className="text-base font-bold text-ink/70">{t("marketing.ctaBody")}</p>
        <Link
          href="/signup"
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-leaf px-6 py-3 text-base font-black text-white hover:bg-leaf/90"
        >
          {t("marketing.ctaPrimary")} <ArrowRight size={18} aria-hidden />
        </Link>
      </div>
    </main>
  );
}
