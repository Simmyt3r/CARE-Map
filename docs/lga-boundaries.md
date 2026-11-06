# CARE-Map LGA Administrative Boundaries

CARE-Map can store locally verified administrative-area boundaries as PostGIS `MultiPolygon` geometries.

## Why boundaries matter

Without administrative polygons, an LGA is only a text attribute. With boundaries, CARE-Map can answer spatial questions such as:

- Which open reports physically fall inside an LGA?
- Which published vegetation-change AOIs intersect an LGA?
- What is the mapped administrative area?
- What should the public map zoom to when an LGA is selected?
- Which LGA outline should appear on an operational map?

## Database

Migration:

```
db/migrations/007_lga_boundaries.sql
```

The migration adds to `lgas`:

- `boundary geometry(MultiPolygon,4326)`
- `boundary_source`
- `boundary_updated_at`
- `boundary_imported_by`

A GiST index supports spatial intersection queries.

The `lga_boundary_imports` table records:

- source/version text
- total features
- successful imports
- failed imports
- row-level errors
- importing staff member
- timestamp

## Import workflow

Open:

```
Staff → GIS Workbench → LGA administrative boundaries
```

Then:

1. Enter the approved source/version description.
2. Choose a GeoJSON FeatureCollection.
3. Review the preview.
4. Select **Validate & import boundaries**.
5. Review imported and missing LGA counts.

Imports are limited to 100 features per batch. Importing an administrative region with more than 100 features requires multiple batches. Stored identifiers must already exist in the deployment database.

## Matching feature properties

CARE-Map tries common code fields:

- `code`
- `lgaCode`
- `lga_code`
- `LGA_CODE`
- `LGACODE`

It also tries common name fields:

- `name`
- `lga`
- `lgaName`
- `lga_name`
- `LGA_NAME`
- `NAME_2`
- `NAME`

Names are normalized before matching, so values such as:

```
Example Area
EXAMPLE_AREA
Example-Area
```

all normalize to:

```
GWER_EAST
```

## Geometry validation

Only:

- Polygon
- MultiPolygon

are accepted.

Before storage CARE-Map:

- forces geometry to 2D
- applies SRID 4326
- repairs invalid geometry with `ST_MakeValid`
- extracts polygonal components
- converts the result to MultiPolygon
- rejects empty geometry
- rejects geometry smaller than 1 km²
- rejects geometry larger than 50,000 km²
- rejects duplicate features that resolve to the same LGA within one batch
- rejects boundary payloads larger than 10 MB

This validation prevents accidental point/line uploads, duplicate-LGA overwrites, wildly implausible polygons, and many common invalid-polygon failures.

## API

Public/status retrieval:

```
GET /api/gis/lga-boundaries
```

Staff import:

```
POST /api/gis/lga-boundaries
```

Example request body:

```json
{
  "source": "Verified region boundary dataset · source and version",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "LGA_NAME": "Example Area"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": []
      }
    }
  ]
}
```

The example geometry is intentionally incomplete. Production imports require real polygon coordinates.

## Spatial behavior

When boundaries are loaded:

- the public map draws all available LGA outlines
- selecting an LGA highlights and zooms to that polygon
- the Map Composer can display LGA outlines
- selected-LGA operational maps highlight the relevant boundary
- published NDVI-change AOIs are filtered with `ST_Intersects`
- LGA analysis calculates administrative area
- open and critical reports are counted by physical report location

## Provenance rule

Boundary geometry affects analysis and reporting. Do not import an arbitrary internet dataset and label it authoritative.

Before operational use, the authorised GIS and regional operations team should confirm:

- source organization
- dataset date/version
- approved geographic coverage
- LGA naming
- topology/geometry quality
- CRS
- whether boundaries are approved for project reporting

CARE-Map preserves the supplied source/version string so that maps and analyses can be traced back to the dataset used.
