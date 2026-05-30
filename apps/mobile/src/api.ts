import "react-native-url-polyfill/auto";
import type {
  DailyCloseInput,
  OwnerDashboardSummary,
  ParsedPOSReport,
  SessionProfile
} from "@smokeshop/shared/types";
import * as SecureStore from "expo-secure-store";

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

export async function getToken() {
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
    throw new ApiError(response.status, text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export interface StoreRecord {
  id: string;
  storeName: string;
  // The store's own timezone + close time drive which business day a close
  // belongs to (see suggestBusinessDate). The /stores endpoint returns these;
  // optional here so the legacy fallback store objects still typecheck.
  timezone?: string;
  closeTime?: string;
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

export async function getOwnerDashboard(): Promise<OwnerDashboardSummary> {
  return apiFetch<OwnerDashboardSummary>("/dashboard/me/today");
}

export async function uploadReport(): Promise<ParsedPOSReport> {
  return apiFetch<ParsedPOSReport>("/daily-close/upload-report", {
    method: "POST",
    body: JSON.stringify({
      storeId: "store-1",
      fileName: "mobile-pos-report.jpg",
      contentType: "image/jpeg",
      imageUrl: "https://example.com/mobile-pos-report.jpg"
    })
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
