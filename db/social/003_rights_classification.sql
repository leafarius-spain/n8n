-- Migration 003: Add rights_classification column for SGAE rights categorization.
-- Axis orthogonal to candidate_status: CON_DERECHOS | SIN_DERECHOS | DUDOSO (or NULL = not classified / NO_EVENTO).

ALTER TABLE post_analysis
  ADD COLUMN IF NOT EXISTS rights_classification TEXT
  CHECK (rights_classification IN ('CON_DERECHOS', 'SIN_DERECHOS', 'DUDOSO') OR rights_classification IS NULL);

ALTER TABLE candidate_events
  ADD COLUMN IF NOT EXISTS rights_classification TEXT
  CHECK (rights_classification IN ('CON_DERECHOS', 'SIN_DERECHOS', 'DUDOSO') OR rights_classification IS NULL);

CREATE INDEX IF NOT EXISTS idx_post_analysis_rights
  ON post_analysis (rights_classification)
  WHERE rights_classification IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_events_rights
  ON candidate_events (rights_classification)
  WHERE rights_classification IS NOT NULL;
