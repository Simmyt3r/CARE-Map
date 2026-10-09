# CARE-Map

**Benue ACReSAL Smart Asset, Forest, River & Borehole Tracking System**

CARE-Map is a mobile-first GIS platform for tracking ACReSAL interventions, collecting community reports, monitoring maintenance, and prioritizing field action with explainable risk scoring.

## Current implementation

The repository now contains a working Next.js application and Aiven/PostGIS database migration, not only planning documents.

### Public
- Interactive MapLibre map backed by PostGIS GeoJSON queries
- Borehole, asset, forest-site, and river layers
- LGA/type/status filtering
- Imported authoritative LGA administrative boundaries with selected-LGA highlighting
- Bounding-box queries so only the visible map area is requested
- Anonymous community problem reporting
- Small-river/stream reporting
- Phone GPS capture or manual coordinate entry
- Optional community registration and report tracking
- PWA/service-worker shell for graceful low-connectivity behavior
- Offline community-report queue with automatic retry when connectivity returns
- Clustered public map markers with risk legend and scale control
- Stable public detail page for every approved mapped resource
- Printable QR identification labels for field assets
- QR scan-to-report workflow tied to the exact mapped resource
- Public privacy notice, privacy-rights request/status workflow and explicit optional-contact consent
- Community self-service data export and account-identity anonymization
- Reviewed public-language framework with English fallback and admin-approved Tiv/Idoma/Igede translation packs

### Staff
- Secure staff/admin authentication
- Operations dashboard
- Borehole and asset coordinate capture
- Forest polygon and river line entry using GeoJSON
- Infrastructure status updates
- Maintenance-history API
- Community report review/verification/resolution workflow
- Report assignment, priority, deadlines and immutable status timeline
- Operations Center for overdue, critical and unassigned work
- Explainable risk priority ranking
- CSV and GeoJSON export for QGIS/ArcGIS/Excel/Python
- GIS Workbench for CSV/GeoJSON bulk imports with preview and row-level failures
- GPS accuracy/capture provenance on point data
- Field inspections with condition and GPS metadata
- Site-photo uploads through Vercel Blob
- Public-safe resource history summaries and photo galleries
- Automated GIS data-quality checks and possible-duplicate detection
- Spatial Analysis workspace for nearby-feature queries using true PostGIS distances
- LGA territorial intervention-coverage analysis using metre-based PostGIS buffers, optional asset-class filtering, covered/uncovered area and GeoJSON gap export
- Provenance-aware settlement/community layer with audited CSV/GeoJSON imports, verification workflow and sourced optional population
- Settlement-to-functional-borehole access-gap analysis with nearest-distance ranking and known-population completeness safeguards
- Verified-river corridor exposure analysis for settlements, boreholes, assets and open reports with distance ranking and GeoJSON export
- Provenance-aware verified hazard polygons with staff review, severity classification, exposure analysis, mapping and GeoJSON export
- Verified basin/watershed/subcatchment landscape units with hierarchy, cross-layer summaries, mapping and GeoJSON export
- LGA spatial summaries with administrative area, mapped forest hectares, verified river kilometres and spatially located open reports
- Remote Sensing workbench with click-to-draw AOIs and existing forest-boundary reuse
- Sentinel-2 Level-2A scene discovery through Earth Search
- NDVI baseline/comparison statistics, cloud masking, clear-pixel coverage and vegetated-area estimates
- Baseline/comparison NDVI image previews
- Publishable vegetation-change AOI layer on the public map
- Scheduled Sentinel-2 vegetation monitoring plans with configurable cadence and clear-pixel quality gates
- Automatic vegetation-loss alerts surfaced in the Operations Center
- One-click satellite-alert field verification tasks in the normal report workflow
- Evidence-photo capture and automatic satellite-alert closure after field verification
- Printable Map Composer with LGA boundary overlay, spatial LGA filtering, layer toggles, risk filters, legends, feature counts, notes and GeoJSON export
- Field Acceptance Test Center with per-LGA/device workflow checks, offline/GPS validation, evidence uploads and deterministic pass/fail/conditional results

### Administration
- Role-based users: registered community, staff, admin
- Admin user creation
- User activation/deactivation and role governance
- Immediate session revocation after account/role changes
- Searchable audit log and GIS import-job history
- Audit logging for key data changes
- Scheduled risk refresh and two-year report anonymization hook
- Production Readiness Center with live launch gates, migration integrity checks, pilot/statewide data readiness and remediation guidance
- Admin Privacy & Data Governance Center with rights-request queue, 30-day targets, breach register and 72-hour notification tracking
- Admin Localization Center with translation-key coverage, import audit, review, enable/disable and revocation

## Technology

- Next.js 16.3.8 + React + TypeScript
- MapLibre GL JS
- Aiven for PostgreSQL
- PostGIS
- JWT HTTP-only sessions
- Vercel
- Vitest + GitHub Actions

Architecture decision: docs/architecture/decisions/0003-adopt-aiven-postgis-nextjs.md

## Local setup

1. Create an Aiven for PostgreSQL service.
2. Copy .env.example to .env.local.
3. Set DATABASE_URL to the Aiven PostgreSQL service URI.
4. For production-grade certificate verification, put the Aiven CA certificate in AIVEN_CA_CERT with newlines escaped.
5. Set a random SESSION_SECRET of at least 32 characters.
6. Set CRON_SECRET.
7. Run npm install.
8. Run npm run db:migrate.
9. Set ADMIN_EMAIL and ADMIN_PASSWORD, then run npm run db:seed-admin.
10. Run npm run dev.

## Aiven migration

db/migrations/001_init.sql enables PostGIS, pgcrypto, and citext; creates the operational schema; creates GIST spatial indexes; and seeds all 23 Benue LGAs with the 14 initial CARE-Map pilot LGAs marked. db/migrations/002_field_operations.sql adds GPS quality/provenance, inspections, import auditing, and GIS quality views. db/migrations/003_operations_governance.sql adds report ownership, priority/deadlines, status history, account governance metadata, and supporting indexes. db/migrations/004_remote_sensing.sql adds persisted Sentinel-2 vegetation analyses and spatial indexes. db/migrations/005_vegetation_monitoring.sql adds recurring vegetation watchlists, observation history, and acknowledgeable satellite alerts. db/migrations/006_satellite_field_verification.sql links satellite alerts to field-verification reports and records report origin. db/migrations/007_lga_boundaries.sql adds authoritative LGA polygons, source provenance, spatial indexes and boundary-import audit history. db/migrations/008_coverage_geography_indexes.sql adds functional GiST geography indexes for metre-based borehole and asset proximity analysis. db/migrations/009_settlements_access.sql adds verified settlement/community points, population provenance safeguards, spatial indexes and settlement-import audit history. db/migrations/010_river_corridor_indexes.sql adds geography indexes for verified river corridors and open-report proximity queries. db/migrations/011_hazard_zones.sql adds verified hazard polygons, provenance/verification metadata, spatial indexes and audited hazard imports. db/migrations/012_catchments.sql adds verified catchment/landscape polygons, optional hierarchy, provenance metadata, spatial indexes and audited imports. db/migrations/013_field_acceptance.sql adds field acceptance runs, canonical workflow checks and dedicated evidence records. db/migrations/014_privacy_governance.sql adds privacy-notice evidence, data-subject rights requests, and the breach-response register. db/migrations/015_localization.sql adds reviewed translation packs and import audit history. Migration execution is tracked separately in care_map_schema_migrations using filename, SHA-256 checksum and applied timestamp.

## Environment variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | Aiven PostgreSQL connection URI |
| AIVEN_CA_CERT | Aiven CA certificate for TLS verification |
| SESSION_SECRET | Signs authentication sessions |
| CRON_SECRET | Protects scheduled maintenance/risk endpoint |
| ADMIN_EMAIL | Initial administrator email |
| ADMIN_PASSWORD | Initial administrator password |
| BLOB_READ_WRITE_TOKEN | Vercel Blob token for field photo uploads |
| CDSE_CLIENT_ID | Copernicus Data Space OAuth client ID for Sentinel processing |
| CDSE_CLIENT_SECRET | Copernicus Data Space OAuth client secret |
| CDSE_TOKEN_URL | Optional Copernicus OAuth token endpoint override |
| CDSE_SH_BASE_URL | Optional Copernicus Sentinel Hub API base URL override |
| EARTH_SEARCH_STAC_URL | Optional public Sentinel-2 STAC catalog override |
| DATA_CONTROLLER_NAME | Final legally reviewed CARE-Map controller identity |
| DATA_CONTROLLER_ADDRESS | Controller official address |
| PRIVACY_CONTACT_EMAIL | Public privacy / rights contact |
| PRIVACY_LAWFUL_BASIS_REPORTS | Legally reviewed lawful-basis wording for core report processing |
| PRIVACY_LAWFUL_BASIS_ACCOUNTS | Legally reviewed lawful-basis wording for community-account processing |
| PRIVACY_LEGAL_REVIEWED_AT | Date formal privacy/legal review was completed |
| PRIVACY_REVIEWER | Reviewer / DPO / DPCO / legal function that completed the review |

Never expose database or session secrets through NEXT_PUBLIC variables.

## API highlights

- GET /api/map/features
- GET/POST /api/resources/{boreholes|assets|forest-sites|rivers}
- PATCH /api/resources/:kind/:id
- GET/POST /api/resources/:kind/:id/maintenance
- GET/POST /api/resources/:kind/:id/inspections
- GET/POST /api/resources/:kind/:id/photos
- POST /api/gis/import
- GET /api/gis/export
- GET /api/gis/quality
- GET /api/gis/analysis/nearby
- GET /api/gis/analysis/lgas
- GET /api/gis/analysis/coverage
- GET /api/gis/settlements
- POST /api/gis/settlements/import
- PATCH /api/gis/settlements/:id
- GET /api/gis/analysis/settlement-access
- GET /api/gis/analysis/river-corridor
- GET /api/gis/analysis/river-corridor/options
- GET/POST /api/gis/hazard-zones
- PATCH /api/gis/hazard-zones/:id
- GET /api/gis/analysis/hazard-exposure
- GET/POST /api/gis/catchments
- PATCH /api/gis/catchments/:id
- GET /api/gis/analysis/catchment-landscape
- GET/POST /api/gis/lga-boundaries
- POST /api/remote-sensing/scenes
- GET/POST /api/remote-sensing/analyses
- GET/PATCH /api/remote-sensing/analyses/:id
- POST /api/remote-sensing/analyses/:id/run
- GET /api/remote-sensing/analyses/:id/preview
- GET/POST /api/remote-sensing/monitors
- PATCH /api/remote-sensing/monitors/:id
- POST /api/remote-sensing/monitors/:id/run
- GET /api/remote-sensing/monitors/:id/observations
- GET /api/remote-sensing/alerts
- POST /api/remote-sensing/alerts/:id/acknowledge
- POST /api/remote-sensing/alerts/:id/field-verification
- GET/POST /api/reports/:id/photos
- GET/POST /api/reports
- PATCH /api/reports/:id/status
- GET /api/reports/mine
- GET /api/dashboard/summary
- GET /api/dashboard/export
- GET /api/predictions/priority-rankings
- GET/POST /api/admin/users
- GET/POST /api/field-acceptance
- GET/PATCH /api/field-acceptance/:id
- GET/POST /api/field-acceptance/:id/evidence
- GET /api/admin/readiness
- GET /api/i18n/languages
- GET /api/i18n/catalog
- GET/POST /api/admin/i18n/packs
- PATCH /api/admin/i18n/packs/:code
- POST/GET /api/privacy/requests
- GET /api/privacy/me/export
- POST /api/privacy/me/delete
- GET /api/admin/privacy/requests
- PATCH /api/admin/privacy/requests/:id
- GET/POST /api/admin/privacy/breaches
- PATCH /api/admin/privacy/breaches/:id
- GET /api/health

## Documentation

See docs/planning, docs/architecture, docs/design, docs/IMPLEMENTATION.md, docs/production-readiness.md, docs/field-acceptance.md, docs/planning/data-privacy.md, and docs/localization.md.

## Production status

Application implementation is substantially complete. The remaining production gate is external: provision the real Aiven service, apply the migration, configure Vercel secrets, run CI against the branch, and perform field acceptance testing with real Benue intervention coordinates before public launch.
