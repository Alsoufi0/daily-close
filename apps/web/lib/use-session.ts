"use client";

import { useEffect, useState } from "react";
import type { SessionProfile } from "@smokeshop/shared/types";
import { ApiError, bootstrapOwner, getProfile, listStores, StoreRecord } from "./api-client";
import { createBrowserSupabase } from "./supabase-browser";
import { demoOwner } from "./mock-data";

const TOKEN_KEY = "dailyclose-token";

export type SessionMode = "loading" | "production" | "demo";

export interface Session {
  mode: SessionMode;
  token?: string;
  profile?: SessionProfile;
  stores: StoreRecord[];
  error?: string;
  signOut: () => Promise<void>;
}

function readToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(TOKEN_KEY) || undefined;
}

const demoProfile: SessionProfile = {
  id: demoOwner.id,
  name: demoOwner.name,
  email: demoOwner.email,
  role: "STORE_OWNER",
  ownerId: demoOwner.id
};

export function useSession(): Session {
  const [mode, setMode] = useState<SessionMode>("loading");
  const [token, setToken] = useState<string | undefined>();
  const [profile, setProfile] = useState<SessionProfile | undefined>();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const stored = readToken();
    if (!stored) {
      setMode("demo");
      setProfile(demoProfile);
      return;
    }

    setToken(stored);
    (async () => {
      try {
        let p: SessionProfile;
        try {
          p = await getProfile(stored);
        } catch (err) {
          // First-time Supabase user with no public.users row yet -> auto-bootstrap as owner
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
        // surface a banner instead — otherwise a slow Render dyno looks like an
        // expired login to the user.
        const isApiErr = err instanceof ApiError;
        const isAuthReject =
          isApiErr &&
          err.status === 401 &&
          /(invalid session|invalid jwt|jwt expired|missing bearer)/i.test(err.message);
        if (isAuthReject) {
          window.localStorage.removeItem(TOKEN_KEY);
          setToken(undefined);
          if (typeof window !== "undefined" && window.location.pathname !== "/" && !window.location.pathname.startsWith("/demo")) {
            window.location.replace("/?expired=1");
            return;
          }
          setProfile(demoProfile);
          setMode("demo");
        } else {
          // Keep the token, render production shell, show the error to the user.
          setMode("production");
        }
        setError(err?.message || "Could not load profile");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    window.localStorage.removeItem(TOKEN_KEY);
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
