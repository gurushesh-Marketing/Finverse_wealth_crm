-- Public website enquiry intake (RELEASE_ISSUES P0-10).
-- Website form submissions land in intake_rows as staged Data Entry drafts.
-- listManualRecords requires entered_by_employee_id, so website rows are attributed
-- to this dedicated non-login actor (same pattern as EMP-SYSTEM-ROUTING, 0050).
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES ('EMP-SYSTEM-WEBSITE', 'website-intake@finverse.invalid', 'disabled-system-account',
        'Website Enquiries', 'disabled')
ON CONFLICT (id) DO NOTHING;

-- The website source already exists on databases built from 0022; ensure it on any
-- install where it was removed, without overwriting operator edits.
INSERT INTO intake_sources (id, source_code, source_name, vendor_name, collection_basis,
                            effective_from, permitted_verticals, status, notes)
VALUES ('SRC-WEB-01', 'WEB-DIRECT', 'Website Direct Inbound', 'Finverse Digital Inbound',
        'Explicit web form opt-in (call / WhatsApp consent captured per submission)',
        CURRENT_DATE, ARRAY['wealth','banking','markets','real-estate'], 'active',
        'Public website forms on finversewealthtrade.com')
ON CONFLICT (id) DO NOTHING;

-- Idempotent replays of the same browser submission look up this key.
CREATE INDEX IF NOT EXISTS idx_intake_rows_web_idempotency
  ON intake_rows ((raw_payload->>'idempotencyKey'))
  WHERE parsed_source = 'Website Direct Inbound';
