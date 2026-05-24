alter table public.owners
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_alerts_enabled boolean not null default false,
  add column if not exists whatsapp_reports_enabled boolean not null default false;
