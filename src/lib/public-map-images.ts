/**
 * A map popup may display only public resource-gallery images from the
 * established Cloudinary upload path. Never include reports, private
 * extension evidence or arbitrary external media here.
 */
export function safePublicMapImageUrl(value:unknown):string|null{
  if(typeof value!=="string"||value.length>1200)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=="https:"||url.hostname!=="res.cloudinary.com")return null;
    if(url.username||url.password||url.search||url.hash)return null;
    if(!/^\/[a-zA-Z0-9_-]+\/image\/upload\/[^?#]+$/.test(url.pathname))return null;
    return url.toString();
  }catch{return null;}
}
export function publicMapCaption(value:unknown):string|null{
  if(typeof value!=="string")return null;
  const caption=value.trim().replace(/[\r\n\t]+/g," ");
  return caption?caption.slice(0,120):null;
}
