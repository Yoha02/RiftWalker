import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateObjectMotion,createPropSwipe} from '../public/object-motion.mjs';
import {objectFromCrop,shiftObject,videoPoint} from '../public/object-tracking.mjs';
import {normalizeObjects} from '../lib/objects.mjs';
import {drawRaid} from '../public/raid-view.mjs';
import {createGame,beginBoss} from '../public/core.mjs';
const W=128,H=72;
const noise=(x,y)=>30+((x*7349+y*3719+x*y*11)%190);
function image(offset=0,thin=false){
  return Uint8Array.from({length:W*H},(_,i)=>{
    const x=i%W,y=Math.floor(i/W),left=48+offset,width=thin?7:30;
    return x>=left&&x<left+width&&y>=20&&y<53?noise(x-left+211,y+119):noise(x,y);
  });
}
test('foreground block matching follows a moved book while the background stays still',()=>{
  const m=estimateObjectMotion(image(0),image(4),W,H);
  assert.ok(m.confidence>=.55);assert.equal(m.dx,4/W);assert.equal(m.dy,0);
});
test('localized thin pen motion works without any hand landmarks',()=>{
  const m=estimateObjectMotion(image(0,true),image(4,true),W,H,[.25,.35,.8,.49]);
  assert.ok(m.confidence>=.55);assert.equal(m.dx,4/W);
});
test('stationary scene and global lighting changes do not produce a swipe',()=>{
  const a=image();assert.equal(estimateObjectMotion(a,a,W,H).confidence,0);
  const bright=Uint8Array.from(a,n=>n+20);assert.equal(estimateObjectMotion(a,bright,W,H).confidence,0);
});
test('whole-camera translation is rejected rather than treated as a weapon swing',()=>{
  const a=Uint8Array.from({length:W*H},(_,i)=>noise(i%W,Math.floor(i/W)));
  const b=Uint8Array.from({length:W*H},(_,i)=>noise(i%W-4,Math.floor(i/W)));
  const m=estimateObjectMotion(a,b,W,H);assert.equal(m.confidence,0);assert.equal(m.cameraMoved,true);
});
test('swipe requires an armed prop, accumulated travel and cooldown; reset discards travel',()=>{
  const s=createPropSwipe(),motion={confidence:1,dx:.04,dy:0};
  assert.equal(s.update(motion,100,false),false);assert.equal(s.update(motion,180,true),false);assert.equal(s.update(motion,260,true),true);
  for(let now=340;now<800;now+=80)assert.equal(s.update(motion,now,true),false);
  s.reset();assert.equal(s.update(motion,1000,true),false);assert.equal(s.update(motion,1080,true),true);
  s.reset();assert.equal(s.update({...motion,confidence:.2},1200,true),false);
});
test('pause or lost frames cannot complete a pre-pause swipe',()=>{
  const s=createPropSwipe(),m={confidence:1,dx:.04,dy:0};
  assert.equal(s.update(m,100,true),false);assert.equal(s.update(m,800,true),false);assert.equal(s.update(m,880,true),false);
});
test('untrusted locator geometry is validated and cannot grant powers',()=>{
  const objects=normalizeObjects({objects:[{label:'book',roles:['shield','admin'],box_2d:[100,200,800,700],outline:[[200,100],[700,100],[700,800],[200,800]]},{roles:['strike'],box_2d:[0,900,0,200]}]});
  assert.equal(objects.length,1);assert.deepEqual(objects[0].roles,['shield']);assert.equal(objects[0].powers,undefined);
  assert.throws(()=>normalizeObjects({objects:'bad'}));
  assert.deepEqual(normalizeObjects({objects:[{roles:['shield'],box_2d:[0,0,1000,1000]}]}),[]);
});
test('crop coordinates map back to mirrored video correctly, and local shifts stay bounded',()=>{
  const item=normalizeObjects({objects:[{label:'pen',roles:['strike'],box_2d:[100,200,800,700]}]})[0];
  const tracked=objectFromCrop(item,1280,720,100);
  assert.ok(Math.abs(tracked.box[1]-.3396875)<.00001);assert.equal(tracked.expiresAt,4600);
  const mirrored=videoPoint(tracked.box[1],tracked.box[0],1280,720);
  assert.ok(Math.abs(mirrored.x-(1-tracked.box[1]))<.00001);
  const moved=shiftObject(tracked,{confidence:1,dx:.9,dy:0});assert.equal(moved.box[3],1);
  assert.equal(shiftObject(tracked,{confidence:0,dx:.5,dy:.5}),tracked);
});
test('renderer composites a real prop after drawing the boss, with balanced canvas saves',()=>{
  const calls=[];let balance=0;
  const ctx=new Proxy({}, {get:(_,key)=>{
    if(key==='createRadialGradient'||key==='createLinearGradient')return ()=>({addColorStop(){}});
    return (...args)=>{calls.push(key);if(key==='save')balance++;if(key==='restore')balance--;};
  },set:()=>true});
  const g=createGame();beginBoss(g);
  drawRaid(ctx,g,{readyState:2,videoWidth:1280,videoHeight:720},null,[{roles:['shield'],outline:[[.6,.3],[.8,.3],[.8,.7],[.6,.7]]}]);
  const draws=calls.flatMap((c,i)=>c==='drawImage'?[i]:[]);assert.equal(draws.length,2);
  assert.ok(calls.slice(draws[0],draws[1]).filter(c=>c==='fill').length>50);assert.equal(balance,0);
});
