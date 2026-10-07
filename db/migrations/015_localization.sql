BEGIN;

CREATE TABLE IF NOT EXISTS translation_packs(
  language_code TEXT PRIMARY KEY,
  language_name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  version TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN('draft','reviewed')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK((enabled=FALSE) OR (status='reviewed' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);

DROP TRIGGER IF EXISTS trg_touch_translation_packs ON translation_packs;
CREATE TRIGGER trg_touch_translation_packs
BEFORE UPDATE ON translation_packs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS translation_pack_imports(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  source TEXT,
  version TEXT,
  translated_keys INTEGER NOT NULL DEFAULT 0,
  required_keys INTEGER NOT NULL DEFAULT 0,
  coverage_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  unknown_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_pack_imports_language
  ON translation_pack_imports(language_code,created_at DESC);

INSERT INTO translation_packs(language_code,language_name,native_name,status,enabled,translations,source,version)
VALUES
  ('tiv','Tiv','Tiv','draft',FALSE,'{}'::jsonb,'Benue CARE-Map target language','1'),
  ('idoma','Idoma','Idoma','draft',FALSE,'{}'::jsonb,'Benue CARE-Map target language','1'),
  ('igede','Igede','Igede','draft',FALSE,'{}'::jsonb,'Benue CARE-Map target language','1')
ON CONFLICT(language_code) DO NOTHING;

COMMIT;
