# Scope

**Status:** Draft
**Last updated:** 2026-09-01

## In Scope

- Boreholes
- Project assets (irrigation pumps, equipment, etc.)
- Forests and afforestation sites
- Official rivers and water-related interventions
- Community-reported small rivers and streams

## Out of Scope (for now)

Deferred to later phases, per [roadmap.md](roadmap.md) and the README's [Future Enhancements](../../README.md#8-future-enhancements):

- Full offline-first mobile application
- Advanced/custom machine learning models (initial AI features are rule-based or simple ML)
- Satellite data integration (e.g. Google Earth Engine)
- SMS or WhatsApp notifications
- Multi-language support

## Assumptions

- The initial version focuses on core tracking and community reporting; AI features start simple and improve as more data is collected.
- The system should work well on mobile devices from day one, even before full offline support exists.
- Integration with existing ACReSAL tools will be considered where possible, but no specific integration is committed yet.
- Development proceeds in phases — see [roadmap.md](roadmap.md).

## Constraints

- Public-facing features must not require login (community map, problem reporting, small-river reporting).
- Staff data must be protected; public data is view-only.
- Target users include staff and community members in areas that may have poor internet connectivity, which shapes performance and (eventual) offline requirements.
