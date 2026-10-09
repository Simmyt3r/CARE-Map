import {randomUUID} from "node:crypto";

/**
 * CARE-Map server-side photo storage. All credentials stay in Vercel server
 * environment variables; the browser sends a file to its authorized CARE-Map API.
 *
 * Cloudinary's standard "upload" delivery type produces an unguessable but public
 * secure_url. Do not upload personal identifiers or confidential evidence.
 */
const MAX_FILE_BYTES=4*1024*1024;
const MIME_TYPES=new Set(["image/jpeg","image/png","image/webp"]);

export function cloudinaryIsConfigured(){
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

export class PhotoStorageError extends Error {
  constructor(message:string,public readonly status=400){
    super(message);
    this.name="PhotoStorageError";
  }
}

function detectImageType(bytes:Uint8Array):string|null{
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return "image/jpeg";
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return "image/png";
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";
  return null;
}

export async function uploadPhotoToCloudinary(file:File,category:string,entityId:string){
  if(!cloudinaryIsConfigured()){
    throw new PhotoStorageError("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in Vercel Production and redeploy.",503);
  }
  if(!MIME_TYPES.has(file.type))throw new PhotoStorageError("Only JPEG, PNG and WebP images are allowed.");
  if(file.size<1||file.size>MAX_FILE_BYTES)throw new PhotoStorageError("Image must be between 1 byte and 4 MB.");
  if(!/^[a-z0-9-]{2,40}$/.test(category))throw new PhotoStorageError("Invalid photo category.");
  if(!/^[a-f0-9-]{36}$/i.test(entityId))throw new PhotoStorageError("Invalid photo record ID.");

  const bytes=new Uint8Array(await file.arrayBuffer());
  if(detectImageType(bytes)!==file.type)throw new PhotoStorageError("Image format does not match the file contents.");
  const cloud=process.env.CLOUDINARY_CLOUD_NAME!.trim();
  const key=process.env.CLOUDINARY_API_KEY!.trim();
  const secret=process.env.CLOUDINARY_API_SECRET!.trim();
  if(!/^[a-zA-Z0-9_-]+$/.test(cloud))throw new PhotoStorageError("Invalid CLOUDINARY_CLOUD_NAME setting.",503);
  const suffix=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
  const publicId="care-map/"+category+"/"+entityId+"/"+randomUUID();

  const form=new FormData();
  form.set("file",new Blob([await file.arrayBuffer()],{type:file.type}),"photo."+suffix);
  form.set("public_id",publicId);
  form.set("overwrite","false");
  const basic=Buffer.from(key+":"+secret).toString("base64");

  let response:Response;
  try{
    response=await fetch("https://api.cloudinary.com/v1_1/"+cloud+"/image/upload",{
      method:"POST",
      headers:{"Authorization":"Basic "+basic},
      body:form,
      cache:"no-store",
      signal:AbortSignal.timeout(45_000)
    });
  }catch{
    throw new PhotoStorageError("Cloudinary could not be reached. Check connectivity and retry.",502);
  }
  if(!response.ok){
    // Never forward raw third-party messages, which might contain identifiers or secrets.
    throw new PhotoStorageError(
      response.status===401||response.status===403
        ?"Cloudinary authorization failed. Check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in Vercel."
        :"Cloudinary upload failed (HTTP "+response.status+"). Check your Cloudinary account limits and settings.",
      502
    );
  }
  const result=await response.json().catch(()=>null) as {secure_url?:unknown;public_id?:unknown;resource_type?:unknown}|null;
  if(typeof result?.secure_url!=="string"||typeof result.public_id!=="string"||result.resource_type!=="image"){
    throw new PhotoStorageError("Cloudinary returned an unexpected upload result.",502);
  }
  let address:URL;
  try{address=new URL(result.secure_url);}catch{throw new PhotoStorageError("Cloudinary returned an invalid image URL.",502);}
  if(address.protocol!=="https:"||address.hostname!=="res.cloudinary.com"||!address.pathname.startsWith("/"+cloud+"/image/upload/")){
    throw new PhotoStorageError("Cloudinary returned an unrecognized secure image URL.",502);
  }
  return {url:result.secure_url,publicId:result.public_id};
}
