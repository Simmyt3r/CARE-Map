# CARE-Map System Hardening Audit and Stabilization Backlog

**Audit date:** 2026-10-14  
**Repository:** `Simmyt3r/CARE-Map`  
**Reviewed source / production SHA:** `c8e486db12bce9516cce5eb155a47820a6bf4c51`  
**Scope:** Existing CARE-Map, including all public, staff, GIS, environmental, integration and administrative subsystems. No new-feature scope.  
**Method:** Repository-tree inventory, targeted source review, GitHub CI results, current Vercel production state/error clusters, and aggregate read-only Aiven/PostGIS checks. This is **not** a completed penetration test, full line-by-line code audit, performance benchmark or field acceptance.

## 1. Executive assessment

CARE-Map has a substantial implemented feature surface. Production release matches reviewed GitHub source and has passing CI, but the principal readiness gaps are **a failing scheduled risk/privacy maintenance task, narrow PostgreSQL connection capacity, conditional TLS verification, horizontally ineffective login/report rate limits, incomplete testing of real integrations, and unverified GIS datasets**. Address these before creating additional modules or declaring operational acceptance.

The source inventory currently contains **288 tracked files**: **79 API route files**, **56 React components**, **30 library modules**, **33 additional app/page files**, **22 test files**, **17 SQL migrations**, and **35 documentation/design files**. Counts refer to files, not independently deployed microservices.

### Evidence status convention

- **CONFIRMED:** supported by source and/or observed production/database behavior.
- **RISK / REVIEW:** plausible issue requiring a test, use-case decision or audit before making a factual defect claim.
- **IMPLEMENTED BUT UNACCEPTED:** software exists; pilot/UAT or scientific/geographic verification not yet evidenced.
- **DO NOT ASSUME:** CI success, source presence, migration-file presence and Vercel READY are different forms of evidence.

## 2. Production and dataset baseline

| Check | Observed 2026-10-14 | Meaning |
|---|---|---|
| Git main / production | `c8e486db`, CI success, Vercel READY | Source/build parity for this snapshot; not evidence of UAT |
| Aiven PostgreSQL | Version 18.6, PostGIS 3.6 | Spatial database operational at time of check |
| Connection capacity | 20 maximum, 16 occupied, 3 idle / 1 active at check | Very little reserve for serverless concurrency, accounting for database internal/reserved slots |
| DB migrations | Files 001–017 applied, including extension/photo migrations | Earlier pending-migration warnings are now outdated |
| Administrative LGA areas | 23 / 23 boundaries present | Source, overlap, gaps, topology and geometry accuracy still need independent validation |
| Settlements | 7,847 records; **0 verified** | Do not confuse ingestion with geographic/factual acceptance |
| Catchments | 78 records; **0 verified** | Do not represent as accepted basin hierarchy or watershed impact |
| Boreholes / assets / forest sites / rivers | 0 recorded in each | Field create/edit/review workflows have not been demonstrated with operational records |
| Interventions / reports / inspections | 0 recorded in each | Pilot service workflows have not been demonstrated with real records |
| Remote-sensing analyses | 3 total; 1 completed and published | Sample AOI/NDVI output exists but needs independent check |
| Field-acceptance records | 1 run | Existence of a run is not sign-off |
| Production error clusters | PostgreSQL connections exhausted (`53300`); risk refresh SQL syntax error (`42601`); historical missing-column errors (`42703`) | Investigate live recurrence vs historical errors before reopening a previously fixed defect |

### Top confirmed defects and concerns

**P0 — Correct risk/privacy scheduled SQL job.** `src/app/api/internal/refresh-risk/route.ts` contains `DO $` / `END $` rather than valid PostgreSQL `DO $$` / `END $$` or a named dollar-quoted block. Vercel logs confirm syntax errors on `/api/internal/refresh-risk`, including a failure at 2026-10-14 02:11 UTC. The job handles both risk recalculation and aging resolved-report anonymization. **Fix in source, add a real Postgres integration test, then inspect run logs after deployment.** Do not edit an already-applied schema migration to fix this.

**P0 — Protect production database availability.** `src/lib/db.ts` already sets `max:1` and short idle time, but production logs report exhausted connection slots. Aiven has only 20 maximum connections, 16 occupied at one check. Per-instance pools accumulate across Vercel instances. **Investigate active backends, review long-running queries and connections, use Aiven-compatible transaction pooling where supported, apply timeouts/backpressure and load test.** Avoid simply increasing application connections.

**P1 — Require trusted TLS and fail closed in production.** Both `src/lib/db.ts` and `src/lib/infrastructure.ts` use `rejectUnauthorized:false` when a trusted CA is not passed. Remove this insecure fallback for deployed database connections after validating environment configuration and connectivity. Keep a clear configuration error. Do not silently break live connectivity.

**P1 — Shared rate limiting and request protection.** `src/lib/http.ts` uses a process-local `Map` for rate limits; counters do not synchronize across serverless instances and are reset on cold starts. Use a shared backend or edge/platform rate control for authentication, registration and anonymous reporting; add response-size and body-size limits, abuse tests, IP/proxy-trust review and systematic CSRF/origin policy. Some existing admin and extension mutations already enforce same-origin checks; policy is not uniformly centralized.

**P1 — Public resource data minimization.** `src/lib/resources.ts:listResources()` uses `SELECT *` for `GET /api/resources/[kind]` even for anonymous callers, while only rivers have an explicit verified filter. Review all returned columns, internal actor identifiers, source/verification fields and unreviewed resource visibility. Replace wildcard selection with documented public DTOs and tests for every resource class; use separate staff responses when needed.

**P1 — External photo privacy.** Cloudinary uploads validate file signature/size (positive control) but evidence delivery URLs are public. Require only approved redacted non-sensitive photos. Verify metadata/EXIF stripping, URL retention, deletion/erasure, access rules, content moderation, consent and upload rate controls. Do not display private community contact information in map payloads.

**P1 — End-to-end geospatial acceptance.** No settlements or catchments are marked verified even though thousands were imported. LGA polygons exist for all LGAs, but provenance/accuracy and border consistency require comparison with authoritative sources. Conduct controlled GIS reviews, not mass verification without inspection.

## 3. Complete functional subsystem inventory and improvement register

| Existing subsystem | Present implementation / source | Hardening actions | Urgency |
|---|---|---|---|
| Public website and navigation | `src/app/page.tsx`, `AppNav`, `HomeIntro` | Real-device accessibility, contrast, keyboard/touch testing, Core Web Vitals; graceful API failure states | P2 |
| Interactive public map | `PublicMap`, `api/map/features`, LGA boundaries | Fetch cancellation/versioning, avoid out-of-order viewport responses, polygon click/marker regression, data-loading skeleton/retry, query limits, representative browser tests | P1 |
| Public resource views/QR | `api/public/resources`, `public-resource`, QR/report links | Public DTO allowlist, prevent internal metadata leakage, accessibility, stable resource IDs, broken-image recovery | P1 |
| Citizen issue reporting | `ReportForm`, `api/reports` | Shared throttling, validation/error feedback, spam/duplicate detection, realistic submission-to-resolution UAT, contact minimization | P1 |
| Offline/PWA shell | `public/sw.js`, service worker registration, report queue | Test queue replay, offline-to-online duplicates, stale cache versions, network retry/acknowledgement and privacy of cached content | P1 |
| Login/registration/session | `auth.ts`, auth routes | Central CSRF/origin strategy, shared rate limits, account recovery policy, credential brute-force checks, cookie/session rotation and sign-out tests | P1 |
| Staff dashboard | `staff/page.tsx`, dashboard summaries | Verify live metrics, empty states, latency under load, do not overclaim readiness from zero inventory | P2 |
| Staff CRUD/resources | `StaffDataManager`, `ResourceOperations`, `resources.ts` | Zod validation for edits, transaction between resource mutation and audit, role/ownership tests, GPS/LGA checks on updates, immutable change history | P1 |
| GPS and field provenance | `field-gps.ts`, `location-quality.ts` | Ground-truth offset measurements at known sites, weak/offline/permission scenarios, spoofing limitations, recapture and manual provenance checks | P1 |
| GIS bulk import | `GISWorkbench`, `api/gis/import` | Consistent per-file/batch limits, geometry validity and SRID assertions, idempotency/retry, large-file performance, per-row error sanitization | P1 |
| Administrative LGA boundaries | `LgaBoundaryManager`, `api/gis/lga-boundaries` | Validate provenance, topological overlaps/gaps, polygon repair audit, known LGA point-in-polygon tests and import rollback | P1 |
| Settlements and access gaps | `SettlementManager`, settlement APIs, `SettlementAccessAnalysis` | Verify source/deduplication/population years, staged review of 7,847 points, realistic catchment/access tests, accurate spatial distance | P1 |
| Rivers and corridor exposure | `RiverCorridorAnalysis`, river APIs | Source geometry/source date, verified flag, buffer interpretation, flood exposure caveats, GIS QGIS reproducibility | P2 |
| Hazards and exposure | `HazardZoneManager`, `HazardExposureAnalysis` | Verified hazard source, severity semantics, map projection, topology and reference datasets | P2 |
| Catchments/watershed analysis | `CatchmentManager`, `CatchmentLandscapeAnalysis` | Verify 78 records, hierarchy and boundary overlap, units, provenance and source authority | P1 |
| Spatial and coverage analysis | `SpatialAnalysis`, `CoverageAnalysis`, PostGIS | Validate metre/geography calculations, edge cases, query limits/costs, reproducibility against QGIS, no false precision | P1 |
| Sentinel scenes/AOI | `AoiSketchMap`, `aoi-editor`, `remote-sensing` | Test dates, AOI validity, scene search, cloud/cloud-shadow exclusions, statistics, OAuth/quota/timeouts, no-data errors | P1 |
| NDVI comparison and public layer | Remote sensing analyses, results drawer, published vegetation layer | Independent scene/pixel check, representative comparable seasons, pixel/area mask consistency, publishing guard, clear AOI-level vs per-pixel meaning | P1 |
| Vegetation monitoring/alerts | `vegetation-monitoring.ts`, two internal cron routes | Cron authentication, idempotent runs, per-monitor lease/lock, bounded workload in 60s, skip future/incomplete imagery, alert duplicate prevention and retry | P1 |
| Risk prioritization/operations | `risk.ts`, risk-refresh cron, `OperationsCenter`, reports queue | Fix broken cron first; align SQL and TypeScript scores, audit status transitions, verify stale issue/escalation priorities and privacy retention | P0 |
| Community extension/interventions | `ExtensionCenter`, extension APIs, migrations 016–017 | Pilot consent and staff contact access, location independent review, photo privacy, visit follow-up, prevent conflict-of-interest assessments | P1 |
| Stewardship competitions | Assessment and reward decision routes | Test 14-day/distinct-visit eligibility, score accuracy, transparent audit and fair approval; no automated award allocation | P1 |
| Citizen education | `CitizenLearningCenter`, `citizen-lessons` | Editorial sign-off, source-link review, Benue-specific examples, accessibility, literacy/usability and approved translations | P2 |
| GIS map composer/exports | `MapComposer`, `api/gis/export` | Print/PDF quality, legend completeness, provenance/CRS/scale notes, redaction, filename/CSV injection testing | P2 |
| Field acceptance | `FieldAcceptanceCenter`, APIs and evidence | Signed acceptance thresholds, independent test devices/sites, retain evidence without exposing people/precise locations, no auto certification | P1 |
| Staff admin/accounts | `AdminUsers`, `AdminGovernance`, admin APIs | Role transition tests, minimum-admin rule concurrency, MFA/strong credential policy review, audit completeness, least privilege | P1 |
| Privacy and localization | Privacy request/erasure routes, translation packs | Complete retention schedules, consent withdrawal, external media deletion, contact access review, approved translations/no fabricated accuracy | P1 |
| Infrastructure/migrations | `InfrastructurePanel`, `MigrationManager`, `infrastructure.ts` | Verified TLS, backup before migrations, checksum integrity, lock concurrent upgrades, rollback/recovery drills, first-setup secret removal | P1 |
| PostgreSQL/PostGIS | `db.ts`, 17 migrations, Aiven service | Pool capacity, statement timeouts, transaction reuse, EXPLAIN of map queries, select indexes, backup/restore and query concurrency | P0 |
| Cloudinary image storage | `photo-storage.ts` and photo upload routes | Security/privacy/metadata/retention policy, failure rollback if DB update fails after upload, quotas, public URL risk | P1 |
| Deployment, monitoring and tests | `vercel.json`, CI workflow, `tests`, Vercel logs | Staging and production parity, PostGIS integration tests, browser E2E, performance budget, alerts, safe releases and rollback | P0–P1 |

P0: reliability/correctness blocker. P1: important before operational pilot. P2: usability/scalability cleanup once correctness is stable. Priorities are engineering assessments, subject to program risk acceptance.

## 4. Existing positive safeguards to preserve

- Staff and administrator role checks exist, and session verification checks the current active database user.
- Session cookies are HTTP-only, secure in production, and SameSite=Lax.
- SQL parameters are used for many data values and a migration ledger/checksum system exists.
- Important resource geometries have PostGIS GiST indexes; specific access and proximity queries also have geography indexes.
- GPS capture rejects stale, invalid and low-confidence readings; manual edits clear GPS provenance.
- Cloudinary upload code checks media type, file magic bytes and a 4 MB size limit.
- Public Sentinel-2 publication requires completed analyses and sufficient clear-pixel coverage in both windows.
- The service worker intends to avoid caching authenticated pages and API payloads.
- GitHub CI runs security advisory checks, TypeScript, lint, unit tests and production build.

Keep these controls during simplification/refactoring; add tests before changing them.

## 5. Recommended work packages

### Package A — Immediate operational correctness (P0, first)

1. Fix `DO $` SQL in risk refresh. Validate it using a disposable PostgreSQL/PostGIS database with the actual migrations and fixture records; verify risk updates and aged-report anonymity checks.
2. Investigate 20-slot Aiven limits and persistent idle/serverless connections. Measure p95/p99 request time, PostgreSQL wait/active connections and query counts. Use pooling, backpressure and caching deliberately; no arbitrary higher pool limits.
3. Create explicit error/health dashboards and alert thresholds for DB exhaustion, cron failure and key public endpoints.
4. Repeat smoke tests on map, login, admin and reporting after deployment. Record source/deployment SHAs and rollback options.

**Acceptance:** Scheduled job returns successful response, expected row changes occur, no connection-exhaustion errors during representative multi-user test, public map/API respond predictably and the issue is reproducible in tests.

### Package B — Security and privacy (P1)

1. Require verified production database TLS after checking Aiven CA configuration.
2. Replace process-local authentication/report rate limiting with a shared control; centralize mutating-request origin/CSRF checks.
3. Restrict anonymous resource APIs to approved fields and verified records.
4. Review photo public delivery, EXIF, retention, erasure, rate limits, and prevent sensitive content exposure.
5. Ensure every high-value operation has server-side auth, role and parameter/schema checks and a durable audit event.
6. Verify admin and community data-deletion flows against actual retention policy.

**Acceptance:** unauthorized/non-admin matrix passes, sensitive metadata is absent in public responses, security/cookie/CSRF tests pass and private photos/contacts are controlled.

### Package C — Spatial, scientific and data quality (P1)

1. Verify 23 LGA boundaries using authoritative source, provenance and topology checks.
2. Independently sample and reconcile the 7,847 settlement records; **0 currently verified**.
3. Verify the 78 catchment geometries and source hierarchy; **0 currently verified**.
4. Compare GPS captures against independent known control points across target Android browsers and geographic environments.
5. Reproduce the published NDVI example using the underlying scene/date/cloud masks in a GIS reference workflow; ensure estimated changes are not presented as causal restoration effects.
6. Cross-check coverage, watershed and river distance figures against PostGIS/QGIS and unit-tested fixtures.

**Acceptance:** signed data source register, documented sampling/offset/tolerance, reviewer identity and reproducible calculations. No bulk 'verify all' shortcut.

### Package D — Real-world workflow acceptance (P1)

1. Use approved, non-sensitive **test/pilot** data to exercise boreholes/assets, inspections, QR/report submissions, status changes, maintenance, extension contacts, assessment approvals and reward decisions.
2. Test offline report queue and server receipt without duplicate submissions.
3. Exercise Cloudinary, satellite catalogue/NDVI, GIS imports and map exports with actual configured integrations.
4. Validate staff touch targets, UI states, keyboard access and mobile performance.
5. Perform and record database backup **restore** test before formal handover.

**Acceptance:** each workflow has actor, timestamp, result, screenshot/evidence, expected output, defect status and owner. A CI pass is insufficient.

### Package E — Maintainability and performance (P2)

1. Centralize duplicated geolocation, date/coordinate, permissions, request validation and error presentation.
2. Break large components into cohesive internal subcomponents without changing behavior; add regression tests first.
3. Reduce repeated map refresh/database reads and guard against out-of-order responses.
4. Use paginated/stable resource APIs and bound long-running spatial, import and monitor tasks.
5. Apply a consistent accessibility, responsive, and localization QA checklist.

**Acceptance:** no regressions, better measured latency/memory, less code complexity, predictable visual output and fully documented APIs.

## 6. Acceptance metrics and reporting

Report the following per release:

| Measure | Example acceptance target / decision |
|---|---|
| Production source parity | Vercel production SHA equals approved release SHA |
| Critical runtime errors | Zero unresolved P0 errors and alerting on recurrence |
| DB headroom | Measured under representative concurrency, with connection reserve |
| API response time | Compare measured p50/p95/p99 to approved SLO, not an invented number |
| Access control | Authorized/unauthorized role matrix passes |
| GPS quality | Report accuracy **and independently measured positional offset** |
| Spatial data | Source, reviewer, verification rate, missing/invalid geometries |
| Sentinel-2 quality | Reproducible date, scene, cloud mask, AOI, threshold and NDVI area |
| Offline reporting | Submission acknowledged once; replay is idempotent |
| Evidence privacy | No sensitive public media, clear retention and erasure policy |
| Client UAT | Named reviewer, accepted criteria and signed resolution of blockers |

## 7. Controlled implementation order

**Do not add new features.** First stabilize and measure; second secure public and private boundaries; third validate source data and scientific/geographic outputs; fourth complete operational pilot and formal field acceptance; fifth refactor for performance and maintainability. Every code change requires tests + GitHub CI + Vercel SHA check; every DB write requires approved backup/change control.

### Immediate next technical move

Fix the **confirmed risk-refresh SQL cron** and test its impact on both risk scoring and anonymization. In parallel, investigate the very small Aiven connection budget because it affects multiple public pages and tools. These are higher priority than cosmetic changes or additional GIS modules.
