import { DashboardService } from "./dashboard.service";
import { RequestUser } from "../auth/request-user";

function makePrisma(stores: any[], notifications: any[] = [], closes: any[] = []) {
  return {
    store: { findMany: jest.fn().mockResolvedValue(stores) },
    notification: { findMany: jest.fn().mockResolvedValue(notifications) },
    dailyClose: { findMany: jest.fn().mockResolvedValue(closes) }
  } as any;
}

const owner: RequestUser = {
  id: "user-owner",
  name: "Owner",
  email: "owner@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

const employeeNoOwner: RequestUser = {
  id: "user-emp",
  name: "Maya",
  email: "maya@demo.com",
  role: "EMPLOYEE",
  employeeId: "emp-1",
  storeId: "store-1"
};

describe("DashboardService", () => {
  it("aggregates storesClosed, totalSales and missingCash correctly", async () => {
    // closeTime 10:00 + pinned now at 12:00 UTC -> deterministically "past close time"
    // (we don't use 00:00 anymore because effectiveCloseMin treats early-morning
    // closes as next-day, so they're never past at midday).
    const now = new Date("2026-05-22T12:00:00.000Z");
    const closeDate = new Date("2026-05-22T05:00:00.000Z"); // inside UTC 2026-05-22
    const prisma = makePrisma([
      {
        id: "s1", storeName: "Store #1", timezone: "UTC", closeTime: "10:00",
        dailyCloses: [{ date: closeDate, totalSales: 4500, cashSales: 1800, cardSales: 2700, difference: 5 }]
      },
      {
        id: "s2", storeName: "Store #2", timezone: "UTC", closeTime: "10:00",
        dailyCloses: []
      },
      {
        id: "s3", storeName: "Store #3", timezone: "UTC", closeTime: "10:00",
        dailyCloses: [{ date: closeDate, totalSales: 3900, cashSales: 1500, cardSales: 2400, difference: -40 }]
      }
    ]);

    const service = new DashboardService(prisma);
    const summary = await service.getMyToday(owner, now);

    expect(summary.totalStores).toBe(3);
    expect(summary.storesClosed).toBe(2);
    expect(summary.totalSales).toBe(8400);
    expect(summary.missingCash).toBe(-40);
    // store-2 not closed AND past close time + store-3 negative diff = 2
    expect(summary.needsAttention).toBe(2);
  });

  it("does not flag a not-yet-due store as needing attention", async () => {
    // Pin "now" to 08:00 UTC so the +2h future close (10:00 UTC) cannot wrap
    // past midnight on flaky late-day runs.
    const fixedNow = new Date("2026-05-22T08:00:00.000Z");
    const prisma = makePrisma([
      {
        id: "s1", storeName: "Store #1", timezone: "UTC", closeTime: "10:00",
        dailyCloses: []
      }
    ]);
    const service = new DashboardService(prisma);
    const summary = await service.getMyToday(owner, fixedNow);
    expect(summary.stores[0].pastCloseTime).toBe(false);
    expect(summary.needsAttention).toBe(0);
  });

  it("returns empty summary when the user has no ownerId", async () => {
    const prisma = makePrisma([]);
    const service = new DashboardService(prisma);
    const summary = await service.getMyToday(employeeNoOwner);
    expect(summary.totalStores).toBe(0);
    expect(summary.storesClosed).toBe(0);
    expect(summary.totalSales).toBe(0);
    expect(summary.missingCash).toBe(0);
    expect(summary.stores).toEqual([]);
    expect(summary.alerts).toEqual([]);
    expect(prisma.store.findMany).not.toHaveBeenCalled();
  });

  it("getHistory returns flat per-close rows scoped to the owner", async () => {
    const prisma = makePrisma([], [], [
      {
        id: "c1",
        date: new Date("2026-05-22T20:00:00Z"),
        storeId: "s1",
        store: { storeName: "Store #1" },
        totalSales: 4500,
        cashSales: 1800,
        cardSales: 2700,
        difference: 5,
        status: "CLOSED"
      },
      {
        id: "c2",
        date: new Date("2026-05-21T20:00:00Z"),
        storeId: "s1",
        store: { storeName: "Store #1" },
        totalSales: 4225,
        cashSales: 1710,
        cardSales: 2515,
        difference: 0,
        status: "CLOSED"
      }
    ]);
    const service = new DashboardService(prisma);
    const rows = await service.getHistory(owner, 7);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({ id: "c1", date: "2026-05-22", storeName: "Store #1", difference: 5 })
    );
    const args = prisma.dailyClose.findMany.mock.calls[0][0];
    expect(args.where.store.ownerId).toBe("owner-1");
  });

  it("getHistory returns empty when user has no ownerId", async () => {
    const prisma = makePrisma([], [], []);
    const service = new DashboardService(prisma);
    const rows = await service.getHistory(employeeNoOwner, 7);
    expect(rows).toEqual([]);
    expect(prisma.dailyClose.findMany).not.toHaveBeenCalled();
  });

  it("maps notifications into alerts", async () => {
    const prisma = makePrisma(
      [],
      [
        {
          id: "n1",
          storeId: "s2",
          message: "Store #2 has not completed closing yet.",
          status: "PENDING",
          createdAt: new Date("2026-05-22T22:00:00Z")
        }
      ]
    );
    const service = new DashboardService(prisma);
    const summary = await service.getMyToday(owner);
    expect(summary.alerts).toHaveLength(1);
    expect(summary.alerts[0].message).toContain("Store #2");
    expect(summary.alerts[0].status).toBe("PENDING");
  });
});
