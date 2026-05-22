import { Injectable } from "@nestjs/common";
import type { OwnerDashboardSummary } from "@shared/types";
import { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnerToday(ownerId: string, date = new Date()): Promise<OwnerDashboardSummary["stores"]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      include: {
        dailyCloses: {
          where: { date: { gte: start, lte: end } },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return stores.map((store) => {
      const close = store.dailyCloses[0];
      return {
        id: store.id,
        storeName: store.storeName,
        closedToday: Boolean(close),
        totalSales: close ? Number(close.totalSales) : 0,
        cashSales: close ? Number(close.cashSales) : 0,
        cardSales: close ? Number(close.cardSales) : 0,
        difference: close ? Number(close.difference) : 0
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

    return {
      date: date.toISOString().slice(0, 10),
      storesClosed,
      totalStores: stores.length,
      totalSales,
      missingCash,
      needsAttention: stores.filter((store) => !store.closedToday || store.difference < 0).length,
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
