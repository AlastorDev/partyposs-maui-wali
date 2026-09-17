import test from 'node:test';
import assert from 'node:assert/strict';
import { measureThrow, catchChance, earnedXP, loadProfile } from '../dist/core.js';
const target = {x:0.5,y:0.5};
test('phone swipes and keyboard taps reach PartyPoss', () => {
  for (const [width,height] of [[320,568],[390,844],[430,932],[560,996]]) {
    assert.equal(measureThrow({dx:0,dy:height*.25,width,height},target).hit,true);
    assert.equal(measureThrow({dx:0,dy:0,width,height,tap:true},target).hit,true);
    assert.equal(measureThrow({dx:0,dy:8,width,height},target),null);
    assert.equal(measureThrow({dx:0,dy:-100,width,height},target),null);
    assert.equal(measureThrow({dx:200,dy:150,width,height},target).hit,false);
  }
});
test('invalid gestures cannot corrupt an encounter', () => {
  assert.equal(measureThrow({dx:NaN,dy:100,width:390,height:844},target),null);
  assert.equal(measureThrow({dx:0,dy:100,width:0,height:844},target),null);
});
test('items improve capture chances and third hit guarantees a catch', () => {
  const plain = catchChance({quality:'Great'});
  assert.ok(catchChance({quality:'Great',berry:true}) > plain);
  assert.ok(catchChance({quality:'Great',ultra:true}) > plain);
  assert.ok(catchChance({quality:'Excellent'}) > plain);
  assert.equal(catchChance({hits:3}),1);
  assert.ok(catchChance({quality:'Excellent',berry:true,ultra:true}) <= 1);
});
test('saved data is bounded and corruption gets safe defaults', () => {
  assert.equal(loadProfile(null).berries,12);
  assert.equal(loadProfile({berries:-4,ultras:Infinity}).berries,0);
  assert.equal(loadProfile({berries:-4,ultras:Infinity}).ultras,5);
  assert.equal(loadProfile({catches:[{}, {date:'bad',quality:'Nice',xp:120}]}).catches.length,0);
  assert.equal(earnedXP('Excellent',true),250);
});
