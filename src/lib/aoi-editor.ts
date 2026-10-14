export type AoiPoint=[number,number];
export type AoiPolygon={type:"Polygon";coordinates:AoiPoint[][]};
export type AoiMultiPolygon={type:"MultiPolygon";coordinates:AoiPoint[][][]};
export type AoiGeometry=AoiPolygon|AoiMultiPolygon;

export function verticesFromAoi(value:unknown):AoiPoint[]{
  const g=value as Partial<AoiGeometry>|null;
  const ring=g?.type==="Polygon"?(g.coordinates as AoiPoint[][])?.[0]
    :g?.type==="MultiPolygon"?(g.coordinates as AoiPoint[][][])?.[0]?.[0]:null;
  if(!Array.isArray(ring))return [];
  const coordinates=ring.filter(point=>Array.isArray(point)&&point.length>=2&&
    Number.isFinite(point[0])&&Number.isFinite(point[1])) as AoiPoint[];
  if(coordinates.length>=2&&coordinates[0][0]===coordinates[coordinates.length-1][0]&&
    coordinates[0][1]===coordinates[coordinates.length-1][1])return coordinates.slice(0,-1);
  return coordinates;
}

export function polygonFromVertices(points:AoiPoint[]):AoiPolygon|null{
  return points.length>=3
    ?{type:"Polygon",coordinates:[[...points,points[0]]]}
    :null;
}

export function coordinateVertex(latitudeText:string,longitudeText:string):AoiPoint{
  if(!latitudeText.trim()||!longitudeText.trim())
    throw new Error("Enter both latitude and longitude.");
  const latitude=Number(latitudeText),longitude=Number(longitudeText);
  if(!Number.isFinite(latitude)||latitude< -90||latitude>90)
    throw new Error("Latitude must be a number between -90 and 90.");
  if(!Number.isFinite(longitude)||longitude< -180||longitude>180)
    throw new Error("Longitude must be a number between -180 and 180.");
  return [longitude,latitude];
}

function extract(value:unknown):unknown{
  if(!value||typeof value!=="object")return value;
  const o=value as Record<string,unknown>;
  if(o.type==="Feature")return o.geometry;
  if(o.type==="FeatureCollection"){
    const list=o.features;
    if(!Array.isArray(list)||list.length!==1)
      throw new Error("A GeoJSON FeatureCollection must contain exactly one polygon feature.");
    return extract(list[0]);
  }
  return value;
}

export function validateAoi(value:unknown):AoiGeometry{
  const geometry=extract(value) as Record<string,unknown>|null;
  if(!geometry||!["Polygon","MultiPolygon"].includes(String(geometry.type)))
    throw new Error("AOI must be a GeoJSON Polygon or MultiPolygon, not a point or line.");
  const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
  if(!Array.isArray(polygons)||!polygons.length)
    throw new Error("AOI polygon coordinates are missing.");
  let minLongitude=Infinity,minLatitude=Infinity,maxLongitude=-Infinity,maxLatitude=-Infinity,vertices=0;
  for(const polygon of polygons){
    if(!Array.isArray(polygon)||!polygon.length)throw new Error("AOI polygon must have an outer ring.");
    for(const ring of polygon){
      if(!Array.isArray(ring)||ring.length<4)
        throw new Error("An AOI polygon needs at least three corners and a closed ring.");
      let area=0;
      for(let i=0;i<ring.length;i++){
        const pair=ring[i];
        if(!Array.isArray(pair)||pair.length<2||typeof pair[0]!=="number"||
          typeof pair[1]!=="number"||!Number.isFinite(pair[0])||!Number.isFinite(pair[1])||
          pair[0]< -180||pair[0]>180||pair[1]< -90||pair[1]>90)
          throw new Error("Each coordinate must be [longitude, latitude] in WGS84 (EPSG:4326).");
        minLongitude=Math.min(minLongitude,pair[0]);
        minLatitude=Math.min(minLatitude,pair[1]);
        maxLongitude=Math.max(maxLongitude,pair[0]);
        maxLatitude=Math.max(maxLatitude,pair[1]);
        if(i>0){const prev=ring[i-1];area+=prev[0]*pair[1]-pair[0]*prev[1];}
        if(++vertices>10_000)throw new Error("AOI has too many corners. Simplify the polygon.");
      }
      const first=ring[0],last=ring[ring.length-1];
      if(first[0]!==last[0]||first[1]!==last[1])
        throw new Error("AOI ring must end at its starting corner; close the polygon.");
      if(Math.abs(area)<1e-12)
        throw new Error("AOI corners are collinear or have zero area. Choose distinct corners.");
    }
  }
  if(maxLongitude-minLongitude>2||maxLatitude-minLatitude>2)
    throw new Error("AOI is too wide for one comparison (maximum 2 degrees in each direction). Draw a smaller area.");
  return geometry as AoiGeometry;
}

export function parseAoiText(text:string):{geometry:AoiGeometry|null;error:string|null}{
  if(!text.trim())return {geometry:null,error:null};
  try{
    return {geometry:validateAoi(JSON.parse(text)),error:null};
  }catch(e){
    return {geometry:null,error:e instanceof SyntaxError
      ?"GeoJSON is not valid JSON. Paste a complete Polygon or use the map/coordinate entry.":e instanceof Error?e.message:"Invalid AOI geometry."};
  }
}
