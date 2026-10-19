# Public map: intervention/resource counts and approved images

**Update: 19 October 2026.**

The public map now shows count chips for mapped boreholes, infrastructure assets, forest sites, verified rivers and quality-approved published satellite vegetation analyses. Selecting a count chip changes the associated map layer. Counts update for the selected LGA and applicable status.

### Counting definitions

- The **All physical resources** total includes the four resource types: boreholes, assets, forest sites and verified rivers. Each mapped database record is counted once.
- **Vegetation change** is a separate count for Sentinel-2 analyses with completed status, explicit map publication, passing baseline/comparison cloud-quality thresholds, and non-null vegetated-area values. One analysis polygon counts as one observation, not one physical intervention.
- Counts cover the **entire filtered state/LGA**, not the visible map viewport. A separate figure indicates how many physical-resource features were actually loaded for the current viewport; the map payload can be bounded for performance.
- If an LGA is selected, only records whose LGA code matches are included; published NDVI analyses count if their polygon intersects the selected imported LGA boundary.
- Status filtering uses the values already in the public dropdown. Forest and river records only match applicable statuses; changing to NDVI clears the physical-resource status filter.
- Public community-extension contacts, confidential reports and unverified interventions are **not added** to the public map simply to increase counts. Adding those requires an explicit disclosure/approval policy.

### Image handling

- On a mapped resource popup, the platform displays the most recent valid HTTPS Cloudinary image **already included in the existing public resource gallery**.
- The lookup is batched and restricted to existing public resource classes. It does not query images attached to private citizen reports, community representatives or staff-only extension material.
- Uploaded image URLs are validated against the existing Cloudinary image delivery path; no arbitrary external URL is rendered.
- Image captions are sanitized as text and constrained in length. If an image fails to load, it is hidden without disabling the map.
- A link to the public resource record remains available to access other images and approved details.

### Reliability

- Counts are fetched only when geographic/status filters change, not during every map pan. Counts are cached briefly on the CDN.
- Resource images are loaded in one batch for features returned in the viewport, avoiding one database query per marker.
- Map and counts have independent errors/retry behavior. No count is invented when the API fails.
- Published satellite polygons and markers are visible only when the vegetation layer is selected. This avoids implying their counts belong to ordinary physical assets.

**Validation:** unit tests cover count aggregation and image URL acceptance/rejection. Visual browser testing and data-owner review of resource gallery privacy remain acceptance tasks. No new database migration is required by this presentation-layer update.
