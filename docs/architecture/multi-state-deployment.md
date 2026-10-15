# CARE-Map Multi-State Reuse — Deployment & Data Isolation Plan

**Status:** Design guardrails and first configuration refactor implemented 15 October 2026. **Benue remains the only provisioned dataset.** CARE-Map is NOT yet a shared multi-state/tenant platform.

## Decision: separate deployment per state first

CARE-Map's GIS, workflows, reports, extension, Sentinel-2 and operational tools can be reused by other Nigerian states. To avoid accidental cross-state exposure, the approved near-term pattern is **one Vercel project, one Aiven database and state-specific source datasets per state**. Separate accounts, Cloudinary storage prefixes or accounts, operational contacts, secrets, reports, community interventions, backups, domain and acceptance approvals for each deployment.

Do not point a new state's deployment to Benue's existing `DATABASE_URL`. Do not copy staff, citizen, GPS, report or consent records to an unrelated state deployment.

### Configuration available now

The existing application now centralizes its public deployment identity and initial map viewport. By default, no environment variables are required and the existing Benue values remain:

| Variable | Existing default | New-state example / meaning |
|---|---|---|
| `NEXT_PUBLIC_CAREMAP_STATE_NAME` | `Benue` | A state name, only after reviewing that state's complete source dataset |
| `NEXT_PUBLIC_CAREMAP_MAP_LONGITUDE` | `8.7` | Reviewed map center longitude, WGS84 |
| `NEXT_PUBLIC_CAREMAP_MAP_LATITUDE` | `7.35` | Reviewed map center latitude, WGS84 |
| `NEXT_PUBLIC_CAREMAP_MAP_ZOOM` | `6.5` | Initial map zoom between 3 and 15 |
| `NEXT_PUBLIC_CAREMAP_STATE_DATA_APPROVED` | not set | Must be `true` before displaying a non-Benue state identity |

**Important:** The `STATE_DATA_APPROVED` variable is a deployment-approval gate, **not** an automated geospatial validation or proof of legal/operational acceptance. These are build-time client-visible values, never secrets. Changing them requires a build/redeploy. They do **not** change which data is in PostgreSQL.

The app's navigation branding, default English home description, browser metadata and initial public-map center now use the profile. Other Benue-specific strings, translations, baseline coordinates, import assumptions and GIS documents need review before an actual new-state release.

### Blockers before setting any other state's approval flag

1. **Migrations seed Benue LGAs today.** Historical `db/migrations/001_init.sql` includes 23 Benue LGA rows and must **not** be changed because the existing database uses migration checksums. A separate new-state bootstrap and verified LGA seed path are still needed. Do not run the current Benue seed and simply relabel the app.
2. Existing LGA primary keys and operational tables presume one deployment jurisdiction. They are **not tenant-isolated** by `state_id`, so pointing two states at the same database would mix records and permissions.
3. The existing public translation list contains Benue-specific languages such as Tiv, Idoma and Igede. New states need officially reviewed language packs and correct consent/privacy notice text.
4. Validate state/LGA boundaries, settlement sets, catchments, forest and river sources, administrative codes, map extents and GPS-to-LGA behavior using authority-approved datasets.
5. Configure separate Aiven/Vercel/Cloudinary/Copernicus credentials, backup retention, administrator accounts and allowed web origins. Test HTTPS, TLS CA verification, quotas and source provenance.
6. Confirm community-competition projects, field officers, visits and rewards belong to that deployment's jurisdiction. Role separation in current application assumes one operating organization.
7. Complete local safety/technical review of climate/erosion guidance, citizen education and jurisdictional policy and translations.
8. Complete full Android/browser/GIS/NDVI/cloud/offline acceptance and record signed state-specific approval. **Only then** enable state identity and release the branded deployment.

### Later: central multi-state platform

If several participating states demand a **single shared** CARE-Map service, that is a distinct authorized architectural change and requires:
- State registry and non-ambiguous `state_id` on every scoped table including LGA codes, assets, reports, users, attachments, audit, project interventions and satellite findings.
- Database-enforced tenant isolation / Row Level Security where applicable, verified per-state authorization for every API route and export.
- A migration plan preserving Benue production data, safe composite unique keys and full integration tests preventing cross-state reads/writes.
- Per-state privacy policies, data retention, responsible data controller roles and governance, plus state-specific domains or access controls.
- Cost and load planning for Aiven connection pressure, queue/cron workloads and satellite quotas.

Until those prerequisites are met, **do not describe CARE-Map as an existing multi-tenant system**. Portability and multi-tenancy are different capabilities.

## Stabilization changes on 15 October 2026

- Require certificate-verified TLS to PostgreSQL and strip connection-string TLS flags that could override application policy.
- Add connection/query time limits; public health checks no longer reveal driver error messages.
- Reduce anonymous generic resource responses to explicit public fields, keeping internal actor IDs, field GPS metadata and operational notes staff-only.
- Preserve Benue defaults and gate other-state public map identity on explicit deployment approval.
- Add unit tests for TLS and deployment configuration. Shared cross-instance rate limiting remains an open item; do not present process-local rate control as a complete solution.

**Migration status:** No additional database migration is introduced by these portability and security changes. For the Benue project, existing migration 001–017 files and data remain unchanged.
