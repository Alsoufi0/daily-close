import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { DailyCloseRepository } from "./daily-close/daily-close.repository";
import { DailyCloseService } from "./daily-close/daily-close.service";
import { DashboardService } from "./dashboard/dashboard.service";
import { PosParserService } from "./pos-parsers/pos-parser.service";
import { ReportsService } from "./reports/reports.service";
import { StoresService } from "./stores/stores.service";
import { RequestUser } from "./auth/request-user";

const owner: RequestUser = {
  id: "user-owner",
  name: "Owner",
  email: "owner@example.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

const employeeUser: RequestUser = {
  id: "user-employee",
  name: "Maya",
  email: "maya@example.com",
  role: "EMPLOYEE",
  employeeId: "employee-1",
  storeId: "store-1"
};

class InMemoryPrisma {
  stores: any[] = [];
  employees: any[] = [];
  dailyCloses: any[] = [];
  expenses: any[] = [];
  uploadedReports: any[] = [];
  auditLogs: any[] = [];
  notifications: any[] = [];

  store = {
    findMany: jest.fn(async (args: any = {}) => this.stores.filter((store) => this.matchesStore(store, args.where)).map((store) => {
      if (!args.include?.dailyCloses) return { ...store };
      const where = args.include.dailyCloses.where;
      return {
        ...store,
        dailyCloses: this.dailyCloses
          .filter((close) => close.storeId === store.id && this.inDateRange(close.date, where?.date))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      };
    })),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `store-${this.stores.length + 1}`, deletedAt: null, ...data };
      this.stores.push(row);
      return { ...row };
    }),
    findFirst: jest.fn(async ({ where }: any) => this.stores.find((store) => this.matchesStore(store, where)) || null),
    findUnique: jest.fn(async ({ where }: any) => this.stores.find((store) => store.id === where.id) || null),
    update: jest.fn(async ({ where, data }: any) => {
      const row = this.stores.find((store) => store.id === where.id);
      Object.assign(row, data);
      return { ...row };
    })
  };

  employee = {
    findFirst: jest.fn(async ({ where }: any) => this.employees.find((employee) => this.matchesEmployee(employee, where)) || null),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `employee-${this.employees.length + 1}`, deletedAt: null, ...data };
      this.employees.push(row);
      return { ...row };
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const rows = this.employees.filter((employee) => this.matchesEmployee(employee, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    })
  };

  dailyClose = {
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `close-${this.dailyCloses.length + 1}`, createdAt: new Date("2026-05-24T04:05:00.000Z"), ...data };
      this.dailyCloses.push(row);
      return { ...row };
    }),
    findFirst: jest.fn(async ({ where }: any) => this.dailyCloses.find((close) => this.matchesDailyClose(close, where)) || null),
    findMany: jest.fn(async ({ where }: any = {}) =>
      this.dailyCloses
        .filter((close) => this.matchesDailyClose(close, where))
        .map((close) => this.withRelations(close))
    ),
    update: jest.fn(async ({ where, data }: any) => {
      const row = this.dailyCloses.find((close) => close.id === where.id);
      Object.assign(row, data);
      return { ...row };
    }),
    delete: jest.fn(async ({ where }: any) => {
      const idx = this.dailyCloses.findIndex((close) => close.id === where.id);
      const [deleted] = this.dailyCloses.splice(idx, 1);
      return deleted;
    })
  };

  expense = {
    create: jest.fn(async ({ data }: any) => this.expenses.push({ id: `expense-${this.expenses.length + 1}`, ...data })),
    deleteMany: jest.fn(async ({ where }: any) => {
      const before = this.expenses.length;
      this.expenses = this.expenses.filter((row) => row.dailyCloseId !== where.dailyCloseId);
      return { count: before - this.expenses.length };
    })
  };

  uploadedReport = {
    deleteMany: jest.fn(async ({ where }: any) => {
      const before = this.uploadedReports.length;
      this.uploadedReports = this.uploadedReports.filter((row) => row.dailyCloseId !== where.dailyCloseId);
      return { count: before - this.uploadedReports.length };
    })
  };

  auditLog = {
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `audit-${this.auditLogs.length + 1}`, createdAt: new Date(), ...data };
      this.auditLogs.push(row);
      return row;
    })
  };

  notification = {
    findMany: jest.fn(async ({ where }: any = {}) =>
      this.notifications.filter((notification) => notification.userId === where.userId && where.status.in.includes(notification.status))
    )
  };

  $transaction = jest.fn(async (fn: any) => fn(this));

  private withRelations(close: any) {
    const store = this.stores.find((row) => row.id === close.storeId);
    const employee = this.employees.find((row) => row.id === close.employeeId);
    return {
      ...close,
      store,
      employee: employee ? { ...employee, user: { name: employee.name || employeeUser.name } } : null
    };
  }

  private matchesStore(store: any, where: any = {}) {
    if (!where) return true;
    if (where.id !== undefined && store.id !== where.id) return false;
    if (where.ownerId !== undefined && store.ownerId !== where.ownerId) return false;
    if (where.deletedAt === null && store.deletedAt !== null) return false;
    return true;
  }

  private matchesEmployee(employee: any, where: any = {}) {
    if (where.id !== undefined && employee.id !== where.id) return false;
    if (where.userId !== undefined && employee.userId !== where.userId) return false;
    if (where.storeId !== undefined && employee.storeId !== where.storeId) return false;
    if (where.deletedAt === null && employee.deletedAt !== null) return false;
    return true;
  }

  private matchesDailyClose(close: any, where: any = {}) {
    if (!where) return true;
    if (where.id !== undefined && close.id !== where.id) return false;
    if (where.storeId !== undefined && close.storeId !== where.storeId) return false;
    if (where.employeeId !== undefined && close.employeeId !== where.employeeId) return false;
    if (where.store?.ownerId && this.stores.find((store) => store.id === close.storeId)?.ownerId !== where.store.ownerId) return false;
    if (where.store?.deletedAt === null && this.stores.find((store) => store.id === close.storeId)?.deletedAt !== null) return false;
    if (where.date && !this.inDateRange(close.date, where.date)) return false;
    return true;
  }

  private inDateRange(date: Date, range: any) {
    if (!range) return true;
    if (range.gte && date < range.gte) return false;
    if (range.lte && date > range.lte) return false;
    return true;
  }
}

function makeSystem() {
  const prisma = new InMemoryPrisma();
  const subscriptions = {
    ensureActiveForOwner: jest.fn().mockResolvedValue(undefined),
    syncStoreQuantityForOwner: jest.fn().mockResolvedValue({ synced: false, quantity: 1 })
  };
  const stores = new StoresService(prisma as any, subscriptions as any);
  const dashboard = new DashboardService(prisma as any);
  const reports = new ReportsService(dashboard, prisma as any);
  const repository = new DailyCloseRepository(prisma as any);
  const ocr = {
    extractText: jest.fn().mockResolvedValue([
      "Terminal Reports",
      "Gross Sales $3,704.91",
      "Cash $1,169.27",
      "Credit/Debit $2,535.64",
      "Sales Tax (Tax) $242.36",
      "Refunds $0.00",
      "In Store Discounts $0.00"
    ].join("\n"))
  };
  const storage = { uploadBase64: jest.fn().mockRejectedValue(new Error("storage offline")) };
  const notifications = {
    getOwnerWhatsAppPreferences: jest.fn().mockResolvedValue({
      phone: null,
      alertsEnabled: false,
      closeAlertsEnabled: false,
      reportsEnabled: false
    })
  };
  const whatsapp = { isConfigured: jest.fn().mockReturnValue(false), sendCloseCompletedTemplate: jest.fn() };
  const dailyClose = new DailyCloseService(
    repository,
    new PosParserService(),
    ocr as any,
    storage as any,
    prisma as any,
    notifications as any,
    whatsapp as any
  );
  return { prisma, stores, dashboard, reports, dailyClose, ocr, storage };
}

describe("SmokeShop Daily Close system workflow", () => {
  it("keeps owner store actions in sync across admin list, dashboard, close, history, exports, and delete", async () => {
    const system = makeSystem();

    const created = await system.stores.createForOwner(owner, {
      storeName: "Main Street Smoke Shop",
      timezone: "America/New_York",
      closeTime: "23:30"
    });
    employeeUser.storeId = created.id;
    system.prisma.employees.push({ id: employeeUser.employeeId, userId: employeeUser.id, storeId: created.id, deletedAt: null, name: "Maya" });

    await system.stores.updateForOwner(owner, created.id, { closeTime: "22:30", timezone: "America/Chicago" });
    expect(await system.stores.listForUser(owner)).toHaveLength(1);

    const parsed = await system.dailyClose.uploadReport(
      {
        storeId: created.id,
        fileName: "report.jpg",
        contentType: "image/jpeg",
        base64Data: "data:image/jpeg;base64,abc123"
      },
      employeeUser
    );
    expect(system.storage.uploadBase64).toHaveBeenCalled();
    expect(system.ocr.extractText).toHaveBeenCalledWith("data:image/jpeg;base64,abc123");
    expect(parsed.totalSales).toBeCloseTo(3704.91);
    expect(parsed.imageUrl).toBe("report-upload-not-stored");

    const close = await system.dailyClose.finishClosing(
      {
        storeId: created.id,
        employeeId: employeeUser.employeeId!,
        date: "2026-05-24T17:00:00.000Z",
        cashSales: parsed.cashSales,
        cardSales: parsed.cardSales,
        totalSales: parsed.totalSales,
        tax: parsed.tax,
        refunds: parsed.refunds,
        discounts: parsed.discounts,
        countedCash: 1150,
        safeDropAmount: 0,
        expenses: 10,
        notes: "End-to-end close"
      },
      employeeUser
    );
    expect(close.status).toBe("SHORT");

    await expect(
      system.dailyClose.finishClosing(
        {
          storeId: created.id,
          employeeId: employeeUser.employeeId!,
          date: "2026-05-24T17:30:00.000Z",
          cashSales: 1,
          cardSales: 1,
          totalSales: 2,
          tax: 0,
          refunds: 0,
          discounts: 0,
          countedCash: 1,
          safeDropAmount: 0,
          expenses: 0
        },
        employeeUser
      )
    ).rejects.toThrow(BadRequestException);

    const summary = await system.dashboard.getMyToday(owner, new Date("2026-05-24T12:00:00.000Z"));
    expect(summary.totalStores).toBe(1);
    expect(summary.storesClosed).toBe(1);
    expect(summary.totalSales).toBeCloseTo(3704.91);
    expect(summary.missingCash).toBeLessThan(0);

    const csv = await system.reports.buildFilteredCsv(owner, { from: "2026-05-23", to: "2026-05-24", lang: "es" });
    expect(csv).toContain("Tienda");
    expect(csv).toContain("Main Street Smoke Shop");
    expect(csv).toContain("End-to-end close");

    await system.dailyClose.deleteClosing(close.id, owner);
    expect(await system.dashboard.getHistory(owner, 7)).toHaveLength(0);

    await system.stores.deleteForOwner(owner, created.id);
    expect(await system.stores.listForUser(owner)).toHaveLength(0);
    const afterDelete = await system.dashboard.getMyToday(owner, new Date("2026-05-24T12:00:00.000Z"));
    expect(afterDelete.totalStores).toBe(0);
  });

  it("enforces tenant and role boundaries for store and close operations", async () => {
    const system = makeSystem();
    const created = await system.stores.createForOwner(owner, { storeName: "Owner Store" });

    await expect(system.stores.createForOwner(employeeUser, { storeName: "Bad" })).rejects.toThrow(ForbiddenException);
    await expect(system.stores.updateForOwner({ ...owner, ownerId: "other-owner" }, created.id, { storeName: "Hack" })).rejects.toThrow();
    await expect(system.dailyClose.uploadReport(
      { storeId: "not-my-store", fileName: "x.jpg", contentType: "image/jpeg", base64Data: "abc" },
      employeeUser
    )).rejects.toThrow(ForbiddenException);
  });
});
