BEGIN;

CREATE TABLE IF NOT EXISTS remote_sensing_analyses(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aoi GEOMETRY(MULTIPOLYGON,4326) NOT NULL,
  baseline_date DATE NOT NULL,
  comparison_date DATE NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 7 CHECK(window_days BETWEEN 1 AND 30),
  vegetation_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.30 CHECK(vegetation_threshold BETWEEN -1 AND 1),
  provider TEXT NOT NULL DEFAULT 'copernicus_dataspace',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','waiting_configuration','running','completed','failed')),
  baseline_mean_ndvi NUMERIC,
  comparison_mean_ndvi NUMERIC,
  baseline_clear_fraction NUMERIC,
  comparison_clear_fraction NUMERIC,
  baseline_vegetation_ha NUMERIC,
  comparison_vegetation_ha NUMERIC,
  vegetation_change_ha NUMERIC,
  vegetation_change_pct NUMERIC,
  change_level TEXT NOT NULL DEFAULT 'low' CHECK(change_level IN('low','medium','high','critical')),
  baseline_scene JSONB,
  comparison_scene JSONB,
  baseline_stats JSONB,
  comparison_stats JSONB,
  publish_to_map BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_remote_sensing_aoi ON remote_sensing_analyses USING GIST(aoi);
CREATE INDEX IF NOT EXISTS idx_remote_sensing_created_at ON remote_sensing_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_sensing_status ON remote_sensing_analyses(status,publish_to_map);

DROP TRIGGER IF EXISTS trg_touch_remote_sensing_analyses ON remote_sensing_analyses;
CREATE TRIGGER trg_touch_remote_sensing_analyses
BEFORE UPDATE ON remote_sensing_analyses
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
