# Requirements

**Status:** Client-review baseline (not signed off)
**Last updated:** 2026-10-09

This restates the requirements from the [root README](../../README.md) as discrete, traceable items. Each has a stable ID so it can be referenced from designs, backlog tickets, and test cases as the project moves into design and development.

## Functional Requirements

### Core Tracking

| ID | Requirement |
|----|-------------|
| FR-01 | Staff can register and manage boreholes, assets, forests/afforestation sites, and rivers. |
| FR-02 | Every record can capture GPS location, photos, status, and key descriptive details. |
| FR-03 | Staff can update status and maintenance history for any tracked item. |
| FR-04 | The system provides an interactive map view of all interventions. |
| FR-05 | Users can filter and search interventions by LGA, type, status, and date. |

### Community & Public Access

| ID | Requirement |
|----|-------------|
| FR-06 | The public can view an interactive map without logging in. |
| FR-07 | The public can view details of any intervention shown on the map. |
| FR-08 | Community members can report problems (e.g. faulty borehole, dying trees, erosion). |
| FR-09 | Community members can report unknown small rivers/streams, including location, local name, description, and photos. |
| FR-10 | Community members can optionally register to track the status of reports they've submitted. |

### AI Prediction

| ID | Requirement |
|----|-------------|
| FR-11 | The system predicts maintenance needs for boreholes and assets. |
| FR-12 | The system flags areas at risk of flooding, erosion, or related disasters. |
| FR-13 | The system assesses risk of forest/afforestation site failure. |
| FR-14 | The system identifies water bodies under stress. |
| FR-15 | The system generates priority rankings to support action planning. |

### Dashboard & Reporting

| ID | Requirement |
|----|-------------|
| FR-16 | A summary dashboard shows totals, functional rates, and a risk overview. |
| FR-17 | Data and map views can be exported. |
| FR-18 | Basic analytics are available for management use. |

### Access Control

| ID | Requirement |
|----|-------------|
| FR-19 | Public/community users can view the map, report problems, and report small rivers without an account. |
| FR-20 | Registered community users can additionally track the status of their own submitted reports. |
| FR-21 | ACReSAL staff have full create, edit, update, and verification rights. |
| FR-22 | Administrators can manage users and configure the system. |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Usability** — the interface must be simple and mobile-friendly. |
| NFR-02 | **Accessibility** — the public map must be usable without login. |
| NFR-03 | **Performance** — the system supports at least 500 concurrent users, with map and data views loading in under 2 seconds. |
| NFR-04 | **Scalability** — the system must support growing data volume over time. |
| NFR-05 | **Security** — staff data is protected; public data is view-only. |
| NFR-06 | **Offline capability** — the system should degrade gracefully in areas with poor internet (desirable, not mandatory for v1). |
| NFR-07 | **Maintainability** — the system should be easy for future corps members or staff to maintain. |

## Stakeholders & Their Interest

| Stakeholder | Interest |
|-------------|----------|
| ACReSAL Staff / SPMU | Manage data, monitor progress, receive alerts |
| GIS / MIS Officer | Spatial data management and analysis |
| M&E Team | Reporting and performance tracking |
| Community Members | View interventions and report problems |
| Project Coordinator | Oversight and decision-making |

## Open Questions

All three were resolved on 2026-09-01 and are kept here for traceability rather than deleted.

- [x] ~~What load/response-time targets define "fast loading" (NFR-03), and how many concurrent users should the system support?~~ → Resolved: 500 concurrent users, sub-2-second map load (see NFR-03 above).
- [x] ~~What data retention and privacy rules apply to community-submitted reports and registered users' personal data?~~ → Resolved: see [data-privacy.md](data-privacy.md).
- [x] ~~Which LGAs (Local Government Areas) are in scope for the initial rollout?~~ → Resolved: all ~14 currently-active ACReSAL LGAs (see [scope.md](scope.md)).


## Implementation and client baseline (2026-10-09)

**Document status:** SRS baseline for client review; not yet client-approved. The original stable FR/NFR IDs above remain traceable. **Implemented in the repository** is distinct from **field validated**, **production configured**, or **contractually accepted**.

### Extended functional requirements
| ID | Requirement | Code baseline |
|---|---|---|
| FR-23 | Staff can bulk-import and validate CSV/GeoJSON with a per-row error report and provenance. | Implemented; needs dataset acceptance |
| FR-24 | Staff can inspect assets, log GPS accuracy, capture photo evidence and maintenance history. | Implemented; needs field UAT |
| FR-25 | Staff can assign and prioritize reports with deadlines and status history. | Implemented; needs field UAT |
| FR-26 | GIS staff can run LGA/intervention coverage, settlement access, and verified river/hazard/catchment spatial analysis. | Implemented; needs verified source data |
| FR-27 | Staff can discover Sentinel-2 scenes and compare cloud-masked NDVI within an AOI. | Implemented; needs scientific and external-API validation |
| FR-28 | Authorized users can configure recurring vegetation monitors, review alerts and start linked field verification. | Implemented; needs scheduled-job UAT |
| FR-29 | Users can access approved map resources via QR codes and submit resource-linked reports. | Implemented; needs scan/device UAT |
| FR-30 | Administrators can review privacy requests, breaches, localization packs, audit history and deployment readiness. | Implemented; requires legal/policy approval |
| FR-31 | Public community reports can be queued offline and synchronized on reconnection. | Implemented; needs real-device tests |
| FR-32 | Staff can conduct recorded field-acceptance runs with required checks and evidence for each pilot LGA. | Implemented; acceptance not yet signed off |

### Qualification of non-functional claims
- **NFR-03:** 500 simultaneous users and under 2-second map load are **targets**, not verified capacity/performance metrics. Client acceptance must define test dataset size, device class, connectivity, percentile and load-test method.
- **NFR-06:** graceful degradation and offline **community report queue** exist. Do not construe this as offline all-map tile access or offline staff CRUD.
- **NFR-05:** role protection, server-only secrets and privacy workflow are implemented in code; perform independent security review, backup/restore drill, and access-control testing before production approval.
- **Data integrity:** feature geometry, coordinate provenance, LGA membership and import lineage require approved data sources and staff verification.
- **Operational readiness:** production credentials, verified boundaries, initial dataset, incident contacts, training and sign-off are client dependencies.

### Change control and sign-off
The client product owner and technical lead must agree on the final FR/NFR acceptance criteria, deviations, support responsibilities and version. Maintain requirements traceability to test case/evidence and record any scope changes through approved change requests. Related documents: [architecture](../architecture/overview.md), [deployment](../client-handover/deployment-operations.md), [user guide](../client-handover/user-manual.md), [acceptance](../client-handover/acceptance-support.md).
