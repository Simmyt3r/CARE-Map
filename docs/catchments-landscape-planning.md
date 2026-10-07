# CARE-Map Catchments & Landscape Planning

Phase 16 introduces verified catchment and landscape polygons as a cross-cutting GIS planning unit.

Unlike an LGA, a watershed or catchment is defined by landscape/hydrological delineation rather than an administrative boundary. One catchment may therefore intersect several LGAs.

## Supported landscape levels

- basin
- watershed
- subcatchment
- microcatchment
- project landscape
- other

## Database

Migration: db/migrations/012_catchments.sql

Each catchment stores:

- optional catchment code
- name
- landscape level
- optional parent catchment
- MultiPolygon boundary in EPSG:4326
- source/provenance
- optional source date
- optional delineation method
- verified/unverified state
- verifier and verification time
- notes
- creator/updater
- timestamps

Catchments support optional hierarchy. A basin can contain watersheds; a watershed can contain subcatchments; subcatchments can contain microcatchments. CARE-Map prevents direct self-parenting and hierarchy cycles.

## Import and review

Open: Staff → GIS Workbench → Catchments & landscape units.

CARE-Map accepts GeoJSON FeatureCollections containing Polygon or MultiPolygon features.

Common feature properties:

- name / catchmentName / catchment_name / watershedName / watershed_name
- catchmentCode / catchment_code / code
- catchmentLevel / catchment_level / level / type
- sourceDate / source_date
- method / delineationMethod / delineation_method
- notes / description

Import limits:

- 1,000 features per batch
- 20 MB JSON payload
- polygons only
- normalized area from 0.001 km² to 500,000 km²
- duplicate non-empty catchment codes rejected

Imported records are unverified by default unless the operator deliberately marks an already approved dataset verified on import.

## Verification and hierarchy

From the GIS Workbench staff can:

- verify or revoke a catchment
- change its landscape level
- assign or remove a parent catchment
- review source and area
- export catchments as GeoJSON

Operational landscape analysis uses verified catchments only.

## Catchment APIs

- GET /api/gis/catchments
- GET /api/gis/catchments?verified=1
- GET /api/gis/catchments?format=geojson
- POST /api/gis/catchments
- PATCH /api/gis/catchments/:id

## Landscape summary

Open: Staff → Spatial Analysis → Catchment landscape planning.

The summary uses one verified catchment polygon as the common spatial boundary and calculates:

### Administrative overlap

- intersecting LGAs
- overlap area per LGA
- each LGA overlap as a share of catchment area

Catchments can cross administrative boundaries. Do not add or compare catchment totals and LGA totals as if they describe the same geography.

### Settlements and population

- verified settlement count
- settlements with sourced population
- known sourced population sum

Missing population is not estimated.

### Interventions

- non-decommissioned boreholes
- functional boreholes
- boreholes needing attention
- non-decommissioned assets
- functional assets
- assets needing attention

### Landscape layers

- forest/afforestation site count
- unioned forest area in hectares
- verified river count
- verified river length inside the catchment

Forest geometries are unioned before area calculation so overlapping polygons are not double-counted.

### Operations

- open reports
- critical reports
- high-priority reports

### Verified hazards

- intersecting verified hazard-zone count
- unioned verified hazard area
- high/critical hazard-zone count

Hazard geometries are unioned before area calculation to avoid overlap double-counting.

### Remote sensing

- published completed vegetation-change analysis count
- latest comparison date
- open vegetation alerts whose monitored AOI intersects the catchment

CARE-Map deliberately does not sum vegetation-change hectares across multiple analyses because analyses can overlap and may represent different dates, thresholds, or baselines.

## Landscape map

The map can show:

- catchment boundary
- verified settlements
- boreholes
- assets
- open reports
- clipped forest polygons
- verified rivers
- verified hazard polygons
- published vegetation-change AOI outlines

## GeoJSON export

The landscape export combines the catchment boundary and returned map layers into one FeatureCollection suitable for QGIS, ArcGIS, Python, or archival analysis.

## Analysis API

GET /api/gis/analysis/catchment-landscape?catchmentId=<uuid>

The selected catchment must be verified.

## Interpretation rule

A catchment summary is a spatial aggregation over the verified catchment polygon. Its accuracy depends on the delineation source and on the completeness/quality of each underlying CARE-Map layer.

Treat the summary as an integrated planning view, not as a replacement for source-specific validation. A missing borehole, outdated hazard polygon, incomplete settlement inventory, or stale remote-sensing analysis will affect the result.
