"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Gauge, Handshake, Percent, ShieldCheck, Wallet } from "lucide-react";
import { clsx } from "clsx";
import { RequireAuth } from "../../components/require-auth";
import { useSession } from "../../lib/use-session";

// Platform-staff console — deliberately styled NOTHING like the store-owner
// portal: dark chrome, a "PLATFORM CONSOLE" identity, and its own nav. This is
// the admin surface for the referral/commission program (and the home for
// future platform tooling like scan alerts and partner emails).
const nav = [
  { href: "/console/partners", label: "Partners", icon: Handshake },
  { href: "/console/payouts", label: "Payouts", icon: Wallet },
  { href: "/console/referral-settings", label: "Referral rate", icon: Percent }
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const session = useSession();

  return (
    <RequireAuth allowedRoles={["SUPER_ADMIN"]}>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 text-slate-100">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf/20 text-leaf">
                <ShieldCheck size={18} aria-hidden />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-black tracking-tight">Daily Close</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-leaf">
                  Platform Console
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {session.profile?.email && (
                <span className="hidden text-xs font-semibold text-slate-300 sm:inline">
                  {session.profile.email}
                </span>
              )}
              <Link
                href="/owner"
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
              >
                <ArrowLeft size={13} aria-hidden /> Exit to app
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <aside>
            <div className="mb-3 flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <Gauge size={13} aria-hidden /> Management
            </div>
            <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:flex-col">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "focus-ring flex min-h-[44px] flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black lg:flex-none",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <section>{children}</section>
        </div>
      </div>
    </RequireAuth>
  );
}
