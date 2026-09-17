import { clamp, measureThrow, throwQuality, catchChance, earnedXP, loadProfile } from './core.js';

const $ = id => document.getElementById(id);
const game = $('game');
const canvas = $('effects');
const ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORAGE_KEY = 'partyposs-save-v1';
let profile;
try { profile = loadProfile(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { profile = loadProfile(); }
let phase = 'loading', gameTime = 0, phaseStart = 0, previousFrame = 0;
let width = 390, height = 844, dpr = 1, ring = 1, target = { x: 0.5, y: 0.5 };
let berryBoost = false, ballType = 'normal', hitCount = 0, encounterThrows = 0;
let shot = null, pointer = null, lastMoveTime = -20000, lastMessageTime = -10000, messageDuration = 0;
let cameraStream = null, cameraPending = false, audioContext = null, finishedThrow = null;
let particles = [], sparkleClock = 0, resultShown = false;
const images = {};
const assetPaths = { meadow: './assets/meadow.webp', idle: './assets/partyposs.webp', attack: './assets/partyposs-attack.webp', balls: './assets/balls.webp', fx: './assets/effects.webp' };

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* The game still works when storage is unavailable. */ }
}

function setPhase(next) {
  phase = next;
  phaseStart = gameTime;
  game.dataset.phase = next;
  updateControls();
}

function updateControls() {
  const ready = phase === 'ready';
  $('throw-button').disabled = !ready;
  $('berry-button').disabled = !ready || berryBoost || profile.berries <= 0;
  $('ball-button').disabled = !ready || (profile.ultras <= 0 && ballType === 'normal');
  $('attack-button').disabled = !ready || gameTime - lastMoveTime < 8000;
  $('berry-count').textContent = profile.berries;
  $('ultra-count').textContent = ballType === 'ultra' ? '∞' : profile.ultras;
  $('catch-count').textContent = profile.caught;
  $('ball-label').textContent = ballType === 'ultra' ? 'POKÉ BALL' : 'ULTRA BALL';
  $('berry-button').setAttribute('aria-label', `Use a berry, ${profile.berries} remaining${berryBoost ? ', already active' : ''}`);
  $('ball-button').setAttribute('aria-label', ballType === 'ultra' ? 'Switch to Poké Ball, unlimited' : `Switch to Ultra Ball, ${profile.ultras} remaining`);
  $('throw-button').setAttribute('aria-label', `Throw a ${ballType === 'ultra' ? 'Ultra Ball' : 'Poké Ball'}. Swipe up, or press Enter to throw.`);
  $('throw-button').querySelector('.ball-sprite').classList.toggle('ultra', ballType === 'ultra');
  $('ball-button').querySelector('.ball-sprite').classList.toggle('ultra', ballType !== 'ultra');
  $('berry-active').hidden = !berryBoost;
  $('berry-button').classList.toggle('selected', berryBoost);
  $('throw-hint').style.opacity = ready ? '0.9' : '0';
  $('sound-button').textContent = profile.sound ? 'Sound on' : 'Sound off';
  $('sound-button').setAttribute('aria-pressed', String(profile.sound));
  $('sound-button').setAttribute('aria-label', profile.sound ? 'Turn sound off' : 'Turn sound on');
}

function message(text, duration = 2200, attack = false) {
  const span = document.createElement('span');
  if (attack) {
    span.append('✦ PartyPoss used ');
    const em = document.createElement('em');
    em.textContent = 'Maui Wali!';
    span.append(em, ' ✦');
  } else { span.textContent = text; }
  $('message').replaceChildren(span);
  $('message').classList.add('visible');
  lastMessageTime = gameTime;
  messageDuration = duration;
}

function tone(notes, duration = 0.12, type = 'sine') {
  if (!profile.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume();
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + index * duration;
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration * 1.8);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + duration * 2);
    });
  } catch { /* Sound is optional on browsers without Web Audio. */ }
}

function haptic(pattern) { try { navigator.vibrate?.(pattern); } catch { /* Optional on mobile. */ } }
function modalOpen() { return !!document.querySelector('dialog[open]'); }

function beginEncounter() {
  berryBoost = false; hitCount = 0; encounterThrows = 0; shot = null; resultShown = false;
  if (profile.ultras === 0) ballType = 'normal';
  $('creature').style.opacity = '1';
  $('creature-shadow').style.opacity = '1';
  $('flying-ball').style.display = 'none';
  $('flash').style.opacity = '0';
  $('throw-button').style.transform = '';
  $('message').classList.remove('visible');
  setPhase('ready');
}

function useBerry() {
  if (phase !== 'ready' || berryBoost || profile.berries < 1 || modalOpen()) return false;
  profile.berries--; berryBoost = true; save(); updateControls();
  message('A birthday treat! Catch chance boosted.');
  burst(target.x, 0.5, 15, 'hearts'); tone([440, 660, 880]); haptic(20);
  return true;
}

function switchBall() {
  if (phase !== 'ready' || modalOpen()) return false;
  if (ballType === 'normal' && profile.ultras < 1) { message('No Ultra Balls left. Regular balls are unlimited.'); return false; }
  ballType = ballType === 'normal' ? 'ultra' : 'normal';
  updateControls(); tone([350, 500], 0.06);
  return true;
}

function useMauiWali() {
  if (phase !== 'ready' || gameTime - lastMoveTime < 8000 || modalOpen()) return false;
  lastMoveTime = gameTime; setPhase('attacking');
  message('', 4400, true);
  burst(0.5, 0.46, reducedMotion ? 18 : 60, 'magic');
  tone([392, 494, 587, 784, 988, 1175], 0.14, 'triangle'); haptic([30, 70, 30]);
  return true;
}

function throwBall(gesture = {dx:0,dy:0,tap:true}) {
  if (phase !== 'ready' || modalOpen()) return Promise.resolve({ok:false,reason:'Encounter is busy'});
  const measured = measureThrow({...gesture,width,height}, target);
  if (!measured) {
    $('throw-button').style.transform = '';
    message('Swipe up toward PartyPoss.');
    return Promise.resolve({ok:false,reason:'Swipe upward to throw'});
  }
  const quality = throwQuality(ring, measured.accuracy);
  const ultra = ballType === 'ultra';
  if (ultra && profile.ultras < 1) return Promise.resolve({ok:false,reason:'No Ultra Balls remaining'});
  if (ultra) profile.ultras--;
  encounterThrows++; profile.throws++; save();
  if (measured.hit) hitCount++;
  const chance = catchChance({quality,berry:berryBoost,ultra,hits:hitCount});
  shot = {...measured, quality, ultra, success: measured.hit && Math.random() < chance, startX:0.5,startY:0.88};
  if (measured.hit) berryBoost = false;
  $('flying-ball').querySelector('.ball-sprite').classList.toggle('ultra', ultra);
  $('flying-ball').style.display = 'block';
  $('throw-button').style.transform = '';
  setPhase('flying'); tone([330, 440, 550], 0.045); haptic(12);
  return new Promise(resolve => { finishedThrow = resolve; });
}

function finishThrow(result) {
  finishedThrow?.(result); finishedThrow = null;
  if (profile.ultras === 0) ballType = 'normal';
  updateControls();
}

function caught() {
  setPhase('caught');
  const xp = earnedXP(shot.quality, encounterThrows === 1);
  profile.caught++; profile.xp += xp;
  profile.berries = Math.min(99, profile.berries + 2);
  profile.ultras = Math.min(99, profile.ultras + 1);
  profile.catches.unshift({date:new Date().toISOString(),quality:shot.quality,xp});
  profile.catches = profile.catches.slice(0,20);
  save(); updateControls();
  $('result-xp').textContent = xp;
  $('result-quality').textContent = shot.quality;
  message('Gotcha! Happy birthday, PartyPoss!', 2800);
  burst(shot.x,0.6, reducedMotion ? 20 : 75,'celebrate');
  tone([523, 659, 784, 1047], 0.14, 'triangle'); haptic([40,60,40,60,100]);
  finishThrow({ok:true,caught:true,quality:shot.quality,xp});
}

function escape() {
  setPhase('escaping');
  $('flying-ball').style.display = 'none';
  $('creature').style.opacity = '1';
  $('creature-shadow').style.opacity = '1';
  burst(target.x, target.y, 22, 'sparkles');
  message('So close! PartyPoss broke free.');
  tone([520,390,330]);
}

function placeBall(x,y,scale,rotation = 0) {
  const size = width * 0.35;
  $('flying-ball').style.transform = `translate(${x * width - size / 2}px,${y * height - size / 2}px) scale(${scale}) rotate(${rotation}deg)`;
}

function burst(x,y,count,kind) {
  for (let i=0;i<count;i++) {
    const angle=Math.random()*Math.PI*2, speed=0.02+Math.random()*0.16;
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-0.03,life:0,max:1.2+Math.random()*2.5,size:12+Math.random()*18,rotation:Math.random()*6.28,spin:(Math.random()-.5)*4,type:kind==='magic'?Math.floor(Math.random()*4):kind==='celebrate'?3:kind==='hearts'?4:2,color:['#98f27a','#f2a6e8','#fbe374','#98e7ef'][i%4]});
  }
}

function drawParticles(dt) {
  particles = particles.filter(p=>p.life<p.max);
  for (const p of particles) {
    p.life+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rotation+=p.spin*dt;
    if (p.type===3) p.vy+=.065*dt;
    const opacity=Math.min(1,(p.max-p.life)*1.4);
    ctx.save(); ctx.translate(p.x*width,p.y*height); ctx.rotate(p.rotation); ctx.globalAlpha=Math.max(0,opacity);
    if(p.type<3 && images.fx) {
      const cell=images.fx.width/3;
      ctx.drawImage(images.fx,p.type*cell,0,cell,images.fx.height,-p.size/2,-p.size/2,p.size,p.size);
    } else if(p.type===4) {
      ctx.fillStyle='#ffd1e6';ctx.font=`${p.size}px sans-serif`;ctx.fillText('♥',-p.size/2,p.size/2);
    } else {
      ctx.fillStyle=p.color;ctx.fillRect(-p.size/5,-p.size/3,p.size/2,p.size*Math.cos(p.rotation)*.65);
    }
    ctx.restore();
  }
}

function drawMagic(time) {
  const progress=clamp(time/4200,0,1);
  const opacity=Math.min(progress*5,(1-progress)*5,1);
  const amplitude=reducedMotion?.1:1;
  for(let strand=0;strand<3;strand++) {
    ctx.save();ctx.globalAlpha=opacity*.72;ctx.lineCap='round';
    const color=strand===1?'#e4adff':'#aeff9b';
    ctx.shadowColor=color;ctx.shadowBlur=12;ctx.strokeStyle=color;ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<=100;i++) {
      const t=i/100;
      const theta=t*Math.PI*4+time*.0018*amplitude+strand*2;
      const x=(.5+Math.sin(theta)*(.13+t*.27))*width;
      const y=(.75-t*.48+Math.cos(theta)*.035)*height;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.globalAlpha=opacity*.15;ctx.lineWidth=10;ctx.shadowBlur=24;ctx.stroke();
    ctx.globalAlpha=opacity*.32;ctx.lineWidth=5;ctx.shadowBlur=14;ctx.stroke();
    ctx.globalAlpha=opacity*.86;ctx.lineWidth=1.8;ctx.strokeStyle='#f3ffe8';ctx.stroke();
    ctx.shadowBlur=0;ctx.restore();
  }
  const count=reducedMotion?10:24;
  for(let i=0;i<count;i++) {
    const t=((i/count+time*.00011*amplitude)%1);
    const theta=t*Math.PI*5+i*1.7+time*.0008*amplitude;
    const x=(.5+Math.sin(theta)*(.23+Math.sin(t*Math.PI)*.17))*width;
    const y=(.78-t*.54)*height;
    const size=(i%3===0?36:29)*width/390;
    const cell=images.fx.width/3,type=i%5===0?1:0;
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(x,y);ctx.rotate(Math.sin(theta)*.5);
    ctx.shadowColor=type?'#ffffb5':'#aaff79';ctx.shadowBlur=8;
    ctx.drawImage(images.fx,type*cell,0,cell,images.fx.height,-size/2,-size/2,size,size);ctx.restore();
    if(i%2===0){const twinkle=10+Math.abs(Math.sin(time*.003+i))*16;ctx.save();ctx.globalAlpha=opacity*.85;ctx.drawImage(images.fx,cell*2,0,cell,images.fx.height,x+12,y-24,twinkle,twinkle);ctx.restore();}
  }
}

function frame(now) {
  const dt=Math.min((now-(previousFrame||now))/1000,.05);previousFrame=now;
  const paused=document.hidden || ($('help-dialog').open || $('journal-dialog').open) || matchMedia('(orientation:landscape) and (max-height:500px) and (pointer:coarse)').matches;
  if(!paused) gameTime+=dt*1000;
  const elapsed=gameTime-phaseStart;
  ctx.clearRect(0,0,width,height);
  if(phase!=='loading'&&!paused) {
    if(phase==='ready') {
      target.x=.5+(reducedMotion?0:Math.sin(gameTime*.00065)*.035);
      ring=.25+.75*(1-(gameTime%2100)/2100);
      $('target-inner').style.transform=`scale(${ring})`;
      $('target').style.left=`${target.x*100}%`;
      $('creature').style.transform=`translateX(calc(-50% + ${(target.x-.5)*width}px)) translateY(${reducedMotion?0:Math.sin(gameTime*.002)*3}px) rotate(${reducedMotion?0:Math.sin(gameTime*.001)*.8}deg)`;
      if($('attack-button').disabled && gameTime-lastMoveTime>=8000) updateControls();
    }
    if(phase==='flying') {
      const p=clamp(elapsed/720,0,1), ease=1-Math.pow(1-p,1.5);
      placeBall(shot.startX+(shot.x-shot.startX)*p,shot.startY+(shot.y-shot.startY)*ease-Math.sin(p*Math.PI)*.15,1-.62*p,p*(shot.ultra?280:360));
      if(p>=1) {
        if(shot.hit) {setPhase('pulling');message(`${shot.quality}!`,1300);burst(shot.x,shot.y,22,'sparkles');tone([740,988],.08);haptic(30);}
        else {setPhase('missing');message('Just missed! Aim your swipe toward PartyPoss.');}
      }
    } else if(phase==='pulling') {
      const p=clamp(elapsed/480,0,1);
      $('creature').style.opacity=String(1-p);
      $('creature').style.transform=`translateX(-50%) scale(${1-p*.85})`;
      $('creature-shadow').style.opacity=String(1-p);
      $('flash').style.opacity=String(Math.sin(p*Math.PI)*.6);
      placeBall(shot.x,shot.y+p*.12,.38);
      if(p>=1) {$('flash').style.opacity='0';setPhase('shaking');}
    } else if(phase==='shaking') {
      const wave=elapsed%800;
      const angle=wave<370?Math.sin(wave/370*Math.PI*2)*18:0;
      placeBall(shot.x,shot.y+.12,.38,angle);
      if(elapsed>=2500) shot.success?caught():escape();
    } else if(phase==='missing') {
      const p=clamp(elapsed/600,0,1);
      placeBall(shot.x,shot.y+p*.7,.38-p*.15,p*270);
      if(p>=1) {$('flying-ball').style.display='none';setPhase('ready');finishThrow({ok:true,caught:false,miss:true});}
    } else if(phase==='escaping') {
      const p=clamp(elapsed/700,0,1);
      $('creature').style.transform=`translateX(-50%) scale(${.75+p*.25})`;
      if(p>=1){setPhase('ready');finishThrow({ok:true,caught:false,escaped:true});}
    } else if(phase==='attacking') {
      $('creature').style.transform=`translateX(-50%) rotate(${reducedMotion?0:Math.sin(elapsed*.004)*2}deg) translateY(${reducedMotion?0:-Math.abs(Math.sin(elapsed*.003))*5}px)`;
      drawMagic(elapsed);
      if(!reducedMotion && Math.random()<.35) burst(.1+Math.random()*.8,.25+Math.random()*.45,1,'magic');
      if(elapsed>=4400){setPhase('ready');$('message').classList.remove('visible');}
    } else if(phase==='caught'&&elapsed>1100&&!resultShown) {
      resultShown=true; $('result-dialog').showModal();
    }
    sparkleClock+=dt;
    if(sparkleClock>.35&&particles.length<30&&phase==='ready'&&!reducedMotion){sparkleClock=0;burst(.12+Math.random()*.76,.25+Math.random()*.45,1,'sparkles');}
    if(gameTime-lastMessageTime>messageDuration) $('message').classList.remove('visible');
    drawParticles(dt);
  } else if(paused) drawParticles(0);
  requestAnimationFrame(frame);
}

function resize() {
  const rect=game.getBoundingClientRect(); width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);
  target.y=height<=650?.47:.5;$('target').style.top=`${target.y*100}%`;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}

$('throw-button').addEventListener('pointerdown',event=>{
  if(phase!=='ready'||modalOpen()||!event.isPrimary) return;
  event.preventDefault();
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY};
  $('throw-button').setPointerCapture(event.pointerId);
  $('throw-button').style.animation='none';
});
$('throw-button').addEventListener('pointermove',event=>{
  if(!pointer||pointer.id!==event.pointerId)return;
  pointer.lastX=event.clientX;pointer.lastY=event.clientY;
  const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
  $('throw-button').style.transform=`translate(${clamp(dx,-width*.35,width*.35)*.45}px,${clamp(dy,-height*.2,40)*.4}px) rotate(${dx*.3}deg)`;
});
$('throw-button').addEventListener('pointerup',event=>{
  if(!pointer||pointer.id!==event.pointerId)return;
  const dx=event.clientX-pointer.x,dy=pointer.y-event.clientY;
  pointer=null;$('throw-button').style.animation='';
  void throwBall({dx,dy,tap:Math.hypot(dx,dy)<12});
});
$('throw-button').addEventListener('pointercancel',()=>{pointer=null;$('throw-button').style.transform='';$('throw-button').style.animation='';});
$('throw-button').addEventListener('click',event=>{if(event.detail===0)void throwBall();});
$('berry-button').addEventListener('click',useBerry);
$('ball-button').addEventListener('click',switchBall);
$('attack-button').addEventListener('click',useMauiWali);
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());
$('sound-button').addEventListener('click',()=>{profile.sound=!profile.sound;save();updateControls();tone([523,659]);});
$('result-dialog').addEventListener('close',()=>{if(phase==='caught')beginEncounter();});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));
document.addEventListener('keydown',event=>{
  if(event.repeat||modalOpen())return;
  if(event.code==='Space'){if(event.target.closest('button'))return;event.preventDefault();void throwBall();}
  else if(event.key.toLowerCase()==='b')useBerry();
  else if(event.key.toLowerCase()==='u')switchBall();
  else if(event.key.toLowerCase()==='m')useMauiWali();
});

$('journal-button').addEventListener('click',()=>{
  $('journal-caught').textContent=profile.caught;
  $('journal-xp').textContent=profile.xp.toLocaleString();
  $('journal-empty').hidden=profile.catches.length>0;
  $('journal-list').replaceChildren(...profile.catches.map(entry=>{
    const li=document.createElement('li'),img=document.createElement('img'),copy=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small'),xp=document.createElement('span');
    img.src=assetPaths.idle;img.alt='';name.textContent='PartyPoss';
    meta.textContent=`${entry.quality} throw · ${new Date(entry.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
    xp.className='entry-xp';xp.textContent=`+${entry.xp} XP`;
    copy.append(name,meta);li.append(img,copy,xp);return li;
  }));
  $('journal-dialog').showModal();
});

function stopCamera() {
  cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;
  $('camera-feed').srcObject=null;game.classList.remove('ar-on');$('ar-button').setAttribute('aria-checked','false');
}

$('ar-button').addEventListener('click',async()=>{
  if(cameraPending)return;
  if(cameraStream){stopCamera();return;}
  if(!navigator.mediaDevices?.getUserMedia){message('Camera mode is not available in this browser.',3200);return;}
  cameraPending=true;$('ar-button').disabled=true;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(document.hidden){stream.getTracks().forEach(t=>t.stop());return;}
    cameraStream=stream;$('camera-feed').srcObject=stream;await $('camera-feed').play();
    game.classList.add('ar-on');$('ar-button').setAttribute('aria-checked','true');message('PartyPoss, right in your world.');
  }catch(error){stopCamera();message(error.name==='NotAllowedError'?'Camera access wasn’t enabled. The meadow is still here.':'Couldn’t start the camera. Try another browser.',3500);}
  finally{cameraPending=false;$('ar-button').disabled=false;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();void audioContext?.suspend();}else if(profile.sound){void audioContext?.resume();}});
window.addEventListener('pagehide',stopCamera);

function drawCover(context,img,x,y,w,h){const sw=img.videoWidth||img.width,sh=img.videoHeight||img.height;const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;context.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function roundedBox(context,x,y,w,h,r,color){context.fillStyle=color;context.beginPath();context.roundRect(x,y,w,h,r);context.fill();}

$('photo-button').addEventListener('click',async()=>{
  if(phase==='loading')return;
  const output=document.createElement('canvas');output.width=720;output.height=Math.round(720*height/width);
  const photo=output.getContext('2d'),w=output.width,h=output.height;
  drawCover(photo,cameraStream?$('camera-feed'):images.meadow,0,0,w,h);
  const sprite=phase==='attacking'?images.attack:images.idle;
  const rect=$('creature').getBoundingClientRect(),scene=game.getBoundingClientRect(),scale=w/width;
  const bw=rect.width*scale,bh=rect.height*scale,fit=Math.min(bw/sprite.width,bh/sprite.height);
  photo.drawImage(sprite,(rect.left-scene.left)*scale+(bw-sprite.width*fit)/2,(rect.top-scene.top)*scale+bh-sprite.height*fit,sprite.width*fit,sprite.height*fit);
  photo.drawImage(canvas,0,0,w,h);
  roundedBox(photo,w*.13,h*.12,w*.74,95,46,'#163c60cb');
  photo.textAlign='center';photo.fillStyle='white';photo.font='600 34px system-ui';photo.fillText('PartyPoss  /  CP 420',w/2,h*.12+42);
  photo.fillStyle='#d5e6ee';photo.font='22px system-ui';photo.fillText('A Birthday Every Day',w/2,h*.12+74);
  if(phase==='attacking'){roundedBox(photo,35,h*.78,w-70,55,27,'#20372cbd');photo.font='600 23px system-ui';photo.fillStyle='#eac1ff';photo.fillText('✦ PartyPoss used Maui Wali! ✦',w/2,h*.78+36);}
  output.toBlob(async blob=>{
    if(!blob){message('Couldn’t save the photo. Please try again.');return;}
    const file=new File([blob],'PartyPoss.png',{type:'image/png'});
    try{
      if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'PartyPoss'});return;}
    }catch(error){if(error.name==='AbortError')return;}
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='PartyPoss.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('Photo saved. A little birthday keepsake!');
  },'image/png');
});

async function loadAssets() {
  $('retry-button').hidden=true;
  try {
    await Promise.all(Object.entries(assetPaths).map(([key,src])=>new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>{images[key]=img;resolve();};img.onerror=()=>reject(new Error(`Could not load ${key}`));img.src=src;
    })));
    $('loader').classList.add('leaving');setTimeout(()=>$('loader').hidden=true,450);
    beginEncounter();
    if(profile.caught===0)message('A wild PartyPoss appeared!',2500);
  } catch {
    $('loader').querySelector('h2').textContent='The meadow hasn’t loaded yet.';
    $('loader').querySelector('p').textContent='Check your connection, then try again.';
    $('retry-button').hidden=false;
  }
}
$('retry-button').addEventListener('click',loadAssets);

// Optional WebMCP integration uses the very same actions as the visible controls.
function registerTools(){
  const context=document.modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const schema={type:'object',properties:{},additionalProperties:false};
  const validate=input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('This tool takes an empty object.');};
  for(const tool of [
    {name:'read_partyposs_game',description:'Read the current encounter, selected ball, and saved catch totals.',annotations:{readOnlyHint:true},execute:input=>{validate(input);return{phase,ballType,berryBoost,caught:profile.caught,xp:profile.xp,berries:profile.berries,ultras:profile.ultras};}},
    {name:'throw_partyposs_ball',description:'Throw the selected ball toward PartyPoss and wait for the capture result. Consumes an Ultra Ball when selected.',execute:async input=>{validate(input);return await throwBall();}},
    {name:'use_partyposs_maui_wali',description:'Trigger the visible Maui Wali attack animation when the encounter is ready and the move has cooled down.',execute:input=>{validate(input);return{started:useMauiWali(),phase};}}
  ]){
    try{void Promise.resolve(context.registerTool({...tool,inputSchema:schema},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Unsupported experimental implementations are optional. */}
  }
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
resize();new ResizeObserver(resize).observe(game);updateControls();requestAnimationFrame(frame);void loadAssets();registerTools();
if('serviceWorker'in navigator&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')navigator.serviceWorker.register('./sw.js').catch(()=>{});
