create table if not exists public.owner_whatsapp_preferences (
  owner_id text primary key references public.owners(id) on delete cascade,
  whatsapp_phone text,
  alerts_enabled boolean not null default false,
  close_alerts_enabled boolean not null default false,
  reports_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_whatsapp_preferences
  add column if not exists close_alerts_enabled boolean not null default false;
