"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@smokeshop/shared/types";
import { ApiError, getProfile } from "../lib/api-client";
import { createBrowserSupabase } from "../lib/supabase-browser";

const TOKEN_KEY = "dailyclose-token";

/**
 * Auth gate for protected pages. Avoids races with AuthBootstrap by asking
 * the supabase JS client directly: it owns the source-of-truth session in
 * its own storage and will auto-refresh an expired access token. Only if
 * there's truly no session do we bounce to the sign-in page, and we wipe
 * any stale localStorage token on the way so useSession can't follow up
 * with a doomed API call that re-triggers /?expired=1.
 */
export function RequireAuth({
  children,
  allowedRoles
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      let token = window.localStorage.getItem(TOKEN_KEY) || undefined;

      // Always ask Supabase too — it might have a fresher session in its
      // own storage that AuthBootstrap hasn't yet mirrored to localStorage.
      const supabase = createBrowserSupabase();
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            token = data.session.access_token;
            window.localStorage.setItem(TOKEN_KEY, token);
          } else if (!token) {
            // No session anywhere — make sure stale data is gone.
            window.localStorage.removeItem(TOKEN_KEY);
          }
        } catch {
          /* fall through to localStorage check */
        }
      }

      if (cancelled) return;
      if (!token) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/?next=${next}`);
        return;
      }

      if (allowedRoles?.length) {
        try {
          const profile = await getProfile(token);
          if (!allowedRoles.includes(profile.role)) {
            setBlocked(true);
            const target = profile.role === "EMPLOYEE" ? "/employee" : "/owner";
            window.location.replace(target);
            return;
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            window.localStorage.removeItem(TOKEN_KEY);
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.replace(`/?next=${next}`);
            return;
          }
        }
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || blocked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }
  return <>{children}</>;
}
