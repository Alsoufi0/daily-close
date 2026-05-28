-- 006_store_assignments.sql
--
-- Reshape `employees` from "one row per user (a user IS an employee)" into
-- "one row per (user, store) pair (a user is ASSIGNED to a store)". This
-- unlocks two product requirements that the old shape blocked:
--   1. Owners closing any of their stores in parallel — previously a single
--      shared fake-employee row had to wander between stores (commit
--      e4922a1 papered over the immediate crash; this fixes the shape).
--   2. Real employees being assigned to multiple stores (the smoke-shop
--      operator who works Store #1 weekdays + Store #2 weekends).
--
-- Changes:
--   - employees.role        new enum-style column (default 'EMPLOYEE')
--                           values: 'OWNER' | 'EMPLOYEE' | 'MANAGER'
--   - employees.user_id     UNIQUE constraint dropped
--   - employees (user_id, store_id) gains a new UNIQUE — one assignment
--     per user per store, but a user CAN have many rows across stores
--   - daily_close.submitted_by_user_id  new FK to users(id), NOT NULL
--     for new rows. Captures "who actually submitted this close" without
--     the synthesised employee-row indirection.
--   - daily_close.employee_id           made nullable so future owner
--     closes don't need a fake employee row at all.
--
-- Backfill:
--   - Every existing employees row gets role='EMPLOYEE' (the default).
--   - For each store, insert an employees row linking the owner's user_id
--     with role='OWNER'. This makes "is user X assigned to store Y?" a
--     uniform single-table query regardless of role.
--   - Existing daily_close rows get submitted_by_user_id populated from
--     the existing employee.user_id link.
--
-- Safe properties:
--   - Forward-compatible: old code that still reads employee_id keeps
--     working (column is nullable but populated for all existing rows).
--   - Zero downtime: additive changes + backfill happen inside the same
--     transaction so partial state is impossible.
--   - Idempotent: `IF NOT EXISTS` everywhere, conditional backfill via
--     ON CONFLICT DO NOTHING. Safe to re-run.

begin;

-- ── employees: add role column ────────────────────────────────────────────
do $$ begin
  create type public.employee_role as enum ('OWNER', 'EMPLOYEE', 'MANAGER');
exception when duplicate_object then null;
end $$;

alter table public.employees
  add column if not exists role public.employee_role not null default 'EMPLOYEE';

-- ── employees: relax UNIQUE(user_id) → UNIQUE(user_id, store_id) ─────────
-- The constraint name varies by how the table was originally created;
-- find and drop whatever's there. Then add the composite uniqueness.
do $$
declare
  con_name text;
begin
  -- Find the UNIQUE constraint on employees(user_id) regardless of name.
  select c.conname into con_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'employees'
    and c.contype = 'u'
    and array_length(c.conkey, 1) = 1
    and c.conkey[1] = (
      select attnum from pg_attribute
      where attrelid = t.oid and attname = 'user_id'
    );
  if con_name is not null then
    execute format('alter table public.employees drop constraint %I', con_name);
  end if;
end $$;

create unique index if not exists employees_user_store_uniq
  on public.employees (user_id, store_id)
  where deleted_at is null;

-- ── daily_close: add submitted_by_user_id (nullable for now, backfilled) ─
alter table public.daily_close
  add column if not exists submitted_by_user_id text
    references public.users(id) on delete restrict;

create index if not exists daily_close_submitted_by_user_id_idx
  on public.daily_close (submitted_by_user_id);

-- Make employee_id nullable so new owner closes don't need a fake row.
alter table public.daily_close alter column employee_id drop not null;

-- ── BACKFILL ─────────────────────────────────────────────────────────────

-- daily_close.submitted_by_user_id ← employee.user_id (via existing FK)
update public.daily_close dc
   set submitted_by_user_id = e.user_id
  from public.employees e
 where dc.employee_id = e.id
   and dc.submitted_by_user_id is null;

-- For each store, create an OWNER assignment row for the owner's user.
-- Skip rows that already exist (ON CONFLICT covers the new composite
-- unique). Use the owner's user_id from the owners → users join.
insert into public.employees (id, user_id, store_id, role)
select
  gen_random_uuid()::text,
  o.user_id,
  s.id,
  'OWNER'::public.employee_role
from public.stores s
join public.owners o on o.id = s.owner_id
where s.deleted_at is null
  and not exists (
    select 1 from public.employees e
    where e.user_id = o.user_id and e.store_id = s.id
  );

-- ── Tighten: make submitted_by_user_id NOT NULL once backfilled ──────────
-- All existing daily_close rows now have submitted_by_user_id populated
-- (every row had an employee_id, and employee_id → employee.user_id).
-- Any row that's still NULL after the backfill is broken data we'd want
-- to know about anyway; the constraint will surface it.
alter table public.daily_close
  alter column submitted_by_user_id set not null;

commit;
