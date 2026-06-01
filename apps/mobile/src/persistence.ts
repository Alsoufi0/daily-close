import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ParsedPOSReport } from "@dailyclose/shared/types";

/**
 * Offline persistence for the in-progress daily close (audit fix #5).
 *
 * Smoke shops have flaky Wi-Fi. Before this layer, an employee who killed
 * the app mid-close — phone restart, crash, accidentally tapped Home —
 * lost everything and had to start over. Now we mirror the live close
 * state to AsyncStorage on every change and restore it on cold start.
 *
 * Why AsyncStorage and not MMKV (the audit's recommendation):
 *   - MMKV needs a native module + custom Expo dev client / prebuild.
 *     AsyncStorage works in Expo Go AND EAS builds out of the box.
 *   - This isn't a hot path (writes happen on user interaction, not in
 *     render loops). The ~5ms vs sub-ms perf delta doesn't matter.
 *   - Easy to swap later if perf ever becomes the bottleneck.
 */

const KEY = "dailyclose:close-in-progress";

export type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "done" | "blocked";

export interface PersistedExpenseRow {
  id: string;
  category: string;
  amount: string;
  description?: string;
}

export interface PersistedCloseDraft {
  schemaVersion: 2;
  step: Step;
  storeId: string;
  report: ParsedPOSReport;
  cashCounted: string;
  safeDrop: string;
  // Itemized expenses (multi-line). Old v1 drafts with a flat `expenses`
  // string are dropped on read (loadDraft returns null for any non-v2 row).
  expenseItems: PersistedExpenseRow[];
  notes: string;
  // Same idempotency key the in-flight finishClose call uses, so a
  // resumed-and-resubmitted close hits the server's dedup correctly.
  idempotencyKey: string;
  savedAt: number; // ms epoch — used to discard ancient drafts
}

const STALE_DRAFT_MS = 1000 * 60 * 60 * 24; // 24h — drafts older than a day are likely abandoned

export async function saveDraft(draft: Omit<PersistedCloseDraft, "schemaVersion" | "savedAt">): Promise<void> {
  try {
    const payload: PersistedCloseDraft = {
      schemaVersion: 2,
      ...draft,
      savedAt: Date.now()
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Persistence is best-effort; never let it break the live UI.
  }
}

export async function loadDraft(): Promise<PersistedCloseDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCloseDraft;
    if (parsed.schemaVersion !== 2) {
      // Old (or future) schema — drop it so the live UI starts fresh and
      // never tries to interpret a foreign shape.
      await clearDraft();
      return null;
    }
    if (Date.now() - parsed.savedAt > STALE_DRAFT_MS) {
      // Drop stale drafts; the close window has long passed.
      await clearDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ── Active-store selection (Phase 3 / multi-store assignments) ────────────
//
// An employee can be assigned to multiple stores. The mobile app needs to
// know WHICH store they're closing for right now. The picker on the close
// screen lets the user choose; we persist the selection across launches
// so they don't have to re-pick every shift.

const SELECTED_STORE_KEY = "dailyclose:selected-store-id";

export async function saveSelectedStoreId(storeId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SELECTED_STORE_KEY, storeId);
  } catch {
    /* persistence is best-effort */
  }
}

export async function loadSelectedStoreId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SELECTED_STORE_KEY);
  } catch {
    return null;
  }
}
