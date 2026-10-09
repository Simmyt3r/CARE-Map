# CARE-Map Implementation Status

**Updated:** 2026-10-09 | **Status:** Substantial application implementation in repository; production provisioning, source-data validation and client acceptance remain outstanding.

The authoritative feature inventory and API list are in the [root README](../README.md). This page summarizes implementation boundaries without implying a deployment or real-world verification that has not happened.

## Implemented code areas
- Public MapLibre/PostGIS maps, LGA filters, public resource details and QR report entry.
- Community problem/stream reporting, optional accounts, public privacy flows and an offline community report queue.
- Staff asset, borehole, river and forest data management; inspections and maintenance; photos, GPS provenance, verified review and report assignment.
- GIS CSV/GeoJSON import, data quality, spatial proximity, LGA coverage, settlement-water access, river exposure, hazard polygons and catchment analysis; printable Map Composer.
- Sentinel-2 scene search, baseline/comparison NDVI, monitored areas, alerts and linked field verification tasks.
- Administrator users/roles, audit logs, privacy/governance, translation packs, Production Readiness and Field Acceptance.
- Schema migrations 001–015, PostGIS spatial indexes, basic CI/Vitest infrastructure.

## Not established by code alone
- Live Aiven provisioning, strict TLS and production secret configuration.
- Production Vercel environment, Blob storage, Copernicus credentials and scheduled-job execution.
- Authenticated client-approved administrative/pilot baseline data and official LGA boundary completeness.
- Actual production load testing against the 500-concurrent-user / under-2-second targets.
- Independent privacy/security review, satellite/hazard scientific validation and backup-restore exercise.
- Signed field acceptance for all pilot LGAs and formal client go-live approval.
- Full offline map tile support, offline staff editing, or a trained AI prediction model.

## Deployment
Use the [Deployment and Operations Guide](client-handover/deployment-operations.md), followed by [Production Readiness](production-readiness.md) and [Field Acceptance](field-acceptance.md). Never publish secrets in Git or send them in handover documents.

## Client release package
Start from the [Five Essential Client Documents](README.md#the-five-essential-client-facing-documents). The UAT/handover document contains the unsigned approval and contractual responsibility template.
