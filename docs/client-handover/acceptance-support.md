# CARE-Map User Acceptance Testing, Handover and Support
**Document:** CM-UAT-001 | **Version:** 1.0-draft | **Date:** 2026-10-09  
**Status:** Acceptance template, **NOT** signed or approved. Contractual support terms are to be negotiated.

## 1. Acceptance parties
**Client/organization:** [Legal entity to confirm]  
**Client project sponsor / product owner:** [Name, title]  
**Client technical/GIS approver:** [Name, title]  
**Supplier/development team:** [Legal supplier identity to confirm]  
**Version / Git commit / environment:** [Record exact release]  
**Pilot LGAs, datasets and devices:** [Approved inventory]

## 2. Preconditions
- Deployment is accessible over HTTPS and matches the release commit.
- Aiven/PostGIS and checksummed database migrations are verified.
- Source, collection date and approval of pilot LGA and intervention datasets are recorded.
- Client-defined performance/security criteria and test conditions are documented.
- Data controller/privacy notice/lawful basis reviewed by authorized client legal/privacy personnel.
- Test devices, network conditions, users and reproducible test data are available.

## 3. Minimum acceptance matrix
| ID | Scenario | Evidence / pass criteria | Owner |
|---|---|---|---|
| UAT-01 | Anonymous public map | Correct reviewed public features, filters and LGA boundaries; no restricted data | GIS + client |
| UAT-02 | GPS field asset | Captures resource attributes/coordinate source and quality on target device | Field officer |
| UAT-03 | Community report | Submit, review, assign, update and resolve with durable history | Operations |
| UAT-04 | Offline report | Queue offline and confirm single received submission after reconnect | Field + IT |
| UAT-05 | QR asset workflow | Label opens exact resource; report references that resource | Field officer |
| UAT-06 | GIS bulk import | Approved data import with detectable invalid rows and audit | GIS |
| UAT-07 | Spatial analysis | Validate distances, buffers, areas, LGA coverage and GeoJSON export against QGIS independently | GIS |
| UAT-08 | Remote sensing | Reproduce AOI, dates, cloud metrics, NDVI and area calculation using accepted reference scenes | GIS/RS |
| UAT-09 | Vegetation alerts | Authorized monitor creates/acknowledges alert and links evidence-based field closure | Operations |
| UAT-10 | Roles and security | Public cannot edit protected records, staff cannot perform admin-only tasks, revoked sessions fail | IT |
| UAT-11 | Privacy and retention | Rights workflow/retention safeguards and controller notices reviewed | Privacy lead |
| UAT-12 | Backup and restore | Restore representative records and geospatial queries in controlled test | IT |
| UAT-13 | Dashboard/maps/export | Management figures reconcile with verified DB and export opens in GIS software | M&E |
| UAT-14 | Readiness/performance | Required readiness gates, agreed response/load targets and operational monitoring pass | IT + client |
| UAT-15 | Client training | Named staff successfully complete the role-specific exercises | Client sponsor |

Also complete the built-in Field Acceptance Test Center in **every pilot LGA**, using real representative devices and weak-connectivity conditions. A green software check is **not** field validation.

## 4. Test record template
**Test ID:** __ | **Build:** __ | **Date:** __ | **Device/network:** __  
**Operator:** __ | **Dataset/source:** __ | **Steps/data:** __  
**Expected:** __ | **Actual:** __ | **Evidence link:** __  
**Result:** PASS / FAIL / BLOCKED / NOT APPLICABLE  
**Defect ID / severity:** __ | **Retest date / reviewer:** __

## 5. Defect and change control
- **Critical:** unsafe data disclosure, corrupted authoritative data, serious auth bypass, unavailable core workflow. Blocks handover.
- **High:** essential field or GIS process fails without acceptable workaround. Blocks handover unless client explicitly signs a timebound exception.
- **Medium/Low:** document workaround, owner and target date; client approves disposition.
- Record change requests separately from agreed scope; never silently reclassify a missing requirement as a new feature.

## 6. Release / go-live decision
**Do not sign** until: all critical/high defects resolved or formally excepted; mandatory UAT and field acceptance passed; production readiness gates met; validated data loaded; privacy approval complete; administrator credentials/ownership transferred securely; backup restore verified; client training completed; post-go-live support contacts agreed.

## 7. Support and service-level schedule (to negotiate)
| Item | Client agreement |
|---|---|
| Support start/end and warranty | [Dates and scope] |
| Coverage hours/time zone | [Hours; Africa/Lagos if agreed] |
| Incident reporting channel | [Email/phone/helpdesk] |
| Severity definitions and response/resolution objectives | [Agree measurable targets] |
| Hosting, cloud spend, domains, backup ownership | [Responsibility matrix] |
| Bug fixes vs feature enhancements | [Contractually agreed inclusions] |
| Security/privacy escalation | [Client and supplier accountable contacts] |
| Upgrade and handover of source code | [IP/license and access terms] |
| Exit/transition and data export | [Format, timing, retention/deletion] |

No SLA, intellectual-property transfer or legal commitment is established by this draft.

## 8. Deliverables checklist
- [ ] Approved SRS and architecture baseline
- [ ] Reviewed release/source repository access and release notes
- [ ] Deployment/runbook and secrets transferred via secure channel
- [ ] User manual, training and administrator guide
- [ ] UAT evidence, GIS data-source register and unresolved defect log
- [ ] Privacy/legal approval and data-handling assignment
- [ ] Backup/restore evidence and scheduled-job operation ownership
- [ ] Hosting/domain/service access matrix
- [ ] Signed support schedule and change-control agreement
- [ ] Formal sign-off below

## 9. Acceptance record (blank until authorized)
**Decision:** [ ] Accepted  [ ] Accepted with documented exceptions  [ ] Rejected / pending  
**Accepted release / data baseline:** ________________________  
**Outstanding exceptions and deadlines:** ____________________  
**Client sponsor signature/date:** __________________________  
**Client GIS/technical signature/date:** _____________________  
**Supplier representative signature/date:** ___________________

References: [Requirements](../planning/requirements.md), [Architecture](../architecture/overview.md), [Deployment](deployment-operations.md), [User Manual](user-manual.md), [Field Acceptance](../field-acceptance.md), [Production Readiness](../production-readiness.md).
