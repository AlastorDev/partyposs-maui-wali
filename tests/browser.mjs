import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const runtime=process.argv[2];
if(!runtime)throw new Error('Pass the bundled node_modules path.');
const {chromium}=createRequire(resolve(runtime,'../package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const errors=[];
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
await mkdir('output/qa',{recursive:true});
const ready=()=>page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='ready');
try {
  await page.goto('http://127.0.0.1:4173/');await ready();await page.locator('#loader').waitFor({state:'hidden'});
  await page.screenshot({path:'output/qa/phone-ready.png'});
  assert.equal(await page.locator('#berry-count').textContent(),'12');
  await page.locator('#attack-button').click();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='attacking');
  await page.waitForTimeout(1200);
  assert.match(await page.locator('#message').textContent(),/PartyPoss used Maui Wali!/);
  await page.screenshot({path:'output/qa/phone-maui-wali.png'});
  await ready();
  await page.evaluate(()=>{Math.random=()=>.99;});
  await page.locator('#berry-button').click();
  assert.equal(await page.locator('#berry-count').textContent(),'11');
  assert.equal(await page.locator('#berry-active').isVisible(),true);
  await page.locator('#ball-button').click();
  assert.equal(await page.locator('#ball-label').textContent(),'POKÉ BALL');
  // A deliberate sideways swipe misses, consumes one Ultra Ball, and keeps the berry.
  let ball=await page.locator('#throw-button').boundingBox();
  await page.mouse.move(ball.x+ball.width/2,ball.y+ball.height/2);await page.mouse.down();
  await page.mouse.move(ball.x+ball.width/2+155,ball.y+ball.height/2-130,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='missing');
  await ready();
  assert.equal(await page.locator('#berry-active').isVisible(),true);
  for(let i=0;i<3;i++){
    await page.locator('#throw-button').press('Enter');
    await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='shaking');
    if(i<2){await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='escaping');await ready();}
  }
  await page.locator('#result-dialog').waitFor({state:'visible'});
  await page.screenshot({path:'output/qa/phone-caught.png'});
  assert.equal(await page.locator('#catch-count').textContent(),'1');
  await page.locator('#next-button').click();await ready();
  await page.locator('#journal-button').click();
  assert.equal(await page.locator('#journal-list li').count(),1);
  await page.locator('[data-close="journal-dialog"]').click();
  await page.reload();await ready();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('partyposs-save-v1')));
  assert.equal(saved.caught,1);assert.equal(saved.throws,4);assert.equal(saved.berries,13);assert.equal(saved.ultras,2);
  await page.locator('#sound-button').click();assert.equal(await page.locator('#sound-button').textContent(),'Sound on');
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});});
  const downloaded=page.waitForEvent('download');await page.locator('#photo-button').click();const download=await downloaded;
  assert.equal(download.suggestedFilename(),'PartyPoss.png');await download.saveAs('output/qa/saved-photo.png');
  await context.grantPermissions(['camera']);await page.locator('#ar-button').click();
  await page.waitForFunction(()=>document.querySelector('#ar-button').getAttribute('aria-checked')==='true');
  assert.equal(await page.locator('#camera-feed').evaluate(video=>video.srcObject.getVideoTracks()[0].readyState),'live');
  await page.locator('#ar-button').click();assert.equal(await page.locator('#camera-feed').evaluate(video=>video.srcObject),null);
  for(const [w,h,name] of [[320,568,'small-phone'],[430,932,'large-phone'],[1440,1000,'desktop'],[844,390,'landscape']]){
    await page.setViewportSize({width:w,height:h});
    await page.screenshot({path:`output/qa/${name}.png`});
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:['throw-button','berry-button','ball-button','attack-button'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));
    assert.equal(layout.overflow,false);
    for(const b of layout.buttons){assert.ok(b.x>=-1&&b.y>=0&&b.right<=w+1&&b.bottom<=h+1,`${name} clips ${b.id}: ${JSON.stringify(b)}`);}
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',checks:['Maui Wali animation','berry boost','Ultra Ball switching and consumption','swipe miss','two escapes','guaranteed third-hit catch','rewards','catch journal','reload persistence','photo download','sound','camera start and stop','four viewport layouts'],saved,pageErrors:errors},null,2));
}finally{await browser.close();}
