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
}
