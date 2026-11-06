import {NextRequest,NextResponse} from "next/server";
import {getSessionFromRequest,isStaff} from "@/lib/auth";
import {loadWorkspaceAccess} from "@/lib/workspace-access";
import {requiredWorkspaceAccess,canAccessAnyWorkspace} from "@/lib/workspaces";

export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 const required=requiredWorkspaceAccess(path,request.method);
 if(required===null)return NextResponse.next();

 const api=path.startsWith("/api/");
 const denied=(message:string,status=403)=>
   NextResponse.json({error:{code:"WORKSPACE_FORBIDDEN",message}},
     {status,headers:{"Cache-Control":"no-store"}});
 try{
  const session=await getSessionFromRequest(request);
  if(!isStaff(session)){
   if(api)return denied("Staff sign-in is required.",401);
   const login=new URL("/login",request.url);
   login.searchParams.set("next",path);
   return NextResponse.redirect(login);
  }
  if(session.role==="admin")return NextResponse.next();
  if(required==="admin"||!canAccessAnyWorkspace(session.role,await loadWorkspaceAccess(session),required)){
   if(api)return denied("This interface has not been assigned to your account.");
   return NextResponse.redirect(new URL("/staff?access=restricted",request.url));
  }
  return NextResponse.next();
 }catch(e){
  const code=e&&typeof e==="object"&&"code" in e?String(e.code):"UNAVAILABLE";
  console.error("Workspace authorization unavailable",{code});
  return api?denied("Access check is temporarily unavailable.",503):
    new NextResponse("Workspace access is temporarily unavailable.",{
      status:503,headers:{"Cache-Control":"no-store"}
    });
 }
}
export const config={matcher:[
 "/staff/:path*",
 "/api/admin/:path*",
 "/api/crf/:path*",
 "/api/extension/:path*",
 "/api/field-acceptance/:path*",
 "/api/gis/:path*",
 "/api/resources/:path*",
 "/api/reports/:path*",
 "/api/remote-sensing/:path*",
 "/api/dashboard/:path*",
 "/api/operations/:path*",
 "/api/predictions/:path*"
]};
