import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateDailyCloseRecord {
  storeId: string;
  // `employeeId` is the assignment-row id used for the existing FK link
  // (kept populated for back-compat with reports.service.ts queries that
  // join `employee → user`). New code should treat `submittedByUserId`
  // as the source of truth for "who closed this".
  employeeId: string | null;
  // Always set — captures the actual user that submitted the close.
  // Wired in via migration 006_store_assignments.sql.
  submittedByUserId: string;
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
  idempotencyKey?: string;
}

@Injectable()
export class DailyCloseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateDailyCloseRecord) {
    return this.prisma.dailyClose.create({
      data: {
        ...data,
        lottery: data.lottery ?? null,
        idempotencyKey: data.idempotencyKey ?? null
      }
    });
  }

  findByIdempotencyKey(key: string) {
    return this.prisma.dailyClose.findFirst({
      where: { idempotencyKey: key }
    });
  }

  async createExpenseAndAudit(input: {
    dailyCloseId: string;
    storeId: string;
    userId: string;
    expenses: number;
    notes?: string;
    difference: number;
    // When provided and non-empty, write one Expense row per item instead of
    // the single rollup row. Each row keeps the close-id linkage so the
    // owner can see "Lottery payout $40 + Repair $15" on the receipts page.
    expenseItems?: Array<{ category: string; amount: number; description?: string }>;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const items = input.expenseItems ?? [];
      if (items.length > 0) {
        await tx.expense.createMany({
          data: items.map((item) => ({
            storeId: input.storeId,
            dailyCloseId: input.dailyCloseId,
            amount: item.amount,
            category: item.category,
            description: item.description
          }))
        });
      } else if (input.expenses > 0) {
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

  deleteClose(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { dailyCloseId: id } });
      await tx.uploadedReport.deleteMany({ where: { dailyCloseId: id } });
      return tx.dailyClose.delete({ where: { id } });
    });
  }

  writeAudit(input: { userId: string; storeId: string; action: string; metadata: any }) {
    return this.prisma.auditLog.create({ data: input });
  }

  findByStoreAndRange(storeId: string, start: Date, end: Date) {
    return this.prisma.dailyClose.findFirst({
      where: { storeId, date: { gte: start, lte: end } }
    });
  }
}
