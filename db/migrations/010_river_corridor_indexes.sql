BEGIN;

CREATE INDEX IF NOT EXISTS idx_rivers_course_geography
  ON rivers USING GIST ((course::geography))
  WHERE verified=TRUE;

CREATE INDEX IF NOT EXISTS idx_reports_location_geography_open
  ON reports USING GIST ((location::geography))
  WHERE status NOT IN ('resolved','rejected');

COMMIT;
