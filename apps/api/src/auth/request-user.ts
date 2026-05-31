import type { UserRole } from "@shared/types";

export interface RequestUser {
  id: string;
  authUserId?: string | null;
  name: string;
  email: string;
  role: UserRole;
  ownerId?: string;
  employeeId?: string;
  storeId?: string;
  // Store ids where this user holds a per-store admin (MANAGER) assignment.
  // Empty/undefined for account owners (who administer ALL their stores via
  // ownerId) and for plain employees. A manager has global role EMPLOYEE but
  // gets owner-like powers SCOPED to these store ids — see admin-scope.ts.
  managedStoreIds?: string[];
}
