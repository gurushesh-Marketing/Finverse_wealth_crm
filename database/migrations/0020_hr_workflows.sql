-- ====================================================================
-- Migration: 0020_hr_workflows.sql
-- Human Resources Workspace Implementation (HR-01 through HR-07)
-- Action Deck Reference: P277–P290
-- ====================================================================

-- 1. Loosen role constraints on lifecycle requests to support all approved organizational roles
ALTER TABLE employee_lifecycle_requests DROP CONSTRAINT IF EXISTS employee_lifecycle_requests_proposed_role_check;
ALTER TABLE employee_lifecycle_requests ADD CONSTRAINT employee_lifecycle_requests_proposed_role_check
  CHECK (proposed_role IN ('SC', 'TL', 'MG', 'RM', 'NM', 'CEO', 'CFO', 'DE', 'HR', 'SA'));

ALTER TABLE employee_lifecycle_requests DROP CONSTRAINT IF EXISTS employee_lifecycle_requests_status_check;
ALTER TABLE employee_lifecycle_requests ADD CONSTRAINT employee_lifecycle_requests_status_check
  CHECK (status IN ('submitted', 'approved', 'approved_by_rm', 'activated_by_admin', 'rejected', 'returned'));

-- 2. HR Lifecycle Requests (HR-01, HR-02, HR-03, HR-04)
CREATE TABLE IF NOT EXISTS hr_lifecycle_requests (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL CHECK (request_type IN ('new_account', 'team_transfer', 'promotion', 'exit')),
  employee_id TEXT REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  employee_email TEXT,
  employment_type TEXT NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'intern', 'contract')),
  target_role TEXT NOT NULL CHECK (target_role IN ('SC', 'TL', 'MG', 'RM', 'NM', 'CEO', 'CFO', 'DE', 'HR', 'SA')),
  target_vertical TEXT NOT NULL CHECK (target_vertical IN ('wealth', 'banking', 'markets', 'real-estate')),
  target_team_id TEXT REFERENCES teams(id),
  supervisor_employee_id TEXT REFERENCES employees(id),
  effective_date DATE NOT NULL,
  effective_time TEXT NOT NULL DEFAULT '09:00 IST',
  approvals_summary TEXT NOT NULL,
  handoff_plan TEXT,
  old_workload_treatment TEXT,
  replacement_plan TEXT,
  required_training TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'activated_by_admin', 'rejected', 'returned')),
  admin_decision_notes TEXT,
  created_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_requests_type_status ON hr_lifecycle_requests(request_type, status);
CREATE INDEX IF NOT EXISTS idx_hr_requests_emp ON hr_lifecycle_requests(employee_id);

-- 3. Leave & Availability Tracking (HR-05)
CREATE TABLE IF NOT EXISTS employee_leaves (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  absence_type TEXT NOT NULL CHECK (absence_type IN ('approved_leave', 'annual_leave', 'sick_leave', 'bereavement', 'unpaid', 'personal_leave')),
  policy_reference TEXT NOT NULL DEFAULT 'POL-LEAVE-2026',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  coverage_owner_role TEXT NOT NULL DEFAULT 'TL',
  coverage_employee_id TEXT REFERENCES employees(id),
  coverage_notes TEXT,
  allocation_status TEXT NOT NULL DEFAULT 'unavailable' CHECK (allocation_status IN ('unavailable', 'reduced', 'available')),
  leads_reassignment_confirmed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  recorded_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_emp_dates ON employee_leaves(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status ON employee_leaves(status, allocation_status);

-- 4. Training, Probation & Milestones (HR-06)
CREATE TABLE IF NOT EXISTS employee_training_milestones (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('probation_review', 'new_hire_training', 'kyc_compliance', 'annual_conduct', 'licensing_exam')),
  title TEXT NOT NULL,
  required_modules TEXT NOT NULL,
  due_date DATE NOT NULL,
  supervisor_employee_id TEXT REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_progress', 'review', 'completed', 'extended', 'overdue')),
  completion_date DATE,
  evidence_summary TEXT,
  supervisor_notes TEXT,
  reviewer_employee_id TEXT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_status_due ON employee_training_milestones(status, due_date);
CREATE INDEX IF NOT EXISTS idx_milestones_emp ON employee_training_milestones(employee_id);

-- 5. People Operations Reports & Schedules (HR-07)
CREATE TABLE IF NOT EXISTS people_operations_reports (
  id TEXT PRIMARY KEY,
  period_label TEXT NOT NULL,
  workforce_scope TEXT NOT NULL,
  included_sections TEXT[] NOT NULL,
  metrics_summary JSONB NOT NULL,
  file_path TEXT,
  file_size_bytes INTEGER,
  generated_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  recipient_role TEXT NOT NULL DEFAULT 'HR',
  redaction_applied BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS people_report_schedules (
  id TEXT PRIMARY KEY,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
  workforce_scope TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  sections TEXT[] NOT NULL,
  created_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Synthetic HR Demo Persona: Pooja Sharma (EMP-014)
-- password: demo1234 (scrypt: N=16384, r=8, p=1)
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-014',
  'pooja@finverse.demo',
  'scrypt$g6bqCl8xDUSZ1smbNUKwaw==$Na/iDSflh26mN+YutH6SVb4SDyAIHd6CAnT/L0edAssDwo/LDUsYEOSW5fcNK1R1TWo/ln3ho/P25G8b6Xvn5w==',
  'Pooja Sharma',
  'active'
)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name;

INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-HR-W', 'EMP-014', 'HR', 'wealth', 'TEAM-WEALTH-ALPHA', '2026-09-01', NULL),
  ('ASG-HR-B', 'EMP-014', 'HR', 'banking', 'TEAM-BANKING-ALPHA', '2026-09-01', NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. Baseline Action Deck Fixtures (P277–P290)
INSERT INTO hr_lifecycle_requests (
  id, request_type, employee_id, employee_name, employee_email, employment_type,
  target_role, target_vertical, target_team_id, supervisor_employee_id,
  effective_date, effective_time, approvals_summary, handoff_plan,
  old_workload_treatment, replacement_plan, required_training, status, created_by_employee_id
)
VALUES
  (
    'REQ-HR-001',
    'new_account',
    NULL,
    'Karan Joshi',
    'karan.joshi@finverse.demo',
    'permanent',
    'SC',
    'wealth',
    'TEAM-WEALTH-ALPHA',
    'EMP-003',
    '2026-10-15',
    '09:00 IST',
    'Approved by Hiring Authority (National Head Vikram Malhotra)',
    NULL,
    NULL,
    NULL,
    'Wealth Foundations & AML Compliance',
    'submitted',
    'EMP-014'
  ),
  (
    'REQ-HR-002',
    'team_transfer',
    'EMP-001',
    'Asha Rao',
    'asha@finverse.demo',
    'permanent',
    'SC',
    'wealth',
    'TEAM-WEALTH-BETA',
    'EMP-003',
    '2026-10-15',
    '09:00 IST',
    'Approved by Regional Manager (Kavita Rao)',
    'Named handoff owners: Leads reassigned to Ravi Menon; Tasks to Tara Iyer',
    NULL,
    NULL,
    NULL,
    'approved',
    'EMP-014'
  ),
  (
    'REQ-HR-003',
    'promotion',
    'EMP-001',
    'Asha Rao',
    'asha@finverse.demo',
    'permanent',
    'TL',
    'wealth',
    'TEAM-WEALTH-ALPHA',
    'EMP-007',
    '2026-11-01',
    '09:00 IST',
    'Approved by Leadership & HR Operations',
    NULL,
    'Reassign old caller leads; retain career performance reports as read-only history',
    NULL,
    NULL,
    'submitted',
    'EMP-014'
  ),
  (
    'REQ-HR-004',
    'exit',
    'EMP-006',
    'Karan Shah',
    'karan@finverse.demo',
    'permanent',
    'SC',
    'wealth',
    'TEAM-WEALTH-GAMMA',
    'EMP-005',
    '2026-10-31',
    '18:00 IST',
    'Authorized Exit (Voluntary Resignation with approved notice)',
    'Handoff checklist: 8 active leads routed to Holding Queue Gamma; calendar purged',
    NULL,
    'Separate new identity; requisition REQ-HR-042 opened for replacement',
    NULL,
    'submitted',
    'EMP-014'
  )
ON CONFLICT (id) DO NOTHING;

-- Connect transfer/promotion to employee_lifecycle_requests so Superadmin lifecycle queue sees it
INSERT INTO employee_lifecycle_requests (
  id, manager_employee_id, employee_id, proposed_role, proposed_team_id,
  effective_date, business_justification, handoff_plan, status, hr_notified
)
VALUES
  (
    'REQ-HR-002',
    'EMP-014',
    'EMP-001',
    'SC',
    'TEAM-WEALTH-BETA',
    '2026-10-15',
    'Approved effective-dated team transfer submitted by HR (REQ-HR-002)',
    'Named handoff owners: Leads reassigned to Ravi Menon; Tasks to Tara Iyer',
    'approved',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Availability & Leave fixtures (HR-05, Deck P285)
INSERT INTO employee_leaves (
  id, employee_id, absence_type, policy_reference, start_date, end_date,
  coverage_owner_role, coverage_employee_id, coverage_notes, allocation_status,
  leads_reassignment_confirmed, status, recorded_by_employee_id
)
VALUES
  (
    'LEV-001',
    'EMP-001',
    'approved_leave',
    'POL-LEAVE-2026',
    '2026-09-28',
    '2026-09-30',
    'TL',
    'EMP-003',
    'Team lead Tara Iyer managing critical follow-ups during leave interval',
    'unavailable',
    true,
    'active',
    'EMP-014'
  ),
  (
    'LEV-002',
    'EMP-004',
    'annual_leave',
    'POL-LEAVE-2026',
    '2026-10-20',
    '2026-10-24',
    'TL',
    'EMP-003',
    'Banking Alpha coverage coordinated with Dev Kapoor',
    'unavailable',
    false,
    'active',
    'EMP-014'
  )
ON CONFLICT (id) DO NOTHING;

-- Training, Probation & Milestone fixtures (HR-06, Deck P287)
INSERT INTO employee_training_milestones (
  id, employee_id, milestone_type, title, required_modules, due_date,
  supervisor_employee_id, status, evidence_summary, reviewer_employee_id
)
VALUES
  (
    'FV-1042',
    'EMP-004',
    'probation_review',
    'Probation Review & Permanent Confirmation',
    'Banking Product Knowledge & Regulatory Sandbox',
    '2026-09-30',
    'EMP-005',
    'active',
    'Interim performance rating 4.2/5; 2 compliance modules pending',
    'EMP-014'
  ),
  (
    'FV-1068',
    'EMP-001',
    'new_hire_training',
    'New Hire Regulatory & Conduct Certification',
    'KYC/AML Standards, SEBI Investment Advisory Guidelines',
    '2026-10-15',
    'EMP-003',
    'active',
    'All modules in progress (80% complete)',
    'EMP-014'
  ),
  (
    'FV-1091',
    'EMP-004',
    'annual_conduct',
    'Annual Conduct & Anti-Bribery Review',
    'Code of Business Conduct & Ethics 2026',
    '2026-10-05',
    'EMP-005',
    'review',
    'Module completed; supervisor sign-off submitted',
    'EMP-014'
  ),
  (
    'FV-1105',
    'EMP-002',
    'licensing_exam',
    'HNW Advisory Certification',
    'NISM Series X-A / X-B Investment Adviser Modules',
    '2026-11-01',
    'EMP-003',
    'active',
    'Exam registered for 28 Oct',
    'EMP-014'
  )
ON CONFLICT (id) DO NOTHING;

-- Initial People Operations Pack (HR-07, Deck P289)
INSERT INTO people_operations_reports (
  id, period_label, workforce_scope, included_sections, metrics_summary,
  file_path, file_size_bytes, generated_by_employee_id, recipient_role, redaction_applied
)
VALUES
  (
    'HR-REP-001',
    '2026-Q3',
    'all',
    ARRAY['joiners', 'movers', 'leavers', 'reviews'],
    '{"completed": 72, "in_progress": 48, "needs_review": 21, "excluded": 8}'::jsonb,
    'data/hr_exports/people_pack_2026-Q3.pdf',
    24576,
    'EMP-014',
    'HR',
    true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO people_report_schedules (
  id, frequency, workforce_scope, recipient_emails, sections, created_by_employee_id, is_active
)
VALUES
  (
    'SCHED-HR-001',
    'monthly',
    'all',
    ARRAY['pooja@finverse.demo', 'rajiv@finverse.demo'],
    ARRAY['joiners', 'movers', 'leavers', 'reviews', 'availability'],
    'EMP-014',
    true
  )
ON CONFLICT (id) DO NOTHING;
