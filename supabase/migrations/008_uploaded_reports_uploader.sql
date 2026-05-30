-- 008_uploaded_reports_uploader.sql
--
-- Track which user uploaded each POS report so the owner Receipts page can
-- show "uploaded by Maya". Pre-008 the link from receipt → user was indirect
-- (uploaded_reports.daily_close_id → daily_close.submitted_by_user_id) and
-- only existed once a close had been finished — orphan uploads had no
-- attribution at all. Adding a direct, nullable FK lets us:
--   1. Stamp the uploader at upload time (before the close exists).
--   2. Backfill historical rows from the joined close where possible.
--
-- Nullable because storage uploads can predate the user/close relationship
-- (e.g. demo seed data) and because we want a soft FK that doesn't reject
-- legacy rows.

alter table public.uploaded_reports
  add column if not exists uploaded_by_user_id text null references public.users(id);

alter table public.uploaded_reports
  add column if not exists store_id text null references public.stores(id);

update public.uploaded_reports ur
  set uploaded_by_user_id = dc.submitted_by_user_id
  from public.daily_close dc
  where ur.daily_close_id = dc.id
    and ur.uploaded_by_user_id is null;

update public.uploaded_reports ur
  set store_id = dc.store_id
  from public.daily_close dc
  where ur.daily_close_id = dc.id
    and ur.store_id is null;

create index if not exists uploaded_reports_uploader_idx
  on public.uploaded_reports(uploaded_by_user_id);

create index if not exists uploaded_reports_store_idx
  on public.uploaded_reports(store_id);

create index if not exists uploaded_reports_created_at_idx
  on public.uploaded_reports(created_at desc);
