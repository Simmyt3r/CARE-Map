BEGIN;

CREATE TABLE IF NOT EXISTS hazard_zones(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hazard_type TEXT NOT NULL
    CHECK(hazard_type IN ('flood','erosion','gully_erosion','land_degradation','landslide','other')),
  severity TEXT NOT NULL DEFAULT 'unknown'
    CHECK(severity IN ('unknown','low','medium','high','critical')),
  boundary GEOMETRY(MULTIPOLYGON,4326) NOT NULL,
  source TEXT NOT NULL,
  source_date DATE,
  method TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK((verified=FALSE) OR (verified_at IS NOT NULL AND verified_by IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_hazard_zones_boundary
  ON hazard_zones USING GIST(boundary);

CREATE INDEX IF NOT EXISTS idx_hazard_zones_type_severity
  ON hazard_zones(hazard_type,severity,verified);

DROP TRIGGER IF EXISTS trg_touch_hazard_zones ON hazard_zones;
CREATE TRIGGER trg_touch_hazard_zones
BEFORE UPDATE ON hazard_zones
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS hazard_zone_imports(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_date DATE,
  verified_on_import BOOLEAN NOT NULL DEFAULT FALSE,
  total_features INTEGER NOT NULL DEFAULT 0,
  imported_features INTEGER NOT NULL DEFAULT 0,
  failed_features INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hazard_zone_imports_created_at
  ON hazard_zone_imports(created_at DESC);

COMMIT;
