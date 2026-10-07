BEGIN;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'community'
    CHECK(origin IN('community','staff','satellite_alert')),
  ADD COLUMN IF NOT EXISTS origin_ref_id UUID;

ALTER TABLE vegetation_alerts
  ADD COLUMN IF NOT EXISTS verification_report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_requested_by UUID REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_origin_ref
  ON reports(origin,origin_ref_id)
  WHERE origin_ref_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vegetation_alert_verification_report
  ON vegetation_alerts(verification_report_id)
  WHERE verification_report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_origin
  ON reports(origin,status,submitted_at DESC);

COMMIT;
