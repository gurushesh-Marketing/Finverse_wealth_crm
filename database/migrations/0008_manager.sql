-- Migration 0008 — Wealth Manager (MG) foundation: management actions (MG-01 intervention owner,
-- MG-02 management action). Manager scope is derived from effective MG assignments on teams;
-- TLs in scope are employees with an effective TL assignment on those teams. No role grants here.

CREATE TABLE IF NOT EXISTS management_actions (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  source_action text NOT NULL CHECK (source_action IN ('MG-01', 'MG-02', 'MG-08', 'MG-11')),
  kind text NOT NULL CHECK (kind IN ('intervention', 'coaching', 'capacity', 'follow-up')),
  subject_tl_employee_id text NOT NULL REFERENCES employees(id),
  owner_employee_id text NOT NULL REFERENCES employees(id),
  team_id text REFERENCES teams(id),
  metric_key text,
  period_label text,
  title text NOT NULL,
  detail text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mgmt_actions_manager ON management_actions (manager_employee_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_mgmt_actions_subject ON management_actions (subject_tl_employee_id, status);
