-- 011_store_pause.sql
-- Per-store pause: a paused store is EXCLUDED from billing (not counted toward
-- the Stripe subscription quantity) and cannot be closed, but its data/history
-- is retained and it can be resumed at any time.
--
-- NULL = active (billed). Existing rows stay NULL, so billing is unchanged for
-- every current store — this is purely additive and safe to run on production.

alter table public.stores
  add column if not exists paused_at timestamptz;

create index if not exists stores_paused_at_idx on public.stores (paused_at);
