BEGIN;

CREATE TABLE IF NOT EXISTS field_acceptance_runs(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lga_code TEXT NOT NULL REFERENCES lgas(code),
  device_label TEXT NOT NULL,
  device_info TEXT,
  network_context TEXT,
  app_version TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK(status IN ('in_progress','completed')),
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK(result IN ('pending','pass','fail','conditional')),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK((status='in_progress' AND result='pending' AND completed_at IS NULL)
    OR (status='completed' AND result<>'pending' AND completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_field_acceptance_runs_lga
  ON field_acceptance_runs(lga_code,status,completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_acceptance_runs_result
  ON field_acceptance_runs(result,completed_at DESC);

DROP TRIGGER IF EXISTS trg_touch_field_acceptance_runs ON field_acceptance_runs;
CREATE TRIGGER trg_touch_field_acceptance_runs
BEFORE UPDATE ON field_acceptance_runs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS field_acceptance_checks(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES field_acceptance_runs(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  instructions TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_run'
    CHECK(status IN ('not_run','pass','fail','blocked','not_applicable')),
  notes TEXT,
  tested_at TIMESTAMPTZ,
  tested_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id,check_key)
);

CREATE INDEX IF NOT EXISTS idx_field_acceptance_checks_run
  ON field_acceptance_checks(run_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_field_acceptance_checks_status
  ON field_acceptance_checks(run_id,status);

DROP TRIGGER IF EXISTS trg_touch_field_acceptance_checks ON field_acceptance_checks;
CREATE TRIGGER trg_touch_field_acceptance_checks
BEFORE UPDATE ON field_acceptance_checks
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS field_acceptance_evidence(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES field_acceptance_runs(id) ON DELETE CASCADE,
  check_key TEXT,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(run_id,check_key)
    REFERENCES field_acceptance_checks(run_id,check_key)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_field_acceptance_evidence_run
  ON field_acceptance_evidence(run_id,uploaded_at DESC);

COMMIT;
