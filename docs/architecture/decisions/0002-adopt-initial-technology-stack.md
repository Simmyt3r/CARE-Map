# 0002 — Adopt Initial Technology Stack

**Status:** Proposed
**Date:** 2026-09-01

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
- Because this is **Proposed**, not **Accepted**, it should be revisited explicitly once the team has evaluated alternatives (e.g. PostGIS vs. a managed geospatial service) — at that point this ADR should move to Accepted, or a new ADR should supersede it.
- Choosing Supabase/Firebase now optimizes for delivery speed over long-term infrastructure control; worth revisiting before Phase 2 if more backend flexibility looks necessary.
