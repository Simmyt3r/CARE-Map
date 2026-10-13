import {query} from "@/lib/db";

export type FieldPoint={
  latitude:number;
  longitude:number;
  gpsAccuracy:number|null;
  captureSource:"manual"|"device_gps"|"csv_import"|"geojson_import"|"api_import"|"survey_import";
  capturedAt:string|null;
};

export function validateFieldPoint(input:Record<string,unknown>):FieldPoint{
  if(input.latitude===null||input.latitude===undefined||input.latitude===""||
    input.longitude===null||input.longitude===undefined||input.longitude===""){
    throw new Error("Latitude and longitude are required.");
  }
  const latitude=Number(input.latitude),longitude=Number(input.longitude);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
     latitude< -90||latitude>90||longitude< -180||longitude>180)
    throw new Error("Coordinates must be finite WGS84 latitude (-90 to 90) and longitude (-180 to 180).");
  const captureSource=String(input.captureSource||"manual");
  if(!["manual","device_gps","csv_import","geojson_import","api_import","survey_import"].includes(captureSource))
    throw new Error("Unrecognized coordinate source.");
  const gpsAccuracy=input.gpsAccuracy===null||input.gpsAccuracy===undefined||
     input.gpsAccuracy===""?null:Number(input.gpsAccuracy);
  if(gpsAccuracy!==null&&(!Number.isFinite(gpsAccuracy)||gpsAccuracy<=0||gpsAccuracy>100000))
    throw new Error("Reported GPS accuracy must be between 0 and 100,000 metres.");
  let capturedAt:string|null=null;
  if(input.capturedAt!=null&&input.capturedAt!==""){
    const parsed=new Date(String(input.capturedAt));
    if(Number.isNaN(parsed.getTime())||parsed.getTime()>Date.now()+60_000)
      throw new Error("Location capture time must be a valid past timestamp.");
    capturedAt=parsed.toISOString();
  }
  if(captureSource==="manual"&&(gpsAccuracy!==null||capturedAt!==null))
    throw new Error("Manually entered coordinates cannot retain device GPS accuracy or capture timestamp.");
  if(captureSource==="device_gps"){
    if(gpsAccuracy===null||!capturedAt)
      throw new Error("Device GPS records must include reported accuracy and capture time.");
    if(Date.now()-new Date(capturedAt).getTime()>15*60_000)
      throw new Error("Device GPS fix is older than 15 minutes. Recapture on site or switch to a clearly labelled manually reviewed location.");
  }
  return {latitude,longitude,gpsAccuracy,
    captureSource:captureSource as FieldPoint["captureSource"],capturedAt};
}

export function locationWarnings(point:FieldPoint):string[]{
  const warnings:string[]=[];
  if(point.captureSource!=="device_gps")warnings.push("Coordinates are not supported by a fresh device GPS fix.");
  if(point.gpsAccuracy===null)warnings.push("No measured GPS accuracy.");
  else if(point.gpsAccuracy>30)warnings.push("Reported accuracy exceeds 30 metres.");
  if(!point.capturedAt)warnings.push("Location capture time is missing.");
  return warnings;
}

export async function validateLgaPoint(lgaCode:string,point:FieldPoint){
  const result=await query<{inside:boolean|null}>(`SELECT CASE WHEN boundary IS NULL THEN NULL
      ELSE ST_Covers(boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) END inside
    FROM lgas WHERE code=$1`,[lgaCode,point.longitude,point.latitude]);
  if(!result.rowCount)throw new Error("Unknown Benue LGA.");
  if(result.rows[0].inside===false)
    throw new Error("Point does not fall inside the selected LGA polygon. Check GPS and LGA selection.");
  return result.rows[0].inside===true;
}
