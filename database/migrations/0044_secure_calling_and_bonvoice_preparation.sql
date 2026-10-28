-- ====================================================================
-- Migration: 0044_secure_calling_and_bonvoice_preparation.sql
-- Client Workflow: Secure Calling Preparation, Masked Destination Calling,
-- Server-Side Approved Caller Identities, and Synthetic Voice Provider Adapter
-- Invariants:
--   - Caller sees only masked prospect numbers; raw numbers never reach client
--   - "Call now" sends only lead ID; server resolves destination number privately
--   - Calling identities are restricted to server-side configuration
--   - Provider adapter architecture with honest synthetic simulation mode
--   - Zero fake Bonvoice endpoints, zero real calls without verified credentials
-- ====================================================================

-- 1. Create caller approved calling identities table
CREATE TABLE IF NOT EXISTS caller_calling_identities (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  calling_identity TEXT NOT NULL,
  provider_agent_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Seed approved calling identities for sales callers
INSERT INTO caller_calling_identities (employee_id, calling_identity, provider_agent_id) VALUES
  ('EMP-001', '+918040000001', 'AGT-W-01'),   -- Asha Rao (Wealth)
  ('EMP-002', '+918040000002', 'AGT-W-02'),   -- Ravi Menon (Wealth)
  ('EMP-006', '+918040000006', 'AGT-W-06'),   -- Karan Shah (Wealth)
  ('EMP-004', '+918040000004', 'AGT-BK-04'),  -- Dev Kapoor (Banking)
  ('EMP-021', '+918040000021', 'AGT-MK-21'),  -- Kabir Joshi (Markets)
  ('EMP-026', '+918040000026', 'AGT-RE-26'),  -- Sameer Kulkarni (Real Estate)
  ('EMP-031', '+918040000031', 'AGT-RE-31')   -- Kunal Rao (Real Estate)
ON CONFLICT (employee_id) DO UPDATE
  SET calling_identity = EXCLUDED.calling_identity,
      provider_agent_id = EXCLUDED.provider_agent_id,
      updated_at = now();

-- 3. Enhance calls table with provider reference, identity, and masked destination
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_call_reference TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_identity TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS destination_masked TEXT;

-- 4. Indexes for fast provider reference lookup and audit
CREATE INDEX IF NOT EXISTS idx_calls_provider_ref ON calls (provider_call_reference);
CREATE INDEX IF NOT EXISTS idx_calls_actor_status ON calls (actor_employee_id, status);
