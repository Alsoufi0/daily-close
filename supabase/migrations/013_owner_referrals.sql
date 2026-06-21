-- Owner→owner "refer a friend" program.
--
-- Distinct from the partner/distributor commission system (migration 011, where
-- external partners earn recurring CASH on owners they bring in). Here an
-- existing OWNER refers another owner; when the new owner makes their FIRST real
-- payment, the referrer earns ACCOUNT CREDIT (free store-months) — never cash.
--
-- Reward model (agreed 2026-06-20): the referrer's reward mirrors the new
-- owner's first payment — one free store-month per store the new owner paid for
-- (N × the per-store price). It is applied as a Stripe customer-balance credit on
-- the referrer's account, which rolls over to future invoices natively. It
-- reverses if the new owner's first payment is refunded/charged back.
--
-- Additive only. No existing data is modified or dropped. ROLLBACK block at the
-- bottom of this file.

create extension if not exists pgcrypto;

-- ── Enum ─────────────────────────────────────────────────────────────────────
do $$ begin
  -- PENDING  → reward earned, credit not yet on the referrer's Stripe balance
  --            (e.g. the referrer has no Stripe customer yet — still a trial user)
  -- APPLIED  → credit posted to the referrer's Stripe customer balance
  -- REVERSED → clawed back because the new owner's first payment refunded/disputed
  create type public.referral_reward_status as enum ('PENDING', 'APPLIED', 'REVERSED');
exception when duplicate_object then null;
end $$;

-- ── owners: each owner's own shareable code + who referred them ──────────────
-- referral_code is generated lazily by the API the first time an owner views
-- their referral info, from the same unambiguous alphabet partner codes use.
alter table public.owners
  add column if not exists referral_code text;

-- referred_by_owner_id: first-touch attribution. Stamped ONCE at signup, never
-- reassigned. ON DELETE SET NULL so removing the referrer never blocks the
-- referred account (the reward ledger keeps its own copy of the ids).
alter table public.owners
  add column if not exists referred_by_owner_id text
    references public.owners(id) on delete set null;

-- Unique only among non-null codes (Postgres treats NULLs as distinct), so the
-- many owners without a code yet coexist freely.
create unique index if not exists owners_referral_code_key
  on public.owners (referral_code);

create index if not exists owners_referred_by_owner_idx
  on public.owners (referred_by_owner_id);

-- ── referral_rewards (the owner→owner credit ledger) ────────────────────────
create table if not exists public.referral_rewards (
  id                   text primary key default gen_random_uuid()::text,
  -- The owner who EARNS the credit (the referrer, "A"). Cascade: if this account
  -- is deleted, an unspent credit is moot.
  referrer_owner_id    text not null references public.owners(id) on delete cascade,
  -- The new owner whose first payment triggered the reward (the referee, "B").
  -- SET NULL keeps the ledger row if B is later removed.
  referred_owner_id    text references public.owners(id) on delete set null,
  -- B's first paid Stripe invoice. Unique so webhook retries are idempotent and
  -- so the reward fires on exactly ONE invoice per referral.
  stripe_invoice_id    text,
  -- N = stores B paid for on that first invoice, and the per-store price snapshot.
  store_count          integer not null,
  unit_amount_cents    integer not null,
  -- The credit = store_count × unit_amount_cents, in `currency`.
  amount_cents         integer not null,
  currency             text not null default 'usd',
  status               public.referral_reward_status not null default 'PENDING',
  -- The Stripe customer-balance transaction id once APPLIED, so a reversal can
  -- post the exact opposite entry.
  stripe_balance_txn_id text,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One reward per triggering invoice (idempotent webhook retries). NULLs are
-- distinct in Postgres, matching the commissions table's posture.
create unique index if not exists referral_rewards_stripe_invoice_id_key
  on public.referral_rewards (stripe_invoice_id);

create index if not exists referral_rewards_referrer_idx
  on public.referral_rewards (referrer_owner_id);
create index if not exists referral_rewards_referred_idx
  on public.referral_rewards (referred_owner_id);
create index if not exists referral_rewards_status_idx
  on public.referral_rewards (status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Holds money owed + owner ids. Like partners/commissions, RLS is enabled with
-- NO policies: every anon/authenticated query is denied; only the API's
-- service-role/postgres connection (which bypasses RLS) can touch it.
alter table public.referral_rewards enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually if needed — additive only):
--   drop table if exists public.referral_rewards;
--   drop index if exists public.owners_referred_by_owner_idx;
--   drop index if exists public.owners_referral_code_key;
--   alter table public.owners drop column if exists referred_by_owner_id;
--   alter table public.owners drop column if exists referral_code;
--   drop type if exists public.referral_reward_status;
-- ─────────────────────────────────────────────────────────────────────────────
