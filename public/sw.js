const VERSION="v2";
const SHELL_CACHE="care-map-shell-"+VERSION;
const STATIC_CACHE="care-map-static-"+VERSION;
const PUBLIC_SHELL=["/","/report","/offline.html","/manifest.webmanifest","/icon.svg"];

function sameOrigin(url){
  return url.origin===self.location.origin;
}

function sensitivePath(pathname){
  return pathname.startsWith("/api/")||
    pathname.startsWith("/staff")||
    pathname.startsWith("/my-reports")||
    pathname.startsWith("/login")||
    pathname.startsWith("/register");
}

function publicNavigation(pathname){
  return pathname==="/"||pathname==="/report"||pathname==="/offline.html";
}

function staticAsset(pathname){
  return pathname.startsWith("/_next/static/")||
    pathname==="/manifest.webmanifest"||
    pathname==="/icon.svg";
}

function cacheableResponse(response){
  return response&&response.ok&&response.type==="basic";
}

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache=>cache.addAll(PUBLIC_SHELL))
      .then(()=>self.skipWaiting())
      .catch(()=>{})
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys
        .filter(key=>key!==SHELL_CACHE&&key!==STATIC_CACHE)
        .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  const url=new URL(request.url);

  // Never intercept or cache third-party resources such as map tiles.
  if(!sameOrigin(url))return;

  // Never cache authenticated/API surfaces or authentication pages.
  if(sensitivePath(url.pathname))return;

  if(request.mode==="navigate"){
    if(!publicNavigation(url.pathname))return;
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(cacheableResponse(response)){
            const copy=response.clone();
            caches.open(SHELL_CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
          }
          return response;
        })
        .catch(async()=>{
          return (await caches.match(request))||
            (await caches.match(url.pathname))||
            (await caches.match("/offline.html"))||
            Response.error();
        })
    );
    return;
  }

  if(staticAsset(url.pathname)){
    event.respondWith(
      caches.match(request).then(cached=>{
        const network=fetch(request).then(response=>{
          if(cacheableResponse(response)){
            const copy=response.clone();
            caches.open(STATIC_CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
          }
          return response;
        });
        return cached||network;
      })
    );
  }
});
