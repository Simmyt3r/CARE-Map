export type VerificationSeverity="medium"|"high"|"critical";

export function fieldVerificationDueAt(severity:VerificationSeverity,now=new Date()){
  const due=new Date(now);
  const days=severity==="critical"?1:severity==="high"?3:7;
  due.setUTCDate(due.getUTCDate()+days);
  return due;
}

export function fieldVerificationClosureError(input:{
  origin:string;
  status:string;
  note?:string|null;
  evidenceCount:number;
}){
  if(input.origin!=="satellite_alert")return null;
  if(input.status!=="resolved"&&input.status!=="rejected")return null;
  if(!input.note||input.note.trim().length<10){
    return "Field verification closure requires a clear status note of at least 10 characters.";
  }
  if(input.status==="resolved"&&input.evidenceCount<1){
    return "Add at least one field evidence photo before resolving a satellite verification task.";
  }
  return null;
}
