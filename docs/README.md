# CARE-Map Documentation

This folder contains the planning and architecture documentation for CARE-Map (Community Asset & Resource Environment Map) — the Benue ACReSAL Smart Asset, Forest, River & Borehole Tracking System.

For the general project pitch, see the [root README](../README.md).

## Contents

### Planning
- [Requirements](planning/requirements.md) — functional and non-functional requirements, with traceable IDs
- [Roadmap](planning/roadmap.md) — proposed phased delivery plan
- [Scope](planning/scope.md) — in-scope / out-of-scope boundaries, assumptions, and constraints

### Architecture
- [Architecture Overview](architecture/overview.md) — components, diagram, and data flow
- [Data Model](architecture/data-model.md) — draft core entities and relationships
- [Technology Stack](architecture/tech-stack.md) — recommended stack and rationale
- [Architecture Decision Records](architecture/decisions/) — a dated log of significant architecture decisions
  - [0001 — Record Architecture Decisions](architecture/decisions/0001-record-architecture-decisions.md)
  - [0002 — Adopt Initial Technology Stack](architecture/decisions/0002-adopt-initial-technology-stack.md)

## Documentation Conventions

- Requirements use stable IDs (`FR-##`, `NFR-##`) so they can be referenced from designs, tickets, and tests later.
- Architecture decisions are recorded as ADRs. Once **Accepted**, an ADR is not edited — a changed decision gets a new ADR that supersedes the old one.
- Every doc describing something not yet built or formally confirmed is marked **Draft** or **Proposed** in its header, until the team signs off and it moves to **Accepted**.
