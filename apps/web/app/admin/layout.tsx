"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Handshake, Percent, Settings, Store, Users, Wallet } from "lucide-react";
import { clsx } from "clsx";
import { RequireAuth } from "../../components/require-auth";
import { useSession } from "../../lib/use-session";
import { isAccountOwner } from "../../lib/session-roles";
import { useLanguage } from "../../components/language-provider";

interface NavItem {
  href: string;
  icon: typeof Store;
  labelKey?: string;
  label?: string;
  accountOnly?: boolean;
  superAdminOnly?: boolean;
}

const items: NavItem[] = [
  { href: "/admin/stores", labelKey: "admin.stores", icon: Store },
  { href: "/admin/employees", labelKey: "admin.employees", icon: Users },
  // Billing is account-owner-only — hidden from per-store managers.
  { href: "/billing", labelKey: "nav.billing", icon: CreditCard, accountOnly: true },
  // Platform-staff (SUPER_ADMIN) only — partner referral program.
  { href: "/admin/partners", label: "Partners", icon: Handshake, superAdminOnly: true },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet, superAdminOnly: true },
  { href: "/admin/referral-settings", label: "Referral rate", icon: Percent, superAdminOnly: true }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const session = useSession();
  const { t } = useLanguage();
  const accountOwner = isAccountOwner(session.profile);
  const superAdmin = session.profile?.role === "SUPER_ADMIN";
  const visibleItems = items.filter(
    (item) => (!item.accountOnly || accountOwner) && (!item.superAdminOnly || superAdmin)
  );
  return (
    <RequireAuth allowedRoles={["STORE_OWNER", "SUPER_ADMIN"]} allowManagers>
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-leaf">
        <Settings size={16} aria-hidden /> {t("admin.sidebarTitle")}
      </header>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-ink/10 bg-white p-2 shadow-sm lg:flex-col">
            {visibleItems.map(({ href, labelKey, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "focus-ring flex min-h-[44px] flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black lg:flex-none",
                    active ? "bg-leaf/10 text-leaf" : "text-ink/65 hover:bg-smoke hover:text-ink"
                  )}
                >
                  <Icon size={16} aria-hidden />
                  {label ?? t(labelKey ?? "")}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </main>
    </RequireAuth>
  );
}
