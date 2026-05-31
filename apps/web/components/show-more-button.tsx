"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

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

export function ListRevealControls({
  hasMore,
  canShowLess,
  remaining,
  onShowMore,
  onShowLess,
  showMoreLabel = "Show more",
  showLessLabel = "Show less"
}: {
  hasMore: boolean;
  canShowLess: boolean;
  remaining: number;
  onShowMore: () => void;
  onShowLess: () => void;
  showMoreLabel?: string;
  showLessLabel?: string;
}) {
  if (!hasMore && !canShowLess) return null;
  return (
    <div className="mt-2 grid gap-2 sm:flex sm:items-center">
      {hasMore ? (
        <button
          type="button"
          onClick={onShowMore}
          className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-black text-ink/70 hover:bg-smoke"
        >
          <ChevronDown size={16} aria-hidden />
          {showMoreLabel} ({remaining})
        </button>
      ) : null}
      {canShowLess ? (
        <button
          type="button"
          onClick={onShowLess}
          className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-black text-ink/70 hover:bg-smoke"
        >
          <ChevronUp size={16} aria-hidden />
          {showLessLabel}
        </button>
      ) : null}
    </div>
  );
}
