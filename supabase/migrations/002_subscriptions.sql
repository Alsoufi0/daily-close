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
