# CARE-Map Localization & Translation Governance

CARE-Map uses a reviewed translation-pack model for public-facing local-language support.

English is the built-in default and permanent safe fallback.

Initial Benue target packs:

- Tiv — language tag `tiv`
- Idoma — language tag `idu`
- Igede — language tag `ige`

These are target languages, not pre-approved translations. CARE-Map does not ship guessed local-language wording.

## Public baseline

The localization runtime currently covers the core public journey:

- public navigation
- landing-page introduction
- public map heading
- community registration
- community reporting
- GPS/report feedback
- offline queue feedback
- privacy acknowledgement wording

Staff and administrator workspaces remain English in this baseline.

## Translation storage

Migration:

`db/migrations/015_localization.sql`

`translation_packs` stores one current pack per target language with:

- language code/name/native name
- translation JSON
- source/reviewer context
- pack version
- draft/reviewed status
- enabled/disabled state
- reviewer and review time
- audit timestamps

`translation_pack_imports` records each import attempt with:

- language
- source
- version
- translated key count
- required key count
- coverage percentage
- unknown keys
- missing required keys
- importing administrator
- import time

## English catalog

The canonical public keys live in:

`src/lib/i18n.ts`

Administrators can download the English template from:

`Admin → Localization → Download English template`

Translate values only. Keep keys unchanged.

## Import and review workflow

1. Download the current English template.
2. A fluent translator prepares the target-language values.
3. Record translator/reviewer source and pack version.
4. Import the JSON through Admin → Localization.
5. CARE-Map validates known keys and reports missing/unknown keys.
6. Import always resets the pack to draft and disables public use.
7. The pack must reach 100% required-key coverage before review approval.
8. An administrator explicitly approves review.
9. A reviewed pack must be separately enabled before it appears to public users.

Changing/reimporting a reviewed pack returns it to draft and disables it until it is reviewed again.

## Public safety rules

Public language APIs return only packs that are both:

- status = reviewed
- enabled = true

If a requested pack is missing, disabled, unreviewed, unavailable, or the database cannot be reached, CARE-Map serves English.

The selected locale is stored in browser local storage under `caremap_locale`.

The document `lang` attribute changes to the resolved public locale after the reviewed catalog loads.

## APIs

Public:

- `GET /api/i18n/languages`
- `GET /api/i18n/catalog?lang=tiv`

Administrator:

- `GET /api/admin/i18n/packs`
- `POST /api/admin/i18n/packs`
- `PATCH /api/admin/i18n/packs/:code`

Administrator actions:

- review
- enable
- disable
- revoke

## JSON structure

A pack may be a plain key/value object or contain a `translations` object.

Example shape:

```json
{
  "languageCode": "tiv",
  "source": "Human translator and reviewer",
  "version": "1",
  "translations": {
    "nav.publicMap": "...",
    "nav.reportIssue": "..."
  }
}
```

Do not translate the keys.

## Privacy/legal text

The legal privacy notice itself remains English in this baseline.

When a user selects a reviewed local-language pack and opens `/privacy`, CARE-Map displays an explicit notice that the legal privacy notice remains English until a separately reviewed legal translation is approved.

Do not publish a translated legal/privacy notice merely because a general UI translator approved interface wording. Legal wording needs separate legal/privacy review.

## Production readiness

Localization is currently an optional capability gate, not a blocker for an English-only pilot.

The Production Readiness Center reports:

- whether migration 015 is available in the database
- how many local-language packs are both reviewed and publicly enabled

A future decision can promote local-language availability to a required launch gate if ACReSAL policy requires it.

## Content-quality rule

CARE-Map intentionally contains no machine-guessed Tiv, Idoma, or Igede strings. Display names remain human-readable while stored/public language tags use `tiv`, `idu`, and `ige`.

Human language review should check:

- meaning in normal community usage
- agricultural/environmental terminology
- GIS/location terminology
- emergency/severity wording
- consent/privacy wording where applicable
- spelling and orthography
- clarity for low-literacy users
- consistency across buttons, instructions, and feedback

Audio or voice prompts should be reviewed separately if added later.

## Current external content gate

The software framework is complete, but local-language deployment remains incomplete until fluent human reviewers supply and approve the actual Tiv, Idoma, and/or Igede packs.
