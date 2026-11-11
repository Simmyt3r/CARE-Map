import {cookies} from "next/headers";
import {jwtVerify,SignJWT} from "jose";
import {query} from "@/lib/db";
export type Role="registered_community"|"staff"|"admin";
export type Session={sub:string;email:string;name:string;role:Role};
const COOKIE="caremap_session";
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32) throw new Error("SESSION_SECRET must be at least 32 characters");return new TextEncoder().encode(value);}
export async function createSessionToken(session:Session){return new SignJWT({email:session.email,name:session.name,role:session.role}).setProtectedHeader({alg:"HS256"}).setSubject(session.sub).setIssuedAt().setExpirationTime("12h").sign(secret());}
export async function setSessionCookie(token:string){const jar=await cookies();jar.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:43200});}
export async function clearSessionCookie(){const jar=await cookies();jar.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});}
async function sessionFromToken(token:string|undefined):Promise<Session|null>{
 if(!token)return null;
 try{
   const {payload}=await jwtVerify(token,secret());
   if(!payload.sub)return null;
   const current=await query<{id:string;email:string;name:string;role:Role}>(
     "SELECT id,email,name,role FROM users WHERE id=$1 AND active=TRUE AND deleted_at IS NULL",
     [payload.sub]
   );
   const user=current.rows[0];
   if(!user)return null;
   return {sub:user.id,email:user.email,name:user.name,role:user.role};
 }catch{return null;}
}
export async function getSession():Promise<Session|null>{
 return sessionFromToken((await cookies()).get(COOKIE)?.value);
}
/** Proxy reads the request cookie directly instead of relying on server-component context. */
export async function getSessionFromRequest(request:{cookies:{get:(name:string)=>{value:string}|undefined}}):Promise<Session|null>{
 return sessionFromToken(request.cookies.get(COOKIE)?.value);
}
export function isStaff(s:Session|null):s is Session{return !!s&&(s.role==="staff"||s.role==="admin");}
export function isAdmin(s:Session|null):s is Session{return !!s&&s.role==="admin";}
