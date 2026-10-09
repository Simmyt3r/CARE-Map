# CARE-Map Documentation and Client Handover Index

**Updated:** 2026-10-09 | **Release:** working implementation, not yet production/field accepted.

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
- [Production Readiness](production-readiness.md) and [Field Acceptance](field-acceptance.md)
- [Detailed Data Model](architecture/data-model.md) (historical draft; refer to applied SQL migrations as implementation authority)
- [API Contracts](architecture/api-contracts.md) (confirm routes against current source/API)
- [Technology Stack](architecture/tech-stack.md) and [ADR-0003: Aiven/PostGIS/Next.js](architecture/decisions/0003-adopt-aiven-postgis-nextjs.md)
- [GIS Boundaries](lga-boundaries.md), [Coverage Analysis](intervention-coverage.md), [Settlement Access](settlement-access.md), [River Exposure](river-corridor-exposure.md), [Hazard Zones](hazard-zones.md), [Catchments](catchments-landscape-planning.md)
- [Remote Sensing](remote-sensing.md), [Map Composer](map-composer.md), [Localization](localization.md)
- [Planning Scope](planning/scope.md), [Roadmap](planning/roadmap.md), [Data Privacy](planning/data-privacy.md), [Design](design/README.md)

## Source of truth and status convention
1. **Code and applied migrations** establish what has actually been implemented.
2. **Approved SRS + release baseline** establish contractually promised scope, only after written sign-off.
3. **Live readiness checks and observed field/UAT evidence** establish operational fitness for the specific deployment.
4. Unreviewed old planning documents are **historical context**, not proof of current implementation or signed client scope.
5. Do not label unverified scientific outputs, risk scoring, security/load targets or remote-sensing accuracy as independently certified.

## Documentation maintenance
Update the architecture index and SRS for material changes; issue new numbered migrations rather than changing applied files. Document the Git commit/version, author, date, review and approval for each client delivery. Architecture decisions are preserved as ADRs; new decisions supersede accepted ADRs rather than rewriting history.
