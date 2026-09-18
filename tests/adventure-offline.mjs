import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {normalizeSave,makeUnit,PATROL_IDS,chooseStarter} from '../dist/world.js';
const {chromium}=createRequire(resolve(process.argv[2],'../package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});
  await context.addInitScript(()=>{if(!localStorage.getItem('woodbadge-quest-v2'))localStorage.setItem('partyposs-save-v1',JSON.stringify({caught:6,xp:1230,throws:14,berries:8,ultras:3,sound:true,catches:[]}));});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');await page.locator('#loader').waitFor({state:'hidden'});await page.locator('[data-action="starter"][data-arg="fox"]').click();
  const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem('woodbadge-quest-v2')));
  assert.equal(migrated.caught,6);assert.equal(migrated.xp,1230);assert.equal(migrated.berries,8);assert.equal(migrated.ultras,3);assert.ok(migrated.roster.some(u=>u.species==='partyposs'));
  await page.locator('[data-action="oak"]').click();
  await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true}));
  const downloadPromise=page.waitForEvent('download');await page.locator('#photo-button').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'PartyPoss.png');await download.saveAs('output/qa-v2/partyposs-photo.png');
  await context.grantPermissions(['camera']);await page.locator('#ar-button').click();await page.waitForFunction(()=>document.querySelector('#ar-button').getAttribute('aria-checked')==='true');await page.locator('#journal-button').click();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.screen==='world');assert.equal(await page.locator('#camera-feed').evaluate(v=>v.srcObject),null);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await page.locator('#loader').waitFor({state:'hidden'});await page.locator('[data-action="oak"]').click();await page.locator('#attack-button').click();assert.match(await page.locator('#message').textContent(),/Maui Wali/);await page.waitForTimeout(1000);await page.screenshot({path:'output/qa-v2/offline-maui.png'});
  await context.close();

  const full=normalizeSave(null);chooseStarter('fox',full);full.roster=[...PATROL_IDS,'partyposs'].map(id=>makeUnit(id,12));full.team=['partyposs','bear','buffalo'];full.badges=['lakeside','hollow'];full.zone='ridge';
  const advanced=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:2,isMobile:true,hasTouch:true});await advanced.addInitScript(p=>localStorage.setItem('woodbadge-quest-v2',JSON.stringify(p)),full);
  const mobile=await advanced.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:4173/');await mobile.locator('#loader').waitFor({state:'hidden'});
  await mobile.locator('[data-tab="patrol"]').click();
  const cdp=await advanced.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:15,y:430}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:15,y:430-i*32}]});await mobile.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(250);
  assert.ok(await mobile.locator('#world-content').evaluate(e=>e.scrollTop)>80,'Patrol must scroll with a real touch gesture');
  await mobile.locator('[data-tab="trail"]').click();await mobile.locator('[data-action="trial"]').click();
  for(let i=0;i<3;i++){await mobile.locator('[data-action="battle"][data-arg="guard"]').click();await mobile.waitForFunction(()=>!document.querySelector('[data-action="battle"][data-arg="attack"]').disabled);}
  await mobile.locator('[data-action="battle"][data-arg="special"]').click();
  assert.ok(await mobile.locator('#battle-screen').evaluate(e=>e.classList.contains('is-maui')));assert.match(await mobile.locator('.battle-log').textContent(),/Maui Wali/);
  await mobile.waitForTimeout(250);await mobile.screenshot({path:'output/qa-v2/small-battle-maui.png'});
  const bounds=await mobile.locator('.battle-moves').boundingBox();assert.ok(bounds.y+bounds.height<568);
  await mobile.waitForTimeout(1600);await mobile.locator('[data-action="retreat"]').click();
  await mobile.setViewportSize({width:844,height:390});assert.ok(await mobile.locator('.rotate-hint').isVisible());
  await advanced.close();assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',checks:['legacy PartyPoss save migration','saved photo','camera teardown on exit','offline map and encounters','offline Maui Wali','real mobile touch scrolling','Maui Wali used in battle','small phone battle controls','landscape hint'],errors},null,2));
}finally{await browser.close();}
