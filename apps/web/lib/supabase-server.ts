import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Server-side Supabase client for use inside Next.js middleware. Wraps
 * `cookies()` from a NextRequest so the helper can issue refreshed session
 * cookies on the response. Returns the response unchanged if Supabase isn't
 * configured — the caller decides what to do.
 */
export function createMiddlewareSupabase(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          const opts: CookieOptions = {
            ...options,
            httpOnly: options?.httpOnly ?? true,
            secure: options?.secure ?? process.env.NODE_ENV === "production",
            sameSite: options?.sameSite ?? "lax"
          };
          res.cookies.set({ name, value, ...opts });
        });
      }
    }
  });
}
