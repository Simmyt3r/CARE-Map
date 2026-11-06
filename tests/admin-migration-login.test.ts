import bcrypt from "bcryptjs";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {query} from "@/lib/db";
import {createSessionToken,setSessionCookie} from "@/lib/auth";
import {POST} from "../src/app/api/auth/login/route";

vi.mock("@/lib/db",()=>({query:vi.fn()}));
vi.mock("@/lib/auth",()=>({
  createSessionToken:vi.fn(async()=> "signed-session"),
  setSessionCookie:vi.fn(async()=>{})
}));

const password="test-admin-password-123";
const user={
  id:"00000000-0000-4000-8000-000000000001",
  email:"admin@example.test",name:"Administrator",role:"admin" as const,
  password_hash:""
};
let ipIndex=0;
function loginRequest(pass=password){
  return new Request("https://care-map.example.test/api/auth/login",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-forwarded-for":"198.51.100."+(++ipIndex)},
    body:JSON.stringify({email:user.email,password:pass})
  });
}

describe("admin login before migrations",()=>{
  beforeEach(async()=>{
    vi.clearAllMocks();
    user.password_hash=await bcrypt.hash(password,4);
  });

  it("signs in existing admin even when migration 003 has not created last_login_at",async()=>{
    const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
    vi.mocked(query)
      .mockResolvedValueOnce({rows:[user]} as never)
      .mockRejectedValueOnce(Object.assign(new Error("secret DB details"),{code:"42703"}));
    const response=await POST(loginRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).user.role).toBe("admin");
    expect(createSessionToken).toHaveBeenCalledWith(expect.objectContaining({role:"admin",sub:user.id}));
    expect(setSessionCookie).toHaveBeenCalledWith("signed-session");
    expect(warn).toHaveBeenCalledWith(
      "Login timestamp unavailable until migration 003 is applied",{code:"42703"}
    );
    warn.mockRestore();
  });

  it("records login time on fully migrated databases",async()=>{
    vi.mocked(query)
      .mockResolvedValueOnce({rows:[user]} as never)
      .mockResolvedValueOnce({rowCount:1,rows:[]} as never);
    const response=await POST(loginRequest());
    expect(response.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(2,"UPDATE users SET last_login_at=now() WHERE id=$1",[user.id]);
  });

  it("does not convert other database failures into successful sessions",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    vi.mocked(query)
      .mockResolvedValueOnce({rows:[user]} as never)
      .mockRejectedValueOnce(Object.assign(new Error("private connection string"),{code:"08006"}));
    const response=await POST(loginRequest());
    expect(response.status).toBe(503);
    const body=await response.text();
    expect(body).toContain("LOGIN_SERVICE_UNAVAILABLE");
    expect(body).not.toContain("private connection string");
    expect(createSessionToken).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("returns a safe error when the users table is absent or unreachable",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error("private schema name"),{code:"42P01"}));
    const response=await POST(loginRequest());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private schema name");
    expect(setSessionCookie).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("never signs in an unknown user or wrong password",async()=>{
    vi.mocked(query).mockResolvedValueOnce({rows:[]} as never);
    const missing=await POST(loginRequest());
    expect(missing.status).toBe(401);
    vi.mocked(query).mockResolvedValueOnce({rows:[user]} as never);
    const wrong=await POST(loginRequest("wrong-pass-abc"));
    expect(wrong.status).toBe(401);
    expect(createSessionToken).not.toHaveBeenCalled();
  });
});
