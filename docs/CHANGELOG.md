# CARE-Map Documentation Change Log

## 2026-10-13 — Quality / field-readiness documentation sync

**Nature of change:** Documentation and accuracy cleanup only. No new application feature or migration introduced by this documentation update.

### Synchronized references

- **GPS reliability:** [field accuracy checklist](quality/gps-field-acceptance.md), [user manual](client-handover/user-manual.md), [field acceptance](field-acceptance.md), [deployment runbook](client-handover/deployment-operations.md), [requirements](planning/requirements.md) and [implementation summary](IMPLEMENTATION.md).
- **ACReSAL extension:** community intervention focal-person consent, visit/follow-up records, photo-backed and independently reviewed maintenance assessments and explicit management approval for competition rewards.
- **Storage:** Cloudinary for new evidence/photos; historical Vercel Blob URL references may remain. Delivery URLs are currently public, so no sensitive or unredacted evidence.
- **Sentinel-2:** cloud/SCL masking, minimum clear-pixel quality threshold in **both** periods, `needs_review` status for insufficient imagery and admin-only publication.
- **Aiven/PostGIS:** current repository migration files are **001–017**. No assumption that the production database has applied them. The signed-in Admin Migrations page `/staff/admin/migrations` uses server-configured credentials without a second login.
- **GIS imports:** settlement import UI sends **50 records/batch**, server accepts **up to 200 records/request**; import completion is not equivalent to review/verification.
- **Routes and design:** historical pre-implementation API contracts labelled as historical and supplemented with source-backed modern `/api/` examples.
- **Stabilization:** new-feature expansion paused. Quality assurance, performance, data provenance, backups, privacy/security and real field acceptance are the release priorities.

### Release/source distinction

At an observation on **2026-10-13**, Vercel's public production alias returned a `READY` deployment at source commit `f9f63f03`, while newer GPS improvements were committed and had successful GitHub CI runs on `main`. These snapshots can change without the documentation updating. **Recheck the live deployment SHA before testing or claiming the latest GPS features are running in production.**

A successful GitHub CI run means source checks passed. A successful Vercel deployment means a build is available. Neither proves approved migrations were applied to Aiven, the source data is correct, or GPS field/device acceptance passed.

### Acceptance and approval

This documentation change does **not** constitute client acceptance, GIS verification or authorization to allocate community rewards. Field test results and the approved deployment/data baseline must be formally recorded.

Refer to [Documentation Index](README.md) for controlled client documents.
