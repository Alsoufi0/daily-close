alter table public.owners
  add column if not exists stripe_subscription_item_id text;
