BEGIN;

-- CARE-Map Phase 2: community engagement, stewardship competition and GIS review.
CREATE TABLE IF NOT EXISTS community_interventions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_code TEXT NOT NULL UNIQUE,
 project_name TEXT NOT NULL,
 project_type TEXT NOT NULL CHECK(project_type IN ('borehole','afforestation','erosion_control','watershed_restoration','livelihood','other')),
 community_name TEXT NOT NULL,
 lga_code TEXT NOT NULL REFERENCES lgas(code),
 location GEOMETRY(POINT,4326) NOT NULL,
 gps_accuracy_m NUMERIC(8,2) CHECK(gps_accuracy_m IS NULL OR gps_accuracy_m BETWEEN 0 AND 100000),
 capture_source TEXT NOT NULL CHECK(capture_source IN ('device_gps','manual','survey_import')),
 captured_at TIMESTAMPTZ,
 location_review TEXT NOT NULL DEFAULT 'pending' CHECK(location_review IN ('pending','verified','rejected')),
 location_reviewed_by UUID REFERENCES users(id),
 location_reviewed_at TIMESTAMPTZ,
 location_notes TEXT,
 contact_name TEXT NOT NULL,
 contact_phone TEXT NOT NULL,
 contact_role TEXT,
 contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
 contact_consent_at TIMESTAMPTZ,
 project_status TEXT NOT NULL DEFAULT 'active' CHECK(project_status IN ('planned','active','completed','needs_maintenance','closed')),
 description TEXT,
 created_by UUID REFERENCES users(id),
 updated_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_interventions_lga_type ON community_interventions(lga_code,project_type);
CREATE INDEX IF NOT EXISTS idx_community_interventions_location ON community_interventions USING GIST(location);
DROP TRIGGER IF EXISTS trg_touch_community_interventions ON community_interventions;
CREATE TRIGGER trg_touch_community_interventions BEFORE UPDATE ON community_interventions
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS extension_visits(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 intervention_id UUID NOT NULL REFERENCES community_interventions(id) ON DELETE RESTRICT,
 visit_date DATE NOT NULL,
 visit_type TEXT NOT NULL CHECK(visit_type IN ('training','maintenance_support','inspection','community_meeting','follow_up')),
 guidance TEXT NOT NULL,
 outcome TEXT,
 next_visit_due DATE,
 officer_id UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extension_visits_intervention ON extension_visits(intervention_id,visit_date DESC);

CREATE TABLE IF NOT EXISTS community_maintenance_assessments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 intervention_id UUID NOT NULL REFERENCES community_interventions(id) ON DELETE RESTRICT,
 assessed_on DATE NOT NULL,
 maintenance_score INTEGER NOT NULL CHECK(maintenance_score BETWEEN 0 AND 5),
 function_score INTEGER NOT NULL CHECK(function_score BETWEEN 0 AND 5),
 cleanliness_score INTEGER NOT NULL CHECK(cleanliness_score BETWEEN 0 AND 5),
 participation_score INTEGER NOT NULL CHECK(participation_score BETWEEN 0 AND 5),
 evidence_notes TEXT NOT NULL,
 verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','rejected')),
 evaluator_id UUID NOT NULL REFERENCES users(id),
 reviewed_by UUID REFERENCES users(id),
 reviewed_at TIMESTAMPTZ,
 reviewer_notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(intervention_id,assessed_on,evaluator_id)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_assessments_period
 ON community_maintenance_assessments(assessed_on DESC,verification_status,intervention_id);

CREATE TABLE IF NOT EXISTS community_reward_decisions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 project_type TEXT NOT NULL CHECK(project_type IN ('borehole','afforestation','erosion_control','watershed_restoration','livelihood','other')),
 intervention_id UUID NOT NULL REFERENCES community_interventions(id) ON DELETE RESTRICT,
 decision TEXT NOT NULL CHECK(decision IN ('recommended','approved','declined')),
 justification TEXT NOT NULL,
 decision_by UUID NOT NULL REFERENCES users(id),
 decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(period_end>=period_start),
 UNIQUE(period_start,period_end,project_type,intervention_id)
);
CREATE INDEX IF NOT EXISTS idx_community_rewards_intervention ON community_reward_decisions(intervention_id,decided_at DESC);

-- Do not publish a vegetation layer with insufficient image coverage.
ALTER TABLE remote_sensing_analyses DROP CONSTRAINT IF EXISTS remote_sensing_analyses_status_check;
ALTER TABLE remote_sensing_analyses ADD CONSTRAINT remote_sensing_analyses_status_check
 CHECK(status IN ('draft','waiting_configuration','running','completed','needs_review','failed'));
ALTER TABLE remote_sensing_analyses ADD COLUMN IF NOT EXISTS quality_notes TEXT;
ALTER TABLE remote_sensing_analyses ADD COLUMN IF NOT EXISTS minimum_clear_fraction NUMERIC(4,2) NOT NULL DEFAULT 0.60
 CHECK(minimum_clear_fraction BETWEEN 0.10 AND 1.00);

COMMIT;
