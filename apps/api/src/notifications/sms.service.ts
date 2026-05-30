import { Injectable, Logger } from "@nestjs/common";

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

  isConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER)
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
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    const params = new URLSearchParams();
    params.set("To", toPhone);
    params.set("Body", body);
    if (messagingServiceSid) {
      params.set("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      params.set("From", fromNumber);
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
    const appUrl = (process.env.APP_URL || "the Daily Close app").replace(/\/+$/, "");
    const body =
      `Daily Close: Hi ${opts.name}, you're set up to close ${opts.storeName}. ` +
      `Sign in at ${appUrl}/close (Phone tab) with this number and password: ${opts.tempPassword}. ` +
      `Please change it after your first sign-in.`;
    return this.send(opts.phone, body);
  }
}
