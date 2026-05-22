import { useEffect, useState } from "react";
import type { SessionProfile } from "@smokeshop/shared/types";
import { getProfile, listStores, StoreRecord } from "./api";

export interface MobileSession {
  loading: boolean;
  profile: SessionProfile | null;
  stores: StoreRecord[];
}

export function useSession(): MobileSession {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [stores, setStores] = useState<StoreRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, s] = await Promise.all([getProfile(), listStores()]);
      if (cancelled) return;
      setProfile(p);
      setStores(s);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, profile, stores };
}
