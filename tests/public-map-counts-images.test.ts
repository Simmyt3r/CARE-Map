import {describe,expect,it} from "vitest";
import {emptyPublicMapCounts,summarizePublicMapCounts} from "../src/lib/map-public-counts";
import {safePublicMapImageUrl,publicMapCaption} from "../src/lib/public-map-images";

describe("Public CARE-Map filter totals",()=>{
 it("keeps published satellite comparisons separate from intervention/resource totals",()=>{
   expect(summarizePublicMapCounts([
    {kind:"borehole",total:3},{kind:"asset",total:"2"},
    {kind:"forest_site",total:5},{kind:"river",total:1},
    {kind:"ndvi_change",total:12}
   ])).toEqual({
     counts:{borehole:3,asset:2,forest_site:5,river:1,ndvi_change:12},
     physicalTotal:11,satelliteTotal:12
   });
 });
 it("reports zero accurately and rejects unexpected count keys or malformed values",()=>{
   expect(emptyPublicMapCounts()).toEqual({
     borehole:0,asset:0,forest_site:0,river:0,ndvi_change:0
   });
   const result=summarizePublicMapCounts([
     {kind:"private_report",total:300},
     {kind:"asset",total:"not a number"},
     {kind:"river",total:-1}
   ]);
   expect(result.physicalTotal).toBe(0);
   expect(result.satelliteTotal).toBe(0);
 });
});

describe("Public resource image safety",()=>{
 it("allows HTTPS Cloudinary resource gallery images",()=>{
   const url="https://res.cloudinary.com/care-map-example/image/upload/v12345/care-map/assets/record/photo.jpg";
   expect(safePublicMapImageUrl(url)).toBe(url);
 });
 it("does not emit external, insecure, credentialed, script or transformed URL variants",()=>{
   for(const url of [
    "http://res.cloudinary.com/demo/image/upload/photo.jpg",
    "https://evil.example.com/image/upload/photo.jpg",
    "https://res.cloudinary.com.evil.example.com/demo/image/upload/photo.jpg",
    "https://res.cloudinary.com/demo/raw/upload/file.pdf",
    "javascript:alert(1)",
    "https://res.cloudinary.com/demo/image/upload/photo.jpg?redirect=https://bad.example",
    "https://name:secret@res.cloudinary.com/demo/image/upload/photo.jpg"
   ])expect(safePublicMapImageUrl(url)).toBeNull();
 });
 it("shortens and cleans optional photo captions",()=>{
   expect(publicMapCaption("  Before repair\n  Site 1  ")).toBe("Before repair   Site 1");
   expect(publicMapCaption(" ")).toBeNull();
   expect(publicMapCaption(null)).toBeNull();
   expect(publicMapCaption("x".repeat(200))?.length).toBe(120);
 });
});
