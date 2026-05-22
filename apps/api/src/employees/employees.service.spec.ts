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

function build(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      ...(prismaOverrides.employee || {})
    },
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: "s-1", ownerId: "owner-1" }),
      ...(prismaOverrides.store || {})
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "user-new",
        email: "new@demo.com",
        name: "New",
        employee: { id: "emp-new" }
      }),
      ...(prismaOverrides.user || {})
    }
  } as any;
  return { service: new EmployeesService(prisma), prisma };
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

  it("invite rejects a duplicate email", async () => {
    const { service } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "exists" }),
        create: jest.fn()
      }
    });
    await expect(
      service.invite(owner, { name: "X", email: "exists@x.com", storeId: "s-1" })
    ).rejects.toThrow(ConflictException);
  });

  it("invite creates the user + employee row with EMPLOYEE role", async () => {
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
          employee: { create: { storeId: "s-1" } }
        })
      })
    );
    expect(result.invitedViaSupabase).toBe(false);
    expect(result.employeeId).toBe("emp-new");
  });
});
