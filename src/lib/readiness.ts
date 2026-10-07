export type ReadinessState="ready"|"warning"|"blocked";

export type ReadinessItem={
  id:string;
  label:string;
  category:"infrastructure"|"security"|"database"|"data"|"operations";
  state:ReadinessState;
  required:boolean;
  detail:string;
  action:string;
};

export function readinessScore(items:ReadinessItem[]){
  const required=items.filter(x=>x.required);
  if(!required.length)return 100;
  const points=required.reduce((sum,item)=>sum+(item.state==="ready"?1:item.state==="warning"?0.5:0),0);
  return Math.round((points/required.length)*100);
}

export function readinessSummary(items:ReadinessItem[]){
  const required=items.filter(x=>x.required);
  return{
    score:readinessScore(items),
    required:required.length,
    ready:required.filter(x=>x.state==="ready").length,
    warnings:required.filter(x=>x.state==="warning").length,
    blockers:required.filter(x=>x.state==="blocked").length,
    optionalReady:items.filter(x=>!x.required&&x.state==="ready").length,
    optionalTotal:items.filter(x=>!x.required).length
  };
}
