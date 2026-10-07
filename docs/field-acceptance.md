# CARE-Map Field Acceptance Test Center

Phase 18 adds a structured field-acceptance workflow for testing CARE-Map on real devices and networks before operational or public launch.

Open:

`Staff → Field Acceptance`

## Why this exists

CI can prove that code builds and tests pass. It cannot prove that:

- a target phone can obtain usable GPS coordinates
- the UI remains usable at field-device widths
- a weak or lost connection behaves correctly
- an offline community report is queued on that browser
- the queued report actually syncs after reconnect
- a report appears in the staff workflow
- a field operator can complete the workflow under real conditions

The Field Acceptance Test Center records those operational checks per LGA and device.

## Acceptance run

Each run stores:

- LGA
- whether that LGA is currently marked as a pilot LGA
- device label
- browser/device user-agent information
- network context
- optional build/deployment label
- overall notes
- start/completion timestamps
- operator
- final result

Final result values:

- pending
- pass
- fail
- conditional

## Canonical required checks

A new run snapshots the current acceptance checklist into the database. Required checks are:

1. Staff login and session persistence
2. Public map on the target device
3. High-accuracy GPS capture
4. Staff point-intervention workflow
5. Online community report submission
6. Offline app shell
7. Offline report queue
8. Reconnect and queued-report synchronization
9. Staff report review workflow
10. Mobile navigation and forms

Optional advanced checks include:

- field evidence photo upload
- QR resource-to-report flow
- GIS export opened downstream
- Map Composer print/PDF workflow

## Result rules

A run cannot be completed while any required check remains `not_run`.

Final result is deterministic:

- PASS: every required check passed
- FAIL: at least one required check failed
- CONDITIONAL: no required check failed, but at least one required check was blocked or marked not applicable

Optional checks do not determine the final required result.

Completed runs are read-only until explicitly reopened.

## Device preflight

The page includes quick browser diagnostics for:

- secure context / HTTPS
- current online/offline state
- Geolocation API availability
- service-worker support and control
- local-storage write capability
- camera/media API availability

These diagnostics are only a preflight. They do not replace the real field workflow checks.

## Offline report acceptance

The current community report form stores offline reports under the browser-local CARE-Map report queue and listens for the browser `online` event.

A real acceptance run should therefore:

1. load CARE-Map while connected
2. disconnect the target device
3. reopen the cached report page
4. submit a designated test report
5. confirm CARE-Map shows the report waiting for internet
6. restore connectivity
7. confirm the queued count clears
8. confirm the submitted report appears in the staff report queue

Do not clear browser/site storage between the queue and reconnect steps.

## Evidence

When Vercel Blob is configured, staff can attach JPEG, PNG, or WebP evidence images to a specific acceptance check.

Evidence records are stored separately from operational resource/report photos and are linked by `(run_id, check_key)`.

Maximum evidence image size is 4 MB.

Useful evidence includes:

- GPS accuracy screenshot
- offline queued-report message
- reconnect/sync confirmation
- mobile layout issue
- map rendering issue
- staff report queue reference
- photo-upload result

## APIs

- `GET /api/field-acceptance` lists recent runs, pilot summary, and LGAs
- `POST /api/field-acceptance` creates a run and snapshots the checklist
- `GET /api/field-acceptance/:id` returns the run, checks, and evidence
- `PATCH /api/field-acceptance/:id` updates checks, notes, completion, or reopen state
- `GET/POST /api/field-acceptance/:id/evidence` lists or uploads evidence

All endpoints require staff access.

## Production readiness integration

The Production Readiness Center looks at the latest completed acceptance run for each pilot LGA.

A pilot LGA counts as field-accepted only when its latest completed run is `pass`.

A previous pass does not hide a newer failed or conditional run.

The required readiness gate is green only when every configured pilot LGA has a passing latest completed run.

## Recommended test practice

- Use the actual phones/tablets expected in field work.
- Test outdoors for GPS accuracy.
- Test at least one weak-connectivity location, not only office Wi-Fi.
- Use clearly designated test records and reports.
- Record reference IDs in check notes.
- Attach evidence for failures and intermittent behavior.
- Reopen and rerun after fixes.
- Keep a failed run rather than deleting history.

## What a pass means

A passing field acceptance run means the recorded required workflows worked on that LGA/device/session under the tested conditions.

It does not prove every device, network, coordinate, browser, or future deployment will behave identically. Repeat acceptance after major releases, offline/storage changes, authentication changes, or field-device changes.
