import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { SmsService } from "./sms.service";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class MissedCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService
  ) {}

  async checkStores(date = new Date()) {
    // Wide UTC window: a store's "today" can sit ±24h from the server clock.
    const wideStart = new Date(date.getTime() - 36 * 3600_000);
    const wideEnd = new Date(date.getTime() + 12 * 3600_000);
    const stores = await this.prisma.store.findMany({
      where: { deletedAt: null },
      include: {
        dailyCloses: { where: { date: { gte: wideStart, lte: wideEnd } } }
      }
    });

    // Only flag stores whose close_time has passed in their local timezone.
    // Use effectiveCloseMin so midnight-closing stores aren't flagged all day.
    const missing = stores.filter((store: any) => {
      const tz = store.timezone || "America/New_York";
      // Use the SAME business-day range the dashboard uses for `closedToday`
      // (storeBusinessDayRange, which is close-time aware) so the cron and the
      // dashboard never disagree about whether a store has closed "today".
      // Previously this used storeLocalDayRange (plain calendar day), which
      // diverged from the dashboard around the close-time boundary and produced
      // false "not closed yet" alerts.
      const { start, end } = DashboardService.storeBusinessDayRange(tz, store.closeTime || "23:30", date);
      const hasCloseToday = store.dailyCloses.some((c: any) => c.date >= start && c.date <= end);
      if (hasCloseToday) return false;
      return DashboardService.isPastCloseTime(tz, store.closeTime || "23:30", date);
    });
    const start = wideStart;
    const end = wideEnd;
    await Promise.all(
      missing.map(async (store) => {
        await this.notifications.sendMissingCloseAlert(store.storeName);
        const owner = await this.prisma.owner.findUnique({
          where: { id: store.ownerId },
          include: { user: true }
        });
        if (!owner) return;

        // Best-effort WhatsApp ping to the owner. Prefer Meta templates when
        // configured; otherwise use Twilio WhatsApp/SMS through SmsService.
        const prefs = await this.notifications.getOwnerWhatsAppPreferences(owner.id);
        if (prefs.alertsEnabled && prefs.phone) {
          let sent = false;
          if (this.whatsapp.isConfigured()) {
            sent = await this.whatsapp.sendMissedCloseTemplate(prefs.phone, store.storeName);
          }
          if (!sent) {
            await this.sms.send(
              prefs.phone,
              `Daily Close: ${store.storeName} has not completed closing yet.`
            );
          }
        }

        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: owner.userId,
            storeId: store.id,
            message: `${store.storeName} has not completed closing yet.`,
            createdAt: { gte: start, lte: end }
          }
        });

        if (!existing) {
          await this.prisma.notification.create({
            data: {
              userId: owner.userId,
              storeId: store.id,
              type: "EMAIL",
              message: `${store.storeName} has not completed closing yet.`,
              status: "PENDING"
            }
          });
        }
      })
    );

    return missing.map((store) => ({
      storeId: store.id,
      storeName: store.storeName,
      message: `${store.storeName} has not completed closing.`
    }));
  }
}
