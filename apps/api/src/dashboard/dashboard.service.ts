import { Injectable } from "@nestjs/common";
import type { OwnerDashboardSummary } from "@shared/types";
import { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns the current local wall-clock minutes-since-midnight in the given IANA timezone.
  static minutesNowInTimezone(timezone: string, now = new Date()): number {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(now);
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
      return h * 60 + m;
    } catch {
      // Bad timezone string - fall back to UTC.
      return now.getUTCHours() * 60 + now.getUTCMinutes();
    }
  }

  static parseCloseTime(closeTime: string): number {
    const [hh, mm] = (closeTime || "23:30").split(":").map((x) => Number(x) || 0);
    return hh * 60 + mm;
  }

  /**
   * Close times in the early morning (00:00 – 05:59) are conceptually the
   * END of the previous business day — a store that closes at midnight is
   * "open all day, close due at midnight", not "close was due at 00:00 this
   * morning so we've been overdue all day". Shift those into the 24:00–29:59
   * range so a nowMin in mid-afternoon (e.g. 14:00 = 840) is never >= the
   * effective close minute. Times >= 06:00 are taken at face value.
   */
  static effectiveCloseMin(closeTime: string): number {
    const raw = DashboardService.parseCloseTime(closeTime);
    return raw < 6 * 60 ? raw + 24 * 60 : raw;
  }

  static isPastCloseTime(timezone: string, closeTime: string, now = new Date()): boolean {
    const rawCloseMin = DashboardService.parseCloseTime(closeTime);
    const nowMin = DashboardService.minutesNowInTimezone(timezone, now);

    return nowMin >= rawCloseMin;
  }

  // Returns the UTC instants spanning a store's *local* calendar day for `now`.
  // Without this, dashboard queries use the server's UTC day and miss closes
  // submitted late-evening in earlier timezones (e.g. a 23:00 PT close is at
  // 06:00 UTC the next day, so a Render server in UTC would query the wrong
  // day and falsely report the store as not-yet-closed).
  static storeLocalDayRange(timezone: string, now = new Date()): { start: Date; end: Date } {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(now);
      const y = parts.find((p) => p.type === "year")!.value;
      const m = parts.find((p) => p.type === "month")!.value;
      const d = parts.find((p) => p.type === "day")!.value;
      const offsetMin = DashboardService.timezoneOffsetMinutes(timezone, now);
      // The local-midnight of YYYY-MM-DD in `timezone` expressed as UTC:
      const utcMidnight = Date.UTC(Number(y), Number(m) - 1, Number(d)) - offsetMin * 60 * 1000;
      return { start: new Date(utcMidnight), end: new Date(utcMidnight + 86_400_000 - 1) };
    } catch {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
  }

  static storeCloseWindowRange(timezone: string, closeTime: string, now = new Date()): { start: Date; end: Date } {
    const closeMin = DashboardService.parseCloseTime(closeTime);
    const nowMin = DashboardService.minutesNowInTimezone(timezone, now);
    const parts = DashboardService.localDateParts(timezone, now);
    const startDayOffset = nowMin >= closeMin ? 0 : -1;
    const start = DashboardService.localDateTimeToUtc(timezone, parts, closeMin, startDayOffset);
    return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
  }

  // Minutes the given zone is ahead of UTC (positive east of UTC). Computed
  // from Intl rather than a hardcoded table so DST is correct year-round.
  static timezoneOffsetMinutes(timezone: string, now = new Date()): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const parts = dtf.formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUTC - now.getTime()) / 60000);
  }

  private static localDateParts(timezone: string, now: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    return {
      year: Number(parts.find((p) => p.type === "year")!.value),
      month: Number(parts.find((p) => p.type === "month")!.value),
      day: Number(parts.find((p) => p.type === "day")!.value)
    };
  }

  private static localDateTimeToUtc(
    timezone: string,
    parts: { year: number; month: number; day: number },
    minutes: number,
    dayOffset = 0
  ): Date {
    const localMiddayUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 12, 0, 0));
    const offsetMin = DashboardService.timezoneOffsetMinutes(timezone, localMiddayUtc);
    return new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 0, minutes, 0, 0) - offsetMin * 60 * 1000
    );
  }

  async getOwnerToday(ownerId: string, date = new Date()): Promise<OwnerDashboardSummary["stores"]> {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      include: {
        dailyCloses: {
          // Wide UTC window covers any timezone's "today"; we filter
          // per-store below using the store's local-day range.
          where: { date: { gte: new Date(date.getTime() - 36 * 3600_000), lte: new Date(date.getTime() + 12 * 3600_000) } },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    return stores.map((store) => {
      const tz = (store as any).timezone || "America/New_York";
      const closeTime = (store as any).closeTime || "23:30";
      const { start, end } = DashboardService.storeCloseWindowRange(tz, closeTime, date);
      const close = store.dailyCloses.find((c: any) => c.date >= start && c.date <= end);
      return {
        id: store.id,
        storeName: store.storeName,
        closedToday: Boolean(close),
        totalSales: close ? Number(close.totalSales) : 0,
        cashSales: close ? Number(close.cashSales) : 0,
        cardSales: close ? Number(close.cardSales) : 0,
        difference: close ? Number(close.difference) : 0,
        timezone: tz,
        closeTime,
        pastCloseTime: DashboardService.isPastCloseTime(tz, closeTime, date)
      };
    });
  }

  async getHistory(user: RequestUser, days = 7) {
    if (!user.ownerId) return [];
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const closes = await this.prisma.dailyClose.findMany({
      where: {
        store: { ownerId: user.ownerId },
        date: { gte: start, lte: end }
      },
      include: { store: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    return closes.map((c: any) => ({
      id: c.id,
      date: c.date.toISOString().slice(0, 10),
      storeId: c.storeId,
      storeName: c.store.storeName,
      totalSales: Number(c.totalSales),
      cashSales: Number(c.cashSales),
      cardSales: Number(c.cardSales),
      difference: Number(c.difference),
      status: c.status
    }));
  }

  async getMyToday(user: RequestUser, date = new Date()): Promise<OwnerDashboardSummary> {
    const ownerId = user.ownerId;
    if (!ownerId) {
      return {
        date: date.toISOString().slice(0, 10),
        storesClosed: 0,
        totalStores: 0,
        totalSales: 0,
        missingCash: 0,
        needsAttention: 0,
        stores: [],
        alerts: []
      };
    }

    const stores = await this.getOwnerToday(ownerId, date);
    const alerts = await this.prisma.notification.findMany({
      where: { userId: user.id, status: { in: ["PENDING", "SENT"] } },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    const storesClosed = stores.filter((store) => store.closedToday).length;
    const missingCash = stores.reduce((sum, store) => sum + Math.min(store.difference, 0), 0);
    const totalSales = stores.reduce((sum, store) => sum + store.totalSales, 0);
    // A store only "needs attention" if it has missing cash, OR it hasn't closed AND its close time has passed.
    const needsAttention = stores.filter(
      (store) =>
        (store.closedToday && store.difference < 0) ||
        (!store.closedToday && store.pastCloseTime)
    ).length;

    return {
      date: date.toISOString().slice(0, 10),
      storesClosed,
      totalStores: stores.length,
      totalSales,
      missingCash,
      needsAttention,
      stores,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        storeId: alert.storeId ?? undefined,
        message: alert.message,
        status: alert.status,
        createdAt: alert.createdAt.toISOString()
      }))
    };
  }
}
