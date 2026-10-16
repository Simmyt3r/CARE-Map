# CARE-Map Documentation and Client Handover Index

**Updated:** 2026-10-13 | **Release:** implementation / quality-hardening baseline; deployment and field acceptance are separate checks.

CARE-Map is the Benue ACReSAL Smart Asset, Forest, River & Borehole Tracking System. The repository implements substantial functionality; the client must separately approve requirements, provision services, validate GIS data and complete acceptance testing.

## The five essential client-facing documents

| No. | Controlled document | Link | Current status |
|---|---|---|---|
| 1 | Software Requirements Specification (SRS) | [Requirements](planning/requirements.md) | Implemented baseline, client review pending |
| 2 | Software Architecture Document (SAD) | [Architecture Overview](architecture/overview.md) | Current implementation architecture; external launch dependencies |
| 3 | Installation, Deployment & Operations Guide | [Deployment and Operations](client-handover/deployment-operations.md) | Draft runbook; production not certified |
| 4 | User Manual | [User Manual](client-handover/user-manual.md) | Draft by role; client training pending |
| 5 | UAT, Handover & Support Plan | [Acceptance and Support](client-handover/acceptance-support.md) | Unsigned acceptance template and negotiated support schedule |

**Client delivery condition:** These five documents are necessary but not sufficient. Formal data ownership, code/IP license, support SLAs, privacy approval and acceptance signatures require specific client authorization.

## Supporting technical references
- [Project README](../README.md) and [Implementation](IMPLEMENTATION.md)
- [October 2026 documentation changelog](CHANGELOG.md) (GPS, cloud storage, API corrections and field-readiness status)
- [Production Readiness](production-readiness.md) and [Field Acceptance](field-acceptance.md)
- [Detailed Data Model](architecture/data-model.md) (historical draft; refer to applied SQL migrations as implementation authority)
- [API Contracts](architecture/api-contracts.md) (confirm routes against current source/API)
- [Technology Stack](architecture/tech-stack.md) and [ADR-0003: Aiven/PostGIS/Next.js](architecture/decisions/0003-adopt-aiven-postgis-nextjs.md)
- [GIS Boundaries](lga-boundaries.md), [Coverage Analysis](intervention-coverage.md), [Settlement Access](settlement-access.md), [River Exposure](river-corridor-exposure.md), [Hazard Zones](hazard-zones.md), [Catchments](catchments-landscape-planning.md)
- [Remote Sensing](remote-sensing.md), [Map Composer](map-composer.md), [Localization](localization.md)
- [State-wide Sentinel-2 Workflow](remote-sensing-statewide.md) (LGA-clipped tiles, resumable processing, coverage and scientific quality gates)
- [ACReSAL Extension and Community Stewardship](planning/community-extension.md) (project contacts, visits, evidence-backed assessment and reward governance)
- [GPS Field Acceptance and Regression Checklist](quality/gps-field-acceptance.md) (current capture thresholds, known limits and device tests)
- [System Hardening Audit — 2026-10-14](quality/system-hardening-audit-2026-10-14.md) (component inventory, verified defects, risk register, prioritized release gates)
- [Multi-State Deployment & Data Isolation](architecture/multi-state-deployment.md) (state-by-state deployment plan and mandatory GIS/authorization checks)
- [Planning Scope](planning/scope.md), [Roadmap](planning/roadmap.md), [Data Privacy](planning/data-privacy.md), [Design](design/README.md)

## October 2026 quality baseline

- Staff and public forms share **high-accuracy GPS sampling** with estimated accuracy, timestamp and coordinate-provenance validation. The target is **≤30 m reported accuracy**; this does not independently verify geographic position. Refer to the [field checklist](quality/gps-field-acceptance.md).
- **Cloudinary** stores new uploaded photos and evidence; historical Vercel Blob references remain where present. No sensitive evidence should use public image delivery URLs.
- **Copernicus Sentinel Hub** powers Sentinel-2 NDVI processing. A comparison needs sufficient clear-pixel coverage in *both* date windows and administrative review before public publication.
- Schema migrations **001–017** are in the repository. Whether each one is **applied to Aiven** must be checked in the migration ledger; a Git commit or Vercel `READY` deployment is not evidence that migrations ran.
- The administrator migration page is `/staff/admin/migrations`. It uses an existing **administrator session** and server-stored Aiven credentials, without a second credential prompt. Permissions and approval still apply.
- Documentation updates and GitHub CI passing do **not** prove the most recent commit has deployed to the production domain. Compare the deployment commit to the release commit before acceptance.
- This project is in a **stabilization phase**: prioritize defects, GPS accuracy, performance, security, datasets and field acceptance over new features.

## Source of truth and status convention
1. **Code and applied migrations** establish what has actually been implemented.
2. **Approved SRS + release baseline** establish contractually promised scope, only after written sign-off.
3. **Live readiness checks and observed field/UAT evidence** establish operational fitness for the specific deployment.
4. Unreviewed old planning documents are **historical context**, not proof of current implementation or signed client scope.
5. Do not label unverified scientific outputs, risk scoring, security/load targets or remote-sensing accuracy as independently certified.

## Documentation maintenance
Update the architecture index and SRS for material changes; issue new numbered migrations rather than changing applied files. Document the Git commit/version, author, date, review and approval for each client delivery. Architecture decisions are preserved as ADRs; new decisions supersede accepted ADRs rather than rewriting history.
