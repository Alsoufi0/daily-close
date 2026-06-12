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

/**
 * Read the first-touch referral code dropped by the /r/[code] landing route.
 * Non-httpOnly so the signup flow can attach it; the server stamps it onto the
 * owner exactly once at account creation.
 */
export function readRefCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/(?:^|;\s*)dc_ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

export async function bootstrapOwner(token: string, name?: string): Promise<SessionProfile> {
  return apiFetch<SessionProfile>("/auth/bootstrap-owner", token, {
    method: "POST",
    body: JSON.stringify({ name, ref: readRefCookie() })
  });
}

// Verify-first signup: request a code (email via Resend, phone via Twilio),
// then confirm it — the account is created only on confirm.
export async function requestSignup(input: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
}): Promise<{ sent: boolean; channel: "email" | "phone"; message: string }> {
  return apiFetch("/auth/signup-owner/request", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function confirmSignup(input: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  code: string;
}): Promise<{ tokenHash: string; type: "magiclink"; email: string }> {
  // Attach the first-touch referral code (if any) so the new owner is stamped
  // at creation. The server ignores unknown/inactive codes.
  return apiFetch("/auth/signup-owner/confirm", undefined, {
    method: "POST",
    body: JSON.stringify({ ...input, ref: readRefCookie() })
  });
}

export async function requestPhonePasswordReset(phone: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch("/auth/phone-reset/request", undefined, {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function confirmPhonePasswordReset(input: {
  phone: string;
  code: string;
  password: string;
}): Promise<{ reset: true }> {
  return apiFetch("/auth/phone-reset/confirm", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function requestPhoneLogin(phone: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch("/auth/phone-login/request", undefined, {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function confirmPhoneLogin(input: {
  phone: string;
  code: string;
}): Promise<{ tokenHash: string; type: "magiclink" }> {
  return apiFetch("/auth/phone-login/confirm", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

// Add a phone for SMS sign-in — for owners who signed up with email. Authed
// (links to the signed-in account).
export async function getPhoneLoginStatus(token: string): Promise<{ phone: string | null }> {
  return apiFetch("/auth/phone-login/added", token);
}

export async function addPhoneLoginRequest(token: string, phone: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch("/auth/phone-login/add/request", token, {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function addPhoneLoginConfirm(token: string, input: { phone: string; code: string }): Promise<{ phone: string }> {
  return apiFetch("/auth/phone-login/add/confirm", token, {
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

/**
 * Set the exact set of stores a user is a per-store admin (MANAGER) of.
 * `userId` is the USER id. Pass the full desired set — omitted stores are
 * downgraded back to plain employee. Account-owner only (server-enforced).
 */
export async function setEmployeeManagerStores(
  token: string,
  userId: string,
  storeIds: string[]
): Promise<{ userId: string; managedStoreIds: string[] }> {
  return apiFetch(`/employees/by-user/${userId}/manager-stores`, token, {
    method: "PATCH",
    body: JSON.stringify({ storeIds })
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
  input: {
    name: string;
    storeId: string;
    email?: string;
    phone?: string;
    // Required when `phone` is set — A2P 10DLC owner-attestation payload.
    // `text` is the exact label the owner saw next to the checkbox.
    consent?: { granted: boolean; text: string };
  }
): Promise<{
  id: string;
  employeeId: string;
  email: string | null;
  phone: string | null;
  name: string;
  storeId: string;
  tempPassword: string;
  invitedViaSupabase: boolean;
  // True only when phone was supplied AND the welcome SMS was sent. When false
  // (no phone, or carrier/Twilio failure), the owner should share tempPassword
  // manually — smsError carries the reason for failure cases.
  smsSent: boolean;
  smsError: string | null;
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
  activeStoreCount: number;
  billedStoreQuantity: number;
  unitAmountCents: number;
  priceId: string | null;
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

// Stripe Billing Portal — update card, view invoices, or cancel. Mints a
// per-customer session server-side; the caller redirects to the returned URL.
export async function openBillingPortal(token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/subscriptions/create-portal", token, {
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

// Self-service account deletion (Apple Guideline 5.1.1(v)). Returns whether
// the Stripe subscription was actively canceled — the caller can use that to
// reassure the user their billing is stopped.
export async function deleteMyAccount(
  token: string | undefined
): Promise<{ deleted: true; canceledStripeSub: boolean }> {
  return apiFetch("/auth/me", requireToken(token), { method: "DELETE" });
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

// ── Referrals / partner commissions (SUPER_ADMIN) ───────────────────────────

export interface PartnerRecord {
  id: string;
  name: string;
  contact: string | null;
  payoutDetails: string | null;
  refCode: string;
  commissionRate: number | null;
  active: boolean;
  scanCount: number;
  createdAt: string;
  referredOwnerCount?: number;
}

export interface CommissionRecord {
  id: string;
  partnerId: string;
  ownerId: string | null;
  stripeInvoiceId: string | null;
  period: string;
  rate: number;
  amount: number;
  currency: string;
  status: "PENDING" | "APPROVED" | "PAID" | "REVERSED";
  kind: "COMMISSION" | "ADJUSTMENT";
  note: string | null;
  payoutReference: string | null;
  createdAt: string;
  partner?: { id: string; name: string; refCode: string };
}

export interface PartnerFunnel {
  partner: PartnerRecord;
  funnel: {
    scanned: number;
    signedUp: number;
    inTrial: number;
    active: number;
    thisMonthPayout: number;
    lifetimeApprovedOrPaid: number;
  };
}

export async function listPartners(token: string): Promise<PartnerRecord[]> {
  return apiFetch<PartnerRecord[]>("/partners", token);
}

export async function createPartner(
  token: string,
  input: { name: string; contact?: string; payoutDetails?: string; commissionRate?: number }
): Promise<PartnerRecord> {
  return apiFetch<PartnerRecord>("/partners", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updatePartner(
  token: string,
  id: string,
  input: {
    name?: string;
    contact?: string;
    payoutDetails?: string;
    active?: boolean;
    commissionRate?: number | null;
  }
): Promise<PartnerRecord> {
  return apiFetch<PartnerRecord>(`/partners/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function getPartnerFunnel(token: string, id: string): Promise<PartnerFunnel> {
  return apiFetch<PartnerFunnel>(`/partners/${id}/funnel`, token);
}

export async function listCommissions(
  token: string,
  filter: { status?: string; period?: string; partnerId?: string } = {}
): Promise<CommissionRecord[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.period) params.set("period", filter.period);
  if (filter.partnerId) params.set("partnerId", filter.partnerId);
  const qs = params.toString();
  return apiFetch<CommissionRecord[]>(`/commissions${qs ? `?${qs}` : ""}`, token);
}

export async function getCommissionSummary(
  token: string,
  period?: string
): Promise<Record<string, { count: number; amount: number }>> {
  return apiFetch(`/commissions/summary${period ? `?period=${period}` : ""}`, token);
}

export async function updateCommissionStatus(
  token: string,
  id: string,
  status: "APPROVED" | "PAID" | "REVERSED",
  payoutReference?: string
): Promise<CommissionRecord> {
  return apiFetch<CommissionRecord>(`/commissions/${id}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status, payoutReference })
  });
}

export async function createCommissionAdjustment(
  token: string,
  input: { partnerId: string; amount: number; note: string; period?: string }
): Promise<CommissionRecord> {
  return apiFetch<CommissionRecord>("/commissions/adjustment", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getReferralSettings(
  token: string
): Promise<{ defaultCommissionRate: number; updatedAt: string }> {
  return apiFetch("/referral-settings", token);
}

export async function updateReferralSettings(
  token: string,
  defaultCommissionRate: number
): Promise<{ defaultCommissionRate: number; updatedAt: string }> {
  return apiFetch("/referral-settings", token, {
    method: "PATCH",
    body: JSON.stringify({ defaultCommissionRate })
  });
}
