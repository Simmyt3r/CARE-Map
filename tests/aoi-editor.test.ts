import {describe,expect,it} from "vitest";
import {coordinateVertex,parseAoiText,polygonFromVertices,validateAoi,
  verticesFromAoi,type AoiPoint} from "../src/lib/aoi-editor";

const c1:AoiPoint=[8.50,7.70],c2:AoiPoint=[8.55,7.70],c3:AoiPoint=[8.55,7.75];
describe("Sentinel-2 manual and map AOI editor",()=>{
  it("preserves 1- and 2-vertex drawing drafts rather than emitting incomplete polygons",()=>{
    const first=[c1],second=[c1,c2],third=[c1,c2,c3];
    expect(polygonFromVertices(first)).toBeNull();
    expect(polygonFromVertices(second)).toBeNull();
    const drawn=polygonFromVertices(third)!;
    expect(drawn.coordinates[0]).toEqual([c1,c2,c3,c1]);
    expect(verticesFromAoi(drawn)).toEqual(third);
  });
  it("accepts latitude/longitude entry in correct geographic order",()=>{
    expect(coordinateVertex("7.735","8.535")).toEqual([8.535,7.735]);
    expect(()=>coordinateVertex("","8.5")).toThrow(/both/);
    expect(()=>coordinateVertex("91","8.5")).toThrow(/Latitude/);
    expect(()=>coordinateVertex("7","181")).toThrow(/Longitude/);
  });
  it("accepts manual raw Polygon and single Feature or FeatureCollection",()=>{
    const geometry=polygonFromVertices([c1,c2,c3])!;
    expect(parseAoiText(JSON.stringify(geometry)).geometry).toEqual(geometry);
    const feature={type:"Feature",properties:{site:"test"},geometry};
    expect(parseAoiText(JSON.stringify(feature)).geometry).toEqual(geometry);
    const collection={type:"FeatureCollection",features:[feature]};
    expect(parseAoiText(JSON.stringify(collection)).geometry).toEqual(geometry);
  });
  it("rejects incomplete JSON with clear feedback",()=>{
    expect(parseAoiText('{ "type": "Polygon",').error).toMatch(/not valid JSON/);
    expect(parseAoiText("").error).toBeNull();
    expect(parseAoiText('{"type":"Point","coordinates":[8,7]}').error).toMatch(/Polygon/);
  });
  it("rejects unclosed, too-wide, zero-area and invalid polygon data",()=>{
    const invalid={type:"Polygon",coordinates:[[[8.5,7.7],[8.55,7.7],[8.55,7.75]]]};
    expect(()=>validateAoi(invalid)).toThrow(/closed ring/);
    const wide={type:"Polygon",coordinates:[[[8,7],[11,7],[11,8],[8,7]]]};
    expect(()=>validateAoi(wide)).toThrow(/too wide/);
    const flat={type:"Polygon",coordinates:[[[8,7],[9,7],[10,7],[8,7]]]};
    expect(()=>validateAoi(flat)).toThrow(/zero area/);
    const invalidCoordinate={type:"Polygon",coordinates:[[[8,7],[Infinity,7],[8,8],[8,7]]]};
    expect(()=>validateAoi(invalidCoordinate)).toThrow(/WGS84/);
    expect(()=>validateAoi({type:"FeatureCollection",features:[]})).toThrow(/exactly one/);
  });
  it("rejects duplicate-only vertices before using polygon as an AOI",()=>{
    const repeated=polygonFromVertices([c1,c1,c1])!;
    expect(()=>validateAoi(repeated)).toThrow(/zero area/);
  });
});
