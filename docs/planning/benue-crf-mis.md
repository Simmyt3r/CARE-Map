# Benue ACReSAL CRF-MIS — State Module, Implementation and Acceptance Plan
**Date:** 20 October 2026
**Location:** Existing CARE-Map staff portal, `/staff/crf`
**Sponsor / owner of operational decisions:** Benue ACReSAL SPMU, Makurdi
**Software source:** `Simmyt3r/CARE-Map`
**Status:** Code-stage restricted pilot. **No production beneficiary import, bank transactions or approval to operate has been represented as completed.**

## Decision

Do **not** launch a separate national CRF platform. Add a restricted **Community Revolving Fund Monitoring, Inspection and Accountability System (CRF-MIS)** to the existing Benue CARE-Map GIS application. Scope is **Benue's 23 LGAs, and only the CRF-approved communities/CIGs actually registered in the SPMU's authoritative records**. The LGA list is a filtering/geographical foundation, **not** evidence that CRF beneficiaries exist in every LGA.

The revised Community Revolving Fund Operations Manual (Additional Financing) supplies the policy framework. **Source-control caution:** The document-control page of the PDF available for design labels its status “Draft for SPMU, FPMU and World Bank Task Team review,” while the covering briefing describes the manual as approved. Before formal rules go live, the SPMU must confirm the controlling signed issue, revision/circulars and explicit local approval of the configuration. This software does not override the Manual, FPMU CRF Loan App, bank mandates or financial authority matrix.

## Business questions

1. Which approved communities and CIGs received CRF support?
2. What was externally approved, verified as disbursed, due, recovered and outstanding?
3. Does inspected use-of-funds and asset evidence support the approved enterprise plan?
4. Which groups, loans, assets and findings need priority inspection or corrective action?
5. Are mandatory bank, loan, gender, milestone, reconciliation and reporting controls evidenced?
6. Can the SPMU reproduce its monthly CRF position from signed, independently verified source documents?

## Phase 1 functionality now introduced in source

| Capability | Source / principle | Limit |
|---|---|---|
| Community and CIG registry | `/api/crf/registry`; `crf_communities`, `crf_cigs`, `crf_cig_members` | No automatic beneficiary discovery, no imported identity documents. 15 members with ≥6 women needed for qualification. |
| CRF duty assignments | `/api/crf/access`, `crf_role_assignments` | Requires explicit staff grants; ordinary GIS staff and web visitors get no financial access. Admin config alone does not imply beneficiary-read privilege. |
| Recorded signed loan files | `/api/crf/ledger`, `crf_loans` | Existing signed approval memo, official published CBN-equivalent ceiling and loan agreement reference are required. Does not create an approval or transfer. |
| Disbursement schedule / 70–30 evidence | `crf_instalments`, `crf_disbursements` | External bank transfer/endorsed T15C evidence; Account 1 for disbursement; first tranche verified before second. Two-person verification. |
| Repayment and recovery monitoring | `crf_repayments`; `/api/crf/overview` | Recorded Account 2 receipts count only after independent reconciliation; separate principal/flat service charge/default fee. |
| Field inspections / T17 assets | `/api/crf/field`, `crf_inspections`, `crf_assets` | Staff-only records; evidence references, optional WGS84 coordinates and independent inspection-review state. Offline support not yet accepted. |
| T16 corrective actions | `crf_corrective_actions` | Findings with severity, due date and evidence-backed closure; separate review. |
| CRF command center | `/staff/crf`, `CrfOperationsCenter` | No dummy records; “N/A” rather than false financial percentages when denominator is zero. |

### Migration / activation

File: `db/migrations/019_benue_crf_mis.sql`

The migration **only adds isolated CRF tables and indexes**. It does not alter older migration checksums, seed beneficiaries, assign CRF staff duties or create transfers.

1. Confirm written internal pilot authorization, backup, data controller responsibility, and the authoritative manual/circular edition.
2. In signed-in CARE-Map admin interface, open `/staff/admin/migrations` and apply migration **019**; check the migration ledger and runtime logs.
3. Open `/staff/crf`, switch to **Role assignments**, grant CRF-specific duties to authorized SPMU staff using their existing accounts.
4. Register only approved Benue communities and source-backed CIG records. Use unique external references, not made-up IDs. Verify group rosters and independent eligibility evidence.
5. Import or enter signed existing loan files (approval dates and CBN ceiling evidence), T10 schedules and externally confirmed T11/T12/T15C transaction references.
6. Have a second authorized reviewer reconcile bank entries and inspect evidence. Do not treat pending records as received money.
7. Run controlled field tests with actual responsible officers before executive reporting.

### Non-negotiable separation of duties

| Duty | Roles |
|---|---|
| Admin grants/revokes CRF access | Existing CARE-Map administrator, specifically for staff explicitly authorized by SPMU |
| Registry write / group review | CRF desk officer or management |
| Record monitoring ledger evidence | CRF desk officer or finance officer |
| Verify bank evidence | Finance officer or internal auditor, **not** the entry recorder |
| Inspect activities / add T17/T16 | GIS officer, M&E officer or CRF desk officer |
| Independent inspection/action review | Reviewer role subject to SPMU assignment, never the original record creator |
| Management reporting | Management, desk, M&E, finance or audit |
| Public citizens | **No access** to CRF identities, members, loans, bank statements or audit records |

Confidential record access is enforced on each API call, not solely by hiding navigation elements. Never include CRF transactional or identifiable group records in public `/api/map/features`.

## Manual-driven controls

**Reference sections:** 2, 12–16, 19–22; forms T10–T17 and Appendix D/E.

- AF design intent: 10 CIGs per community; exactly 15 members per CIG; minimum 40% women. An actual Benue community must still be SPMU-approved.
- Per-community capital equivalent US$40,000, per-CIG equivalent US$4,000. Actual NGN loan ceiling is based on the FPMU-published CBN conversion at the SPMU approval memorandum date. **Never hardcode an assumed exchange rate.**
- Interest-free; flat service charge ₦50,000 / ₦75,000 / ₦100,000 for up to 3 / 6 / 12 months respectively, due with final instalment. ₦5,000 monthly default fee after the 60th day requires verified aged arrears and formal rules, **not an unchecked automatic deduction**.
- Two externally bank-executed tranches: 70% then 30%, subject to approved first-tranche-use evidence and the complete conditions precedent.
- Account 1 receives the community allocation and finances disbursements; Account 2 receives repayments. A bank instruction needs SPMU prior endorsement under T15. The SPMU-approved CRF Loan App remains authoritative.
- Recovery: at least 75% of scheduled amounts due recovered in period (ledger T12B). PAR60: outstanding balance of loans with an instalment 60+ days overdue divided by total outstanding (Appendix D). Target ≤25%.
- Minimum 30% of CRF value to women-led/owned enterprises measured by state **and lending cycle**; CIG membership ≥40% women.
- Community T14 return to SPMU/LGPMC by 7th; SPMU state report to FPMU and T16 log by 12th; loan app posting within 48 hours; T15 controls and T17 asset register reviewed as appropriate.
- Milestones M0–M4 need named documentary checks and externally authorized state status; the software must not cause disbursement.
- Section 21.11's market-linkage pilot is Kaduna, Kano and Kogi, not Benue; do not label Benue a pilot unless formally expanded.

### Metric limitations in the initial code release

The current computed recovery ratio uses **verified principal plus flat service-charge receipts paid within the selected month, divided by instalment principal plus charge falling due that month**, based on the entered schedule. Default fees are displayed separately and excluded from recovery. Collections from older arrears could make a period ratio exceed 100%; reconcile late payments according to the authoritative Appendix D/Section 22 interpretation before formal submission.

The current PAR60 prototype applies FIFO repayment to oldest instalments for aged-due detection and counts verified principal outstanding as exposed amount. **This is a model requiring reconciliation testing** against real historic reschedules, partial disbursements and collections. Until accepted, treat it as a monitoring estimate. No denominator means N/A.

The dashboard's women-led value indicator currently summarizes verified disbursement from the selected dataset; **enforcing the Manual's per-cycle denominator** and checking ledgers against the CRF Loan App is a release gate. Do not represent dashboard values as Section 22 certified statistics without full validation.

## Remaining implementation work

### P0 before operational pilot
1. Complete role-matrix and endpoint-authorization penetration tests, production integration tests and deployment checks.
2. Add controlled existing-record CSV import/export with privacy review and idempotency; never invent CRF groups.
3. Complete separate reviewer evidence workflow for member data and bank statement references in production; validate numeric precision and duplicate control.
4. Validate the full Section 22 metrics against signed Appendix D calculations, especially PAR60, fees, cycle reporting, rescheduled loans, tranche compliance and the two-account reconciliation.
5. Resolve operation/ownership/licence responsibilities and actual SPMU authorization before entering real beneficiary data.

### P1 after staff pilot validation
1. Structured M0–M4 status and document checklist; loan-app record reconciliation using FPMU-authorized interface specifications.
2. Form T14, T16 and state monthly report generation with completeness checks and submission receipts.
3. Secure consented photo upload, field GPS provenance, T17 asset-review escalations and limited M&E portfolio dashboards.
4. Two-account bank-statement reconciliation and missing-fund / unusual-payment detection. The app never executes transfers.
5. Proper financial audit and publication-sign-off work queue.

### P2 later
1. Encrypted authenticated offline inspection drafts and conflict-safe synchronization.
2. Advanced trends, early warnings and spatial aggregation, after data source and calculation quality are signed off.
3. State-by-state reuse only with separate deployment/database and authorization.

## Demonstration discipline

**No real CRF disbursements or recovery figures have been supplied or verified.** A deck can use labelled illustrations, but production CRF-MIS must display empty states until SPMU-approved records exist.

**Preferred PC demonstration:** show Benue LGA filter, a sandbox CIG with clearly labelled synthetic data, a pending evidence entry, a second-officer verification, an inspection and T16 action, and an automatically recomputed monthly report. Never run demonstration records in real SPMU finance tables.

The request to the PC should be **technical appraisal and controlled SPMU pilot authorization**, not retrospective approval of a Silabs contract or any financial transfer.


## Mandatory forms integration — October 20, 2026 (migration 020)

Part Four of the revised Manual states: **all listed forms are mandatory; states may translate them but may not alter their substance.** CARE-Map now offers a restricted **Manual T1–T19** section at `/staff/crf`. It stores a **companion metadata index for the signed official template**, not an unapproved replacement, reproduced legal agreement or bank payment instruction.

| Manual form | Template page in Manual | CARE-Map location / evidence link |
|---|---:|---|
| T1 CIG loan application | 62–64 | CIG registration, 15-member eligibility; official signed application reference |
| T2 business plan | 65 | Linked CIG/loan application, costs, market, risks, inclusion, safeguards |
| T3 crop hectare budget | 66–68 | Linked local-rate-backed costing sheet |
| T4 processing model | 69–70 | Equipment, operating capital, monthly margin, feasibility evidence |
| T5 produce marketing model | 71 | Inventory, storage loss, floor price and repayment buffer |
| T6 appraisal and scoring | 72 | Eight criteria, total /100; rejection guard for score below 60 or zero in criteria 1 or 5 |
| T7 loan offer | 73–74 | Signed 21-day offer; SPMU memo and terms |
| T8 loan agreement | 75–77 | Executed agreement and 15-member joint liability references |
| T9 joint liability undertaking | 78 | All member execution evidence |
| T10 repayment schedule | 79 | Ledger instalment schedule and signed original |
| T11 disbursement voucher | 80 | Externally bank-confirmed transfer and SPMU-endorsed T15C |
| T12A, B, C, D ledgers and register | 81–82 | Separate companion filing for each of the four registers; source financial ledger remains reconciled |
| T13 arrears/demand notice | 83 | Notice, stage, dates, cause, action and signatures |
| T14 monthly community return | 84 | This-month/cumulative figures and dual account balances; signed Chairperson/CBA original |
| T15A–E fiduciary bank forms | 85–95 | Independent restricted record per lettered form. Never substitute for bank-acknowledged originals |
| T16 corrective action log | 96–97 | Existing T16 action tracker plus filed state log and SPC certification reference |
| T17 asset register | 98 | Existing spatial asset inventory plus signed monthly CBA/internal auditor verification |
| T18 market linkage agreement | 99–101 | Signed buyer relationship evidence; not a guarantee or substitute for T8 |
| T19 state off-taker register | 102–103 | State-level filed buyer register; pilot activity not presumed for Benue |

**Security design:** All records are staff-only and gated by CRF-specific duty roles, not general CARE-Map user access. Financial/bank-form metadata requires financial or audit authorization. The signed original is a **controlled-storage reference**, not an attached image or the original bank instruction. Records remain **draft → submitted → verified/returned**, with independent reviewer enforcement. Returned records may be revised and resubmitted; edits are logged and revisioned.

**Hard compliance boundary:** A verified filed form means a designated reviewer has checked the original's existence. It does **not** approve a loan, authorize a bank debit, override the Loan App, establish formal external signatures or validate underlying expenditure. The signed official Manual page controls form layout and substance. In particular, do not enter NINs, phone numbers, account numbers or signature scans into freeform form metadata.

**Activation:** new `db/migrations/020_crf_manual_template_records.sql` is strictly additive. **Migration 019 and then 020 must be applied in sequence** through the authorized existing admin migration process after approved backup. No beneficiary records or approval evidence is seeded, and the user interface cannot operate until authorized CRF roles exist.

**Reporting/rollout caveats:** T14 filing is indexed; existing `/api/crf/overview` separately computes a subset of verified ledger indicators, not every row of T14. An authorized, reconciled, signed T14 return is still required. Advanced bank feeds, secure document custody/upload, complete Section 22 reports, offline mobile evidence, and formal loan-app synchronization are future acceptance-gated work, not claimed present. The Manual PDF document-control page calls itself **draft for review**, despite a separate covering communication describing approval. Obtain the binding adopted issue and circulars before enforcing any legal form electronically.
