# CARE-Map — Generic Climate Platform Scope

CARE-Map is an organisation-neutral platform for **climate resilience, environmental information, and field operations**, with local organisations responsible for source data and decisions.

## Core supported capabilities

- GIS inventory of water points, natural assets, infrastructure, restoration sites, waterways and administrative boundaries
- Community observations, optional identities, geolocation, evidence and staff verification
- Satellite vegetation change using Sentinel-2 NDVI with cloud/quality limitations and field verification
- Hazards, river corridors, catchments, settlement access, interventions and geographically grounded action prioritisation
- Field inspections, stewardship follow-up, offline reporting, map exports and accountable staff actions
- Public education, language packs, privacy notices and access/retention controls

## Geographic scope

**No region is presumed by the product brand.** Each installation is responsible for approved geographic inputs and the local administration hierarchy. The first implementation's historical migrations contain an example state dataset; those historical files must not be rewritten or presented as global coverage. See [regional deployment guardrails](../architecture/multi-state-deployment.md).

## Optional or jurisdiction-specific capabilities

Community revolving fund / finance tracking is not a universal climate data requirement. It must be configured and legally reviewed for local currencies, eligibility rules, oversight and external reporting where used.

## Outside initial scope

- Live meteorological forecasting or certified disaster alerting
- Attribution of a specific environmental change to an individual project without evidence
- Automatic regulatory certifications, fund disbursement, or publication of unverified interventions
- A secure shared multi-tenant database for unrelated organisations or regions

## Launch conditions

Verify data provenance, geographic coordinates, role access, privacy-controller identity, satellite processing, realistic connectivity, legal obligations, and physical field acceptance in each deployment. Do not infer successful deployment from an automated build.
