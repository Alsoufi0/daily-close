"use client";

import { useEffect } from "react";
import { createBrowserSupabase } from "../lib/supabase-browser";

const TOKEN_KEY = "dailyclose-token";

/**
 * Mounted globally in the root layout. Does two things:
 *
 * 1. Picks up the access_token from the URL hash after a Supabase email
 *    confirmation / magic-link redirect (Supabase sends ?#access_token=...
 *    on the redirect URL; the JS client's detectSessionInUrl reads it
 *    automatically the first time we call getSession()). Without this,
 *    a freshly-confirmed user lands on /setup with no token in localStorage
 *    and useSession bounces them to /?expired=1.
 *
 * 2. Keeps localStorage["dailyclose-token"] in sync with the supabase
 *    session via onAuthStateChange so a fresh tab on the same browser
 *    works after token refresh.
 */
export function AuthBootstrap() {
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session?.access_token) {
          window.localStorage.setItem(TOKEN_KEY, data.session.access_token);
          // Clean #access_token=... off the URL so it isn't visible / shareable.
          if (window.location.hash.includes("access_token")) {
            const clean = window.location.pathname + window.location.search;
            window.history.replaceState({}, "", clean);
          }
        }
      } catch {
        /* ignore */
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        window.localStorage.removeItem(TOKEN_KEY);
        return;
      }
      if (session?.access_token) {
        window.localStorage.setItem(TOKEN_KEY, session.access_token);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
