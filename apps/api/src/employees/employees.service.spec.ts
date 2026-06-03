import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { EmployeesService } from "./employees.service";
import { RequestUser } from "../auth/request-user";

const owner: RequestUser = {
  id: "u-owner",
  name: "Owner",
  email: "o@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

const employee: RequestUser = {
  id: "u-emp",
  name: "Maya",
  email: "m@demo.com",
  role: "EMPLOYEE",
  employeeId: "e-1",
  storeId: "s-1"
};

// A per-store admin: global role EMPLOYEE, but manages stores s-1 and s-2.
const manager: RequestUser = {
  id: "u-mgr",
  name: "Manny",
  email: "mgr@demo.com",
  role: "EMPLOYEE",
  ownerId: "owner-1",
  managedStoreIds: ["s-1", "s-2"]
};

function build(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: "emp-x" }),
      count: jest.fn().mockResolvedValue(0),
      ...(prismaOverrides.employee || {})
    },
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1" }),
      findMany: jest.fn().mockResolvedValue([]),
      ...(prismaOverrides.store || {})
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "user-new",
        email: "new@demo.com",
        name: "New",
        // Post migration 006: relation is `employees` (plural) — a list
        // of per-store assignment rows. New invites get one entry.
        employees: [{ id: "emp-new" }]
      }),
      ...(prismaOverrides.user || {})
    },
    phoneConsent: {
      create: jest.fn().mockResolvedValue({ id: "consent-1" }),
      ...(prismaOverrides.phoneConsent || {})
    }
  } as any;
  // Default $transaction runs the callback against the same prisma mock so
  // tx.employee.update/create resolve against the stubs above.
  prisma.$transaction = prismaOverrides.$transaction || jest.fn((cb: any) => cb(prisma));
  // SMS isn't exercised by these tests; the stub keeps the constructor honest
  // without pulling in env vars or hitting the network.
  const sms = { sendEmployeeWelcome: jest.fn().mockResolvedValue({ sent: false }) } as any;
  const email = { sendEmployeeWelcome: jest.fn().mockResolvedValue({ sent: false }) } as any;
  return { service: new EmployeesService(prisma, sms, email), prisma };
}

describe("EmployeesService", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("listForOwner forbids non-owners", async () => {
    const { service } = build();
    await expect(service.listForOwner(employee)).rejects.toThrow(ForbiddenException);
  });

  it("invite forbids non-owners", async () => {
    const { service } = build();
    await expect(
      service.invite(employee, { name: "X", email: "x@x.com", storeId: "s-1" })
    ).rejects.toThrow(ForbiddenException);
  });

  it("invite rejects a store that does not belong to the owner", async () => {
    const { service } = build({ store: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(
      service.invite(owner, { name: "X", email: "x@x.com", storeId: "other" })
    ).rejects.toThrow(BadRequestException);
  });

  it("invite rejects a duplicate email when the user still has an active assignment", async () => {
    const { service } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "exists",
          role: "EMPLOYEE",
          employees: [{ id: "a1" }] // still actively assigned somewhere
        }),
        create: jest.fn()
      }
    });
    await expect(
      service.invite(owner, { name: "X", email: "exists@x.com", storeId: "s-1" })
    ).rejects.toThrow(ConflictException);
  });

  it("invite rejects re-using an account owner's email", async () => {
    const { service } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "exists",
          role: "STORE_OWNER",
          employees: []
        }),
        create: jest.fn()
      }
    });
    await expect(
      service.invite(owner, { name: "X", email: "boss@x.com", storeId: "s-1" })
    ).rejects.toThrow(ConflictException);
  });

  it("invite REVIVES a previously-removed employee instead of erroring (frees the email/phone)", async () => {
    const update = jest.fn().mockResolvedValue({
      id: "exists",
      name: "Maya",
      employees: [{ id: "emp-revived", storeId: "s-1" }]
    });
    const { service, prisma } = build({
      user: {
        // The row survived removal (daily_close FK pins it) but has no active
        // assignment — so it should be revived, not rejected as a duplicate.
        findUnique: jest.fn().mockResolvedValue({
          id: "exists",
          email: "maya@demo.com",
          role: "EMPLOYEE",
          authUserId: null,
          employees: []
        }),
        update
      }
    });
    const result = await service.invite(owner, {
      name: "Maya",
      email: "maya@demo.com",
      storeId: "s-1"
    });
    expect(result.reactivated).toBe(true);
    expect(result.employeeId).toBe("emp-revived");
    expect(typeof result.tempPassword).toBe("string");
    // Revival adds a fresh EMPLOYEE assignment on the surviving user row.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exists" },
        data: expect.objectContaining({
          role: "EMPLOYEE",
          employees: { create: { storeId: "s-1", role: "EMPLOYEE" } }
        })
      })
    );
    void prisma;
  });

  it("invite creates the user + employee row with EMPLOYEE role and returns a temp password", async () => {
    const { service, prisma } = build();
    const result = await service.invite(owner, {
      name: "New",
      email: "new@demo.com",
      storeId: "s-1"
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@demo.com",
          role: "EMPLOYEE",
          employees: { create: { storeId: "s-1", role: "EMPLOYEE" } }
        })
      })
    );
    expect(result.invitedViaSupabase).toBe(false);
    expect(result.employeeId).toBe("emp-new");
    expect(typeof result.tempPassword).toBe("string");
    expect(result.tempPassword.length).toBeGreaterThan(8);
  });

  it("invite by phone REJECTS when consent is missing (A2P 10DLC)", async () => {
    const { service } = build();
    await expect(
      service.invite(owner, { name: "Maya", phone: "+15551234567", storeId: "s-1" })
    ).rejects.toThrow(BadRequestException);
  });

  it("invite by phone REJECTS when consent.granted is false", async () => {
    const { service } = build();
    await expect(
      service.invite(owner, {
        name: "Maya",
        phone: "+15551234567",
        storeId: "s-1",
        consent: { granted: false, text: "I agree" }
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("invite by phone REJECTS when consent text is empty/whitespace", async () => {
    const { service } = build();
    await expect(
      service.invite(owner, {
        name: "Maya",
        phone: "+15551234567",
        storeId: "s-1",
        consent: { granted: true, text: "   " }
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("invite by phone with valid consent persists a phone_consents row", async () => {
    const { service, prisma } = build();
    await service.invite(owner, {
      name: "Maya",
      phone: "+15551234567",
      storeId: "s-1",
      consent: { granted: true, text: "I confirm this employee has agreed..." }
    });
    expect(prisma.phoneConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: "+15551234567",
        consentedByUserId: "u-owner",
        storeId: "s-1",
        consentMethod: "owner_attestation_v1",
        consentText: "I confirm this employee has agreed..."
      })
    });
  });

  it("resetPassword forbids non-owners", async () => {
    const { service } = build();
    await expect(service.resetPassword(employee, "e-1")).rejects.toThrow(ForbiddenException);
  });

  it("resetPassword 404 when employee not in this owner's stores", async () => {
    const { service } = build({ employee: { findFirst: jest.fn().mockResolvedValue(null) } });
    const { NotFoundException } = require("@nestjs/common");
    await expect(service.resetPassword(owner, "e-1")).rejects.toThrow(NotFoundException);
  });

  it("listForOwner allows a manager and scopes to their managed stores", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = build({ employee: { findMany } });
    await service.listForOwner(manager);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          store: { ownerId: "owner-1", id: { in: ["s-1", "s-2"] }, deletedAt: null },
          role: { in: ["EMPLOYEE", "MANAGER"] }
        })
      })
    );
  });

  it("invite lets a manager invite to a store they manage", async () => {
    const { service, prisma } = build();
    const result = await service.invite(manager, { name: "New", email: "new@demo.com", storeId: "s-1" });
    expect(result.employeeId).toBe("emp-new");
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it("invite forbids a manager inviting to a store outside their scope", async () => {
    const { service } = build();
    await expect(
      service.invite(manager, { name: "X", email: "x@x.com", storeId: "s-99" })
    ).rejects.toThrow(ForbiddenException);
  });

  it("setManagerStores forbids a manager (only the account owner can delegate)", async () => {
    const { service } = build();
    await expect(service.setManagerStores(manager, "u-emp", ["s-1"])).rejects.toThrow(ForbiddenException);
  });

  it("setManagerStores upserts MANAGER rows for the owner and downgrades the rest", async () => {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({ id: "emp-new2" });
    const { service, prisma } = build({
      store: { findMany: jest.fn().mockResolvedValue([{ id: "s-1" }, { id: "s-2" }]) },
      employee: {
        // Existing rows: s-1 already EMPLOYEE (→ promote to MANAGER),
        // s-3 currently MANAGER but not in the desired set (→ downgrade).
        findMany: jest.fn().mockResolvedValue([
          { id: "a1", storeId: "s-1", role: "EMPLOYEE" },
          { id: "a3", storeId: "s-3", role: "MANAGER" }
        ]),
        update,
        create
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u-emp", role: "EMPLOYEE" }) }
    });

    const result = await service.setManagerStores(owner, "u-emp", ["s-1", "s-2"]);
    expect(result.managedStoreIds).toEqual(["s-1", "s-2"]);
    // s-1 promoted to MANAGER
    expect(update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { role: "MANAGER" } });
    // s-2 had no row → created as MANAGER
    expect(create).toHaveBeenCalledWith({ data: { userId: "u-emp", storeId: "s-2", role: "MANAGER" } });
    // s-3 downgraded back to EMPLOYEE
    expect(update).toHaveBeenCalledWith({ where: { id: "a3" }, data: { role: "EMPLOYEE" } });
    void prisma;
  });

  it("setManagerStores rejects stores that aren't the owner's", async () => {
    const { service } = build({
      store: { findMany: jest.fn().mockResolvedValue([{ id: "s-1" }]) } // only 1 of 2 owned
    });
    await expect(service.setManagerStores(owner, "u-emp", ["s-1", "s-foreign"])).rejects.toThrow(
      BadRequestException
    );
  });

  it("remove keeps the login when the employee still has other store assignments", async () => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    const deleteUser = jest.fn();
    const { service } = build({
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "e-1",
          userId: "u-emp",
          user: { authUserId: "auth-1" }
        }),
        // Still assigned to 1 other store after this soft-delete.
        count: jest.fn().mockResolvedValue(1)
      }
    });
    (service as any).supabase = { auth: { admin: { deleteUser } } };
    const r = await service.remove(owner, "e-1");
    expect(r.loginRevoked).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("remove revokes the login when it was the LAST assignment", async () => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    const deleteUser = jest.fn().mockResolvedValue({});
    const { service } = build({
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "e-1",
          userId: "u-emp",
          user: { authUserId: "auth-1" }
        }),
        count: jest.fn().mockResolvedValue(0)
      }
    });
    (service as any).supabase = { auth: { admin: { deleteUser } } };
    const r = await service.remove(owner, "e-1");
    expect(r.loginRevoked).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
  });

  it("resetPassword returns a temporary password without Supabase configured", async () => {
    const { service } = build({
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "e-1",
          user: { authUserId: "auth-1", email: "m@demo.com" }
        })
      }
    });
    const r = await service.resetPassword(owner, "e-1");
    expect(r.employeeId).toBe("e-1");
    expect(r.email).toBe("m@demo.com");
    expect(typeof r.tempPassword).toBe("string");
    expect(r.tempPassword.length).toBeGreaterThan(8);
    expect(r.reset).toBe(false);
  });
});
