# CARE-Map Citizen Education Curriculum (October 2026)

**Location:** Public `/extension` route. **Audience:** community members, farmers, students and field extension teams. **Language:** plain English; local language versions must be reviewed by competent translators and ACReSAL staff. **Status:** education content for review, not official extension certification.

## Learning structure

The extension Learning Centre now provides **12 illustrated lessons in seven categories**:

| Category | Lessons | Main learning outcome |
|---|---|---|
| Getting started | ACReSAL: why landscapes and communities matter | Understand the programme, interventions and who maintains them |
| Climate & weather | Climate change and everyday decisions; Official warnings | Distinguish weather/climate, prepare for hazards |
| Land & soil | Soil erosion | Understand runoff and soil protection |
| Water & floods | Flood preparedness; Water points and drainage; Watersheds | Recognize flood hazards, water safety and drainage connectivity |
| Trees & farming | Tree restoration; Climate-smart farming | Understand survival, soil cover and locally adapted crops |
| GIS & satellite | Reading CARE-Map vegetation-change results | Interpret NDVI without claiming causality |
| Community action | Responsible reporting; Waste and blocked drains | Submit accurate, safe, privacy-conscious observations |

Every lesson contains:
1. A **labelled, original, lightweight SVG teaching graphic** that loads without any third-party image host or model API. Graphics are conceptual and never represented as surveyed maps or real intervention photographs.
2. A plain-language summary, estimated reading time and explanation of why it matters.
3. **Four or five complete teaching sections** providing mechanisms, context, limits and next steps.
4. A clearly fictional, illustrative community scenario.
5. Concrete action steps, prominent safety caution and a one-paragraph key takeaway.
6. Defined key terms, a three-option knowledge check and a primary-source reading link.

Category filters, search and completion counts run entirely in React on the browser. **No account, cookie-based learning analytics, certificate, server-side quiz record or tracking is created.** Completion is session-only and resets if the page reloads. No persistence is promised.

## Source and editorial safeguards

Lesson explanations are carefully paraphrased and point to public source pages. Core sources include ACReSAL Nigeria, the UN, FAO, NEMA Nigeria, WHO, NASA and USGS. Educational graphics are designed in source code, not copied from publications.

Review by the responsible programme's environmental, agriculture, forestry, GIS, emergency management and public communication personnel is required before officially endorsing or translating lessons. Time-sensitive flood advice should reference current NEMA/SEMA notices; this page is **not** an alerting or dispatch service.

**Critical scientific distinction:** A CARE-Map NDVI result represents estimated change over a selected AOI with selected dates, an NDVI threshold and cloud-quality criteria. It does not measure individual tree survival, prove a restoration intervention caused the change, or assign a whole AOI's result to one nearby community. Such claims need independent spatial data, consistent observation periods and field validation.

## Maintenance process

- Edit educational copy in `src/lib/citizen-lessons.ts`, preserving stable lesson IDs and accessible source links.
- Reuse a graphic type or add an original diagram variant in `src/components/CitizenLessonGraphic.tsx`, using responsive `viewBox` SVG and accessible titles. Never label fabricated scenes as real evidence.
- UI search, quiz and category design reside in `src/components/CitizenLearningCenter.tsx` and `src/app/globals.css`.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Check primary-source links periodically, especially Nigerian emergency warnings. Document source changes and any local ACReSAL approval.
- Test a narrow phone display, screen reader reading order, keyboard-accessible details, searchable topic categories, quiz feedback and reduced-motion preferences.

## Interoperability and expansion

The content and graphic structure are reusable on other states' CARE-Map deployments, but references to specific local risks, contacts, policy, local languages and restoration practices should be reviewed by each participating state before deployment. Avoid inventing an agency endorsement or a translated script.

**No SQL migration is required.** The curriculum is static and contains no citizen personal data.
