"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { clsx } from "clsx";
import { createBrowserSupabase } from "../lib/supabase-browser";
import { useSession } from "../lib/use-session";
import { isAccountOwner, isAdminLike } from "../lib/session-roles";
import { LanguageSelect, useLanguage } from "./language-provider";

// `adminOnly`: owner OR per-store manager (store-scoped admin pages).
// `accountOnly`: true account owner only (billing + account-level settings).
const NAV = [
  { href: "/owner", labelKey: "nav.owner", adminOnly: true },
  { href: "/owner/receipts", labelKey: "nav.receipts", adminOnly: true },
  { href: "/close", labelKey: "nav.close" },
  { href: "/admin", labelKey: "nav.admin", adminOnly: true },
  // Platform staff only — the management console (referral program).
  { href: "/console/partners", label: "Console", superAdminOnly: true },
  // Settings hub groups phone sign-in, WhatsApp, billing, and password.
  { href: "/account", labelKey: "nav.settings" }
] as Array<{
  href: string;
  labelKey?: string;
  label?: string;
  adminOnly?: boolean;
  accountOnly?: boolean;
  superAdminOnly?: boolean;
}>;

// Public marketing nav shown to signed-out visitors.
const MARKETING_NAV = [
  { href: "/how-it-works", labelKey: "marketing.navHowItWorks" },
  { href: "/tutorials", labelKey: "marketing.navTutorials" },
  // Pricing tab hidden until the new tiered pricing goes live in Stripe (the
  // /pricing page advertises tiers the checkout doesn't charge yet). Re-add to
  // restore. See docs/PRICING_TIERED_GOLIVE.md.
  { href: "/contact", labelKey: "nav.contact" }
] as Array<{ href: string; labelKey: string }>;

export function TopBar() {
  const pathname = usePathname() || "/";
  const session = useSession();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Close the menu on route change
  useEffect(() => setOpen(false), [pathname]);

  // Re-check token on every route change so the nav adapts to sign-in/out.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSignedIn(Boolean(window.localStorage.getItem("dailyclose-token")));
  }, [pathname]);

  async function signOut() {
    window.localStorage.removeItem("dailyclose-token");
    const supabase = createBrowserSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    window.location.href = "/";
  }

  const showSignOut =
    pathname.startsWith("/owner") ||
    pathname.startsWith("/close") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/account");
  const adminLike = isAdminLike(session.profile);
  const accountOwner = isAccountOwner(session.profile);
  const superAdmin = session.profile?.role === "SUPER_ADMIN";
  const navItems = NAV.filter((item) => {
    if (item.superAdminOnly) return superAdmin;
    if (item.accountOnly) return accountOwner;
    if (item.adminOnly) return adminLike;
    return true;
  });

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="focus-ring flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-touch-icon.png" alt="Daily Close" className="h-9 w-9 rounded-lg shadow-sm" />
          <span className="text-lg font-black tracking-tight">Daily Close</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm font-black md:flex">
          <LanguageSelect />
          {signedIn ? (
            <>
              {navItems.map((item) => {
                const active = item.href === "/owner" ? pathname === "/owner" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "focus-ring rounded-lg px-3 py-2 transition-colors",
                      active ? "bg-leaf/10 text-leaf" : "text-ink/65 hover:bg-smoke hover:text-ink"
                    )}
                  >
                    {item.label ?? t(item.labelKey ?? "")}
                  </Link>
                );
              })}
              <button
                onClick={signOut}
                className="focus-ring ml-2 inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-ink/70 hover:bg-smoke hover:text-ink"
              >
                <LogOut size={16} aria-hidden />
                {t("auth.signOut")}
              </button>
            </>
          ) : (
            <>
              {MARKETING_NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "focus-ring rounded-lg px-3 py-2 transition-colors",
                      active ? "bg-leaf/10 text-leaf" : "text-ink/65 hover:bg-smoke hover:text-ink"
                    )}
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
              <Link
                href="/login"
                className="focus-ring ml-1 inline-flex h-10 items-center justify-center rounded-lg border border-ink/15 px-4 font-black text-ink hover:bg-smoke"
              >
                {t("auth.signIn")}
              </Link>
              <Link
                href="/signup"
                className="focus-ring inline-flex h-10 items-center justify-center rounded-lg bg-leaf px-4 font-black text-white hover:bg-leaf/90"
              >
                {t("auth.getStarted")}
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger (signed-in and signed-out) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ink/15 text-ink/80 md:hidden"
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>

      {/* Mobile sheet */}
      {open ? (
        <div className="border-t border-ink/10 bg-white md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 text-base font-black">
            {signedIn ? (
              <>
                {navItems.map((item) => {
                  const active = item.href === "/owner" ? pathname === "/owner" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "focus-ring flex min-h-[44px] items-center rounded-lg px-3",
                        active ? "bg-leaf/10 text-leaf" : "text-ink/75 hover:bg-smoke"
                      )}
                    >
                      {item.label ?? t(item.labelKey ?? "")}
                    </Link>
                  );
                })}
                {showSignOut ? (
                  <button
                    onClick={signOut}
                    className="focus-ring mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-ink/15 px-3 text-ink/80"
                  >
                    <LogOut size={18} aria-hidden /> {t("auth.signOut")}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {MARKETING_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                    className="focus-ring flex min-h-[44px] items-center rounded-lg px-3 text-ink/75 hover:bg-smoke"
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
                <Link
                  href="/login"
                  className="focus-ring mt-1 flex min-h-[44px] items-center justify-center rounded-lg border-2 border-ink/15 px-3 text-ink hover:bg-smoke"
                >
                  {t("auth.signIn")}
                </Link>
                <Link
                  href="/signup"
                  className="focus-ring flex min-h-[44px] items-center justify-center rounded-lg bg-leaf px-3 text-white"
                >
                  {t("auth.getStarted")}
                </Link>
              </>
            )}
            <div className="px-3 py-2">
              <LanguageSelect />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
