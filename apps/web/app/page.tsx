"use client";

import { useEffect } from "react";
import { ProductionLogin } from "../components/production-login";
import { ApiError, getProfile } from "../lib/api-client";
import { createBrowserSupabase } from "../lib/supabase-browser";

const TOKEN_KEY = "dailyclose-token";

export default function HomePage() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserSupabase();
      if (!supabase) return;

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (cancelled) return;

        if (!token) {
          window.localStorage.removeItem(TOKEN_KEY);
          return;
        }

        try {
          const profile = await getProfile(token);
          window.localStorage.setItem(TOKEN_KEY, token);
          const next = new URLSearchParams(window.location.search).get("next");
          window.location.replace(next || (profile.role === "EMPLOYEE" ? "/employee" : "/owner"));
        } catch (err) {
          window.localStorage.removeItem(TOKEN_KEY);
          if (err instanceof ApiError && err.status === 401) {
            await supabase.auth.signOut();
          }
        }
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <ProductionLogin />;
}
