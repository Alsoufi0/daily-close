import type {
  DailyCloseInput,
  OwnerDashboardSummary,
  ParsedPOSReport,
  SessionProfile
} from "@smokeshop/shared/types";
import { missedCloseAlert, scannedReport, stores } from "./mock-data";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export function hasProductionApi(): boolean {
  return Boolean(apiUrl);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export function getDemoDashboard(): OwnerDashboardSummary {
  const missingCash = stores.reduce((sum, store) => sum + Math.min(store.difference, 0), 0);
  return {
    date: new Date().toISOString().slice(0, 10),
    storesClosed: stores.filter((store) => store.closedToday).length,
    totalStores: stores.length,
    totalSales: stores.reduce((sum, store) => sum + store.totalSales, 0),
    missingCash,
    needsAttention: stores.filter((store) => !store.closedToday || store.difference < 0).length,
    stores,
    alerts: [
      {
        id: "demo-missed-close",
        storeId: missedCloseAlert.storeId,
        message: missedCloseAlert.message,
        status: "PENDING",
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export async function getProfile(token: string): Promise<SessionProfile> {
  return apiFetch<SessionProfile>("/auth/profile", token);
}

export async function bootstrapOwner(token: string, name?: string): Promise<SessionProfile> {
  return apiFetch<SessionProfile>("/auth/bootstrap-owner", token, {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export interface StoreRecord {
  id: string;
  storeName: string;
  address?: string | null;
  phone?: string | null;
  timezone?: string;
  closeTime?: string;
}

export async function listStores(token: string): Promise<StoreRecord[]> {
  return apiFetch<StoreRecord[]>("/stores", token);
}

export interface CreateStoreInput {
  storeName: string;
  address?: string;
  phone?: string;
  timezone?: string;
  closeTime?: string;
}

export async function createStore(token: string, input: CreateStoreInput): Promise<StoreRecord> {
  return apiFetch<StoreRecord>("/stores", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateStore(
  token: string,
  id: string,
  input: Partial<CreateStoreInput>
): Promise<StoreRecord> {
  return apiFetch<StoreRecord>(`/stores/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function resetEmployeePassword(
  token: string,
  employeeId: string
): Promise<{ employeeId: string; email: string; tempPassword: string; reset: boolean }> {
  return apiFetch(`/employees/${employeeId}/reset-password`, token, { method: "POST" });
}

export async function deleteEmployee(token: string, employeeId: string) {
  return apiFetch(`/employees/${employeeId}`, token, { method: "DELETE" });
}

export async function setEmployeeAdminAccess(
  token: string,
  employeeId: string,
  isAdmin: boolean
): Promise<{ employeeId: string; userId: string; role: "STORE_OWNER" | "EMPLOYEE"; isAdmin: boolean }> {
  return apiFetch(`/employees/${employeeId}/admin-access`, token, {
    method: "PATCH",
    body: JSON.stringify({ isAdmin })
  });
}

export async function deleteStore(token: string, storeId: string) {
  return apiFetch(`/stores/${storeId}`, token, { method: "DELETE" });
}

export async function deleteNotification(token: string, id: string) {
  return apiFetch(`/notifications/${id}`, token, { method: "DELETE" });
}

export interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  storeId: string;
  storeName?: string;
}

export async function listEmployees(token: string): Promise<any[]> {
  return apiFetch<any[]>("/employees", token);
}

export async function inviteEmployee(
  token: string,
  input: { name: string; email: string; storeId: string }
): Promise<{
  id: string;
  employeeId: string;
  email: string;
  name: string;
  storeId: string;
  tempPassword: string;
  invitedViaSupabase: boolean;
}> {
  return apiFetch("/employees/invite", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export interface SubscriptionView {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  plan: string;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  active: boolean;
  checkoutUrl: string | null;
  portalUrl: string | null;
}

export async function getSubscription(token: string): Promise<SubscriptionView> {
  return apiFetch<SubscriptionView>("/subscriptions/me", token);
}

export async function startSubscriptionCheckout(token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/subscriptions/create-checkout", token, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function editDailyClose(
  token: string,
  id: string,
  patch: Record<string, number | string | undefined>
) {
  return apiFetch(`/daily-close/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

export interface HistoryRow {
  id: string;
  date: string;
  storeId: string;
  storeName: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  difference: number;
  status: "CLOSED" | "SHORT" | "OVER" | "PENDING";
}

export async function getOwnerHistory(token: string | undefined, days = 7): Promise<HistoryRow[]> {
  if (!apiUrl || !token) {
    // Demo: synthesize 3 days of fake history
    const today = new Date();
    return [0, 1, 2].flatMap((offset) =>
      ["Store #1", "Store #3"].map((name, i) => ({
        id: `demo-${offset}-${i}`,
        date: new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10),
        storeId: `demo-${i}`,
        storeName: name,
        totalSales: 4500 - offset * 200 + i * 100,
        cashSales: 1800 - offset * 80,
        cardSales: 2700 - offset * 120,
        difference: offset === 0 && i === 1 ? -40 : 0,
        status: offset === 0 && i === 1 ? "SHORT" : "CLOSED"
      }))
    );
  }
  return apiFetch<HistoryRow[]>(`/dashboard/me/history?days=${days}`, token);
}

export async function getOwnerDashboard(token?: string): Promise<OwnerDashboardSummary> {
  if (!apiUrl || !token) return getDemoDashboard();
  return apiFetch<OwnerDashboardSummary>("/dashboard/me/today", token);
}

export async function uploadReport(
  token: string | undefined,
  storeId: string,
  upload?: { imageUrl: string; fileName: string; contentType: string }
): Promise<ParsedPOSReport & { imageUrl: string; rawText?: string }> {
  if (apiUrl && !token) throw new ApiError(401, "Please sign in before uploading a report.");
  if (!apiUrl || !token) return { ...scannedReport, imageUrl: upload?.imageUrl || "demo-report.jpg" };
  return apiFetch<ParsedPOSReport & { imageUrl: string; rawText?: string }>("/daily-close/upload-report", token, {
    method: "POST",
    body: JSON.stringify({
      storeId,
      fileName: upload?.fileName || "pos-report.jpg",
      contentType: upload?.contentType || "image/jpeg",
      imageUrl: upload?.imageUrl || "https://example.com/pos-report-demo.jpg"
    })
  });
}

export async function finishDailyClose(token: string | undefined, input: DailyCloseInput) {
  if (!apiUrl || !token) {
    const expectedCash = input.cashSales - input.refunds - input.expenses;
    const difference = input.countedCash + input.safeDropAmount - expectedCash;
    return {
      id: "demo-close",
      expectedCash,
      countedCash: input.countedCash,
      difference,
      status: difference < 0 ? "SHORT" : difference > 0 ? "OVER" : "CLOSED",
      createdAt: new Date().toISOString()
    };
  }

  return apiFetch("/daily-close/finish", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  if (!apiUrl) return;
  await apiFetch(`/notifications/${id}/read`, token, { method: "PATCH" });
}

export async function downloadTodayCsv(token: string | undefined): Promise<Blob> {
  if (!apiUrl || !token) {
    const summary = getDemoDashboard();
    const date = summary.date;
    const rows = summary.stores
      .map((s) =>
        [
          date,
          s.storeName,
          s.closedToday ? "Closed" : "Pending",
          s.totalSales.toFixed(2),
          s.cashSales.toFixed(2),
          s.cardSales.toFixed(2),
          s.difference.toFixed(2)
        ].join(",")
      )
      .join("\n");
    const csv = `Date,Store,Status,Total Sales,Cash,Card,Cash Difference\n${rows}\n`;
    return new Blob([csv], { type: "text/csv" });
  }
  const response = await fetch(`${apiUrl}/reports/today.csv`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new ApiError(response.status, response.statusText);
  return response.blob();
}
