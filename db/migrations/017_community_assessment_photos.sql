BEGIN;
ALTER TABLE community_maintenance_assessments
  ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;
CREATE INDEX IF NOT EXISTS idx_community_maintenance_assessments_verified_evidence
  ON community_maintenance_assessments(intervention_id,assessed_on DESC)
  WHERE verification_status='verified' AND evidence_photo_url IS NOT NULL;
COMMIT;