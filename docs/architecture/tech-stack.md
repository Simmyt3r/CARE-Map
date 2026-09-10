# Technology Stack

**Status:** Accepted — formalized in [ADR-0002](decisions/0002-adopt-initial-technology-stack.md)
**Last updated:** 2026-09-10

This expands on the "Technology Suggestions" in the [root README](../../README.md#9-technology-suggestions) with brief rationale.

| Layer | Recommendation | Why |
|-------|-----------------|-----|
| Frontend | React + Leaflet / MapLibre | React is a well-supported, maintainable choice for a combined staff+public web app; Leaflet/MapLibre are lightweight, open-source mapping libraries well suited to an interactive intervention map. |
| Backend & Database | Supabase or Firebase | Both bundle auth, database, and hosting, which speeds up delivery of an MVP with a small team. |
| Alternative Backend | Node.js + PostgreSQL/PostGIS | PostGIS supports the geospatial queries (location, boundaries) this project needs, if more control than Supabase/Firebase is required later. |
| Hosting | Vercel / Netlify | Low-friction hosting for the frontend, especially before scale is a concern. |
| AI/ML | Python (scikit-learn) or rule-based logic | Keeps Phase 3 (AI Prediction) simple initially, consistent with the "start simple" principle in [roadmap.md](../planning/roadmap.md). |

## Status Note

This was accepted on 2026-09-10 as the working stack, without a full formal evaluation of alternatives — see [ADR-0002](decisions/0002-adopt-initial-technology-stack.md) for the trade-off this accepts and when it should be revisited.
