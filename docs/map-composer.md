# CARE-Map Map Composer

The staff Map Composer turns live CARE-Map GIS layers into a clean operational map layout that can be printed or saved as PDF from the browser.

## Included layers

- Boreholes
- Assets
- Forest / afforestation sites
- Rivers
- Published vegetation-change AOIs

## Controls

Staff can configure:

- map title
- subtitle
- LGA filter with polygon zoom/highlight when boundaries are loaded
- risk filter
- layer visibility
- feature labels
- interpretation / source notes

The map includes:

- optional imported LGA boundary outlines
- selected-LGA highlight
- north arrow
- metric scale
- risk legend
- geometry legend
- visible-feature counts
- OpenStreetMap attribution

## Print workflow

1. Open **Staff → Map Composer**.
2. Select the layers and filters needed for the map.
3. Pan/zoom or use **Fit visible data**.
4. Edit the title, subtitle and map notes.
5. Choose **Print / Save PDF**.
6. In the browser print dialog, choose landscape orientation if the browser does not honor the page stylesheet automatically.
7. Select **Save as PDF** when a digital output is required.

The stylesheet targets A4 landscape and removes staff navigation and editing controls from the printed output.

## GeoJSON export

**Export visible GeoJSON** downloads the currently visible/selected CARE-Map features as a standard GeoJSON FeatureCollection. This can be opened in QGIS or another GIS package for further cartographic work.

The export respects:

- selected CARE-Map layers
- current risk filter
- the data returned for the current map extent
- the current LGA query when one is active

## Spatial LGA filtering

When project-approved LGA polygons have been imported, the composer uses those boundaries to:

- zoom to the selected LGA
- highlight the selected administrative polygon
- include published vegetation-change AOIs that spatially intersect the selected LGA
- draw optional LGA outlines on the printed map

Vegetation-change filtering is therefore based on geometry intersection rather than requiring each analysis record to carry an LGA text field.

## Cartographic interpretation

The composer is an operational map generator, not a substitute for GIS quality control. Staff should verify:

- coordinate quality
- feature completeness
- selected reporting period
- layer relevance
- source-data currency
- remote-sensing clear-pixel coverage where vegetation-change layers are shown

For formal reports, retain the map title, notes, legend, scale and basemap attribution.
