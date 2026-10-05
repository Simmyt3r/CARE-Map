import {describe,expect,it} from "vitest";
import {levelForScore,maintenanceRisk} from "../src/lib/risk";
describe("risk scoring",()=>{
 it("maps score bands",()=>{expect(levelForScore(10)).toBe("low");expect(levelForScore(40)).toBe("medium");expect(levelForScore(65)).toBe("high");expect(levelForScore(90)).toBe("critical");});
 it("prioritizes broken infrastructure",()=>{const r=maintenanceRisk("non_functional","2025-01-01",new Date("2026-10-05"));expect(r.score).toBe(100);expect(r.level).toBe("critical");});
 it("keeps recently maintained functional assets low",()=>{const r=maintenanceRisk("functional","2026-09-20",new Date("2026-10-05"));expect(r.level).toBe("low");});
});
