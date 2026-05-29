"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProductionLogin } from "../components/production-login";
import { ApiError, getProfile } from "../lib/api-client";
import { createBrowserSupabase } from "../lib/supabase-browser";

const TOKEN_KEY = "dailyclose-token";

export default function HomePage() {
  // Hold the login UI until we've confirmed there's no session OR a redirect
  // is in flight. Otherwise hitting Back lands on `/` and flashes the sign-in
  // page for a frame before the redirect runs.
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
          // Keep the spinner up while the redirect navigates away.
          window.location.replace(next || (profile.role === "EMPLOYEE" ? "/employee" : "/owner"));
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
