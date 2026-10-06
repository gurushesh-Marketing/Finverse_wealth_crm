CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  vertical text NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id),
  role text NOT NULL,
  vertical text NOT NULL,
  team_id text NOT NULL REFERENCES teams(id),
  effective_from date NOT NULL,
  effective_to date
);

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  vertical text NOT NULL,
  display_name text NOT NULL,
  email text,
  phone text NOT NULL,
  preferred_language text NOT NULL,
  product text NOT NULL,
  source text NOT NULL,
  stage text NOT NULL CHECK (
    stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified', 'converted', 'lost')
  ),
  owner_employee_id text REFERENCES employees(id),
  team_id text REFERENCES teams(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  record_version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lead_tasks (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  owner_employee_id text NOT NULL REFERENCES employees(id),
  action text NOT NULL,
  purpose text NOT NULL,
  due_at timestamptz NOT NULL,
  priority text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS lead_events (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  actor_employee_id text NOT NULL REFERENCES employees(id),
  kind text NOT NULL,
  note text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads (owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_leads_team ON leads (team_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_owner_status ON lead_tasks (owner_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events (lead_id, occurred_at);
