import type {
  DailyCloseInput,
  OwnerDashboardSummary,
  ParsedPOSReport,
  SessionProfile
} from "@smokeshop/shared/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl && typeof window !== "undefined") {
  // Fail closed in the browser if the API URL was not baked into the build.
  // The old behaviour silently returned mock data here, which meant a broken
  // env-var in a Vercel deploy showed fake numbers indistinguishable from
  // real ones. Surfacing it as a hard runtime error is preferable.
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] NEXT_PUBLIC_API_URL is not set. Configure it in Vercel before deploying."
  );
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function extractApiErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string" && message.trim()) return message;
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Non-JSON API errors are still valid and should be shown as text.
  }
  return text || fallback;
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
    const message = extractApiErrorMessage(text, response.statusText);

    // 402 Payment Required → SubscriptionGuard rejected the call (audit fix
    // #8). Redirect to /billing instead of showing a toast that the user has
    // no obvious action to take from. Guarded so we don't loop while already
    // on /billing, and so SSR/test environments still get a normal error.
    if (
      response.status === 402 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/billing")
    ) {
      window.location.replace("/billing?expired=1");
      // The page is tearing down — return a never-resolving promise so the
      // calling component doesn't briefly flash an error UI before nav.
      return new Promise<T>(() => {});
    }

    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
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

export async function signupOwner(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ email: string; name: string; ownerId: string }> {
  return apiFetch("/auth/signup-owner", undefined, {
    method: "POST",
    body: JSON.stringify(input)
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

export interface WhatsAppSettings {
  whatsappPhone: string | null;
  whatsappAlertsEnabled: boolean;
  whatsappCloseAlertsEnabled: boolean;
  whatsappReportsEnabled: boolean;
}

export async function getWhatsAppSettings(token: string): Promise<WhatsAppSettings> {
  return apiFetch<WhatsAppSettings>("/notifications/whatsapp-settings", token);
}

export async function updateWhatsAppSettings(
  token: string,
  input: WhatsAppSettings
): Promise<WhatsAppSettings> {
  return apiFetch<WhatsAppSettings>("/notifications/whatsapp-settings", token, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function sendWhatsAppTest(token: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/notifications/whatsapp-settings/test", token, {
    method: "POST"
  });
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

/**
 * Assign an EXISTING employee to an additional store the owner owns.
 * `employeeId` is any existing assignment-row id for that user; the
 * server resolves the user, verifies ownership, and creates a new
 * assignment for the target store.
 *
 * Idempotent — if the user already has an assignment for the target
 * store, returns the existing row with `alreadyAssigned: true`.
 */
export async function assignEmployeeToStore(
  token: string,
  employeeId: string,
  storeId: string
): Promise<{ employeeId: string; userId: string; storeId: string; alreadyAssigned: boolean }> {
  return apiFetch(`/employees/${employeeId}/assignments`, token, {
    method: "POST",
    body: JSON.stringify({ storeId })
  });
}

/**
 * List every store a given employee-user is currently assigned to,
 * scoped to the owner's stores. Used by the admin UI to render the
 * "Maya works at: Store #1, Store #3" chip list per user.
 */
export async function listEmployeeAssignments(
  token: string,
  userId: string
): Promise<Array<{ id: string; storeId: string; store: { id: string; storeName: string } }>> {
  return apiFetch<Array<{ id: string; storeId: string; store: { id: string; storeName: string } }>>(
    `/employees/by-user/${userId}/assignments`,
    token
  );
}

export async function inviteEmployee(
  token: string,
  // Provide email OR phone (E.164, e.g. "+15551234567"). The server requires
  // at least one and returns whichever was supplied alongside the tempPassword.
  input: { name: string; storeId: string; email?: string; phone?: string }
): Promise<{
  id: string;
  employeeId: string;
  email: string | null;
  phone: string | null;
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

export async function deleteDailyClose(token: string, id: string) {
  return apiFetch(`/daily-close/${id}`, token, { method: "DELETE" });
}

export interface HistoryRow {
  id: string;
  date: string;
  storeId: string;
  storeName: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  countedCash: number;
  difference: number;
  status: "CLOSED" | "SHORT" | "OVER" | "PENDING";
}

function requireToken(token: string | undefined): string {
  if (!token) throw new ApiError(401, "Please sign in.");
  return token;
}

export async function getOwnerHistory(token: string | undefined, days = 7): Promise<HistoryRow[]> {
  return apiFetch<HistoryRow[]>(`/dashboard/me/history?days=${days}`, requireToken(token));
}

export async function getOwnerDashboard(token: string | undefined): Promise<OwnerDashboardSummary> {
  return apiFetch<OwnerDashboardSummary>("/dashboard/me/today", requireToken(token));
}

export async function uploadReport(
  token: string | undefined,
  storeId: string,
  upload?: { imageUrl?: string; base64Data?: string; fileName: string; contentType: string }
): Promise<ParsedPOSReport & { imageUrl: string; rawText?: string }> {
  return apiFetch<ParsedPOSReport & { imageUrl: string; rawText?: string }>(
    "/daily-close/upload-report",
    requireToken(token),
    {
      method: "POST",
      body: JSON.stringify({
        storeId,
        fileName: upload?.fileName || "pos-report.jpg",
        contentType: upload?.contentType || "image/jpeg",
        base64Data: upload?.base64Data,
        imageUrl: upload?.imageUrl || "https://example.com/pos-report-demo.jpg"
      })
    }
  );
}

/**
 * Generate a client-side idempotency key for /daily-close/finish. The caller
 * should re-use the same key when retrying the SAME logical submission so
 * the server can dedupe — generating a fresh key per attempt defeats the
 * purpose. See `finishDailyClose`'s optional `idempotencyKey` parameter.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `dc-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface ExpenseItemInput {
  category: string;
  amount: number;
  description?: string;
}

export async function finishDailyClose(
  token: string | undefined,
  input: DailyCloseInput & { expenseItems?: ExpenseItemInput[] },
  idempotencyKey?: string
) {
  const key = idempotencyKey || generateIdempotencyKey();
  return apiFetch("/daily-close/finish", requireToken(token), {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(input)
  });
}

export interface ReceiptRow {
  id: string;
  imageUrl: string;
  storeName: string;
  closeDate: string;
  employeeName: string;
  parsedJson: any;
  dailyClose: {
    id: string;
    totalSales: number;
    cashSales: number;
    cardSales: number;
    difference: number;
    status: "CLOSED" | "SHORT" | "OVER" | "PENDING";
  } | null;
  createdAt: string;
}

export async function listReceipts(
  token: string | undefined,
  filters: { storeId: string; from?: string; to?: string }
): Promise<ReceiptRow[]> {
  const params = new URLSearchParams();
  params.set("storeId", filters.storeId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return apiFetch<ReceiptRow[]>(`/reports/receipts?${params.toString()}`, requireToken(token));
}

/**
 * Trigger a browser download for a single receipt. Uses fetch + Blob so the
 * Authorization header is sent (a plain `<a href>` cannot attach headers).
 * If the API responds with 302 we follow it transparently — the redirect
 * target is a short-lived public signed URL, so the resulting download still
 * lands on the user's machine with no extra hop.
 */
export async function downloadReceipt(token: string | undefined, id: string): Promise<void> {
  requireToken(token);
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
  const response = await fetch(`${apiUrl}/reports/receipts/${id}/download`, {
    headers: { Authorization: `Bearer ${token!}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, extractApiErrorMessage(text, response.statusText));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `receipt-${id}.jpg`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAllReceipts(
  token: string | undefined,
  filters: { storeId: string; from?: string; to?: string }
): Promise<void> {
  requireToken(token);
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
  const params = new URLSearchParams();
  params.set("storeId", filters.storeId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const response = await fetch(`${apiUrl}/reports/receipts/download?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token!}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, extractApiErrorMessage(text, response.statusText));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipts-${filters.storeId}-${filters.from || "start"}-${filters.to || "today"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, token, { method: "PATCH" });
}

export async function downloadTodayCsv(token: string | undefined): Promise<Blob> {
  requireToken(token);
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
  const response = await fetch(`${apiUrl}/reports/today.csv`, {
    headers: { Authorization: `Bearer ${token!}` }
  });
  if (!response.ok) throw new ApiError(response.status, response.statusText);
  return response.blob();
}

export interface ReportExportFilters {
  from?: string;
  to?: string;
  quick?: "last-day" | "last-week" | "last-month";
  storeId?: string;
  employeeId?: string;
  lang?: "en" | "ar" | "es" | "hi";
}

export async function downloadReport(
  token: string | undefined,
  type: "csv" | "pdf",
  filters: ReportExportFilters
): Promise<Blob> {
  requireToken(token);
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = await fetch(`${apiUrl}/reports/export.${type}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token!}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, extractApiErrorMessage(text, response.statusText));
  }
  return response.blob();
}
