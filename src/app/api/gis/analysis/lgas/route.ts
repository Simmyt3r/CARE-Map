import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const result=await query(`
    SELECT l.code,l.name,l.pilot,
      COALESCE(b.total,0)::int boreholes,
      COALESCE(b.functional,0)::int functional_boreholes,
      COALESCE(b.needs_attention,0)::int boreholes_needing_attention,
      COALESCE(a.total,0)::int assets,
      COALESCE(a.needs_attention,0)::int assets_needing_attention,
      COALESCE(f.total,0)::int forest_sites,
      COALESCE(f.area_ha,0)::numeric(14,2) forest_area_ha,
      COALESCE(rv.total,0)::int verified_rivers,
      COALESCE(rv.length_km,0)::numeric(14,2) river_length_km,
      COALESCE(rp.open_reports,0)::int linked_open_reports,
      COALESCE(rp.critical_reports,0)::int linked_critical_reports
    FROM lgas l
    LEFT JOIN (
      SELECT lga_code,count(*) total,
        count(*) FILTER(WHERE status='functional') functional,
        count(*) FILTER(WHERE status IN ('non_functional','needs_maintenance')) needs_attention
      FROM boreholes GROUP BY lga_code
    ) b ON b.lga_code=l.code
    LEFT JOIN (
      SELECT lga_code,count(*) total,
        count(*) FILTER(WHERE status IN ('non_functional','needs_maintenance')) needs_attention
      FROM assets GROUP BY lga_code
    ) a ON a.lga_code=l.code
    LEFT JOIN (
      SELECT lga_code,count(*) total,
        sum(ST_Area(boundary::geography))/10000.0 area_ha
      FROM forest_sites GROUP BY lga_code
    ) f ON f.lga_code=l.code
    LEFT JOIN (
      SELECT lga_code,count(*) FILTER(WHERE verified) total,
        sum(CASE WHEN verified THEN ST_Length(course::geography) ELSE 0 END)/1000.0 length_km
      FROM rivers GROUP BY lga_code
    ) rv ON rv.lga_code=l.code
    LEFT JOIN (
      SELECT linked.lga_code,
        count(*) FILTER(WHERE linked.status NOT IN ('resolved','rejected')) open_reports,
        count(*) FILTER(WHERE linked.status NOT IN ('resolved','rejected') AND linked.priority='critical') critical_reports
      FROM (
        SELECT r.status,r.priority,b.lga_code FROM reports r JOIN boreholes b ON r.related_entity_type='borehole' AND r.related_entity_id=b.id
        UNION ALL
        SELECT r.status,r.priority,a.lga_code FROM reports r JOIN assets a ON r.related_entity_type='asset' AND r.related_entity_id=a.id
        UNION ALL
        SELECT r.status,r.priority,f.lga_code FROM reports r JOIN forest_sites f ON r.related_entity_type='forest_site' AND r.related_entity_id=f.id
        UNION ALL
        SELECT r.status,r.priority,rv.lga_code FROM reports r JOIN rivers rv ON r.related_entity_type='river' AND r.related_entity_id=rv.id
      ) linked
      GROUP BY linked.lga_code
    ) rp ON rp.lga_code=l.code
    ORDER BY l.pilot DESC,l.name
  `);

  const totals=await query(`
    SELECT
      (SELECT count(*) FROM boreholes)::int boreholes,
      (SELECT count(*) FROM assets)::int assets,
      (SELECT count(*) FROM forest_sites)::int forest_sites,
      (SELECT count(*) FROM rivers WHERE verified)::int verified_rivers,
      (SELECT COALESCE(sum(ST_Area(boundary::geography))/10000.0,0) FROM forest_sites)::numeric(14,2) forest_area_ha,
      (SELECT COALESCE(sum(ST_Length(course::geography))/1000.0,0) FROM rivers WHERE verified)::numeric(14,2) river_length_km,
      (SELECT count(*) FROM reports WHERE status NOT IN ('resolved','rejected'))::int open_reports
  `);

  return NextResponse.json({data:result.rows,totals:totals.rows[0]});
}
