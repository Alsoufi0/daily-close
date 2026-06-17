import type { SessionProfile } from "@smokeshop/shared/types";

/**
 * Role helpers shared across routing + nav gating.
 *
 * A "manager" is a per-store admin: global role EMPLOYEE but with one or more
 * MANAGER store assignments. They get owner-like (store-scoped) access to the
 * dashboard, receipts, and admin pages — but NOT billing / account settings,
 * which stay with the true account owner.
 */
export function isManager(profile?: SessionProfile | null): boolean {
  return !!profile && profile.role === "EMPLOYEE" && (profile.managedStoreIds?.length ?? 0) > 0;
}

/** True account owner (or super admin) — full account incl. billing. */
export function isAccountOwner(profile?: SessionProfile | null): boolean {
  return !!profile && (profile.role === "STORE_OWNER" || profile.role === "SUPER_ADMIN");
}

/** Owner OR per-store manager — sees the owner-style admin UI (store-scoped). */
export function isAdminLike(profile?: SessionProfile | null): boolean {
  return isAccountOwner(profile) || isManager(profile);
}

/** Where to send a user after sign-in based on what they can access. */
export function landingPath(profile?: SessionProfile | null): string {
  // Platform staff land on the console, not the store-owner dashboard. The
  // owner dashboard is subscription-gated, so sending a SUPER_ADMIN (who isn't
  // a billable store account) there would bounce them to /billing.
  if (profile?.role === "SUPER_ADMIN") return "/console";
  return isAdminLike(profile) ? "/owner" : "/close";
}
