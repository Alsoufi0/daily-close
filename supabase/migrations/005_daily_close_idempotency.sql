-- 005_daily_close_idempotency.sql
--
-- Adds a client-generated idempotency key to daily_close to prevent duplicate
-- submissions from network retries, offline-queue replays, and accidental
-- double-taps. Nullable for backfill compatibility — rows that predate this
-- migration keep `idempotency_key = NULL` and remain valid.
--
-- The unique index is partial: it only enforces uniqueness for rows that
-- actually carry a key, so the many existing NULL rows do not collide.
--
-- Safe to re-run. Zero downtime: nullable add column + partial index.

alter table public.daily_close
  add column if not exists idempotency_key text;

create unique index if not exists daily_close_idempotency_key_uniq
  on public.daily_close (idempotency_key)
  where idempotency_key is not null;
