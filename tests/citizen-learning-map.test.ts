import {describe,it,expect} from "vitest";
import {vegetationSummary,type PublishedVegetationFeature} from "../src/lib/vegetation-display";
import {citizenLessons,citizenCategories} from "../src/lib/citizen-lessons";

const rectangle=(changeHa:number,changePct:number):PublishedVegetationFeature=>({
  type:"Feature",id:"example",
  geometry:{type:"MultiPolygon",coordinates:[[[[8.5,7.7],[8.55,7.7],[8.55,7.75],[8.5,7.75],[8.5,7.7]]]]},
  properties:{entityType:"ndvi_change",name:"Makurdi sample",changeHa,changePct,
    baselineDate:"2025-01-14",comparisonDate:"2026-01-14"}
});
describe("Public vegetation change display",()=>{
  it("shows signed hectare gain with AOI bounds and correct map center",()=>{
    const data=vegetationSummary(rectangle(150.357,17.6));
    expect(data).toMatchObject({
      label:"Vegetation gain",metric:"+150.4 ha",percentage:"+17.6%",
      dates:"2025-01-14 → 2026-01-14"
    });
    expect(data.extent).toEqual([8.5,7.7,8.55,7.75]);
    expect(data.center?.[0]).toBeCloseTo(8.525,6);
    expect(data.center?.[1]).toBeCloseTo(7.725,6);
  });
  it("distinguishes loss, no change and unavailable estimates",()=>{
    expect(vegetationSummary(rectangle(-40,-6)).metric).toBe("-40 ha");
    expect(vegetationSummary(rectangle(-40,-6)).direction).toBe("loss");
    expect(vegetationSummary(rectangle(0,0)).direction).toBe("stable");
    const missing=vegetationSummary({...rectangle(1,1),properties:{changeHa:null,changePct:null}});
    expect(missing.metric).toBe("Change unavailable");
    expect(missing.direction).toBe("unknown");
  });
});
describe("Citizen education quality",()=>{
  it("ships twelve structured lessons across the seven useful categories, with named sources",()=>{
    expect(citizenLessons.length).toBeGreaterThanOrEqual(12);
    expect(citizenCategories).toHaveLength(8);
    const represented=new Set(citizenLessons.map(item=>item.category));
    for(const category of citizenCategories.filter(x=>x!=="All topics")){
      expect(represented.has(category)).toBe(true);
    }
    const ids=new Set(citizenLessons.map(x=>x.id));
    expect(ids.size).toBe(citizenLessons.length);
    for(const lesson of citizenLessons){
      expect(citizenCategories.includes(lesson.category)).toBe(true);
      expect(lesson.summary.length).toBeGreaterThan(25);
      expect(lesson.sections.length).toBeGreaterThanOrEqual(4);
      expect(lesson.sections.every(section=>section.heading.length>7&&section.body.length>70)).toBe(true);
      expect(lesson.graphic).toBeTruthy();
      expect(lesson.example.title.length).toBeGreaterThan(7);
      expect(lesson.example.body.length).toBeGreaterThan(60);
      expect(lesson.terms.length).toBeGreaterThanOrEqual(2);
      expect(lesson.avoid.length).toBeGreaterThan(30);
      expect(lesson.actions.length).toBeGreaterThanOrEqual(3);
      expect(lesson.choices).toHaveLength(3);
      expect(lesson.correct).toBeGreaterThanOrEqual(0);
      expect(lesson.correct).toBeLessThan(lesson.choices.length);
      expect(lesson.source.name).toBeTruthy();
      expect(lesson.source.url.startsWith("https://")).toBe(true);
    }
  });
  it("does not give unsafe emergency instructions or imply official certification",()=>{
    const flood=citizenLessons.find(item=>item.id==="flood");
    const warning=citizenLessons.find(item=>item.id==="warning");
    expect(flood?.avoid).toMatch(/never cross floodwater/i);
    expect(warning?.remember).toMatch(/verify/i);
    expect(citizenLessons.every(item=>item.source.url.startsWith("https://"))).toBe(true);
  });
    it("teaches NDVI uncertainty rather than guaranteeing restoration",()=>{
    const lesson=citizenLessons.find(x=>x.id==="ndvi");
    expect(lesson?.remember).toContain("verify on the ground");
    expect(lesson?.summary).toContain("NDVI");
  });
});
