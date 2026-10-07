BEGIN;

CREATE TABLE IF NOT EXISTS settlements(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code TEXT,
  name TEXT NOT NULL,
  settlement_type TEXT NOT NULL DEFAULT 'community'
    CHECK(settlement_type IN ('community','village','town','city','camp','other')),
  lga_code TEXT NOT NULL REFERENCES lgas(code),
  location GEOMETRY(POINT,4326) NOT NULL,
  population INTEGER CHECK(population IS NULL OR population>=0),
  population_year INTEGER CHECK(population_year IS NULL OR population_year BETWEEN 1900 AND 2200),
  population_source TEXT,
  source TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  gps_accuracy_m NUMERIC(8,2),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(population IS NULL OR NULLIF(BTRIM(population_source),'') IS NOT NULL),
  CHECK(population_year IS NULL OR population IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_code
  ON settlements(settlement_code)
  WHERE settlement_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlements_location
  ON settlements USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_settlements_location_geography
  ON settlements USING GIST ((location::geography));

CREATE INDEX IF NOT EXISTS idx_settlements_lga_verified
  ON settlements(lga_code,verified);

CREATE INDEX IF NOT EXISTS idx_settlements_name
  ON settlements(name);

DROP TRIGGER IF EXISTS trg_touch_settlements ON settlements;
CREATE TRIGGER trg_touch_settlements
BEFORE UPDATE ON settlements
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS settlement_imports(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('csv','geojson')),
  verified_on_import BOOLEAN NOT NULL DEFAULT FALSE,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  auto_assigned_lga_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_imports_created_at
  ON settlement_imports(created_at DESC);

COMMIT;
