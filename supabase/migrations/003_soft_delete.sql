-- Soft-delete columns for employees + stores so owners can remove without
-- breaking FK constraints from existing daily_close / audit_log rows.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE stores    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS employees_active_idx ON employees (deleted_at);
CREATE INDEX IF NOT EXISTS stores_active_idx    ON stores    (deleted_at);
