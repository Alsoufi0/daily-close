export type UserRole = "SUPER_ADMIN" | "STORE_OWNER" | "EMPLOYEE";

export type CloseStatus = "CLOSED" | "SHORT" | "OVER" | "PENDING";

export type ParserType = "CLOVER" | "NRS" | "UNKNOWN";

export interface StoreSummary {
  id: string;
  storeName: string;
  closedToday: boolean;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  difference: number;
}

export interface SessionProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  ownerId?: string;
  employeeId?: string;
  storeId?: string;
}

export interface OwnerDashboardSummary {
  date: string;
  storesClosed: number;
  totalStores: number;
  totalSales: number;
  missingCash: number;
  needsAttention: number;
  stores: StoreSummary[];
  alerts: Array<{
    id: string;
    storeId?: string;
    message: string;
    status: "PENDING" | "SENT" | "FAILED" | "READ";
    createdAt: string;
  }>;
}

export interface ParsedPOSReport {
  parserType: ParserType;
  cashSales: number;
  cardSales: number;
  totalSales: number;
  tax: number;
  refunds: number;
  discounts: number;
  lottery?: number;
  confidence: number;
}

export interface DailyCloseInput {
  storeId: string;
  employeeId: string;
  date: string;
  cashSales: number;
  cardSales: number;
  totalSales: number;
  tax: number;
  refunds: number;
  discounts: number;
  lottery?: number;
  countedCash: number;
  safeDropAmount: number;
  expenses: number;
  notes?: string;
}

export interface DailyCloseResult {
  id: string;
  expectedCash: number;
  countedCash: number;
  difference: number;
  status: CloseStatus;
  createdAt: string;
}
