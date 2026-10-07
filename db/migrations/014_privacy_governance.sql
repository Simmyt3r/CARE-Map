BEGIN;

CREATE TABLE IF NOT EXISTS privacy_notice_acceptances(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  context TEXT NOT NULL CHECK(context IN('registration','report_submission','optional_contact')),
  notice_version TEXT NOT NULL,
  optional_contact_consent BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_notice_acceptances_user
  ON privacy_notice_acceptances(user_id,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_privacy_notice_acceptances_report
  ON privacy_notice_acceptances(report_id,created_at DESC)
  WHERE report_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS data_subject_requests(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL
    CHECK(request_type IN('access','rectification','erasure','restriction','objection','portability','withdraw_consent','complaint')),
  requester_name TEXT NOT NULL,
  requester_email CITEXT NOT NULL,
  requester_phone TEXT,
  user_id UUID REFERENCES users(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK(status IN('submitted','identity_verification_required','in_review','completed','rejected')),
  assigned_to UUID REFERENCES users(id),
  verification_notes TEXT,
  resolution_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT (now()+INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status_due
  ON data_subject_requests(status,due_at);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_email
  ON data_subject_requests(requester_email,submitted_at DESC);

DROP TRIGGER IF EXISTS trg_touch_data_subject_requests ON data_subject_requests;
CREATE TRIGGER trg_touch_data_subject_requests
BEFORE UPDATE ON data_subject_requests
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS privacy_breach_register(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  likely_risk BOOLEAN NOT NULL DEFAULT FALSE,
  high_risk BOOLEAN NOT NULL DEFAULT FALSE,
  affected_categories TEXT,
  approximate_subjects INTEGER CHECK(approximate_subjects IS NULL OR approximate_subjects>=0),
  containment_actions TEXT,
  ndpc_notification_required BOOLEAN NOT NULL DEFAULT FALSE,
  ndpc_notified_at TIMESTAMPTZ,
  subjects_notification_required BOOLEAN NOT NULL DEFAULT FALSE,
  subjects_notified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN('open','contained','closed')),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_breach_register_status
  ON privacy_breach_register(status,detected_at DESC);

DROP TRIGGER IF EXISTS trg_touch_privacy_breach_register ON privacy_breach_register;
CREATE TRIGGER trg_touch_privacy_breach_register
BEFORE UPDATE ON privacy_breach_register
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
