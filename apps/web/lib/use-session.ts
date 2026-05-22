"use client";

import { useEffect, useState } from "react";
import type { SessionProfile } from "@smokeshop/shared/types";
import { ApiError, bootstrapOwner, getProfile, listStores, StoreRecord } from "./api-client";
import { createBrowserSupabase } from "./supabase-browser";
import { demoOwner } from "./mock-data";

const TOKEN_KEY = "smokeshop-token";

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
        // Token invalid -> drop into demo so the UI still works.
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(undefined);
        setProfile(demoProfile);
        setMode("demo");
        setError(err?.message || "Session expired");
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
