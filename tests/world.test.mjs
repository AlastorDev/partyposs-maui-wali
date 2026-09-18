import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIES,PATROL_IDS,ZONES,TICKETS,normalizeSave,chooseStarter,owned,makeUnit,maxHP,patrolCount,zoneOpen,oakOpen,scout,awardCatch,gainExperience,nextLevelXP,setTeam,rest,train,buy,claimTicket,effectiveness,startBattle,battleTurn,rewardBattle} from '../dist/world.js';
const fresh=()=>normalizeSave(null);
test('original PartyPoss progress migrates without losing items, XP or captures',()=>{
  const p=normalizeSave(null,{caught:7,xp:1340,throws:18,berries:9,ultras:2,sound:true,catches:[{date:'2026-09-17T00:00:00Z',quality:'Great',xp:170}]});
  assert.equal(p.caught,7);assert.equal(p.xp,1340);assert.equal(p.berries,9);assert.equal(p.ultras,2);assert.equal(owned('partyposs',p).level,8);assert.equal(p.catches[0].species,'partyposs');assert.ok(oakOpen(p));
});
test('corrupt save fields and duplicate roster entries normalize safely',()=>{
  const p=normalizeSave({version:2,coins:-200,potions:999,roster:[{species:'nope'},null,{species:'fox',level:99,hp:-8},{species:'fox',level:2}],team:['fox','bad','fox'],badges:['ridge','ridge','invalid']});
  assert.equal(p.coins,0);assert.equal(p.potions,99);assert.equal(p.roster.length,1);assert.equal(p.roster[0].level,25);assert.equal(p.roster[0].hp,0);assert.deepEqual(p.team,['fox']);assert.deepEqual(p.badges,['ridge']);
});
test('starter can only be chosen once and becomes patrol lead',()=>{const p=fresh();assert.equal(chooseStarter('owl',p),false);assert.ok(chooseStarter('fox',p));assert.equal(chooseStarter('beaver',p),false);assert.equal(p.team[0],'fox');assert.equal(owned('fox',p).level,5);});
test('trails remain locked until the preceding trial is completed',()=>{const p=fresh();chooseStarter('beaver',p);assert.equal(scout('hollow',p),null);assert.equal(p.visits.hollow,0);assert.equal(startBattle('trial','ridge',null,p),null);p.badges.push('lakeside');assert.ok(zoneOpen(1,p));assert.ok(scout('hollow',p));assert.equal(zoneOpen(2,p),false);});
test('exploration favors undiscovered critters and duplicate catches train instead of duplicating',()=>{const p=fresh();chooseStarter('beaver',p);for(let i=0;i<2;i++){const u=scout('lakeside',p,()=>0);awardCatch(u.species,u.level,120,p);}assert.equal(patrolCount(p),3);const unit=owned('beaver',p),before=unit.exp;awardCatch('beaver',3,120,p);assert.equal(p.roster.length,3);assert.ok(unit.exp>before||unit.level>5);assert.equal(p.team.length,3);});
test('team caps, training costs, healing and supply purchases cannot create invalid inventory',()=>{const p=fresh();chooseStarter('beaver',p);for(const id of ['fox','owl','bear'])awardCatch(id,4,120,p);assert.equal(setTeam('bear',p),false);assert.ok(setTeam('fox',p));assert.ok(setTeam('bear',p));const u=owned('bear',p);u.hp=0;rest(p);assert.equal(u.hp,maxHP(u));const coins=p.coins;assert.ok(train('bear',p));assert.equal(u.level,5);assert.equal(p.coins,coins-50);p.coins=0;assert.equal(buy('potions',p),false);assert.equal(train('bear',p),false);});
test('ticket rewards are claimed exactly once',()=>{const p=fresh();chooseStarter('beaver',p);awardCatch('fox',3,120,p);awardCatch('bobwhite',3,120,p);const coins=p.coins;assert.ok(claimTicket('friends',p));assert.equal(p.coins,coins+100);assert.equal(claimTicket('friends',p),false);assert.equal(claimTicket('trials',p),false);});
test('type advantage and energy change battle outcomes',()=>{assert.ok(effectiveness('Water','Fire')>1);assert.ok(effectiveness('Fire','Water')<1);assert.equal(effectiveness('Fairy','Air'),1);const p=fresh();chooseStarter('beaver',p);const battle=startBattle('wild','lakeside',makeUnit('bear',15),p);assert.equal(battleTurn(battle,'special',p).ok,false);for(let i=0;i<3;i++)battleTurn(battle,'guard',p,()=>0);assert.equal(battle.energy,3);if(battle.status==='active'){assert.ok(battleTurn(battle,'special',p,()=>0).ok);assert.equal(battle.energy,0);}});
test('defeat and exhausted supplies have a safe recovery path',()=>{const p=fresh();chooseStarter('fox',p);p.potions=0;const battle=startBattle('wild','lakeside',makeUnit('partyposs',25),p);assert.equal(battleTurn(battle,'potion',p).ok,false);for(let i=0;i<20&&battle.status==='active';i++)battleTurn(battle,'attack',p,()=>1);assert.equal(battle.status,'lost');assert.equal(startBattle('trial','lakeside',null,p),null);rest(p);assert.ok(startBattle('trial','lakeside',null,p));});
test('full campaign can unlock all trails, collect eight critters, and finish with PartyPoss',()=>{
  const p=fresh();chooseStarter('beaver',p);let turns=0;
  for(let index=0;index<ZONES.length;index++){
    const zone=ZONES[index];for(let i=0;i<zone.pool.length;i++){const u=scout(zone.id,p,()=>.5);awardCatch(u.species,u.level,170,p);}
    for(const t of TICKETS)claimTicket(t.id,p);
    p.team=p.roster.filter(u=>u.species!=='partyposs').sort((a,b)=>b.level-a.level).slice(0,3).map(u=>u.species);
    for(const id of p.team)while(owned(id,p).level<zone.level+4&&train(id,p)){}
    rest(p);const battle=startBattle('trial',zone.id,null,p);
    while(battle.status==='active'&&turns<250){const unit=owned(battle.active,p);const move=unit.hp<maxHP(unit)*.38&&p.potions>0?'potion':battle.energy>=3?'special':'attack';battleTurn(battle,move,p,()=>.5);turns++;}
    assert.equal(battle.status,'won',`${zone.name}: ${battle.log}`);assert.ok(rewardBattle(battle,p));assert.equal(rewardBattle(battle,p),null);assert.ok(p.badges.includes(zone.id));
  }
  assert.equal(patrolCount(p),8);assert.equal(p.badges.length,3);assert.ok(oakOpen(p));awardCatch('partyposs',12,250,p);assert.ok(p.champion);assert.equal(p.roster.length,9);assert.ok(turns<100);
});
test('level cap is stable under large experience awards',()=>{const u=makeUnit('eagle',24);gainExperience(u,1e6);assert.equal(u.level,25);assert.equal(u.exp,0);assert.ok(u.hp<=maxHP(u));assert.equal(PATROL_IDS.length,8);assert.equal(Object.keys(SPECIES).length,9);});
