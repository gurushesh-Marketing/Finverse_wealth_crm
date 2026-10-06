-- Migration 0005 — TL fixes: widen team_requests category CHECK (merge-request
-- routes identity merges to the data steward as match-review references).
ALTER TABLE team_requests DROP CONSTRAINT IF EXISTS team_requests_category_check;
ALTER TABLE team_requests ADD CONSTRAINT team_requests_category_check
  CHECK (category IN ('staffing', 'role-change', 'capacity', 'complaint', 'commercial-exception', 'merge-request'));
