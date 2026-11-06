# CARE-Map: Regional Deployment and Data Isolation

CARE-Map is a general-purpose climate intelligence, environmental resource mapping and community resilience platform. The public-facing product is not associated with any particular agency or funded programme.

## Supported architecture

- One independently configured deployment per region or operating organisation.
- Separate PostgreSQL/PostGIS database, identity records, encryption/session secrets, file storage, privacy controller, verified GIS layers, and operating procedures.
- The default public label is **Global**, with a world-scale map. This is a neutral presentation only; it does not assert that global datasets are installed.
- To display a specific region, set `NEXT_PUBLIC_CAREMAP_REGION_NAME`, `NEXT_PUBLIC_CAREMAP_REGION_DATA_APPROVED=true`, and reviewed map latitude/longitude. The approval flag records an operator decision; it does **not** validate GIS datasets or provide tenant isolation.
- Legacy `NEXT_PUBLIC_CAREMAP_STATE_NAME` and `NEXT_PUBLIC_CAREMAP_STATE_DATA_APPROVED` environment variables remain accepted for compatibility.

## Critical database restriction

Historical migration `db/migrations/001_init.sql` seeds a specific Nigerian state and marks certain local government areas as pilots. **Do not edit this historical migration**: database migration checksums protect already-provisioned installations. New non-default deployments must not relabel these historic records as a different region. For a freshly migrated empty database, an operator can use the explicit `npm run geo:bootstrap -- approved-areas.json` script to replace only the original untouched seed. It requires verified `DATABASE_URL`, `AIVEN_CA_CERT` and `CAREMAP_GEOGRAPHY_BOOTSTRAP_CONFIRM=REPLACE_EMPTY_INITIAL_GEOGRAPHY`. A JSON file must declare `regionName`, `provenance`, and `areas` containing unique `{code,name,pilot}` entries. The script refuses existing boundaries or operational records and runs within a transaction. Never execute it on an operational deployment; verify all relationships, spatial layers and field acceptance gates before launch.

The current tables use `lgas` and `lga_code` as internal administrative-geography identifiers. The UI can speak about administrative areas, but this **does not yet make geographic identifiers universally portable**. A truly arbitrary country, province or multi-country deployment needs a reviewed migration for administrative-unit hierarchy and source-specific spatial data.

## Deployment checklist

1. Choose and verify the geographic scope and data controller.
2. Provision dedicated Aiven/PostGIS, Cloudinary and Vercel resources.
3. Verify geographic reference system (WGS84), administrative codes and boundary provenance.
4. Remove or replace legacy seed data only with a documented, backed-up transition, never by relabeling it.
5. Import approved environmental layers, settlements, water points, land cover, catchments and hazard evidence.
6. Configure legal basis, retention, operator contacts and reviewed translations; avoid location-specific legal claims outside the jurisdiction.
7. Validate GIS boundaries, report geolocation checks, satellite imagery quality gates and role permissions.
8. Run CI and field acceptance with real devices; validate access, privacy, scaling and monitoring before public release.

## Future central multi-region service

A shared platform would require organisation/region IDs on every scoped table, composite uniqueness, database-enforced isolation, per-request authorization, scoped exports, audit controls, and migration/recovery plans. This is not implemented by presentation settings. Until then use separate databases and deployments.

## Optional modules

Community-fund accounting is a restricted, jurisdiction-specific extension of the core environment platform. Monetary units, policy references and approval chains must be reviewed before this module is used in a new region. It is not evidence of payments or funding.

## Historical migration comment compatibility

One comment-only wording cleanup in migration `019_benue_crf_mis.sql` has an explicitly calculated legacy checksum accepted by both the web migrator and CLI migrator. Its executable SQL is unchanged. Other historical migration edits remain prohibited and must be introduced in new numbered files.
