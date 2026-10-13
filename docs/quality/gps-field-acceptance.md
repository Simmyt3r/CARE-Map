# CARE-Map GPS reliability: field acceptance checklist

**Scope:** Quality hardening only. No new feature, database migration, map provider or paid API is required.

## How GPS capture now behaves

The four existing capture forms (community reports, staff boreholes/assets, ACReSAL community intervention registration and inspections) share high-accuracy `watchPosition` acquisition. The app requests a fresh location (`maximumAge:0`), checks the WGS84 numeric coordinates and reported horizontal accuracy, collects updated readings for up to 30 seconds, and retains the lowest reported accuracy from valid **recent** readings.

- Target: **≤30 m** reported horizontal accuracy. This is a field-collection target, **not** survey-grade or a guarantee of positional truth.
- A single excellent fix may settle after about 8 seconds; distinct good fixes can end acquisition sooner.
- Fixes older than 15 seconds during live acquisition, invalid coordinates/uncertainty, impossible timestamps and the (0,0) null-island sentinel are rejected.
- A fix between 30 m and 100 m may be entered with a clear *low-confidence* warning and requires later review. Accuracy above 100 m is not auto-populated as device GPS.
- Permission, location-service and timing failures show actionable explanations. Cancel stops geolocation watching; leaving the form stops watchers.
- Manually modifying either coordinate **clears** the previous GPS estimate, capture time and `device_gps` provenance. Attempting a new capture also clears the prior provenance to prevent a failed attempt from leaving an old location falsely tagged as current.
- The server rejects manual coordinates carrying GPS metadata and live device locations more than 15 minutes old in staff resource and intervention workflows.
- Public community reports may synchronize later from the existing offline queue. Their *original* GPS capture time is retained rather than misrepresenting sync time as capture time. They still need field review.

## Suggested acceptance tests on an actual device

1. On Chrome for Android using the HTTPS production domain, allow Location. Stand at a known project point; keep the phone still with a view of the sky. Capture a point and confirm latitude, longitude, recorded accuracy and timestamp.
2. Indoors or with weak reception, verify that the app shows **Refining GPS** and the best reported accuracy. It must not silently report that accuracy is verified.
3. Observe two distinct fixes, and separately test a device which returns only one fix. Confirm the app does not hang waiting 30 seconds for a second result once a good fix has settled.
4. With a coarse fix of >100 m, the app must not overwrite the entered location. Move outdoors and retry.
5. Deny browser geolocation permission and confirm an actionable error and no false current-GPS provenance. Re-enable permission and retry.
6. Start GPS, click **Cancel**, then wait: there must be no late coordinate overwrite.
7. Capture a valid GPS fix, manually edit latitude, and confirm accuracy/time/source are cleared. A later save must be marked manual.
8. Change the asset category or extension tab during GPS acquisition; the GPS callback must not modify a different form.
9. Save a staff record while reported device GPS metadata is older than 15 minutes. The API should ask for recapture. Manual (explicitly labelled) coordinates must still be accepted if their LGA is valid.
10. Submit a public report while offline, then reconnect later. Verify original capture time and coordinate order survive synchronization.
11. Enter a valid point within a selected Benue LGA, then one outside it; the backend should reject the mismatch when authoritative LGA boundary polygons are available.
12. Inspect saved records in staff view and compare with a known reference point on the ground. Device-reported accuracy alone is **not** ground truth.

## Operational limitations

The browser may derive location from GPS, Wi-Fi, cell networks or other signals. The app cannot prove a device was physically present or prevent a malicious client from forging a coordinate payload. GPS hardware, permissions, sky visibility, atmospheric effects and the quality of the approved boundary dataset are outside software control. Treat automatic estimates as **pending observations**, verify consequential project locations independently and use survey-grade methods where the use case demands better accuracy.

### Acceptance record

Record device model, Android/Chrome version, accuracy (metres), reference point and independently measured offset, browser permissions, response time and pass/fail for each applicable scenario. Do not claim live GPS acceptance solely from passing CI.
