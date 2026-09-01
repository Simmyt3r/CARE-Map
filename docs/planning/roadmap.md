# Roadmap

**Status:** Proposed — for team review and re-prioritization
**Last updated:** 2026-09-01

The [root README](../../README.md) states that development will happen in phases, with AI features starting simple and improving as data accumulates. This roadmap proposes one way to sequence that work. It's a starting point, not a commitment — scope and durations are for the team to confirm.

## Phase 0 — Planning & Design (current)
- Finalize requirements and close the open questions in [requirements.md](requirements.md)
- Confirm or revise the technology stack (see [ADR-0002](../architecture/decisions/0002-adopt-initial-technology-stack.md))
- Produce detailed design: data model, API contracts, wireframes
- Identify pilot LGAs for initial rollout

## Phase 1 — Core Tracking (MVP)
- Staff-facing create/edit for boreholes, assets, forests/afforestation sites, and rivers
- GPS, photo, and status capture per record
- Interactive public map (view-only, no login)
- Filtering and search by LGA, type, status, and date

## Phase 2 — Community Reporting
- Public problem reporting (faulty borehole, dying trees, erosion, etc.)
- Community reporting of unknown small rivers/streams
- Optional community registration and report status tracking

## Phase 3 — AI Prediction (rule-based first)
- Rule-based maintenance-need predictions for boreholes/assets
- Rule-based flagging of flood/erosion/disaster risk areas
- Forest/afforestation failure risk indicators
- Priority ranking output for staff action

## Phase 4 — Dashboard, Reporting & Hardening
- Summary dashboard (totals, functional rates, risk overview)
- Data/map export
- Offline-friendly improvements for low-connectivity areas
- Multi-language support (English + local languages)
- Evaluate satellite data integration (e.g. Google Earth Engine) and SMS/WhatsApp notifications

## Sequencing Notes

- AI features (Phase 3) are sequenced after Phases 1–2 so there's real tracking data to work from, matching the README's "start simple, improve as more data is collected" approach.
- Offline support and multi-language are called out as future/desirable in the README's [Future Enhancements](../../README.md#8-future-enhancements), so they're placed after the core loop is proven rather than in the MVP.
