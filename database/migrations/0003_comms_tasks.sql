-- SC-10 unmatched inbound + SC-12/13 task revision support + message cancellation.

ALTER TABLE messages ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS supervisor_queue boolean NOT NULL DEFAULT false;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_status_check
  CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'received', 'unmatched', 'cancelled'));

ALTER TABLE lead_tasks ADD COLUMN IF NOT EXISTS original_due_at timestamptz;
ALTER TABLE lead_tasks ADD COLUMN IF NOT EXISTS deferral_count int NOT NULL DEFAULT 0;
