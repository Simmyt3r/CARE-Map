"use client";
import {useCallback,useEffect,useRef,useState} from "react";

export type FieldGpsFix={
  latitude:number;
  longitude:number;
  accuracyMeters:number;
  capturedAt:string;
};
export const GPS_TARGET_METERS=30;
export const GPS_MAX_SAMPLE_AGE_MS=15_000;
export const GPS_CAPTURE_TIMEOUT_MS=30_000;

/**
 * The Web Geolocation API reports an estimated horizontal accuracy radius,
 * not surveyed precision. Never claim that this verifies field coordinates.
 */
export function usableGpsSample(position:Pick<GeolocationPosition,"coords"|"timestamp">,now=Date.now()):FieldGpsFix|null{
  const {latitude,longitude,accuracy}=position.coords;
  if(![latitude,longitude,accuracy,position.timestamp].every(Number.isFinite))return null;
  if(latitude< -90||latitude>90||longitude< -180||longitude>180)return null;
  if(latitude===0&&longitude===0)return null; // null-island sentinel, not an ACReSAL field site
  if(accuracy<=0||accuracy>100_000)return null;
  if(position.timestamp>now+5000||now-position.timestamp>GPS_MAX_SAMPLE_AGE_MS)return null;
  return {latitude,longitude,accuracyMeters:accuracy,capturedAt:new Date(position.timestamp).toISOString()};
}
export function bestGpsSample(best:FieldGpsFix|null,next:FieldGpsFix):FieldGpsFix{
  return !best||next.accuracyMeters<best.accuracyMeters?next:best;
}
export function describeGpsError(code:number){
  if(code===1)return "Location permission was denied. Allow location access in browser/site settings and retry.";
  if(code===2)return "Device location is unavailable. Enable Location/GPS, move outside if practical, and retry.";
  if(code===3)return "GPS timed out. Try again with location services enabled.";
  return "Could not read your location. Check site permissions and device location services.";
}

/** Watch multiple high-accuracy fixes; reject stale/invalid readings, keep the best.
 * After the 30-second limit, a weak fix is offered with a visible warning,
 * rather than silently labelled verified. Manual edits must cancel the watch.
 */
export function useFieldGps(
  onFix:(fix:FieldGpsFix)=>void,
  onMessage:(message:string)=>void,
  options:{targetMeters?:number;timeoutMs?:number}={}
){
  const [capturing,setCapturing]=useState(false);
  const callbackRef=useRef({onFix,onMessage});
  useEffect(()=>{callbackRef.current={onFix,onMessage};},[onFix,onMessage]);
  const watchId=useRef<number|null>(null);
  const timeoutId=useRef<ReturnType<typeof setTimeout>|null>(null);
  const generation=useRef(0);
  const best=useRef<FieldGpsFix|null>(null);
  const started=useRef(0);
  const validSamples=useRef(0);
  const target=options.targetMeters??GPS_TARGET_METERS;
  const duration=options.timeoutMs??GPS_CAPTURE_TIMEOUT_MS;

  const clear=useCallback(()=>{
    if(watchId.current!==null){
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current=null;
    }
    if(timeoutId.current!==null){
      clearTimeout(timeoutId.current);
      timeoutId.current=null;
    }
  },[]);
  const cancel=useCallback(()=>{
    generation.current++;
    clear();
    best.current=null;
    validSamples.current=0;
    setCapturing(false);
  },[clear]);
  useEffect(()=>()=>{generation.current++;clear();},[clear]);

  const capture=useCallback(()=>{
    cancel();
    if(typeof navigator==="undefined"||!navigator.geolocation){
      callbackRef.current.onMessage("GPS is not supported in this browser. Manual coordinates will require field review.");
      return;
    }
    if(!window.isSecureContext){
      callbackRef.current.onMessage("Device GPS requires HTTPS. Open the deployed CARE-Map site over a secure connection.");
      return;
    }
    const requestId=++generation.current;
    const current=()=>generation.current===requestId;
    started.current=Date.now();
    setCapturing(true);
    callbackRef.current.onMessage("Acquiring high-accuracy GPS… keep the device still and wait for a reliable fix.");

    function finish(message:string,point:FieldGpsFix|null){
      if(!current())return;
      clear();
      setCapturing(false);
      if(point)callbackRef.current.onFix(point);
      callbackRef.current.onMessage(message);
    }

    watchId.current=navigator.geolocation.watchPosition(position=>{
      if(!current())return;
      const point=usableGpsSample(position);
      if(!point)return;
      best.current=bestGpsSample(best.current,point);
      validSamples.current++;
      const candidate=best.current;
      const accuracy=Math.round(candidate.accuracyMeters);
      // Either two timely fixes, or one exceptionally precise result after 8s.
      if(candidate.accuracyMeters<=target&&
         (validSamples.current>=2||Date.now()-started.current>=8000)){
        finish("GPS acquired (reported ±"+accuracy+" m). Verify the marker is on-site before saving.",candidate);
      }else{
        callbackRef.current.onMessage("Refining GPS… best reported accuracy ±"+accuracy+" m. Target ≤"+target+" m.");
      }
    },e=>{
      if(!current())return;
      const point=best.current;
      finish(point
        ?"GPS interrupted. Best reading ±"+Math.round(point.accuracyMeters)+" m; review or recapture before using."
        :describeGpsError(e.code),point);
    },{enableHighAccuracy:true,maximumAge:0,timeout:duration});

    timeoutId.current=setTimeout(()=>{
      const point=best.current;
      finish(point
        ?point.accuracyMeters<=target
          ?"GPS captured at reported ±"+Math.round(point.accuracyMeters)+" m. Verify the point on the map."
          :"Low-confidence GPS (±"+Math.round(point.accuracyMeters)+" m). Recapture outdoors; do not mark verified."
        :"No valid current GPS fix after "+Math.round(duration/1000)+" seconds. Try outdoors or enter reviewed coordinates.",
        point);
    },duration);
  },[cancel,clear,target,duration]);

  return {capture,cancel,capturing};
}
