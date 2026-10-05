# 0003 — Adopt Aiven PostgreSQL/PostGIS and Next.js

**Status:** Accepted
**Accepted:** 2026-10-05
**Supersedes:** the backend ambiguity in ADR-0002.

## Decision

CARE-Map will use:

- **Web application:** Next.js 16.3.8 + React + TypeScript
- **Interactive GIS:** MapLibre GL JS
- **Database:** Aiven for PostgreSQL
- **Spatial engine:** PostGIS
- **Authentication:** application-managed JWT sessions backed by the Aiven users table
- **Hosting:** Vercel
- **Risk engine:** rule-based scoring first, refreshed by a scheduled server job

## Why

The detailed CARE-Map model is relational and geospatial. Aiven PostgreSQL provides the database semantics the model already needs, while PostGIS supplies indexed points, lines, polygons, bounding-box queries, distance checks, and GeoJSON output. Firebase is removed from the implementation path rather than forcing the design into a document model.

## Operational consequences

- Aiven is the system of record.
- DATABASE_URL is server-only and must never be exposed to the browser.
- Production should supply Aiven's CA certificate through AIVEN_CA_CERT so Node verifies the database certificate.
- PostGIS, pgcrypto, and citext are installed by the first migration.
- The application runs migrations explicitly with npm run db:migrate.
- Public map queries are viewport-bounded.
- Risk scoring remains explainable and rule-based until sufficient validated historical data exists for ML.
