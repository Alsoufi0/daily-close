import { ForbiddenException, Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

/**
 * Defense-in-depth CSRF check (audit fix #2).
 *
 * The primary CSRF defense in this app is structural: the API authenticates
 * via `Authorization: Bearer …` headers, which browsers never auto-attach
 * cross-origin. A malicious site can't forge an authenticated request just
 * by getting the user to load a page.
 *
 * BUT: now that the web client uses cookie-backed Supabase sessions, the
 * boundary is fuzzier — if someone later wires up a cookie-auth path, the
 * Bearer-header defense evaporates. This middleware adds a belt to the
 * suspenders by rejecting state-changing requests whose Origin / Referer
 * doesn't match the ALLOWED_ORIGINS allowlist.
 *
 * Skipped for:
 *   - safe methods (GET, HEAD, OPTIONS)
 *   - any request with NO Origin and NO Referer (server-to-server, cron,
 *     curl, healthchecks) — those carry their own auth (CRON_SECRET,
 *     SETUP_ADMIN_KEY, Stripe signature) so blocking them here would
 *     break cron + admin tooling
 *   - paths under /subscriptions/webhook (Stripe webhook origin is meta)
 *     and /notifications/* cron POSTs (already gated by CRON_SECRET)
 *
 * Allowlist sources:
 *   - ALLOWED_ORIGINS env (comma-separated explicit origins; "*" means allow all — dev only)
 *   - any *.vercel.app preview origin
 *   - localhost / 127.0.0.1 for dev
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly logger = new Logger(OriginCheckMiddleware.name);

  private static readonly SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
  private static readonly SKIP_PATH_PREFIXES = [
    "/subscriptions/webhook",
    "/notifications/check-missed-close",
    "/notifications/weekly-summary",
    "/notifications/monthly-summary",
    // Twilio inbound SMS webhook. Twilio has no browser origin; authenticity
    // is verified via X-Twilio-Signature inside SmsWebhookController.
    "/sms/webhook"
  ];

  private allowedOriginsCache: string[] | null = null;
  private allowedOriginsCachedFrom: string | undefined;

  use(req: Request, _res: Response, next: NextFunction) {
    if (OriginCheckMiddleware.SAFE_METHODS.has(req.method)) return next();
    if (this.shouldSkipPath(req.path)) return next();

    const origin = (req.headers.origin as string | undefined) || this.refererOrigin(req);
    if (!origin) {
      // Server-to-server, curl, healthcheck — no browser-supplied origin.
      // Those carry their own auth (CRON_SECRET / setup-key / Stripe sig).
      return next();
    }

    if (this.isAllowed(origin)) return next();

    this.logger.warn(`Blocked cross-origin ${req.method} ${req.path} from ${origin}`);
    throw new ForbiddenException("Origin not allowed.");
  }

  private shouldSkipPath(path: string): boolean {
    return OriginCheckMiddleware.SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  private refererOrigin(req: Request): string | undefined {
    const referer = req.headers.referer as string | undefined;
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }

  private allowedOrigins(): string[] {
    const raw = process.env.ALLOWED_ORIGINS || "";
    if (raw !== this.allowedOriginsCachedFrom) {
      this.allowedOriginsCache = raw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      this.allowedOriginsCachedFrom = raw;
    }
    return this.allowedOriginsCache!;
  }

  private isAllowed(origin: string): boolean {
    const allowed = this.allowedOrigins();
    if (allowed.includes("*")) return true;
    if (allowed.includes(origin)) return true;
    try {
      const host = new URL(origin).hostname;
      if (host === "localhost" || host === "127.0.0.1") return true;
      if (host.endsWith(".vercel.app")) return true;
      // Production custom domain — see the matching note in main.ts originChecker.
      if (host === "dailyclose.us" || host.endsWith(".dailyclose.us")) return true;
    } catch {
      /* fall through */
    }
    return false;
  }
}
