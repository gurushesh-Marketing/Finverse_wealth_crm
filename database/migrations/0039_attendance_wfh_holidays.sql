-- Migration: 0039_attendance_wfh_holidays.sql
-- Description: HRMS Slice 2 & 3 - Attendance, Paid WFH, Holiday Calendars, and Resource Visibility Engine

-- 1. Configured Work Locations (City/State/Jurisdiction)
CREATE TABLE IF NOT EXISTS work_locations (
    id text PRIMARY KEY,
    name text NOT NULL,
    state text NOT NULL,
    country text NOT NULL DEFAULT 'India',
    timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    weekly_off_days int[] NOT NULL DEFAULT '{0,6}', -- 0 = Sunday, 6 = Saturday
    created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Seed baseline office work locations
INSERT INTO work_locations (id, name, state, weekly_off_days)
VALUES 
    ('LOC-MUM', 'Mumbai Main Campus', 'Maharashtra', '{0,6}'),
    ('LOC-BLR', 'Bengaluru Tech Park', 'Karnataka', '{0,6}'),
    ('LOC-DEL', 'Delhi Regional Hub', 'Delhi NCR', '{0,6}')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    state = EXCLUDED.state;

-- Add work_location_id to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS work_location_id text REFERENCES work_locations(id) DEFAULT 'LOC-MUM';

-- Update demo employees with configured work locations
UPDATE employees SET work_location_id = 'LOC-MUM' WHERE id IN ('EMP-001', 'EMP-003', 'EMP-004', 'EMP-005', 'EMP-006', 'EMP-007', 'EMP-008', 'EMP-010', 'EMP-011', 'EMP-014', 'EMP-015');
UPDATE employees SET work_location_id = 'LOC-BLR' WHERE id = 'EMP-002'; -- Ravi Menon in Bengaluru

-- 2. Location-Based Holiday Calendars & Statutory Policies
CREATE TABLE IF NOT EXISTS holiday_calendars (
    id text PRIMARY KEY,
    work_location_id text NOT NULL REFERENCES work_locations(id),
    calendar_year int NOT NULL,
    policy_name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_location_year UNIQUE (work_location_id, calendar_year)
);

INSERT INTO holiday_calendars (id, work_location_id, calendar_year, policy_name, description)
VALUES
    ('CAL-MUM-2026', 'LOC-MUM', 2026, 'Maharashtra Commercial & Statutory Holidays', 'Applies to employees based in Mumbai campus regardless of vertical'),
    ('CAL-BLR-2026', 'LOC-BLR', 2026, 'Karnataka Commercial & Statutory Holidays', 'Applies to employees based in Bengaluru tech park regardless of vertical'),
    ('CAL-DEL-2026', 'LOC-DEL', 2026, 'Delhi NCR Commercial & Statutory Holidays', 'Applies to employees based in Delhi regional hub')
ON CONFLICT (id) DO NOTHING;

-- 3. Calendar Holidays
CREATE TABLE IF NOT EXISTS calendar_holidays (
    id text PRIMARY KEY,
    calendar_id text NOT NULL REFERENCES holiday_calendars(id) ON DELETE CASCADE,
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    holiday_type text NOT NULL CHECK (holiday_type IN ('mandatory', 'statutory', 'festival', 'optional')),
    description text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_calendar_holiday UNIQUE (calendar_id, holiday_date)
);

-- Common Statutory & National Holidays for 2026
INSERT INTO calendar_holidays (id, calendar_id, holiday_date, holiday_name, holiday_type)
VALUES
    ('HOL-MUM-REP', 'CAL-MUM-2026', '2026-01-26', 'Republic Day', 'mandatory'),
    ('HOL-MUM-HOL', 'CAL-MUM-2026', '2026-03-04', 'Holi Festival', 'festival'),
    ('HOL-MUM-MAH', 'CAL-MUM-2026', '2026-05-01', 'Maharashtra Day', 'statutory'),
    ('HOL-MUM-IND', 'CAL-MUM-2026', '2026-08-15', 'Independence Day', 'mandatory'),
    ('HOL-MUM-GAN', 'CAL-MUM-2026', '2026-09-14', 'Ganesh Chaturthi', 'festival'),
    ('HOL-MUM-GAN-J', 'CAL-MUM-2026', '2026-10-02', 'Mahatma Gandhi Jayanti', 'mandatory'),
    ('HOL-MUM-DIW-1', 'CAL-MUM-2026', '2026-11-08', 'Diwali Laxmi Pujan', 'festival'),
    ('HOL-MUM-DIW-2', 'CAL-MUM-2026', '2026-11-09', 'Diwali Balipratipada', 'festival'),
    ('HOL-MUM-XMAS', 'CAL-MUM-2026', '2026-12-25', 'Christmas Day', 'festival'),
    -- Bengaluru specific
    ('HOL-BLR-REP', 'CAL-BLR-2026', '2026-01-26', 'Republic Day', 'mandatory'),
    ('HOL-BLR-IND', 'CAL-BLR-2026', '2026-08-15', 'Independence Day', 'mandatory'),
    ('HOL-BLR-GAN-J', 'CAL-BLR-2026', '2026-10-02', 'Mahatma Gandhi Jayanti', 'mandatory'),
    ('HOL-BLR-AYU', 'CAL-BLR-2026', '2026-10-20', 'Ayudha Puja / Dussehra', 'festival'),
    ('HOL-BLR-KAN', 'CAL-BLR-2026', '2026-11-01', 'Kannada Rajyotsava', 'statutory'),
    ('HOL-BLR-DIW-1', 'CAL-BLR-2026', '2026-11-08', 'Deepavali Festival', 'festival'),
    ('HOL-BLR-XMAS', 'CAL-BLR-2026', '2026-12-25', 'Christmas Day', 'festival')
ON CONFLICT (id) DO NOTHING;

-- 4. Attendance Records (Zero CRM Login = Attendance; Zero Low Activity = Absent)
CREATE TABLE IF NOT EXISTS attendance_records (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    work_date date NOT NULL,
    work_mode text NOT NULL CHECK (work_mode IN ('office', 'wfh', 'field')),
    check_in_at timestamptz NOT NULL,
    check_out_at timestamptz,
    total_hours numeric(4,2),
    wfh_progress_summary text,
    work_evidence_url text,
    status text NOT NULL CHECK (status IN ('confirmed', 'pending_confirmation', 'regularization_requested', 'rejected')) DEFAULT 'pending_confirmation',
    is_offline_work boolean NOT NULL DEFAULT false,
    crm_activity_count int NOT NULL DEFAULT 0,
    reviewed_by_employee_id text REFERENCES employees(id),
    reviewed_at timestamptz,
    review_notes text,
    record_version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_work_date UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance_records(work_date, status);

-- 5. Role-Appropriate Progress Update Logs
CREATE TABLE IF NOT EXISTS attendance_progress_logs (
    id text PRIMARY KEY,
    attendance_record_id text NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    logged_at timestamptz NOT NULL DEFAULT NOW(),
    deliverable_title text NOT NULL,
    deliverable_progress_pct int NOT NULL CHECK (deliverable_progress_pct BETWEEN 0 AND 100),
    notes text,
    evidence_artifact_path text,
    is_offline_deliverable boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_prog_log_att_id ON attendance_progress_logs(attendance_record_id);

-- 6. Auditable Correction / Regularization Process
CREATE TABLE IF NOT EXISTS attendance_regularization_requests (
    id text PRIMARY KEY,
    attendance_record_id text REFERENCES attendance_records(id) ON DELETE SET NULL,
    employee_id text NOT NULL REFERENCES employees(id),
    work_date date NOT NULL,
    requested_work_mode text NOT NULL CHECK (requested_work_mode IN ('office', 'wfh', 'field')),
    requested_check_in_at timestamptz NOT NULL,
    requested_check_out_at timestamptz NOT NULL,
    reason text NOT NULL,
    progress_summary text,
    status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    supervisor_employee_id text NOT NULL REFERENCES employees(id),
    decision_notes text,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_req_sup_status ON attendance_regularization_requests(supervisor_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_req_emp_date ON attendance_regularization_requests(employee_id, work_date);
