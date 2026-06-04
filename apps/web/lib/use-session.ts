"use client";

import { useEffect, useState } from "react";
import type { SessionProfile } from "@smokeshop/shared/types";
import { ApiError, bootstrapOwner, getProfile, listStores, StoreRecord } from "./api-client";
import { createBrowserSupabase } from "./supabase-browser";

export type SessionMode = "loading" | "production" | "demo";

export interface Session {
  mode: SessionMode;
  token?: string;
  profile?: SessionProfile;
  stores: StoreRecord[];
  error?: string;
  signOut: () => Promise<void>;
}

/**
 * Reads the current access_token from Supabase's session (audit fix #2).
 *
 * Pre-#2 this came from `localStorage["dailyclose-token"]`. That made the
 * JWT readable by any XSS / browser extension / 3rd-party script. Now the
 * source of truth is Supabase's cookie-backed session (refreshed by the
 * Next.js middleware on every request, refresh-token stays httpOnly). We
 * pull a fresh access_token in memory only when we need to make an API
 * call.
 */
async function readSessionToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const supabase = createBrowserSupabase();
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || undefined;
}

// Stale-while-revalidate cache for the session's profile + stores. Lets a page
// (re)mount paint the last-known data instantly instead of blocking ~2 API
// round-trips on every navigation. Stored per-tab (sessionStorage) and cleared
// on sign-out so it never leaks across accounts.
const SESSION_CACHE_KEY = "dc:session-cache:v1";

function readSessionCache(): { profile: SessionProfile; stores: StoreRecord[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    return raw ? (JSON.parse(raw) as { profile: SessionProfile; stores: StoreRecord[] }) : null;
  } catch {
    return null;
  }
}

function writeSessionCache(profile: SessionProfile, stores: StoreRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ profile, stores }));
  } catch {
    /* quota / disabled storage — caching is best-effort */
  }
}

function clearSessionCache(): void {
  if (typeof window === "undefined") return;
  try {
    // Clear every app cache entry (session + per-page data caches) so nothing
    // leaks across accounts when a different user signs in on the same tab.
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith("dc:")) window.sessionStorage.removeItem(key);
    }
  } catch {
    /* noop */
  }
}

export function useSession(): Session {
  const [mode, setMode] = useState<SessionMode>("loading");
  const [token, setToken] = useState<string | undefined>();
  const [profile, setProfile] = useState<SessionProfile | undefined>();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function reloadStores(currentToken: string) {
      const s = await listStores(currentToken).catch(() => []);
      if (!cancelled) setStores(s);
    }

    (async () => {
      const stored = await readSessionToken();
      if (cancelled) return;
      if (!stored) {
        // No session: render unauthenticated state so RequireAuth-style
        // guards bounce to the landing page. We never fabricate a demo
        // profile here (the demo backdoor was removed in fix #2).
        clearSessionCache();
        setToken(undefined);
        setProfile(undefined);
        setMode("demo");
        return;
      }

      setToken(stored);

      // Instant paint: show the last-known profile + stores immediately so
      // navigating between pages isn't blocked on the network. We still
      // revalidate below and overwrite with fresh data.
      const cached = readSessionCache();
      if (cached?.profile && !cancelled) {
        setProfile(cached.profile);
        setStores(cached.stores ?? []);
        setMode("production");
      }

      try {
        // Profile and stores are independent — fetch them in parallel instead
        // of one-after-the-other to cut a full round-trip off first load.
        const profilePromise = (async () => {
          try {
            return await getProfile(stored);
          } catch (err) {
            // First-time Supabase user with no public.users row yet → bootstrap.
            if (err instanceof ApiError && err.status === 401 && /profile is not set up/i.test(err.message)) {
              return await bootstrapOwner(stored);
            }
            throw err;
          }
        })();
        const [p, s] = await Promise.all([profilePromise, listStores(stored).catch(() => [])]);
        if (cancelled) return;
        setProfile(p);
        setStores(s);
        setMode("production");
        writeSessionCache(p, s);
      } catch (err: any) {
        if (cancelled) return;
        // Only bounce on hard auth rejection (Supabase says token is bad / expired).
        // Transient failures (API cold start, network blip) keep the session and
        // surface a banner instead.
        const isApiErr = err instanceof ApiError;
        const isAuthReject =
          isApiErr &&
          err.status === 401 &&
          /(invalid session|invalid jwt|jwt expired|missing bearer)/i.test(err.message);
        if (isAuthReject) {
          // Cookie cleanup happens via Supabase signOut; just trigger it.
          const supabase = createBrowserSupabase();
          if (supabase) {
            await supabase.auth.signOut().catch(() => {});
          }
          setToken(undefined);
          setProfile(undefined);
          setMode("demo");
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login?expired=1");
            return;
          }
        } else {
          // Keep the token, render production shell, show the error to the user.
          setMode("production");
        }
        setError(err?.message || "Could not load profile");
      }
    })();

    const onStoresChanged = () => {
      readSessionToken().then((currentToken) => {
        if (currentToken) reloadStores(currentToken);
      });
    };
    window.addEventListener("dailyclose:stores-changed", onStoresChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("dailyclose:stores-changed", onStoresChanged);
    };
  }, []);

  // Keep `token` in sync with Supabase's auto-refresh. Without this, useSession
  // captures the access_token on mount and the React state never updates when
  // Supabase rotates it (~every hour). Polls that fire on a stale token then
  // 401 and the user sees "Invalid session" after an idle period. Subscribing
  // to onAuthStateChange picks up TOKEN_REFRESHED, SIGNED_OUT, and similar
  // events so the in-memory token always matches the cookie-backed session.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "USER_UPDATED") &&
        nextSession?.access_token
      ) {
        setToken(nextSession.access_token);
      } else if (event === "SIGNED_OUT") {
        clearSessionCache();
        setToken(undefined);
        setProfile(undefined);
        setMode("demo");
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // Browsers throttle timers in background tabs, so Supabase's auto-refresh
  // can miss the rotation window. When the tab regains focus, force a fresh
  // read from the cookie-backed session — Supabase will refresh on demand
  // inside getSession() if the token is close to expiry.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      readSessionToken().then((latest) => {
        if (latest) setToken(latest);
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  async function signOut() {
    clearSessionCache();
    const supabase = createBrowserSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    window.location.href = "/";
  }

  return { mode, token, profile, stores, error, signOut };
}
