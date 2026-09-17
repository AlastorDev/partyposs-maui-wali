import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(resolve(process.argv[2],'../package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='ready');
  await page.locator('#loader').waitFor({state:'hidden'});
  await page.screenshot({path:'output/qa/small-phone-fixed.png'});
  const boxes=await page.evaluate(()=>Object.fromEntries(['message','attack-button','throw-hint'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{top:r.top,bottom:r.bottom}];})));
  assert.ok(boxes.message.bottom<boxes['attack-button'].top,JSON.stringify(boxes));
  assert.ok(boxes['attack-button'].bottom<boxes['throw-hint'].top,JSON.stringify(boxes));
  await page.locator('#help-button').click();assert.ok(await page.locator('#help-dialog').isVisible());await page.keyboard.press('Escape');
  await page.setViewportSize({width:844,height:390});
  assert.ok(await page.locator('.rotate-hint').isVisible());await page.screenshot({path:'output/qa/landscape-fixed.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='ready');
  await page.locator('#attack-button').click();assert.match(await page.locator('#message').textContent(),/Maui Wali/);
  await page.screenshot({path:'output/qa/offline.png'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',checks:['small phone controls do not overlap','help modal and Escape','portrait rotation message','offline reload and offline Maui Wali'],boxes}));
  await context.close();
} finally {await browser.close();}
