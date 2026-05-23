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
  const token = await getToken();
  if (!apiUrl) throw new ApiError(0, "API URL is not configured.");
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

export async function getProfile(): Promise<SessionProfile | null> {
  if (!apiUrl) return null;
  try {
    return await apiFetch<SessionProfile>("/auth/profile");
  } catch {
    return null;
  }
}

export async function listStores(): Promise<StoreRecord[]> {
  if (!apiUrl) return [];
  try {
    return await apiFetch<StoreRecord[]>("/stores");
  } catch {
    return [];
  }
}

export function demoDashboard(): OwnerDashboardSummary {
  return {
    date: new Date().toISOString().slice(0, 10),
    storesClosed: 2,
    totalStores: 3,
    totalSales: 8400,
    missingCash: -40,
    needsAttention: 2,
    stores: [
      { id: "store-1", storeName: "Store #1", closedToday: true, totalSales: 4500, cashSales: 1800, cardSales: 2700, difference: 5 },
      { id: "store-2", storeName: "Store #2", closedToday: false, totalSales: 0, cashSales: 0, cardSales: 0, difference: 0 },
      { id: "store-3", storeName: "Store #3", closedToday: true, totalSales: 3900, cashSales: 1500, cardSales: 2400, difference: -40 }
    ],
    alerts: [
      {
        id: "alert-1",
        storeId: "store-2",
        message: "Store #2 has not completed closing yet.",
        status: "PENDING",
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export async function getOwnerDashboard(): Promise<OwnerDashboardSummary> {
  if (!apiUrl) return demoDashboard();
  return apiFetch<OwnerDashboardSummary>("/dashboard/me/today");
}

export async function uploadReport(): Promise<ParsedPOSReport> {
  if (!apiUrl) {
    return {
      parserType: "CLOVER",
      cashSales: 2430,
      cardSales: 3120,
      totalSales: 5550,
      tax: 412,
      refunds: 0,
      discounts: 35,
      confidence: 0.97
    };
  }
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
  if (!apiUrl) return { ok: true };
  return apiFetch("/daily-close/finish", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function markNotificationRead(id: string) {
  if (!apiUrl) return;
  return apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}
