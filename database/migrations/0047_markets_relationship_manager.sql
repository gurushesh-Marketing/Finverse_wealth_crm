-- Migration 0047: Markets & Securities Relationship Manager Workflow & Mandate Storage
-- Enables Sales Caller -> Relationship Manager handoff in Markets/Trading vertical.
-- Stores markets_requirement (trading capital, trading segment, trading experience, risk tolerance, depository preference, income proof).
-- Preserves honest SEBI risk disclosures and depository sync.

ALTER TABLE lead_handoffs ADD COLUMN IF NOT EXISTS markets_requirement jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS trading_capital numeric;

-- Ensure leads_stage_check constraint preserves all multi-vertical canonical stages
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE leads ADD CONSTRAINT leads_stage_check CHECK (
  stage IN (
    -- Baseline & Standard stages
    'new',
    'not-contacted',
    'contacted',
    'follow-up',
    'qualified',
    'converted',
    'lost',
    -- Wealth Management stages (Deck P005)
    'discovery',
    'suitability',
    'proposal',
    'onboarding',
    -- Commercial Banking stages (Deck P005)
    'eligibility',
    'documents',
    'sanction',
    'disbursal',
    -- Markets & Securities Trading stages (Deck P005, P038, P320)
    'kyc',
    'risk-profile',
    'demat-opened',
    'active-funded',
    -- Real Estate Advisory stages (Deck P005)
    'requirement',
    'site-visit',
    'booking',
    'registration'
  )
);
