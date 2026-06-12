import { ReportsService } from "./reports.service";
import { RequestUser } from "../auth/request-user";

const owner: RequestUser = {
  id: "user-owner",
  name: "Owner",
  email: "owner@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

const close = {
  storeId: "store-1",
  employeeId: "employee-1",
  date: new Date("2026-05-23T04:00:00.000Z"),
  createdAt: new Date("2026-05-23T04:06:00.000Z"),
  totalSales: 5000,
  cashSales: 2000,
  cardSales: 3000,
  expectedCash: 1980,
  countedCash: 1940,
  difference: -40,
  expenses: 20,
  status: "SHORT",
  notes: "Register was short, needs review",
  store: { storeName: "Main Street Smoke Shop", timezone: "America/New_York" },
  employee: { user: { name: "Maya" } }
};

describe("ReportsService", () => {
  const prisma = {
    dailyClose: {
      findMany: jest.fn()
    }
  };

  beforeEach(() => {
    prisma.dailyClose.findMany.mockReset().mockResolvedValue([close]);
  });

  it("exports escaped UTF-8 CSV with localized headers and currency", async () => {
    // resolveRange("last-week") computes the window from `new Date()`. Without
    // pinning the clock the fixture's 2026-05-23 close drifts out of the
    // last-7-days window as wall time advances (test was passing in May 2026,
    // failing by month-end). Lock the clock to a moment that includes the
    // fixture date and restore it after.
    jest.useFakeTimers().setSystemTime(new Date("2026-05-29T12:00:00Z"));
    try {
      const service = new ReportsService({} as any, prisma as any);
      const csv = await service.buildFilteredCsv(owner, { quick: "last-week", lang: "en" });

      // No UTF-8 BOM — it sat before the first quoted cell and rendered as
      // garbage in spreadsheets (e.g. `î›¿"Store"` in Google Sheets). The file
      // now starts cleanly with the quoted "Store" header.
      expect(csv.charCodeAt(0)).not.toBe(0xfeff);
      expect(csv.startsWith("\"Store\"")).toBe(true);
      expect(csv).toContain("\"Store\"");
      expect(csv).toContain("\"Main Street Smoke Shop\"");
      expect(csv).toContain("\"$5,000.00\"");
      expect(csv).toContain("\"Register was short, needs review\"");
    } finally {
      jest.useRealTimers();
    }
  });

  it("filters close rows using the store local date", async () => {
    const service = new ReportsService({} as any, prisma as any);
    const { rows } = await service.buildRows(owner, { from: "2026-05-23", to: "2026-05-23" });

    expect(rows).toHaveLength(1);
    expect(rows[0].closeDate).toBe("2026-05-23");
    expect(prisma.dailyClose.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          store: { ownerId: owner.ownerId, deletedAt: null }
        })
      })
    );
  });

  it("builds a readable PDF buffer", async () => {
    const service = new ReportsService({} as any, prisma as any);
    const pdf = await service.buildPdf(owner, { quick: "last-week", lang: "en" });

    expect(Buffer.from(pdf).toString("utf8", 0, 4)).toBe("%PDF");
  });

  // Audit follow-up: Arabic PDF reports used to render every character as "?"
  // because pdf-lib's standard fonts are Latin-only and the pdfText() helper
  // stripped non-Latin codepoints. After bundling Noto Sans Arabic via the
  // pdf-fonts.ts helper, the PDF should generate without error in `ar` mode.
  it("builds a PDF in Arabic without falling back to question-mark glyphs", async () => {
    const service = new ReportsService({} as any, prisma as any);
    const pdf = await service.buildPdf(owner, { quick: "last-week", lang: "ar" });
    expect(Buffer.from(pdf).toString("utf8", 0, 4)).toBe("%PDF");
    // Spot-check that the rendered byte stream isn't suspiciously tiny —
    // a missing-font fallback used to produce ~3 KB pages of "????" stubs.
    // A real Noto-rendered table is comfortably north of 6 KB even with
    // subsetting.
    expect(pdf.byteLength).toBeGreaterThan(6_000);
  });

  it("builds a PDF in Hindi using the Devanagari font", async () => {
    const service = new ReportsService({} as any, prisma as any);
    const pdf = await service.buildPdf(owner, { quick: "last-week", lang: "hi" });
    expect(Buffer.from(pdf).toString("utf8", 0, 4)).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(6_000);
  });
});

describe("ReportsService.listReceipts", () => {
  const employee = {
    id: "user-emp",
    name: "Maya",
    email: "maya@demo.com",
    role: "EMPLOYEE" as const,
    employeeId: "employee-1",
    storeId: "store-1"
  };

  function makeReceiptsPrisma() {
    return {
      store: {
        findFirst: jest.fn().mockResolvedValue({
          id: "store-1",
          storeName: "Main Street Smoke Shop",
          timezone: "America/New_York"
        })
      },
      uploadedReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "ur-1",
            storeId: "store-1",
            uploadedByUserId: "user-emp",
            imageUrl: "https://storage.example/receipt.jpg",
            parsedJson: { totalSales: 100 },
            createdAt: new Date("2026-05-29T14:00:00Z"),
            uploadedBy: { name: "Maya" },
            dailyClose: {
              id: "close-1",
              storeId: "store-1",
              submittedByUserId: "user-emp",
              date: new Date("2026-05-29T04:00:00Z"),
              createdAt: new Date("2026-05-29T14:05:00Z"),
              totalSales: 100,
              cashSales: 60,
              cardSales: 40,
              difference: 0,
              status: "CLOSED",
              submittedBy: { name: "Maya" }
            }
          }
        ])
      },
      dailyClose: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "close-1",
            storeId: "store-1",
            submittedByUserId: "user-emp",
            date: new Date("2026-05-29T04:00:00Z"),
            createdAt: new Date("2026-05-29T14:05:00Z"),
            totalSales: 100,
            cashSales: 60,
            cardSales: 40,
            difference: 0,
            status: "CLOSED",
            submittedBy: { name: "Maya" }
          }
        ])
      }
    };
  }

  it("returns receipts for an owner's store", async () => {
    const prisma = makeReceiptsPrisma();
    const service = new ReportsService({} as any, prisma as any);
    const rows = await service.listReceipts(
      { storeId: "store-1", from: "2026-05-25", to: "2026-05-30" },
      owner
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].storeName).toBe("Main Street Smoke Shop");
    expect(rows[0].employeeName).toBe("Maya");
    expect(rows[0].dailyClose?.totalSales).toBe(100);
  });

  it("keeps unlinked receipt uploads visible only when they pair to a submitted close", async () => {
    const prisma = makeReceiptsPrisma();
    prisma.uploadedReport.findMany.mockResolvedValueOnce([
      {
        id: "ur-legacy",
        storeId: "store-1",
        uploadedByUserId: "user-emp",
        imageUrl: "https://storage.example/legacy-receipt.jpg",
        storagePath: null,
        parsedJson: { totalSales: 125 },
        createdAt: new Date("2026-05-29T14:03:00Z"),
        uploadedBy: { name: "Maya" },
        dailyClose: null
      }
    ]);
    prisma.dailyClose.findMany.mockResolvedValueOnce([
      {
        id: "close-legacy",
        storeId: "store-1",
        submittedByUserId: "user-emp",
        date: new Date("2026-05-29T04:00:00Z"),
        createdAt: new Date("2026-05-29T14:08:00Z"),
        totalSales: 125,
        cashSales: 75,
        cardSales: 50,
        difference: 0,
        status: "CLOSED",
        submittedBy: { name: "Maya" }
      }
    ]);
    const service = new ReportsService({} as any, prisma as any);
    const rows = await service.listReceipts(
      { storeId: "store-1", from: "2026-05-25", to: "2026-05-30" },
      owner
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("ur-legacy");
    expect(rows[0].employeeName).toBe("Maya");
    expect(rows[0].dailyClose?.id).toBe("close-legacy");
    expect(prisma.uploadedReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              dailyCloseId: null,
              storeId: "store-1"
            })
          ])
        })
      })
    );
  });

  it("does not show abandoned unlinked receipt uploads", async () => {
    const prisma = makeReceiptsPrisma();
    prisma.uploadedReport.findMany.mockResolvedValueOnce([
      {
        id: "ur-abandoned",
        storeId: "store-1",
        uploadedByUserId: "user-emp",
        imageUrl: "https://storage.example/abandoned.jpg",
        storagePath: null,
        parsedJson: { totalSales: 125 },
        createdAt: new Date("2026-05-29T14:03:00Z"),
        uploadedBy: { name: "Maya" },
        dailyClose: null
      }
    ]);
    prisma.dailyClose.findMany.mockResolvedValueOnce([]);
    const service = new ReportsService({} as any, prisma as any);
    const rows = await service.listReceipts(
      { storeId: "store-1", from: "2026-05-25", to: "2026-05-30" },
      owner
    );

    expect(rows).toHaveLength(0);
  });

  it("forbids employees from listing receipts", async () => {
    const prisma = makeReceiptsPrisma();
    const service = new ReportsService({} as any, prisma as any);
    await expect(
      service.listReceipts({ storeId: "store-1" }, employee as any)
    ).rejects.toThrow();
  });

  it("forbids owners from reading another owner's store", async () => {
    const prisma = makeReceiptsPrisma();
    prisma.store.findFirst.mockResolvedValueOnce(null);
    const service = new ReportsService({} as any, prisma as any);
    await expect(
      service.listReceipts({ storeId: "store-other" }, owner)
    ).rejects.toThrow();
  });
});
