import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";

/**
 * Weekly owner summary email — the habit-hook that keeps owners signed in.
 *
 * Trigger: a cron (Render cron job or Vercel scheduled function) hits
 * POST /notifications/weekly-summary every Monday morning. Send via Resend
 * when RESEND_API_KEY is set; otherwise log-and-skip (so dev / preview
 * deploys don't try to mail anything).
 *
 * Env:
 *   RESEND_API_KEY=<key>
 *   RESEND_FROM="Daily Close <reports@dailyclose.app>"  (must be a verified sender)
 */
@Injectable()
export class WeeklySummaryService {
  private readonly logger = new Logger(WeeklySummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService
  ) {}

  async sendForAllOwners(now = new Date()): Promise<{ sent: number; skipped: number }> {
    return this.sendSummaryForAllOwners("weekly", 7, now);
  }

  async sendMonthlyForAllOwners(now = new Date()): Promise<{ sent: number; skipped: number }> {
    return this.sendSummaryForAllOwners("monthly", 30, now);
  }

  private async sendSummaryForAllOwners(
    period: "weekly" | "monthly",
    days: number,
    now = new Date()
  ): Promise<{ sent: number; skipped: number }> {
    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const owners = await this.prisma.owner.findMany({
      include: {
        user: true,
        stores: {
          where: { deletedAt: null },
          include: { dailyCloses: { where: { date: { gte: start, lte: end } } } }
        }
      }
    });

    let sent = 0;
    let skipped = 0;
    for (const owner of owners) {
      const email = owner.user?.email;
      if (!email) {
        skipped++;
        continue;
      }
      const totals = owner.stores.reduce(
        (acc, store) => {
          for (const c of store.dailyCloses) {
            acc.sales += Number(c.totalSales);
            acc.cash += Number(c.cashSales);
            acc.diff += Number(c.difference);
            acc.closes += 1;
          }
          return acc;
        },
        { sales: 0, cash: 0, diff: 0, closes: 0 }
      );
      const missed = owner.stores.length * days - totals.closes; // upper bound; good enough for the headline

      const subject = `Daily Close · last ${days} days: ${money(totals.sales)} sales, ${totals.closes} closes`;
      const html = renderHtml({
        ownerName: owner.user?.name || "there",
        sales: totals.sales,
        cash: totals.cash,
        diff: totals.diff,
        closes: totals.closes,
        missed: Math.max(0, missed),
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10)
      });

      const emailOk = await this.send(email, subject, html);
      const whatsappOk = await this.sendWhatsAppSummary(owner as any, {
        period,
        ownerName: owner.user?.name || "there",
        sales: totals.sales,
        diff: totals.diff,
        closes: totals.closes,
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10)
      });
      const ok = emailOk || whatsappOk;
      if (ok) sent++;
      else skipped++;
    }
    return { sent, skipped };
  }

  private async sendWhatsAppSummary(
    owner: any,
    summary: { period: "weekly" | "monthly"; ownerName: string; sales: number; diff: number; closes: number; from: string; to: string }
  ): Promise<boolean> {
    if (!owner.whatsappReportsEnabled || !owner.whatsappPhone) return false;
    return this.whatsapp.sendSummaryTemplate({
      toPhone: owner.whatsappPhone,
      period: summary.period,
      ownerName: summary.ownerName,
      sales: money(summary.sales),
      closes: String(summary.closes),
      cashDifference: money(summary.diff),
      from: summary.from,
      to: summary.to
    });
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "Daily Close <reports@dailyclose.app>";
    if (!key) {
      this.logger.warn(`RESEND_API_KEY missing — would have emailed ${to}: ${subject}`);
      return false;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ from, to, subject, html })
      });
      if (!res.ok) {
        this.logger.warn(`Resend ${res.status} for ${to}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.warn(`Resend failed for ${to}: ${err?.message || err}`);
      return false;
    }
  }
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function renderHtml(p: {
  ownerName: string;
  sales: number;
  cash: number;
  diff: number;
  closes: number;
  missed: number;
  from: string;
  to: string;
}): string {
  const diffColor = p.diff < 0 ? "#b91c1c" : "#1f7a4d";
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;background:#f8faf9;margin:0;padding:24px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px">
    <tr><td>
      <p style="margin:0;color:#1f7a4d;font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:12px">Daily Close · Weekly summary</p>
      <h1 style="margin:6px 0 2px;font-size:22px;font-weight:900">Hi ${escape(p.ownerName)},</h1>
      <p style="margin:0;color:#555;font-weight:600">${p.from} → ${p.to}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0">
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:10px">
            <p style="margin:0;color:#888;font-size:12px;font-weight:800;text-transform:uppercase">Total sales</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:900">${money(p.sales)}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width:50%;padding:8px;border:1px solid #e5e7eb;border-radius:10px">
            <p style="margin:0;color:#888;font-size:11px;font-weight:800;text-transform:uppercase">Closes submitted</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:900">${p.closes}</p>
          </td>
          <td style="width:8px"></td>
          <td style="width:50%;padding:8px;border:1px solid #e5e7eb;border-radius:10px">
            <p style="margin:0;color:#888;font-size:11px;font-weight:800;text-transform:uppercase">Cash difference</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:${diffColor}">${money(p.diff)}</p>
          </td>
        </tr>
      </table>
      ${p.missed > 0 ? `<p style="margin:18px 0 0;color:#b45309;font-weight:700">${p.missed} missed close${p.missed === 1 ? "" : "s"} last week.</p>` : ""}
      <p style="margin:22px 0 0">
        <a href="https://daily-close-mvp.vercel.app/owner" style="display:inline-block;background:#1f7a4d;color:#fff;text-decoration:none;font-weight:900;padding:12px 16px;border-radius:10px">Open dashboard</a>
      </p>
      <p style="margin:20px 0 0;color:#888;font-size:12px">You're getting this because you own a Daily Close account. Reply to this email to reach support.</p>
    </td></tr>
  </table>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
