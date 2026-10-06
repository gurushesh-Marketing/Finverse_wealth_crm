-- Migration 0006 — TL defense-in-depth + forecast version uniqueness.
ALTER TABLE activity_corrections DROP CONSTRAINT IF EXISTS activity_corrections_field_check;
ALTER TABLE activity_corrections ADD CONSTRAINT activity_corrections_field_check
  CHECK (requested_field IN ('wrapup_disposition', 'status', 'wrapup_note'));

CREATE UNIQUE INDEX IF NOT EXISTS team_forecasts_version_unique
  ON team_forecasts (team_id, period_label, category, version);
