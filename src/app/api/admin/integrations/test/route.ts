import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {checkCopernicusAuthentication} from "@/lib/remote-sensing";
import {cloudinaryIsConfigured} from "@/lib/photo-storage";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

type Provider="copernicus"|"cloudinary";
function respond(provider:Provider,ok:boolean,message:string,status=200){
  return NextResponse.json({provider,ok,message},{status,headers:{"Cache-Control":"no-store"}});
}

async function checkCloudinary(){
  if(!cloudinaryIsConfigured()){
    return {ok:false,message:"Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to Vercel Production."};
  }
  const cloud=process.env.CLOUDINARY_CLOUD_NAME!.trim();
  if(!/^[a-zA-Z0-9_-]+$/.test(cloud))return {ok:false,message:"Invalid Cloudinary cloud name."};
  const credentials=Buffer.from(process.env.CLOUDINARY_API_KEY!.trim()+":"+process.env.CLOUDINARY_API_SECRET!.trim()).toString("base64");
  try{
    const result=await fetch("https://api.cloudinary.com/v1_1/"+cloud+"/ping",{
      method:"GET",
      headers:{Authorization:"Basic "+credentials,Accept:"application/json"},
      cache:"no-store",
      signal:AbortSignal.timeout(12000)
    });
    if(result.status===401||result.status===403)return {ok:false,message:"Cloudinary rejected the API credentials. Review API key and secret."};
    if(!result.ok)return {ok:false,message:"Cloudinary returned HTTP "+result.status+". Check account status and service availability."};
    const data=await result.json().catch(()=>null) as {status?:string}|null;
    return data?.status==="ok"
      ?{ok:true,message:"Cloudinary API authentication successful. Test uploading a non-sensitive image next."}
      :{ok:false,message:"Cloudinary returned an unexpected ping response."};
  }catch{
    return {ok:false,message:"Could not reach the Cloudinary API. Check networking and try again."};
  }
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isAdmin(session)){
    return NextResponse.json({ok:false,message:"Administrator access required."},{status:403,headers:{"Cache-Control":"no-store"}});
  }
  // An API call invoked by a button should originate from the same site.
  const origin=request.headers.get("origin");
  if(!origin||origin!==new URL(request.url).origin){
    return NextResponse.json({ok:false,message:"Invalid request origin."},{status:403,headers:{"Cache-Control":"no-store"}});
  }
  const body=await request.json().catch(()=>null) as {provider?:unknown}|null;
  if(body?.provider!=="copernicus"&&body?.provider!=="cloudinary"){
    return NextResponse.json({ok:false,message:"Choose a supported integration."},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  const provider=body.provider;
  const result=provider==="copernicus"?await checkCopernicusAuthentication():await checkCloudinary();
  return respond(provider,result.ok,result.message,result.ok?200:503);
}
