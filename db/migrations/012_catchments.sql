BEGIN;

CREATE TABLE IF NOT EXISTS catchments(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catchment_code TEXT,
  name TEXT NOT NULL,
  catchment_level TEXT NOT NULL DEFAULT 'watershed'
    CHECK(catchment_level IN ('basin','watershed','subcatchment','microcatchment','project_landscape','other')),
  parent_id UUID REFERENCES catchments(id) ON DELETE SET NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_catchments_code
  ON catchments(catchment_code)
  WHERE catchment_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catchments_boundary
  ON catchments USING GIST(boundary);

CREATE INDEX IF NOT EXISTS idx_catchments_level_verified
  ON catchments(catchment_level,verified);

CREATE INDEX IF NOT EXISTS idx_catchments_parent
  ON catchments(parent_id);

DROP TRIGGER IF EXISTS trg_touch_catchments ON catchments;
CREATE TRIGGER trg_touch_catchments
BEFORE UPDATE ON catchments
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS catchment_imports(
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

CREATE INDEX IF NOT EXISTS idx_catchment_imports_created_at
  ON catchment_imports(created_at DESC);

COMMIT;
