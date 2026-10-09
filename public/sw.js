// CARE-Map service worker v2.
// Never cache authenticated pages, API responses, Next.js bundles or navigations.
// Clear caches created by the previous all-GET caching worker.
const CACHE="care-map-public-v2";
const PUBLIC_SHELL=["/","/report","/login","/register"];
self.addEventListener("install",event=>{
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("care-map-")).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Network-only for every sensitive or versioned application request.
  if(request.mode==="navigate"||
     url.pathname.startsWith("/api/")||
     url.pathname.startsWith("/staff")||
     url.pathname.startsWith("/_next/")||
     url.pathname.startsWith("/setup")||
     url.pathname.startsWith("/login")||
     url.pathname.startsWith("/register"))return;
  // Static assets should come from the network. No unbounded cache.
});
