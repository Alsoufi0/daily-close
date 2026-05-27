"use client";

import { useEffect } from "react";
import { createBrowserSupabase } from "../lib/supabase-browser";

/**
 * Mounted globally in the root layout. Two jobs after the audit fix #2
 * cookie migration:
 *
 *   1. Picks up the access_token from the URL hash after a Supabase email
 *      confirmation / magic-link redirect (Supabase sends ?#access_token=…
 *      on the redirect URL; the JS client's detectSessionInUrl reads it
 *      the first time we call getSession()). Without this, a freshly
 *      confirmed user lands on /setup with no session and bounces to /.
 *
 *   2. Cleans the URL hash so the token isn't visible in the address bar
 *      or copy-pasted into chat / bookmarks.
 *
 * What this NO LONGER does (vs. pre-#2):
 *   - No more writing access_token to localStorage. Sessions live in
 *     cookies now (managed by @supabase/ssr + the Next.js middleware in
 *     apps/web/middleware.ts). The middleware silently refreshes them
 *     on every request, so the in-tab onAuthStateChange listener that
 *     used to mirror tokens into localStorage is gone.
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
        // Strip #access_token=… from the URL after Supabase reads it.
        if (data.session?.access_token && window.location.hash.includes("access_token")) {
          const clean = window.location.pathname + window.location.search;
          window.history.replaceState({}, "", clean);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
