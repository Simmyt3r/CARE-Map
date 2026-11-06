# CARE-Map Nigeria — State and LGA Deployment

CARE-Map is a Nigeria-only environmental and climate intelligence platform. It supports Nigerian state-level deployment without programme-specific branding; it does not offer a Global or international country mode.

## Product identity and settings
- Country: Nigeria, ISO NG. The national map is centred at approximately 8.6753°E, 9.0820°N.
- Default public product: **CARE-Map Nigeria**. No region environment variables are needed.
- To configure a state pilot, set `NEXT_PUBLIC_CAREMAP_REGION_NAME` to an actual Nigerian state (or FCT), `NEXT_PUBLIC_CAREMAP_REGION_DATA_APPROVED=true`, plus a reviewed map centre using `NEXT_PUBLIC_CAREMAP_MAP_LONGITUDE` and `NEXT_PUBLIC_CAREMAP_MAP_LATITUDE`.
- The old `NEXT_PUBLIC_CAREMAP_STATE_NAME` and `NEXT_PUBLIC_CAREMAP_STATE_DATA_APPROVED` variables remain accepted for compatibility with Nigerian deployments only.
- The approval flag is an operator attestation, **not proof** of dataset validation or tenant isolation. Public branding remains Nigeria-wide.
- Other countries, arbitrary international names and `Global` are rejected.

## Coordinates and national coverage
The WGS84 extent in `src/lib/nigeria-geography.ts` is a broad *screening rectangle*. It rejects clearly international coordinates but must never be represented as an authoritative national boundary. Exact national affiliation, especially near borders and coastlines, needs reviewed national/state/LGA polygon layers, provenance, QA, and human review. Map navigation stays near Nigeria.

All 36 states and the FCT need authoritative and reviewed boundaries, identifiers and supporting LGA coverage for nationwide GIS completeness. This project does not seed all of them automatically.

## Historical deployment and safe bootstrap
Historical database migration `001_init.sql` seeds the original pilot state's LGAs. Migration history/checksums must remain unchanged. A new **empty** Nigerian state deployment can use `npm run geo:bootstrap -- approved-areas.json` with explicit operator approval, reviewed `DATABASE_URL` and `AIVEN_CA_CERT`, and `CAREMAP_GEOGRAPHY_BOOTSTRAP_CONFIRM=REPLACE_EMPTY_INITIAL_GEOGRAPHY`; the script refuses operational data and existing verified boundaries. Never run it on an active database.

The schema currently stores internal `lgas` and `lga_code`, not a nationally complete multi-state hierarchy. A future all-state service needs state codes, validated LGA codes, per-organisation access control, scoped exports and auditing. Separate databases and deployments should be used until multi-tenant isolation is fully designed and tested.

## State Sentinel processing
The implemented state-wide Sentinel-2 tiling code requires a specifically configured Nigerian state and complete approved LGA polygons. Without a state selection, the workflow does **not** create misleading `Nigeria State` analysis jobs. A national aggregate is a separate future capability with state-aware aggregation, quotas and complete spatial quality controls.

## Nigerian governance
The data controller must review the Nigeria Data Protection Act 2023, Nigeria Data Protection Commission guidance, retention, lawful bases, rights, storage/processor transfers and breach reporting. Official NDPC resource: https://ndpc.gov.ng/.

## Optional community finance
The existing restricted community fund module is optional and contains legacy NGN-specific pilot data/rules. It does not imply public funding or payment execution and is not the defining purpose of CARE-Map.

## Migration checksum compatibility
The historical `019_benue_crf_mis.sql` filename remains to preserve migration identity. The comment-only legacy checksum accommodation in the migration tools must be retained. All future SQL changes go into new migration files.
