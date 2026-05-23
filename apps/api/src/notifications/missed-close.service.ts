import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class MissedCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsAppService
  ) {}

  async checkStores(date = new Date()) {
    // Wide UTC window: a store's "today" can sit ±24h from the server clock.
    const wideStart = new Date(date.getTime() - 36 * 3600_000);
    const wideEnd = new Date(date.getTime() + 12 * 3600_000);
    const stores = await this.prisma.store.findMany({
      include: {
        dailyCloses: { where: { date: { gte: wideStart, lte: wideEnd } } }
      }
    });

    // Only flag stores whose close_time has passed in their local timezone
    const minutesAt = (t: string) => {
      const [hh, mm] = (t || "23:30").split(":").map((x) => Number(x) || 0);
      return hh * 60 + mm;
    };

    const missing = stores.filter((store: any) => {
      const tz = store.timezone || "America/New_York";
      const { start, end } = DashboardService.storeLocalDayRange(tz, date);
      const hasCloseToday = store.dailyCloses.some((c: any) => c.date >= start && c.date <= end);
      if (hasCloseToday) return false;
      const nowMin = DashboardService.minutesNowInTimezone(tz, date);
      return nowMin >= minutesAt(store.closeTime || "23:30");
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

        // Best-effort WhatsApp ping to the owner. No-op when WhatsApp env is unset.
        const ownerPhone = (owner.user as any)?.phone || (owner as any).phone;
        if (ownerPhone && this.whatsapp.isConfigured()) {
          await this.whatsapp.sendMissedCloseTemplate(ownerPhone, store.storeName);
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
