const CACHE='partyposs-v2-woodland';
const FILES=['./','./index.html','./style.css','./adventure.css','./game.js','./core.js','./world.js','./adventure.js','./art.js','./manifest.webmanifest','./assets/meadow.webp','./assets/partyposs.webp','./assets/partyposs-attack.webp','./assets/balls.webp','./assets/effects.webp','./assets/icon.png','./assets/critters-a.webp','./assets/critters-b.webp','./assets/trail-map.webp'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('partyposs-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const clone=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request,clone));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||new Response('Offline: open the game once while connected to save it on this device.',{status:503}))));
});
