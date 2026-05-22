"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, LogOut } from "lucide-react";
import { clsx } from "clsx";
import { createBrowserSupabase } from "../lib/supabase-browser";

const NAV = [
  { href: "/owner", label: "Owner" },
  { href: "/employee", label: "Employee" },
  { href: "/admin", label: "Admin" },
  { href: "/billing", label: "Billing" },
  { href: "/account/password", label: "Password" }
];

export function TopBar() {
  const pathname = usePathname() || "/";

  async function signOut() {
    window.localStorage.removeItem("smokeshop-token");
    const supabase = createBrowserSupabase();
    if (supabase) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    window.location.href = "/";
  }

  const showSignOut = pathname.startsWith("/owner") || pathname.startsWith("/employee");

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg px-1 py-1 text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf text-white shadow-sm">
            <Leaf size={20} aria-hidden />
          </span>
          <span className="text-lg font-black tracking-tight">SmokeShop</span>
          <span className="hidden text-sm font-bold text-ink/55 sm:inline">Daily Close</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-black">
          {NAV.map((item) => {
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
                {item.label}
              </Link>
            );
          })}
          {showSignOut ? (
            <button
              onClick={signOut}
              className="focus-ring ml-2 inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-ink/70 hover:bg-smoke hover:text-ink"
            >
              <LogOut size={16} aria-hidden />
              Sign Out
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
