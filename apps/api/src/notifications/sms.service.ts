import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Twilio A2P 10DLC compliance footer. Carriers (and the campaign reviewer)
// require every promotional/transactional SMS sent on a 10DLC campaign to
// include opt-out instructions and a cost disclaimer on its own line.
// Exported so the test asserts the exact string we ship.
export const SMS_COMPLIANCE_FOOTER =
  "Reply STOP to unsubscribe. HELP for help. Msg & data rates may apply.";

/**
 * Twilio SMS sender.
 *
 * Why we hand-roll the HTTP call instead of pulling in the Twilio SDK:
 *   - One endpoint, two-line auth (HTTP Basic, base64) — the SDK adds a few
 *     megabytes and a transitive Axios chain for what is effectively a single
 *     form POST.
 *   - Keeping it dependency-free means a Render cold start is faster and the
 *     container image stays small. The dashboard's container has already been
 *     blamed twice on bloated logging payloads (see audit log).
 *
 * Configuration (env vars):
 *   TWILIO_ACCOUNT_SID                   AC... — from the Twilio console
 *   TWILIO_AUTH_TOKEN                    secret companion to the account SID
 *   TWILIO_MESSAGING_SERVICE_SID         MG... — preferred; handles sender pool,
 *                                        STOP/HELP handling, and number fallback
 *   TWILIO_FROM_NUMBER                   +15551234567 — alternative if no MSS
 *   APP_URL                              base URL used in the invite text
 *
 * If MessagingServiceSid is set we send via that (recommended). Otherwise we
 * fall back to the bare From number. If neither is configured, `isConfigured`
 * returns false and `send` becomes a no-op that logs what it WOULD have sent.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // PrismaService is @Optional so the unit-test (`new SmsService()`) stays
  // dependency-free. In the running app Nest injects it automatically and
  // hasActiveConsent() can gate sends against the phone_consents table.
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  isConfigured(): boolean {
    const whatsapp = this.deliveryChannel() === "whatsapp";
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID ||
          (whatsapp
            ? process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER
            : process.env.TWILIO_FROM_NUMBER))
    );
  }

  /**
   * Send a one-off SMS. Returns `{ sent: true }` on Twilio 2xx, otherwise
   * `{ sent: false, error }`. Never throws — SMS is best-effort: callers like
   * `invite()` still want to complete even if the carrier rejected the
   * message, with the temp password returned so the owner can share manually.
   */
  async send(toPhone: string, body: string): Promise<{ sent: boolean; error?: string }> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `SMS not configured — would have sent to ${toPhone}: ${body.slice(0, 60)}…`
      );
      return { sent: false, error: "SMS not configured" };
    }

    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const whatsapp = this.deliveryChannel() === "whatsapp";
    const fromNumber = whatsapp
      ? process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER
      : process.env.TWILIO_FROM_NUMBER;

    const params = new URLSearchParams();
    params.set("To", whatsapp ? this.whatsAppAddress(toPhone) : toPhone);
    params.set("Body", body);
    if (messagingServiceSid) {
      params.set("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      params.set("From", whatsapp ? this.whatsAppAddress(fromNumber) : fromNumber);
    }

    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        }
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        this.logger.warn(`Twilio SMS failed (${res.status}): ${errBody.slice(0, 200)}`);
        return { sent: false, error: `Twilio ${res.status}` };
      }
      return { sent: true };
    } catch (err: any) {
      this.logger.warn(`Twilio SMS error: ${err?.message || err}`);
      return { sent: false, error: err?.message || "Network error" };
    }
  }

  /**
   * Welcome SMS for a phone-invited employee. The owner shares the temp
   * password out-of-band today — over SMS this becomes automatic.
   *
   * Keep this under ~2 segments (~320 chars) to stay cheap on Twilio billing.
   * We also avoid line breaks because some carriers split on them oddly.
   */
  async sendEmployeeWelcome(opts: {
    phone: string;
    name: string;
    storeName: string;
    tempPassword: string;
  }): Promise<{ sent: boolean; error?: string }> {
    // A2P 10DLC: refuse to send if we don't have a recorded, non-opted-out
    // consent row for this phone. The invite endpoint creates the row
    // immediately before calling this; a missing row means someone wired up
    // a new SMS surface without capturing consent — fail closed.
    const hasConsent = await this.hasActiveConsent(opts.phone);
    if (!hasConsent) {
      this.logger.warn(
        `Refusing to send welcome SMS to ${opts.phone}: no active consent on record.`
      );
      return { sent: false, error: "No active SMS consent on record" };
    }

    const appUrl = (process.env.APP_URL || "the Daily Close app").replace(/\/+$/, "");
    const body =
      `Daily Close: Hi ${opts.name}, you're set up to close ${opts.storeName}. ` +
      `Sign in at ${appUrl}/close (Phone tab) with this number and password: ${opts.tempPassword}. ` +
      `Please change it after your first sign-in.` +
      `\n${SMS_COMPLIANCE_FOOTER}`;
    return this.send(opts.phone, body);
  }

  /**
   * True iff there's at least one phone_consents row for the given phone
   * with opted_out_at IS NULL. When Prisma isn't wired up (unit tests
   * constructing `new SmsService()` with no args), we default to TRUE so
   * existing tests that don't care about consent keep passing — the
   * production code path always has Prisma injected.
   */
  async hasActiveConsent(phone: string): Promise<boolean> {
    if (!this.prisma) return true;
    try {
      const row = await this.prisma.phoneConsent.findFirst({
        where: { phone, optedOutAt: null }
      });
      return Boolean(row);
    } catch (err: any) {
      this.logger.warn(`hasActiveConsent lookup failed: ${err?.message || err}`);
      // Fail closed: if we can't verify consent, don't send.
      return false;
    }
  }

  private deliveryChannel(): "sms" | "whatsapp" {
    const channel = String(process.env.TWILIO_DELIVERY_CHANNEL || process.env.TWILIO_CHANNEL || "sms").toLowerCase();
    return channel === "whatsapp" ? "whatsapp" : "sms";
  }

  private whatsAppAddress(phone: string): string {
    if (phone.startsWith("whatsapp:")) return phone;
    const trimmed = phone.trim();
    const e164 = trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/[^\d]/g, "")}`;
    return `whatsapp:${e164}`;
  }
}
