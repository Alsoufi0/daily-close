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
  const response = await fetch(`${apiUrl}${path}`, {
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

export interface StoreRecord {
  id: string;
  storeName: string;
}

export async function getProfile(): Promise<SessionProfile> {
  return apiFetch<SessionProfile>("/auth/profile");
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

export async function finishClose(input: DailyCloseInput) {
  return apiFetch("/daily-close/finish", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}
