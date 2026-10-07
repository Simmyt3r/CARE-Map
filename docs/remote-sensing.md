# CARE-Map Remote Sensing & NDVI

**Status:** Implemented baseline  
**Satellite source:** Sentinel-2 Level-2A surface reflectance  
**Catalog discovery:** Earth Search STAC v1  
**Processing/statistics:** Copernicus Data Space Ecosystem Sentinel Hub APIs

## Purpose

The Remote Sensing workspace turns satellite observations into a repeatable CARE-Map monitoring record.

A staff user can:

1. Select an existing CARE-Map forest/afforestation boundary or draw an AOI on the map.
2. Select a baseline date and comparison date.
3. Search nearby Sentinel-2 observations and inspect cloud cover.
4. Run an NDVI comparison.
5. Review mean NDVI, clear-pixel coverage, vegetated area, area change and percentage change.
6. Compare baseline/comparison NDVI image previews.
7. Save the analysis in PostGIS.
8. Publish the completed AOI as a vegetation-change layer on the public map.

## NDVI

CARE-Map calculates:

```
NDVI = (B08 - B04) / (B08 + B04)
```

For Sentinel-2 Level-2A:

- B08 = near infrared
- B04 = red
- sampling used by the CARE-Map statistics request ≈ 10 m in Benue

Higher positive NDVI usually indicates stronger green vegetation. Threshold meaning varies by ecosystem and season, so the threshold is configurable instead of being hard-coded as a universal truth.

The initial UI offers:

- 0.20
- 0.30
- 0.40
- 0.50

## Cloud masking

The Statistical and preview evalscripts request:

- B04
- B08
- SCL
- dataMask

The baseline excludes unusable/cloud-contaminated SCL classes including:

- saturated/defective
- cloud shadow
- medium/high probability cloud
- cirrus
- snow/ice

Cloud-masked pixels are excluded. CARE-Map reports clear-pixel coverage so a result with poor usable coverage is visible to the analyst instead of quietly pretending the clouds were vegetation.

## Observation window

The selected date is the start of an observation window.

Example:

- baseline date: 2026-01-10
- window: 7 days
- request period: 2026-01-10 through 2026-01-17

The processing provider uses least-cloud mosaicking within the selected window.

Short windows are closer to a specific date but are more likely to have no usable imagery. Longer windows increase the chance of usable clear pixels but also represent a broader time period.

## Scene discovery

Scene discovery does not require CARE-Map Copernicus credentials.

CARE-Map queries:

```
https://earth-search.aws.element84.com/v1
```

Collection:

```
sentinel-2-l2a
```

The lowest-cloud matching observations are surfaced in the workbench as candidate scenes.

This metadata search is separate from the Copernicus processing request. Processing uses the configured date window and least-cloud mosaicking.

## Copernicus configuration

To enable NDVI statistics and image previews, configure:

```
CDSE_CLIENT_ID=
CDSE_CLIENT_SECRET=
```

Default service locations used by CARE-Map:

```
CDSE_TOKEN_URL=https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
CDSE_SH_BASE_URL=https://sh.dataspace.copernicus.eu
```

Optional public catalog override:

```
EARTH_SEARCH_STAC_URL=https://earth-search.aws.element84.com/v1
```

The Infrastructure panel can include the OAuth client values in the generated Vercel environment bundle.

Do not expose either credential in a `NEXT_PUBLIC_*` variable.

## Vegetated-area calculation

The provider returns statistics at approximately 10 m sampling for the geographic CRS used by the current implementation.

CARE-Map derives:

- mean NDVI
- binary vegetation fraction for the configured NDVI threshold
- clear-pixel fraction
- vegetated-area estimate

Conceptually:

```
estimated vegetation area =
AOI area × vegetation fraction observed across valid clear pixels
```

The result is expressed in hectares.

The vegetation fraction is calculated only from valid clear pixels, then applied to the full AOI to produce a coverage-normalized estimate. Clear-pixel coverage is always reported separately as the confidence/quality indicator. This avoids treating a cloudier image as automatic vegetation loss, but it also assumes the visible pixels are reasonably representative of the AOI. Low-clear-coverage observations must therefore be treated cautiously.

## Change calculation

For two completed observations:

```
change_ha = comparison_vegetation_ha - baseline_vegetation_ha
```

```
change_pct = (change_ha / baseline_vegetation_ha) × 100
```

Negative change indicates a reduction in threshold-classified vegetation. Positive change indicates an increase.

The initial map severity rules are:

| Vegetation change | Level |
|---|---|
| >= -5% | low |
| < -5% to > -15% | medium |
| <= -15% to > -25% | high |
| <= -25% | critical |

These are operational triage classes, not ecological diagnoses.

## Interpretation

Do not interpret NDVI change without context.

A decrease can be caused by:

- seasonal vegetation cycles
- crop harvest
- drought
- fire
- land clearing
- grazing pressure
- flooding
- cloud/shadow contamination
- genuine land degradation

For monitoring, compare similar seasons when possible and use field verification for consequential conclusions.

A sensible ACReSAL workflow is:

```
Satellite change signal
        ↓
CARE-Map priority / map layer
        ↓
Field verification
        ↓
Inspection/report/photos
        ↓
Management decision
```

## Database

Migration:

```
db/migrations/004_remote_sensing.sql
```

The `remote_sensing_analyses` table stores:

- AOI MultiPolygon
- comparison dates/window
- vegetation threshold
- provider/status
- scene metadata
- raw statistics response
- mean NDVI
- clear coverage
- vegetation hectares
- vegetation area/percentage change
- change severity
- public-map publishing state
- creator/timestamps/errors

AOIs use a PostGIS GiST index.

## APIs

```
POST /api/remote-sensing/scenes
GET  /api/remote-sensing/analyses
POST /api/remote-sensing/analyses
GET  /api/remote-sensing/analyses/:id
PATCH /api/remote-sensing/analyses/:id
POST /api/remote-sensing/analyses/:id/run
GET  /api/remote-sensing/analyses/:id/preview?period=baseline
GET  /api/remote-sensing/analyses/:id/preview?period=comparison
```

All endpoints are staff-protected.

## Current limitations

The baseline intentionally does not claim more precision than the data supports.

- NDVI is a vegetation proxy, not a complete ecological condition score.
- The area estimate depends on the configured threshold.
- Results with low clear-pixel coverage should be treated cautiously.
- Least-cloud mosaics may combine pixels acquired on different dates within the observation window.
- The public layer publishes the AOI/change severity, not raw provider statistics.
- Field validation is still required for operational conclusions.

Future extensions can add:

- Sentinel-1 radar for cloud-independent wet-season monitoring
- rainfall anomaly layers
- DEM/slope/watershed analysis
- burn/fire indices
- soil/water indices
- Sentinel-1 radar for cloud-independent validation of automated monitoring
- pixel-level change raster persistence
- richer time-series charts


## Automated vegetation monitoring

A completed NDVI comparison can be promoted into a recurring monitoring plan.

The comparison-period result becomes the fixed reference state. Each scheduled check:

1. Uses the same AOI and NDVI threshold.
2. Searches the most recent observation window.
3. Calculates clear-pixel coverage.
4. Rejects the observation for alerting if clear coverage is below the plan threshold.
5. Compares the normalized vegetation-area estimate with the fixed reference.
6. Raises an operational alert when loss exceeds the configured percentage threshold.
7. Sends the alert into the CARE-Map Operations Center until a staff member acknowledges it.

The default daily scheduler only checks monitors whose `next_due_at` has arrived, so a 30-day plan is not processed every day.

Low-clear-coverage and failed observations retry the following day. Successful observations schedule the next check according to the monitor cadence.

Monitoring database migration:

```
db/migrations/005_vegetation_monitoring.sql
```

Monitoring APIs:

```
GET/POST /api/remote-sensing/monitors
PATCH    /api/remote-sensing/monitors/:id
POST     /api/remote-sensing/monitors/:id/run
GET      /api/remote-sensing/monitors/:id/observations
GET      /api/remote-sensing/alerts
POST     /api/remote-sensing/alerts/:id/acknowledge
GET      /api/internal/remote-sensing-monitor
```


## Satellite alert → field verification

A satellite alert is an analytical signal, not a final field conclusion. CARE-Map therefore provides a direct verification loop.

From Operations or a vegetation monitor, staff can create a field-verification task. CARE-Map:

1. Creates a standard `problem_report` at a point inside the monitored AOI.
2. Marks the report origin as `satellite_alert`.
3. Links the report and alert in both directions.
4. Inherits the alert severity as report priority.
5. Applies a default deadline:
   - critical: 1 day
   - high: 3 days
   - medium: 7 days
6. Sends the task into the existing report assignment and status workflow.
7. Allows field evidence photos to be uploaded to the report.
8. Requires a meaningful closure note.
9. Requires at least one evidence photo before a satellite verification can be marked resolved.
10. Automatically acknowledges the originating vegetation alert when the verification report is resolved or rejected.

Database migration:

```
db/migrations/006_satellite_field_verification.sql
```

Field-verification APIs:

```
POST     /api/remote-sensing/alerts/:id/field-verification
GET/POST /api/reports/:id/photos
```

This closes the operational loop:

```
Sentinel-2 change
      ↓
Vegetation alert
      ↓
Field-verification report
      ↓
Assignment + visit
      ↓
Evidence photo + field note
      ↓
Resolve/reject report
      ↓
Satellite alert acknowledged
```
