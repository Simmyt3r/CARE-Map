BEGIN;
-- Digital companion index for every mandatory CRF Manual form.
-- The completed signed original remains authoritative, not this JSON record.
-- Never write national ID numbers, phone numbers, signatures, bank account
-- numbers, beneficiary identity images or raw documents to field_values.
CREATE TABLE IF NOT EXISTS crf_template_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 template_code TEXT NOT NULL CHECK (template_code IN (
 'T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11',
 'T12A','T12B','T12C','T12D','T13','T14',
 'T15A','T15B','T15C','T15D','T15E','T16','T17','T18','T19'
 )),
 source_edition TEXT NOT NULL DEFAULT 'CRF Operations Manual — Revised AF; approval to be verified',
 community_id UUID REFERENCES crf_communities(id) ON DELETE RESTRICT,
 cig_id UUID REFERENCES crf_cigs(id) ON DELETE RESTRICT,
 loan_id UUID REFERENCES crf_loans(id) ON DELETE RESTRICT,
 period_month DATE CHECK (period_month IS NULL OR EXTRACT(DAY FROM period_month)=1),
 field_values JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(field_values)='object'),
 signed_original_ref TEXT,
 support_evidence_ref TEXT,
 status TEXT NOT NULL DEFAULT 'draft'
   CHECK(status IN ('draft','submitted','verified','returned')),
 prepared_by UUID NOT NULL REFERENCES users(id),
 reviewed_by UUID REFERENCES users(id),
 reviewed_at TIMESTAMPTZ,
 review_note TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revision INT NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK (reviewed_by IS NULL OR prepared_by<>reviewed_by),
 CHECK (status<>'verified' OR (reviewed_by IS NOT NULL AND signed_original_ref IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS crf_template_records_scope ON
 crf_template_records(template_code,community_id,cig_id,period_month,created_at DESC);
CREATE INDEX IF NOT EXISTS crf_template_records_work ON
 crf_template_records(status,created_at DESC);
COMMENT ON TABLE crf_template_records IS
 'Restricted index of exact manual templates. Completion/verification does not represent bank approval or transfer. Signed originals live only in SPMU-approved evidence storage.';
COMMIT;
