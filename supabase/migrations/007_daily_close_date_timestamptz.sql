-- 007_daily_close_date_timestamptz.sql
--
-- Fix: daily_close.date was created as a Postgres `date` (date-only) in
-- 001_production_schema.sql, but the application has always treated it as a
-- full timestamp. The close-guard (daily-close.service.ts) and the dashboard
-- (dashboard.service.ts) compute a store's LOCAL calendar day as a pair of
-- UTC instants (storeLocalDayRange) and range-query `date BETWEEN start AND end`.
--
-- Against a date-only column, Postgres coerces those timestamp bounds DOWN to
-- dates, so e.g. a guard range starting `2026-05-28T04:00:00Z` collapses to
-- `2026-05-28`, which then matches a close that was stored as `2026-05-28`
-- (a late-night close from the *previous* business day, truncated to its UTC
-- date). Result: the dashboard correctly shows the store as "needs closing"
-- today (it filters in JS with full precision), but the close endpoint rejects
-- the close as "already closed for this date". The two disagree because one
-- comparison happens in date-truncated Postgres and the other in full-precision
-- JS. This is audit item #7 (dual-schema drift) surfacing in production.
--
-- Fix: convert the column to `timestamptz` so it matches every other timestamp
-- column in the schema (all `created_at`s are timestamptz) and matches what the
-- Prisma model + day-range code have always assumed.
--
-- Existing rows: their original time-of-day was already lost to the date
-- truncation, so we interpret each stored date as UTC midnight. New closes
-- (post-deploy) store the real submission instant and are fully correct.
--
-- Idempotent: only alters when the column is still `date`. Safe to re-run and
-- safe if a future environment was built with the column already as timestamptz.

do $$
declare
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'daily_close'
    and column_name = 'date';

  if col_type = 'date' then
    alter table public.daily_close
      alter column date type timestamptz
      using (date::timestamp at time zone 'UTC');
  end if;
end $$;
