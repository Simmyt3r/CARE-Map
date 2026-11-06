import {describe,expect,it} from "vitest";
import fs from "node:fs";
import path from "node:path";

// Keep product/source documentation independent from any one programme identity.
const oldProgrammeName=new RegExp(["ac","re","sal"].join(""),"i");
const roots=["src","docs","tests","scripts","db"];
const extensions=new Set([".ts",".tsx",".js",".mjs",".md",".sql",".json",".yml",".css"]);
function collect(dir:string):string[]{
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
    const filename=path.join(dir,item.name);
    if(item.isDirectory())return collect(filename);
    return item.isFile()&&extensions.has(path.extname(filename))?[filename]:[];
  });
}
describe("Generic climate-platform identity",()=>{
  it("does not contain previous programme branding in shipped files or documentation",()=>{
    const files=[...roots.flatMap(collect),"README.md",".env.example"];
    const found=files.filter(filename=>oldProgrammeName.test(fs.readFileSync(filename,"utf8")));
    expect(found).toEqual([]);
  });
});
