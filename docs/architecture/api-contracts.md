# API Contracts

**Status:** Detailed Draft — ready for implementation review
**Last updated:** 2026-09-10

REST-style contract over the entities in [data-model.md](data-model.md). Conventions below apply across all endpoints unless noted.

## Conventions

- **Auth:** Bearer token in the `Authorization` header. No header = unauthenticated ("public"). Roles are `registered_community`, `staff`, `admin` — `staff+` in the tables below means staff or admin.
- **List responses:** `{ "data": [...], "total": N, "page": N }`. List endpoints for map data accept a `bbox` param (`min_lng,min_lat,max_lng,max_lat`) so the client only fetches what's in view — required for NFR-03 (map load under 2s) once pilot data volume grows across 14 LGAs.
- **Errors:** `{ "error": { "code": "...", "message": "..." } }` with a matching 4xx/5xx status.
- **Filtering:** list endpoints accept `lga`, `status`, and `bbox` query params where applicable, matching FR-05.

## Auth

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | public | Creates a `registered_community` account (FR-10). |
| POST | `/auth/login` | public | Returns a bearer token. |
| POST | `/auth/logout` | any | Invalidates the token. |
| GET | `/auth/me` | any authenticated | Own profile. |
| DELETE | `/auth/me` | registered_community+ | Self-delete, per [data-privacy.md](../planning/data-privacy.md). Sets `deleted_at`, doesn't hard-delete rows referenced by past reports. |

## Boreholes / Assets / Forest Sites

Boreholes, assets, and forest sites share the same endpoint shape — shown once for `boreholes`; `assets` and `forest-sites` mirror it.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/boreholes` | public | List, filterable by `lga`, `status`, `bbox`. |
| GET | `/boreholes/:id` | public | Detail. |
| POST | `/boreholes` | staff+ | Create (FR-01). |
| PATCH | `/boreholes/:id` | staff+ | Update status/details (FR-03). |
| DELETE | `/boreholes/:id` | admin | Data-correction only (e.g. duplicate entry) — not the normal decommission path, which is a status change. |
| GET | `/boreholes/:id/maintenance` | public | Maintenance history — public for transparency. |
| POST | `/boreholes/:id/maintenance` | staff+ | Log a maintenance record (FR-03). |
| POST | `/boreholes/:id/photos` | staff+ | Attach a photo. |

## Rivers

Rivers need one extra state (`verified`) that the others don't, since community-reported rivers shouldn't appear on the public map until staff confirm them.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/rivers` | public | Only returns `verified = true` rivers. |
| GET | `/rivers` | staff+ | Same endpoint, but staff also see unverified ones (via an `include_unverified` param). |
| GET | `/rivers/:id` | public/staff+ | Same verified-gating as the list. |
| POST | `/rivers` | staff+ | Create an official river record. |
| PATCH | `/rivers/:id` | staff+ | Update details. |
| POST | `/rivers/:id/verify` | staff+ | Marks `verified = true`; this is what makes a community-reported river appear publicly. |

## Reports

The community reporting entry point — the one write endpoint that's fully public.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/reports` | public | Submit a problem or small-river report (FR-08, FR-09). `submitted_by` is set automatically if the requester is authenticated, otherwise null (anonymous). |
| GET | `/reports` | staff+ | Review queue, filterable by `status`, `lga`, `type`. |
| GET | `/reports/mine` | registered_community+ | Only the caller's own reports (FR-10). |
| GET | `/reports/:id` | submitter or staff+ | A registered submitter can see their own report; anonymous submitters can't look it up later. |
| PATCH | `/reports/:id/status` | staff+ | Moves it through `under_review` → `verified`/`rejected` → `resolved`. Setting `resolved` starts the 2-year retention clock in [data-privacy.md](../planning/data-privacy.md). |

## Predictions (AI Prediction Engine)

Read-only from the API's perspective — predictions are computed by a background process, not requested synchronously per FR-11–FR-15. Whether that process runs on-demand or on a schedule is still open — see [overview.md](overview.md).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/predictions/risk-areas` | public | Flood/erosion/forest-failure/river-stress flags (FR-12–FR-14) — public, since residents benefit from seeing risk areas near them. |
| GET | `/predictions/priority-rankings` | staff+ | Action-planning output (FR-15) — staff-facing, not public. |

## Dashboard

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/dashboard/summary` | staff+ | Totals, functional rates, risk overview (FR-16). Kept staff-only for now; a simplified public version is a candidate for a later phase. |
| GET | `/dashboard/export` | staff+ | Data/map export (FR-17), format TBD (CSV to start). |

## Reference Data

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/lgas` | public | The 14 pilot LGAs (`pilot = true`), for filter dropdowns. |

## Open Questions

- [ ] Pagination page size and default sort for list endpoints.
- [ ] Whether `/dashboard/summary` should have a public-safe subset (ties to the open question above).
- [ ] Rate limiting on `POST /reports`, since it's the one fully public write endpoint and the most exposed to abuse.
