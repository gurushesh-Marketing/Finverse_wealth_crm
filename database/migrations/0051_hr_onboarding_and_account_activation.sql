-- Migration: 0051_hr_onboarding_and_account_activation.sql
-- HR Employee Onboarding, Super Admin Activation, and Self-Service Password Reset

-- 1. Loosen status constraint on employees to support pending_approval and rejected states
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check 
  CHECK (status IN ('active', 'disabled', 'pending_approval', 'rejected'));

-- 2. Extend employees table with mobile, whatsapp, username, first-login password change flag, and reporting manager
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reporting_manager_id TEXT REFERENCES employees(id);

-- Ensure unique constraint on username (case-insensitive via unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_username_lower ON employees(LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile_number) WHERE mobile_number IS NOT NULL;

-- 3. Extend hr_lifecycle_requests with mobile numbers and unique constraints
ALTER TABLE hr_lifecycle_requests ADD COLUMN IF NOT EXISTS primary_mobile TEXT;
ALTER TABLE hr_lifecycle_requests ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 4. Employee ID generator sequence (starts after existing EMP-xxx records)
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START WITH 33;

DO $$
DECLARE
  max_val INT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(id FROM 5)::INT), 32) INTO max_val FROM employees WHERE id ~ '^EMP-[0-9]+$';
  PERFORM setval('employee_id_seq', GREATEST(max_val, 32));
END $$;

CREATE OR REPLACE FUNCTION generate_next_employee_id()
RETURNS TEXT AS $$
DECLARE
  next_val INT;
BEGIN
  next_val := nextval('employee_id_seq');
  RETURN 'EMP-' || LPAD(next_val::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Backfill existing demo accounts with usernames and mock phones if null
UPDATE employees
   SET username = LOWER(SPLIT_PART(email, '@', 1))
 WHERE username IS NULL AND email LIKE '%@finverse.demo';

UPDATE employees
   SET mobile_number = '+9198' || LPAD(SUBSTRING(id FROM 5), 8, '0')
 WHERE mobile_number IS NULL AND id ~ '^EMP-[0-9]+$';

-- 6. Indexes for Account Recovery and Password Reset
CREATE INDEX IF NOT EXISTS idx_acc_rec_token_hash ON account_recovery_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_acc_rec_status_expires ON account_recovery_requests(status, expires_at);
