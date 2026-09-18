import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {normalizeSave,chooseStarter,makeUnit} from '../dist/world.js';
const {chromium}=createRequire(resolve(process.argv[2],'../package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];await mkdir('output/qa-v3',{recursive:true});
const start=async page=>{page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/');await page.locator('#loader').waitFor({state:'hidden'});};
const profile=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('woodbadge-quest-v2')));
const walk=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('woodland-walk-v1')));
const phone={viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true};
try {
  const context=await browser.newContext(phone),page=await context.newPage();
  await start(page);await page.locator('[data-action="starter"][data-arg="beaver"]').click();
  await page.screenshot({path:'output/qa-v3/location-intro.png'});
  await page.locator('[data-walk="demo"]').click();
  assert.match(await page.locator('#walk-mode-label').textContent(),/GPS OFF/);
  await page.screenshot({path:'output/qa-v3/practice-map.png'});
  await page.locator('[data-walk="select"][data-id="demo-stop-1"]').click();
  await page.screenshot({path:'output/qa-v3/supply-stop.png'});
  const before=await profile(page);await page.locator('.spin-disc').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('woodland-walk-v1')).spins===1);
  assert.equal((await profile(page)).berries,before.berries+3);assert.equal((await profile(page)).ultras,before.ultras+1);
  await page.waitForFunction(()=>document.querySelector('.spin-disc')?.disabled===true);
  await page.locator('[data-walk="close"]').click();
  await page.locator('[data-walk="select"][data-id="demo-critter-fox"]').click();await page.locator('[data-walk="encounter"]').click();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='ready');
  assert.match(await page.locator('#throw-button').getAttribute('aria-label'),/Trail Woggle/);
  assert.equal(await page.locator('#throw-button img').getAttribute('src'),'./assets/camp-items.webp');
  await page.locator('#berry-button').click();await page.locator('#ball-button').click();
  await page.screenshot({path:'output/qa-v3/woggle-encounter.png'});
  await page.evaluate(()=>{Math.random=()=>0;});
  const cdp=await context.newCDPSession(page),box=await page.locator('#throw-button').boundingBox();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*28}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.locator('#result-dialog').waitFor({state:'visible'});assert.match(await page.locator('#result-subtitle').textContent(),/Fox joined/);
  assert.ok((await walk(page)).caught['demo-critter-fox']);
  await page.locator('#next-button').click();await page.waitForFunction(()=>document.querySelector('#game').dataset.screen==='world');
  assert.equal(await page.locator('.quest-marker[aria-label^="Fox,"]').count(),0);
  await page.locator('[data-walk="nearby"]').click();await page.locator('[data-walk="select"][data-id="demo-lodge-1"]').click();
  assert.equal(await page.locator('[data-walk="challenge"]').isDisabled(),true);
  await page.locator('[data-walk="demo-walk"]').click();assert.equal(await page.locator('[data-walk="challenge"]').isDisabled(),false);
  await page.screenshot({path:'output/qa-v3/patrol-lodge.png'});
  await page.locator('[data-walk="challenge"]').click();assert.match(await page.locator('.battle-top').textContent(),/Patrol Lodge/);
  await page.locator('[data-action="retreat"]').click();await page.locator('[data-tab="patrol"]').click();await page.locator('[data-action="rest"]').click();
  await page.locator('[data-tab="map"]').click();assert.match(await page.locator('#walk-mode-label').textContent(),/GPS OFF/);
  for(const [width,height,name] of [[320,568,'small-map'],[430,932,'large-map'],[1440,1000,'desktop-map']]){await page.setViewportSize({width,height});await page.screenshot({path:`output/qa-v3/${name}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const tray=await page.locator('#nearby-tray').boundingBox();assert.ok(tray.y+tray.height<height);}
  await page.setViewportSize(phone.viewport);await page.locator('[data-walk="book"]:visible').click();assert.ok(await page.locator('[data-action="explore"]').isVisible());
  console.log('Phone controls and layouts passed. Checking offline play.');await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await page.locator('#loader').waitFor({state:'hidden'});await page.locator('[data-walk="demo"]').click();
  assert.equal((await walk(page)).spins,1);await page.screenshot({path:'output/qa-v3/offline-practice.png'});await context.close();

  // A strong fixture isolates the Lodge victory and one-time personal medal flow.
  const p=normalizeSave(null);chooseStarter('beaver',p);p.roster=['beaver','fox','owl'].map(id=>makeUnit(id,18));p.team=['beaver','fox','owl'];
  const victory=await browser.newContext(phone);await victory.addInitScript(p=>localStorage.setItem('woodbadge-quest-v2',JSON.stringify(p)),p);
  const win=await victory.newPage();await start(win);await win.locator('[data-walk="demo"]').click();await win.locator('[data-walk="nearby"]').click();await win.locator('[data-walk="select"][data-id="demo-lodge-1"]').click();await win.locator('[data-walk="demo-walk"]').click();await win.locator('[data-walk="challenge"]').click();
  for(let i=0;i<15;i++){await win.waitForFunction(()=>document.querySelector('#battle-result').open||!document.querySelector('[data-action="battle"][data-arg="attack"]').disabled);if(await win.locator('#battle-result').isVisible())break;await win.locator('[data-action="battle"][data-arg="attack"]').click();await win.waitForTimeout(650);}
  await win.locator('#battle-result').waitFor({state:'visible'});assert.match(await win.locator('#battle-result').textContent(),/Lodge medal earned/);assert.deepEqual((await walk(win)).lodges,['demo-lodge-1']);await win.screenshot({path:'output/qa-v3/lodge-victory.png'});await victory.close();

  // Location is simulated; map tiles and landmarks use fixtures instead of fetching
  // community servers during automated map panning and GPS tests.
  console.log('Offline practice and Lodge victory passed. Checking GPS.');
  const live=await browser.newContext({...phone,permissions:['geolocation'],geolocation:{latitude:41.88,longitude:-87.63,accuracy:8}});
  await live.addInitScript(p=>{localStorage.setItem('woodbadge-quest-v2',JSON.stringify(p));window.__gpsWatches=new Set();const geo=navigator.geolocation,watch=geo.watchPosition.bind(geo),clear=geo.clearWatch.bind(geo);geo.watchPosition=(...args)=>{const id=watch(...args);window.__gpsWatches.add(id);return id;};geo.clearWatch=id=>{window.__gpsWatches.delete(id);clear(id);};},p);
  let lookups=0;const bodies=[];
  await live.route('https://overpass-api.de/**',route=>{lookups++;bodies.push(route.request().postData());return route.fulfill({contentType:'application/json',body:JSON.stringify({elements:[{type:'node',id:111,lat:41.8803,lon:-87.6302,tags:{name:'Trail Water Station',amenity:'drinking_water'}},{type:'node',id:222,lat:41.883,lon:-87.63,tags:{name:'Public Park Lodge',leisure:'park'}},{type:'node',id:333,lat:41.8801,lon:-87.63,tags:{name:'Private Garden',access:'private',leisure:'park'}}]})});});
  await live.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#c9dca5" d="M0 0h256v256H0z"/><path stroke="#ecf0cb" stroke-width="16" d="M0 70h256M80 0v256M0 220h256M220 0v256"/><path stroke="#fefbe8" stroke-width="8" d="M0 70h256M80 0v256M0 220h256M220 0v256"/></svg>'}));
  const gps=await live.newPage();await start(gps);assert.equal(await gps.evaluate(()=>window.__gpsWatches.size),0);await gps.locator('[data-walk="gps"]').click();
  await gps.waitForFunction(()=>document.querySelector('#walk-mode-label').textContent.includes('LIVE GPS'));
  await gps.waitForFunction(()=>document.querySelector('.quest-marker[aria-label^="Trail Water Station"]'));
  assert.equal(await gps.evaluate(()=>window.__gpsWatches.size),1);assert.equal(await gps.locator('.quest-marker[aria-label^="Private Garden"]').count(),0);assert.equal(lookups,1);
  await gps.screenshot({path:'output/qa-v3/gps-map-fixture.png'});
  await gps.locator('[data-walk="nearby"]').click();await gps.locator('#walk-dialog [data-walk="select"][data-id="osm-node-222"]').click();assert.equal(await gps.locator('[data-walk="challenge"]').isDisabled(),true);assert.match(await gps.locator('.walking-directions').getAttribute('href'),/travelmode=walking/);await gps.locator('[data-walk="close"]').click();
  await gps.locator('[data-tab="patrol"]').click();assert.equal(await gps.evaluate(()=>window.__gpsWatches.size),0);
  await gps.locator('[data-tab="map"]').click();await gps.waitForFunction(()=>window.__gpsWatches.size===1);
  await live.setGeolocation({latitude:41.883,longitude:-87.63,accuracy:7});await gps.waitForTimeout(1500);await live.setGeolocation({latitude:41.883,longitude:-87.63,accuracy:7});await gps.waitForTimeout(600);
  await gps.locator('[data-walk="nearby"]').click();await gps.locator('#walk-dialog [data-walk="select"][data-id="osm-node-222"]').click();assert.equal(await gps.locator('[data-walk="challenge"]').isDisabled(),false);await gps.locator('[data-walk="challenge"]').click();assert.equal(await gps.evaluate(()=>window.__gpsWatches.size),0);await gps.locator('[data-action="retreat"]').click();
  await gps.locator('.walk-top [data-walk="settings"]').last().click();await gps.locator('[data-walk="end"]').click();assert.equal(await gps.evaluate(()=>window.__gpsWatches.size),0);assert.equal(await gps.locator('#walk-coach').isVisible(),true);assert.ok(bodies.every(body=>!body.includes('41.883')));await live.close();

  const denied=await browser.newContext(phone);await denied.addInitScript(p=>{localStorage.setItem('woodbadge-quest-v2',JSON.stringify(p));navigator.geolocation.watchPosition=(ok,error)=>{setTimeout(()=>error({code:1}),10);return 42;};navigator.geolocation.clearWatch=()=>{};},p);const nope=await denied.newPage();await start(nope);await nope.locator('[data-walk="gps"]').click();await nope.waitForFunction(()=>document.querySelector('#location-error').textContent.includes('Location access is off'));assert.ok(await nope.locator('[data-walk="demo"]').isEnabled());await nope.locator('[data-walk="demo"]').click();assert.match(await nope.locator('#walk-mode-label').textContent(),/GPS OFF/);await denied.close();
  assert.deepEqual(errors,[]);console.log('PASS: themed touch invitations, stops/cooldown, map navigation, Lodges/medals, GPS/movement/proximity, permission denial, watch teardown, layouts, saved progress, and offline practice.');
} finally {await browser.close();}
