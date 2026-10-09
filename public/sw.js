// CARE-Map service worker v2. Never cache authenticated pages or API responses.
// Preserve offline report shell and immutable Next.js assets for field workflows.
const SHELL_CACHE="care-map-report-shell-v2";
const ASSET_CACHE="care-map-static-assets-v2";
const CACHES=new Set([SHELL_CACHE,ASSET_CACHE]);

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    try {
      const response=await fetch(new Request("/report",{credentials:"omit",cache:"reload"}));
      if(response.ok)await cache.put("/report",response);
    }catch{ /* First installation can proceed without an offline shell. */ }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("care-map-")&&!CACHES.has(key)).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Public report form only; no query strings or user-specific content.
  if(request.mode==="navigate"){
    if(url.pathname!=="/report"||url.search)return;
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){
          const cache=await caches.open(SHELL_CACHE);
          await cache.put("/report",response.clone());
        }
        return response;
      }catch{
        const cached=await caches.match("/report");
        return cached||Response.error();
      }
    })());
    return;
  }
  // Content-hashed build assets are safe to cache and needed by the offline form.
  if(url.pathname.startsWith("/_next/static/")){
    event.respondWith((async()=>{
      const cached=await caches.match(request);
      if(cached)return cached;
      const response=await fetch(request);
      if(response.ok){
        const cache=await caches.open(ASSET_CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    })());
  }
  // All /api, /staff, /setup, login and other traffic stays network-only.
});
