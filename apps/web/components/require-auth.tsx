"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Single source of truth for "must be signed in to see this page". Wraps any
 * page content and instantly redirects to / when no Supabase token is in
 * localStorage. Renders a small loading state during the check so users on
 * slow phones don't see a flash of content.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("smokeshop-token");
    if (!token) {
      // Keep the deep-link so we can bounce back after sign-in.
      const next = window.location.pathname + window.location.search;
      const back = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
      window.location.replace(`/${back}`);
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }
  return <>{children}</>;
}
