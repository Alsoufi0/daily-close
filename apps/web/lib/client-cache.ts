"use client";

/**
 * Tiny stale-while-revalidate cache for client-fetched page data, backed by
 * sessionStorage. Components hydrate state from the cache for an instant paint,
 * then revalidate from the API and write the fresh value back — so navigating
 * between pages shows data immediately instead of a spinner on every visit.
 *
 * Keys are namespaced under "dc:cache:" so use-session's sign-out sweep (which
 * removes all "dc:" keys) clears them too, preventing cross-account leakage.
 */
const PREFIX = "dc:cache:";

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / disabled storage — caching is best-effort */
  }
}
