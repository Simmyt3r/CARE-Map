# State-wide Sentinel-2 vegetation comparison

**Implemented:** 16 October 2026. **Scope:** One fully configured CARE-Map state deployment at a time, starting with Benue. State results are not automatically public or accepted as field evidence.

## Why separate state processing exists

The normal Sentinel analysis deliberately limits AOI extents to 2 degrees, and Vercel requests are short-lived. Requesting an entire state as a single large SentinelHub statistics operation would be too costly, unreliable and hard to quality-check.

The State-wide panel on `/staff/remote-sensing` instead uses PostGIS `lgas.boundary` polygons to generate approximately 0.1-degree-square grid cells, clips each cell **to its own LGA**, and processes tiles independently. The default grid is roughly 10–11 km across (varying with latitude). The provider is queried using actual clipped polygon geometry, **not** a rectangular state envelope. This prevents inclusion of places outside imported LGA boundaries.

### Start a state-wide job

1. Ensure Copernicus credentials are configured in the current deployment.
2. Verify every LGA has an appropriate PostGIS boundary. Review source, topology and geometry validity. The planner rejects missing boundary data and overlaps above 0.2% of mapped area.
3. Administrator: approve database change and backup first, then run pending migration `018_statewide_ndvi_batches.sql` from the existing **Staff Extension** setup panel. This introduces `statewide_ndvi_jobs` and `statewide_ndvi_tiles`; older migrations must not be changed.
4. Navigate to **Staff → Remote Sensing → State-wide vegetation change**.
5. Enter baseline date, later comparison date, observation window (1–30 days) and NDVI threshold. Dates must be **fully elapsed** observation windows.
6. An administrator creates a tile plan. The UI reports tile counts, number of LGAs and the estimated mapped area. Creation is blocked if another state-wide job is active.
7. Administrator clicks **Process / resume tiles**. The app runs **one tile per HTTP invocation**, reports tile status, and repeats sequentially while the browser is open. **Stop** takes effect after the active request. All previous results remain in PostGIS.
8. If interrupted, return later and resume the same job. Do **not** create a new job just to resume. Review the LGA table and interactive map for pass/failure/coverage.

**Execution limitation:** Browser-driven processing is **not a scheduled autonomous worker**. Closing the browser stops additional requests after the current request; another administrator can resume. State-wide jobs may use hundreds of Copernicus requests and substantial quota/time. Monitor the provider's usage and 429/rate-limit responses. Never promise completion in one Vercel function invocation.

## Quality and aggregation

A tile is `completed` only if baseline and comparison NDVI statistics exist, candidate scenes exist, and each period passes the same minimum **60% clear-pixel coverage** requirement as the existing Sentinel workflow.

Tiles without usable imagery are marked `needs_review`. Transient provider errors are `failed`, retried at most twice. A five-minute stale claim window prevents a crashed request from locking a tile indefinitely.

Each LGA gets a **final** vegetation change in hectares and percentage only after every tile assigned to it is marked `completed`. If one tile fails, is cloud-obscured, or remains pending, its final LGA result is withheld. No missing tile is counted as zero. The state total is similarly withheld unless **all** tiles pass. The interface reports **successful quality-covered area percentage** separately from number of completed tiles.

The LGA map uses green for estimated gain, orange for estimated loss, blue-grey for negligible change and grey for **incomplete quality coverage**. The user can select an LGA for metrics.

### Scientific limits

- This is the coverage of the current **imported LGA polygons**. No separate authoritative state boundary has been independently validated by the code.
- The method sums quality-passing coverage-normalized vegetated-area estimates across non-overlapping clipped tiles. Each tile is screened separately. Clear-pixel thresholds are a starting safeguard, not guaranteed remote-sensing accuracy.
- Different image acquisition times, crop calendars, irrigation, phenology, haze, shadows and imperfect scene/cloud classification can affect observed changes. Compare comparable seasons and verify significant findings with field observations and independent GIS analysis.
- Importing LGA geometry does not prove its provenance; obtain reviewed boundaries first.
- Do not imply NDVI measures the effectiveness of an intervention, proves restoration causality, or assigns changes to nearby communities lacking polygon boundaries.
- The result is not automatically published to the public CARE-Map. Any public state/LGA reporting requires an explicit scientific and programme publication review.
- For another state, use a separately configured database/deployment with its own reviewed LGA boundaries, user permissions and government authorization.

## Security, resource and operation safeguards

Only staff can inspect state-wide progress, while administrators alone can create/advance these high-cost jobs. State jobs avoid public personal data; tile statistics and geometry are retained in the deployment's private Postgres database.

Creation requires completed dates and full mapped-LGA coverage. A unique partial index restricts to one active job per database. State-wide statistics are not published until all tiles are verified. The processing endpoint claims only one tile using `FOR UPDATE SKIP LOCKED`. The grid plan is capped at **1600 tiles**. A standard Vercel invocation is limited to 60 seconds.

Aiven's small connection budget requires low-concurrency tile work. The recommended operational practice is **one administrator supervising processing**, verifying quotas and failures periodically, rather than launching competing analyses.

## Implementation references

- `db/migrations/018_statewide_ndvi_batches.sql`
- `src/lib/statewide-ndvi.ts`
- `src/app/api/remote-sensing/statewide/route.ts`
- `src/app/api/remote-sensing/statewide/[id]/route.ts`
- `src/app/api/remote-sensing/statewide/[id]/advance/route.ts`
- `src/components/StatewideNdviWorkbench.tsx`
- `src/components/StatewideNdviMap.tsx`
- `tests/statewide-ndvi.integration.test.ts`

### Acceptance before operational use

- [ ] Apply migration 018 on a backed-up and approved database.
- [ ] Run a small known sample, validate service credentials and time budget for a tile.
- [ ] Verify the tile union area against approved state/LGA boundaries.
- [ ] Compare computed NDVI statistics in sample tiles against QGIS or another independent reference.
- [ ] Check the stop/resume, provider outage, bad-scene, partial-completion, duplicate-admin, and stale-claim cases in real deployment.
- [ ] Review Copernicus quotas and actual wall-clock processing time for a complete state.
- [ ] Obtain programme acceptance for any external state-wide vegetation reporting.

## Operational incident: provider request limit (16 October 2026)

The first Benue-wide comparison (`2025-01-15` versus `2026-01-15`, 14-day windows) planned **515 tiles**. Production tile diagnostics confirmed: **21 completed**, **4 lacked sufficient comparison clear-pixel coverage**, and **490 failed after two attempts with the exact provider response "You have exceeded your rate limit"**. The provider-limit errors are **not vegetation loss**. They do not establish a whole-state NDVI change.

### Protection and selective recovery

- NDVI statistics now recognize both HTTP 429 and Copernicus quota-limit messages as a distinct provider-limit condition.
- The first new quota failure **stops the entire job** in `needs_review` state and the UI stops its loop immediately. Successful tile results remain intact.
- A processing session is capped at **8 tiles** with ~12-second pacing between tile requests. Pacing may reduce burst traffic, but cannot increase subscription processing-unit quota or bypass a hard monthly/daily limit.
- State-wide processing attempts the baseline statistics request before the comparison one and stops on a quota failure, instead of issuing four requests concurrently for a tile already blocked by the provider.
- The existing stopped job may be selectively reopened by an administrator using **Requeue rate-limited tiles after quota review**. This requires an explicit acknowledgement that provider allowances have been inspected. Requeueing does **not** automatically launch Copernicus processing.
- The recovery SQL requeues **only** tiles failed with provider rate-limit/quota messages and resets their attempts for a controlled retry. Valid completed records and the four scientific/cloud-coverage `needs_review` records are preserved. It uses the existing schema; **no new database migration is needed**.
- A state or LGA total remains `Incomplete` until all its own tiles are scientifically quality-passing. Requeueing cannot promote failed/obscured observations into valid results.

**Operator steps:** Sign into the actual Copernicus service account and inspect request/processing quotas, consumption and reset policy. Do **not** resume until sufficient capacity is available. Return to `/staff/remote-sensing`, open the original job, use the explicit requeue action, then process **at most eight tiles** and confirm no further provider-limit message before continuing gradually. If the account cannot accommodate roughly two statistical requests per outstanding tile plus associated catalogue checks, procure approved additional provider capacity or redesign the batch processing service. Never start a second full-state job merely to bypass the quota.

**Scientific follow-up:** After provider capacity is restored, inspect the four comparison clear-coverage review cases independently. Changing dates or cloud thresholds must not quietly overwrite the original selected comparison period.

**Reporting to stakeholders:** This run demonstrates that tiling, persistence and a portion of the Sentinel flow work. It **does not demonstrate a completed Benue-wide vegetation-change product**. Quote passed area/quality and source limitations rather than extrapolating the 21 tiles to all 23 LGAs.
