import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

export interface ScanAlertInput {
  partnerName: string;
  refCode: string;
  scanCount: number;
}

export interface LargeRewardAlertInput {
  amountText: string;
  storeCount: number;
  status: string;
}

/**
 * Sends a notification when a partner's referral QR/link is scanned. Best-effort
 * and self-contained — it must NEVER throw into the scan request path.
 *
 * Delivery, in priority order:
 *   1. SMTP (SMTP_HOST set) — used locally to drop the mail into Mailpit so it
 *      can be viewed without any cloud service.
 *   2. Resend (RESEND_API_KEY set) — production, lands in the real inbox.
 *   3. Log only — dev fallback so the trigger is still observable.
 *
 * Recipient: SCAN_ALERT_TO (falls back to RESEND_FROM / a placeholder). Set it
 * empty to disable alerts entirely.
 */
@Injectable()
export class ScanAlertService {
  private readonly logger = new Logger(ScanAlertService.name);

  async notifyScan(input: ScanAlertInput): Promise<void> {
    const subject = `QR scanned — ${input.partnerName} (${input.refCode})`;
    const text =
      `A referral link was just opened.\n\n` +
      `Partner: ${input.partnerName}\n` +
      `Code: ${input.refCode}\n` +
      `Total scans now: ${input.scanCount}\n` +
      `Time: ${new Date().toISOString()}\n`;
    await this.deliver(subject, text);
  }

  /**
   * Heads-up when a single owner→owner referral credit is large (recommendation
   * #3: no hard cap, just a notification). Best-effort, never throws.
   */
  async notifyLargeReward(input: LargeRewardAlertInput): Promise<void> {
    const subject = `Large referral credit — ${input.amountText} (${input.storeCount} stores)`;
    const text =
      `A large owner→owner referral credit was just earned.\n\n` +
      `Amount: ${input.amountText}\n` +
      `Store-months: ${input.storeCount}\n` +
      `Status: ${input.status}\n` +
      `Time: ${new Date().toISOString()}\n`;
    await this.deliver(subject, text);
  }

  // Shared best-effort delivery: SMTP (local/Mailpit) → Resend (prod) → log.
  // Never throws into the caller's request/webhook path.
  private async deliver(subject: string, text: string): Promise<void> {
    try {
      // Default to the platform ops inbox so prod alerts work without extra
      // env wiring. Override with SCAN_ALERT_TO, or set it to "" to disable.
      const to = process.env.SCAN_ALERT_TO ?? "dailyclose@yahoo.com";
      if (!to) return; // explicitly disabled
      const from = process.env.SMTP_FROM || process.env.RESEND_FROM || "Daily Close <alerts@dailyclose.us>";

      if (process.env.SMTP_HOST) {
        await this.sendSmtp({ to, from, subject, text });
      } else if (process.env.RESEND_API_KEY) {
        await this.sendResend({ to, from, subject, text });
      } else {
        this.logger.log(`[alert:DRY-RUN] to=${to} :: ${subject}`);
      }
    } catch (err) {
      this.logger.warn(`Alert failed (ignored): ${(err as Error)?.message || err}`);
    }
  }

  private async sendSmtp(msg: { to: string; from: string; subject: string; text: string }) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false,
      ignoreTLS: true,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined
    });
    await transport.sendMail(msg);
    this.logger.log(`Scan alert emailed (SMTP) to ${msg.to}: ${msg.subject}`);
  }

  private async sendResend(msg: { to: string; from: string; subject: string; text: string }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: msg.from, to: msg.to, subject: msg.subject, text: msg.text })
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    this.logger.log(`Scan alert emailed (Resend) to ${msg.to}: ${msg.subject}`);
  }
}
