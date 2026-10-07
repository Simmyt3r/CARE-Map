# CARE-Map Production Readiness Center

The Production Readiness Center turns deployment into a live evidence checklist instead of a manual memory exercise.

Open:

`Staff → Infrastructure`

Administrator access is required.

## What it checks

The page reads the deployed server environment and, when reachable, the configured Aiven PostgreSQL database.

Required pilot-launch gates include:

- Aiven PostgreSQL reachable
- Aiven CA certificate configured for strict TLS verification
- PostGIS enabled
- database migrations current with no checksum drift
- SESSION_SECRET configured and at least 32 characters
- CRON_SECRET configured and at least 24 characters
- at least one active administrator
- approved boundaries loaded for every pilot LGA
- baseline borehole/asset data present
- latest completed field acceptance run passes for every pilot LGA
- final data-controller identity, address, privacy contact and lawful-basis wording configured
- formal privacy/legal review attested with review date and reviewer
- privacy-governance tables present with no overdue rights request or tracked NDPC breach-notification clock

Advanced capability gates include:

- statewide LGA boundary coverage
- verified settlement inventory
- verified river geometry
- verified hazard polygons
- verified catchments
- Vercel Blob photo storage
- Copernicus OAuth processing credentials
- at least one reviewed/enabled local-language translation pack

Advanced gates do not block the initial pilot launch, but the related features should not be treated as production-ready until their gate is green.

## Readiness states

- Ready: the system can verify the requirement.
- Warning: partially available or optional data/configuration is missing.
- Blocked: a required launch gate is not satisfied.

The score is calculated from required gates only. Ready gates receive full credit, warnings receive half credit, and blocked gates receive no credit.

## Pilot vs statewide boundary readiness

CARE-Map's initial rollout is pilot-LGA-first. Therefore:

- all pilot LGA boundaries are a required launch gate
- all 23 Benue LGA boundaries are tracked as a separate statewide capability gate

This avoids blocking internal pilot use merely because statewide boundary work is unfinished.

## Migration ledger

Both the web-based Aiven initializer and `npm run db:migrate` use the same migration ledger:

`care_map_schema_migrations`

For every SQL file CARE-Map stores:

- filename
- SHA-256 checksum
- applied timestamp

### Normal behavior

When migrations run:

1. already-recorded files with matching checksums are skipped
2. new files are applied and recorded
3. a recorded file whose checksum changed causes the migration run to stop

Historical migration files should not be edited after application. Schema changes should be added as a new numbered migration.

### Existing databases created before the ledger

An older CARE-Map database may have all schema objects but no migration ledger.

The readiness page reports this as migration history not initialized.

Running Initialize / upgrade schema creates the ledger and processes the migration files. Existing migrations were written with guarded CREATE/ALTER/index/backfill operations so this acts as the one-time ledger bootstrap for legacy installations.

After that bootstrap, future runs skip recorded migrations.

## Aiven TLS

A database connection can technically succeed without AIVEN_CA_CERT because PostgreSQL clients can be configured to accept an unverified certificate. CARE-Map does not treat that as production-ready.

The readiness gate requires AIVEN_CA_CERT so the Aiven server certificate can be verified.

## Live data checks

When the database is available the readiness engine counts:

- total and mapped LGA boundaries
- pilot LGA boundary coverage
- verified rivers
- verified settlements
- boreholes
- assets
- verified hazard zones
- verified catchments
- active administrators
- reviewed/enabled local-language translation packs when migration 015 is present

These are evidence checks, not claims that the data itself is scientifically correct. Dataset verification and field acceptance still matter.

## JSON endpoint

Administrators can retrieve the same readiness evidence from:

`GET /api/admin/readiness`

The endpoint returns environment summary, database/PostGIS state, migration status, dataset counts, readiness score, and every launch gate with its remediation action.

It does not expose secret values.

## Recommended production sequence

1. Configure DATABASE_URL and AIVEN_CA_CERT.
2. Test the Aiven connection.
3. Initialize/upgrade PostGIS and all migrations.
4. Configure SESSION_SECRET and CRON_SECRET.
5. Bootstrap the administrator account.
6. Import approved pilot-LGA boundaries.
7. Import or collect baseline intervention coordinates.
8. Complete formal privacy/legal review and configure controller/contact/lawful-basis/reviewer settings.
9. Apply migration 014 and verify the Privacy Center has no overdue cases.
10. Configure optional Blob/Copernicus capabilities as needed.
11. Redeploy and use Recheck readiness.
12. Use the Field Acceptance Test Center on target devices in every pilot LGA.
13. Resolve failed/conditional runs and recheck readiness before public launch.

## What the panel does not prove

A green readiness score means the software and required baseline configuration are present. It does not replace:

- GIS data-quality review
- field acceptance testing
- NDPA/privacy review
- operational SOP approval
- scientific validation of hazard or remote-sensing products
- staff training

Those remain human governance tasks, because apparently software is still not permitted to chair every committee.
