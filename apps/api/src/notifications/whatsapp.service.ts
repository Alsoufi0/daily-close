import { Injectable, Logger } from "@nestjs/common";

/**
 * WhatsApp Business Cloud API sender — used to ping the employee 15 min before
 * close-time and to ping the owner when a close is missed.
 *
 * Requires (Meta side, manual setup — cannot be automated by code):
 *   1. Meta Business account verified at business.facebook.com.
 *   2. A WhatsApp Business app created in Meta for Developers.
 *   3. A phone number registered + verified for the app.
 *   4. A permanent system-user access token.
 *   5. At least one approved message template (default name "missed_close",
 *      single body variable {{1}} for the store name).
 *
 * Then set:
 *   WHATSAPP_PHONE_NUMBER_ID=<numeric id from Meta>
 *   WHATSAPP_ACCESS_TOKEN=<system-user token>
 *   WHATSAPP_TEMPLATE_MISSED=missed_close  (defaults to "missed_close")
 *
 * When the env is missing, this service is a no-op — useful for dev/preview.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  isConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  async sendMissedCloseTemplate(toPhone: string, storeName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp not configured — would have messaged ${toPhone} about ${storeName}`);
      return false;
    }
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_ACCESS_TOKEN!;
    const template = process.env.WHATSAPP_TEMPLATE_MISSED || "missed_close";
    const clean = toPhone.replace(/[^\d]/g, "");

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: clean,
          type: "template",
          template: {
            name: template,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: storeName }]
              }
            ]
          }
        })
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`WhatsApp ${res.status} for ${clean}: ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.warn(`WhatsApp send failed for ${clean}: ${err?.message || err}`);
      return false;
    }
  }
}
