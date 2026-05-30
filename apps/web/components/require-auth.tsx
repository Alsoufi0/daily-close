"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@smokeshop/shared/types";
import { ApiError, getProfile } from "../lib/api-client";
import { createBrowserSupabase } from "../lib/supabase-browser";

const TOKEN_KEY = "dailyclose-token";

export function RequireAuth({
  children,
  allowedRoles
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const [ready, setReady] = useState(false);
  const allowedRoleKey = allowedRoles?.join("|") ?? "";

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
        if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
          window.location.replace(profile.role === "EMPLOYEE" ? "/close" : "/owner");
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
