# CARE-Map User Manual
**Document:** CM-USR-001 | **Version:** 1.0-draft | **Date:** 2026-10-09  
**Audience:** public users, community reporters, GIS/field officers, supervisors and system administrators. **Status:** Training draft; confirm screens against the client deployment.

## 1. What the platform does
CARE-Map displays verified ACReSAL interventions, supports geographically located problem reports, manages inspections and work, analyzes geographic coverage/exposure and compares satellite vegetation observations. It is a decision-support tool; professional field validation remains necessary.

## 2. Roles
| Role | Typical access |
|---|---|
| Visitor | Public map/resource pages, anonymous community report, QR-to-report |
| Registered community | Public functions plus personal report tracking and account privacy controls |
| Staff / GIS officer | Authorized resource editing, GIS import/export and spatial analysis, inspections, report review, operational work, NDVI monitoring and field acceptance |
| Admin | Staff functions plus account/role governance, readiness, privacy, localization and audit review |

## 3. Public map and resource lookup
1. Open the approved CARE-Map URL in a supported browser.
2. View the interactive map; select LGA, resource category and status as required.
3. Tap a borehole, forest area, asset or river and open its approved public detail.
4. If a physical intervention has a printed QR label, scan it using a phone camera to open that resource's report flow.
5. Public information may be limited to verified/public-safe fields and should not be confused with all unpublished operational records.

## 4. Reporting a community problem
1. Open the **Report** page or scan an approved resource QR code.
2. Select the report category (for example, intervention issue or small stream).
3. Enter a clear factual description, select GPS location when permitted, or supply coordinates manually; confirm the pin is appropriate.
4. Provide contact details only when offered and necessary, review the consent/privacy notice, then submit.
5. Save the report reference/status. If offline, the browser may queue the report; keep site storage intact and reconnect to synchronize. Do not assume it reached staff until submission is confirmed.

## 5. GIS/field officer workflow
1. Sign in using the client-issued staff account.
2. In staff resource/data tools, select borehole, asset, forest or river; record mandatory attributes and valid GPS/GeoJSON geometry.
3. Record source, accuracy/provenance, current condition and maintenance details. Add inspection evidence when permitted.
4. Review possible duplicates and geometry errors before saving.
5. In report review, confirm facts, assign owner/priority/deadline and update statuses without erasing historical event records.
6. For physical asset QR labels, print the label and confirm it opens the correct resource before affixing.

## 6. GIS import and analysis
- Prepare CSV or GeoJSON using approved source data, EPSG:4326 and GeoJSON longitude-first order.
- Open the **GIS Workbench** import screen, preview records and resolve row-level errors; preserve source/verification audit.
- Use analysis tools for nearby features, LGA intervention coverage, settlement-to-borehole access gaps, river corridors, hazard exposure and catchment landscapes.
- Export CSV/GeoJSON, inspect in QGIS/ArcGIS, and record assumptions (buffer distance, status and verified-only filters). A proximity result is not a surveyed walking route.

## 7. Remote sensing and vegetation monitoring
1. Open the remote-sensing workspace; draw an area of interest or reuse a validated forest polygon.
2. Choose baseline/comparison periods and discover Sentinel-2 Level-2A scenes.
3. Review cloud masking/clear-pixel quality; run NDVI comparison and inspect previews, dates, area and quality limitations.
4. Publish a reviewed result only when supported by source imagery and checks.
5. For recurring monitoring, choose an approved area/cadence and review alerts; verify suspected vegetation loss in the field with evidence before operational closure.
**Important:** NDVI change is not a stand-alone finding of illegal clearing, erosion or restoration success. Seasonal changes, water, sensor artifacts and clouds must be considered.

## 8. Map Composer and reports
Choose layers and LGA, apply filters, view legends/counts and produce printable maps. Show map date, sources, projection/scale conventions and author. Export GeoJSON for independent GIS review.

## 9. Administrator workflow
Manage authorized accounts/roles; promptly deactivate departed users; examine audit history and import jobs. Use Production Readiness before release, Field Acceptance for device/LGA testing, Privacy Center for rights/breach processes, and Localization Center to review and publish approved language packs. Administrative actions are auditable.

## 10. Common problems
| Symptom | First action |
|---|---|
| Blank or incomplete map | Check connectivity, selected filters, browser and known resource availability; ask IT to inspect health/readiness |
| GPS unavailable | Allow browser location permission, move outdoors, verify HTTPS and record manual coordinates only with provenance |
| Report remains queued | Reconnect without clearing browser storage; check whether the report was received before resubmitting |
| Import rejected | Inspect row-level validation, coordinate ordering, geometry and required fields |
| Satellite analysis fails | Check imagery availability, cloud quality, credentials and service status; escalate to GIS lead |
| Photo upload fails | Check file type, size, connectivity and Blob configuration with IT |

## 11. Safe use
Do not upload credentials, confidential personal information or unredacted sensitive evidence. Use only approved data and authorized purposes. Report suspected data errors and security/privacy incidents through the client's designated support channel (to be supplied before launch).

## 12. Training and sign-off
Demonstrate each role-specific workflow on the intended devices. Record attendees, training dates, practical exercises and observed issues. This manual is not substitute for client-administered field acceptance.


### Large settlement imports (slow connection recovery)

In **Staff → GIS Workbench → Settlements & communities**, select CSV or GeoJSON and upload a file containing up to 2,000 settlement points. The browser now sends sequential batches of **100** records; each successful batch is committed separately, with a visible progress bar, added/duplicate/rejected counters, and an option to **Pause after current batch** or **Resume import**. Do not close or reload the page while running. After an interruption, reuse the same file and source, then choose Resume import. Existing records with the same settlement code or matching source/name/coordinates are skipped rather than re-created. Download the rejected-row CSV to inspect unmapped points, invalid attributes, or LGA-boundary mismatches. The user must independently review source coordinates, population provenance, and the final map before declaring settlements verified.

The PostgreSQL API accepts a maximum of **200 records per request**; direct API clients must split large datasets. A successful browser import means all batches were processed, not that all features passed validation. Review the final **Imported**, **Duplicates skipped**, and **Rejected** counts, refresh the inventory, and keep verification unchecked until the GIS unit confirms the data.

If an older deployment times out when importing a file, do not repeatedly submit the full file. Deploy the corrected importer, refresh CARE-Map, then retry through the batch interface. The final imported count must be confirmed in the database. A partially processed source can contain records from prior batches; the new importer skips identical existing records without resetting or deleting data.
