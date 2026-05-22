import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class MissedCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async checkStores(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const stores = await this.prisma.store.findMany({
      include: {
        dailyCloses: { where: { date: { gte: start, lte: end } }, take: 1 }
      }
    });

    // Only flag stores whose close_time has passed in their local timezone
    const minutesNow = (tz: string) => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false
        }).formatToParts(date);
        const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
        const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
        return h * 60 + m;
      } catch { return 24 * 60; }
    };
    const minutesAt = (t: string) => {
      const [hh, mm] = (t || "23:30").split(":").map((x) => Number(x) || 0);
      return hh * 60 + mm;
    };

    const missing = stores.filter(
      (store: any) =>
        store.dailyCloses.length === 0 &&
        minutesNow(store.timezone || "America/New_York") >= minutesAt(store.closeTime || "23:30")
    );
    await Promise.all(
      missing.map(async (store) => {
        await this.notifications.sendMissingCloseAlert(store.storeName);
        const owner = await this.prisma.owner.findUnique({ where: { id: store.ownerId } });
        if (!owner) return;

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
