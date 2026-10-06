# Roadmap

**Status:** Core product implementation built
**Last updated:** 2026-10-06

## Phase 0 — Planning & Design ✅
- [x] Requirements
- [x] Technology decision
- [x] Data model
- [x] API contracts
- [x] Mobile wireframes
- [x] Pilot LGA scope

## Phase 1 — Core Tracking ✅ Implementation complete
- [x] Aiven PostgreSQL/PostGIS migration
- [x] Staff authentication and roles
- [x] Borehole CRUD foundation
- [x] Asset CRUD foundation
- [x] Forest-site CRUD foundation
- [x] River CRUD foundation and verification flag
- [x] GPS capture for point interventions
- [x] GeoJSON line/polygon entry
- [x] Public interactive map
- [x] Bounding-box spatial queries
- [x] LGA/type/status filtering
- [x] Spatial GIST indexes
- [x] Maintenance records API
- [x] GPS accuracy and capture provenance
- [x] Field inspections
- [x] Bulk CSV/GeoJSON import
- [x] QGIS-ready GeoJSON/CSV export
- [x] Automated data-quality checks
- [x] Public map point clustering

Production gate: run the migration against the real Aiven service and field-test with validated coordinates.

## Phase 2 — Community Reporting ✅ Implementation complete
- [x] Anonymous public reporting
- [x] Unknown stream/small-river reporting
- [x] Optional community registration
- [x] Registered user report tracking
- [x] Staff report review queue
- [x] Verify/reject/resolve workflow
- [x] Rate limiting
- [x] Privacy retention/anonymization hook
- [x] Offline community-report queue and retry

## Phase 3 — Risk Prediction ✅ Rule-based baseline complete
- [x] Borehole maintenance-risk score
- [x] Asset maintenance-risk score
- [x] Forest-site nearby-report risk signal
- [x] River stress-to-risk conversion
- [x] Priority ranking endpoint
- [x] Scheduled daily refresh
- [ ] Replace or augment rules with validated ML only after sufficient quality historical data exists

## Phase 4 — Dashboard, Reporting & Hardening 🟡 Mostly complete
- [x] Staff summary dashboard
- [x] Functional-rate metric
- [x] High-risk overview
- [x] CSV export
- [x] Audit log
- [x] PWA/service-worker baseline
- [x] CI workflow
- [x] Admin user management
- [ ] Validate offline behavior in target LGAs
- [x] Vercel Blob field-photo storage integration
- [x] Resource photo gallery
- [ ] Add English/local-language translations
- [ ] Evaluate satellite/Google Earth Engine integration
- [ ] Complete formal NDPA/legal review
- [ ] Field acceptance testing and production launch

## Immediate production sequence

1. Provision Aiven PostgreSQL.
2. Configure TLS secrets.
3. Apply migrations.
4. Seed administrator.
5. Deploy to Vercel.
6. Import or collect verified initial intervention coordinates.
7. Field-test GPS capture and report workflow.
8. Launch internally to ACReSAL staff.
9. Open the public map after data-quality review.


## Phase 5 — Operations Governance ✅ Implementation complete

- [x] Report priority levels
- [x] Staff assignment and deadlines
- [x] Report status-history timeline
- [x] Operations Center for critical, overdue and unassigned work
- [x] Administrator audit-log viewer
- [x] GIS import-job history and failure review
- [x] User role changes and account activation/deactivation
- [x] Last-login visibility
- [x] Immediate session revalidation after account/role changes

**Production gate:** apply migration 003 to the configured Aiven database before using governance workflows.
