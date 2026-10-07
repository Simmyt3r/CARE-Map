BEGIN;

ALTER TABLE lgas
  ADD COLUMN IF NOT EXISTS boundary GEOMETRY(MULTIPOLYGON,4326),
  ADD COLUMN IF NOT EXISTS boundary_source TEXT,
  ADD COLUMN IF NOT EXISTS boundary_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boundary_imported_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_lgas_boundary
  ON lgas USING GIST(boundary)
  WHERE boundary IS NOT NULL;

CREATE TABLE IF NOT EXISTS lga_boundary_imports(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  total_features INTEGER NOT NULL,
  imported_features INTEGER NOT NULL DEFAULT 0,
  failed_features INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lga_boundary_imports_created_at
  ON lga_boundary_imports(created_at DESC);

COMMIT;
