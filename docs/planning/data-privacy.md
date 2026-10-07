# Data Privacy, Rights & Retention

**Status:** Product privacy/governance baseline implemented; formal legal review remains required before public launch  
**Last updated:** 2026-10-07

CARE-Map processes personal data in community accounts, public/community reports, staff operations, field evidence, audit records, and privacy-support workflows.

The legal framework to be reviewed for production includes the Nigeria Data Protection Act, 2023 and the Nigeria Data Protection Act General Application and Implementation Directive (GAID) 2025, issued by the Nigeria Data Protection Commission (NDPC).

Official references:
- Nigeria Data Protection Act, 2023: https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf
- NDP Act GAID 2025: https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf
- NDPC privacy policy / data-subject rights: https://ndpc.gov.ng/our-data-privacy-policy/
- NDPC Data Subject Access Request form: https://forms.ndpc.gov.ng/dsar-request/

## Principles built into CARE-Map

- **Lawfulness, fairness and transparency:** the public privacy notice describes the processing and deployment-configured lawful-basis wording.
- **Purpose limitation:** public reports are used for ACReSAL monitoring, verification, response and audit rather than unrelated purposes.
- **Data minimization:** anonymous reporters do not need to provide a name or contact detail.
- **Storage limitation:** resolved report identifiers are anonymized under the existing two-year operating rule, subject to formal records/legal review.
- **Accuracy:** community and staff workflows preserve correction/verification paths rather than silently overwriting provenance.
- **Security and accountability:** authentication, audit logs, role controls, TLS readiness, migration integrity, privacy-case history and breach records provide operational evidence.

## Pre-collection information

The public /privacy page exposes:

- configured data-controller identity
- controller address
- privacy contact
- categories of data collected
- processing purposes
- deployment-configured lawful-basis wording
- retention/anonymization approach
- data-subject rights
- complaint route
- processor/third-party caveat
- automated-analysis explanation

The final values for controller identity, address, privacy contact and lawful bases are environment-configured so they can be inserted only after formal review.

Required launch settings:
- DATA_CONTROLLER_NAME
- DATA_CONTROLLER_ADDRESS
- PRIVACY_CONTACT_EMAIL
- PRIVACY_LAWFUL_BASIS_REPORTS
- PRIVACY_LAWFUL_BASIS_ACCOUNTS
- PRIVACY_LEGAL_REVIEWED_AT
- PRIVACY_REVIEWER

## Notice acknowledgement vs consent

CARE-Map separates:

1. Privacy-notice acknowledgement for core collection points such as registration and report submission.
2. Explicit consent for optional reporter identity/contact details when a reporter voluntarily supplies a name or contact detail.

The product does not use a blanket “consent to everything” checkbox as a substitute for determining the correct lawful basis for necessary processing.

Privacy-notice acknowledgements are stored with a version identifier in privacy_notice_acceptances.

## Community self-service rights

Registered community users can:

- download a JSON export of their account, linked reports, report-photo metadata and privacy-notice records
- request account erasure/anonymization from the My Reports area
- submit a more complex privacy request from /privacy

Self-service account erasure:

- disables the community account
- replaces account name/email with non-identifying placeholders
- removes optional reporter name/contact fields from linked reports
- detaches privacy-notice records from the user identity
- preserves de-identified operational report records where CARE-Map may still require them for project tracking

Staff/admin accounts are intentionally excluded from self-service erasure because their retention and employment/government-record obligations require separate policy review.

## Data-subject rights request workflow

Migration 014 adds data_subject_requests.

Supported requests:
- access
- rectification
- erasure
- restriction
- objection
- portability
- withdrawal of consent
- complaint

Public request endpoint:
- POST /api/privacy/requests

Public status check:
- GET /api/privacy/requests?reference=...&email=...

Administrator queue:
- GET /api/admin/privacy/requests
- PATCH /api/admin/privacy/requests/:id

Each request receives a unique reference, submission timestamp, target due date, case status, identity-verification notes, resolution notes, and an audit trail for admin changes.

CARE-Map uses a 30-day operational target, matching the response target stated on the NDPC's current DSAR form. Formal legal review must confirm any circumstance-specific extensions or exceptions.

## Breach-response register

Migration 014 adds privacy_breach_register.

The administrator Privacy Center can record incident details, detection time, affected data categories, approximate affected people, containment actions, risk/high-risk assessment, notification flags, notification timestamps and case status.

Where an incident is marked likely to create risk, CARE-Map starts a 72-hour operational countdown for NDPC notification tracking. High-risk assessment separately flags affected-person notification tracking.

This is an operational aid, not a substitute for legal/privacy assessment of whether notification is required.

## Retention rules

### Community reports

Current project operating rule:

| Data | Current rule |
|---|---|
| Report operational content | May be retained for historical, monitoring, audit and trend purposes subject to lawful records obligations |
| Reporter name/contact | Anonymized two years after resolution |
| Linked community user identity | Removed from the old resolved report at anonymization |
| Report-linked privacy acceptance user link | Detached when the old report is anonymized |

The two-year period is still subject to confirmation against ACReSAL, government, donor/World Bank, litigation-hold and records-management obligations.

### Community accounts

Retained while active, unless anonymized through the self-service erasure workflow or another approved privacy request.

### Privacy-rights cases and breach records

Retention periods for these accountability records must be confirmed during formal review. CARE-Map does not automatically erase them yet because doing so without an approved accountability/records schedule would be premature.

## Cookies and local browser storage

CARE-Map currently uses an HTTP-only session cookie for signed-in users, browser local storage for the offline community-report queue, and service-worker/browser storage required for PWA/offline behavior.

The application does not intentionally include advertising cookies in the current baseline.

Cookie/storage notice and consent requirements must be confirmed during formal legal review, particularly for any future analytics, tracking or non-essential storage.

## Automated analysis

CARE-Map uses rule-based infrastructure risk scores, spatial proximity/intersection analysis, remote-sensing vegetation-change signals and monitoring alerts.

These are operational decision-support signals. They do not make fully automated legal or socio-economic decisions about natural persons. Staff review and field verification remain part of the workflow.

## DPIA / high-risk processing review

Formal review should determine whether a DPIA is required for precise/report location data, field imagery containing identifiable people, linked community identities and locations, remote-sensing/monitoring workflows, combined geospatial datasets, automated prioritization, public-sector data sharing or cross-border cloud processing.

CARE-Map's Privacy Center includes this as a compliance-preparation checklist, but completing a checkbox inside software is not itself a DPIA.

## Remaining formal legal-review items

- [ ] Confirm final legal identity of the data controller and any joint-controller/processor roles.
- [ ] Confirm the lawful basis for every processing activity.
- [ ] Confirm whether the operating entity is a Data Controller/Processor of Major Importance and any NDPC registration/CAR obligations.
- [ ] Confirm DPO/DPCO requirements.
- [ ] Complete or formally assess the need for DPIA(s).
- [ ] Approve the two-year report-identifier retention rule against ACReSAL/government/donor record obligations.
- [ ] Create/approve processor and cross-border transfer records for Aiven, Vercel, Copernicus and any other vendors.
- [ ] Review cookie/local-storage requirements.
- [ ] Review children's/minors' data handling if the public service may be used by minors.
- [ ] Approve the breach-response SOP and escalation contacts.
- [ ] Approve rights-request identity-verification procedure and any lawful refusal/extension rules.
- [ ] Review the public privacy notice before launch.

## Production rule

The Production Readiness Center blocks launch readiness until the privacy controller/contact/lawful-basis settings are configured, formal review fields are set, migration 014 has created the privacy governance tables, and there are no overdue rights requests or tracked NDPC breach-notification clocks.

These environment values are attestations. They must only be set after the actual review has been completed.
