BEGIN;

-- The 021 filename is reserved by the separate shared rate-limiter security PR.
-- Explicit, per-interface staff authorization. Admin access is unconditional.
ALTER TABLE users ADD COLUMN IF NOT EXISTS workspace_access TEXT[] NOT NULL
  DEFAULT ARRAY['reports','field']::TEXT[];

ALTER TABLE users ADD CONSTRAINT users_workspace_access_valid CHECK(
  workspace_access <@ ARRAY[
    'operations','reports','extension','finance','field','quality',
    'gis','analysis','maps','satellite','monitoring'
  ]::TEXT[]
  AND cardinality(workspace_access) <= 11
  AND (role <> 'staff' OR cardinality(workspace_access) > 0)
);

COMMENT ON COLUMN users.workspace_access IS
  'Staff interface authorizations. Administrators have all permissions independent of this array.';

COMMIT;
