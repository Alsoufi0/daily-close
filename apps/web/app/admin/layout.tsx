"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Settings, Store, Users } from "lucide-react";
import { clsx } from "clsx";

const items = [
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-leaf">
        <Settings size={16} aria-hidden /> Admin
      </header>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-ink/10 bg-white p-2 shadow-sm lg:flex-col">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black",
                    active ? "bg-leaf/10 text-leaf" : "text-ink/65 hover:bg-smoke hover:text-ink"
                  )}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </main>
  );
}
