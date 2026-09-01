# 0001 — Record Architecture Decisions

**Status:** Accepted
**Date:** 2026-09-01

## Context

CARE-Map is documentation-strict: architecture choices need to be visible, dated, and traceable to a reason — not just implicit in the code or scattered across chat history.

## Decision

Keep a log of architecture decisions as numbered Markdown files in `docs/architecture/decisions/`, following the lightweight ADR format popularized by Michael Nygard:

- **Title** — short phrase describing the decision
- **Status** — Proposed, Accepted, Deprecated, or Superseded (with a link to the superseding ADR)
- **Context** — what problem or question prompted the decision
- **Decision** — what was decided
- **Consequences** — what becomes easier or harder as a result

Each ADR is numbered sequentially. Once **Accepted**, an ADR is not edited — a changed decision gets a new ADR that supersedes the old one.

## Consequences

- Anyone joining the project can read `docs/architecture/decisions/` in order and understand why the system looks the way it does.
- Decisions still open are recorded as **Proposed**, so the team can see what's settled versus still under discussion.
- Adds a small amount of process overhead: a decision worth an ADR should be written down before, or immediately after, it's acted on.
