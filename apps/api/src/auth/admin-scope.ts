import { ForbiddenException } from "@nestjs/common";
import { RequestUser } from "./request-user";

/**
 * Who-can-administer-what, resolved once per request from the RequestUser.
 *
 * Two kinds of admin exist:
 *   - Account admin  → an account owner (User.role === STORE_OWNER). Administers
 *     EVERY store under their ownerId, plus billing and store create/delete, and
 *     can grant admin to others. `storeIds === null` means "all owner stores".
 *   - Store manager  → a user with MANAGER assignment rows (global role EMPLOYEE).
 *     Owner-like powers but SCOPED to `storeIds`. No billing, no store
 *     create/delete, cannot grant admin to others.
 *
 * Throws Forbidden for plain employees / unauthenticated-but-tokened users so
 * callers can use it as the single gate for every admin surface.
 */
export interface AdminScope {
  isAccountAdmin: boolean;
  ownerId: string;
  /** null = all stores under ownerId (account admin); string[] = restricted set (manager). */
  storeIds: string[] | null;
}

export function resolveAdminScope(user: RequestUser): AdminScope {
  if (user.role === "STORE_OWNER" && user.ownerId) {
    return { isAccountAdmin: true, ownerId: user.ownerId, storeIds: null };
  }
  if (user.managedStoreIds && user.managedStoreIds.length > 0 && user.ownerId) {
    return { isAccountAdmin: false, ownerId: user.ownerId, storeIds: [...user.managedStoreIds] };
  }
  throw new ForbiddenException("You don't have admin access.");
}

/** Account-admin-only gate (billing, store create/delete, granting admin). */
export function assertAccountAdmin(user: RequestUser): AdminScope {
  const scope = resolveAdminScope(user);
  if (!scope.isAccountAdmin) {
    throw new ForbiddenException("Only the account owner can do this.");
  }
  return scope;
}

/** Prisma `store` where-fragment that honours the scope (always excludes deleted). */
export function storeWhereForScope(scope: AdminScope) {
  return scope.storeIds
    ? { ownerId: scope.ownerId, id: { in: scope.storeIds }, deletedAt: null }
    : { ownerId: scope.ownerId, deletedAt: null };
}

/** True when `storeId` is administrable under the scope. */
export function scopeAllowsStore(scope: AdminScope, storeId: string): boolean {
  return scope.storeIds ? scope.storeIds.includes(storeId) : true;
}

/** Throws unless `storeId` is administrable under the scope. */
export function assertScopeAllowsStore(scope: AdminScope, storeId: string): void {
  if (!scopeAllowsStore(scope, storeId)) {
    throw new ForbiddenException("That store is outside your admin access.");
  }
}
