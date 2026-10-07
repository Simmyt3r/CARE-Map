# CARE-Map River Corridor Exposure Analysis

The River Corridor Exposure workspace is a staff GIS screening tool for identifying mapped features near verified river geometry.

It answers:

> Which mapped settlements, boreholes, assets, and open reports fall within a selected straight-line distance of verified rivers inside an LGA?

It does **not** answer:

> Which places are definitely at flood or erosion risk?

River proximity is only one screening variable.

## Location

Open:

```
Staff → Spatial Analysis → River corridor exposure
```

## Required data

The workflow requires:

1. an imported LGA boundary
2. verified river geometry intersecting that LGA
3. mapped settlements, boreholes, assets, and/or reports
4. migration 010 for geography indexes

Migration:

```
db/migrations/010_river_corridor_indexes.sql
```

## Scope

Staff can analyze:

- all verified rivers intersecting the selected LGA
- one specific verified river intersecting the selected LGA

The river list is spatial, not only text-linked by `lga_code`. A river whose geometry crosses an LGA can therefore appear even when its stored text LGA belongs elsewhere.

## Corridor distance

The API accepts:

```
50 m to 20,000 m
```

The interface provides:

- 100 m
- 250 m
- 500 m
- 1 km
- 2 km
- 5 km
- 10 km

Distances use PostGIS geography and are therefore measured in metres.

## Spatial method

For the selected LGA and river scope:

1. CARE-Map clips verified river geometry to the LGA boundary.
2. The clipped river segments are unioned.
3. CARE-Map creates a geography buffer around the selected river geometry.
4. The buffer is clipped to the selected LGA.
5. Verified settlements inside the corridor are selected.
6. Non-decommissioned boreholes inside the corridor are selected.
7. Non-decommissioned assets inside the corridor are selected.
8. Open reports inside the corridor are selected.
9. Exact straight-line distance from each selected point to the river geometry is calculated.
10. Results are sorted nearest first.

## Exposure counts

The result reports:

- verified river length analyzed
- corridor area
- total exposed mapped features
- verified settlements
- boreholes
- assets
- open reports
- settlements with sourced population
- sum of sourced population for exposed settlement records

The population value is only the sum of population values already stored with source provenance. Missing population is not guessed.

## API

River options:

```
GET /api/gis/analysis/river-corridor/options?lga=MAKURDI
```

Exposure analysis:

```
GET /api/gis/analysis/river-corridor
```

Parameters:

| Parameter | Meaning |
|---|---|
| `lga` | CARE-Map LGA code |
| `radius` | corridor distance in metres, 50–20,000 |
| `riverId` | optional verified river UUID; omit to analyze all verified rivers intersecting the LGA |

Example:

```
/api/gis/analysis/river-corridor?lga=MAKURDI&radius=500
```

Specific river:

```
/api/gis/analysis/river-corridor?lga=MAKURDI&radius=500&riverId=<uuid>
```

## Map

The analysis map shows:

- imported LGA boundary
- selected verified river lines
- buffered river corridor
- exposed settlements
- exposed boreholes
- exposed assets
- open reports

Click a mapped point to inspect its type, status, distance to river, and sourced population where applicable.

## GeoJSON export

The export contains one FeatureCollection with:

- LGA boundary
- river corridor polygon
- verified river segments
- exposed point features

Each exposed point includes:

- entity type
- name/description
- status/type
- LGA where available
- distance from analyzed river geometry
- population and population source where available

This can be opened in QGIS for field planning, cartography, validation, or further analysis.

## What this is not

Do **not** label the result a flood-risk map solely from this analysis.

River proximity does not model:

- elevation
- slope
- drainage direction
- watershed boundaries
- flow accumulation
- river discharge
- rainfall intensity
- soil infiltration
- flood return periods
- historical inundation
- erosion susceptibility
- bridges or drainage structures
- protective infrastructure

A settlement 100 m from a river on high ground may be less exposed than a settlement farther away on a low floodplain.

## Recommended use

Use River Corridor Exposure to:

- identify locations worth reviewing
- prioritize field checks
- find infrastructure close to rivers
- find open reports clustered along river corridors
- create QGIS-ready screening outputs
- support later terrain/flood analysis

Treat the output as **proximity screening evidence**, then combine it with terrain, hydrology, rainfall, historical events, and field verification before making hazard or investment conclusions.
