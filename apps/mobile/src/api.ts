import "react-native-url-polyfill/auto";
import type {
  DailyCloseInput,
  OwnerDashboardSummary,
  ParsedPOSReport,
  SessionProfile
} from "@smokeshop/shared/types";
import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const tokenKey = "dailyclose-token";

if (!apiUrl) {
  // Fail closed at module load — a build without EXPO_PUBLIC_API_URL used to
  // silently fall through to hardcoded demo data, which let bad/missing env
  // vars ship a fake-but-convincing UI to real users. We'd rather crash on the
  // import than show fabricated numbers.
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] EXPO_PUBLIC_API_URL is not set. Configure it in your EAS profile / Expo env before building."
  );
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(tokenKey, token);
}

// Create a new owner account (unauthenticated). Mirrors the web /signup flow.
// Verify-first signup: request a code (email via Resend, phone via Twilio),
// then confirm it — the account is created only on confirm.
export async function requestSignup(input: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
}): Promise<{ sent: boolean; channel: "email" | "phone"; message: string }> {
  return apiFetch("/auth/signup-owner/request", {
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
  return apiFetch("/auth/signup-owner/confirm", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

// Finish owner setup right after the first sign-in (authed via the live token).
export async function bootstrapOwner(name: string): Promise<SessionProfile> {
  return apiFetch<SessionProfile>("/auth/bootstrap-owner", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export async function getToken() {
  // Prefer the live Supabase session: getSession() auto-refreshes an expired
  // access token (as long as the refresh token is valid), so a long-running app
  // session never sends a stale JWT — which was causing "Invalid session / 401"
  // upload failures after the app sat open for a while. Fall back to the token
  // cached in SecureStore if Supabase isn't available.
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) return token;
    }
  } catch {
    /* fall through to the stored token */
  }
  return SecureStore.getItemAsync(tokenKey);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(tokenKey);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
  const token = await getToken();
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers
      }
    });
  } catch (err: any) {
    // fetch() itself rejected — network down, DNS failed, cert error, etc.
    // Coerce to ApiError(0) so callers (and the outbox queue) can detect
    // "this was an offline failure, queue it" vs. "real server response."
    throw new ApiError(0, err?.message || "Network request failed.");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, extractApiErrorMessage(text, response.statusText));
  }
  return response.json() as Promise<T>;
}

// API errors come back as JSON ({ message, error, statusCode }). Show the human
// `message` (or join an array of validation messages), never the raw blob.
function extractApiErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string" && message.trim()) return message;
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Non-JSON error bodies are still valid — show them as-is.
  }
  return text || fallback;
}

export async function requestPhonePasswordReset(phone: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/auth/phone-reset/request", {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function confirmPhonePasswordReset(input: {
  phone: string;
  code: string;
  password: string;
}): Promise<{ reset: true }> {
  return apiFetch<{ reset: true }>("/auth/phone-reset/confirm", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function requestPhoneLogin(phone: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/auth/phone-login/request", {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function confirmPhoneLogin(input: {
  phone: string;
  code: string;
}): Promise<{ tokenHash: string; type: "magiclink" }> {
  return apiFetch<{ tokenHash: string; type: "magiclink" }>("/auth/phone-login/confirm", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

// Add a phone for SMS sign-in — for owners who signed up with email and have no
// number on file. Authed (links to the signed-in account).
export async function getPhoneLoginStatus(): Promise<{ phone: string | null }> {
  return apiFetch<{ phone: string | null }>("/auth/phone-login/added");
}

export async function addPhoneLoginRequest(phone: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/auth/phone-login/add/request", {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}

export async function addPhoneLoginConfirm(input: { phone: string; code: string }): Promise<{ phone: string }> {
  return apiFetch<{ phone: string }>("/auth/phone-login/add/confirm", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export interface StoreRecord {
  id: string;
  storeName: string;
  // The store's own timezone + close time drive which business day a close
  // belongs to (see suggestBusinessDate). The /stores endpoint returns these;
  // optional here so the legacy fallback store objects still typecheck.
  timezone?: string;
  closeTime?: string;
  address?: string | null;
  phone?: string | null;
}

export async function getProfile(): Promise<SessionProfile> {
  return apiFetch<SessionProfile>("/auth/profile");
}

// Apple Guideline 5.1.1(v): the mobile app must support in-app account
// deletion. Cancels Stripe sub (for owners), cascades local data, and removes
// the Supabase auth user so sign-in is permanently blocked.
export async function deleteMyAccount(): Promise<{ deleted: true; canceledStripeSub: boolean }> {
  return apiFetch("/auth/me", { method: "DELETE" });
}

export async function listStores(): Promise<StoreRecord[]> {
  return apiFetch<StoreRecord[]>("/stores");
}

export interface CreateStoreInput {
  storeName: string;
  address?: string;
  phone?: string;
  timezone?: string;
  closeTime?: string;
}

export async function createStore(input: CreateStoreInput): Promise<StoreRecord> {
  return apiFetch<StoreRecord>("/stores", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateStore(
  id: string,
  input: Partial<CreateStoreInput>
): Promise<StoreRecord> {
  return apiFetch<StoreRecord>(`/stores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteStore(id: string): Promise<void> {
  await apiFetch<unknown>(`/stores/${id}`, { method: "DELETE" });
}

// ── Employees admin ────────────────────────────────────────────────────────

export interface EmployeeRow {
  id: string; // assignment id (one user can have many)
  storeId: string;
  role?: "EMPLOYEE" | "MANAGER";
  user?: { id: string; name: string; email?: string; phone?: string; role: "STORE_OWNER" | "EMPLOYEE" };
  store?: { id: string; storeName: string };
}

export async function listEmployees(): Promise<EmployeeRow[]> {
  return apiFetch<EmployeeRow[]>("/employees");
}

export async function inviteEmployee(input: {
  name: string;
  storeId: string;
  email?: string;
  phone?: string;
  consent?: { granted: boolean; text: string };
}): Promise<{
  id: string;
  employeeId: string;
  email: string | null;
  phone: string | null;
  name: string;
  storeId: string;
  tempPassword: string;
  invitedViaSupabase: boolean;
  smsSent: boolean;
  smsError: string | null;
}> {
  return apiFetch("/employees/invite", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function resetEmployeePassword(
  employeeId: string
): Promise<{ employeeId: string; email: string; tempPassword: string; reset: boolean }> {
  return apiFetch(`/employees/${employeeId}/reset-password`, { method: "POST" });
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await apiFetch<unknown>(`/employees/${employeeId}`, { method: "DELETE" });
}

export async function assignEmployeeToStore(
  employeeId: string,
  storeId: string
): Promise<{ employeeId: string; userId: string; storeId: string; alreadyAssigned: boolean }> {
  return apiFetch(`/employees/${employeeId}/assignments`, {
    method: "POST",
    body: JSON.stringify({ storeId })
  });
}

export async function setEmployeeAdminAccess(
  employeeId: string,
  isAdmin: boolean
): Promise<{ employeeId: string; userId: string; role: "STORE_OWNER" | "EMPLOYEE"; isAdmin: boolean }> {
  return apiFetch(`/employees/${employeeId}/admin-access`, {
    method: "PATCH",
    body: JSON.stringify({ isAdmin })
  });
}

export async function setEmployeeManagerStores(
  userId: string,
  storeIds: string[]
): Promise<{ userId: string; managedStoreIds: string[] }> {
  return apiFetch(`/employees/by-user/${userId}/manager-stores`, {
    method: "PATCH",
    body: JSON.stringify({ storeIds })
  });
}

// ── Reports / Receipts ─────────────────────────────────────────────────────

export interface ReceiptRow {
  id: string;
  imageUrl: string;
  storeName: string;
  closeDate: string;
  employeeName: string;
  kind: "close" | "expense";
  parsedJson: unknown;
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

export async function listReceipts(filters: {
  storeId: string;
  from?: string;
  to?: string;
}): Promise<ReceiptRow[]> {
  const params = new URLSearchParams();
  params.set("storeId", filters.storeId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return apiFetch<ReceiptRow[]>(`/reports/receipts?${params.toString()}`);
}

/**
 * Returns the bulk-receipts ZIP URL + auth header so the caller can hand
 * it to expo-file-system's downloadAsync. We can't use apiFetch here
 * because it always JSON-parses; this endpoint returns a binary ZIP.
 */
export async function getReceiptsZipDownloadInfo(filters: {
  storeId: string;
  from?: string;
  to?: string;
}): Promise<{ url: string; headers: Record<string, string> }> {
  const token = await getToken();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("API URL not configured.");
  if (!token) throw new Error("Not signed in.");
  const params = new URLSearchParams();
  params.set("storeId", filters.storeId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return {
    url: `${apiUrl}/reports/receipts/download?${params.toString()}`,
    headers: { Authorization: `Bearer ${token}` }
  };
}

// CSV/PDF close-report export. storeId is optional — omit it to export ALL the
// owner's stores. Dates are REQUIRED and explicit (yyyy-MM-dd): the backend
// treats a missing date as "today", which would silently export an empty report.
export async function getReportExportDownloadInfo(
  type: "csv" | "pdf",
  filters: { storeId?: string; from: string; to: string }
): Promise<{ url: string; headers: Record<string, string> }> {
  const token = await getToken();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("API URL not configured.");
  if (!token) throw new Error("Not signed in.");
  const params = new URLSearchParams();
  if (filters.storeId) params.set("storeId", filters.storeId);
  params.set("from", filters.from);
  params.set("to", filters.to);
  return {
    url: `${apiUrl}/reports/export.${type}?${params.toString()}`,
    headers: { Authorization: `Bearer ${token}` }
  };
}

// ── WhatsApp settings ──────────────────────────────────────────────────────

export interface WhatsAppSettings {
  whatsappPhone: string | null;
  whatsappAlertsEnabled: boolean;
  whatsappCloseAlertsEnabled: boolean;
  whatsappReportsEnabled: boolean;
}

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  return apiFetch<WhatsAppSettings>("/notifications/whatsapp-settings");
}

export async function updateWhatsAppSettings(
  input: WhatsAppSettings
): Promise<WhatsAppSettings> {
  return apiFetch<WhatsAppSettings>("/notifications/whatsapp-settings", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function sendWhatsAppTest(): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/notifications/whatsapp-settings/test", {
    method: "POST"
  });
}

export async function getOwnerDashboard(): Promise<OwnerDashboardSummary> {
  return apiFetch<OwnerDashboardSummary>("/dashboard/me/today");
}

// Send the real receipt image (preprocessed JPEG base64) to the API, which
// stores it with the service key and runs OCR — same contract the web app
// uses. Replaces the old stub that posted a hardcoded fake image, and removes
// the need for the phone to touch Supabase Storage directly (which RLS blocks).
export async function uploadReport(
  storeId: string,
  base64Data: string,
  fileName = "pos-report.jpg",
  contentType = "image/jpeg",
  kind: "close" | "expense" = "close"
): Promise<ParsedPOSReport & { kind?: "close" | "expense"; amount?: number | null }> {
  // The API's storage + OCR pipeline expect a data: URL (that's what the web
  // app sends). expo-image-manipulator returns RAW base64, so wrap it — without
  // the data: prefix the OCR step tries to fetch() the raw base64 as a URL,
  // fails, and OCR comes back empty (the "always zeros" bug).
  const dataUrl = base64Data.startsWith("data:")
    ? base64Data
    : `data:${contentType};base64,${base64Data}`;
  return apiFetch("/daily-close/upload-report", {
    method: "POST",
    body: JSON.stringify({ storeId, fileName, contentType, base64Data: dataUrl, kind })
  });
}

/**
 * Generate a client-side idempotency key. Used to dedupe `/daily-close/finish`
 * submissions across network retries, offline-queue replays, and accidental
 * double-taps. The caller is responsible for re-using the same key when
 * retrying the SAME logical submission — generating a fresh key on every
 * call defeats the purpose. See finishClose's `idempotencyKey` parameter.
 */
export function generateIdempotencyKey(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback for runtimes without crypto.randomUUID (older Hermes, etc.).
  return `dc-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Heuristic: was this an offline / network-class failure (worth queueing)
 * vs. a real server rejection (worth surfacing)?
 *
 * status 0 = `fetch` itself failed (TypeError "Network request failed").
 * status 408 / 429 / 502 / 503 / 504 = retry-class server responses.
 * Anything else (400, 401, 403, 422, 500-with-body) = real error, do not
 * queue — the user needs to fix the input or sign in again.
 */
function isQueueableFailure(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 0) return true;
  return [408, 429, 502, 503, 504].includes(err.status);
}

// Up-front check: is this store already closed for the chosen date? `date` is
// the same UTC-noon ISO sent to /finish.
export async function checkCloseExists(storeId: string, date: string): Promise<{ closed: boolean }> {
  const params = new URLSearchParams({ storeId, date });
  return apiFetch<{ closed: boolean }>(`/daily-close/exists?${params.toString()}`);
}

export async function finishClose(input: DailyCloseInput, idempotencyKey?: string) {
  const key = idempotencyKey || generateIdempotencyKey();
  // Import lazily to avoid a circular dep with outbox.ts (outbox imports
  // generateIdempotencyKey from this module).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { enqueue, QueuedForRetryError } = require("./outbox") as typeof import("./outbox");
  try {
    return await apiFetch("/daily-close/finish", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(input)
    });
  } catch (err) {
    if (isQueueableFailure(err)) {
      // Offline / transient — persist for retry. The handler registered
      // in registerOutboxHandlers() below will replay with the same key
      // so the server dedupes.
      const op = await enqueue({
        type: "finishClose",
        payload: { input, idempotencyKey: key }
      });
      throw new QueuedForRetryError(op.id);
    }
    throw err;
  }
}

/**
 * Wire the outbox queue's "finishClose" handler. Must be called once on app
 * start (App.tsx does this) before the queue can drain. Kept here so the
 * actual network call lives next to the rest of the API surface.
 */
export function registerOutboxHandlers() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerHandler } = require("./outbox") as typeof import("./outbox");
  registerHandler("finishClose", async (payload) => {
    const typed = payload as { input: DailyCloseInput; idempotencyKey: string };
    // No try/catch — let errors bubble up so the queue can retry.
    await apiFetch("/daily-close/finish", {
      method: "POST",
      headers: { "Idempotency-Key": typed.idempotencyKey },
      body: JSON.stringify(typed.input)
    });
  });
}

export async function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}
