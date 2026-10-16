BEGIN;

CREATE TABLE IF NOT EXISTS statewide_ndvi_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_name TEXT NOT NULL,
  baseline_date DATE NOT NULL,
  comparison_date DATE NOT NULL,
  window_days INTEGER NOT NULL CHECK(window_days BETWEEN 1 AND 30),
  vegetation_threshold NUMERIC(4,2) NOT NULL CHECK(vegetation_threshold BETWEEN -1 AND 1),
  minimum_clear_fraction NUMERIC(4,2) NOT NULL DEFAULT 0.60,
  tile_degrees NUMERIC(5,3) NOT NULL DEFAULT 0.100,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','needs_review')),
  total_tiles INTEGER NOT NULL DEFAULT 0 CHECK(total_tiles >= 0),
  expected_lgas INTEGER NOT NULL CHECK(expected_lgas > 0),
  source_note TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_statewide_ndvi_one_active
  ON statewide_ndvi_jobs((1)) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS idx_statewide_ndvi_jobs_date
  ON statewide_ndvi_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS statewide_ndvi_tiles (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES statewide_ndvi_jobs(id) ON DELETE CASCADE,
  lga_code TEXT NOT NULL REFERENCES lgas(code),
  grid_x INTEGER NOT NULL,
  grid_y INTEGER NOT NULL,
  aoi GEOMETRY(MultiPolygon,4326) NOT NULL,
  area_ha DOUBLE PRECISION NOT NULL CHECK(area_ha > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN
    ('queued','running','completed','needs_review','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  baseline_clear_fraction DOUBLE PRECISION,
  comparison_clear_fraction DOUBLE PRECISION,
  baseline_mean_ndvi DOUBLE PRECISION,
  comparison_mean_ndvi DOUBLE PRECISION,
  baseline_vegetation_ha DOUBLE PRECISION,
  comparison_vegetation_ha DOUBLE PRECISION,
  quality_notes TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE(job_id,lga_code,grid_x,grid_y)
);
CREATE INDEX IF NOT EXISTS idx_statewide_ndvi_tiles_next
  ON statewide_ndvi_tiles(job_id,status,id);
CREATE INDEX IF NOT EXISTS idx_statewide_ndvi_tiles_lga
  ON statewide_ndvi_tiles(job_id,lga_code);
CREATE INDEX IF NOT EXISTS idx_statewide_ndvi_tiles_aoi
  ON statewide_ndvi_tiles USING GIST(aoi);

COMMIT;
