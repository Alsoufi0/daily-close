import { ForbiddenException } from "@nestjs/common";
import { StoresService } from "./stores.service";
import { RequestUser } from "../auth/request-user";

const owner: RequestUser = {
  id: "u1",
  name: "Owner",
  email: "o@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};
const employee: RequestUser = {
  id: "u2",
  name: "Maya",
  email: "m@demo.com",
  role: "EMPLOYEE",
  employeeId: "e-1",
  storeId: "store-1"
};

function makePrisma(extra: any = {}) {
  return {
    store: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "store-new", storeName: "New" }),
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1" }),
      update: jest.fn().mockResolvedValue({ id: "s-1", storeName: "Renamed" }),
      ...extra
    },
    auditLog: { create: jest.fn().mockResolvedValue(undefined) }
  } as any;
}

describe("StoresService", () => {
  it("createForOwner forbids non-owners", async () => {
    const service = new StoresService(makePrisma());
    await expect(
      service.createForOwner(employee, { storeName: "X" })
    ).rejects.toThrow(ForbiddenException);
  });

  it("createForOwner persists with the owner's id and timezone default", async () => {
    const prisma = makePrisma();
    const service = new StoresService(prisma);
    await service.createForOwner(owner, { storeName: "Downtown" });
    expect(prisma.store.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "owner-1",
        storeName: "Downtown",
        timezone: "America/New_York",
        closeTime: "23:30"
      })
    });
  });

  it("updateForOwner forbids non-owners", async () => {
    const service = new StoresService(makePrisma());
    await expect(
      service.updateForOwner(employee, "s-1", { storeName: "X" })
    ).rejects.toThrow(ForbiddenException);
  });

  it("updateForOwner returns 404 when the store does not belong to the owner", async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const service = new StoresService(prisma);
    const { NotFoundException } = require("@nestjs/common");
    await expect(
      service.updateForOwner(owner, "s-x", { storeName: "X" })
    ).rejects.toThrow(NotFoundException);
  });

  it("updateForOwner patches and writes an audit log", async () => {
    const prisma = makePrisma();
    const service = new StoresService(prisma);
    await service.updateForOwner(owner, "s-1", { storeName: "Renamed", closeTime: "22:00" });
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { storeName: "Renamed", closeTime: "22:00" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "store.updated", storeId: "s-1", userId: "u1" })
    });
  });
});
