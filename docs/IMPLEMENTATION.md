# CARE-Map Implementation Status

**Updated:** 2026-10-13 | **Status:** Substantial application implementation and GPS reliability improvements committed; production release parity, accepted source data and field/UAT sign-off remain separate requirements.

The authoritative feature inventory and API list are in the [root README](../README.md). This page summarizes implementation boundaries without implying a deployment or real-world verification that has not happened.

## Implemented code areas
- Public MapLibre/PostGIS maps, LGA filters, public resource details and QR report entry.
- Community problem/stream reporting, optional accounts, public privacy flows and an offline community report queue.
- Staff asset, borehole, river and forest data management; inspections and maintenance; Cloudinary photos, GPS provenance, verification review and report assignment.
- Public ACReSAL extension information and staff community interventions with consenting contact persons, extension visits and photo-backed independent maintenance scoring. Reward decisions need separate project/budget authority.
- Shared high-accuracy GPS sampling for field asset/intervention, report and inspection forms: rejection of stale/invalid fixes, acquisition/cancellation feedback, and manual-coordinate provenance clearing.
- GIS CSV/GeoJSON import, data quality, spatial proximity, LGA coverage, settlement-water access, river exposure, hazard polygons and catchment analysis; printable Map Composer.
- Sentinel-2 scene search, baseline/comparison NDVI, monitored areas, alerts and linked field verification tasks.
- Administrator users/roles, audit logs, privacy/governance, translation packs, Production Readiness and Field Acceptance; session-authenticated admin migration UI.
- Schema migration files **001–017**, PostGIS spatial indexes, GitHub CI/Vitest and targeted GPS regression tests.

## Not established by code alone
- Applied migration status and dataset contents on the target Aiven production database. Repository migration files are not proof of execution.
- Current Vercel deployment commit matching the reviewed application commit, actual Cloudinary upload success, Copernicus end-to-end processing, and scheduled-job execution under real quota/network conditions.
- Authenticated client-approved administrative/pilot baseline data and official LGA boundary completeness.
- Actual load/performance testing against the client-approved concurrency and response-time targets.
- Independent privacy/security review, satellite/hazard scientific validation and backup-restore exercise.
- Signed field acceptance for all pilot LGAs and formal client go-live approval.
- Full offline map tile support, offline staff editing, or a trained AI prediction model.

## Quality focus (no new features)

1. Compare the live production Git SHA with the current reviewed release SHA.
2. Run TypeScript, lint, unit tests, production build and security/access-control regressions.
3. Complete [GPS field acceptance](quality/gps-field-acceptance.md) with a *known reference point* on target devices; software cannot claim survey accuracy from the browser-reported accuracy radius.
4. Verify source provenance and geospatial coordinates, LGA boundaries, settlement imports and satellite quality.
5. Apply any pending migrations via the administrator page **`/staff/admin/migrations`** in the deployed app, after database backup and change approval; keep legacy migration files immutable.
6. Perform backup/restore, privacy and incident-response checks; record signed field/UAT results.

## Deployment
Use the [Deployment and Operations Guide](client-handover/deployment-operations.md), followed by [Production Readiness](production-readiness.md) and [Field Acceptance](field-acceptance.md). Never publish secrets in Git or send them in handover documents.

## Client release package
Start from the [Five Essential Client Documents](README.md#the-five-essential-client-facing-documents). The UAT/handover document contains the unsigned approval and contractual responsibility template.
