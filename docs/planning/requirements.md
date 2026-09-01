# Requirements

**Status:** Draft — consolidated from the initial project brief for team review
**Last updated:** 2026-09-01

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
| NFR-03 | **Performance** — maps and data must load quickly. |
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

- [ ] What load/response-time targets define "fast loading" (NFR-03), and how many concurrent users should the system support?
- [ ] What data retention and privacy rules apply to community-submitted reports and registered users' personal data?
- [ ] Which LGAs (Local Government Areas) are in scope for the initial rollout?
