-- ====================================================================
-- Migration: 0043_priority_leads_and_round_robin.sql
-- Client Workflow: Priority Lead Ordering, Data Entry Priority Flags,
-- and Concurrency-Safe Round-Robin Caller Assignment
-- Invariants:
--   - Priority leads displayed first in caller lead inboxes
--   - Most recently assigned first within priority groups; yesterday's below today's
--   - Data Entry can flag priority in manual entry and bulk import rows
--   - Round-robin cursor persisted and concurrency-safe per (vertical, team_id)
--   - Retries never alter existing successful assignments
--   - Cross-vertical assignments strictly forbidden
-- ====================================================================

-- 1. Add priority and assigned_at columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT now();

-- Backfill assigned_at from latest ownership event or creation date
UPDATE leads
   SET assigned_at = COALESCE(
     (SELECT max(changed_at) FROM lead_ownership_events WHERE lead_id = leads.id AND to_owner_employee_id = leads.owner_employee_id),
     leads.created_at
   )
 WHERE assigned_at IS NULL;

-- 2. Add priority flag to intake_rows (manual entry) and prospect_import_rows (bulk import)
ALTER TABLE intake_rows ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE prospect_import_rows ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create persisted round-robin cursors table
CREATE TABLE IF NOT EXISTS round_robin_cursors (
  vertical TEXT NOT NULL,
  team_id TEXT NOT NULL,
  last_assigned_employee_id TEXT REFERENCES employees(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vertical, team_id)
);

-- 4. Create performance indexes for priority ordering and isolation
CREATE INDEX IF NOT EXISTS idx_leads_priority_assigned
  ON leads (owner_employee_id, is_priority DESC, assigned_at DESC NULLS LAST, id ASC);

CREATE INDEX IF NOT EXISTS idx_leads_vertical_priority
  ON leads (vertical, is_priority DESC, assigned_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_prospect_import_rows_priority
  ON prospect_import_rows (job_id, is_priority);

CREATE INDEX IF NOT EXISTS idx_intake_rows_priority
  ON intake_rows (is_priority)
  WHERE is_priority = TRUE;
