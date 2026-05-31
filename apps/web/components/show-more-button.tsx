"use client";

import { ChevronDown } from "lucide-react";

/**
 * Shared "Show more" control for capped long lists (see useShowMore). Renders
 * nothing when there's nothing left to reveal, so callers can drop it in
 * unconditionally.
 */
export function ShowMoreButton({
  hasMore,
  remaining,
  onShowMore,
  label = "Show more"
}: {
  hasMore: boolean;
  remaining: number;
  onShowMore: () => void;
  label?: string;
}) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      onClick={onShowMore}
      className="focus-ring mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-black text-ink/70 hover:bg-smoke"
    >
      <ChevronDown size={16} aria-hidden />
      {label} ({remaining})
    </button>
  );
}
