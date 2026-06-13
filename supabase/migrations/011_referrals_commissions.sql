-- Referral attribution + recurring commission tracking.
--
-- Sales distributors ("partners") spread the word via a QR code that encodes
-- .../r/{ref_code}. When a store owner signs up through that link we stamp the
-- partner onto the owner ONCE (first-touch, never reassigned). From then on,
-- every REAL Stripe payment the owner makes mints a commission row for the
-- partner. Refunds/chargebacks reverse the matching row; churn simply stops
-- future rows (no invoice fires, so nothing is created).
--
-- Attribution lives on the OWNER (the billable account), not the store:
-- the account is created at signup before any store exists, and Stripe bills
-- one subscription per owner covering all of their stores.
--
-- Additive only. No existing data is modified or dropped. A documented
-- ROLLBACK block lives at the bottom of this file.

create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.commission_status as enum ('PENDING', 'APPROVED', 'PAID', 'REVERSED');
exception when duplicate_object then null;
end $$;

do $$ begin
  -- COMMISSION rows are auto-minted from a Stripe invoice. ADJUSTMENT rows are
  -- entered by an admin (bonus = positive amount, clawback = negative) so the
  -- payout ledger can be reconciled by hand when needed.
  create type public.commission_kind as enum ('COMMISSION', 'ADJUSTMENT');
exception when duplicate_object then null;
end $$;

-- ── partners ────────────────────────────────────────────────────────────────
create table if not exists public.partners (
  id              text primary key default gen_random_uuid()::text,
  name            text not null,
  contact         text,
  payout_details  text,
  -- Short, random, non-sequential code. Generated in the API from an alphabet
  -- that excludes ambiguous characters (no O/0/I/1). Never regenerated once set.
  ref_code        text not null unique,
  -- Per-partner override of the platform default rate. NULL = use the default
  -- from app_settings at the moment a commission is created.
  commission_rate numeric(5, 4),
  active          boolean not null default true,
  -- Raw count of QR/link visits (top of the funnel). Incremented by the public
  -- /referrals/r/:code resolve endpoint. Not deduplicated — a rough reach
  -- number, distinct from attributed signups (owners.referred_by_partner_id).
  scan_count      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ── owners.referred_by_partner_id (first-touch attribution) ─────────────────
alter table public.owners
  add column if not exists referred_by_partner_id text
    references public.partners(id) on delete set null;

create index if not exists owners_referred_by_partner_idx
  on public.owners (referred_by_partner_id);

-- ── commissions ─────────────────────────────────────────────────────────────
create table if not exists public.commissions (
  id                text primary key default gen_random_uuid()::text,
  partner_id        text not null references public.partners(id) on delete cascade,
  -- Set for COMMISSION rows (the paying account). NULL for partner-level
  -- ADJUSTMENT rows. ON DELETE SET NULL preserves the payout ledger even if an
  -- owner account is later removed — the money owed to the partner still stands.
  owner_id          text references public.owners(id) on delete set null,
  -- Set for COMMISSION rows; the Stripe invoice that triggered this row. Unique
  -- (when present) so webhook retries are idempotent. NULL for ADJUSTMENT rows.
  stripe_invoice_id text,
  -- Billing period label, e.g. '2026-06', for grouping the payout queue.
  period            text not null,
  -- Snapshot of the rate used, so later changes to the default / override never
  -- rewrite history.
  rate              numeric(5, 4) not null,
  -- Commission amount in the invoice currency. Can be negative for an
  -- ADJUSTMENT clawback.
  amount            numeric(12, 2) not null,
  currency          text not null default 'usd',
  -- The invoice amount (in cents) this commission was computed from. Audit aid
  -- for reconciliation. NULL for adjustments.
  source_amount_cents integer,
  status            public.commission_status not null default 'PENDING',
  kind              public.commission_kind   not null default 'COMMISSION',
  -- Free-text reason for ADJUSTMENT rows / general note.
  note              text,
  -- Set when the row is marked PAID.
  payout_reference  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Idempotency: at most one COMMISSION row per Stripe invoice, so webhook
-- retries don't double-pay. Postgres treats NULLs as distinct, so ADJUSTMENT
-- rows (NULL invoice) still coexist freely. Named to match Prisma's @unique so
-- the ORM schema and the DB stay drift-free.
create unique index if not exists commissions_stripe_invoice_id_key
  on public.commissions (stripe_invoice_id);

create index if not exists commissions_partner_status_idx
  on public.commissions (partner_id, status);
create index if not exists commissions_owner_idx
  on public.commissions (owner_id);
create index if not exists commissions_period_idx
  on public.commissions (period);

-- ── app_settings (single-row platform settings) ─────────────────────────────
create table if not exists public.app_settings (
  -- Enforced single row: the API always reads/writes id = 'global'.
  id                      text primary key default 'global',
  default_commission_rate numeric(5, 4) not null default 0.2500,
  updated_at              timestamptz not null default now(),
  constraint app_settings_singleton check (id = 'global')
);

insert into public.app_settings (id, default_commission_rate)
values ('global', 0.2500)
on conflict (id) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- These tables hold partner PII + payout money and must NEVER be visible to
-- store owners or employees. RLS is enabled with NO policies, so every
-- anon/authenticated query is denied; only the API's service-role connection
-- (which bypasses RLS) can touch them. This matches the posture in 001.
alter table public.partners    enable row level security;
alter table public.commissions enable row level security;
alter table public.app_settings enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (reverse this migration). Run manually if needed — additive changes,
-- so reversing only drops what this file added and restores the prior state.
--
--   drop table if exists public.commissions;
--   drop table if exists public.app_settings;
--   alter table public.owners drop column if exists referred_by_partner_id;
--   drop table if exists public.partners;
--   drop type if exists public.commission_kind;
--   drop type if exists public.commission_status;
-- ─────────────────────────────────────────────────────────────────────────────
