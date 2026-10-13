import {z} from "zod";
export const loginSchema=z.object({email:z.email().max(254),password:z.string().min(8).max(200)});
export const registerSchema=z.object({name:z.string().min(2).max(120),email:z.email().max(254),password:z.string().min(10).max(200),privacyAcknowledged:z.literal(true),privacyNoticeVersion:z.string().min(1).max(40)});
export const reportSchema=z.object({type:z.enum(["problem_report","small_river_report"]),reporterName:z.string().max(120).optional().nullable(),reporterContact:z.string().max(160).optional().nullable(),relatedEntityType:z.enum(["borehole","asset","forest_site","river"]).optional().nullable(),relatedEntityId:z.uuid().optional().nullable(),description:z.string().min(10).max(4000),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180),gpsAccuracy:z.number().finite().positive().max(100000).optional().nullable(),capturedAt:z.iso.datetime({offset:true}).optional().nullable(),captureSource:z.enum(["manual","device_gps","csv_import","geojson_import","api_import"]).optional(),privacyAcknowledged:z.literal(true),privacyNoticeVersion:z.string().min(1).max(40),optionalContactConsent:z.boolean().optional().default(false)}).superRefine((d,ctx)=>{
  const source=d.captureSource||"manual";
  const accuracy=d.gpsAccuracy??null;
  const capturedAt=d.capturedAt??null;
  if(d.latitude===0&&d.longitude===0){
    ctx.addIssue({code:"custom",path:["latitude"],message:"Coordinates at 0,0 are not a valid CARE-Map field position."});
  }
  if(source==="manual"&&(accuracy!==null||capturedAt!==null)){
    ctx.addIssue({code:"custom",path:["captureSource"],message:"Manual coordinate entry cannot retain device GPS metadata."});
  }
  if(source==="device_gps"){
    if(accuracy===null||!capturedAt){
      ctx.addIssue({code:"custom",path:["captureSource"],message:"Device GPS readings require capture time and estimated horizontal accuracy."});
    }else if(Date.parse(capturedAt)>Date.now()+60_000){
      ctx.addIssue({code:"custom",path:["capturedAt"],message:"GPS capture time is in the future."});
    }
    // Offline reports retain their original position time and may sync later.
  }
});
export const userCreateSchema=z.object({name:z.string().min(2).max(120),email:z.email().max(254),password:z.string().min(12).max(200),role:z.enum(["staff","admin","registered_community"])});
