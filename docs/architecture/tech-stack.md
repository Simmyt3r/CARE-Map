# Technology Stack

**Status:** Accepted
**Last updated:** 2026-10-05

ADR-0003 supersedes the backend ambiguity in ADR-0002.

| Layer | Selected technology | Reason |
|---|---|---|
| Web | Next.js 16.3.8 + React + TypeScript | Single full-stack application, server routes, mobile-first UI, straightforward Vercel deployment |
| GIS rendering | MapLibre GL JS | Open-source interactive map engine with GeoJSON support |
| Database | Aiven for PostgreSQL | Managed relational database aligned with CARE-Map structured intervention data |
| Spatial engine | PostGIS | Native points, lines, polygons, GIST indexes, bounding-box queries, distance calculations and GeoJSON output |
| Authentication | JWT HTTP-only sessions + database roles | Deployable RBAC without coupling CARE-Map to another backend vendor |
| Hosting | Vercel | Fits the Next.js runtime and scheduled cron endpoint |
| Risk/AI | Rule-based scoring first | Explainable decisions before enough validated historical data exists for ML |
| Testing | TypeScript, ESLint, Vitest, GitHub Actions | Automated regression and build checks |

## Database transport

Aiven PostgreSQL connections use TLS. Production should provide the Aiven CA certificate through AIVEN_CA_CERT so the Node PostgreSQL client performs certificate verification.

## Spatial design

All CARE-Map spatial records use SRID 4326. Points are stored for boreholes, assets and reports; arbitrary geometry is stored for forest boundaries and river courses. Each spatial column has a GIST index.

## Revisit triggers

Revisit this stack only if field deployment reveals a concrete constraint such as native offline requirements, substantially higher tile traffic, satellite-processing workloads, or integration requirements from ACReSAL existing systems.
