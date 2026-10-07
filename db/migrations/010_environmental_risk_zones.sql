BEGIN;

CREATE TABLE IF NOT EXISTS environmental_risk_zones(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_code TEXT,
  name TEXT NOT NULL,
  hazard_type TEXT NOT NULL
    CHECK(hazard_type IN ('flood','erosion','landslide','wildfire','other')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK(severity IN ('low','medium','high','critical')),
  boundary GEOMETRY(MULTIPOLYGON,4326) NOT NULL,
  source TEXT NOT NULL,
  source_date DATE,
  valid_from DATE,
  valid_to DATE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_environmental_risk_zone_code
  ON environmental_risk_zones(zone_code)
  WHERE zone_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_environmental_risk_zones_boundary
  ON environmental_risk_zones USING GIST(boundary);

CREATE INDEX IF NOT EXISTS idx_environmental_risk_zones_filters
  ON environmental_risk_zones(verified,hazard_type,severity);

DROP TRIGGER IF EXISTS trg_touch_environmental_risk_zones ON environmental_risk_zones;
CREATE TRIGGER trg_touch_environmental_risk_zones
BEFORE UPDATE ON environmental_risk_zones
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS environmental_risk_zone_imports(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  verified_on_import BOOLEAN NOT NULL DEFAULT FALSE,
  total_features INTEGER NOT NULL DEFAULT 0,
  imported_features INTEGER NOT NULL DEFAULT 0,
  failed_features INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environmental_risk_zone_imports_created_at
  ON environmental_risk_zone_imports(created_at DESC);

COMMIT;
