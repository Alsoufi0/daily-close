"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useLanguage } from "../language-provider";
import {
  CUSTOM_FROM_STORES,
  effectivePerStoreCents,
  formatUsd,
  monthlyPriceCents,
  planForStoreCount,
  planFromCents,
  PLANS,
  type Plan
} from "@smokeshop/shared/pricing";

// Slider runs 1 → SLIDER_MAX, where the top stop means "16+ / custom".
const SLIDER_MAX = CUSTOM_FROM_STORES; // 16
// Band gradient stops along the 1..16 track (matches Solo/Multi/Growth/Chain ranges).
const TRACK_BG =
  "linear-gradient(90deg,#0e3b34 0 3.333%,#c2872b 3.333% 30%,#1f7a4d 30% 96.667%,#3a2a12 96.667% 100%)";

function rangeText(p: Plan): string {
  if (p.maxStores === null) return `${p.minStores}+ stores`;
  if (p.minStores === p.maxStores) return `${p.minStores} store`;
  return `${p.minStores}–${p.maxStores} stores`;
}

function priceLabel(p: Plan): string {
  if (p.key === "chain") return "Custom";
  const from = formatUsd(planFromCents(p));
  return p.minStores === p.maxStores ? from : `from ${from}`;
}

export function Pricing() {
  const { t } = useLanguage();
  const [count, setCount] = useState(4);
  const isCustom = count >= CUSTOM_FROM_STORES;
  const plan = planForStoreCount(count);

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
        <h1 className="mt-2 text-4xl font-black tracking-tight text-ink sm:text-5xl">Pay only for the stores you run.</h1>
        <p className="mt-4 text-lg font-bold text-ink/70">
          One simple rate per store — and it drops the more you add. Start with a 14-day free trial, no card.
        </p>
      </header>

      {/* Interactive store-count slider */}
      <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-leaf/20 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-center font-serif text-2xl font-bold text-leaf">How many stores do you run?</p>

        <div className="mt-7 px-1">
          <input
            type="range"
            min={1}
            max={SLIDER_MAX}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Number of stores"
            className="dc-range"
            style={{ background: TRACK_BG }}
          />
          {/* Ticks positioned at each value's TRUE slider position. The thumb
              centre for value v is at calc(frac·(100% − thumbW) + thumbW/2),
              frac = (v−1)/15, thumbW = 30px — so labels line up with the knob. */}
          <div className="relative mt-3 h-4 text-xs font-black text-ink/55">
            <span className="absolute -translate-x-1/2" style={{ left: "15px" }}>1</span>
            <span className="absolute -translate-x-1/2" style={{ left: "calc(0.2667 * (100% - 30px) + 15px)" }}>5</span>
            <span className="absolute -translate-x-1/2" style={{ left: "calc(0.6 * (100% - 30px) + 15px)" }}>10</span>
            <span className="absolute -translate-x-1/2" style={{ left: "calc(0.9333 * (100% - 30px) + 15px)" }}>15</span>
            <span className="absolute -translate-x-1/2" style={{ left: "calc(100% - 15px)" }}>16+</span>
          </div>
        </div>

        <div className="mt-7 text-center">
          {isCustom ? (
            <>
              <p className="font-serif text-5xl font-bold text-leaf sm:text-6xl">Custom</p>
              <p className="mt-3 text-base font-bold text-gold">16+ stores · best per-store rate — let&apos;s talk</p>
            </>
          ) : (
            <>
              <p className="flex items-baseline justify-center gap-2">
                <span className="font-serif text-5xl font-bold text-leaf sm:text-6xl">{formatUsd(monthlyPriceCents(count))}</span>
                <span className="text-lg font-bold text-ink/55">/ month</span>
              </p>
              <p className="mt-3 text-base font-bold text-gold">
                {count} {count === 1 ? "store" : "stores"} · about {formatUsd(effectivePerStoreCents(count))} each · {plan.name} plan
              </p>
            </>
          )}
        </div>

        <Link
          href="/signup"
          className="focus-ring mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-leaf py-3.5 text-base font-black text-white hover:bg-leaf/90"
        >
          {t("marketing.pricingCta")} <ArrowRight size={18} aria-hidden />
        </Link>
      </div>

      {/* Tier reference — click a plan to jump the slider there */}
      <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {PLANS.map((p) => {
          const active = p.key === plan.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setCount(p.minStores)}
              className={
                active
                  ? "rounded-2xl border-2 border-gold bg-white p-4 text-left shadow-sm"
                  : "rounded-2xl border border-ink/10 bg-white p-4 text-left shadow-sm hover:border-ink/20"
              }
            >
              <p className="font-serif text-xl font-bold text-ink">{p.name}</p>
              <p className="text-xs font-bold text-ink/55">{rangeText(p)}</p>
              <p className="mt-2 text-base font-black text-leaf">{priceLabel(p)}</p>
            </button>
          );
        })}
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm font-bold text-ink/55">
        Every plan does everything — you only pay for the shops you run. Pause any store anytime, and it&apos;s not billed.
      </p>

      {/* What's included */}
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-ink/10 bg-white p-7 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-ink/55">{t("marketing.pricingIncludes")}</p>
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

      <style jsx>{`
        .dc-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 14px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
        }
        .dc-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #ffffff;
          border: 5px solid #c2872b;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
          cursor: pointer;
        }
        .dc-range::-moz-range-thumb {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #ffffff;
          border: 5px solid #c2872b;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
          cursor: pointer;
        }
      `}</style>
    </main>
  );
}
