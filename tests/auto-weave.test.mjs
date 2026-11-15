import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoWeaver} from '../public/auto-weave.mjs';
import {createGame,startGame,nearGap,unlock,buildBridge,step} from '../public/core.mjs';

const accepted={accepted:true,source:'gemini-decision',ability:'bridge',label:'Phone'};
function fixture(){
  const game=createGame();startGame(game);game.player.x=500;game.player.y=510;
  let enabled=true,time=0,calls=0,finish,signal;
  const messages=[];
  const flow=createAutoWeaver({clock:()=>time,
    context:()=>enabled&&nearGap(game)>=0?{game,gap:nearGap(game),camera:1}:null,
    request:s=>{calls++;signal=s;return new Promise(resolve=>finish=resolve);},
    result:answer=>{unlock(game,'bridge',answer);buildBridge(game);},
    status:(state,message)=>messages.push({state,message})
  });
  return {game,flow,messages,done:answer=>finish(answer),disable:()=>enabled=false,advance:n=>time+=n,calls:()=>calls,signal:()=>signal};
}
test('live accepted object builds the nearby bridge without a button',async()=>{
  const f=fixture(),pending=f.flow.tick();await f.flow.tick();assert.equal(f.calls(),1);
  f.done(accepted);await pending;assert.deepEqual(f.game.bridges,[0]);assert.equal(f.game.practice,false);
  await f.flow.tick();assert.equal(f.calls(),1);
});
test('rejected object grants nothing and retry is rate limited',async()=>{
  const f=fixture(),pending=f.flow.tick();f.done({...accepted,accepted:false});await pending;
  assert.deepEqual(f.game.bridges,[]);assert.equal(f.game.powers.bridge,undefined);
  await f.flow.tick();assert.equal(f.calls(),1);
  f.advance(1201);const again=f.flow.tick();assert.equal(f.calls(),2);f.done(accepted);await again;
});
test('disabling while a scan is pending aborts and ignores its late success',async()=>{
  const f=fixture(),pending=f.flow.tick();f.disable();await f.flow.tick();
  assert.equal(f.signal().aborted,true);f.done(accepted);await pending;assert.deepEqual(f.game.bridges,[]);
});
test('a result for the previous gap cannot build a different gap',async()=>{
  const f=fixture(),pending=f.flow.tick();f.game.player.x=1450;f.done(accepted);await pending;
  assert.deepEqual(f.game.bridges,[]);assert.equal(f.game.powers.bridge,undefined);
});
test('old inference and manual practice results never automatically build',async()=>{
  const f=fixture(),pending=f.flow.tick();f.advance(9000);f.done(accepted);await pending;
  assert.deepEqual(f.game.bridges,[]);
  const h=fixture(),manual=h.flow.tick();h.done({...accepted,source:'practice'});await manual;
  assert.deepEqual(h.game.bridges,[]);
});
test('billing errors stop live scanning instead of silently looping',async()=>{
  let enabled=true;const game={};const states=[];
  const flow=createAutoWeaver({context:()=>enabled?{game,gap:0,camera:1}:null,
    request:async()=>{throw Object.assign(Error('Credits depleted'),{status:402});},result:()=>assert.fail(),
    status:state=>{states.push(state);if(state==='error')enabled=false;}});
  await flow.tick();await flow.tick();assert.deepEqual(states,['checking','error']);
});
test('edge assist holds the hero until a bridge is woven, then releases movement',()=>{
  const game=createGame();startGame(game);Object.assign(game.player,{x:530,y:510,grounded:true});
  for(let i=0;i<100;i++)step(game,1/60,{move:1,autoWeaveAssist:true});
  assert.ok(game.player.x<=553);assert.equal(game.stats.falls,0);
  unlock(game,'bridge',accepted);buildBridge(game);
  for(let i=0;i<100;i++)step(game,1/60,{move:1,autoWeaveAssist:true});
  assert.ok(game.player.x>950);assert.equal(game.stats.falls,0);
});
