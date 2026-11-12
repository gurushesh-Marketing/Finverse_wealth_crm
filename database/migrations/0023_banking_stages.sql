-- 0023_banking_stages.sql
-- Expand leads_stage_check to support Commercial Banking stages (Deck P005):
-- 'eligibility', 'documents', 'sanction', 'disbursal' alongside existing stages.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE leads ADD CONSTRAINT leads_stage_check CHECK (
  stage IN (
    -- Baseline & Wealth stages
    'new',
    'not-contacted',
    'contacted',
    'follow-up',
    'qualified',
    'converted',
    'lost',
    -- Commercial Banking stages (Deck P005)
    'eligibility',
    'documents',
    'sanction',
    'disbursal'
  )
);
