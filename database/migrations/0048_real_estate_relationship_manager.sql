-- Migration 0048: Real Estate Relationship Manager Workflow & Property Requirement Storage
-- Enables Sales Caller -> Relationship Manager handoff in Real Estate Advisory vertical.
-- Stores real_estate_requirement (property budget, property type, preferred location, purchase timeline, purchase purpose, site visit preference, funding source).
-- Preserves honest RERA compliance verification and title search checks without fake CIBIL scores.

ALTER TABLE lead_handoffs ADD COLUMN IF NOT EXISTS real_estate_requirement jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_budget numeric;

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
