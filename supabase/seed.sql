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

-- Ensure every seeded owner has a 14-day trial set after insert
update public.owners set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;
