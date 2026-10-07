BEGIN;

CREATE TABLE IF NOT EXISTS vegetation_monitors(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_analysis_id UUID NOT NULL REFERENCES remote_sensing_analyses(id) ON DELETE RESTRICT,
  aoi GEOMETRY(MULTIPOLYGON,4326) NOT NULL,
  reference_date DATE NOT NULL,
  reference_mean_ndvi NUMERIC,
  reference_vegetation_ha NUMERIC NOT NULL,
  vegetation_threshold NUMERIC(4,2) NOT NULL CHECK(vegetation_threshold BETWEEN -1 AND 1),
  observation_window_days INTEGER NOT NULL DEFAULT 7 CHECK(observation_window_days BETWEEN 1 AND 30),
  cadence_days INTEGER NOT NULL DEFAULT 14 CHECK(cadence_days BETWEEN 1 AND 90),
  minimum_clear_fraction NUMERIC(4,3) NOT NULL DEFAULT 0.60 CHECK(minimum_clear_fraction BETWEEN 0 AND 1),
  alert_loss_pct NUMERIC(6,2) NOT NULL DEFAULT 10 CHECK(alert_loss_pct BETWEEN 0.1 AND 100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vegetation_monitor_observations(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES vegetation_monitors(id) ON DELETE CASCADE,
  observed_for DATE NOT NULL,
  scene JSONB,
  mean_ndvi NUMERIC,
  clear_fraction NUMERIC,
  vegetation_ha NUMERIC,
  change_ha NUMERIC,
  change_pct NUMERIC,
  severity TEXT NOT NULL DEFAULT 'low' CHECK(severity IN('low','medium','high','critical')),
  status TEXT NOT NULL CHECK(status IN('completed','low_coverage','failed')),
  error_message TEXT,
  raw_stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(monitor_id,observed_for)
);

CREATE TABLE IF NOT EXISTS vegetation_alerts(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES vegetation_monitors(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL UNIQUE REFERENCES vegetation_monitor_observations(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK(severity IN('medium','high','critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  vegetation_change_ha NUMERIC,
  vegetation_change_pct NUMERIC,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vegetation_monitors_aoi ON vegetation_monitors USING GIST(aoi);
CREATE INDEX IF NOT EXISTS idx_vegetation_monitors_due ON vegetation_monitors(active,next_due_at);
CREATE INDEX IF NOT EXISTS idx_vegetation_observations_monitor ON vegetation_monitor_observations(monitor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vegetation_alerts_open ON vegetation_alerts(created_at DESC) WHERE acknowledged_at IS NULL;

DROP TRIGGER IF EXISTS trg_touch_vegetation_monitors ON vegetation_monitors;
CREATE TRIGGER trg_touch_vegetation_monitors
BEFORE UPDATE ON vegetation_monitors
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
