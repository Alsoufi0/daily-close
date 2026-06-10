-- Dedicated store-reviewer demo account for Google Play / App Store review.
-- Fully separate from the partner's owner@demo.com seed (distinct rev-* ids + email).
-- Idempotent + additive: every insert is `on conflict do nothing`.
-- Login (created separately via the Supabase admin API): reviewer@dailyclose.us

insert into public.users (id, name, email, password, role)
values
  ('rev-user-owner', 'Play Reviewer', 'reviewer@dailyclose.us', '', 'STORE_OWNER'),
  ('rev-user-clerk', 'Demo Clerk', 'clerk-rev@dailyclose.us', '', 'EMPLOYEE')
on conflict (id) do nothing;

insert into public.owners (id, user_id, subscription_plan)
values ('rev-owner', 'rev-user-owner', 'PILOT')
on conflict (id) do nothing;

insert into public.stores (id, owner_id, store_name, address, phone, timezone, close_time)
values
  ('rev-store-1', 'rev-owner', 'Downtown', '100 Main St',  '555-0101', 'America/New_York', '23:30'),
  ('rev-store-2', 'rev-owner', 'Westside', '200 Oak Ave',  '555-0102', 'America/New_York', '23:30'),
  ('rev-store-3', 'rev-owner', 'Eastside', '300 Pine Rd',  '555-0103', 'America/New_York', '23:30')
on conflict (id) do nothing;

insert into public.employees (id, user_id, store_id)
values
  ('rev-emp-1', 'rev-user-clerk', 'rev-store-1'),
  ('rev-emp-3', 'rev-user-clerk', 'rev-store-3')
on conflict (id) do nothing;

insert into public.daily_close (
  id, store_id, employee_id, date, cash_sales, card_sales, total_sales, tax,
  refunds, discounts, expected_cash, counted_cash, difference, expenses, notes, status
)
values
  ('rev-close-1-today', 'rev-store-1', 'rev-emp-1', current_date, 1800, 2700, 4500, 318, 0, 12, 1800, 1805,   5, 0, 'Pilot seed close', 'OVER'),
  ('rev-close-3-today', 'rev-store-3', 'rev-emp-3', current_date, 1500, 2400, 3900, 276, 0,  8, 1500, 1460, -40, 0, 'Register short',   'SHORT')
on conflict (store_id, date) do nothing;

insert into public.notifications (id, user_id, store_id, type, message, status)
values ('rev-notif-store-2', 'rev-user-owner', 'rev-store-2', 'EMAIL', 'Westside has not completed closing yet.', 'PENDING')
on conflict (id) do nothing;

-- Long trial so the reviewer account is never paywall-blocked during review.
update public.owners set trial_ends_at = now() + interval '365 days' where id = 'rev-owner';
