import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

// Carrier-required STOP keywords. Per the CTIA and Twilio docs every program
// MUST honor these (case-insensitive, whitespace-trimmed) regardless of any
// extra text the user types around them. We intentionally do an EXACT match
// on the trimmed body so "STOPPED RAINING" doesn't accidentally opt people
// out — Twilio's own opt-out engine on a Messaging Service uses the same
// strict-word interpretation.
const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

/**
 * Twilio inbound-SMS webhook. Wired at POST /sms/webhook.
 *
 *   - This route is intentionally NOT behind SupabaseAuthGuard. Twilio's
 *     edge has no Supabase JWT to hand us; authenticity is established via
 *     the X-Twilio-Signature HMAC header instead.
 *   - Excluded from the OriginCheck middleware via the SKIP_PATH_PREFIXES
 *     allowlist (see common/origin-check.middleware.ts).
 *   - We respond with empty TwiML so Twilio doesn't auto-reply to STOPs
 *     on our behalf (the Messaging Service handles the standard "You have
 *     successfully been unsubscribed" reply already).
 */
@ApiTags("Notifications")
@Controller("sms")
export class SmsWebhookController {
  private readonly logger = new Logger(SmsWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post("webhook")
  @HttpCode(200)
  @Header("Content-Type", "text/xml")
  async inbound(
    @Req() req: Request,
    @Headers("x-twilio-signature") signature: string | undefined,
    @Body() body: Record<string, string>
  ): Promise<string> {
    if (!this.verifySignature(req, signature, body)) {
      if (process.env.NODE_ENV === "production") {
        this.logger.warn(
          `Rejected SMS webhook: bad/missing X-Twilio-Signature (from=${body?.From})`
        );
        throw new ForbiddenException("Bad Twilio signature.");
      }
      // In dev/staging we accept-but-warn so local tunnelling (ngrok,
      // Twilio CLI) doesn't require futzing with the auth token.
      this.logger.warn(
        `Accepting SMS webhook with bad/missing signature (NODE_ENV=${process.env.NODE_ENV || "development"})`
      );
    }

    const from = (body?.From || "").trim();
    const message = (body?.Body || "").trim().toUpperCase();

    if (from && STOP_KEYWORDS.has(message)) {
      const result = await this.prisma.phoneConsent.updateMany({
        where: { phone: from, optedOutAt: null },
        data: { optedOutAt: new Date() }
      });
      this.logger.log(
        `STOP from ${from}: marked ${result.count} consent row(s) as opted-out.`
      );
    } else if (from) {
      // Non-STOP inbound. Log only — Twilio's MS handles HELP automatically
      // and we don't have a conversational surface for anything else yet.
      this.logger.debug(`Inbound SMS from ${from}: "${message.slice(0, 40)}"`);
    }

    return "<Response></Response>";
  }

  /**
   * Twilio request signing — see https://www.twilio.com/docs/usage/webhooks/webhooks-security
   *
   *   signature = HMAC-SHA1(authToken, fullUrl + sortedParams).base64
   *
   * `fullUrl` is the publicly-visible URL Twilio used to POST (including
   * scheme + host + path + query). Behind Render we trust X-Forwarded-Proto
   * + the Host header — Render's edge sets both. If TWILIO_AUTH_TOKEN is
   * unset we return false; the caller decides whether to reject (prod) or
   * warn (dev).
   */
  private verifySignature(
    req: Request,
    signature: string | undefined,
    params: Record<string, string>
  ): boolean {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token || !signature) return false;

    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    if (!host) return false;
    // req.originalUrl already includes query string when present.
    const url = `${proto}://${host}${req.originalUrl || req.url}`;

    const sorted = Object.keys(params || {})
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("");
    const expected = createHmac("sha1", token).update(url + sorted).digest("base64");
    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
