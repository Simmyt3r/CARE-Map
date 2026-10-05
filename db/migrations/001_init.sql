BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS citext CASCADE;

CREATE TABLE IF NOT EXISTS lgas(code TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,pilot BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS users(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),email CITEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN('registered_community','staff','admin')),active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS boreholes(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,lga_code TEXT NOT NULL REFERENCES lgas(code),
 location GEOMETRY(POINT,4326) NOT NULL,status TEXT NOT NULL CHECK(status IN('functional','non_functional','needs_maintenance','decommissioned')),
 installation_date DATE,last_maintenance_date DATE,description TEXT,risk_score INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),
 risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN('low','medium','high','critical')),
 created_by UUID REFERENCES users(id),updated_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,asset_type TEXT NOT NULL,lga_code TEXT NOT NULL REFERENCES lgas(code),
 location GEOMETRY(POINT,4326) NOT NULL,status TEXT NOT NULL CHECK(status IN('functional','non_functional','needs_maintenance','decommissioned')),
 last_maintenance_date DATE,description TEXT,risk_score INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),
 risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN('low','medium','high','critical')),
 created_by UUID REFERENCES users(id),updated_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS forest_sites(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,lga_code TEXT NOT NULL REFERENCES lgas(code),boundary GEOMETRY(GEOMETRY,4326) NOT NULL,
 site_type TEXT NOT NULL CHECK(site_type IN('forest','afforestation_site')),status TEXT NOT NULL DEFAULT 'healthy',description TEXT,
 risk_score INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN('low','medium','high','critical')),
 created_by UUID REFERENCES users(id),updated_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rivers(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT,local_name TEXT,lga_code TEXT NOT NULL REFERENCES lgas(code),course GEOMETRY(GEOMETRY,4326) NOT NULL,
 source TEXT NOT NULL CHECK(source IN('official','community_reported')),description TEXT,verified BOOLEAN NOT NULL DEFAULT FALSE,
 stress_indicator TEXT NOT NULL DEFAULT 'none' CHECK(stress_indicator IN('none','low','medium','high')),
 risk_score INTEGER NOT NULL DEFAULT 0 CHECK(risk_score BETWEEN 0 AND 100),risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN('low','medium','high','critical')),
 created_by UUID REFERENCES users(id),updated_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reports(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),type TEXT NOT NULL CHECK(type IN('problem_report','small_river_report')),submitted_by UUID REFERENCES users(id),
 reporter_name TEXT,reporter_contact TEXT,related_entity_type TEXT CHECK(related_entity_type IN('borehole','asset','forest_site','river')),related_entity_id UUID,
 description TEXT NOT NULL,location GEOMETRY(POINT,4326) NOT NULL,status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','under_review','verified','resolved','rejected')),
 resolution_notes TEXT,submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),resolved_at TIMESTAMPTZ,anonymized_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS maintenance_records(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),entity_type TEXT NOT NULL CHECK(entity_type IN('borehole','asset')),entity_id UUID NOT NULL,
 performed_at DATE NOT NULL,notes TEXT,performed_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS photos(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),entity_type TEXT NOT NULL CHECK(entity_type IN('borehole','asset','forest_site','river','report')),
 entity_id UUID NOT NULL,url TEXT NOT NULL,caption TEXT,uploaded_by UUID REFERENCES users(id),uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs(
 id BIGSERIAL PRIMARY KEY,actor_id UUID REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id UUID,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END $$;
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['users','boreholes','assets','forest_sites','rivers','reports'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%I ON %I',t,t);
  EXECUTE format('CREATE TRIGGER trg_touch_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',t,t);
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_boreholes_location ON boreholes USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_forest_sites_boundary ON forest_sites USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_rivers_course ON rivers USING GIST(course);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_boreholes_lga_status ON boreholes(lga_code,status);
CREATE INDEX IF NOT EXISTS idx_assets_lga_status ON assets(lga_code,status);
INSERT INTO lgas(code,name,pilot) VALUES
('ADO','Ado',FALSE),('AGATU','Agatu',TRUE),('APA','Apa',FALSE),('BURUKU','Buruku',FALSE),('GBOKO','Gboko',TRUE),('GUMA','Guma',TRUE),
('GWER_EAST','Gwer East',TRUE),('GWER_WEST','Gwer West',TRUE),('KATSINA_ALA','Katsina-Ala',TRUE),('KONSHISHA','Konshisha',TRUE),('KWANDE','Kwande',TRUE),
('LOGO','Logo',FALSE),('MAKURDI','Makurdi',TRUE),('OBI','Obi',FALSE),('OGBADIBO','Ogbadibo',TRUE),('OHIMINI','Ohimini',TRUE),('OJU','Oju',TRUE),
('OKPOKWU','Okpokwu',FALSE),('OTUKPO','Otukpo',TRUE),('TARKA','Tarka',FALSE),('UKUM','Ukum',FALSE),('USHONGO','Ushongo',FALSE),('VANDEIKYA','Vandeikya',TRUE)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,pilot=EXCLUDED.pilot;
COMMIT;
