"use client";

import { useEffect } from "react";

export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    // Lazy-load so the bundle stays small when Sentry is disabled.
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NEXT_PUBLIC_NODE_ENV || "production",
          tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
          replaysOnErrorSampleRate: 1.0,
          replaysSessionSampleRate: 0
        });
      })
      .catch(() => {
        // Sentry failed to load; carry on without it.
      });
  }, []);
  return null;
}
