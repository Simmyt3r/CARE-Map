# CARE-Map

**Benue ACReSAL Smart Asset, Forest, River & Borehole Tracking System**

CARE-Map is a mobile-first GIS platform for tracking ACReSAL interventions, collecting community reports, monitoring maintenance, and prioritizing field action with explainable risk scoring.

## Current implementation

The repository now contains a working Next.js application and Aiven/PostGIS database migration, not only planning documents.

### Public
- Interactive MapLibre map backed by PostGIS GeoJSON queries
- Borehole, asset, forest-site, and river layers
- LGA/type/status filtering
- Bounding-box queries so only the visible map area is requested
- Anonymous community problem reporting
- Small-river/stream reporting
- Phone GPS capture or manual coordinate entry
- Optional community registration and report tracking
- PWA/service-worker shell for graceful low-connectivity behavior

### Staff
- Secure staff/admin authentication
- Operations dashboard
- Borehole and asset coordinate capture
- Forest polygon and river line entry using GeoJSON
- Infrastructure status updates
- Maintenance-history API
- Community report review/verification/resolution workflow
- Explainable risk priority ranking
- CSV export

### Administration
- Role-based users: registered community, staff, admin
- Admin user creation
- Audit logging for key data changes
- Scheduled risk refresh and two-year report anonymization hook

## Technology

- Next.js 16.3.8 + React + TypeScript
- MapLibre GL JS
- Aiven for PostgreSQL
- PostGIS
- JWT HTTP-only sessions
- Vercel
- Vitest + GitHub Actions

Architecture decision: docs/architecture/decisions/0003-adopt-aiven-postgis-nextjs.md

## Local setup

1. Create an Aiven for PostgreSQL service.
2. Copy .env.example to .env.local.
3. Set DATABASE_URL to the Aiven PostgreSQL service URI.
4. For production-grade certificate verification, put the Aiven CA certificate in AIVEN_CA_CERT with newlines escaped.
5. Set a random SESSION_SECRET of at least 32 characters.
6. Set CRON_SECRET.
7. Run npm install.
8. Run npm run db:migrate.
9. Set ADMIN_EMAIL and ADMIN_PASSWORD, then run npm run db:seed-admin.
10. Run npm run dev.

## Aiven migration

db/migrations/001_init.sql enables PostGIS, pgcrypto, and citext; creates the operational schema; creates GIST spatial indexes; and seeds all 23 Benue LGAs with the 14 initial CARE-Map pilot LGAs marked.

## Environment variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | Aiven PostgreSQL connection URI |
| AIVEN_CA_CERT | Aiven CA certificate for TLS verification |
| SESSION_SECRET | Signs authentication sessions |
| CRON_SECRET | Protects scheduled maintenance/risk endpoint |
| ADMIN_EMAIL | Initial administrator email |
| ADMIN_PASSWORD | Initial administrator password |

Never expose database or session secrets through NEXT_PUBLIC variables.

## API highlights

- GET /api/map/features
- GET/POST /api/resources/{boreholes|assets|forest-sites|rivers}
- PATCH /api/resources/:kind/:id
- GET/POST /api/resources/:kind/:id/maintenance
- GET/POST /api/reports
- PATCH /api/reports/:id/status
- GET /api/reports/mine
- GET /api/dashboard/summary
- GET /api/dashboard/export
- GET /api/predictions/priority-rankings
- GET/POST /api/admin/users
- GET /api/health

## Documentation

See docs/planning, docs/architecture, docs/design, and docs/IMPLEMENTATION.md.

## Production status

Application implementation is substantially complete. The remaining production gate is external: provision the real Aiven service, apply the migration, configure Vercel secrets, run CI against the branch, and perform field acceptance testing with real Benue intervention coordinates before public launch.
