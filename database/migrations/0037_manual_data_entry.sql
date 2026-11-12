-- Manual Data Entry is a narrow, non-allocation workflow. Preserve the existing
-- intake table and all earlier records; new rows carry explicit scope and owner.
ALTER TABLE intake_rows ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE intake_rows ADD COLUMN IF NOT EXISTS entered_by_employee_id TEXT REFERENCES employees(id);
ALTER TABLE intake_rows ADD COLUMN IF NOT EXISTS parsed_whatsapp_phone TEXT;
ALTER TABLE intake_rows ADD COLUMN IF NOT EXISTS location_text TEXT;

CREATE INDEX IF NOT EXISTS idx_intake_rows_manual_owner
  ON intake_rows (entered_by_employee_id, created_at DESC)
  WHERE entered_by_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intake_rows_manual_vertical
  ON intake_rows (vertical, created_at DESC)
  WHERE entered_by_employee_id IS NOT NULL;
