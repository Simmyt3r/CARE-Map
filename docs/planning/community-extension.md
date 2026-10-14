# CARE-Map Extension, Intervention Contacts and Community Stewardship
**Stage:** Implementation for controlled pilot, not ACReSAL approval or production acceptance. **Version:** October 2026.

## Module routes
- Public extension information: `/extension`. Contains no community contact numbers or private assessment evidence.
- Staff extension management: `/staff/extension`. Staff account required.
- Staff API: `/api/extension` (authorized; no public records), maintenance-photo API `/api/extension/assessments/:id/photo`.
- Administrator migration API: `/api/admin/schema-upgrade` (authenticated administrator + same-origin request).
- Database migrations: `016_community_extension_stewardship.sql` and `017_community_assessment_photos.sql`.

## 1. Interventions and community contacts
Each registered project has a distinct project code, name, type, community and LGA, point coordinates, capture source, GPS uncertainty and time, consenting community contact name/telephone/role, status, and descriptive details. The contact must affirm agreement to coordination communications. Contact details are shown only to logged-in staff; they must never be returned in public map, competition or extension information endpoints. Obtain legal/privacy review of the basis, notice, sharing controls and retention before production.

## 2. GPS / location validation

The latest application code uses the shared [GPS field acquisition and QA checklist](../quality/gps-field-acceptance.md): fresh high-accuracy readings for up to 30 seconds; target ≤30 m reported horizontal uncertainty; readings 30–100 m clearly low-confidence; stale/invalid readings rejected; manual coordinate edits remove the previous GPS accuracy, timestamp and source. A server-side fresh-device-capture check and LGA polygon matching guard staff intervention records. These checks do not establish survey-grade precision.
- Coordinates are WGS84 (EPSG:4326), longitude first when constructing a PostGIS point; web forms capture latitude then longitude separately.
- The server rejects invalid/infinite/missing coordinates, malformed device GPS capture metadata, and LGA mismatches when a verified/imported polygon is present.
- Coordinate records are **pending** until independent admin review. Location verification requires location within the selected LGA boundary, a captured timestamp, reported accuracy no worse than 30 m, and source 'device_gps' or documented 'survey_import'.
- Polygon matching is not proof of survey-grade accuracy. Boundary provenance and accuracy should be assessed separately. Device-reported GPS accuracy is an estimate, not a guarantee. Revisit discrepancies on-site.

## 3. Extension operations
Field staff record the intervention, date, activity type, practical guidance, community response and next follow-up due date. This first version supports a visit log, not automated outreach, SMS or public disclosure of focal-person telephone numbers.

## 4. Community competition
Only projects with the **same project type** are compared. In the rolling 90-day assessment window, each must have at least 2 verified, photo-backed assessments on dates at least 14 days apart; the intervention's location must be verified and contact permission retained. At least two projects of that same type must satisfy eligibility before a fair peer comparison.

Weighted score out of 100:
- Maintenance routine: 35%
- Project functionality: 30%
- Site condition / cleanliness: 15%
- Community participation: 20%

Each input is 0–5, recorded by a staff evaluator with notes and a redacted field photo. A **different administrator** reviews the assessment. Pending/rejected or missing-photo assessments are excluded. Same-day repeats do not count as two observations. A leaderboard is informational only. Administrators may record an award recommendation, approval or rejection with a reason for a selected date range, but this does **not** create/fund/authorize an additional project or imply government approval. Formal allocation requires program management sign-off, an equity review (especially for communities with fewer resources), budget and technical feasibility checks. Ranking should be monitored for accessibility and bias, not treated as sufficient for allocation.

### Photo-storage precautions
Photos are stored using Cloudinary's currently public delivery URLs. Do not upload faces, phone numbers, private identities, personal documents or confidential ACReSAL materials. Obtain the correct Cloudinary private/authenticated asset delivery arrangement and program privacy authorization before using sensitive evidence. This implementation attaches one image to each assessment; replacing that image leaves the previously uploaded Cloudinary asset orphaned, which must be addressed by a future media retention/cleanup workflow.

## 5. Sentinel change analysis and quality
AOI polygons validate coordinate order, ring closure, non-zero area, finite WGS84 coordinates, vertex limits and a bounded extent. Statistical comparisons only pass when baseline and comparison periods each have valid NDVI and >=60% valid clear pixels. Cloudy or insufficient observations enter `needs_review`; they cannot be published to public CARE-Map and are labelled for a clearer date window / follow-up. Only administrators can publish completed comparisons. Actual satellite interpretation, georegistration and ground truth still require GIS/M&E review; NDVI alone does not determine project maintenance or reward eligibility.

## 6. Deployment and acceptance
1. Ensure the Aiven database has a recent verified backup and an approved change window.
2. Sign in once as a CARE-Map administrator, open `/staff/admin/migrations` (Administration → Database migrations), and click **Apply pending migrations**. The application uses saved Vercel `DATABASE_URL`/`AIVEN_CA_CERT` values; no extra database password, setup token or second sign-in is requested. The administrator session is still checked server-side. The existing checksum migration ledger guards against silently modifying prior migrations.
3. Compare the **live deployed Vercel commit** to the intended GitHub release; check new tables / upgrade response, then register a **test project** with a consenting test contact and actual field GPS.
4. Record two visits/assessments on different dates **using real historical observations only**, attach approved redacted evidence images and use another administrator to verify.
5. Check score and eligibility, and verify other project types never compete against one another. Confirm public pages never reveal contact information.
6. Draw a small AOI and compare two suitable Sentinel dates. Verify cloud gate and approved publishing controls.
7. Run field acceptance on mobile; verify backup/recovery, location boundaries, independent evaluator approval, privacy/records and community reward governance.

No real project was created, no program reward was approved and no new SQL migrations were applied merely by committing these files.

## 7. Citizen education on the existing public extension page

The public `/extension` page also serves as an introductory, free citizen education and awareness area. Seven curated, source-linked lessons cover ACReSAL's purpose, climate change, soil erosion, water protection, vegetation survival, conservation agriculture and responsible interpretation of Sentinel-2 vegetation maps. Residents can search/filter topics, open practical steps and answer a short knowledge check; answers remain client-side and are not reported to the server.

**Editorial safeguards:** Plain-language lessons are based on public ACReSAL, World Bank and FAO materials, not presented as government-approved training certificates or site-specific engineering/agronomic orders. The content needs Benue ACReSAL field and communication review, periodic factual checks, accessibility and translation approval before official community dissemination. No citizen records or quiz scores are stored.

**Public map interpretation:** The map now presents prominent, clickable published-NDVI result cards and estimated-hectare markers, with gain/loss colors and focus controls. These depict the *whole AOI's estimated area change*; they do not display a per-pixel difference raster. Verification, seasonality and causality limitations remain explicit.
