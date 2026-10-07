# CARE-Map Intervention Coverage Analysis

The Intervention Coverage workspace provides a GIS baseline for asking:

> What share of an LGA's land area lies within a chosen straight-line distance of qualifying mapped boreholes or assets?

It is available under:

```
Staff → Spatial Analysis → Intervention coverage
```

## What the baseline measures

CARE-Map calculates **territorial area coverage**.

For an LGA boundary (L), a set of qualifying point resources (P), and radius (r):

```
service_area = union(buffer(each resource point, r))
covered = intersection(LGA boundary, service_area)
uncovered = LGA boundary - covered
coverage_percent = area(covered) / area(LGA boundary) × 100
```

Distances are evaluated with PostGIS geography in metres. Migration 008 adds functional GiST indexes on `location::geography` for boreholes and assets so `ST_DWithin` can scale more cleanly as point counts grow.

## Cross-boundary resources

A resource does not have to be physically inside the selected LGA to contribute.

CARE-Map includes a point when it is within the selected radius of the LGA boundary. Its buffer is then clipped to the selected LGA.

The output separates:

- resources inside the selected LGA
- external supporting resources whose coverage crosses the administrative boundary

This prevents administrative borders from artificially truncating proximity coverage.

## Resource types

### Boreholes

The primary operational use case.

**Functional only** uses records whose status is:

```
functional
```

This is still only a proximity proxy. A borehole being marked functional does not prove:

- sufficient yield
- water quality
- continuous availability
- adequate capacity
- safe walking access
- population demand coverage

### Assets

Asset mode supports two interpretations:

- **All asset types** for a broad infrastructure-footprint view.
- **Specific asset type** for a more defensible comparison within one mapped asset class.

The interface loads distinct `asset_type` values from CARE-Map and allows staff to restrict the analysis to one class.

All-asset mode should still be treated carefully because heterogeneous infrastructure does not automatically represent one comparable service.

## Scenarios

### Functional only

Only resources currently marked `functional` contribute.

### Mapped footprint (non-decommissioned)

All resources except `decommissioned` contribute.

This scenario can include:

- functional
- needs maintenance
- non-functional

It is therefore a **planning/infrastructure footprint**, not an active-service estimate.

## Radius

The API accepts:

```
100 m to 50,000 m
```

The interface provides common presets:

- 500 m
- 1 km
- 2 km
- 5 km
- 10 km
- 25 km

The radius is a straight-line distance, not network travel distance.

## Required data

Coverage analysis requires:

1. migration 007 applied
2. migration 008 applied for indexed geography distance queries
3. an imported LGA boundary for the selected LGA
4. mapped boreholes or assets with valid point geometry
5. meaningful resource status values

## Spatial workflow

The API:

1. loads the selected LGA MultiPolygon
2. finds qualifying resources using `ST_DWithin(...::geography, ...::geography, radius)`
3. buffers each qualifying point using geography metres
4. unions the service buffers
5. intersects the result with the LGA boundary
6. derives the uncovered remainder
7. calculates areas with geography
8. splits the uncovered geometry into component polygons
9. ranks the 25 largest uncovered gaps above 1,000 m²
10. returns GeoJSON for the boundary, covered area, uncovered area, ranked gaps and resources

## API

```
GET /api/gis/analysis/coverage
```

Query parameters:

| Parameter | Values |
|---|---|
| `lga` | CARE-Map LGA code |
| `type` | `borehole` or `asset` |
| `scenario` | `functional` or `non_decommissioned` |
| `assetType` | optional exact asset type when `type=asset` |
| `radius` | metres, 100–50,000 |

Example:

```
/api/gis/analysis/coverage?lga=MAKURDI&type=borehole&scenario=functional&radius=2000

/api/gis/analysis/coverage?lga=MAKURDI&type=asset&assetType=Water%20Tank&scenario=functional&radius=2000
```

## Output

The response includes:

- LGA code/name/boundary source
- resource type
- selected asset type when applicable
- scenario
- radius
- total contributing resources
- resources physically inside the LGA
- external supporting resources
- LGA area in km²
- covered area in km²
- uncovered area in km²
- coverage percentage
- LGA boundary GeoJSON
- covered-area GeoJSON
- uncovered-area GeoJSON
- ranked uncovered-gap FeatureCollection with area and representative latitude/longitude
- contributing resource FeatureCollection

## GeoJSON export

The interface can export one FeatureCollection containing:

- LGA boundary
- covered area
- uncovered gap area
- ranked uncovered gap polygons
- contributing resources

This can be opened in QGIS for cartography, validation or further spatial analysis.

## What it does **not** measure

Do not call this population coverage.

The current result does **not** model:

- population distribution
- settlements
- households
- travel time
- roads/paths
- slope barriers
- rivers/bridges as accessibility barriers
- facility capacity
- borehole yield
- reliability/uptime
- service demand

A 2 km circular buffer is a GIS proximity model, not proof that everyone inside the circle can or does use the resource.

## Recommended next extension

For a more defensible access model, combine CARE-Map with validated:

- settlement points/polygons
- population raster or enumerated community population
- road/path network
- elevation/slope
- facility capacity or borehole yield

That would allow CARE-Map to progress from **territorial proximity coverage** to **population and accessibility analysis**.


## Coverage options API

The staff UI loads distinct asset classes from:

```
GET /api/gis/analysis/coverage/options
```

Response example:

```json
{
  "data": {
    "assetTypes": [
      "Water Tank",
      "Weather Station"
    ]
  }
}
```

The main coverage API validates a supplied asset type against existing CARE-Map asset records before running the spatial analysis.
