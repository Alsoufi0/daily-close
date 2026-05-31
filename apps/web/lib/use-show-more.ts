"use client";

import { useMemo, useState } from "react";

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
 * `slice(0, limit)` clamps naturally: if a filter shrinks the list below the
 * current limit, `visible` just shows the smaller set and `hasMore` goes false
 * (the button hides) — no reset needed. An earlier version reset the limit
 * whenever `items.length < limit`, which fired the instant you clicked "show
 * more" past the first page (limit > length) and snapped the list back to the
 * first page, so the rest never opened.
 */
export function useShowMore<T>(items: T[], step = 10) {
  const [limit, setLimit] = useState(step);

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
