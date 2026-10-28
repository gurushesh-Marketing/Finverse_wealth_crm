-- Migration: 0040_compensation_payroll_preview.sql
-- Description: HRMS Slice 4 - Effective-Dated Compensation Plans, Audit History & Non-overlapping 28th–27th Payroll Preview Engine

-- 1. Extend employees with joining_date
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS joining_date date DEFAULT '2026-01-01';

-- Configure demo employees joining dates (Dev Kapoor EMP-004 joined 10 Jan 2026)
UPDATE employees SET joining_date = '2026-01-10' WHERE id = 'EMP-004';
UPDATE employees SET joining_date = '2026-01-01' WHERE id != 'EMP-004' AND (joining_date IS NULL OR joining_date = '2026-01-01');

-- 2. Effective-Dated Employee Compensation Plans
CREATE TABLE IF NOT EXISTS employee_compensation_plans (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    effective_from date NOT NULL,
    effective_to date, -- NULL indicates current ongoing structure
    currency text NOT NULL DEFAULT 'INR',
    monthly_ctc numeric(12,2) NOT NULL CHECK (monthly_ctc > 0),
    basic_pay numeric(12,2) NOT NULL CHECK (basic_pay > 0),
    hra numeric(12,2) NOT NULL DEFAULT 0,
    special_allowance numeric(12,2) NOT NULL DEFAULT 0,
    statutory_pf_employee numeric(12,2) NOT NULL DEFAULT 0,
    statutory_pf_employer numeric(12,2) NOT NULL DEFAULT 0,
    professional_tax numeric(12,2) NOT NULL DEFAULT 0,
    tds_estimate numeric(12,2) NOT NULL DEFAULT 0,
    notes text,
    created_by_employee_id text NOT NULL REFERENCES employees(id),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    record_version int NOT NULL DEFAULT 1,
    CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_comp_plans_emp ON employee_compensation_plans(employee_id, effective_from);

-- 3. Immutable Compensation Change Audit Log
CREATE TABLE IF NOT EXISTS compensation_change_logs (
    id text PRIMARY KEY,
    plan_id text NOT NULL REFERENCES employee_compensation_plans(id) ON DELETE CASCADE,
    employee_id text NOT NULL REFERENCES employees(id),
    changed_by_employee_id text NOT NULL REFERENCES employees(id),
    action text NOT NULL CHECK (action IN ('created', 'revised', 'closed')),
    previous_state jsonb,
    new_state jsonb,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_logs_emp ON compensation_change_logs(employee_id, created_at DESC);

-- 4. Payroll Cycles (Strict Non-Overlapping 28th–27th with Mid-Cycle Joiner Exception Period)
CREATE TABLE IF NOT EXISTS payroll_cycles (
    id text PRIMARY KEY,
    cycle_code text NOT NULL UNIQUE,
    cycle_label text NOT NULL,
    period_start_date date NOT NULL,
    period_end_date date NOT NULL,
    total_calendar_days int NOT NULL,
    status text NOT NULL CHECK (status IN ('preview', 'policy_blocked', 'locked', 'certified')) DEFAULT 'preview',
    is_initial_joiner_cycle boolean NOT NULL DEFAULT false,
    unresolved_policy_gates jsonb NOT NULL DEFAULT '{
        "first_payment_date_confirmed": false,
        "divisor_formula_confirmed": false,
        "statutory_rules_confirmed": false,
        "leave_pay_rules_confirmed": false
    }'::jsonb,
    policy_block_notes text NOT NULL DEFAULT 'Payroll finalization and export blocked pending executive confirmation of statutory divisor and first lawful payment deadline [Deck P320].',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cycle_dates CHECK (period_end_date >= period_start_date)
);

-- Seed Canonical Payroll Cycles
INSERT INTO payroll_cycles (id, cycle_code, cycle_label, period_start_date, period_end_date, total_calendar_days, is_initial_joiner_cycle, status)
VALUES
    ('CYC-2026-01-INIT', '2026-01-INITIAL', 'Mid-Cycle Joiner Initial Period (10–27 Jan 2026)', '2026-01-10', '2026-01-27', 18, true, 'preview'),
    ('CYC-2026-01-STD', '2026-01-STD', 'Standard Cycle Jan 2026 (28 Dec 2025 – 27 Jan 2026)', '2025-12-28', '2026-01-27', 31, false, 'preview'),
    ('CYC-2026-02-STD', '2026-02-STD', 'Standard Cycle Feb 2026 (28 Jan 2026 – 27 Feb 2026)', '2026-01-28', '2026-02-27', 31, false, 'preview'),
    ('CYC-2026-03-STD', '2026-03-STD', 'Standard Cycle Mar 2026 (28 Feb 2026 – 27 Mar 2026)', '2026-02-28', '2026-03-27', 28, false, 'preview')
ON CONFLICT (id) DO UPDATE SET
    cycle_label = EXCLUDED.cycle_label,
    total_calendar_days = EXCLUDED.total_calendar_days;

-- 5. Seed Initial Compensation Plans & Audit Logs
INSERT INTO employee_compensation_plans (
    id, employee_id, effective_from, effective_to, currency, 
    monthly_ctc, basic_pay, hra, special_allowance, 
    statutory_pf_employee, statutory_pf_employer, professional_tax, tds_estimate, 
    notes, created_by_employee_id
)
VALUES
    ('PLAN-EMP-001-V1', 'EMP-001', '2026-01-01', NULL, 'INR', 80000.00, 40000.00, 20000.00, 20000.00, 1800.00, 1800.00, 200.00, 2500.00, 'Baseline Wealth Senior Caller Plan', 'EMP-014'),
    ('PLAN-EMP-002-V1', 'EMP-002', '2026-01-01', NULL, 'INR', 120000.00, 60000.00, 30000.00, 30000.00, 1800.00, 1800.00, 200.00, 5000.00, 'Baseline Wealth Team Leader Plan', 'EMP-014'),
    ('PLAN-EMP-004-V1', 'EMP-004', '2026-01-10', NULL, 'INR', 75000.00, 37500.00, 18750.00, 18750.00, 1800.00, 1800.00, 200.00, 2000.00, 'Banking Caller Initial Offer (Joined 10 Jan 2026)', 'EMP-014'),
    ('PLAN-EMP-007-V1', 'EMP-007', '2026-01-01', NULL, 'INR', 180000.00, 90000.00, 45000.00, 45000.00, 1800.00, 1800.00, 200.00, 12000.00, 'Baseline Wealth Branch Manager Plan', 'EMP-014'),
    ('PLAN-EMP-014-V1', 'EMP-014', '2026-01-01', NULL, 'INR', 110000.00, 55000.00, 27500.00, 27500.00, 1800.00, 1800.00, 200.00, 4500.00, 'HR Operations Specialist Plan', 'EMP-010')
ON CONFLICT (id) DO NOTHING;

INSERT INTO compensation_change_logs (id, plan_id, employee_id, changed_by_employee_id, action, new_state, reason)
VALUES
    ('LOG-PLAN-EMP-001', 'PLAN-EMP-001-V1', 'EMP-001', 'EMP-014', 'created', '{"monthly_ctc": 80000, "basic": 40000}'::jsonb, 'Initial system onboarding salary record'),
    ('LOG-PLAN-EMP-002', 'PLAN-EMP-002-V1', 'EMP-002', 'EMP-014', 'created', '{"monthly_ctc": 120000, "basic": 60000}'::jsonb, 'Initial system onboarding salary record'),
    ('LOG-PLAN-EMP-004', 'PLAN-EMP-004-V1', 'EMP-004', 'EMP-014', 'created', '{"monthly_ctc": 75000, "basic": 37500}'::jsonb, 'New joiner appointment effective 10 Jan 2026'),
    ('LOG-PLAN-EMP-007', 'PLAN-EMP-007-V1', 'EMP-007', 'EMP-014', 'created', '{"monthly_ctc": 180000, "basic": 90000}'::jsonb, 'Initial system onboarding salary record'),
    ('LOG-PLAN-EMP-014', 'PLAN-EMP-014-V1', 'EMP-014', 'EMP-010', 'created', '{"monthly_ctc": 110000, "basic": 55000}'::jsonb, 'Initial system onboarding salary record ratified by CEO')
ON CONFLICT (id) DO NOTHING;
