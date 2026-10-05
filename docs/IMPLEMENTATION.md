# CARE-Map Implementation

The repository now contains an executable MVP rather than only design material.

## Delivered workflows

### Public
- Browse a MapLibre/OpenStreetMap basemap with CARE-Map PostGIS layers.
- Filter interventions by entity type, LGA, and status.
- Submit a problem or unknown-stream report with manual coordinates or phone GPS.
- Register a community account.
- Track reports attached to the signed-in account.

### Staff
- Secure staff/admin session.
- Dashboard totals, functional rate, open reports, and high-risk count.
- Create boreholes and assets from latitude/longitude.
- Create forest polygons and river lines from GeoJSON.
- Change infrastructure status.
- Log maintenance through the API.
- Review, verify, resolve, or reject community reports.
- Export infrastructure data as CSV.

### Administration
- Create staff/admin/community users.
- Audit log for resource creation/update/delete and report state changes.

### GIS / risk
- PostGIS geometry columns and GIST indexes.
- Bounding-box map API.
- GeoJSON output.
- Rule-based scheduled risk refresh.
- Nearby unresolved reports contribute to forest-site risk.
- Automatic two-year anonymization hook for resolved community reports.

## Deployment checklist

1. Create an Aiven for PostgreSQL service.
2. Copy its PostgreSQL service URI into DATABASE_URL.
3. Copy the CA certificate into AIVEN_CA_CERT for certificate verification in production.
4. Create a random 32+ character SESSION_SECRET.
5. Create CRON_SECRET.
6. Run npm install.
7. Run npm run db:migrate.
8. Set ADMIN_EMAIL and a 12+ character ADMIN_PASSWORD.
9. Run npm run db:seed-admin.
10. Add the same runtime environment variables to Vercel and deploy.

## Data-entry convention

For point assets, longitude/latitude are collected separately. For line and polygon features, GeoJSON uses longitude first, latitude second.

Example line:

~~~json
{"type":"LineString","coordinates":[[8.52,7.71],[8.55,7.74]]}
~~~

Example polygon:

~~~json
{"type":"Polygon","coordinates":[[[8.52,7.71],[8.55,7.71],[8.55,7.74],[8.52,7.71]]]}
~~~

## External setup still required

The code cannot provision the user's Aiven account or Vercel environment by itself. Production readiness therefore still requires real service credentials, running the migration against that service, and deployment verification.
