-- Migration 0046: Wealth Relationship Manager Workflow & Mandate Storage
-- Enables Sales Caller -> Relationship Manager handoff in Wealth vertical.
-- Stores wealth_requirement (investible surplus, mandate product, risk profile, horizon).
-- Adds Wealth advice/process stages (discovery, suitability, proposal, onboarding).

ALTER TABLE lead_handoffs ADD COLUMN IF NOT EXISTS wealth_requirement jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS investible_surplus numeric;

-- Expand leads_stage_check to support canonical Wealth Management stages (Deck P005)
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
    -- Markets & Securities stages (Deck P005)
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
