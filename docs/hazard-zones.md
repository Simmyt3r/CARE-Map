# CARE-Map Verified Hazard Zones & Exposure

Phase 15 adds a staff-only workflow for importing, reviewing, verifying, and analyzing source-backed hazard polygons.

The purpose is to separate two very different ideas:

- screening signals such as river proximity
- verified hazard polygons accepted by the GIS/M&E team from a documented source

CARE-Map only uses verified hazard polygons in operational exposure analysis.

## Supported hazard types

- flood
- erosion
- gully erosion
- land degradation
- landslide
- other

## Severity

Each polygon carries one of: unknown, low, medium, high, or critical.

Unknown is deliberately not treated as low.

## Database

Migration: db/migrations/011_hazard_zones.sql

Each hazard zone stores:

- name
- hazard type
- severity
- MultiPolygon geometry in EPSG:4326
- source/provenance
- optional source date
- optional mapping/method description
- verification state
- verifier and verification time
- notes
- creator/updater
- timestamps

The schema also stores an audited import history.

## Import workflow

Open: Staff → GIS Workbench → Verified hazard zones.

CARE-Map accepts GeoJSON FeatureCollections containing Polygon or MultiPolygon features.

Each feature should provide a name, hazardType, optional severity, optional method, and polygon geometry.

Accepted property aliases include name/zoneName/zone_name, hazardType/hazard_type/type/category, sourceDate/source_date, method/mappingMethod/mapping_method, and notes/description.

## Import safety rules

The batch must include dataset provenance.

Limits:

- 1,000 features per batch
- 20 MB JSON payload
- Polygon or MultiPolygon only
- normalized polygon area from 10 m² to 100,000 km²

Before storage CARE-Map forces geometry to 2D, sets SRID 4326, repairs invalid geometry with ST_MakeValid, extracts polygonal components, converts output to MultiPolygon, and rejects empty or implausibly sized geometry.

## Verification

Imported zones are unverified by default.

A batch can be marked verified on import only when the operator is intentionally importing an already approved dataset.

A staff member can later verify or revoke verification from the GIS Workbench.

When a zone is verified CARE-Map records the verification state, verification timestamp, and verifying staff user.

Operational exposure analysis uses verified zones only.

## Hazard-zone API

- GET /api/gis/hazard-zones
- GET /api/gis/hazard-zones?format=geojson
- POST /api/gis/hazard-zones
- PATCH /api/gis/hazard-zones/:id

Useful filters include lga, hazardType, severity, and verified.

## Exposure analysis

Open: Staff → Spatial Analysis → Verified hazard exposure.

Staff can analyze all verified hazard zones intersecting an LGA, one hazard type, one severity class, or one specific verified zone.

CARE-Map spatially clips each selected hazard polygon to the imported LGA boundary before analysis.

The selected polygons are unioned so overlapping polygons do not double-count exposed point features.

## Exposure features

The baseline checks verified settlements, non-decommissioned boreholes, non-decommissioned assets, and open reports.

A feature is exposed when its point geometry lies inside the union of the selected verified hazard polygons.

## Exposure metrics

The result includes verified zone count, highest included severity, LGA area, hazard-zone area, percentage of LGA area inside selected hazard zones, exposed settlements, exposed boreholes, exposed assets, exposed open reports, exposed settlements with sourced population, and known sourced population represented by those settlement records.

Missing population values are never invented.

## Exposure API

GET /api/gis/analysis/hazard-exposure

Parameters:

- lga: required CARE-Map LGA code
- zoneId: optional verified hazard-zone UUID
- hazardType: optional supported hazard type
- severity: optional supported severity

Example: /api/gis/analysis/hazard-exposure?lga=MAKURDI&hazardType=flood&severity=high

## Map and export

The exposure map displays the imported LGA boundary, verified hazard polygons, settlements, boreholes, assets, and open reports. Hazard polygons are styled by stored severity.

The GeoJSON export includes the LGA boundary, union of selected hazard polygons, individual verified hazard polygons, and exposed point features.

## Interpretation rule

A CARE-Map hazard zone is only as good as the imported source.

Verification means staff accepted this polygon dataset for operational use. It does not mean CARE-Map independently proved the scientific model behind the dataset.

Before publishing or using hazard results for investment decisions, reviewers should understand the dataset producer, source date/version, modelling or mapping method, spatial resolution, return period/scenario/threshold where relevant, validation method, uncertainty, and whether the dataset is susceptibility, hazard, historical observation, or model output.

Do not combine fundamentally different hazard products without understanding their methodology.

## Relationship to river corridor screening

River Corridor Exposure asks what is close to verified river geometry.

Verified Hazard Exposure asks what lies inside a hazard polygon that staff have accepted from a documented source.

The second is a stronger evidence layer, but it still inherits the limitations of its source dataset.
