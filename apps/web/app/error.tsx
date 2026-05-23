"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in Sentry too when SENTRY_DSN is set.
    console.error("App error", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-warning">
        <AlertTriangle size={28} aria-hidden />
      </span>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-warning">Something broke</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
        We hit a snag loading that.
      </h1>
      <p className="mt-3 max-w-md text-base font-bold text-ink/65">
        Try refreshing. If it keeps happening, email{" "}
        <a className="underline" href="mailto:support@dailyclose.app">
          support@dailyclose.app
        </a>{" "}
        and we'll take a look.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs font-mono text-ink/40">ref: {error.digest}</p>
      ) : null}
      <button
        onClick={reset}
        className="focus-ring mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-leaf px-5 font-black text-white"
      >
        <RefreshCcw size={16} aria-hidden /> Try again
      </button>
    </main>
  );
}
