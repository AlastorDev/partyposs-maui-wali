import {profile,save,SPECIES,PATROL_IDS,makeUnit,rank,oakOpen} from './world.js';
import {artHTML} from './art.js';
import {icon} from './icons.js';
import {INTERACTION_METERS,WALK_SAVE_KEY,distance,offset,bearing,distanceLabel,hash,validPoint,interactionStatus,normalizeWalk,cooldownRemaining,spinStop,walkSegment,makeSpawns,landmarkQuery,parseLandmarks,demoFeatures} from './geo.js';

const L = window.L;
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let progress; try {progress=normalizeWalk(JSON.parse(localStorage.getItem(WALK_SAVE_KEY)));} catch {progress=normalizeWalk(null);}
let root,map,markers,player,reach,accuracyRing,tiles,artMap,routeLine,handlers={},position=null,walkAnchor=null,camp=null;
let mode='intro',visible=false,wantedGPS=false,watchId=null,watchGeneration=0,session=0,follow=true;
let features=[],landmarks=[],selected=null,encounterId=null,timer=null,busy=false,spinBusy=false,lastLookup=0,loading=false,loadAbort=null;
let mapMessage='',locationError='',lastArea='',locationPending=false;
const areaCache=new Map();
const $=selector=>root?.querySelector(selector);
const persist=()=>{progress=normalizeWalk(progress);try{localStorage.setItem(WALK_SAVE_KEY,JSON.stringify(progress));}catch{}};
const pointName=p=>p.kind==='critter'?SPECIES[p.species].name:p.name;
const pluralMedals=()=>`${progress.lodges.length} lodge ${progress.lodges.length===1?'medal':'medals'}`;

function buildRoot() {
  root=document.createElement('section');root.className='walking-view';root.setAttribute('aria-label','Walking map');
  root.innerHTML=`<div id="walking-map" class="walking-map" aria-label="Map of nearby critters, supply stops, and Patrol Lodges"></div>
    <div class="walk-top"><button class="walk-mode" data-walk="settings">${icon('signal')}<span id="walk-mode-label">YOUR NEXT ADVENTURE</span></button><button class="map-round" data-walk="settings" aria-label="Location and map settings">${icon('settings')}</button></div>
    <div class="walk-status" id="walk-status" role="status"></div>
    <div class="walk-tools"><button class="map-round" data-walk="center" aria-label="Center map on me">${icon('locate')}</button><button class="map-round" data-walk="zoom-in" aria-label="Zoom in">+</button><button class="map-round" data-walk="zoom-out" aria-label="Zoom out">−</button><button class="map-round book-tool" data-walk="book" aria-label="Open trail book campaign">${icon('book')}</button></div>
    <div class="walk-coach" id="walk-coach"><div class="walk-intro-mark">${icon('compass')}</div><span class="eyebrow">A LITTLE WONDER, WHEREVER YOU ARE</span><h2>Your neighborhood.<br>A whole new adventure.</h2><p>Walk with your patrol. Find critters, spin supply stops, and challenge a nearby Lodge.</p><button class="wood-button full" data-walk="gps">${icon('locate')} Use my location</button><button class="wood-button secondary full" data-walk="demo">Explore the practice grove</button><button class="trail-book-link" data-walk="book">Continue the trail book campaign →</button><p class="location-note">Location is optional and used while this map is open. Map services receive your nearby area. Stop walking before you interact.</p><p id="location-error" class="location-error" role="status"></p></div>
    <div class="demo-steps" id="demo-steps" hidden><span>DEMO STEPS</span><button data-walk="step" data-dir="north" aria-label="Demo step north">↑</button><button data-walk="step" data-dir="west" aria-label="Demo step west">←</button><button data-walk="step" data-dir="south" aria-label="Demo step south">↓</button><button data-walk="step" data-dir="east" aria-label="Demo step east">→</button></div>
    <div class="nearby-tray" id="nearby-tray" hidden><div class="nearby-heading"><div><span class="eyebrow">NEARBY</span><h2>A little off the beaten path.</h2></div><button data-walk="nearby" aria-label="See everything nearby">${icon('arrow')}</button></div><div class="nearby-items" id="nearby-items"></div><div class="walk-distance"><span>${icon('walk')} <b id="walk-distance">0 m walked</b></span><span id="walk-medals">0 lodge medals</span></div></div>
    <dialog id="walk-dialog" class="adventure-dialog walk-dialog"></dialog>`;
  root.addEventListener('click',onClick);
  let swipe=null;
  root.addEventListener('pointerdown',event=>{if(event.target.closest('.spin-disc'))swipe={x:event.clientX,id:event.pointerId};});
  root.addEventListener('pointerup',event=>{if(swipe&&swipe.id===event.pointerId&&Math.abs(event.clientX-swipe.x)>35)doSpin();swipe=null;});
  root.addEventListener('pointercancel',()=>{swipe=null;});
  $('#walk-dialog').addEventListener('close',()=>{selected=null;if(routeLine){map.removeLayer(routeLine);routeLine=null;}});
  new ResizeObserver(positionAttribution).observe($('#nearby-tray'));
}

function positionAttribution(){if(map)map.getContainer().style.setProperty('--map-attribution-bottom',`${$('#nearby-tray').hidden?8:$('#nearby-tray').offsetHeight+25}px`);}

export function mountWalking(container, callbacks) {
  handlers=callbacks;if(!root)buildRoot();if(root.parentNode!==container)container.replaceChildren(root);
  if(!map) {
    map=L.map($('#walking-map'),{zoomControl:false,attributionControl:true,minZoom:15,maxZoom:19,zoomSnap:.5,zoomDelta:.5}).setView([0,0],17);
    map.attributionControl.setPrefix(false);
    artMap=L.imageOverlay('./assets/trail-map.webp',[[-.0045,-.003],[.0045,.003]],{interactive:false}).addTo(map);
    markers=L.layerGroup().addTo(map);
    reach=L.circle([0,0],{radius:INTERACTION_METERS,color:'#f4fff0',weight:2,fillColor:'#c7e8b2',fillOpacity:.23,interactive:false}).addTo(map);
    accuracyRing=L.circle([0,0],{radius:0,color:'#557d78',weight:1,dashArray:'4 5',fillOpacity:.06,interactive:false}).addTo(map);
    player=L.marker([0,0],{interactive:false,zIndexOffset:1200,icon:L.divIcon({className:'player-marker',iconSize:[44,60],iconAnchor:[22,42],html:'<span class="avatar-shadow"></span><span class="scout-avatar"><i class="scout-hat"></i><i class="scout-head"></i><i class="scout-body"></i><i class="scout-scarf"></i><i class="scout-legs"></i></span>'})}).addTo(map);
    map.on('dragstart',()=>{follow=false;});
    root.dataset.mode=mode;
  }
  setWalkingVisible(true);if(position)refreshFeatures();else update();requestAnimationFrame(()=>map.invalidateSize({pan:false}));
}
export function setWalkingVisible(active) {
  visible=active;
  if(!root)return;
  if(active&&!document.hidden){timer ||= setInterval(tick,2000);if(mode==='live'&&wantedGPS&&watchId===null)watchLocation();}
  else {clearInterval(timer);timer=null;stopWatch();}
}
document.addEventListener('visibilitychange',()=>setWalkingVisible(visible));
window.addEventListener('pagehide',()=>{stopWatch();loadAbort?.abort();});
window.addEventListener('offline',()=>{if(root&&mode==='live'){mapMessage='You’re offline. Live map data needs a connection; the practice grove and trail book still work.';update();}});
window.addEventListener('online',()=>{if(root&&mode==='live'&&position){mapMessage='';lastLookup=0;void loadLandmarks();update();}});

function stopWatch() {watchGeneration++;if(watchId!==null)navigator.geolocation?.clearWatch(watchId);watchId=null;}
function clearSession() {
  session++;loadAbort?.abort();loading=false;stopWatch();walkAnchor=null;landmarks=[];features=[];camp=null;selected=null;encounterId=null;lastArea='';lastLookup=0;follow=true;locationError='';mapMessage='';
  if($('#walk-dialog').open)$('#walk-dialog').close();
  if(routeLine){map.removeLayer(routeLine);routeLine=null;}
}
function startDemo() {
  clearSession();mode='demo';wantedGPS=false;locationPending=false;position={lat:0,lng:0,accuracy:0,speed:0,time:Date.now()};
  if(tiles){map.removeLayer(tiles);tiles=null;}if(!map.hasLayer(artMap))artMap.addTo(map);
  map.setMaxBounds([[-.0045,-.003],[.0045,.003]]);map.setView([0,0],17);root.dataset.mode=mode;update();refreshFeatures();
}
function startLive() {
  clearSession();mode='live';wantedGPS=true;position=null;locationPending=true;root.dataset.mode=mode;map.setMaxBounds(null);update();
  if(!navigator.geolocation||!window.isSecureContext){locationFailure({code:0});return;}
  watchLocation();
}
function watchLocation() {
  if(!visible||document.hidden||!wantedGPS||!navigator.geolocation||watchId!==null)return;
  const generation=++watchGeneration;
  watchId=navigator.geolocation.watchPosition(value=>{if(generation===watchGeneration&&wantedGPS)locationSuccess(value);},error=>{if(generation===watchGeneration)locationFailure(error);},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}
function locationSuccess(value) {
  const next={lat:value.coords.latitude,lng:value.coords.longitude,accuracy:Math.max(0,value.coords.accuracy),speed:Number.isFinite(value.coords.speed)?value.coords.speed:0,time:Math.min(Date.now(),value.timestamp||Date.now())};
  if(!validPoint(next)||!Number.isFinite(next.accuracy)||(position&&next.time<position.time))return;
  if(position&&next.time-position.time>=2000&&!Number.isFinite(value.coords.speed)){
    const traveled=distance(position,next);
    if(traveled>Math.max(20,position.accuracy+next.accuracy))next.speed=traveled/((next.time-position.time)/1000);
  }
  const first=!position;position=next;locationPending=false;locationError='';
  if(!tiles){if(map.hasLayer(artMap))map.removeLayer(artMap);tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,maxNativeZoom:19,keepBuffer:1,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);let failed=0;tiles.on('tileerror',()=>{if(++failed===3){mapMessage='Map imagery is unavailable. Try again online or use the practice grove.';update();}});}
  if(first){map.setView([position.lat,position.lng],17);camp={lat:position.lat,lng:position.lng,id:`camp-${hash(`${position.lat.toFixed(3)}:${position.lng.toFixed(3)}`)}`,kind:'camp',name:'Your Field Camp',source:'Personal camp · this session'};}
  if(walkAnchor){const meters=walkSegment(walkAnchor,position);if(meters>0){progress.meters+=meters;walkAnchor=position;const earned=Math.floor(progress.meters/250)-progress.walkRewards;if(earned>0){progress.walkRewards+=earned;profile.coins+=earned*30;profile.berries=Math.min(99,profile.berries+earned*2);save();handlers.toast?.('250 m walked! +30 coins and +2 story cards.');}persist();}else if(position.time-walkAnchor.time>90000||position.speed>6)walkAnchor=position;}else walkAnchor=position;
  if(follow)map.panTo([position.lat,position.lng],{animate:!first,duration:.7});
  refreshFeatures();update();void loadLandmarks();
}
function locationFailure(error) {
  locationPending=false;
  locationError=error.code===1?'Location access is off. Allow it in your browser’s site settings, or explore the practice grove.':error.code===3?'GPS is taking a little longer. Try outdoors with a clear view of the sky, or use the practice grove.':'We couldn’t find your position. You can retry or explore the practice grove.';
  if(error.code===1){wantedGPS=false;stopWatch();}
  update();
}
async function loadLandmarks(force=false) {
  if(mode!=='live'||!position||!navigator.onLine||loading)return;
  const area=`${position.lat.toFixed(2)}:${position.lng.toFixed(2)}`, cached=areaCache.get(area), now=Date.now();
  if(cached&&now-cached.time<15*60000&&!force){if(lastArea!==area){landmarks=cached.points;lastArea=area;refreshFeatures();}return;}
  if(now-lastLookup<60000)return;
  lastLookup=now;loading=true;mapMessage='Finding nearby landmarks…';update();const origin={...position},token=session;
  loadAbort=new AbortController();const controller=loadAbort,timeout=setTimeout(()=>controller.abort(),22000);
  try {
    const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({data:landmarkQuery(origin)}),signal:controller.signal});
    if(!response.ok)throw new Error('Landmarks unavailable');
    const data=await response.json();if(token!==session||mode!=='live')return;
    landmarks=parseLandmarks(data,origin);lastArea=area;areaCache.set(area,{time:now,points:landmarks});if(areaCache.size>8)areaCache.delete(areaCache.keys().next().value);
    mapMessage=landmarks.length?'':'No mapped landmarks nearby. Your Field Camp has supplies and a personal Lodge challenge.';
    refreshFeatures();
  } catch {if(token===session)mapMessage='Nearby landmarks are unavailable. Your Field Camp and roaming critters are still ready.';}
  finally {clearTimeout(timeout);if(token===session){loading=false;update();}}
}
function refreshFeatures() {
  if(!map||!position)return;
  const species=oakOpen()?[...PATROL_IDS,'partyposs']:PATROL_IDS;
  features=mode==='demo'?demoFeatures().filter(p=>p.kind!=='critter'||!progress.caught[p.id]):[...(camp?[camp]:[]),...landmarks,...makeSpawns(position,species,progress)];
  if(mode==='demo'&&oakOpen()&&!progress.caught['demo-partyposs'])features.push({...offset({lat:0,lng:0},15,285),id:'demo-partyposs',kind:'critter',species:'partyposs',level:12});
  markers.clearLayers();
  for(const point of features){
    const nearby=distance(position,point)<=INTERACTION_METERS,cleared=progress.lodges.includes(point.id),cool=cooldownRemaining(point.id,progress)>0;
    const html=point.kind==='critter'?`<span class="roaming-critter ${nearby?'in-reach':''}">${artHTML(point.species)}<i></i></span>`:`<span class="place-marker ${point.kind} ${nearby?'in-reach':''} ${cleared?'cleared':''} ${cool?'restocking':''}"><span class="place-symbol">${icon(point.kind==='stop'?'stop':point.kind==='camp'?'tent':'lodge')}</span><span class="place-plinth"></span>${cleared?'<span class="place-check">✓</span>':''}</span>`;
    const marker=L.marker([point.lat,point.lng],{title:pointName(point),alt:pointName(point),zIndexOffset:point.kind==='critter'?200:400,icon:L.divIcon({className:'quest-marker',iconSize:point.kind==='critter'?[62,68]:[52,78],iconAnchor:point.kind==='critter'?[31,51]:[26,69],html})}).addTo(markers).on('click',()=>showDetail(point));
    marker.getElement()?.setAttribute('aria-label',`${pointName(point)}, ${point.kind==='critter'?'critter':point.kind==='lodge'?'Patrol Lodge':'supply stop'}, ${distanceLabel(distance(position,point))}`);
  }
  update();
}
function update() {
  if(!root)return;
  root.dataset.mode=mode;const active=!!position&&mode!=='intro';
  $('#walk-coach').hidden=active;$('#demo-steps').hidden=mode!=='demo';$('#nearby-tray').hidden=!active;
  $('#walk-mode-label').textContent=mode==='demo'?'PRACTICE GROVE · GPS OFF':position?`LIVE GPS · ±${Math.round(position.accuracy)} m`:locationPending?'FINDING YOUR POSITION…':'YOUR NEXT ADVENTURE';
  $('#location-error').textContent=locationError;
  const gpsButton=root.querySelector('[data-walk="gps"]');gpsButton.disabled=locationPending;gpsButton.innerHTML=`${icon('locate')} ${locationPending?'Finding your position…':'Use my location'}`;
  const status=active?interactionStatus(position,position,mode):null;
  $('#walk-status').textContent=locationError||(status&&!status.ok?status.reason:mapMessage);$('#walk-status').hidden=!$('#walk-status').textContent;
  if(position){const latlng=[position.lat,position.lng];player.setLatLng(latlng);reach.setLatLng(latlng);accuracyRing.setLatLng(latlng).setRadius(mode==='live'?Math.min(position.accuracy,200):0);}
  $('#walk-distance').textContent=`${distanceLabel(progress.meters)} walked`;$('#walk-medals').textContent=pluralMedals();
  if(active){
    const near=[...features].sort((a,b)=>distance(position,a)-distance(position,b)).slice(0,4);
    $('#nearby-items').innerHTML=near.map(point=>`<button class="nearby-item" data-walk="select" data-id="${point.id}">${point.kind==='critter'?artHTML(point.species):`<span class="nearby-place ${point.kind}">${icon(point.kind==='stop'?'stop':point.kind==='camp'?'tent':'lodge')}</span>`}<strong>${point.kind==='critter'?SPECIES[point.species].name:point.kind==='lodge'?'Lodge':point.kind==='camp'?'Field Camp':'Supply stop'}</strong><small>${distance(position,point)<=INTERACTION_METERS?'Within reach':distanceLabel(distance(position,point))}</small></button>`).join('');
  }
  if(selected&&$('#walk-dialog').open&&!spinBusy)renderDetail();
  if(routeLine&&selected&&position)routeLine.setLatLngs([[position.lat,position.lng],[selected.lat,selected.lng]]);
  positionAttribution();
}
function tick() {if(mode==='live'&&position){refreshFeatures();void loadLandmarks();}else update();}
function openDialog(html) {const dialog=$('#walk-dialog');dialog.innerHTML=html;if(!dialog.open)dialog.showModal();}
const closeButton=()=>`<button class="close-button" data-walk="close" aria-label="Close map details">×</button>`;
function showDetail(point) {
  selected=point;renderDetail();const dialog=$('#walk-dialog');if(!dialog.open)dialog.showModal();
  if(routeLine)map.removeLayer(routeLine);
  routeLine=L.polyline([[position.lat,position.lng],[point.lat,point.lng]],{color:'#e7c979',weight:3,dashArray:'5 9',interactive:false}).addTo(map);
}
function renderDetail() {
  if(!selected)return;const point=selected,status=interactionStatus(position,point,mode),remaining=cooldownRemaining(point.id,progress),name=escapeHTML(pointName(point));
  const badge=point.kind==='critter'?'A NEW TRAIL COMPANION':point.kind==='lodge'?'PATROL LODGE':point.kind==='camp'?'YOUR PERSONAL FIELD CAMP':'SUPPLY STOP';
  let content='';
  if(point.kind==='critter')content=`${artHTML(point.species,'map-detail-critter')}<p>Lv ${point.level} · ${SPECIES[point.species].type}. Offer a Trail Woggle and invite this friend into your patrol.</p><button class="wood-button full" data-walk="encounter" ${status.ok?'':'disabled'}>Meet ${name} ${icon('arrow')}</button>`;
  else if(point.kind==='lodge')content=`<div class="lodge-emblem ${progress.lodges.includes(point.id)?'earned':''}">${icon('lodge')}</div><p>${progress.lodges.includes(point.id)?'Your patrol has earned this Lodge’s medal. Challenge its guardians again to train.':'Challenge the Lodge guardians with your patrol. Win coins, experience, and a personal Lodge medal.'}</p><div class="lodge-lineup">${lodgeTeam(point).map(unit=>`<div>${artHTML(unit.species)}<span>Lv ${unit.level}</span></div>`).join('')}</div><button class="wood-button full" data-walk="challenge" ${status.ok?'':'disabled'}>Challenge the Lodge ${icon('flag')}</button><p class="small-note">Victories belong to your patrol and save on this phone.</p>`;
  else content=`<button class="spin-disc ${remaining?'restocking':''}" data-walk="spin" aria-label="Spin supply stop" ${status.ok&&!remaining?'':'disabled'}>${icon(point.kind==='camp'?'tent':'stop')}<span class="spin-rim"></span></button><p class="spin-instruction">${remaining?`Restocking · ${Math.ceil(remaining/60000)} min left`:'Swipe the disc or tap to spin.'}</p><div class="stop-loot"><span class="camp-item story"></span><span class="camp-item golden"></span><span class="tonic-loot">✚</span></div><p>Story cards, Golden Woggles, a trail tonic, coins, and XP. Restocks every 5 minutes.</p>${point.kind==='camp'?`<button class="wood-button secondary full" data-walk="challenge" ${status.ok?'':'disabled'}>Challenge your camp Lodge</button><p class="small-note">Placed where you started this walk. This is a personal game camp, not a verified public landmark.</p>`:''}`;
  $('#walk-dialog').innerHTML=`${closeButton()}<span class="eyebrow">${badge}</span><h2>${name}</h2><div class="proximity ${status.ok?'ready':''}">${icon('locate')}<span>${escapeHTML(status.reason)}</span></div>${content}<div class="walk-detail-footer">${mode==='demo'&&!status.ok?'<button class="wood-button gold full" data-walk="demo-walk">Walk here in practice</button>':''}${mode==='live'&&point.kind!=='critter'?`<a class="walking-directions" href="https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=walking" target="_blank" rel="noopener">Walking directions ↗</a>`:''}<p>${point.kind==='critter'?'A virtual woodland critter.':escapeHTML(point.source||'Woodland game location')}${point.osmURL?` · <a href="${point.osmURL}" target="_blank" rel="noopener">Map details ↗</a>`:''}</p>${mode==='live'?'<p>Use public paths, check access, and stop walking to play. The dotted line shows direction, not a walking route.</p>':''}</div>`;
}
async function doSpin() {
  if(spinBusy||!selected)return;const result=spinStop(selected,position,mode,progress,profile);if(!result.ok){handlers.toast?.(result.reason);return;}
  spinBusy=true;persist();save();$('.spin-disc')?.classList.add('is-spinning');handlers.sound?.([392,494,659,784],.11);try{navigator.vibrate?.([15,30,15]);}catch{}
  const label=$('.spin-instruction');if(label)label.textContent='Supplies for the next adventure!';
  await new Promise(resolve=>setTimeout(resolve,900));spinBusy=false;handlers.toast?.(result.reason);refreshFeatures();
}
function lodgeTeam(point) {
  const seed=hash(point.id),level=Math.min(18,4+Math.floor(progress.lodges.length/2));
  return [makeUnit(PATROL_IDS[seed%8],level),makeUnit(PATROL_IDS[(seed+3)%8],level+1),...(progress.lodges.length>=3?[makeUnit(PATROL_IDS[(seed+5)%8],level+2)]:[])];
}
export function completeLodge(point) {
  if(!point)return false;const first=!progress.lodges.includes(point.id);if(first){progress.lodges.push(point.id);persist();}return first;
}
export function recordMapCatch() {if(encounterId){progress.caught[encounterId]=Date.now();encounterId=null;persist();}}
export function clearMapEncounter() {encounterId=null;}
function showSettings() {
  selected=null;
  openDialog(`${closeButton()}<span class="eyebrow">OUT ON THE TRAIL</span><h2>Your walking map</h2><div class="map-legend"><p>${icon('stop')} <strong>Supply stops</strong> · spin within 80 m</p><p>${icon('lodge')} <strong>Patrol Lodges</strong> · battle for medals</p><p>${icon('leaf')} <strong>Critters</strong> · invite into your patrol</p></div><p>Walk 250 m with GPS to earn 30 coins and 2 story cards. Your Field Camp gives every walk a supply stop and a Lodge challenge.</p><button class="wood-button full" data-walk="gps">${icon('locate')} ${mode==='live'?'Restart GPS':'Use my location'}</button><button class="wood-button secondary full" data-walk="demo">Practice grove · no GPS</button>${mode==='live'?'<button class="wood-button secondary full" data-walk="end">End location session</button>':''}<button class="wood-button secondary full" data-walk="book">Open the trail book campaign</button><div class="location-info"><h3>Location & map data</h3><p>GPS runs while the map is visible. Exact fixes stay in memory; no account or location history is uploaded. Your browser requests map tiles from OpenStreetMap and landmarks from Overpass for a rounded nearby area. These services receive your IP address and requested area.</p><p>Outdoor maps and landmarks need internet access. The practice grove, trail book, and saved patrol work offline after the first full load.</p><p><a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener">Map provider privacy</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Report a map issue</a></p></div>`);
}
function showNearby() {
  selected=null;
  const nearby=[...features].sort((a,b)=>distance(position,a)-distance(position,b));
  openDialog(`${closeButton()}<span class="eyebrow">OUT ON THE TRAIL</span><h2>Nearby discoveries</h2><p>${mode==='demo'?'Explore the practice grove.':'Follow public paths. Tap a location for distance and walking directions.'}</p><div class="nearby-list">${nearby.map(point=>`<button data-walk="select" data-id="${point.id}"><span>${point.kind==='critter'?artHTML(point.species):icon(point.kind==='lodge'?'lodge':point.kind==='camp'?'tent':'stop')}</span><span><strong>${escapeHTML(pointName(point))}</strong><small>${point.kind==='critter'?'Wild critter':point.kind==='lodge'?'Patrol Lodge':'Supply stop'} · ${distanceLabel(distance(position,point))}</small></span>${icon('arrow')}</button>`).join('')}</div>${mode==='live'?'<button class="wood-button secondary full" data-walk="refresh">Refresh nearby landmarks</button>':''}`);
}
function onClick(event) {
  const button=event.target.closest('[data-walk]');if(!button||button.disabled)return;
  const name=button.dataset.walk;
  if(name==='close')return $('#walk-dialog').close();
  if(name==='gps')return startLive();
  if(name==='demo')return startDemo();
  if(name==='settings')return showSettings();
  if(name==='end'){clearSession();wantedGPS=false;mode='intro';position=null;locationPending=false;if(tiles){map.removeLayer(tiles);tiles=null;}artMap.addTo(map);map.setView([0,0],17);markers.clearLayers();update();return;}
  if(name==='book'){$('#walk-dialog').close();handlers.book?.();return;}
  if(name==='center'){follow=true;if(position)map.panTo([position.lat,position.lng]);else showSettings();return;}
  if(name==='zoom-in')return map.zoomIn();if(name==='zoom-out')return map.zoomOut();
  if(name==='nearby')return showNearby();
  if(name==='select'){const point=features.find(p=>p.id===button.dataset.id);if(point)showDetail(point);return;}
  if(name==='refresh'){$('#walk-dialog').close();if(Date.now()-lastLookup<60000)handlers.toast?.('Give the map a moment before refreshing again.');else void loadLandmarks(true);return;}
  if(name==='spin')return void doSpin();
  if(name==='step'&&mode==='demo'){const vector={north:[0,25],south:[0,-25],east:[25,0],west:[-25,0]}[button.dataset.dir];position={...offset(position,...vector),accuracy:0,speed:0,time:Date.now()};follow=true;map.panTo([position.lat,position.lng]);refreshFeatures();return;}
  if(name==='demo-walk'&&mode==='demo'&&selected){position={...offset(selected,0,-30),accuracy:0,speed:0,time:Date.now()};map.panTo([position.lat,position.lng]);refreshFeatures();return;}
  if((name==='encounter'||name==='challenge')&&selected){
    const status=interactionStatus(position,selected,mode);if(!status.ok){handlers.toast?.(status.reason);return;}
    const point={...selected};if(name==='encounter'&&progress.caught[point.id])return;
    $('#walk-dialog').close();
    if(name==='encounter'){encounterId=point.id;handlers.encounter?.(makeUnit(point.species,point.level));}
    else handlers.lodge?.(lodgeTeam(point),{id:point.id,name:point.kind==='camp'?'Field Camp Lodge':point.name});
  }
}
