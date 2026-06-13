import { NextRequest, NextResponse } from "next/server";

// QR/short-link landing: a prospect scans a partner's code and arrives at
// /r/{code}. We (1) record the visit for the funnel, (2) drop a FIRST-TOUCH
// referral cookie that survives until signup, then (3) send them to /signup.
//
// First-touch: if a ref cookie is already set we never overwrite it, so the
// very first partner whose link a prospect used keeps the credit.

const REF_COOKIE = "dc_ref";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = (params.code || "").trim();
  const existing = request.cookies.get(REF_COOKIE)?.value;
  const effectiveRef = existing || code;

  // Build the redirect from the Host the client actually connected to, not
  // request.url — behind a dev bind host (0.0.0.0) or a proxy, request.url's
  // host can differ from what the visitor's browser can resolve.
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const base = host ? `${proto}://${host}` : request.url;
  const signupUrl = new URL("/signup", base);
  if (effectiveRef) signupUrl.searchParams.set("ref", effectiveRef);
  const response = NextResponse.redirect(signupUrl);

  if (!code) return response;

  // Record the visit + validate the code (best-effort; never block the landing
  // on analytics). The API increments scan_count for an active partner.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}/referrals/r/${encodeURIComponent(code)}`, { cache: "no-store" });
    } catch {
      // ignore
    }
  }

  // First-touch: only set the cookie when none exists yet.
  if (!existing) {
    response.cookies.set(REF_COOKIE, code, {
      path: "/",
      maxAge: MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false
    });
  }

  return response;
}
