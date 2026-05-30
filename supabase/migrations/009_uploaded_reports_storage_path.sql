-- 009_uploaded_reports_storage_path.sql
--
-- Receipt thumbnails were breaking after 7 days because
-- uploaded_reports.image_url stored a Supabase signed URL with a fixed
-- 7-day TTL. After the URL expired the owner Receipts page rendered
-- broken images. Adding storage_path lets the API mint a fresh
-- short-lived signed URL at read time so receipts work forever.
--
-- storage_path is nullable: legacy rows uploaded before this column
-- existed only have the (now-expiring) signed URL. Backfill is
-- best-effort — we parse the path out of any signed URL whose shape
-- matches Supabase's pattern. Anything we can't parse stays NULL and
-- the API falls back to the stored (possibly stale) image_url.

alter table public.uploaded_reports
  add column if not exists storage_path text null;

-- Backfill: a Supabase signed URL looks like
--   https://<proj>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
-- Strip the prefix + bucket + query string to recover <path>.
-- substring(... from ...) returns NULL on no match, which is exactly
-- what we want (NULL → API falls back to image_url).
update public.uploaded_reports
  set storage_path = substring(
    image_url
    from '/storage/v1/object/sign/[^/]+/([^?]+)'
  )
  where storage_path is null
    and image_url like '%/storage/v1/object/sign/%';
