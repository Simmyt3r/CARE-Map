import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
function csvValue(v:unknown){const s=v==null?"":String(v);return '"'+s.replaceAll('"','""')+'"';}
export async function GET(){
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const result=await query(`SELECT 'borehole' type,id,name,lga_code,status,ST_Y(location) latitude,ST_X(location) longitude,risk_level,risk_score FROM boreholes
 UNION ALL SELECT 'asset',id,name,lga_code,status,ST_Y(location),ST_X(location),risk_level,risk_score FROM assets ORDER BY type,lga_code,name`);
 const headers=["type","id","name","lga_code","status","latitude","longitude","risk_level","risk_score"];
 const csv=[headers.join(","),...result.rows.map(r=>headers.map(h=>csvValue(r[h])).join(","))].join("\n");
 return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=care-map-export.csv"}});
}
