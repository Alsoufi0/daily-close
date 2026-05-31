"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Client-side "show more" for long lists. Lists in this app are fetched whole
 * (receipts, stores, history, employees), so on phones a busy store can render
 * dozens of rows and bury the useful ones. This caps the visible count and
 * reveals more in steps instead of paginating server-side.
 *
 * Usage:
 *   const { visible, hasMore, remaining, showMore } = useShowMore(rows, 10);
 *   {visible.map(...)}
 *   {hasMore && <button onClick={showMore}>Show {remaining} more</button>}
 *
 * The visible count resets to `step` whenever the list shrinks (e.g. a filter
 * narrows results) so the user never lands on a stale "show more" state, but is
 * preserved as the list grows from background refreshes/polling.
 */
export function useShowMore<T>(items: T[], step = 10) {
  const [limit, setLimit] = useState(step);

  // Reset to the first page when the underlying list gets shorter than what's
  // currently shown (filter change, items removed). Growing lists keep the
  // user's expanded view.
  useEffect(() => {
    if (items.length < limit) setLimit(step);
  }, [items.length, limit, step]);

  const visible = useMemo(() => items.slice(0, limit), [items, limit]);
  const hasMore = items.length > limit;
  const remaining = Math.max(0, items.length - limit);

  function showMore() {
    setLimit((n) => n + step);
  }

  function showAll() {
    setLimit(items.length);
  }

  return { visible, hasMore, remaining, showMore, showAll };
}
