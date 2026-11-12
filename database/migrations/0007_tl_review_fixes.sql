-- Migration 0007: Team Lead review fixes (M3 tri-state decisions, M4 structured decision evidence)

-- 1. outcome_requests: support 'returned' as distinct status, and add structured decision_evidence JSONB
ALTER TABLE outcome_requests DROP CONSTRAINT IF EXISTS outcome_requests_status_check;
ALTER TABLE outcome_requests ADD CONSTRAINT outcome_requests_status_check
  CHECK (status IN ('pending', 'approved', 'returned', 'rejected', 'completed'));

ALTER TABLE outcome_requests ADD COLUMN IF NOT EXISTS decision_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. activity_corrections: support 'rejected' as distinct status alongside 'accepted' and 'returned', and add structured decision_evidence JSONB
ALTER TABLE activity_corrections DROP CONSTRAINT IF EXISTS activity_corrections_status_check;
ALTER TABLE activity_corrections ADD CONSTRAINT activity_corrections_status_check
  CHECK (status IN ('pending', 'accepted', 'returned', 'rejected'));

ALTER TABLE activity_corrections ADD COLUMN IF NOT EXISTS decision_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
