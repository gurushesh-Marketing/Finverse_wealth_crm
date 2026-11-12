-- SC-01..SC-28 supporting schema. Synthetic/demo-safe; attribution captured at event time.

ALTER TABLE lead_events
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS actor_team_id text,
  ADD COLUMN IF NOT EXISTS assignment_id text;

CREATE TABLE IF NOT EXISTS availability_changes (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id),
  status text NOT NULL CHECK (status IN ('available', 'busy', 'away')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE TABLE IF NOT EXISTS saved_views (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id),
  name text NOT NULL,
  filters jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, name)
);

CREATE TABLE IF NOT EXISTS lead_audit (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  field text NOT NULL,
  before_value text,
  after_value text,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiries (
  id text PRIMARY KEY,
  created_by text NOT NULL REFERENCES employees(id),
  display_name text NOT NULL,
  phone text NOT NULL,
  email text,
  product text NOT NULL,
  source text NOT NULL,
  permission_evidence text NOT NULL,
  need text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending-validation', 'published', 'duplicate', 'invalid')),
  duplicate_of text REFERENCES leads(id),
  published_lead_id text REFERENCES leads(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  provider_mode text NOT NULL,
  idempotency_key text UNIQUE,
  status text NOT NULL CHECK (status IN ('connecting', 'ringing', 'connected', 'ended', 'failed', 'no-answer', 'missed')),
  evidence_status text NOT NULL DEFAULT 'simulated' CHECK (evidence_status IN ('simulated', 'provider-verified', 'manual')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  wrapup_disposition text CHECK (wrapup_disposition IN ('connected', 'no-answer', 'busy', 'wrong-number', 'callback')),
  wrapup_need_confirmed boolean,
  wrapup_note text,
  wrapup_next_action text,
  wrapup_due_at timestamptz,
  wrapup_saved_at timestamptz,
  needs_wrapup boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text REFERENCES employees(id),
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  template text,
  body text NOT NULL,
  provider_ref text,
  intent text,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'received', 'unmatched')),
  evidence_status text NOT NULL DEFAULT 'simulated' CHECK (evidence_status IN ('simulated', 'provider-verified', 'manual')),
  inbound_dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES lead_tasks(id),
  remind_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qualifications (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  need text NOT NULL,
  product text NOT NULL,
  expected_value numeric,
  currency text,
  time_horizon text,
  checklist jsonb NOT NULL,
  checklist_version text NOT NULL,
  next_step text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stage_events (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  reason text NOT NULL,
  rule_version text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meetings (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  meeting_type text NOT NULL,
  slot_at timestamptz NOT NULL,
  location text NOT NULL,
  attendees text NOT NULL,
  agenda text NOT NULL,
  invite_status text NOT NULL DEFAULT 'queued' CHECK (invite_status IN ('queued', 'delivered', 'failed')),
  outcome text CHECK (outcome IN ('attended', 'no-show', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  product text NOT NULL,
  template_version text NOT NULL,
  terms text NOT NULL,
  valid_until date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'pending-approval', 'approved', 'sent', 'withdrawn')),
  version int NOT NULL DEFAULT 1,
  approver_employee_id text REFERENCES employees(id),
  decided_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outcome_requests (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  type text NOT NULL CHECK (type IN ('conversion', 'reopen', 'handoff', 'correction', 'blocker', 'loss')),
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  decided_by text REFERENCES employees(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loss_records (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  reason text NOT NULL,
  explanation text NOT NULL,
  competitor text,
  future_contact text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_suppressions (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  created_by text NOT NULL REFERENCES employees(id),
  channels text[] NOT NULL,
  reason text NOT NULL,
  source text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_requests (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  checklist text NOT NULL,
  requested_files text[] NOT NULL,
  upload_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  reminder_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('open', 'fulfilled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  request_id text REFERENCES document_requests(id),
  uploaded_by text NOT NULL REFERENCES employees(id),
  document_type text NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes int NOT NULL,
  version int NOT NULL DEFAULT 1,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'quarantined')),
  validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'accepted', 'rejected')),
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id),
  reviewer_employee_id text NOT NULL REFERENCES employees(id),
  period text NOT NULL,
  scorecard jsonb NOT NULL,
  self_reflection text,
  commitments jsonb,
  employee_response text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_exports (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id),
  period text NOT NULL,
  snapshot_at timestamptz NOT NULL,
  metric_version text NOT NULL,
  storage_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_lead ON calls (lead_id, started_at);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages (lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders (status, remind_at);
CREATE INDEX IF NOT EXISTS idx_documents_lead ON documents (lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outcome_requests_status ON outcome_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_suppressions_lead ON contact_suppressions (lead_id, active);
CREATE INDEX IF NOT EXISTS idx_meetings_slot ON meetings (slot_at);
