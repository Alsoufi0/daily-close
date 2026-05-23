"use client";

import { useEffect } from "react";
import { ProductionLogin } from "../components/production-login";
import { createBrowserSupabase } from "../lib/supabase-browser";

const TOKEN_KEY = "dailyclose-token";

export default function HomePage() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Trust Supabase as the source of truth: if it has a live session
      // (after auto-refresh), the user is signed in. If it doesn't, any
      // dailyclose-token left over in localStorage is stale — drop it so
      // useSession can't kick off a doomed /auth/profile call that
      // bounces us back here with ?expired=1.
      const supabase = createBrowserSupabase();
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.access_token) {
          window.localStorage.setItem(TOKEN_KEY, data.session.access_token);
          const next = new URLSearchParams(window.location.search).get("next");
          window.location.replace(next || "/owner");
        } else {
          window.localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        /* show landing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return <ProductionLogin />;
}
