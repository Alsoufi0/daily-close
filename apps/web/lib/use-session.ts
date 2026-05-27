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
        setToken(undefined);
        setProfile(undefined);
        setMode("demo");
        return;
      }

      setToken(stored);
      try {
        let p: SessionProfile;
        try {
          p = await getProfile(stored);
        } catch (err) {
          // First-time Supabase user with no public.users row yet → auto-bootstrap as owner
          if (err instanceof ApiError && err.status === 401 && /profile is not set up/i.test(err.message)) {
            p = await bootstrapOwner(stored);
          } else {
            throw err;
          }
        }
        const s = await listStores(stored).catch(() => []);
        if (cancelled) return;
        setProfile(p);
        setStores(s);
        setMode("production");
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
          if (typeof window !== "undefined" && window.location.pathname !== "/") {
            window.location.replace("/?expired=1");
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

  async function signOut() {
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
