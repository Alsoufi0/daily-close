import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  private async send(
    to: string,
    subject: string,
    html: string
  ): Promise<{ sent: boolean; error?: string }> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "Daily Close <noreply@dailyclose.us>";
    if (!key) {
      this.logger.warn(`RESEND_API_KEY missing - would have emailed ${to}: ${subject}`);
      return { sent: false, error: "Email not configured" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(`Resend ${res.status} for ${to}: ${body.slice(0, 200)}`);
        return { sent: false, error: `Resend ${res.status}` };
      }
      return { sent: true };
    } catch (err: any) {
      this.logger.warn(`Resend send failed for ${to}: ${err?.message || err}`);
      return { sent: false, error: err?.message || "Network error" };
    }
  }

  async sendEmployeeWelcome(opts: {
    email: string;
    name: string;
    storeName: string;
    tempPassword: string;
  }): Promise<{ sent: boolean; error?: string }> {
    const appUrl = (process.env.APP_URL || "https://dailyclose.us").replace(/\/+$/, "");
    const subject = "Your Daily Close account is ready";
    const html = baseEmailShell(`
      <h1 style="margin:0 0 12px;font-size:20px;color:#11181c;">You're set up to close ${esc(opts.storeName)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f4b51;">Hi ${esc(opts.name)}, you've been added to <strong>Daily Close</strong>. Sign in with your email and the temporary password below, then choose your own password.</p>
      <p style="margin:0 0 6px;font-size:13px;color:#8a949a;">Temporary password</p>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;color:#11181c;background:#f1f5f3;border:1px solid #dde5e1;border-radius:9px;padding:12px 16px;letter-spacing:.5px;">${esc(opts.tempPassword)}</div>
      <p style="margin:22px 0;"><a href="${appUrl}/close" style="display:inline-block;background:#1f7a4d;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:9px;">Sign in to Daily Close</a></p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8a949a;">For your security, change this password after your first sign-in (Account &gt; Change password).</p>
    `);
    return this.send(opts.email, subject, html);
  }

  async sendContactMessage(opts: {
    name: string;
    email: string;
    phone?: string;
    storeCount?: string;
    message: string;
  }): Promise<{ sent: boolean; error?: string }> {
    const subject = `Daily Close contact: ${opts.name}`;
    const html = baseEmailShell(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#11181c;">New contact form message</h1>
      <p style="margin:0 0 10px;font-size:15px;color:#3f4b51;"><strong>Name:</strong> ${esc(opts.name)}</p>
      <p style="margin:0 0 10px;font-size:15px;color:#3f4b51;"><strong>Email:</strong> ${esc(opts.email)}</p>
      <p style="margin:0 0 10px;font-size:15px;color:#3f4b51;"><strong>Phone:</strong> ${esc(opts.phone || "Not provided")}</p>
      <p style="margin:0 0 18px;font-size:15px;color:#3f4b51;"><strong>Stores:</strong> ${esc(opts.storeCount || "Not provided")}</p>
      <div style="white-space:pre-wrap;font-size:15px;line-height:1.7;color:#11181c;background:#f7faf8;border:1px solid #dde5e1;border-radius:10px;padding:16px;">${esc(opts.message)}</div>
    `);
    return this.send("dailyclose@yahoo.com", subject, html);
  }
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function baseEmailShell(content: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e6e9e8;border-radius:14px;overflow:hidden;"><tr><td style="background:#1f7a4d;padding:20px 28px;"><span style="color:#ffffff;font-size:20px;font-weight:800;">Daily Close</span></td></tr><tr><td style="padding:28px;">${content}</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #eef1f0;"><span style="font-size:12px;color:#aab2b7;">Daily Close - dailyclose.us</span></td></tr></table></td></tr></table>`;
}
