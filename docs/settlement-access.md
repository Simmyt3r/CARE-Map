# CARE-Map Settlements & Functional Borehole Access

Phase 13 adds a settlement/community layer and an access-gap baseline for comparing settlement points with functional boreholes.

## Purpose

The workflow answers a limited but useful GIS question:

> Which verified mapped settlements are within a chosen straight-line distance of a functional borehole, and which are not?

It deliberately does **not** claim to measure actual household water access.

## Settlement data model

Migration:

```
db/migrations/009_settlements_access.sql
```

Each settlement can store:

- settlement code
- name
- settlement type
- LGA
- point geometry
- optional population
- optional population year
- population source
- dataset/source provenance
- verification status
- GPS accuracy
- notes
- creator/updater
- timestamps

Supported settlement types:

- community
- village
- town
- city
- camp
- other

## Population provenance

Population is optional.

When a population value is provided, CARE-Map requires a non-empty population source. Population year cannot be stored without a population value.

Examples of acceptable provenance strings might include a named approved survey, census-derived dataset, project enumeration, or other source that the GIS/M&E team has reviewed.

CARE-Map does not fill missing population values automatically.

## Import workflow

Open:

```
Staff → GIS Workbench → Settlements & communities
```

Supported formats:

- CSV coordinates
- GeoJSON Point FeatureCollection

Batch limit:

```
2,000 records
```

Payload limit:

```
10 MB
```

The import records:

- source dataset
- format
- whether the batch was marked verified
- total/imported/failed rows
- rows whose LGA was spatially assigned
- row-level errors
- importing staff member
- timestamp

## CSV fields

The downloadable template includes:

```
settlementCode
name
settlementType
lgaCode
latitude
longitude
population
populationYear
populationSource
gpsAccuracy
notes
```

`population`, `populationYear`, `populationSource`, `gpsAccuracy`, `notes`, and `settlementCode` are optional subject to validation rules.

## Spatial LGA assignment

If `lgaCode` is missing and CARE-Map has imported LGA boundaries, the importer tries to assign the point with:

```
ST_Covers(LGA boundary, settlement point)
```

The row fails if:

- no LGA boundary covers the point
- more than one LGA boundary covers the point

This is intentionally conservative. Ambiguous geometry should be reviewed rather than silently guessed.

## Verification

Imported records should normally remain unverified until source and coordinates have been reviewed.

Staff can verify or revoke verification from GIS Workbench.

The access analysis uses verified settlements by default. An explicit review-mode checkbox can include unverified records, and the interface marks that result as unsuitable for approved management statistics.

## Access analysis

Open:

```
Staff → Spatial Analysis → Settlement access to functional boreholes
```

The analysis accepts:

- LGA
- access threshold from 100 m to 50 km
- optional inclusion of unverified settlements

The normal interface provides:

- 500 m
- 1 km
- 2 km
- 5 km
- 10 km
- 25 km

## Nearest functional borehole

For each settlement, CARE-Map searches functional boreholes inside a bounded search horizon.

The search horizon is:

```
max(50 km, min(150 km, threshold × 3))
```

Within that horizon CARE-Map uses:

1. indexed `ST_DWithin(...::geography, ...::geography, radius)` candidate filtering
2. exact geography `ST_Distance`
3. the smallest exact distance

If no functional borehole is found inside the search horizon, CARE-Map records the settlement as:

```
beyond_search_radius
```

It does not invent a nearest distance.

## Access classes

```
within_threshold
access_gap
beyond_search_radius
```

A settlement is `within_threshold` when its nearest found functional borehole is no farther than the chosen threshold.

A settlement is an `access_gap` when a functional borehole is found inside the search horizon but the distance exceeds the threshold.

`beyond_search_radius` means no functional borehole was found inside the documented search horizon. The actual nearest distance may be larger.

## Settlement access percentage

```
settlement access % =
settlements within threshold / settlements assessed × 100
```

This is a **settlement-count** metric. It does not weight settlements by population.

## Known-population access percentage

CARE-Map separately calculates population metrics only from settlement records with a sourced population value.

```
known-population access % =
known population in settlements within threshold
/
known population across assessed settlements with population values
× 100
```

The interface always reports population-data completeness:

```
population completeness % =
settlements with sourced population
/
settlements assessed
× 100
```

If completeness is below 100%, the known-population access percentage is not the total LGA population access rate.

## Map

The analysis map shows:

- LGA boundary when available
- settlements within threshold
- settlement access gaps
- settlements with no functional borehole inside the search horizon
- functional boreholes used in nearest-neighbour analysis
- dashed lines from gap settlements to their nearest found functional borehole
- ranked top-gap labels

## Gap ranking

The top 25 settlement gaps are ranked primarily by:

1. no functional borehole inside the search horizon
2. longer nearest-borehole distance
3. larger sourced population as a tie-breaker

The table includes:

- settlement
- type
- nearest functional borehole
- distance
- population if known
- representative settlement coordinates

## API

Settlement inventory/export:

```
GET /api/gis/settlements
GET /api/gis/settlements?format=geojson
```

Settlement import:

```
POST /api/gis/settlements/import
```

Verification:

```
PATCH /api/gis/settlements/:id
```

Access analysis:

```
GET /api/gis/analysis/settlement-access?lga=MAKURDI&radius=2000
```

Optional review mode:

```
includeUnverified=1
```

## GeoJSON export

The access-analysis export can contain:

- LGA boundary
- settlement points
- nearest functional boreholes
- gap-to-borehole lines
- ranked gap points

This can be opened in QGIS for inspection or map production.

## What this baseline does not model

Straight-line proximity is not the same as practical access.

The baseline does not currently model:

- roads
- footpaths
- travel time
- rivers or bridges as barriers
- terrain/slope
- insecurity or seasonal accessibility
- borehole yield
- water quality
- queueing
- downtime/reliability
- household demand
- facility capacity
- actual household usage

These require additional validated datasets.

## Recommended next extension

The natural next step is a network/terrain-aware access model using validated road/path, elevation and hydrology data, while retaining the straight-line result as a transparent baseline.
