// Pure walking-game rules. Exact GPS positions are never written to a save.
export const INTERACTION_METERS = 80;
export const STOP_COOLDOWN = 5 * 60 * 1000;
export const SPAWN_LIFETIME = 15 * 60 * 1000;
export const WALK_SAVE_KEY = 'woodland-walk-v1';
const rad = degrees => degrees * Math.PI / 180;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
export const validPoint = p => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 85 && Math.abs(p.lng) <= 180;
export function distance(a, b) {
  if (!validPoint(a) || !validPoint(b)) return Infinity;
  const lat = rad(b.lat - a.lat), lng = rad(b.lng - a.lng);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(lng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function offset(p, east, north) {
  return {lat: p.lat + north / 111195, lng: p.lng + east / (111195 * Math.cos(rad(p.lat)))};
}
export function bearing(a, b) {
  const lng = rad(b.lng - a.lng);
  return (Math.atan2(Math.sin(lng) * Math.cos(rad(b.lat)), Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(lng)) * 180 / Math.PI + 360) % 360;
}
export const distanceLabel = meters => !Number.isFinite(meters) ? 'Finding you…' : meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
export function hash(text) {
  let h = 2166136261;
  for (const character of String(text)) h = Math.imul(h ^ character.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function interactionStatus(position, point, mode, now = Date.now()) {
  if (!validPoint(position)) return {ok:false, reason:'Find your position first.'};
  if (mode !== 'demo') {
    if (!Number.isFinite(position.time) || now - position.time > 45000) return {ok:false, reason:'Waiting for a fresh GPS fix.'};
    if (!Number.isFinite(position.accuracy) || position.accuracy > 100) return {ok:false, reason:'GPS is uncertain. Try a clearer view of the sky.'};
    if (position.speed > 6) return {ok:false, reason:'Moving quickly. Stop somewhere safe to play.'};
  }
  const meters = distance(position, point);
  return meters <= INTERACTION_METERS ? {ok:true, meters, reason:'Within reach'} : {ok:false, meters, reason:`${distanceLabel(meters)} away · come within ${INTERACTION_METERS} m`};
}
export function normalizeWalk(raw, now = Date.now()) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const recent = source => Object.fromEntries(Object.entries(source && typeof source === 'object' ? source : {}).filter(([id,time]) => /^[a-z0-9:_-]{1,90}$/i.test(id) && Number.isFinite(time) && time <= now && now - time < 86400000).slice(-300));
  return {version:1, stops:recent(p.stops), caught:recent(p.caught), lodges:Array.isArray(p.lodges) ? [...new Set(p.lodges.filter(id => typeof id === 'string' && /^[a-z0-9:_-]{1,90}$/i.test(id)))].slice(-300) : [], spins:clamp(Math.floor(Number(p.spins) || 0),0,1e7), meters:clamp(Number(p.meters) || 0,0,1e8), walkRewards:clamp(Math.floor(Number(p.walkRewards) || 0),0,1e7)};
}
export const cooldownRemaining = (id, progress, now = Date.now()) => Math.max(0, (progress.stops[id] || 0) + STOP_COOLDOWN - now);
export function spinStop(point, position, mode, progress, profile, now = Date.now()) {
  const status = interactionStatus(position, point, mode, now);
  if (!status.ok) return status;
  if (!point || !['stop','camp'].includes(point.kind)) return {ok:false, reason:'This is not a supply stop.'};
  if (cooldownRemaining(point.id, progress, now)) return {ok:false, reason:'This stop is restocking.'};
  progress.stops[point.id] = now; progress.spins++;
  profile.berries = Math.min(99, profile.berries + 3);
  profile.ultras = Math.min(99, profile.ultras + 1);
  profile.potions = Math.min(99, profile.potions + 1);
  profile.coins += 25; profile.xp += 50;
  return {ok:true, reason:'+3 story cards · +1 Golden Woggle · +1 tonic · +25 coins · +50 XP'};
}
export function walkSegment(previous, next) {
  if (!validPoint(previous) || !validPoint(next) || previous.accuracy > 45 || next.accuracy > 45) return 0;
  const seconds = (next.time - previous.time) / 1000, meters = distance(previous, next);
  if (seconds <= 0 || seconds > 90 || next.speed > 6 || meters / seconds > 6 || meters < Math.max(8, Math.min(previous.accuracy, next.accuracy))) return 0;
  return meters;
}
export function makeSpawns(position, species, progress, now = Date.now()) {
  if (!validPoint(position) || !species.length) return [];
  const slot = Math.floor(now / SPAWN_LIFETIME), row = Math.floor(position.lat / .0008), col = Math.floor(position.lng / .001);
  const result = [];
  for (let y = row - 3; y <= row + 3; y++) for (let x = col - 3; x <= col + 3; x++) {
    const seed = hash(`${y}:${x}:${slot}`);
    if (seed % 3 === 0) continue;
    const point = {lat:(y + .25 + (seed % 50) / 100) * .0008, lng:(x + .25 + ((seed >>> 8) % 50) / 100) * .001};
    const id = `wild-${hash(`${y}:${x}`)}-${slot}`;
    if (progress.caught[id]) continue;
    result.push({...point,id,kind:'critter',species:species[seed % species.length],level:3 + seed % 7,expires:(slot + 1) * SPAWN_LIFETIME});
  }
  return result.sort((a,b) => distance(a,position) - distance(b,position)).slice(0,16);
}
export function landmarkQuery(position) {
  // A rounded area is sufficient; no exact GPS fix is sent to the landmark service.
  const lat = position.lat.toFixed(2), lng = position.lng.toFixed(2);
  const around = `(around:1800,${lat},${lng})`;
  return `[out:json][timeout:18];(node${around}["tourism"~"^(picnic_site|viewpoint|artwork|information)$"]["access"!~"^(private|no|customers)$"];node${around}["amenity"~"^(shelter|drinking_water|bench)$"]["access"!~"^(private|no|customers)$"];node${around}["historic"="memorial"]["access"!~"^(private|no|customers)$"];nwr${around}["leisure"="park"]["access"!~"^(private|no|customers)$"];);out center 90;`;
}
export function parseLandmarks(data, position) {
  const result = [];
  for (const element of Array.isArray(data?.elements) ? data.elements : []) {
    const tags = element.tags || {}, point = {lat:element.lat ?? element.center?.lat, lng:element.lon ?? element.center?.lon};
    if (!validPoint(point) || !Number.isFinite(element.id) || !['node','way','relation'].includes(element.type) || /^(private|no|customers)$/.test(tags.access) || distance(position,point) > 2600) continue;
    const park = tags.leisure === 'park', lodge = park || tags.tourism === 'viewpoint' || tags.amenity === 'shelter' || hash(`${element.type}-${element.id}`) % 6 === 0;
    const label = tags.name || (park ? 'Park clearing' : tags.tourism === 'information' ? 'Trail information' : tags.amenity === 'drinking_water' ? 'Water station' : tags.amenity === 'bench' ? 'Trail bench' : tags.historic === 'memorial' ? 'Memorial' : tags.tourism === 'artwork' ? 'Public art' : tags.tourism === 'picnic_site' ? 'Picnic clearing' : 'Trail shelter');
    result.push({...point,id:`osm-${element.type}-${element.id}`,kind:lodge?'lodge':'stop',name:String(label).slice(0,100),source:'OpenStreetMap landmark',osmURL:`https://www.openstreetmap.org/${element.type}/${element.id}`});
  }
  return result.sort((a,b) => distance(a,position)-distance(b,position)).filter((p,i,list) => !list.slice(0,i).some(other => distance(p,other)<22)).slice(0,32);
}
export function demoFeatures() {
  const center = {lat:0,lng:0};
  return [
    {...offset(center,30,25),id:'demo-stop-1',kind:'stop',name:'Pinecone Supply Stop',source:'Practice grove'},
    {...offset(center,-140,190),id:'demo-stop-2',kind:'stop',name:'Lakeside Supply Stop',source:'Practice grove'},
    {...offset(center,125,145),id:'demo-lodge-1',kind:'lodge',name:'Tall Pines Lodge',source:'Practice grove'},
    {...offset(center,-130,-100),id:'demo-lodge-2',kind:'lodge',name:'Fellowship Lodge',source:'Practice grove'},
    {...offset(center,-30,50),id:'demo-critter-fox',kind:'critter',species:'fox',level:4},
    {...offset(center,85,-30),id:'demo-critter-beaver',kind:'critter',species:'beaver',level:4},
    {...offset(center,50,150),id:'demo-critter-owl',kind:'critter',species:'owl',level:6},
    {...offset(center,-165,60),id:'demo-critter-bear',kind:'critter',species:'bear',level:7},
    {...offset(center,-60,245),id:'demo-critter-bobwhite',kind:'critter',species:'bobwhite',level:5},
    {...offset(center,180,40),id:'demo-critter-antelope',kind:'critter',species:'antelope',level:7},
    {...offset(center,170,240),id:'demo-critter-eagle',kind:'critter',species:'eagle',level:8},
    {...offset(center,-230,185),id:'demo-critter-buffalo',kind:'critter',species:'buffalo',level:8}
  ];
}
