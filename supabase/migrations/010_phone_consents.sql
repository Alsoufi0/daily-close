-- 010_phone_consents.sql
--
-- Twilio A2P 10DLC compliance: capture explicit consent before sending
-- any SMS to an employee phone number. Carriers (and Twilio) require an
-- auditable record of WHO consented, WHEN, and what TEXT they were shown
-- at the time. The owner attests on the employee's behalf when inviting
-- (the "owner attestation" pattern documented by Twilio for B2B tools
-- where the end-user phone is collected by the business).
--
-- One row per consent event. When a STOP webhook is received we don't
-- delete rows — we set `opted_out_at` so the historical consent is
-- preserved for audit while the current opt-out state is queryable as
-- `opted_out_at IS NULL`.

create table if not exists public.phone_consents (
  id                    text primary key,
  phone                 text not null,
  employee_id           text null references public.employees(id),
  consented_by_user_id  text not null references public.users(id),
  store_id              text not null references public.stores(id),
  consent_method        text not null,
  consent_text          text not null,
  consented_at          timestamptz not null default now(),
  opted_out_at          timestamptz null
);

create index if not exists phone_consents_phone_idx on public.phone_consents (phone);
create index if not exists phone_consents_employee_idx on public.phone_consents (employee_id);
