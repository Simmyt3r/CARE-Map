# CARE-Map Installation, Deployment and Operations Guide
**Document:** CM-DEP-001 | **Version:** 1.0-draft | **Date:** 2026-10-09  
**Owner:** To be agreed | **Status:** Technical handover draft, deployment not certified

## 1. Purpose and prerequisites
This runbook is for authorized client IT/GIS administrators deploying and maintaining the CARE-Map Next.js application. Required: authorized GitHub repository access, Vercel project ownership, an Aiven for PostgreSQL service with PostGIS support, DNS/domain access, and trained administrators. No production password, access token, database URI or private certificate belongs in this document.

## 2. System topology
Browser/PWA -> Vercel-hosted Next.js application/API -> Aiven PostgreSQL/PostGIS. Uploaded field photos and acceptance evidence use Vercel Blob; Sentinel-2 scene discovery uses Earth Search STAC and optional Copernicus processing credentials. Scheduled endpoint jobs handle risk refresh, monitoring and privacy retention. See [Architecture](../architecture/overview.md).

## 3. Required configuration
| Name | Scope | Description |
|---|---|---|
| DATABASE_URL | Server secret | Aiven PostgreSQL connection URI |
| AIVEN_CA_CERT | Server secret | Aiven CA certificate for strict TLS verification |
| SESSION_SECRET | Server secret | Unique random secret, 32+ characters |
| CRON_SECRET | Server secret | Strong scheduler secret, 24+ characters |
| ADMIN_EMAIL | Bootstrap-only | Initial admin identity |
| ADMIN_PASSWORD | Bootstrap-only | Strong initial admin password |
| BLOB_READ_WRITE_TOKEN | Optional server secret | Vercel Blob uploads |
| CDSE_CLIENT_ID / CDSE_CLIENT_SECRET | Optional server secrets | Copernicus processing authorization |
| DATA_CONTROLLER_NAME / DATA_CONTROLLER_ADDRESS / PRIVACY_CONTACT_EMAIL | Production governance | Legally approved privacy ownership/contact |
| PRIVACY_LAWFUL_BASIS_REPORTS / PRIVACY_LAWFUL_BASIS_ACCOUNTS / PRIVACY_LEGAL_REVIEWED_AT / PRIVACY_REVIEWER | Production governance | Approved privacy wording and review evidence |

Never use `NEXT_PUBLIC_` for secrets. Use the project's `.env.example` as the current configuration inventory. Follow least-privilege access, TLS, administrator MFA where available, and credential rotation after staff turnover.

## 4. First deployment
1. Securely provision Aiven PostgreSQL, confirm connectivity, and obtain the service CA.
2. Clone the GitHub repository to an approved workstation/CI environment; pin the reviewed release commit.
3. Run `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Resolve failures before rollout.
4. Set `DATABASE_URL`, `AIVEN_CA_CERT`, `SESSION_SECRET`, `CRON_SECRET` and bootstrap admin credentials in the secure server environment.
5. Run `npm run db:migrate`; check PostGIS, schema objects, and the `care_map_schema_migrations` checksum ledger for migrations 001–015.
6. Run `npm run db:seed-admin` once using controlled administrator credentials. Remove bootstrap password exposure afterwards.
7. Configure the same required server secrets in Vercel; deploy the pinned commit and connect the approved domain over HTTPS.
8. Configure Vercel Blob, satellite credentials, scheduled endpoints and privacy metadata if the corresponding features are in scope.
9. Import **verified** pilot LGA polygons, resource points and other authorized datasets using the GIS workbench.
10. Run the administrator Production Readiness Center and per-LGA Field Acceptance Test Center. Do not go live until required gates pass and authorized sign-off is recorded.


## 4A. First-time command-line setup (recommended)
From a trusted local checkout of the repository, install dependencies and create a private `.env.local` file containing `DATABASE_URL`, `AIVEN_CA_CERT`, `ADMIN_EMAIL`, and a **new rotated** `ADMIN_PASSWORD` of at least 12 characters. Do not commit the file, paste credentials into chat or expose them in command logs. For PEM CA material in a dotenv file, put its line breaks in one quoted value as literal `\\n` sequences. Use a Node.js version supporting `--env-file` (Node 20.6+).

Run:

```bash
npm install
node --env-file=.env.local scripts/setup.mjs
```

The script first validates the configuration, then executes the existing checksum-tracked migrations and admin seeding. It stops on the first failure, runs no destructive reset, and does **not** configure Vercel secrets. Re-running it skips applied matching migrations and resets the specified administrator's password: avoid re-running unnecessarily. If `AIVEN_CA_CERT` verification fails, fix the CA/connection configuration rather than disabling verification. The `npm run setup` alias works only when variables are already exported in the invoking environment.

**Separate Vercel setup:** `SESSION_SECRET` and `CRON_SECRET` must be independently generated and saved in Vercel Production environment; redeploy for them to take effect. Confirm current post-deploy health and readiness with an authorized administrator.

## 5. GIS data management
All incoming location data must include source, collection date, validation status, coordinate-reference system and responsible reviewer. WGS84 longitude/latitude order is mandatory for GeoJSON. Check geometry validity, duplicated points, LGA coverage and GPS accuracy; never manufacture survey-grade precision. Back up database before large imports. Keep migration scripts immutable after application.

## 6. Health, observability and recurring operations
- Health endpoint: `GET /api/health` (review response without exposing sensitive configuration).
- Administrator readiness endpoint: `GET /api/admin/readiness`; verify database, migration, privacy, data and acceptance gates.
- Inspect Vercel runtime/scheduler logs, Aiven performance/connection monitoring, import-job history, risk/vegetation scheduler outcomes and access/audit logs.
- Assign a named operator to review failed imports, missed scheduled jobs, vegetation alerts, unresolved/overdue reports and privacy rights requests.
- Define monitoring thresholds, alert destinations, working hours and escalation contacts with the client before go-live.

## 7. Backup and recovery
**Client decision required:** database backup frequency, retention, storage geography, RPO and RTO. Enable and verify Aiven backups; separately inventory and protect Blob files. Perform a restore drill into a non-production database and confirm migrations, spatial indexes, application access, photos and representative features. Never restore over production without approved incident/change procedures.

## 8. Releases and rollback
Use version-tagged releases, review changes, run CI and migration checks in staging, back up production, deploy in a change window and run smoke tests. Avoid assuming SQL migrations are reversible: application rollback and database rollback are different actions. If a migration is incompatible, follow an approved forward-fix or tested database restore plan. Record the deployed commit, operator, timestamp and post-deployment evidence.

## 9. Minimum post-deployment smoke test
- HTTPS and public map render on desktop/mobile.
- Authorized staff login, role checks and revoked account behavior.
- Viewport maps expose approved GeoJSON only.
- Create and verify a designated test report, assignment and resolution.
- Create/read a field inspection and photo if Blob is configured.
- GPS and offline report submission/synchronization on a real device.
- Export a vetted GeoJSON file and open it in QGIS.
- Test satellite discovery/processing only if Copernicus integration is enabled.
- Record Production Readiness and Field Acceptance evidence.

## 10. Handover inventory
Release commit/tag, deployment and domain ownership, Aiven ownership and backup policy, administrator access transfer method (separately and securely), validated data sources, privacy contacts, on-call escalation, runbooks, user manual, accepted test evidence, known defects and support agreement.

**Important:** No live credential, field dataset or production acceptance evidence has been verified by this document alone.
