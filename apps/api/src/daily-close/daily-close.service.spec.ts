import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DailyCloseService } from "./daily-close.service";
import { RequestUser } from "../auth/request-user";
import { CreateDailyCloseDto } from "./dto/create-daily-close.dto";

function makeService(overrides: Partial<{
  existing: any;
  createReturn: any;
  editTarget: any;
  updateReturn: any;
}> = {}) {
  const repository = {
    findByStoreAndDate: jest.fn().mockResolvedValue(overrides.existing ?? null),
    findByStoreAndRange: jest.fn().mockResolvedValue(overrides.existing ?? null),
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(
      overrides.createReturn ?? { id: "close-1", createdAt: new Date("2026-05-22T20:00:00Z") }
    ),
    createExpenseAndAudit: jest.fn().mockResolvedValue(undefined),
    findByIdForOwner: jest.fn().mockResolvedValue(overrides.editTarget ?? null),
    updateClose: jest.fn().mockResolvedValue(
      overrides.updateReturn ?? { id: "close-1", createdAt: new Date("2026-05-22T20:00:00Z") }
    ),
    writeAudit: jest.fn().mockResolvedValue(undefined)
  };
  const posParser = { parse: jest.fn() };
  const ocr = { extractText: jest.fn() };
  const storage = { uploadBase64: jest.fn() };
  const prisma = {
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: "store-1" }),
      findUnique: jest.fn().mockResolvedValue({ timezone: "UTC" })
    },
    employee: {
      // Post migration 006: assertCanCloseStore queries by (userId, storeId)
      // and never relinks. Return non-null only when the store matches the
      // default test store ("store-1"); tests that probe other stores
      // (e.g. "forbids employee from closing another store") need null.
      findFirst: jest.fn().mockImplementation((args: any) => {
        if (args?.where?.storeId && args.where.storeId !== "store-1") return null;
        return { id: "employee-1", userId: args?.where?.userId, storeId: "store-1", role: args?.where?.role || "EMPLOYEE" };
      }),
      create: jest.fn().mockResolvedValue({ id: "employee-new" }),
      update: jest.fn().mockResolvedValue({ id: "employee-existing", storeId: "store-1", deletedAt: null })
    },
    uploadedReport: {
      create: jest.fn().mockResolvedValue({ id: "report-1" }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: "report-1" })
    }
  };
  const notifications = {
    getOwnerWhatsAppPreferences: jest.fn().mockResolvedValue({
      phone: null,
      alertsEnabled: false,
      closeAlertsEnabled: false,
      reportsEnabled: false
    })
  };
  const whatsapp = {
    isConfigured: jest.fn().mockReturnValue(false),
    sendCloseCompletedTemplate: jest.fn().mockResolvedValue(false)
  };
  const sms = {
    send: jest.fn().mockResolvedValue({ sent: true }),
    sendWhatsAppTemplate: jest.fn().mockResolvedValue({ sent: true })
  };
  const service = new DailyCloseService(
    repository as any,
    posParser as any,
    ocr as any,
    storage as any,
    prisma as any,
    notifications as any,
    whatsapp as any,
    sms as any
  );
  return { service, repository, prisma, ocr, posParser, storage, notifications, whatsapp, sms };
}

const baseInput: CreateDailyCloseDto = {
  storeId: "store-1",
  employeeId: "employee-1",
  date: "2026-05-22T20:00:00Z",
  cashSales: 1000,
  cardSales: 500,
  totalSales: 1500,
  tax: 100,
  refunds: 50,
  discounts: 0,
  countedCash: 940,
  safeDropAmount: 0,
  expenses: 10,
  notes: "ok"
};

const employeeUser: RequestUser = {
  id: "user-employee",
  name: "Maya",
  email: "maya@demo.com",
  role: "EMPLOYEE",
  employeeId: "employee-1",
  storeId: "store-1"
};

describe("DailyCloseService.finishClosing", () => {
  it("computes CLOSED status when counted cash matches expected", async () => {
    const { service } = makeService();
    const result = await service.finishClosing(
      { ...baseInput, cashSales: 1000, refunds: 50, expenses: 10, countedCash: 940, safeDropAmount: 0 },
      employeeUser
    );
    // expected = 1000 - 50 - 10 = 940; counted 940 + 0 = 940; diff 0 -> CLOSED
    expect(result.expectedCash).toBe(940);
    expect(result.difference).toBe(0);
    expect(result.status).toBe("CLOSED");
  });

  it("computes SHORT status when counted cash is less than expected", async () => {
    const { service } = makeService();
    const result = await service.finishClosing(
      { ...baseInput, countedCash: 900, safeDropAmount: 0 },
      employeeUser
    );
    expect(result.difference).toBe(-40);
    expect(result.status).toBe("SHORT");
  });

  it("computes OVER status when counted cash exceeds expected", async () => {
    const { service } = makeService();
    const result = await service.finishClosing(
      { ...baseInput, countedCash: 1000, safeDropAmount: 0 },
      employeeUser
    );
    expect(result.difference).toBe(60);
    expect(result.status).toBe("OVER");
  });

  it("blocks duplicate close for same store and date", async () => {
    const { service } = makeService({ existing: { id: "existing" } });
    await expect(service.finishClosing(baseInput, employeeUser)).rejects.toThrow(BadRequestException);
  });

  it("forbids employee from closing another store", async () => {
    const { service } = makeService();
    await expect(
      service.finishClosing({ ...baseInput, storeId: "store-other" }, employeeUser)
    ).rejects.toThrow(ForbiddenException);
  });

  it("forbids owner from closing a store they don't own", async () => {
    const { service, prisma } = makeService();
    prisma.store.findFirst.mockResolvedValueOnce(null);
    const owner: RequestUser = {
      id: "u-owner",
      name: "Owner",
      email: "owner@demo.com",
      role: "STORE_OWNER",
      ownerId: "owner-1"
    };
    await expect(service.finishClosing(baseInput, owner)).rejects.toThrow(ForbiddenException);
  });

  it("allows owner to close a store they own, auto-creating an OWNER-role assignment row", async () => {
    const { service, prisma, repository } = makeService();
    prisma.employee.findFirst.mockResolvedValueOnce(null); // no existing assignment row
    const owner: RequestUser = {
      id: "u-owner",
      name: "Owner",
      email: "owner@demo.com",
      role: "STORE_OWNER",
      ownerId: "owner-1"
    };
    const result = await service.finishClosing(baseInput, owner);
    // Post migration 006: the auto-created row carries role:"OWNER" so it's
    // distinguishable from employee assignments. submittedByUserId on the
    // close row captures the actual user.
    expect(prisma.employee.create).toHaveBeenCalledWith({
      data: { userId: "u-owner", storeId: "store-1", role: "OWNER" }
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: "employee-new",
        submittedByUserId: "u-owner",
        storeId: "store-1"
      })
    );
    expect(result.status).toBe("CLOSED");
  });

  it("writes expense and audit log only when expenses > 0", async () => {
    const { service, repository } = makeService();
    await service.finishClosing({ ...baseInput, expenses: 25 }, employeeUser);
    expect(repository.createExpenseAndAudit).toHaveBeenCalledWith(
      expect.objectContaining({ expenses: 25, storeId: "store-1", userId: "user-employee" })
    );
  });

  it("uses expenseItems as the source of truth for the expenses total when provided", async () => {
    const { service, repository } = makeService();
    await service.finishClosing(
      {
        ...baseInput,
        expenses: 999, // stale client value; must be overridden by items sum
        expenseItems: [
          { category: "Supplies", amount: 10 },
          { category: "Lottery payout", amount: 15 },
          { category: "Other", amount: 5, description: "tape" }
        ]
      } as any,
      employeeUser
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ expenses: 30 })
    );
    expect(repository.createExpenseAndAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        expenses: 30,
        expenseItems: [
          { category: "Supplies", amount: 10 },
          { category: "Lottery payout", amount: 15 },
          { category: "Other", amount: 5, description: "tape" }
        ]
      })
    );
  });

  it("falls back to the flat expenses field when expenseItems is empty", async () => {
    const { service, repository } = makeService();
    await service.finishClosing(
      { ...baseInput, expenses: 25, expenseItems: [] } as any,
      employeeUser
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ expenses: 25 })
    );
    expect(repository.createExpenseAndAudit).toHaveBeenCalledWith(
      expect.objectContaining({ expenses: 25, expenseItems: undefined })
    );
  });

  it("returns the prior close (no side effects) when the same idempotency key is re-submitted", async () => {
    const priorClose = {
      id: "close-prior",
      expectedCash: 940,
      countedCash: 940,
      difference: 0,
      status: "CLOSED" as const,
      createdAt: new Date("2026-05-22T20:00:00Z")
    };
    const { service, repository, whatsapp } = makeService();
    repository.findByIdempotencyKey.mockResolvedValueOnce(priorClose);

    const result = await service.finishClosing(baseInput, employeeUser, "client-uuid-abc");

    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith("client-uuid-abc");
    expect(result.id).toBe("close-prior");
    expect(result.status).toBe("CLOSED");
    // Critical: no new close was created, no audit/expense, no WhatsApp.
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.createExpenseAndAudit).not.toHaveBeenCalled();
    expect(whatsapp.sendCloseCompletedTemplate).not.toHaveBeenCalled();
  });

  it("threads the idempotency key into create() on a fresh submission", async () => {
    const { service, repository } = makeService();
    await service.finishClosing(baseInput, employeeUser, "client-uuid-new");
    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith("client-uuid-new");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "client-uuid-new" })
    );
  });

  it("falls through and still creates the close if the idempotency_key column is missing (pre-005 migration)", async () => {
    const { service, repository } = makeService();
    const columnMissing: any = new Error(
      "column daily_close.idempotency_key does not exist"
    );
    repository.findByIdempotencyKey.mockRejectedValueOnce(columnMissing);
    const result = await service.finishClosing(baseInput, employeeUser, "client-uuid-pre-migration");
    expect(result.status).toBe("CLOSED");
    expect(repository.create).toHaveBeenCalled();
  });

  it("re-throws unexpected errors from the idempotency check (does not swallow)", async () => {
    const { service, repository } = makeService();
    repository.findByIdempotencyKey.mockRejectedValueOnce(new Error("connection refused"));
    await expect(
      service.finishClosing(baseInput, employeeUser, "client-uuid-db-down")
    ).rejects.toThrow("connection refused");
  });

  it("sends an owner WhatsApp alert when close-completed alerts are enabled", async () => {
    const { service, prisma, notifications, whatsapp } = makeService();
    prisma.store.findUnique
      .mockResolvedValueOnce({ timezone: "UTC" })
      .mockResolvedValueOnce({
        storeName: "Main Street Smoke Shop",
        ownerId: "owner-1",
        owner: { user: { name: "Owner" } }
      });
    notifications.getOwnerWhatsAppPreferences.mockResolvedValueOnce({
      phone: "+15551234567",
      alertsEnabled: false,
      closeAlertsEnabled: true,
      reportsEnabled: false
    });
    whatsapp.isConfigured.mockReturnValueOnce(true);
    await service.finishClosing(baseInput, employeeUser);
    expect(whatsapp.sendCloseCompletedTemplate).toHaveBeenCalledWith({
      toPhone: "+15551234567",
      ownerName: "Owner",
      storeName: "Main Street Smoke Shop"
    });
  });

  it("falls back to the Twilio WhatsApp template when Meta WhatsApp is not configured", async () => {
    const { service, prisma, notifications, sms } = makeService();
    prisma.store.findUnique
      .mockResolvedValueOnce({ timezone: "UTC" })
      .mockResolvedValueOnce({
        storeName: "Main Street Smoke Shop",
        ownerId: "owner-1",
        owner: { user: { name: "Owner" } }
      });
    notifications.getOwnerWhatsAppPreferences.mockResolvedValueOnce({
      phone: "+15551234567",
      alertsEnabled: false,
      closeAlertsEnabled: true,
      reportsEnabled: false
    });
    await service.finishClosing(baseInput, employeeUser);
    // Business-initiated WhatsApp must use an approved Content Template, not
    // freeform text (which WhatsApp rejects with 63016). The ContentSid
    // defaults to the approved daily_close_completed_v2 template; variables
    // map {{1}}=owner, {{2}}=store.
    expect(sms.sendWhatsAppTemplate).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringMatching(/^HX/),
      { "1": "Owner", "2": "Main Street Smoke Shop" }
    );
    expect(sms.send).not.toHaveBeenCalled();
  });
});

describe("DailyCloseService.uploadReport", () => {
  const ownerUser: RequestUser = {
    id: "user-owner",
    name: "Owner",
    email: "owner@demo.com",
    role: "STORE_OWNER",
    ownerId: "owner-1"
  };

  it("scans the submitted base64 image directly after storing it", async () => {
    const { service, storage, ocr, posParser } = makeService();
    storage.uploadBase64.mockResolvedValue("https://storage.example/report.jpg");
    ocr.extractText.mockResolvedValue("Gross Sales $3,704.91 Cash $1,169.27 Credit/Debit $2,535.64");
    posParser.parse.mockReturnValue({
      parserType: "TERMINAL_REPORT",
      cashSales: 1169.27,
      cardSales: 2535.64,
      totalSales: 3704.91,
      tax: 0,
      refunds: 0,
      discounts: 0,
      confidence: 1
    });

    const result = await service.uploadReport(
      {
        storeId: "store-1",
        fileName: "report.jpg",
        contentType: "image/jpeg",
        base64Data: "data:image/jpeg;base64,abc123"
      },
      employeeUser
    );

    expect(storage.uploadBase64).toHaveBeenCalled();
    expect(ocr.extractText).toHaveBeenCalledWith("data:image/jpeg;base64,abc123");
    expect(result.imageUrl).toBe("https://storage.example/report.jpg");
    expect(result.totalSales).toBe(3704.91);
  });

  // Replaces the prior "reuses an existing owner employee row" test which
  // exercised commit e4922a1's wandering-row hack. Post migration 006 each
  // (user, store) is its own assignment — the hack is gone.
  it("creates a fresh OWNER assignment row when an owner closes a NEW store they own", async () => {
    const { service, storage, ocr, posParser, prisma } = makeService();
    // No assignment exists for (this owner, this store) yet → forces create.
    prisma.employee.findFirst.mockImplementation(() => null);
    storage.uploadBase64.mockResolvedValue("https://storage.example/report.jpg");
    ocr.extractText.mockResolvedValue("Gross Sales $3,704.91 Cash $1,169.27 Credit/Debit $2,535.64");
    posParser.parse.mockReturnValue({
      parserType: "TERMINAL_REPORT",
      cashSales: 1169.27,
      cardSales: 2535.64,
      totalSales: 3704.91,
      tax: 0,
      refunds: 0,
      discounts: 0,
      confidence: 1
    });

    await service.uploadReport(
      {
        storeId: "store-1",
        fileName: "report.jpg",
        contentType: "image/jpeg",
        base64Data: "data:image/jpeg;base64,abc123"
      },
      ownerUser
    );

    // Critical regression guard: we CREATE a per-store row instead of
    // updating an existing one. The wandering-row behaviour from
    // e4922a1 is gone — no `update` calls on the employees table.
    expect(prisma.employee.create).toHaveBeenCalledWith({
      data: { userId: "user-owner", storeId: "store-1", role: "OWNER" }
    });
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });
});

describe("DailyCloseService.editClosing", () => {
  const ownerUser: RequestUser = {
    id: "user-owner",
    name: "Owner",
    email: "owner@demo.com",
    role: "STORE_OWNER",
    ownerId: "owner-1"
  };

  const target = {
    id: "close-1",
    storeId: "store-1",
    cashSales: 1000,
    cardSales: 500,
    totalSales: 1500,
    tax: 100,
    refunds: 50,
    discounts: 0,
    lottery: null,
    expectedCash: 940,
    countedCash: 940,
    difference: 0,
    expenses: 10,
    notes: "old"
  };

  it("forbids employees from editing", async () => {
    const { service } = makeService({ editTarget: target });
    await expect(service.editClosing("close-1", { cashSales: 1100 }, employeeUser)).rejects.toThrow(
      ForbiddenException
    );
  });

  it("throws NotFound when close does not belong to the owner", async () => {
    const { service } = makeService({ editTarget: null });
    await expect(service.editClosing("close-x", { cashSales: 1100 }, ownerUser)).rejects.toThrow(
      NotFoundException
    );
  });

  it("recomputes expected/difference/status from the patch and writes an audit log", async () => {
    const { service, repository } = makeService({ editTarget: target });
    const result = await service.editClosing(
      "close-1",
      { cashSales: 1100, countedCash: 1100 },
      ownerUser
    );
    // expected = 1100 - 50 - 10 = 1040; counted 1100 + 0 - expected = +60 -> OVER
    expect(result.expectedCash).toBe(1040);
    expect(result.difference).toBe(60);
    expect(result.status).toBe("OVER");

    expect(repository.updateClose).toHaveBeenCalledWith(
      "close-1",
      expect.objectContaining({ cashSales: 1100, countedCash: 1100, status: "OVER" })
    );
    expect(repository.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "daily_close.edited",
        userId: "user-owner",
        storeId: "store-1"
      })
    );
  });

  it("preserves the original safe-drop amount when editing a close", async () => {
    const targetWithSafeDrop = {
      ...target,
      expectedCash: 1000,
      countedCash: 800,
      difference: 0
    };
    const { service, repository } = makeService({ editTarget: targetWithSafeDrop });
    const result = await service.editClosing(
      "close-1",
      { cashSales: 1100, countedCash: 900 },
      ownerUser
    );

    // Existing safe drop = difference + expected - counted = 200.
    // New expected = 1100 - 50 - 10 = 1040; 900 + 200 - 1040 = +60.
    expect(result.difference).toBe(60);
    expect(result.status).toBe("OVER");
    expect(repository.updateClose).toHaveBeenCalledWith(
      "close-1",
      expect.objectContaining({ countedCash: 900, difference: 60, status: "OVER" })
    );
  });
});
