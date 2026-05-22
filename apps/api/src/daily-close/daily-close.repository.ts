import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateDailyCloseRecord {
  storeId: string;
  employeeId: string;
  date: Date;
  cashSales: number;
  cardSales: number;
  totalSales: number;
  tax: number;
  refunds: number;
  discounts: number;
  lottery?: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  expenses: number;
  notes?: string;
  status: "PENDING" | "CLOSED" | "SHORT" | "OVER";
}

@Injectable()
export class DailyCloseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateDailyCloseRecord) {
    return this.prisma.dailyClose.create({
      data: {
        ...data,
        lottery: data.lottery ?? null
      }
    });
  }

  async createExpenseAndAudit(input: {
    dailyCloseId: string;
    storeId: string;
    userId: string;
    expenses: number;
    notes?: string;
    difference: number;
  }) {
    await this.prisma.$transaction(async (tx) => {
      if (input.expenses > 0) {
        await tx.expense.create({
          data: {
            storeId: input.storeId,
            dailyCloseId: input.dailyCloseId,
            amount: input.expenses,
            category: "Daily Close",
            description: input.notes
          }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          storeId: input.storeId,
          action: "daily_close.submitted",
          metadata: {
            dailyCloseId: input.dailyCloseId,
            difference: input.difference
          }
        }
      });
    });
  }

  findRecentForOwner(ownerId: string, limit = 12) {
    return this.prisma.dailyClose.findMany({
      where: { store: { ownerId } },
      include: { store: true, employee: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  findByIdForOwner(id: string, ownerId: string) {
    return this.prisma.dailyClose.findFirst({
      where: { id, store: { ownerId } },
      include: { store: true }
    });
  }

  updateClose(id: string, data: Record<string, any>) {
    return this.prisma.dailyClose.update({ where: { id }, data });
  }

  writeAudit(input: { userId: string; storeId: string; action: string; metadata: any }) {
    return this.prisma.auditLog.create({ data: input });
  }

  findByStoreAndDate(storeId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.prisma.dailyClose.findFirst({
      where: { storeId, date: { gte: start, lte: end } }
    });
  }
}
