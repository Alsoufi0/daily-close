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
  const service = new DailyCloseService(
    repository as any,
    posParser as any,
    ocr as any,
    storage as any
  );
  return { service, repository };
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

  it("forbids non-employee role from submitting close", async () => {
    const { service } = makeService();
    const owner: RequestUser = {
      id: "u-owner",
      name: "Owner",
      email: "owner@demo.com",
      role: "STORE_OWNER",
      ownerId: "owner-1"
    };
    await expect(service.finishClosing(baseInput, owner)).rejects.toThrow(ForbiddenException);
  });

  it("writes expense and audit log only when expenses > 0", async () => {
    const { service, repository } = makeService();
    await service.finishClosing({ ...baseInput, expenses: 25 }, employeeUser);
    expect(repository.createExpenseAndAudit).toHaveBeenCalledWith(
      expect.objectContaining({ expenses: 25, storeId: "store-1", userId: "user-employee" })
    );
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
    countedCash: 940,
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
});
