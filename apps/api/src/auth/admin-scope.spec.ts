import { ForbiddenException } from "@nestjs/common";
import {
  assertAccountAdmin,
  assertScopeAllowsStore,
  resolveAdminScope,
  scopeAllowsStore,
  storeWhereForScope
} from "./admin-scope";
import { RequestUser } from "./request-user";

const owner: RequestUser = {
  id: "u-owner",
  name: "Owner",
  email: "o@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

const manager: RequestUser = {
  id: "u-mgr",
  name: "Manager",
  email: "m@demo.com",
  role: "EMPLOYEE",
  ownerId: "owner-1",
  managedStoreIds: ["s-1", "s-2"]
};

const plainEmployee: RequestUser = {
  id: "u-emp",
  name: "Emp",
  email: "e@demo.com",
  role: "EMPLOYEE",
  ownerId: "owner-1",
  storeId: "s-9"
};

describe("admin-scope", () => {
  it("account owner → account admin with no store restriction", () => {
    const scope = resolveAdminScope(owner);
    expect(scope).toEqual({ isAccountAdmin: true, ownerId: "owner-1", storeIds: null });
    expect(storeWhereForScope(scope)).toEqual({ ownerId: "owner-1", deletedAt: null });
    expect(scopeAllowsStore(scope, "any-store")).toBe(true);
  });

  it("manager → restricted to managed store ids, not account admin", () => {
    const scope = resolveAdminScope(manager);
    expect(scope.isAccountAdmin).toBe(false);
    expect(scope.ownerId).toBe("owner-1");
    expect(scope.storeIds).toEqual(["s-1", "s-2"]);
    expect(storeWhereForScope(scope)).toEqual({
      ownerId: "owner-1",
      id: { in: ["s-1", "s-2"] },
      deletedAt: null
    });
    expect(scopeAllowsStore(scope, "s-1")).toBe(true);
    expect(scopeAllowsStore(scope, "s-3")).toBe(false);
  });

  it("plain employee (no managed stores) → forbidden", () => {
    expect(() => resolveAdminScope(plainEmployee)).toThrow(ForbiddenException);
  });

  it("assertAccountAdmin rejects a manager", () => {
    expect(() => assertAccountAdmin(manager)).toThrow(ForbiddenException);
    expect(assertAccountAdmin(owner).isAccountAdmin).toBe(true);
  });

  it("assertScopeAllowsStore throws for an out-of-scope store", () => {
    const scope = resolveAdminScope(manager);
    expect(() => assertScopeAllowsStore(scope, "s-2")).not.toThrow();
    expect(() => assertScopeAllowsStore(scope, "s-99")).toThrow(ForbiddenException);
  });
});
