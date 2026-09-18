import { clamp, loadProfile } from './core.js';

export const SAVE_KEY = 'woodbadge-quest-v2';
export const SPECIES = {
  beaver: {name:'Beaver',type:'Water',atlas:'a',cell:0,number:'01',move:'Tail Splash',special:'Dam Break',hp:43,attack:12,defense:13,color:'#69b7d6',description:'A loyal builder who turns every stream into a home. The first to help, the last to leave.'},
  bobwhite: {name:'Bobwhite',type:'Air',atlas:'a',cell:1,number:'02',move:'Quick Peck',special:'Covey Call',hp:36,attack:15,defense:10,color:'#b7cf8b',description:'Small wings, enormous spirit. Its clear whistle keeps the whole patrol together.'},
  eagle: {name:'Eagle',type:'Air',atlas:'a',cell:2,number:'03',move:'Wing Gust',special:'Sky Dive',hp:40,attack:18,defense:11,color:'#e8bd67',description:'A sharp-eyed trail companion. Nothing escapes its watch from the highest ridge.'},
  fox: {name:'Fox',type:'Fire',atlas:'a',cell:3,number:'04',move:'Ember Pounce',special:'Foxfire',hp:37,attack:17,defense:10,color:'#e79359',description:'Curious, clever, and a little mischievous. A warm spark glows at the tip of its tail.'},
  owl: {name:'Owl',type:'Fairy',atlas:'b',cell:0,number:'05',move:'Moon Peck',special:'Wisdom Wave',hp:40,attack:16,defense:12,color:'#c1a3df',description:'The quiet keeper of woodland wisdom. It sees a way forward when the trail gets dark.'},
  bear: {name:'Bear',type:'Earth',atlas:'b',cell:1,number:'06',move:'Paw Swipe',special:'Honey Guard',hp:51,attack:14,defense:15,color:'#c09b74',description:'A gentle giant with a mighty hug. Honey Guard restores a little health as it strikes.'},
  buffalo: {name:'Buffalo',type:'Earth',atlas:'b',cell:2,number:'07',move:'Hoof Strike',special:'Thunder Herd',hp:55,attack:17,defense:15,color:'#a6ad8a',description:'Steady as the hills. When the herd moves together, even the ground listens.'},
  antelope: {name:'Antelope',type:'Grass',atlas:'b',cell:3,number:'08',move:'Quick Kick',special:'Meadow Rush',hp:39,attack:18,defense:12,color:'#d8c47a',description:'The free spirit of the high meadow. Every bound seems to catch a little sunshine.'},
  partyposs: {name:'PartyPoss',type:'Fairy',number:'09',move:'Birthday Bonk',special:'Maui Wali',hp:54,attack:20,defense:15,color:'#dba7d6',description:'A birthday every day. Maui Wali brings a swirl of leaves, flowers, sparkle, and celebration.'}
};
export const PATROL_IDS = Object.keys(SPECIES).filter(id=>id!=='partyposs');
export const ZONES = [
  {id:'lakeside',name:'Lakeside Lodge',label:'The first trail',description:'Follow the water. Make your first woodland friends.',pool:['beaver','bobwhite','fox'],level:3,trial:'The Fellowship Trial',badge:'Fellowship',symbol:'≈',foes:[['beaver',5],['bobwhite',5]],position:[24,55]},
  {id:'hollow',name:'Whispering Pines',label:'Into the woodland',description:'Follow the lanterns beneath the ancient pines.',pool:['owl','bear','fox'],level:6,trial:'The Wisdom Trial',badge:'Wisdom',symbol:'✦',foes:[['owl',8],['bear',9]],position:[74,44]},
  {id:'ridge',name:'Sunrise Ridge',label:'Above the clouds',description:'The whole valley opens up from the high meadow.',pool:['eagle','buffalo','antelope'],level:9,trial:'The Courage Trial',badge:'Courage',symbol:'△',foes:[['eagle',11],['buffalo',12],['antelope',11]],position:[22,20]}
];
export const TICKETS = [
  {id:'friends',name:'A patrol of your own',detail:'Collect 3 different patrol critters.',goal:3,reward:100,progress:p=>patrolCount(p)},
  {id:'practice',name:'Learning by doing',detail:'Win 3 battles on the trails.',goal:3,reward:150,progress:p=>p.wins},
  {id:'training',name:'Bring out their best',detail:'Train a critter to level 10.',goal:10,reward:200,progress:p=>Math.max(0,...p.roster.map(u=>u.level))},
  {id:'collection',name:'The whole woodland',detail:'Collect all 8 Wood Badge patrol critters.',goal:8,reward:300,progress:p=>patrolCount(p)},
  {id:'trials',name:'A good old critter, too',detail:'Earn all 3 trail badges.',goal:3,reward:300,progress:p=>p.badges.length}
];
export const SHOP = {berries:{name:'Berry',price:25,amount:3,detail:'Three treats for easier catches.',icon:'🍓'},ultras:{name:'Ultra Ball',price:60,amount:2,detail:'Two balls with a better catch chance.',icon:'◉'},potions:{name:'Trail tonic',price:35,amount:2,detail:'Two tonics. Restore 60% health in battle.',icon:'✚'}};
export const maxHP = unit => SPECIES[unit.species].hp + unit.level * 8;
export const nextLevelXP = unit => 45 + unit.level * 22;
export const patrolCount = p => p.roster.filter(u=>u.species!=='partyposs').length;
export const rank = p => Math.min(25,1+Math.floor(p.xp/500));
export function makeUnit(species,level=3) {const unit={species,level:clamp(level,1,25),exp:0,hp:0};unit.hp=maxHP(unit);return unit;}

export function normalizeSave(raw,legacy=null) {
  const valid=raw&&raw.version===2&&typeof raw==='object';
  const p=valid?raw:{};
  const old=loadProfile(legacy);
  const n=(key,fallback,max=1e8)=>Number.isFinite(p[key])?Math.floor(clamp(p[key],0,max)):fallback;
  const roster=[];
  if(valid&&Array.isArray(p.roster))for(const u of p.roster){if(!u||!SPECIES[u.species]||roster.some(r=>r.species===u.species))continue;const unit=makeUnit(u.species,Math.floor(clamp(Number(u.level)||1,1,25)));unit.exp=clamp(Number(u.exp)||0,0,nextLevelXP(unit)-1);unit.hp=clamp(Number.isFinite(u.hp)?u.hp:maxHP(unit),0,maxHP(unit));roster.push(unit);}
  if(!valid&&old.caught>0)roster.push(makeUnit('partyposs',8));
  const team=Array.isArray(p.team)?[...new Set(p.team)].filter(id=>roster.some(u=>u.species===id)).slice(0,3):roster.map(u=>u.species).slice(0,3);
  if(roster.length&&!team.length)team.push(roster[0].species);
  return {
    version:2,roster,team,started:valid&&p.started===true&&roster.length>0,zone:ZONES.some(z=>z.id===p.zone)?p.zone:'lakeside',
    caught:n('caught',old.caught),xp:n('xp',old.xp),throws:n('throws',old.throws),berries:n('berries',old.berries,99),ultras:n('ultras',old.ultras,99),potions:n('potions',5,99),coins:n('coins',120),wins:n('wins',0),
    sound:valid?p.sound===true:old.sound,badges:Array.isArray(p.badges)?[...new Set(p.badges)].filter(id=>ZONES.some(z=>z.id===id)):[],claimed:Array.isArray(p.claimed)?[...new Set(p.claimed)].filter(id=>TICKETS.some(t=>t.id===id)):[],
    visits:Object.fromEntries(ZONES.map(z=>[z.id,Number.isFinite(p.visits?.[z.id])?clamp(Math.floor(p.visits[z.id]),0,1e8):0])),
    catches:Array.isArray(p.catches)?p.catches.filter(c=>c&&SPECIES[c.species]&&Number.isFinite(c.xp)&&Number.isFinite(Date.parse(c.date))).slice(0,30):old.catches.map(c=>({...c,species:'partyposs'})),champion:valid&&p.champion===true
  };
}
function readSave(){let current=null,legacy=null;try{current=JSON.parse(localStorage.getItem(SAVE_KEY));}catch{}try{legacy=JSON.parse(localStorage.getItem('partyposs-save-v1'));}catch{}return normalizeSave(current,legacy);}
export const profile=typeof localStorage==='undefined'?normalizeSave(null):readSave();
export function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(profile));}catch{/* Private browsing can still play for this session. */}if(typeof window!=='undefined')window.dispatchEvent(new Event('profilechange'));}
export const owned = (id,p=profile) => p.roster.find(u=>u.species===id);
export const zoneOpen = (index,p=profile) => index===0||p.badges.includes(ZONES[index-1]?.id);
export const oakOpen = (p=profile) => (p.badges.length===3&&patrolCount(p)===8)||!!owned('partyposs',p);
export function chooseStarter(id,p=profile){if(p.started||!['beaver','bobwhite','fox'].includes(id))return false;const unit=makeUnit(id,5);if(!owned(id,p))p.roster.push(unit);p.team=[id,...p.team.filter(s=>s!==id)].slice(0,3);p.started=true;return true;}
export function gainExperience(unit,amount){const before=unit.level;unit.exp+=Math.max(0,amount);while(unit.level<25&&unit.exp>=nextLevelXP(unit)){unit.exp-=nextLevelXP(unit);unit.level++;unit.hp=Math.min(maxHP(unit),unit.hp+8);}if(unit.level===25)unit.exp=0;return unit.level-before;}
export function rest(p=profile){p.roster.forEach(u=>u.hp=maxHP(u));}
export function setTeam(id,p=profile){if(!owned(id,p))return false;const at=p.team.indexOf(id);if(at>=0){if(p.team.length===1)return false;p.team.splice(at,1);}else{if(p.team.length>=3)return false;p.team.push(id);}return true;}
export function train(id,p=profile){const unit=owned(id,p);if(!unit||unit.level>=25)return false;const price=30+unit.level*5;if(p.coins<price)return false;p.coins-=price;gainExperience(unit,nextLevelXP(unit)-unit.exp);unit.hp=maxHP(unit);return true;}
export function buy(item,p=profile){const offer=SHOP[item];if(!offer||p.coins<offer.price||p[item]>99-offer.amount)return false;p.coins-=offer.price;p[item]+=offer.amount;return true;}
export function claimTicket(id,p=profile){const ticket=TICKETS.find(t=>t.id===id);if(!ticket||p.claimed.includes(id)||ticket.progress(p)<ticket.goal)return false;p.claimed.push(id);p.coins+=ticket.reward;p.berries=Math.min(99,p.berries+3);p.ultras=Math.min(99,p.ultras+1);return true;}
export function scout(zoneId,p=profile,random=Math.random){const index=ZONES.findIndex(z=>z.id===zoneId);if(index<0||!zoneOpen(index,p))return null;const zone=ZONES[index];const missing=zone.pool.filter(id=>!owned(id,p));const pool=missing.length?missing:zone.pool;const species=pool[p.visits[zoneId]%pool.length];p.visits[zoneId]++;p.zone=zoneId;return makeUnit(species,zone.level+Math.floor(random()*3));}
export function awardCatch(species,level,xp,p=profile){if(!SPECIES[species])return null;let unit=owned(species,p);const isNew=!unit;if(isNew){unit=makeUnit(species,level);p.roster.push(unit);if(p.team.length<3)p.team.push(species);}else gainExperience(unit,110+level*8);p.team.filter(id=>id!==species).forEach(id=>gainExperience(owned(id,p),30));p.caught++;p.xp+=xp;p.coins+=isNew?65:30;p.berries=Math.min(99,p.berries+2);p.ultras=Math.min(99,p.ultras+1);p.catches.unshift({species,date:new Date().toISOString(),xp});p.catches=p.catches.slice(0,30);if(species==='partyposs'&&p.badges.length===3&&patrolCount(p)===8)p.champion=true;return{unit,isNew};}

const ADVANTAGE={Fire:'Grass',Grass:'Earth',Earth:'Air',Air:'Water',Water:'Fire'};
export function effectiveness(attacker,defender){if(ADVANTAGE[attacker]===defender)return 1.45;if(ADVANTAGE[defender]===attacker)return .75;return 1;}
export function damage(attacker,defender,special=false,random=Math.random){const a=SPECIES[attacker.species],d=SPECIES[defender.species];const base=(a.attack+attacker.level*2.8)*1.05-(d.defense+defender.level*1.5)*.35;return Math.max(3,Math.round(base*(special?1.65:1)*effectiveness(a.type,d.type)*(.94+random()*.12)));}
export function startBattle(kind,zoneId,enemy,p=profile){const index=ZONES.findIndex(z=>z.id===zoneId);if(index<0||!zoneOpen(index,p)||!p.team.some(id=>owned(id,p)?.hp>0))return null;const queue=kind==='trial'?ZONES[index].foes.map(([id,level])=>makeUnit(id,level)):[{...enemy}];if(queue.some(u=>!SPECIES[u.species]))return null;return{kind,zoneId,queue,index:0,enemy:queue[0],active:p.team.find(id=>owned(id,p)?.hp>0),energy:0,round:0,status:'active',log:kind==='trial'?`${ZONES[index].trial} begins!`:`A wild ${SPECIES[enemy.species].name} steps forward.`,resultPaid:false};}
export function battleTurn(battle,action,p=profile,random=Math.random){
  if(!battle||battle.status!=='active'||typeof action!=='string')return{ok:false};let ally=owned(battle.active,p);if(!ally||ally.hp<=0)return{ok:false};
  if(action==='special'&&battle.energy<3)return{ok:false};if(action==='potion'&&(p.potions<1||ally.hp>=maxHP(ally)))return{ok:false};
  if(!['attack','special','guard','potion'].includes(action)&&!action.startsWith('swap:'))return{ok:false};
  const log=[];let move=null,dealt=0;
  if(action.startsWith('swap:')){const id=action.slice(5);if(!p.team.includes(id)||id===battle.active||owned(id,p).hp<=0)return{ok:false};battle.active=id;ally=owned(id,p);battle.energy=0;log.push(`${SPECIES[id].name} takes the lead.`);}
  else if(action==='potion'){p.potions--;ally.hp=Math.min(maxHP(ally),ally.hp+Math.ceil(maxHP(ally)*.6));log.push(`${SPECIES[ally.species].name} drinks a trail tonic.`);}
  else if(action==='guard'){battle.energy=Math.min(3,battle.energy+1);ally.hp=Math.min(maxHP(ally),ally.hp+Math.ceil(maxHP(ally)*.12));log.push(`${SPECIES[ally.species].name} braces and recovers.`);}
  else{const special=action==='special';move=special?SPECIES[ally.species].special:SPECIES[ally.species].move;dealt=damage(ally,battle.enemy,special,random);battle.enemy.hp=Math.max(0,battle.enemy.hp-dealt);battle.energy=special?0:Math.min(3,battle.energy+1);if(special&&ally.species==='bear')ally.hp=Math.min(maxHP(ally),ally.hp+Math.ceil(maxHP(ally)*.2));log.push(`${SPECIES[ally.species].name} used ${move}! −${dealt} HP.`);if(effectiveness(SPECIES[ally.species].type,SPECIES[battle.enemy.species].type)>1)log.push('Super effective!');}
  battle.round++;
  if(battle.enemy.hp<=0){battle.index++;if(battle.index>=battle.queue.length){battle.status='won';log.push(battle.kind==='trial'?'Trial complete!':'The wild critter is ready to join you.');}else{battle.enemy=battle.queue[battle.index];log.push(`${SPECIES[battle.enemy.species].name} steps forward.`);}battle.log=log.join(' ');return{ok:true,move,dealt};}
  const incoming=damage(battle.enemy,ally,battle.round%4===0,random);const taken=action==='guard'?Math.ceil(incoming*.35):incoming;ally.hp=Math.max(0,ally.hp-taken);log.push(`${SPECIES[battle.enemy.species].name} returns ${taken} damage.`);
  if(ally.hp===0){const next=p.team.find(id=>owned(id,p).hp>0);if(next){battle.active=next;battle.energy=0;log.push(`${SPECIES[next].name} takes over!`);}else{battle.status='lost';log.push('Your patrol needs a rest at camp.');}}
  battle.log=log.join(' ');return{ok:true,move,dealt};
}
export function rewardBattle(battle,p=profile){if(battle.status!=='won'||battle.resultPaid)return null;battle.resultPaid=true;p.wins++;const trial=battle.kind==='trial';const first=trial&&!p.badges.includes(battle.zoneId);if(first)p.badges.push(battle.zoneId);const coins=first?180:trial?70:35;const xp=trial?200:90;p.coins+=coins;p.xp+=xp;p.team.forEach(id=>gainExperience(owned(id,p),trial?180:90));if(first){p.potions=Math.min(99,p.potions+3);p.ultras=Math.min(99,p.ultras+3);}return{coins,xp,first};}
