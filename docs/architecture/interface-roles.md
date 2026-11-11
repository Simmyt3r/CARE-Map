# CARE-Map — Interface Roles & Permissions

## Design goal
CARE-Map's staff interface was crowded because every account with the old `staff` role saw all operational features. This update makes workspaces selectively assignable; **administrators retain every interface and all administrative actions**.

## Account roles
- **Administrator:** unrestricted across all workspaces and admin settings, regardless of module grants; only administrators create, edit and disable accounts and assign modules.
- **Staff:** can see and access only assigned workspaces. A staff account may have several assignments.
- **Registered community:** uses public reporting, the public map and its own report history, not staff workspaces.

## Assignable staff interfaces

| Interface | Typical duty | Example user |
| --- | --- | --- |
| Operations | Escalation, high-priority issues, supervision | Operations coordinator |
| Community reports | Receive, verify and resolve reports | Case manager |
| Community extension | Community contacts and stewardship | Extension officer |
| Community fund monitoring | Restricted fund records and audit | Finance officer |
| Field assets | Capture, inspect and update resources | Field officer |
| Field acceptance | GPS/device workflow acceptance | QA officer |
| GIS workbench | Datasets, imports and spatial data QA | GIS officer |
| Spatial analysis | Watersheds, hazards and access analysis | GIS analyst |
| Map composer | Presentation/export maps | Planning analyst |
| Sentinel-2 analysis | Ad-hoc imagery comparisons | Climate analyst |
| Vegetation monitoring | Alerts and recurring observation | Monitoring officer |

Presets in **Admin → Users & access** quickly assign common combinations. Administrators can adjust the checkboxes for each individual account.

## Security model
- `db/migrations/022_staff_workspaces.sql` adds a checked `users.workspace_access` text array. Its default is **Community reports + Field assets**, limiting the access of pre-existing staff without automatically granting sensitive finance or satellite modules.
- Navigation and dashboard cards show assigned interfaces only. Administrators see all interfaces, grouped into collapsible sections.
- `src/proxy.ts` authorizes **staff pages and private API routes** against the current database grants for every request, not against an untrusted browser setting or stale JWT permission payload. Admin bypass is still subject to the original endpoint's existing data-validation and CRF duty rules.
- Public community report submissions, own-report APIs, public resource listing and map queries retain their existing public behavior.
- The separate community-fund assignment system is **still required** even when the Finance interface is assigned.
- Admin workspace changes are transactionally audited. Permission checks fail closed on database failures except the migration-022 compatibility case, when staff are limited to Field assets + Community reports.
- This is **interface authorization**, not fine-grained geographic or organisation-level data isolation. Those require separate scoped database design.

## Deployment
1. Deploy this code and verify administrator sign-in. The administrator account keeps full access.
2. Back up Aiven; sign in to Admin → Database migrations, review pending files, and apply migration **022**. If PR #27 is merged later, its independent migration **021** must be staged safely before deploying the shared limiter.
3. Open Admin → Users & access and assign each staff member the interfaces they need.
4. Sign in as a test Field Officer and confirm that GIS/Finance/Satellite pages and APIs return 403; confirm public reporting still works.
5. Test as an administrator and confirm that all workspaces, migration controls and access management remain available.

An administrator login failure caused by migration 003 should be handled by the separate login compatibility fix in PR #29, which was merged before this change.
