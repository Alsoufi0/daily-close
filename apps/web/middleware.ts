import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabase } from "./lib/supabase-server";

/**
 * Refresh the Supabase session on every request (audit fix #2).
 *
 * The middleware calls `supabase.auth.getUser()` which:
 *   - validates the access-token cookie
 *   - silently rotates it using the httpOnly refresh-token cookie if needed
 *   - sets new cookies on the response via the setAll callback in
 *     supabase-server.ts (cookies issued here are httpOnly, secure in prod,
 *     sameSite=lax — closing the audit-flagged "long-lived JWT in
 *     localStorage" XSS exposure)
 *
 * No auth enforcement here — RequireAuth / SubscriptionGuard / the API still
 * gatekeep. This middleware only keeps the session fresh.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareSupabase(req, res);
  if (supabase) {
    // Calling getUser() refreshes the cookies via the setAll callback.
    // Wrap in try/catch so a Supabase outage never breaks the page request.
    try {
      await supabase.auth.getUser();
    } catch {
      // ignore — page render still proceeds
    }
  }
  return res;
}

export const config = {
  // Skip static assets + Next internals — we only need session refresh on
  // pages and API-bound calls.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"
  ]
};
