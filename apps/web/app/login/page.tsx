"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProductionLogin } from "../../components/production-login";
import { ApiError, getProfile } from "../../lib/api-client";
import { createBrowserSupabase } from "../../lib/supabase-browser";
import { landingPath } from "../../lib/session-roles";

const TOKEN_KEY = "dailyclose-token";

// The sign-in page. `/` is now the marketing landing; this is where "Sign in"
// links and where auth guards (RequireAuth, expired-session) redirect to. If a
// session already exists we send the user straight to their dashboard, honoring
// a `?next=` target set by RequireAuth.
export default function LoginPage() {
  // Hold the login UI until we've confirmed there's no session OR a redirect
  // is in flight, so hitting Back doesn't flash the sign-in form for a frame
  // before the redirect runs.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserSupabase();
      if (!supabase) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (cancelled) return;

        if (!token) {
          window.localStorage.removeItem(TOKEN_KEY);
          setChecking(false);
          return;
        }

        try {
          const profile = await getProfile(token);
          window.localStorage.setItem(TOKEN_KEY, token);
          const next = new URLSearchParams(window.location.search).get("next");
          // Keep the spinner up while the redirect navigates away. Managers
          // (per-store admins) land on /owner like owners; plain employees /close.
          window.location.replace(next || landingPath(profile));
        } catch (err) {
          window.localStorage.removeItem(TOKEN_KEY);
          if (err instanceof ApiError && err.status === 401) {
            await supabase.auth.signOut();
          }
          if (!cancelled) setChecking(false);
        }
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-leaf" size={28} aria-hidden />
      </div>
    );
  }
  return <ProductionLogin />;
}
