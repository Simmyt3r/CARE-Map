export type RiskLevel="low"|"medium"|"high"|"critical";
export function levelForScore(score:number):RiskLevel{if(score>=80)return"critical";if(score>=60)return"high";if(score>=35)return"medium";return"low";}
export function maintenanceRisk(status:string,lastMaintenance?:string|Date|null,today=new Date()){
 let score=status==="non_functional"?85:status==="needs_maintenance"?65:status==="decommissioned"?15:10;
 if(!lastMaintenance)score+=20;else{const days=Math.max(0,(today.getTime()-new Date(lastMaintenance).getTime())/86400000);if(days>365)score+=25;else if(days>180)score+=15;else if(days>90)score+=5;}
 score=Math.min(100,score);return{score,level:levelForScore(score)};
}
