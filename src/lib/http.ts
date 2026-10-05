import {NextResponse} from "next/server";
const buckets=new Map<string,{count:number;reset:number}>();
export function error(message:string,status=400,code="BAD_REQUEST"){return NextResponse.json({error:{code,message}},{status});}
export function clientIp(request:Request){return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";}
export function rateLimit(key:string,limit:number,windowMs:number){const now=Date.now();const current=buckets.get(key);if(!current||current.reset<=now){buckets.set(key,{count:1,reset:now+windowMs});return true;}if(current.count>=limit)return false;current.count++;return true;}
export function parseBbox(value:string|null){if(!value)return null;const p=value.split(",").map(Number);if(p.length!==4||p.some(Number.isNaN))return null;const[minLng,minLat,maxLng,maxLat]=p;if(minLng>=maxLng||minLat>=maxLat||minLng< -180||maxLng>180||minLat< -90||maxLat>90)return null;return{minLng,minLat,maxLng,maxLat};}
