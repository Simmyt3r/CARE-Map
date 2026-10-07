BEGIN;

CREATE INDEX IF NOT EXISTS idx_boreholes_location_geography
  ON boreholes USING GIST ((location::geography));

CREATE INDEX IF NOT EXISTS idx_assets_location_geography
  ON assets USING GIST ((location::geography));

COMMIT;
