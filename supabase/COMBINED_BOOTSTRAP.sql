create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('SUPER_ADMIN', 'STORE_OWNER', 'EMPLOYEE');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.close_status as enum ('PENDING', 'CLOSED', 'SHORT', 'OVER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_status as enum ('PENDING', 'SENT', 'FAILED', 'READ');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum ('PUSH', 'EMAIL', 'SMS');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  password text not null default '',
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.owners (
  id text primary key default gen_random_uuid()::text,
  user_id text not null unique references public.users(id) on delete cascade,
  subscription_plan text not null default 'PILOT'
);

create table if not exists public.stores (
  id text primary key default gen_random_uuid()::text,
  owner_id text not null references public.owners(id) on delete cascade,
  store_name text not null,
  address text,
  phone text,
  timezone text not null default 'America/New_York',
  close_time text not null default '23:30'
);

create table if not exists public.employees (
  id text primary key default gen_random_uuid()::text,
  user_id text not null unique references public.users(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade
);

create table if not exists public.daily_close (
  id text primary key default gen_random_uuid()::text,
  store_id text not null references public.stores(id) on delete cascade,
  employee_id text not null references public.employees(id),
  date date not null,
  cash_sales numeric(12,2) not null,
  card_sales numeric(12,2) not null,
  total_sales numeric(12,2) not null,
  tax numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  discounts numeric(12,2) not null default 0,
  lottery numeric(12,2),
  expected_cash numeric(12,2) not null,
  counted_cash numeric(12,2) not null,
  difference numeric(12,2) not null,
  expenses numeric(12,2) not null default 0,
  notes text,
  status public.close_status not null,
  created_at timestamptz not null default now(),
  unique(store_id, date)
);

create table if not exists public.expenses (
  id text primary key default gen_random_uuid()::text,
  store_id text not null references public.stores(id) on delete cascade,
  daily_close_id text references public.daily_close(id) on delete cascade,
  amount numeric(12,2) not null,
  category text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.uploaded_reports (
  id text primary key default gen_random_uuid()::text,
  daily_close_id text references public.daily_close(id) on delete set null,
  image_url text not null,
  parsed_json jsonb not null,
  parser_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  store_id text references public.stores(id) on delete cascade,
  type public.notification_type not null,
  message text not null,
  status public.notification_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  store_id text references public.stores(id) on delete cascade,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists stores_owner_id_idx on public.stores(owner_id);
create index if not exists daily_close_store_date_idx on public.daily_close(store_id, date);
create index if not exists daily_close_employee_id_idx on public.daily_close(employee_id);
create index if not exists notifications_user_status_idx on public.notifications(user_id, status);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at);
create index if not exists audit_logs_store_created_idx on public.audit_logs(store_id, created_at);

alter table public.users enable row level security;
alter table public.owners enable row level security;
alter table public.stores enable row level security;
alter table public.employees enable row level security;
alter table public.daily_close enable row level security;
alter table public.expenses enable row level security;
alter table public.uploaded_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_app_user_id()
returns text
language sql
stable
as $$
  select id from public.users where auth_user_id = auth.uid()
$$;

create or replace function public.current_owner_id()
returns text
language sql
stable
as $$
  select owners.id
  from public.owners
  join public.users on users.id = owners.user_id
  where users.auth_user_id = auth.uid()
$$;

create or replace function public.current_employee_store_id()
returns text
language sql
stable
as $$
  select employees.store_id
  from public.employees
  join public.users on users.id = employees.user_id
  where users.auth_user_id = auth.uid()
$$;

create policy "users can read own profile" on public.users
  for select using (auth_user_id = auth.uid());

create policy "owners can read own owner row" on public.owners
  for select using (user_id = public.current_app_user_id());

create policy "owners read their stores" on public.stores
  for select using (owner_id = public.current_owner_id());

create policy "employees read assigned store" on public.stores
  for select using (id = public.current_employee_store_id());

create policy "employees read own employee row" on public.employees
  for select using (user_id = public.current_app_user_id());

create policy "owners read employees for their stores" on public.employees
  for select using (
    exists (
      select 1 from public.stores
      where stores.id = employees.store_id
      and stores.owner_id = public.current_owner_id()
    )
  );

create policy "owners read closes for their stores" on public.daily_close
  for select using (
    exists (
      select 1 from public.stores
      where stores.id = daily_close.store_id
      and stores.owner_id = public.current_owner_id()
    )
  );

create policy "employees read own store closes" on public.daily_close
  for select using (store_id = public.current_employee_store_id());

create policy "employees insert own store closes" on public.daily_close
  for insert with check (store_id = public.current_employee_store_id());

create policy "owners read own notifications" on public.notifications
  for select using (user_id = public.current_app_user_id());

create policy "users read own audit logs" on public.audit_logs
  for select using (user_id = public.current_app_user_id());

insert into storage.buckets (id, name, public)
values ('pos-reports', 'pos-reports', false)
on conflict (id) do nothing;

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
-- Subscription fields on owners
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT NOT NULL DEFAULT 'TRIALING',
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMP,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT UNIQUE;

-- Default new pilots into a 14-day trial that starts now.
UPDATE owners
   SET trial_ends_at = NOW() + INTERVAL '14 days'
 WHERE trial_ends_at IS NULL;

-- Index for cron sweeps over expiring trials.
CREATE INDEX IF NOT EXISTS owners_trial_ends_at_idx ON owners (trial_ends_at);
insert into public.users (id, name, email, password, role)
values
  ('user-owner-demo', 'Sam Owner', 'owner@demo.com', '', 'STORE_OWNER'),
  ('user-employee-maya', 'Maya', 'maya@demo.com', '', 'EMPLOYEE'),
  ('user-employee-chris', 'Chris', 'chris@demo.com', '', 'EMPLOYEE')
on conflict (id) do nothing;

insert into public.owners (id, user_id, subscription_plan)
values ('owner-demo', 'user-owner-demo', 'PILOT')
on conflict (id) do nothing;

insert into public.stores (id, owner_id, store_name, address, phone, timezone, close_time)
values
  ('store-1', 'owner-demo', 'Store #1', '100 Main St', '555-0101', 'America/New_York', '23:30'),
  ('store-2', 'owner-demo', 'Store #2', '200 Main St', '555-0102', 'America/New_York', '23:30'),
  ('store-3', 'owner-demo', 'Store #3', '300 Main St', '555-0103', 'America/New_York', '23:30')
on conflict (id) do nothing;

insert into public.employees (id, user_id, store_id)
values
  ('employee-maya', 'user-employee-maya', 'store-1'),
  ('employee-chris', 'user-employee-chris', 'store-3')
on conflict (id) do nothing;

insert into public.daily_close (
  id, store_id, employee_id, date, cash_sales, card_sales, total_sales, tax,
  refunds, discounts, expected_cash, counted_cash, difference, expenses, notes, status
)
values
  ('close-store-1-today', 'store-1', 'employee-maya', current_date, 1800, 2700, 4500, 318, 0, 12, 1800, 1805, 5, 0, 'Pilot seed close', 'OVER'),
  ('close-store-3-today', 'store-3', 'employee-chris', current_date, 1500, 2400, 3900, 276, 0, 8, 1500, 1460, -40, 0, 'Register short', 'SHORT')
on conflict (store_id, date) do nothing;

insert into public.notifications (id, user_id, store_id, type, message, status)
values (
  'notification-store-2-missed',
  'user-owner-demo',
  'store-2',
  'EMAIL',
  'Store #2 has not completed closing yet.',
  'PENDING'
)
on conflict (id) do nothing;
