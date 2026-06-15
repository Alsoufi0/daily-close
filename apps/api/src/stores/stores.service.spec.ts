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
  const prisma: any = {
    store: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "store-new", storeName: "New" }),
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1" }),
      update: jest.fn().mockResolvedValue({ id: "s-1", storeName: "Renamed" }),
      ...extra
    },
    employee: {
      // createForOwner now atomically creates the OWNER-role assignment
      // row alongside the store inside a $transaction; mock the call.
      create: jest.fn().mockResolvedValue({ id: "emp-owner-new" }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    auditLog: { create: jest.fn().mockResolvedValue(undefined) }
  };
  // Minimal $transaction shim: forwards the callback against the same
  // mock prisma so the code under test runs unchanged.
  prisma.$transaction = jest.fn(async (fn: (tx: any) => Promise<any>) => fn(prisma));
  return prisma;
}

function makeSubscriptions(extra: any = {}) {
  return {
    ensureActiveForOwner: jest.fn().mockResolvedValue(undefined),
    syncStoreQuantityForOwner: jest.fn().mockResolvedValue({ synced: false, quantity: 1 }),
    ...extra
  };
}

describe("StoresService", () => {
  it("createForOwner forbids non-owners", async () => {
    const service = new StoresService(makePrisma(), makeSubscriptions() as any);
    await expect(
      service.createForOwner(employee, { storeName: "X" })
    ).rejects.toThrow(ForbiddenException);
  });

  it("createForOwner persists with the owner's id and timezone default", async () => {
    const prisma = makePrisma();
    const subscriptions = makeSubscriptions();
    const service = new StoresService(prisma, subscriptions as any);
    await service.createForOwner(owner, { storeName: "Downtown" });
    expect(prisma.store.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "owner-1",
        storeName: "Downtown",
        timezone: "America/New_York",
        closeTime: "23:30"
      })
    });
    expect(subscriptions.ensureActiveForOwner).toHaveBeenCalledWith("owner-1");
    expect(subscriptions.syncStoreQuantityForOwner).toHaveBeenCalledWith("owner-1");
  });

  it("createForOwner rolls back the active store when payment cannot be confirmed", async () => {
    const prisma = makePrisma();
    const service = new StoresService(
      prisma,
      makeSubscriptions({ syncStoreQuantityForOwner: jest.fn().mockRejectedValue(new Error("stripe down")) }) as any
    );
    await expect(service.createForOwner(owner, { storeName: "Downtown" })).rejects.toThrow(
      "payment could not be confirmed"
    );
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: "store-new" },
      data: { deletedAt: expect.any(Date) }
    });
  });

  it("updateForOwner forbids non-owners", async () => {
    const service = new StoresService(makePrisma(), makeSubscriptions() as any);
    await expect(
      service.updateForOwner(employee, "s-1", { storeName: "X" })
    ).rejects.toThrow(ForbiddenException);
  });

  it("updateForOwner returns 404 when the store does not belong to the owner", async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const service = new StoresService(prisma, makeSubscriptions() as any);
    const { NotFoundException } = require("@nestjs/common");
    await expect(
      service.updateForOwner(owner, "s-x", { storeName: "X" })
    ).rejects.toThrow(NotFoundException);
  });

  it("updateForOwner patches and writes an audit log", async () => {
    const prisma = makePrisma();
    const service = new StoresService(prisma, makeSubscriptions() as any);
    await service.updateForOwner(owner, "s-1", { storeName: "Renamed", closeTime: "22:00" });
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { storeName: "Renamed", closeTime: "22:00" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "store.updated", storeId: "s-1", userId: "u1" })
    });
  });

  it("pauseForOwner forbids non-owners", async () => {
    const service = new StoresService(makePrisma(), makeSubscriptions() as any);
    await expect(service.pauseForOwner(employee, "s-1")).rejects.toThrow(ForbiddenException);
  });

  it("pauseForOwner sets paused_at, audits, and re-syncs the Stripe quantity", async () => {
    const prisma = makePrisma(); // default findFirst → active store (no pausedAt)
    const subscriptions = makeSubscriptions();
    const service = new StoresService(prisma, subscriptions as any);
    await service.pauseForOwner(owner, "s-1");
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { pausedAt: expect.any(Date) }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "store.paused", storeId: "s-1", userId: "u1" })
    });
    expect(subscriptions.syncStoreQuantityForOwner).toHaveBeenCalledWith("owner-1");
  });

  it("pauseForOwner is a no-op when the store is already paused", async () => {
    const prisma = makePrisma({
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1", pausedAt: new Date() })
    });
    const subscriptions = makeSubscriptions();
    const service = new StoresService(prisma, subscriptions as any);
    await service.pauseForOwner(owner, "s-1");
    expect(prisma.store.update).not.toHaveBeenCalled();
    expect(subscriptions.syncStoreQuantityForOwner).not.toHaveBeenCalled();
  });

  it("resumeForOwner clears paused_at, audits, and re-syncs", async () => {
    const prisma = makePrisma({
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1", pausedAt: new Date() })
    });
    const subscriptions = makeSubscriptions();
    const service = new StoresService(prisma, subscriptions as any);
    await service.resumeForOwner(owner, "s-1");
    expect(prisma.store.update).toHaveBeenCalledWith({ where: { id: "s-1" }, data: { pausedAt: null } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "store.resumed", storeId: "s-1", userId: "u1" })
    });
    expect(subscriptions.syncStoreQuantityForOwner).toHaveBeenCalledWith("owner-1");
  });

  it("resumeForOwner rolls back to paused when billing cannot be updated", async () => {
    const wasPaused = new Date();
    const prisma = makePrisma({
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1", pausedAt: wasPaused })
    });
    const service = new StoresService(
      prisma,
      makeSubscriptions({ syncStoreQuantityForOwner: jest.fn().mockRejectedValue(new Error("stripe down")) }) as any
    );
    await expect(service.resumeForOwner(owner, "s-1")).rejects.toThrow("billing could not be updated");
    // never leaves an active (closeable) store that isn't billed — the last
    // write re-pauses it with its original timestamp.
    expect(prisma.store.update).toHaveBeenLastCalledWith({
      where: { id: "s-1" },
      data: { pausedAt: wasPaused }
    });
  });
});
