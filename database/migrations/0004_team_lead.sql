-- Migration 0004 — Wealth Team Lead (TL-01..TL-18) persistence.
-- All demo/synthetic data only. Parameterized access happens in the repo layer.

-- TL-02/03/04 — lead ownership intervals + batch safety (no double-assign).
CREATE TABLE IF NOT EXISTS lead_ownership_events (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  from_owner_employee_id text REFERENCES employees(id),
  to_owner_employee_id text REFERENCES employees(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  actor_role text NOT NULL,
  actor_team_id text REFERENCES teams(id),
  assignment_id text REFERENCES assignments(id),
  kind text NOT NULL CHECK (kind IN ('first-allocation', 'transfer', 'rebalance', 'batch')),
  reason text NOT NULL,
  batch_key text,
  record_version int NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_ownership_batch_unique
  ON lead_ownership_events (lead_id, batch_key) WHERE batch_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owner_events_lead ON lead_ownership_events (lead_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS allocation_batches (
  id text PRIMARY KEY,
  batch_key text UNIQUE NOT NULL,
  actor_employee_id text NOT NULL REFERENCES employees(id),
  actor_team_id text REFERENCES teams(id),
  method text NOT NULL,
  total_count int NOT NULL,
  success_count int NOT NULL DEFAULT 0,
  held_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-05 — overdue recovery trail (append-only; original task history preserved).
CREATE TABLE IF NOT EXISTS overdue_escalations (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES lead_tasks(id),
  lead_id text NOT NULL REFERENCES leads(id),
  subject_employee_id text NOT NULL REFERENCES employees(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  action text NOT NULL CHECK (action IN ('coach', 'reassign', 'escalate')),
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  recovery_task_id text REFERENCES lead_tasks(id),
  manager_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-09 — call-quality reviews + evidence access log.
CREATE TABLE IF NOT EXISTS call_quality_reviews (
  id text PRIMARY KEY,
  call_id text NOT NULL REFERENCES calls(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  subject_employee_id text NOT NULL REFERENCES employees(id),
  rubric_version text NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}',
  feedback text NOT NULL,
  evidence_ref text,
  assessed boolean NOT NULL DEFAULT true,
  coaching_task_id text REFERENCES lead_tasks(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS evidence_access_log (
  id text PRIMARY KEY,
  review_id text REFERENCES call_quality_reviews(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-10 — versioned team targets + employee allocations (reconcile to parent).
CREATE TABLE IF NOT EXISTS team_targets (
  id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES teams(id),
  period_label text NOT NULL,
  metric text NOT NULL DEFAULT 'approved-wins',
  parent_value numeric NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'published')),
  version int NOT NULL DEFAULT 1,
  closed boolean NOT NULL DEFAULT false,
  created_by text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, period_label, metric, version)
);
CREATE TABLE IF NOT EXISTS target_allocations (
  id text PRIMARY KEY,
  target_id text NOT NULL REFERENCES team_targets(id),
  employee_id text NOT NULL REFERENCES employees(id),
  allocated_value numeric NOT NULL,
  prorate_note text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-11 — frozen team forecast versions.
CREATE TABLE IF NOT EXISTS team_forecasts (
  id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES teams(id),
  period_label text NOT NULL,
  category text NOT NULL CHECK (category IN ('commit', 'best-case', 'pipeline')),
  expected_revenue numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  opportunity_ids jsonb NOT NULL DEFAULT '[]',
  risk_notes text,
  assumptions text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'revised')),
  version int NOT NULL DEFAULT 1,
  actor_employee_id text NOT NULL REFERENCES employees(id),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- TL-12 — one-to-one enrichment (base reviews table pre-exists).
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS agenda text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS snapshot_version int NOT NULL DEFAULT 1;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS private_notes text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS disagreement text;

-- TL-13 — intern mentorships (dated, scoped; TL never grants roles).
CREATE TABLE IF NOT EXISTS mentorships (
  id text PRIMARY KEY,
  intern_employee_id text NOT NULL REFERENCES employees(id),
  mentor_employee_id text NOT NULL REFERENCES employees(id),
  work_cap int NOT NULL,
  allowed_products jsonb NOT NULL DEFAULT '[]',
  review_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  granted_by text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-14/15 — staffing requests and complaint/commercial escalations
-- (submitting executes nothing outside the TL's authority).
CREATE TABLE IF NOT EXISTS team_requests (
  id text PRIMARY KEY,
  team_id text REFERENCES teams(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  category text NOT NULL CHECK (category IN ('staffing', 'role-change', 'capacity', 'complaint', 'commercial-exception')),
  subject_employee_id text REFERENCES employees(id),
  lead_id text REFERENCES leads(id),
  severity text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  decided_by text REFERENCES employees(id),
  decision_reason text,
  decided_at timestamptz,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-16 — snapshot-bound team report packs (scope re-checked on generate+download).
CREATE TABLE IF NOT EXISTS team_report_exports (
  id text PRIMARY KEY,
  actor_employee_id text NOT NULL REFERENCES employees(id),
  team_ids jsonb NOT NULL,
  period text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metric_version text NOT NULL,
  filename text NOT NULL,
  rel_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-17 — recurring report schedules (persisted; rechecked permissions per run).
CREATE TABLE IF NOT EXISTS report_schedules (
  id text PRIMARY KEY,
  owner_employee_id text NOT NULL REFERENCES employees(id),
  name text NOT NULL,
  cadence text NOT NULL,
  period text NOT NULL DEFAULT 'weekly',
  team_ids jsonb NOT NULL DEFAULT '[]',
  recipients jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  dedupe_key text UNIQUE NOT NULL,
  last_run_at timestamptz,
  last_export_id text,
  last_error text,
  next_run_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TL-18 — append-only documented activity corrections.
CREATE TABLE IF NOT EXISTS activity_corrections (
  id text PRIMARY KEY,
  call_id text NOT NULL REFERENCES calls(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  requested_field text NOT NULL,
  requested_value text NOT NULL,
  original_value text,
  evidence_ref text,
  explanation text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'returned')),
  decided_by text REFERENCES employees(id),
  decision_reason text,
  decided_at timestamptz,
  affected_report_versions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_requests_status ON team_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_corrections_status ON activity_corrections (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_due ON lead_tasks (status, due_at);
