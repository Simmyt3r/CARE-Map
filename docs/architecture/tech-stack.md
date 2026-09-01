# Technology Stack

**Status:** Proposed — formalized in [ADR-0002](decisions/0002-adopt-initial-technology-stack.md)
**Last updated:** 2026-09-01

This expands on the "Technology Suggestions" in the [root README](../../README.md#9-technology-suggestions) with brief rationale.

| Layer | Recommendation | Why |
|-------|-----------------|-----|
| Frontend | React + Leaflet / MapLibre | React is a well-supported, maintainable choice for a combined staff+public web app; Leaflet/MapLibre are lightweight, open-source mapping libraries well suited to an interactive intervention map. |
| Backend & Database | Supabase or Firebase | Both bundle auth, database, and hosting, which speeds up delivery of an MVP with a small team. |
| Alternative Backend | Node.js + PostgreSQL/PostGIS | PostGIS supports the geospatial queries (location, boundaries) this project needs, if more control than Supabase/Firebase is required later. |
| Hosting | Vercel / Netlify | Low-friction hosting for the frontend, especially before scale is a concern. |
| AI/ML | Python (scikit-learn) or rule-based logic | Keeps Phase 3 (AI Prediction) simple initially, consistent with the "start simple" principle in [roadmap.md](../planning/roadmap.md). |

## Why "Proposed" and Not Final

The project is at the requirements stage (see the README's [Project Status](../../README.md#10-project-status)), so this table reflects a reasonable starting point already proposed in the original brief, not a stack the team has committed to after a formal architecture review. Confirming or changing it is a Phase 0 task — see [roadmap.md](../planning/roadmap.md).
