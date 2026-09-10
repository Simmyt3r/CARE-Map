# 0002 — Adopt Initial Technology Stack

**Status:** Accepted
**Proposed:** 2026-09-01
**Accepted:** 2026-09-10

## Context

The project needs a starting technology stack to move from requirements into detailed design and prototyping (see [roadmap.md](../../planning/roadmap.md), Phase 0). No stack has been formally reviewed and signed off by the team yet.

## Decision

Adopt the stack suggested in the original project brief as the working starting point, to be confirmed or revised during Phase 0 detailed design:

- **Frontend:** React + Leaflet / MapLibre
- **Backend & Database:** Supabase or Firebase, with Node.js + PostgreSQL/PostGIS as the alternative if more control is needed
- **Hosting:** Vercel / Netlify
- **AI/ML:** Python (scikit-learn) or rule-based logic, starting simple

Full rationale is in [tech-stack.md](../tech-stack.md).

## Consequences

- The team can start detailed design and prototyping immediately instead of blocking on a full technology evaluation.
- Accepted as a starting point without a full formal evaluation of alternatives (e.g. PostGIS vs. a managed geospatial service). Per [ADR-0001](0001-record-architecture-decisions.md), this ADR won't be edited further — if that evaluation later favors a different choice, a new ADR should supersede this one.
- Choosing Supabase/Firebase now optimizes for delivery speed over long-term infrastructure control; worth revisiting before Phase 2 if more backend flexibility looks necessary.
