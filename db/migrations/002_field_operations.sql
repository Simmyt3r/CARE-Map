BEGIN;

ALTER TABLE boreholes
  ADD COLUMN IF NOT EXISTS borehole_code TEXT,
  ADD COLUMN IF NOT EXISTS gps_accuracy_m NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capture_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (capture_source IN ('manual','device_gps','csv_import','geojson_import','api_import'));

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS asset_code TEXT,
  ADD COLUMN IF NOT EXISTS gps_accuracy_m NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capture_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (capture_source IN ('manual','device_gps','csv_import','geojson_import','api_import'));

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS gps_accuracy_m NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capture_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (capture_source IN ('manual','device_gps','csv_import','geojson_import','api_import'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_boreholes_code
  ON boreholes(borehole_code) WHERE borehole_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_code
  ON assets(asset_code) WHERE asset_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS inspections(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('borehole','asset','forest_site','river')),
  entity_id UUID NOT NULL,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  condition TEXT NOT NULL CHECK(condition IN ('good','fair','poor','critical')),
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gps_accuracy_m NUMERIC(8,2),
  inspected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_entity
  ON inspections(entity_type,entity_id,inspected_at DESC);

CREATE TABLE IF NOT EXISTS import_jobs(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK(kind IN ('boreholes','assets','forest-sites','rivers')),
  format TEXT NOT NULL CHECK(format IN ('csv','geojson')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW gis_point_quality AS
SELECT 'borehole'::text entity_type,id,name,lga_code,
       ST_Y(location) latitude,ST_X(location) longitude,
       gps_accuracy_m,last_maintenance_date,
       CASE
         WHEN gps_accuracy_m IS NULL THEN 'missing_accuracy'
         WHEN gps_accuracy_m > 30 THEN 'low_accuracy'
         WHEN last_maintenance_date IS NULL THEN 'missing_maintenance'
         WHEN last_maintenance_date < CURRENT_DATE - INTERVAL '365 days' THEN 'stale_maintenance'
         ELSE 'ok'
       END quality_issue
FROM boreholes
UNION ALL
SELECT 'asset',id,name,lga_code,
       ST_Y(location),ST_X(location),
       gps_accuracy_m,last_maintenance_date,
       CASE
         WHEN gps_accuracy_m IS NULL THEN 'missing_accuracy'
         WHEN gps_accuracy_m > 30 THEN 'low_accuracy'
         WHEN last_maintenance_date IS NULL THEN 'missing_maintenance'
         WHEN last_maintenance_date < CURRENT_DATE - INTERVAL '365 days' THEN 'stale_maintenance'
         ELSE 'ok'
       END
FROM assets;

COMMIT;
