"use client";

import { useLanguage } from "../language-provider";

type Shot = {
  src: string;
  /** Intrinsic pixel size of the 2x capture — sets the aspect ratio so there's no layout shift. */
  w: number;
  h: number;
  title: string;
  body: string;
  reverse?: boolean;
};

/**
 * "See it in action" — real, on-brand product shots (owner dashboard summary,
 * PDF report, CSV export) presented as alternating image/text rows on desktop
 * and a clean stacked layout on mobile. The images already carry their own soft
 * gradient panel + window/page chrome, so they read as framed scenes on any
 * background.
 */
export function Showcase() {
  const { t } = useLanguage();
  const shots: Shot[] = [
    { src: "/shots/dashboard.png", w: 2320, h: 1520, title: t("marketing.showcaseDashTitle"), body: t("marketing.showcaseDashBody") },
    { src: "/shots/report.png", w: 1800, h: 2240, title: t("marketing.showcaseReportTitle"), body: t("marketing.showcaseReportBody"), reverse: true },
    { src: "/shots/csv.png", w: 2480, h: 1280, title: t("marketing.showcaseCsvTitle"), body: t("marketing.showcaseCsvBody") }
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">{t("marketing.showcaseEyebrow")}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t("marketing.showcaseTitle")}</h2>
        <p className="mt-3 text-base font-bold text-ink/65">{t("marketing.showcaseSub")}</p>
      </div>

      <div className="mt-10 space-y-10 sm:mt-12 sm:space-y-14">
        {shots.map((shot) => (
          <div key={shot.src} className="grid items-center gap-5 sm:gap-8 lg:grid-cols-2 lg:gap-12">
            <div className={shot.reverse ? "lg:order-2" : ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={shot.title}
                width={shot.w}
                height={shot.h}
                loading="lazy"
                decoding="async"
                className="w-full rounded-2xl shadow-xl ring-1 ring-ink/5"
              />
            </div>
            <div className={shot.reverse ? "text-center lg:order-1 lg:pr-6 lg:text-left" : "text-center lg:pl-6 lg:text-left"}>
              <h3 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{shot.title}</h3>
              <p className="mx-auto mt-3 max-w-md text-base font-bold text-ink/65 lg:mx-0">{shot.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
