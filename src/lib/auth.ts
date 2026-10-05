import {cookies} from "next/headers";
import {jwtVerify,SignJWT} from "jose";
export type Role="registered_community"|"staff"|"admin";
export type Session={sub:string;email:string;name:string;role:Role};
const COOKIE="caremap_session";
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32) throw new Error("SESSION_SECRET must be at least 32 characters");return new TextEncoder().encode(value);}
export async function createSessionToken(session:Session){return new SignJWT({email:session.email,name:session.name,role:session.role}).setProtectedHeader({alg:"HS256"}).setSubject(session.sub).setIssuedAt().setExpirationTime("12h").sign(secret());}
export async function setSessionCookie(token:string){const jar=await cookies();jar.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:43200});}
export async function clearSessionCookie(){const jar=await cookies();jar.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});}
export async function getSession():Promise<Session|null>{
 const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;
 try{const {payload}=await jwtVerify(token,secret());if(!payload.sub||!payload.email||!payload.name||!payload.role)return null;
 return {sub:payload.sub,email:String(payload.email),name:String(payload.name),role:payload.role as Role};}catch{return null;}
}
export function isStaff(s:Session|null):s is Session{return !!s&&(s.role==="staff"||s.role==="admin");}
export function isAdmin(s:Session|null):s is Session{return !!s&&s.role==="admin";}
