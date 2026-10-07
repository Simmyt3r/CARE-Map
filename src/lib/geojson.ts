export type Extent=[number,number,number,number];

export function geometryExtent(geometry:{coordinates?:unknown}|null|undefined):Extent|null{
  let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;
  let found=false;

  const visit=(value:unknown)=>{
    if(
      Array.isArray(value)&&
      value.length>=2&&
      typeof value[0]==="number"&&
      typeof value[1]==="number"&&
      Number.isFinite(value[0])&&
      Number.isFinite(value[1])
    ){
      const lng=value[0],lat=value[1];
      minLng=Math.min(minLng,lng);minLat=Math.min(minLat,lat);
      maxLng=Math.max(maxLng,lng);maxLat=Math.max(maxLat,lat);
      found=true;
      return;
    }
    if(Array.isArray(value))value.forEach(visit);
  };

  visit(geometry?.coordinates);
  return found?[minLng,minLat,maxLng,maxLat]:null;
}
