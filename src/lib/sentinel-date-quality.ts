/**
 * Sentinel-2 date validation shared by the browser and server.
 * Windows are [start, end) in UTC. Do not ask an observation API for
 * tomorrow's scenes, or for a 30-day composite that has not yet elapsed.
 */
export function observationDate(value:string|Date):string{
  const date=value instanceof Date?value.toISOString().slice(0,10):value;
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
    Number.isNaN(Date.parse(date+"T00:00:00Z"))||
    new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date){
    throw new Error("Enter a valid observation date (YYYY-MM-DD).");
  }
  return date;
}

export function observationWindowEnd(value:string|Date,days:number){
  if(!Number.isInteger(days)||days<1||days>30)throw new Error("Observation window must be between 1 and 30 days.");
  const date=observationDate(value);
  return new Date(Date.parse(date+"T00:00:00Z")+days*86_400_000);
}

export function observationWindowError(value:string|Date,days:number,now=new Date()):string|null{
  try{
    const end=observationWindowEnd(value,days);
    const latestCompleteDay=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
    if(end.getTime()>latestCompleteDay){
      const endDate=end.toISOString().slice(0,10);
      const latestStart=new Date(latestCompleteDay-days*86_400_000).toISOString().slice(0,10);
      return "Observation window ends "+endDate+", which is not a completed date range. "+
        "For a "+days+"-day window, use a start date on or before "+latestStart+
        " (UTC), preferably earlier to allow satellite data ingestion.";
    }
    return null;
  }catch(e){
    return e instanceof Error?e.message:"Invalid observation date.";
  }
}
export function comparisonWindowError(baseline:string|Date,comparison:string|Date,days:number,now=new Date()):string|null{
  const a=observationWindowError(baseline,days,now);
  if(a)return "Baseline: "+a;
  const b=observationWindowError(comparison,days,now);
  if(b)return "Comparison: "+b;
  if(observationDate(comparison)<=observationDate(baseline)){
    return "Comparison date must be later than the baseline date.";
  }
  return null;
}
