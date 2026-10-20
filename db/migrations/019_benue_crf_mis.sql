BEGIN;
-- Benue ACReSAL CRF monitoring. Private SPMU records, no payment execution.
-- Deliberately isolated from the public CARE-Map community/asset registry.
CREATE TABLE IF NOT EXISTS crf_role_assignments (
  user_id UUID NOT NULL REFERENCES users(id),
  crf_role TEXT NOT NULL CHECK(crf_role IN
    ('desk_officer','me_officer','gis_officer','finance_officer','internal_auditor','management')),
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,crf_role)
);
CREATE TABLE IF NOT EXISTS crf_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_code TEXT NOT NULL UNIQUE CHECK(length(community_code) BETWEEN 3 AND 40),
  community_name TEXT NOT NULL,
  lga_code TEXT NOT NULL REFERENCES lgas(code),
  cycle INTEGER NOT NULL DEFAULT 1 CHECK(cycle BETWEEN 1 AND 50),
  location GEOMETRY(Point,4326),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','eligible','active','suspended','closed')),
  crfmc_formed BOOLEAN NOT NULL DEFAULT FALSE,
  account1_evidence_ref TEXT,
  account2_evidence_ref TEXT,
  bank_mandate_ref TEXT,
  spmu_endorsement_ref TEXT,
  approval_reference TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crf_communities_lga ON crf_communities(lga_code,status);
CREATE INDEX IF NOT EXISTS crf_communities_geom ON crf_communities USING GIST(location);

CREATE TABLE IF NOT EXISTS crf_cigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES crf_communities(id) ON DELETE RESTRICT,
  cig_code TEXT NOT NULL,
  cig_name TEXT NOT NULL,
  enterprise_type TEXT NOT NULL,
  women_led BOOLEAN NOT NULL DEFAULT FALSE,
  savings_ngn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(savings_ngn >= 0),
  qualification TEXT NOT NULL DEFAULT 'draft' CHECK(qualification IN ('draft','review','qualified','rejected')),
  qualification_ref TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  prior_cycle_obligation_ngn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(prior_cycle_obligation_ngn>=0),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id,cig_code)
);
CREATE INDEX IF NOT EXISTS crf_cigs_community ON crf_cigs(community_id,qualification);

CREATE TABLE IF NOT EXISTS crf_cig_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cig_id UUID NOT NULL REFERENCES crf_cigs(id) ON DELETE RESTRICT,
  member_reference TEXT NOT NULL,
  sex TEXT NOT NULL CHECK(sex IN ('female','male','other','undisclosed')),
  youth_under_35 BOOLEAN,
  participation_verified BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by UUID NOT NULL REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verification_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cig_id,member_reference),
  CHECK(verified_by IS NULL OR verified_by<>recorded_by)
);
CREATE INDEX IF NOT EXISTS crf_cig_members_cig ON crf_cig_members(cig_id);

CREATE TABLE IF NOT EXISTS crf_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cig_id UUID NOT NULL REFERENCES crf_cigs(id) ON DELETE RESTRICT,
  loan_reference TEXT NOT NULL UNIQUE,
  cycle INTEGER NOT NULL CHECK(cycle BETWEEN 1 AND 50),
  principal_ngn NUMERIC(18,2) NOT NULL CHECK(principal_ngn>0),
  approved_ceiling_ngn NUMERIC(18,2) NOT NULL CHECK(approved_ceiling_ngn>0),
  cbn_rate_reference TEXT NOT NULL,
  tenor_months INTEGER NOT NULL CHECK(tenor_months IN (3,6,12)),
  service_charge_ngn NUMERIC(18,2) GENERATED ALWAYS AS
    (CASE tenor_months WHEN 3 THEN 50000.00 WHEN 6 THEN 75000.00 ELSE 100000.00 END) STORED,
  approval_memo_ref TEXT NOT NULL,
  approval_date DATE NOT NULL,
  agreement_ref TEXT NOT NULL,
  loan_app_reference TEXT,
  loan_app_recorded_at TIMESTAMPTZ,
  first_tranche_use_ref TEXT,
  disbursement_authority_ref TEXT,
  status TEXT NOT NULL DEFAULT 'registered' CHECK(status IN ('registered','monitoring','discharged','cancelled')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(principal_ngn<=approved_ceiling_ngn),
  UNIQUE(cig_id,cycle)
);
CREATE INDEX IF NOT EXISTS crf_loans_cig ON crf_loans(cig_id,status);

-- Monitoring only. An entry is NOT bank execution, not approval, and not
-- included in verified financial figures until independent reconciliation.
CREATE TABLE IF NOT EXISTS crf_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES crf_loans(id) ON DELETE RESTRICT,
  tranche INTEGER NOT NULL CHECK(tranche IN (1,2)),
  amount_ngn NUMERIC(18,2) NOT NULL CHECK(amount_ngn>0),
  transfer_date DATE NOT NULL,
  bank_reference TEXT NOT NULL,
  t15_endorsement_ref TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  account_source TEXT NOT NULL DEFAULT 'account_1' CHECK(account_source='account_1'),
  channel TEXT NOT NULL DEFAULT 'bank_transfer' CHECK(channel='bank_transfer'),
  verification TEXT NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','rejected')),
  recorded_by UUID NOT NULL REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id,tranche),
  UNIQUE(bank_reference),
  CHECK(verified_by IS NULL OR recorded_by<>verified_by)
);
CREATE TABLE IF NOT EXISTS crf_instalments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES crf_loans(id) ON DELETE RESTRICT,
  instalment_no INTEGER NOT NULL CHECK(instalment_no>=1 AND instalment_no<=36),
  due_date DATE NOT NULL,
  principal_due_ngn NUMERIC(18,2) NOT NULL CHECK(principal_due_ngn>=0),
  service_charge_due_ngn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(service_charge_due_ngn>=0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id,instalment_no)
);
CREATE INDEX IF NOT EXISTS crf_instalments_due ON crf_instalments(due_date,loan_id);
CREATE TABLE IF NOT EXISTS crf_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES crf_loans(id) ON DELETE RESTRICT,
  paid_at DATE NOT NULL,
  principal_ngn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(principal_ngn>=0),
  service_charge_ngn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(service_charge_ngn>=0),
  default_fee_ngn NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(default_fee_ngn>=0),
  bank_reference TEXT NOT NULL UNIQUE,
  bank_evidence_ref TEXT NOT NULL,
  account_destination TEXT NOT NULL DEFAULT 'account_2' CHECK(account_destination='account_2'),
  verification TEXT NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','rejected')),
  recorded_by UUID NOT NULL REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(principal_ngn+service_charge_ngn+default_fee_ngn>0),
  CHECK(verified_by IS NULL OR recorded_by<>verified_by)
);
CREATE INDEX IF NOT EXISTS crf_repayments_loan_date ON crf_repayments(loan_id,paid_at);

CREATE TABLE IF NOT EXISTS crf_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cig_id UUID NOT NULL REFERENCES crf_cigs(id) ON DELETE RESTRICT,
  inspected_on DATE NOT NULL,
  location GEOMETRY(Point,4326),
  gps_accuracy_m NUMERIC(8,2) CHECK(gps_accuracy_m IS NULL OR gps_accuracy_m>=0),
  activity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL,
  evidence_ref TEXT,
  findings_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(findings_status IN ('pending_review','verified','disputed')),
  officer_id UUID NOT NULL REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(reviewed_by IS NULL OR reviewed_by<>officer_id)
);
CREATE INDEX IF NOT EXISTS crf_inspections_cig ON crf_inspections(cig_id,inspected_on DESC);
CREATE INDEX IF NOT EXISTS crf_inspections_geom ON crf_inspections USING GIST(location);
CREATE TABLE IF NOT EXISTS crf_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cig_id UUID NOT NULL REFERENCES crf_cigs(id) ON DELETE RESTRICT,
  asset_reference TEXT NOT NULL,
  asset_description TEXT NOT NULL,
  amount_ngn NUMERIC(18,2) CHECK(amount_ngn>=0),
  verified_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verified_status IN
    ('unverified','present','missing','damaged','disposed')),
  location GEOMETRY(Point,4326),
  last_verified_at TIMESTAMPTZ,
  evidence_ref TEXT,
  UNIQUE(cig_id,asset_reference)
);
CREATE TABLE IF NOT EXISTS crf_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES crf_communities(id) ON DELETE RESTRICT,
  cig_id UUID REFERENCES crf_cigs(id),
  finding_type TEXT NOT NULL,
  finding_detail TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  assigned_to UUID REFERENCES users(id),
  due_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','verified_closed')),
  closure_evidence_ref TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(status<>'verified_closed' OR (closure_evidence_ref IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS crf_actions_due ON crf_corrective_actions(status,due_on);

CREATE TABLE IF NOT EXISTS crf_account_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES crf_communities(id) ON DELETE RESTRICT,
  account_type TEXT NOT NULL CHECK(account_type IN ('account_1','account_2')),
  period_month DATE NOT NULL CHECK(EXTRACT(DAY FROM period_month)=1),
  statement_reference TEXT NOT NULL,
  ledger_balance_ngn NUMERIC(18,2) NOT NULL,
  bank_balance_ngn NUMERIC(18,2) NOT NULL,
  verified_by UUID NOT NULL REFERENCES users(id),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id,account_type,period_month)
);
CREATE TABLE IF NOT EXISTS crf_activity_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crf_activity_audit_recent ON crf_activity_audit(created_at DESC);

-- Do not create any public RLS policy or expose private loan/member records.
COMMIT;
