import {describe,expect,it} from "vitest";
import {
  englishCatalog,
  mergeCatalog,
  normalizeLocale,
  requiredTranslationKeys,
  validateTranslationMap
} from "../src/lib/i18n";

describe("localization helpers",()=>{
  it("normalizes supported public locales and falls back to English",()=>{
    expect(normalizeLocale("TIV")).toBe("tiv");
    expect(normalizeLocale("idoma")).toBe("idoma");
    expect(normalizeLocale("unknown")).toBe("en");
  });

  it("rejects unknown keys and reports coverage",()=>{
    const result=validateTranslationMap({
      "nav.publicMap":"Example",
      "made.up.key":"Nope"
    });
    expect(result.translations["nav.publicMap"]).toBe("Example");
    expect(result.unknown).toContain("made.up.key");
    expect(result.missing.length).toBe(requiredTranslationKeys.length-1);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(100);
  });

  it("requires every public key for a complete reviewed pack",()=>{
    const full=Object.fromEntries(requiredTranslationKeys.map(k=>[k,"Translated "+k]));
    const result=validateTranslationMap(full);
    expect(result.coverage).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("merges reviewed entries over safe English fallback",()=>{
    const merged=mergeCatalog({"nav.publicMap":"Map translated"});
    expect(merged["nav.publicMap"]).toBe("Map translated");
    expect(merged["nav.reportIssue"]).toBe(englishCatalog["nav.reportIssue"]);
  });
});
