-- Migration 0018 — Super Admin (SA-01..SA-11) Workflows, Governance & Persistence
-- Enforces administrative boundaries: role/scope separation, cycle-free reporting lines,
-- atomic lifecycle transitions, accountable holding queues, expiring invitations & recoveries,
-- versioned rule publication, restricted audit investigation, safe idempotent job retries,
-- and bounded temporary access delegations.

-- 1. Demo Super Administrator: Alok Verma (SA)
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-013',
  'alok@finverse.demo',
  -- scrypt hash of 'demo1234'
  'scrypt$m156EmNbQXHZCVT0RATogw==$CUqGh5bV/tFwF9jTpFCzTL6W4y9kkFPtCd04bhdYuet3OdmIx+9Hq8gcMS6babqkcczMBw6r6/fidfprnHImKA==',
  'Alok Verma',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Superadmin assignments across Wealth & Banking
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-SA-W', 'EMP-013', 'SA', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-SA-B', 'EMP-013', 'SA', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO UPDATE SET employee_id = 'EMP-013';

-- 2. System Audit Logs (SA-01..SA-11, SA-09)
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id TEXT PRIMARY KEY,
  actor_employee_id TEXT REFERENCES employees(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  correlation_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sys_audit_actor ON system_audit_logs(actor_employee_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_entity ON system_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_time ON system_audit_logs(occurred_at DESC);

-- 3. SA-01: Account Creation & Expiring Activation Invitations
CREATE TABLE IF NOT EXISTS activation_invitations (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  work_email TEXT NOT NULL,
  proposed_role TEXT NOT NULL,
  vertical TEXT NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_by_employee_id TEXT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_act_inv_email ON activation_invitations(work_email);
CREATE INDEX IF NOT EXISTS idx_act_inv_token ON activation_invitations(token_hash);

-- 4. SA-04: Reporting Hierarchy Nodes & Tree Structure
CREATE TABLE IF NOT EXISTS reporting_hierarchy_nodes (
  id TEXT PRIMARY KEY,
  unit_name TEXT NOT NULL,
  vertical TEXT NOT NULL,
  unit_level TEXT NOT NULL,
  parent_node_id TEXT REFERENCES reporting_hierarchy_nodes(id),
  leader_employee_id TEXT REFERENCES employees(id),
  effective_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rep_hier_parent ON reporting_hierarchy_nodes(parent_node_id);

-- 5. SA-06: Holding Queues for Supervised Offboarding Work
CREATE TABLE IF NOT EXISTS holding_queues (
  id TEXT PRIMARY KEY,
  source_employee_id TEXT NOT NULL REFERENCES employees(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('lead', 'task', 'report_schedule', 'approval')),
  item_id TEXT NOT NULL,
  supervised_by_employee_id TEXT REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'in_holding' CHECK (status IN ('in_holding', 'reassigned', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reassigned_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_holding_source ON holding_queues(source_employee_id);
CREATE INDEX IF NOT EXISTS idx_holding_status ON holding_queues(status);

-- 6. SA-07: Verified Account Recovery Requests
CREATE TABLE IF NOT EXISTS account_recovery_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  issue_type TEXT NOT NULL,
  identity_check_procedure TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  sessions_revoked_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'blocked_unverified')),
  created_by_employee_id TEXT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rec_req_emp ON account_recovery_requests(employee_id);

-- 7. SA-08: Business Configurations & Versioned Rule Publications
CREATE TABLE IF NOT EXISTS business_configurations (
  id TEXT PRIMARY KEY,
  config_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('stage', 'sla', 'routing', 'fiscal_calendar')),
  version INT NOT NULL,
  effective_date DATE NOT NULL,
  schema_payload JSONB NOT NULL,
  impact_preview JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved_scheduled', 'published', 'rolled_back')),
  published_by_employee_id TEXT REFERENCES employees(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_config_key_version UNIQUE (config_key, version)
);

-- 8. SA-09: Restricted Audit Incidents
CREATE TABLE IF NOT EXISTS audit_incidents (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  actor_identifier TEXT NOT NULL,
  correlation_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  state TEXT NOT NULL DEFAULT 'Active' CHECK (state IN ('Active', 'Review', 'Resolved', 'Closed')),
  evidence_summary TEXT NOT NULL,
  before_after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  investigated_by_employee_id TEXT REFERENCES employees(id),
  incident_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_audit_inc_ref ON audit_incidents(reference_code);

-- 9. SA-10: System Background Jobs & Recovery Queue
CREATE TABLE IF NOT EXISTS system_background_jobs (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  queue_name TEXT NOT NULL CHECK (queue_name IN ('imports', 'reminders', 'exports')),
  job_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Active' CHECK (state IN ('Active', 'Failed', 'Retrying', 'Completed', 'DeadLetter')),
  failure_reason TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  job_owner_employee_id TEXT REFERENCES employees(id),
  payload_summary TEXT,
  last_attempt_at TIMESTAMPTZ,
  watermark TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_job_idempotency UNIQUE (queue_name, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_sys_jobs_queue ON system_background_jobs(queue_name, state);

-- 10. SA-11: Temporary Access Grants & Delegation Reviews
CREATE TABLE IF NOT EXISTS temporary_access_grants (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  grant_type TEXT NOT NULL,
  target_role TEXT NOT NULL,
  target_vertical TEXT NOT NULL,
  target_team_id TEXT REFERENCES teams(id),
  delegated_from_employee_id TEXT REFERENCES employees(id),
  approver_notes TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'renewed', 'revoked')),
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_temp_grants_emp ON temporary_access_grants(employee_id, status);

-- 11. Baseline Fixtures matching Action Deck P291–P312
-- Hierarchy baseline (P297: SA-04)
INSERT INTO reporting_hierarchy_nodes (id, unit_name, vertical, unit_level, parent_node_id, leader_employee_id, effective_date, status)
VALUES
  ('NODE-01', 'National Leadership', 'wealth', 'National manager', NULL, 'EMP-009', '2026-09-01', 'active'),
  ('NODE-02', 'Regional South', 'wealth', 'Regional manager', 'NODE-01', 'EMP-008', '2026-09-01', 'active'),
  ('NODE-03', 'Manager Group South', 'wealth', 'Manager', 'NODE-02', 'EMP-007', '2026-09-01', 'active'),
  ('NODE-04', 'Wealth Alpha Team', 'wealth', 'Team leader', 'NODE-03', 'EMP-002', '2026-09-01', 'active'),
  ('NODE-05', 'Frontline Advisory', 'wealth', 'Sales associate', 'NODE-04', 'EMP-001', '2026-09-01', 'active')
ON CONFLICT (id) DO NOTHING;

-- Transfer request (P299: SA-05)
INSERT INTO employee_lifecycle_requests (id, manager_employee_id, employee_id, proposed_role, proposed_team_id, effective_date, business_justification, handoff_plan, status, hr_notified)
VALUES (
  'MOVE-081',
  'EMP-007',
  'EMP-001',
  'SC',
  'TEAM-WEALTH-BETA',
  '2026-10-01',
  'Approved cross-branch transfer to balance regional caller capacity.',
  'All 14 active leads and 2 open scheduled meetings reassigned to caller buddy; historical attribution retained.',
  'approved_by_rm',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Business configurations (P305: SA-08)
INSERT INTO business_configurations (id, config_key, title, category, version, effective_date, schema_payload, impact_preview, approved_by, status)
VALUES
  ('CFG-SLA-001', 'lead_response_sla', 'Lead Response SLA & Escalation Thresholds', 'sla', 1, '2026-09-01', '{"tier1_hours": 2, "escalate_tl_hours": 4, "escalate_mg_hours": 8}'::jsonb, '{"affected_callers": 24, "target_slas": "95%"}'::jsonb, 'Executive Leadership', 'published'),
  ('CFG-SLA-002', 'lead_response_sla', 'High-Net-Worth Accelerated SLA Tier', 'sla', 2, '2026-11-01', '{"tier1_hours": 1, "escalate_tl_hours": 2, "escalate_mg_hours": 4}'::jsonb, '{"affected_callers": 30, "target_slas": "98%"}'::jsonb, 'Product Head (Approved Next Version)', 'approved_scheduled'),
  ('CFG-ROUT-001', 'capacity_routing', 'Skill & Availability Fair-Share Routing', 'routing', 1, '2026-09-01', '{"max_daily_leads": 15, "availability_weight": 0.8}'::jsonb, '{"rebalancing_rate": "100%"}'::jsonb, 'Chief Operating Officer', 'published')
ON CONFLICT (id) DO NOTHING;

-- Audit incidents (P307: SA-09)
INSERT INTO audit_incidents (id, reference_code, event_type, actor_identifier, correlation_id, severity, state, evidence_summary, before_after_payload)
VALUES
  ('INC-001', 'FV-1042', 'Denied access / scope change', 'Employee or service', 'REQ-SEC-9811', 'medium', 'Active', 'Repeated cross-vertical access attempts detected from unauthorized subnet.', '{"attempts": 4, "target": "banking_ledger"}'::jsonb),
  ('INC-002', 'FV-1068', 'Nisha Rao', 'EMP-001', 'REQ-SEC-9824', 'low', 'Active', 'Routine bulk report export requested outside regular shift window.', '{"records": 120, "report": "performance_summary"}'::jsonb),
  ('INC-003', 'FV-1091', 'Dev Mehta', 'EMP-003', 'REQ-SEC-9840', 'high', 'Review', 'MFA device desynchronization and multiple failed password resets.', '{"lockout": true, "reset_method": "recovery_key"}'::jsonb),
  ('INC-004', 'FV-1105', 'Riya Jain', 'EMP-004', 'REQ-SEC-9855', 'low', 'Active', 'Simultaneous active sessions detected across two geographic IP endpoints.', '{"ips": ["103.21.12.1", "103.21.12.99"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- System background jobs (P309: SA-10)
INSERT INTO system_background_jobs (id, reference_code, queue_name, job_name, idempotency_key, state, failure_reason, retry_count, max_retries, payload_summary, watermark)
VALUES
  ('JOB-REC-001', 'FV-1042', 'imports', 'Daily Prospect Feed Ingestion', 'IDEMP-JOB-201', 'Failed', 'Provider unavailable (upstream HTTP 503 gateway timeout)', 2, 3, 'Batch size 250 rows; 0 committed', '2026-10-10 08:30:00+00'),
  ('JOB-REC-002', 'FV-1068', 'reminders', 'Nisha Rao Call Reminders', 'IDEMP-JOB-202', 'Failed', 'Notification delivery throttled by SMS gateway provider', 1, 3, '18 tasks scheduled for 10:00 IST', '2026-10-10 09:15:00+00'),
  ('JOB-REC-003', 'FV-1091', 'exports', 'Dev Mehta Pipeline Ledger Pack', 'IDEMP-JOB-203', 'Retrying', 'Transient filesystem storage lock', 2, 3, 'Binary PDF streaming export 1.4MB', '2026-10-10 09:30:00+00'),
  ('JOB-REC-004', 'FV-1105', 'imports', 'Riya Jain Partner Referral Intake', 'IDEMP-JOB-204', 'Active', NULL, 0, 3, '50 verified referrals', '2026-10-10 09:45:00+00')
ON CONFLICT (id) DO NOTHING;

-- Temporary access grant (P311: SA-11)
INSERT INTO temporary_access_grants (id, employee_id, grant_type, target_role, target_vertical, target_team_id, delegated_from_employee_id, approver_notes, expires_at, status)
VALUES (
  'GRANT-TEMP-001',
  'EMP-002',
  'Temporary approver / team scope',
  'TL',
  'wealth',
  'TEAM-WEALTH-BETA',
  'EMP-007',
  'Approved cover for Team Lead leave; strictly time-limited to 30 Oct 2026.',
  '2026-10-30 23:59:59+05:30',
  'active'
)
ON CONFLICT (id) DO NOTHING;
