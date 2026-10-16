import type {QueryResultRow} from "pg";

export type GeoPolygon={
  type:"Polygon"|"MultiPolygon";
  coordinates:unknown;
};

export type SceneSummary={
  id:string;
  datetime:string|null;
  cloudCover:number|null;
  platform:string|null;
  bbox:number[]|null;
};

/** An image request succeeded but the period returned no usable scenes/pixels. */
export class NoSentinelObservationError extends Error{
  constructor(public readonly windowStart:string,public readonly windowEnd:string){
    super("No usable Sentinel-2 observation between "+windowStart+" and "+windowEnd+
      ". Select an earlier completed date range, extend the window, or try a clearer dry-season period.");
    this.name="NoSentinelObservationError";
  }
}

/** Provider has refused further Sentinel requests due to request/processing quota. */
export class SentinelProviderLimitError extends Error {
  constructor(public readonly retryAfterSeconds:number|null=null){
    super("Copernicus Sentinel request or processing quota reached. Stop state-wide processing and check account usage before retrying.");
    this.name="SentinelProviderLimitError";
  }
}
const PROVIDER_LIMIT_PATTERN=/rate[ -]?limit|too many requests|quota|processing units|insufficient credits|request limit|exceeded your rate limit/i;
export function isSentinelProviderLimit(error:unknown){
  return error instanceof SentinelProviderLimitError ||
    error instanceof Error&&PROVIDER_LIMIT_PATTERN.test(error.message);
}

export type NdviStats={
  meanNdvi:number|null;
  vegetationFraction:number|null;
  clearFraction:number|null;
  vegetationHa:number|null;
  raw:unknown;
};

type TokenCache={token:string;expiresAt:number};
declare global{var __careMapCdseToken:TokenCache|undefined;}

const EARTH_SEARCH=process.env.EARTH_SEARCH_STAC_URL||"https://earth-search.aws.element84.com/v1";
const CDSE_TOKEN_URL=process.env.CDSE_TOKEN_URL||"https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const CDSE_SH_BASE_URL=(process.env.CDSE_SH_BASE_URL||"https://sh.dataspace.copernicus.eu").replace(/\/$/,"");

export function remoteSensingConfigured(){
  return Boolean(process.env.CDSE_CLIENT_ID&&process.env.CDSE_CLIENT_SECRET);
}

export function normalizeAoi(input:any):GeoPolygon{
  if(!input||!["Polygon","MultiPolygon"].includes(input.type)||!Array.isArray(input.coordinates)){
    throw new Error("AOI must be a GeoJSON Polygon or MultiPolygon.");
  }
  const polygons=input.type==="Polygon"?[input.coordinates]:input.coordinates;
  if(!Array.isArray(polygons)||!polygons.length)throw new Error("AOI has no polygons.");
  let vertices=0,minLon=Infinity,minLat=Infinity,maxLon=-Infinity,maxLat=-Infinity;
  for(const polygon of polygons){
    if(!Array.isArray(polygon)||!polygon.length)throw new Error("AOI polygon has no rings.");
    for(const ring of polygon){
      if(!Array.isArray(ring)||ring.length<4)throw new Error("AOI ring needs at least four coordinates.");
      let signedArea=0;
      for(let i=0;i<ring.length;i++){
        const point=ring[i];
        if(!Array.isArray(point)||point.length<2||!Number.isFinite(point[0])||!Number.isFinite(point[1])||
          point[0]< -180||point[0]>180||point[1]< -90||point[1]>90){
          throw new Error("AOI coordinates must be valid WGS84 [longitude, latitude] pairs.");
        }
        minLon=Math.min(minLon,point[0]);maxLon=Math.max(maxLon,point[0]);
        minLat=Math.min(minLat,point[1]);maxLat=Math.max(maxLat,point[1]);
        if(i>0){const prev=ring[i-1];signedArea+=prev[0]*point[1]-point[0]*prev[1];}
        if(++vertices>10000)throw new Error("AOI contains too many vertices; simplify the polygon.");
      }
      if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1]){
        throw new Error("AOI polygon rings must close at their first coordinate.");
      }
      if(Math.abs(signedArea)<1e-12)throw new Error("AOI polygon ring has zero area.");
    }
  }
  if(maxLon-minLon>2||maxLat-minLat>2){
    throw new Error("AOI extent exceeds 2 degrees. Split the landscape into smaller Sentinel analyses.");
  }
  return {type:input.type,coordinates:input.coordinates} as GeoPolygon;
}

export function assessNdviQuality(baseline:NdviStats,comparison:NdviStats,minClear=0.6){
  const issues:string[]=[];
  for(const [period,stats] of [["Baseline",baseline],["Comparison",comparison]] as const){
    if(stats.meanNdvi==null||!Number.isFinite(stats.meanNdvi)||
      stats.vegetationFraction==null||!Number.isFinite(stats.vegetationFraction)){
      issues.push(period+" observation has no usable NDVI statistics.");
    }
    if(stats.clearFraction==null||stats.clearFraction<minClear){
      issues.push(period+" clear-pixel coverage is below "+Math.round(minClear*100)+"% or unavailable.");
    }
  }
  return {publishable:issues.length===0,issues};
}

export function dateWindow(date:string|Date,days:number){
  const dateStr=date instanceof Date?date.toISOString().slice(0,10):date;
  if(typeof dateStr!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)||
    !Number.isInteger(days)||days<1||days>30)throw new Error("Invalid date or observation window.");
  const start=new Date(dateStr+"T00:00:00Z");
  if(Number.isNaN(start.getTime())||start.toISOString().slice(0,10)!==dateStr){
    throw new Error("Invalid analysis date.");
  }
  const end=new Date(start);
  end.setUTCDate(end.getUTCDate()+days);
  return {from:start.toISOString(),to:end.toISOString()};
}

export async function searchSentinelScenes(aoi:GeoPolygon,date:string|Date,windowDays=7,maxCloud=40):Promise<SceneSummary[]>{
  const range=dateWindow(date,windowDays);
  const response=await fetch(EARTH_SEARCH+"/search",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/geo+json,application/json"},
    body:JSON.stringify({
      collections:["sentinel-2-l2a"],
      intersects:aoi,
      datetime:range.from+"/"+range.to,
      limit:20,
      query:{"eo:cloud_cover":{"lt":maxCloud}}
    }),
    cache:"no-store",
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("Sentinel-2 catalog search failed.");
  const json=await response.json() as any;
  const features=Array.isArray(json.features)?json.features:[];
  return features.map((f:any)=>({
    id:String(f.id),
    datetime:f.properties?.datetime||f.properties?.start_datetime||null,
    cloudCover:Number.isFinite(Number(f.properties?.["eo:cloud_cover"]))?Number(f.properties["eo:cloud_cover"]):null,
    platform:f.properties?.platform||f.properties?.constellation||null,
    bbox:Array.isArray(f.bbox)?f.bbox:null
  })).sort((a:SceneSummary,b:SceneSummary)=>(a.cloudCover??999)-(b.cloudCover??999));
}

async function accessToken(){
  const cached=global.__careMapCdseToken;
  if(cached&&cached.expiresAt>Date.now()+60_000)return cached.token;
  const clientId=process.env.CDSE_CLIENT_ID;
  const clientSecret=process.env.CDSE_CLIENT_SECRET;
  if(!clientId||!clientSecret)throw new Error("Copernicus Data Space OAuth is not configured.");

  const body=new URLSearchParams({
    grant_type:"client_credentials",
    client_id:clientId,
    client_secret:clientSecret
  });
  const response=await fetch(CDSE_TOKEN_URL,{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body,
    cache:"no-store",
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("Copernicus authentication failed.");
  const json=await response.json() as {access_token?:string;expires_in?:number};
  if(!json.access_token)throw new Error("Copernicus authentication returned no access token.");
  global.__careMapCdseToken={token:json.access_token,expiresAt:Date.now()+Math.max(60,Number(json.expires_in||3600))*1000};
  return json.access_token;
}

/**
 * Staff-only connectivity preflight. Validates the existing OAuth client
 * without running paid/quota-bearing imagery processing or exposing tokens.
 */
export async function checkCopernicusAuthentication(){
  if(!remoteSensingConfigured())return {ok:false,message:"Add CDSE_CLIENT_ID and CDSE_CLIENT_SECRET to Vercel Production."};
  try{
    await accessToken();
    return {ok:true,message:"Copernicus OAuth authentication successful. NDVI processing still requires a sample analysis."};
  }catch{
    return {ok:false,message:"Copernicus authentication failed or timed out. Check OAuth client credentials, expiry and service availability."};
  }
}

function statsEvalscript(threshold:number){
  return `//VERSION=3
function setup(){
  return {
    input:[{bands:["B04","B08","SCL","dataMask"]}],
    output:[
      {id:"ndvi",bands:1,sampleType:"FLOAT32"},
      {id:"vegetation",bands:1,sampleType:"FLOAT32"},
      {id:"dataMask",bands:1}
    ]
  };
}
function evaluatePixel(s){
  const cloudy=[1,3,8,9,10,11].includes(s.SCL);
  const valid=s.dataMask && !cloudy && (s.B08+s.B04)!==0;
  const value=valid?(s.B08-s.B04)/(s.B08+s.B04):0;
  return {
    ndvi:[value],
    vegetation:[valid && value>=${threshold.toFixed(2)} ? 1 : 0],
    dataMask:[valid?1:0]
  };
}`;
}

function previewEvalscript(){
  return `//VERSION=3
function setup(){
  return {input:[{bands:["B04","B08","SCL","dataMask"]}],output:{bands:4}};
}
function evaluatePixel(s){
  const cloudy=[1,3,8,9,10,11].includes(s.SCL);
  if(!s.dataMask||cloudy||(s.B08+s.B04)===0)return [0,0,0,0];
  const v=(s.B08-s.B04)/(s.B08+s.B04);
  if(v<0)return [0.18,0.24,0.58,1];
  if(v<0.2)return [0.78,0.68,0.42,1];
  if(v<0.4)return [0.72,0.82,0.34,1];
  if(v<0.6)return [0.35,0.68,0.24,1];
  return [0.08,0.42,0.14,1];
}`;
}

function firstBandStats(entry:any,outputId:string){
  const bands=entry?.outputs?.[outputId]?.bands;
  if(!bands||typeof bands!=="object")return null;
  const first=Object.values(bands)[0] as any;
  return first?.stats||null;
}

export async function fetchNdviStats(aoi:GeoPolygon,date:string,windowDays:number,threshold:number,aoiAreaHa:number):Promise<NdviStats>{
  const token=await accessToken();
  const range=dateWindow(date,windowDays);
  const response=await fetch(CDSE_SH_BASE_URL+"/statistics/v1",{
    method:"POST",
    headers:{"authorization":"Bearer "+token,"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({
      input:{
        bounds:{geometry:aoi,properties:{crs:"http://www.opengis.net/def/crs/OGC/1.3/CRS84"}},
        data:[{type:"sentinel-2-l2a",dataFilter:{mosaickingOrder:"leastCC"}}]
      },
      aggregation:{
        timeRange:range,
        aggregationInterval:{of:"P"+windowDays+"D"},
        resx:0.00009,
        resy:0.00009,
        evalscript:statsEvalscript(threshold)
      }
    }),
    cache:"no-store"
  });
  const json=await response.json().catch(()=>null) as any;
  if(!response.ok){
    const message=String(json?.error?.message||json?.message||"");
    if(response.status===429||PROVIDER_LIMIT_PATTERN.test(message)){
      const retry=Number(response.headers.get("retry-after"));
      throw new SentinelProviderLimitError(Number.isFinite(retry)&&retry>0?retry:null);
    }
    throw new Error(message.slice(0,300)||"Sentinel NDVI statistics request failed.");
  }

  const entry=Array.isArray(json?.data)?json.data[0]:null;
  if(!entry)throw new NoSentinelObservationError(range.from.slice(0,10),range.to.slice(0,10));

  const ndviStats=firstBandStats(entry,"ndvi");
  const vegetationStats=firstBandStats(entry,"vegetation");
  const sampleCount=Number(ndviStats?.sampleCount||0);
  const noDataCount=Number(ndviStats?.noDataCount||0);
  const validPixels=Math.max(0,sampleCount-noDataCount);
  const geometryPixels=Number(entry?.geometryPixelCount||json?.geometryPixelCount||sampleCount||0);
  const clearFraction=geometryPixels>0?Math.max(0,Math.min(1,validPixels/geometryPixels)):null;
  const vegetationFraction=vegetationStats&&Number.isFinite(Number(vegetationStats.mean))?Number(vegetationStats.mean):null;
  const vegetationHa=vegetationFraction==null||clearFraction===null||clearFraction===0?null:aoiAreaHa*vegetationFraction;

  return{
    meanNdvi:ndviStats&&Number.isFinite(Number(ndviStats.mean))?Number(ndviStats.mean):null,
    vegetationFraction,
    clearFraction,
    vegetationHa,
    raw:json
  };
}

export async function fetchNdviPreview(aoi:GeoPolygon,date:string,windowDays:number){
  const token=await accessToken();
  const range=dateWindow(date,windowDays);
  const response=await fetch(CDSE_SH_BASE_URL+"/process/v1",{
    method:"POST",
    headers:{"authorization":"Bearer "+token,"content-type":"application/json","accept":"image/png"},
    body:JSON.stringify({
      input:{
        bounds:{geometry:aoi,properties:{crs:"http://www.opengis.net/def/crs/OGC/1.3/CRS84"}},
        data:[{type:"sentinel-2-l2a",dataFilter:{timeRange:range,mosaickingOrder:"leastCC"}}]
      },
      output:{
        width:768,
        height:768,
        responses:[{identifier:"default",format:{type:"image/png"}}]
      },
      evalscript:previewEvalscript()
    }),
    cache:"no-store"
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>"");
    throw new Error(detail.slice(0,300)||"Sentinel NDVI preview request failed.");
  }
  return Buffer.from(await response.arrayBuffer());
}

export interface RemoteSensingRow extends QueryResultRow{
  id:string;
  name:string;
  baseline_date:string;
  comparison_date:string;
  window_days:number;
  vegetation_threshold:number|string;
  status:string;
  baseline_mean_ndvi:number|string|null;
  comparison_mean_ndvi:number|string|null;
  baseline_clear_fraction:number|string|null;
  comparison_clear_fraction:number|string|null;
  baseline_vegetation_ha:number|string|null;
  comparison_vegetation_ha:number|string|null;
  vegetation_change_ha:number|string|null;
  vegetation_change_pct:number|string|null;
  change_level:string;
  publish_to_map:boolean;
  baseline_scene:SceneSummary|null;
  comparison_scene:SceneSummary|null;
  baseline_stats:unknown;
  comparison_stats:unknown;
  error_message:string|null;
  aoi_geometry:GeoPolygon;
  aoi_area_ha:number|string;
  created_at:string;
  completed_at:string|null;
}

export function changeLevel(changePct:number|null){
  if(changePct==null||changePct>=-5)return "low";
  if(changePct<=-25)return "critical";
  if(changePct<=-15)return "high";
  return "medium";
}
