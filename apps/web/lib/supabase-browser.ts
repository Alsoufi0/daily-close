"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Backed by cookies (not localStorage) via
 * `@supabase/ssr` so the session is readable by the Next.js middleware on
 * every request and a logout cleanly purges the auth state on both ends.
 *
 * The cookies set by this client cooperate with apps/web/middleware.ts which
 * issues refreshed cookies on the response with `httpOnly`, `secure`, and
 * `sameSite: 'lax'` flags. The browser client itself uses document.cookie
 * for reads (browser security forbids reading httpOnly cookies in JS), but
 * the long-lived refresh token lives in the middleware-issued httpOnly
 * cookie — that's what closes the audit-flagged "long-lived JWT in
 * localStorage" XSS exposure.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
