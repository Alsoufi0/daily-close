"use client";

import Link from "next/link";
import { useLanguage } from "./language-provider";

// Client component so the link labels translate via t() when the language is
// switched (the global DOM localizer doesn't reliably translate these
// server-rendered marketing words). Keys reuse the same i18n entries as the
// top-bar nav + legal pages.
const LINKS = [
  { href: "/how-it-works", labelKey: "marketing.navHowItWorks" },
  { href: "/tutorials", labelKey: "marketing.navTutorials" },
  { href: "/pricing", labelKey: "marketing.navPricing" },
  { href: "/contact", labelKey: "nav.contact" },
  { href: "/privacy", labelKey: "legal.privacy" },
  { href: "/terms", labelKey: "legal.terms" }
];

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="mt-12 border-t border-ink/10 bg-white/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm font-bold text-ink/65 sm:flex-row sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Daily Close.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} className="focus-ring rounded px-1 hover:text-ink" href={link.href}>
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
