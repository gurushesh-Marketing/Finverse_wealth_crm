-- ====================================================================
-- Migration: 0038_employee_leave_requests.sql
-- HRMS Slice 1: Multi-Tier Leave Request & Superior Approval Engine
-- Supports every role across every vertical, explicit approver configs,
-- supervisory span isolation, and zero self-approval.
-- ====================================================================

-- 1. Employee Leave Requests table
CREATE TABLE IF NOT EXISTS employee_leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid', 'bereavement', 'paternity', 'maternity', 'annual')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL CHECK (total_days > 0),
  reason TEXT NOT NULL,
  handover_notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'withdrawn')) DEFAULT 'submitted',
  current_approver_id TEXT REFERENCES employees(id),
  decided_by_employee_id TEXT REFERENCES employees(id),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  record_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_leave_req_emp ON employee_leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_emp_leave_req_approver ON employee_leave_requests(current_approver_id, status);
CREATE INDEX IF NOT EXISTS idx_emp_leave_req_dates ON employee_leave_requests(start_date, end_date);

-- 2. Leave Approval Actions (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS leave_approval_actions (
  id TEXT PRIMARY KEY,
  leave_request_id TEXT NOT NULL REFERENCES employee_leave_requests(id) ON DELETE CASCADE,
  actor_employee_id TEXT NOT NULL REFERENCES employees(id),
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'withdrawn', 'escalated')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_actions_req ON leave_approval_actions(leave_request_id, created_at);

-- 3. Approver Configurations (For Governance & Exec Roles or Overrides)
CREATE TABLE IF NOT EXISTS approver_configurations (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  role TEXT CHECK (role IS NULL OR role IN ('CEO', 'CFO', 'HR', 'SA', 'DE', 'SC', 'TL', 'MG', 'RM', 'NM')),
  vertical TEXT CHECK (vertical IS NULL OR vertical IN ('wealth', 'banking', 'markets', 'real_estate')),
  approver_employee_id TEXT REFERENCES employees(id),
  approver_title TEXT NOT NULL,
  is_configured BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_by_employee_id TEXT REFERENCES employees(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_config_emp ON approver_configurations(employee_id) WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_config_role ON approver_configurations(role, vertical) WHERE employee_id IS NULL AND vertical IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_config_role_global ON approver_configurations(role) WHERE employee_id IS NULL AND vertical IS NULL;

-- 4. Seed Standard Governance Approver Configurations
-- DE -> HR / People Ops Lead (EMP-014 Pooja Sharma)
INSERT INTO approver_configurations (id, role, vertical, approver_employee_id, approver_title, is_configured, notes)
VALUES ('CFG-APPROVER-DE', 'DE', NULL, 'EMP-014', 'People Operations Lead', true, 'Data Entry staff report to People Operations Lead for leave approval')
ON CONFLICT (id) DO NOTHING;

-- HR -> CEO (EMP-010 Rajiv Mehta)
INSERT INTO approver_configurations (id, role, vertical, approver_employee_id, approver_title, is_configured, notes)
VALUES ('CFG-APPROVER-HR', 'HR', NULL, 'EMP-010', 'Chief Executive Officer', true, 'HR specialists report directly to CEO for leave governance')
ON CONFLICT (id) DO NOTHING;

-- SA -> CEO (EMP-010 Rajiv Mehta)
INSERT INTO approver_configurations (id, role, vertical, approver_employee_id, approver_title, is_configured, notes)
VALUES ('CFG-APPROVER-SA', 'SA', NULL, 'EMP-010', 'Chief Executive Officer', true, 'Super Administrators report directly to CEO for operational continuity')
ON CONFLICT (id) DO NOTHING;

-- CFO -> CEO (EMP-010 Rajiv Mehta)
INSERT INTO approver_configurations (id, role, vertical, approver_employee_id, approver_title, is_configured, notes)
VALUES ('CFG-APPROVER-CFO', 'CFO', NULL, 'EMP-010', 'Chief Executive Officer', true, 'Finance Leadership reports directly to CEO')
ON CONFLICT (id) DO NOTHING;

-- CEO -> Board of Directors / Compensation Chair (Unconfigured by default as required by specification)
-- Must be explicitly configured; self-approval strictly forbidden
INSERT INTO approver_configurations (id, role, vertical, approver_employee_id, approver_title, is_configured, notes)
VALUES ('CFG-APPROVER-CEO', 'CEO', NULL, NULL, 'Board Compensation Committee', false, 'Requires explicit Board delegate appointment; self-approval blocked')
ON CONFLICT (id) DO NOTHING;
