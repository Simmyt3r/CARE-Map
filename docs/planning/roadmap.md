# Roadmap

**Status:** Core product implementation built
**Last updated:** 2026-10-07

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
- [x] Sentinel-2 remote-sensing integration baseline
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


## Phase 6 — Spatial Analysis ✅ Baseline complete

- [x] Coordinate/radius nearby search
- [x] Device-GPS spatial query origin
- [x] Cross-layer distance ranking for boreholes, assets, forests, rivers and open reports
- [x] Analysis results map
- [x] LGA intervention summary
- [x] Forest area calculated from PostGIS geometries
- [x] Verified river length calculated from PostGIS geometries
- [x] Linked open-report workload by LGA

**Next analytical extensions:** watershed/elevation layers, intervention coverage models, and satellite vegetation change once source datasets are configured.


## Phase 7 — Remote Sensing & Vegetation Change ✅ Baseline complete

- [x] Sentinel-2 Level-2A scene discovery through public Earth Search STAC
- [x] Click-to-draw Polygon AOI
- [x] Reuse existing forest/afforestation boundaries as AOIs
- [x] Baseline and comparison observation windows
- [x] Least-cloud Sentinel-2 mosaicking
- [x] NDVI from B08 and B04
- [x] SCL-based cloud/shadow masking
- [x] Clear-pixel coverage reporting
- [x] Configurable vegetation threshold
- [x] Vegetated-area estimate in hectares
- [x] Vegetation gain/loss in hectares and percent
- [x] NDVI map preview for both periods
- [x] Persist analyses in PostGIS
- [x] Publish completed vegetation-change AOIs to the public map
- [x] Copernicus OAuth configuration in Infrastructure panel

**Production gate:** apply migration 004 and configure CDSE OAuth credentials for processing. Scene discovery remains available without those credentials.

**Interpretation rule:** compare like seasons whenever possible. A vegetation decrease may represent seasonality, harvest, fire, cloud contamination, land clearing, drought, or genuine degradation; remote-sensing output must be interpreted with field context.


## Phase 8 — Vegetation Monitoring & Alerts ✅ Baseline complete

- [x] Promote a completed NDVI analysis into a fixed-reference monitoring plan
- [x] Configurable 7–90 day monitoring cadence
- [x] Configurable minimum clear-pixel coverage
- [x] Configurable vegetation-loss alert threshold
- [x] Daily due-monitor scheduler with per-plan cadence
- [x] Low-clear-coverage retry without false vegetation alerts
- [x] Observation history with scene, NDVI, clear coverage and vegetation change
- [x] Medium/high/critical vegetation-loss alerts
- [x] Operations Center satellite-alert queue
- [x] Staff alert acknowledgement
- [x] Manual Check Now control
- [x] Pause/reactivate monitoring plans
- [x] Clear-pixel-normalized vegetation-area estimates for comparable monitoring

**Production gate:** apply migration 005, configure CDSE OAuth and CRON_SECRET, then validate monitoring thresholds against known field sites before treating satellite alerts as operational evidence.


## Phase 9 — Satellite Field Verification ✅ Baseline complete

- [x] Create a field-verification report directly from a vegetation alert
- [x] Use the alert AOI point-on-surface as the field task location
- [x] Inherit medium/high/critical urgency from the satellite alert
- [x] Automatic default deadlines: critical 1 day, high 3 days, medium 7 days
- [x] Reuse existing report assignment, deadline and status workflow
- [x] Preserve satellite-alert → field-report traceability
- [x] Label satellite-generated reports in the report queue
- [x] Display satellite trigger context in report governance
- [x] Upload field evidence photos to verification reports
- [x] Require a meaningful closure note for satellite verification
- [x] Require at least one evidence photo before resolving a satellite verification
- [x] Automatically acknowledge the originating satellite alert when the verification report is resolved or rejected
- [x] Audit field-verification creation and evidence uploads

**Production gate:** apply migration 006 and configure BLOB_READ_WRITE_TOKEN before using evidence-photo closure in the field. Validate the workflow with a known site before operational rollout.


## Phase 10 — Map Composer ✅ Baseline complete

- [x] Staff-only operational map composition workspace
- [x] Toggle borehole, asset, forest, river and published vegetation-change layers
- [x] LGA filter for mapped operational features
- [x] Risk-level filter
- [x] Optional feature labels
- [x] Editable map title, subtitle and interpretation notes
- [x] North arrow, metric scale and map legends
- [x] Visible-feature counts by layer
- [x] Fit map to visible data
- [x] Printable A4 landscape layout
- [x] Browser Print / Save PDF workflow
- [x] Export visible features as GeoJSON
- [x] Responsive mobile/desktop controls
- [x] Print-specific navigation/control suppression

**Extension completed in Phase 11:** published vegetation-change AOIs can now be filtered spatially against imported LGA polygons.


## Phase 11 — Administrative Boundaries ✅ Baseline complete

- [x] Store Benue LGA MultiPolygon boundaries in PostGIS
- [x] GiST spatial index for LGA boundaries
- [x] Preserve boundary source/version provenance
- [x] Record who imported each boundary and when
- [x] Audited GeoJSON boundary-import history
- [x] Match common `code`, `lga_code`, `LGA_NAME`, `NAME_2` and related property schemas
- [x] Validate Polygon/MultiPolygon geometry and repair invalid geometry before storage
- [x] GIS Workbench boundary-import/status panel
- [x] Show loaded vs missing boundaries for all 23 Benue LGAs
- [x] Public-map LGA boundary overlay and selected-LGA highlight
- [x] Zoom public map to an imported LGA polygon
- [x] Map Composer LGA boundary layer and selected-LGA highlight
- [x] Optional LGA boundary display in printed operational maps
- [x] Spatially filter published vegetation-change AOIs by LGA polygon
- [x] Calculate LGA administrative area from PostGIS geography
- [x] Count open/critical reports physically inside each LGA boundary
- [x] Regression tests for boundary matching and GeoJSON extents

**Production gate:** apply migration 007 and import a project-approved Benue LGA boundary dataset with documented provenance. Do not treat arbitrary third-party polygons as authoritative without GIS/SPMU validation.


## Phase 12 — Intervention Coverage Analysis ✅ Baseline complete

- [x] Staff-only LGA territorial coverage analysis
- [x] Functional borehole coverage scenario
- [x] Functional asset proximity scenario
- [x] Non-decommissioned mapped-footprint planning scenario
- [x] Configurable 100 m–50 km radius API with 500 m–25 km UI presets
- [x] True metre-based PostGIS geography buffers
- [x] Clip coverage to imported LGA administrative boundaries
- [x] Calculate covered and uncovered km²
- [x] Calculate territorial coverage percentage
- [x] Include qualifying resources just outside an LGA when their buffer crosses the boundary
- [x] Separate internal resources from cross-boundary supporting resources
- [x] Covered/uncovered map visualization
- [x] Rank up to 25 largest uncovered gap polygons with representative field coordinates
- [x] GeoJSON export of LGA boundary, coverage area, uncovered gaps and contributing resources
- [x] Explicit distinction between territorial coverage and population served
- [x] Regression tests for resource/scenario/radius validation

**Production gate:** apply migration 008 after migration 007, then validate chosen radii and resource statuses with the GIS/M&E team before using coverage percentages in management reporting.\n\n**Interpretation rule:** this baseline measures land-area proximity to mapped point resources. It does not estimate population served, walking/driving time, road access, hydraulic capacity, actual service reliability or demand. Those require validated population/settlement/network data.
