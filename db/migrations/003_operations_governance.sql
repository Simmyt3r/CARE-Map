BEGIN;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

CREATE TABLE IF NOT EXISTS report_status_history(
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  actor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reports_due_at ON reports(due_at) WHERE status NOT IN ('resolved','rejected');
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority,status);
CREATE INDEX IF NOT EXISTS idx_report_status_history_report ON report_status_history(report_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);

INSERT INTO report_status_history(report_id,from_status,to_status,note,actor_id,created_at)
SELECT id,NULL,status,'Initial history backfill',NULL,submitted_at
FROM reports r
WHERE NOT EXISTS(SELECT 1 FROM report_status_history h WHERE h.report_id=r.id);

COMMIT;
