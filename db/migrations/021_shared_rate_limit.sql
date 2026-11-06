BEGIN;
-- Shared, database-backed request throttling for all serverless instances.
-- Only a keyed HMAC digest is stored; no plaintext IP addresses.
CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  key_hash CHAR(64) PRIMARY KEY,
  hits INTEGER NOT NULL CHECK(hits>0),
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_expiry
  ON api_rate_limit_buckets(reset_at);
COMMIT;
