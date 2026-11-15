import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,beginBoss,step,unlock,retry} from '../public/core.mjs';
import {observeLiveItem,currentLivePowers,clearLiveItem} from '../public/live-items.mjs';
import {normalizeDecisions} from '../lib/decision.mjs';
const sample=powers=>({source:'gemini-decision',acceptedAbilities:powers,label:'Held prop'});
test('one decision response unlocks only independently accepted properties',()=>{
  const raw={answers:Object.fromEntries(['visible','bridge','shield','reflect','strike'].map(k=>[k,{type:'noul',noul:k==='reflect'?.1:.95,confidence:.9}]))};
  assert.deepEqual(normalizeDecisions(raw,'bridge').acceptedAbilities,['bridge','shield','strike']);
  raw.answers.visible.noul=.4;assert.deepEqual(normalizeDecisions(raw,'bridge').acceptedAbilities,[]);
});
test('newly shown props replace held powers, empty frames clear them, and results expire',()=>{
  const g=createGame();observeLiveItem(g,sample(['shield']),100);
  assert.deepEqual(currentLivePowers(g,101),{shield:true});
  observeLiveItem(g,sample(['strike']),200);assert.deepEqual(currentLivePowers(g,201),{strike:true});
  assert.deepEqual(currentLivePowers(g,4700),{});
  observeLiveItem(g,sample(['shield']),5000);observeLiveItem(g,sample([]),5100);assert.deepEqual(currentLivePowers(g,5101),{});
  observeLiveItem(g,sample(['shield']),6000);clearLiveItem(g);assert.deepEqual(currentLivePowers(g,6001),{});
});
test('practice values cannot masquerade as a live held item',()=>{
  const g=createGame();assert.equal(observeLiveItem(g,{...sample(['shield']),source:'practice'},100),false);assert.deepEqual(currentLivePowers(g,100),{});
});
test('live book shields automatically without a guard button and returns an orb',()=>{
  const g=createGame();beginBoss(g);g.player.invuln=0;g.raid.bolts.push({depth:.66,lane:0,kind:'orbs',returning:false});
  step(g,1/60,{liveMode:true,livePowers:{shield:true},pointer:{x:.3,y:.6}});
  assert.equal(g.player.hp,5);assert.equal(g.stats.reflects,1);assert.equal(g.raid.bolts[0].returning,true);
  assert.equal(g.raid.bolts[0].shieldPoint.x,.3);
  for(let i=0;i<60;i++)step(g,1/60,{liveMode:true,livePowers:{shield:true}});
  assert.equal(g.boss.hp,134);
});
test('old inventory shields do not protect when the current live item is a pen',()=>{
  const g=createGame();beginBoss(g);unlock(g,'shield',{label:'book',source:'gemini-decision'});g.player.invuln=0;
  g.raid.bolts.push({depth:.66,lane:0,kind:'orbs',returning:false});
  step(g,1/60,{liveMode:true,livePowers:{strike:true},guard:true});assert.equal(g.player.hp,4);assert.equal(g.stats.blocks,0);
});
test('live strikes require a fresh attack prop and one swipe yields one hit',()=>{
  const g=createGame();beginBoss(g);g.boss.state='exposed';g.boss.timer=60;
  step(g,1/60,{liveMode:true,livePowers:{},attack:true});assert.equal(g.boss.hp,150);
  step(g,1/60,{liveMode:true,livePowers:{strike:true},attack:false});
  for(let i=0;i<50;i++)step(g,1/60,{liveMode:true,livePowers:{strike:true},attack:true});
  assert.equal(g.boss.hp,126);assert.ok(g.raid);
});
test('pinch dodge avoids incoming damage and retry resets first-person effects',()=>{
  const g=createGame();beginBoss(g);g.player.invuln=0;g.raid.bolts.push({depth:.66,lane:0,kind:'orbs',returning:false});
  step(g,1/60,{jump:true,liveMode:true,livePowers:{}});assert.equal(g.player.hp,5);
  g.phase='dead';g.raid.slash=.3;retry(g);assert.equal(g.raid.slash,0);assert.equal(g.raid.bolts.length,0);assert.equal(g.boss.hp,150);
});
test('a single blurry frame has bounded grace, repeated misses cannot maintain a shield',()=>{
  const g=createGame();observeLiveItem(g,sample(['shield']),100);
  const blurry={...sample([]),answers:{visible:{probability:.6},shield:{probability:.6}}};
  observeLiveItem(g,blurry,1000);assert.deepEqual(currentLivePowers(g,1900),{shield:true});assert.deepEqual(currentLivePowers(g,2000),{});
  observeLiveItem(g,sample(['shield']),3000);observeLiveItem(g,blurry,3100);observeLiveItem(g,blurry,3200);assert.deepEqual(currentLivePowers(g,3201),{});
  observeLiveItem(g,sample(['shield']),4000);observeLiveItem(g,{...blurry,answers:{visible:{probability:.1},shield:{probability:.1}}},4100);assert.deepEqual(currentLivePowers(g,4101),{});
});
test('the live boss waits for a usable item once, then progresses even after it is removed',()=>{
  const g=createGame();beginBoss(g);
  for(let i=0;i<900;i++)step(g,1/60,{liveMode:true,livePowers:{}});
  assert.equal(g.boss.state,'intro');assert.equal(g.player.hp,5);assert.equal(g.raid.awaitingItem,true);
  step(g,1/60,{liveMode:true,livePowers:{strike:true}});
  for(let i=0;i<150;i++)step(g,1/60,{liveMode:true,livePowers:{}});
  assert.equal(g.boss.state,'windup');assert.equal(g.raid.awaitingItem,false);
});
test('simultaneous book and pen allow a swipe and a reflection in the same frame',()=>{
  const g=createGame();beginBoss(g);g.boss.state='exposed';g.boss.timer=4;
  g.raid.bolts.push({depth:.66,lane:0,kind:'orbs',returning:false});
  step(g,1/60,{liveMode:true,livePowers:{shield:true,strike:true},attack:true,swipeDirection:-1});
  assert.equal(g.boss.hp,126);assert.equal(g.stats.blocks,1);assert.equal(g.player.hp,5);assert.equal(g.raid.slashDirection,-1);
});
