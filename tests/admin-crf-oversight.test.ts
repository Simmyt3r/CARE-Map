import {beforeEach,describe,expect,it,vi} from "vitest";
import {query,pool} from "@/lib/db";
import {getSession} from "@/lib/auth";
import {crfAccess,canCrf} from "../src/lib/crf";
import {GET as getField,POST as postField} from "../src/app/api/crf/field/route";

vi.mock("@/lib/db",()=>({query:vi.fn(),pool:vi.fn()}));
vi.mock("@/lib/auth",()=>({getSession:vi.fn()}));

const user={
 sub:"00000000-0000-4000-8000-000000000001",
 email:"admin@example.test",name:"Administrator"
};
const empty=()=>({rows:[],rowCount:0});
describe("Administrator CRF visibility without financial write bypass",()=>{
 beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(query).mockImplementation(async()=>empty() as never);
 });

 it("recognizes active administrators for oversight even without CRF duty grants",async()=>{
  const access=await crfAccess({...user,role:"admin"});
  expect(access).toEqual({userId:user.sub,roles:[],adminReadAll:true});
  expect(canCrf(access!.roles,"finance")).toBe(false);
  expect(canCrf(access!.roles,"verify")).toBe(false);
 });
 it("does not grant CRF visibility to staff without independent duty assignment",async()=>{
  expect(await crfAccess({...user,role:"staff"})).toBeNull();
  expect(await crfAccess({...user,role:"registered_community"})).toBeNull();
 });
 it("lets an administrator read confidential field records without a finance role",async()=>{
  vi.mocked(getSession).mockResolvedValue({...user,role:"admin"});
  const response=await getField();
  expect(response.status).toBe(200);
  const body=await response.json();
  expect(body.roles).toEqual([]);
  expect(body.data).toEqual({inspections:[],assets:[],actions:[]});
 });
 it("prevents an administrator with no CRF duty from verifying records",async()=>{
  vi.mocked(getSession).mockResolvedValue({...user,role:"admin"});
  const response=await postField(new Request("https://care-map.example.test/api/crf/field",{
   method:"POST",
   headers:{"Origin":"https://care-map.example.test","Content-Type":"application/json"},
   body:JSON.stringify({
     action:"verify_inspection",
     inspectionId:"00000000-0000-4000-8000-000000000002",
     decision:"verified"
   })
  }));
  expect(response.status).toBe(403);
  expect(await response.text()).toContain("CRF_FORBIDDEN");
  expect(pool).not.toHaveBeenCalled();
 });
 it("leaves independently authorized CRF staff duties intact",async()=>{
  vi.mocked(query).mockResolvedValueOnce({
   rows:[{crf_role:"finance_officer"}]
  } as never);
  expect(await crfAccess({...user,role:"staff"})).toEqual({
   userId:user.sub,roles:["finance_officer"],adminReadAll:false
  });
 });
});
