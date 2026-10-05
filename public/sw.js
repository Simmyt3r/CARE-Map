const CACHE="care-map-v1";const SHELL=["/","/report","/login","/register"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{})));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});return r;}).catch(()=>caches.match(event.request)));});
