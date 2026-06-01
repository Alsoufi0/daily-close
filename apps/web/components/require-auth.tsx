"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@dailyclose/shared/types";
import { ApiError, getProfile } from "../lib/api-client";
import { createBrowserSupabase } from "../lib/supabase-browser";
import { isManager, landingPath } from "../lib/session-roles";

const TOKEN_KEY = "dailyclose-token";

export function RequireAuth({
  children,
  allowedRoles,
  // When true, a per-store manager (global role EMPLOYEE with MANAGER stores)
  // is allowed through even if EMPLOYEE isn't in allowedRoles. Used on the
  // owner-style admin pages (dashboard, receipts, stores, employees) but NOT
  // on account-only pages (billing, WhatsApp, setup).
  allowManagers = false
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  allowManagers?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const allowedRoleKey = `${allowedRoles?.join("|") ?? ""}:${allowManagers}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function redirectToLogin() {
      window.localStorage.removeItem(TOKEN_KEY);
      const supabase = createBrowserSupabase();
      try {
        await supabase?.auth.signOut();
      } catch {
        /* ignore */
      }
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/?next=${next}`);
    }

    (async () => {
      const supabase = createBrowserSupabase();
      let token: string | undefined;

      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token;
        } catch {
          token = undefined;
        }
      } else {
        token = window.localStorage.getItem(TOKEN_KEY) || undefined;
      }

      if (cancelled) return;
      if (!token) {
        await redirectToLogin();
        return;
      }

      window.localStorage.setItem(TOKEN_KEY, token);

      try {
        const profile = await getProfile(token);
        const managerAllowed = allowManagers && isManager(profile);
        if (allowedRoles?.length && !allowedRoles.includes(profile.role) && !managerAllowed) {
          window.location.replace(landingPath(profile));
          return;
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await redirectToLogin();
          return;
        }
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [allowedRoleKey]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }
  return <>{children}</>;
}
