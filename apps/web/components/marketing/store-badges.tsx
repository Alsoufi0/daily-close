"use client";

import { useLanguage } from "../language-provider";

// Clean, official-style App Store + Google Play badges drawn inline (dark
// pills, white glyphs) so they look premium at any scale — no low-res badge
// images. Brand names stay in English by convention. Apps aren't on the
// stores yet, so by default the badges render as non-linking with a small
// "coming soon" note; pass real `appStoreHref` / `playHref` to activate them.
export function StoreBadges({
  appStoreHref,
  playHref,
  align = "start"
}: {
  appStoreHref?: string;
  playHref?: string;
  align?: "start" | "center";
}) {
  const { t } = useLanguage();
  const live = Boolean(appStoreHref || playHref);
  return (
    <div className={align === "center" ? "flex flex-col items-center" : "flex flex-col items-start"}>
      {/* Only show the "coming soon" eyebrow before anything is live. Once a
          store link is passed, the badges speak for themselves and any not-yet
          store gets its own small "Soon" tag instead. */}
      {!live && (
        <p className="mb-2.5 text-xs font-black uppercase tracking-wide text-ink/45">
          {t("marketing.appsComingSoon")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Badge
          href={appStoreHref}
          live={live}
          top="Download on the"
          bottom="App Store"
          glyph={
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden>
              <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.12zM14.6 4.6c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
            </svg>
          }
        />
        <Badge
          href={playHref}
          live={live}
          top="Get it on"
          bottom="Google Play"
          glyph={
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden>
              <path d="M3 2.6v18.8c0 .57.62.92 1.12.63l16.3-9.4c.5-.29.5-1 0-1.29L4.12 1.97C3.62 1.68 3 2.03 3 2.6z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function Badge({
  href,
  live,
  top,
  bottom,
  glyph
}: {
  href?: string;
  live: boolean;
  top: string;
  bottom: string;
  glyph: React.ReactNode;
}) {
  const inner = (
    <span className="flex items-center gap-2.5 rounded-xl bg-ink px-4 py-2.5 text-white shadow-sm ring-1 ring-white/10">
      {glyph}
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold tracking-wide text-white/70">{top}</span>
        <span className="mt-1 text-lg font-black leading-none tracking-tight">{bottom}</span>
      </span>
    </span>
  );
  if (live && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="focus-ring rounded-xl transition-transform hover:scale-[1.02]">
        {inner}
      </a>
    );
  }
  return (
    <span className="relative cursor-default opacity-90" aria-disabled>
      {inner}
      {live && (
        <span className="absolute -right-2 -top-2 rounded-full bg-leaf px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">
          Soon
        </span>
      )}
    </span>
  );
}
