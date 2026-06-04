"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, KeyRound, MessageCircle, Smartphone } from "lucide-react";
import { RequireAuth } from "../../components/require-auth";
import { useLanguage } from "../../components/language-provider";
import { useSession } from "../../lib/use-session";
import { isAccountOwner } from "../../lib/session-roles";

export default function AccountSettingsPage() {
  return (
    <RequireAuth>
      <SettingsHub />
    </RequireAuth>
  );
}

// One place for account settings: phone sign-in, WhatsApp alerts, billing, and
// password. WhatsApp + billing are owner-only; phone sign-in + password apply to
// anyone signed in. Each row links to its own page.
function SettingsHub() {
  const { t, dir } = useLanguage();
  const session = useSession();
  const owner = isAccountOwner(session.profile);

  const rows = [
    {
      href: "/account/phone-signin",
      icon: Smartphone,
      title: t("phoneSignin.title"),
      subtitle: t("phoneSignin.listSubtitle"),
      show: true
    },
    {
      href: "/account/whatsapp",
      icon: MessageCircle,
      title: t("settings.whatsappTitle"),
      subtitle: t("settings.whatsappListSubtitle"),
      show: owner
    },
    {
      href: "/billing",
      icon: CreditCard,
      title: t("settings.billingTitle"),
      subtitle: t("settings.billingSubtitle"),
      show: owner
    },
    {
      href: "/account/password",
      icon: KeyRound,
      title: t("account.changePassword"),
      subtitle: t("settings.changePasswordSubtitle"),
      show: true
    }
  ].filter((r) => r.show);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6" dir={dir}>
      <h1 className="text-2xl font-black">{t("nav.settings")}</h1>
      <p className="mt-1 text-xs font-black uppercase tracking-wide text-ink/45">{t("settings.accountSection")}</p>

      <div className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <Link
              key={row.href}
              href={row.href}
              className="focus-ring flex items-center gap-4 px-5 py-4 transition-colors hover:bg-smoke"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-ink">{row.title}</span>
                <span className="block text-sm font-semibold text-ink/55">{row.subtitle}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-ink/40" aria-hidden />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
