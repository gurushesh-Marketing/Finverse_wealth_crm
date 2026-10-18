-- Migration 0019 — Super Admin Hardening, Local Delivery Outbox & Runtime Activation
-- Supports SA-01 (Activation Consumption), SA-06 (Holding Work), SA-07 (Recovery Consumption),
-- and SA-08 (Business Configuration Supersession).

-- 1. Local Delivery Outbox for Demo Activation & Recovery Links
-- Explicitly labeled: Local Delivery Adapter (Demo: No External Email Service)
CREATE TABLE IF NOT EXISTS local_delivery_outbox (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('activation_invitation', 'account_recovery')),
  subject TEXT NOT NULL,
  action_url TEXT NOT NULL,
  raw_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  channel_label TEXT NOT NULL DEFAULT 'Local Delivery Adapter (Demo: No External Email Service)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliv_outbox_email ON local_delivery_outbox(recipient_email);
CREATE INDEX IF NOT EXISTS idx_deliv_outbox_token ON local_delivery_outbox(raw_token);

-- 2. Update status constraint on business_configurations to allow 'superseded'
ALTER TABLE business_configurations DROP CONSTRAINT IF EXISTS business_configurations_status_check;
ALTER TABLE business_configurations ADD CONSTRAINT business_configurations_status_check
  CHECK (status IN ('draft', 'approved_scheduled', 'published', 'superseded', 'rolled_back'));

-- 3. Add index on employee_lifecycle_requests for fast approval status checking
CREATE INDEX IF NOT EXISTS idx_elr_status_emp ON employee_lifecycle_requests(status, employee_id);
