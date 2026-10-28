-- Migration 0049 — Allow 'unassigned_exception' status in intake_rows
-- Enables Data Entry manual intake to track unassigned routing exceptions when no eligible callers are available.

ALTER TABLE intake_rows DROP CONSTRAINT IF EXISTS intake_rows_status_check;
ALTER TABLE intake_rows ADD CONSTRAINT intake_rows_status_check
  CHECK (status IN ('staged', 'valid', 'rejected', 'duplicate_hold', 'published', 'archived', 'unassigned_exception'));
