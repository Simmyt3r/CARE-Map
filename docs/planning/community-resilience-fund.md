# Community Resilience Fund — Optional Finance Module

**Status:** Restricted pilot implementation. This module is optional and is not part of the core climate monitoring requirement. No actual financial transactions, beneficiary approvals or institutional acceptance are implied by its presence in source code.

CARE-Map provides a staff-only Community Revolving Fund Monitoring, Inspection and Accountability System (CRF-MIS) for organisations that administer documented environmental livelihood or resilience funding. Different operators must independently configure and legally review their own programme rules.

## Existing implementation

- Community and group registry, participants, source-backed approval references and explicit role assignments
- Ledger of documented loan approvals, externally evidenced disbursements, verified repayments and reconciliation
- Separate entry and approval duties; pending documents cannot automatically be counted as funds received
- Inspection evidence, environmental asset references, corrective actions and follow-up
- Structured reporting templates and audit trails under `/staff/crf`

The historical schema was introduced in `db/migrations/019_benue_crf_mis.sql` and later migrations. **Do not rename or edit historical migration files** because production installations check their hashes. The filename is historical implementation detail, not platform branding, a source of funding or a guarantee of regional coverage.

## Operator configuration and safety

Financial policy, eligibility thresholds, currency, interest/service charges, instalment splits, forms and account controls are **programme-specific**. Existing code retains earlier pilot validations and NGN-denominated fields and must **not** be presented as suitable for arbitrary jurisdictions without a financial schema/policy review.

Before enabling finance operations, the operator must:

1. Appoint a legal data controller, programme sponsor and authorized independent reviewers.
2. Verify signed rules, evidence requirements, eligibility and local finance-law compliance.
3. Import only approved communities and source-verified groups; do not fabricate beneficiaries, amounts or bank transactions.
4. Validate local currencies and conversion rules. The current `_ngn` columns cannot automatically represent other currencies.
5. Keep admin, ledger-entry, bank-evidence approval, inspections and management duties separated.
6. Run transaction reconciliation, negative-path and concurrency tests with synthetic data; keep all real financial activity outside this module until accepted.
7. Restrict finance API and exported records to authorized users; public map access never includes sensitive funding information.

## Geographic scope

The list in `lgas` defines administrative categories for a particular installation, **not** approved beneficiaries. Historical seeded rows must not be claimed as evidence of programme coverage. See [regional deployment guide](../architecture/multi-state-deployment.md).

## Explicit boundaries

CARE-Map does not issue loans, transfer bank funds, approve financial entitlements or certify spending. It records and analyzes documented evidence supplied by an authorized organisation. Any external operating manual, form series, regulatory filing or subsidy must be separately approved before use.
