import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandLoader} from '../public/hand-loader.mjs';

test('rapid toggles share startup and both callers receive a ready model',async()=>{
  let finish,calls=0;
  const model={close(){}};
  const loader=createHandLoader(()=>{calls++;return new Promise(resolve=>finish=resolve);});
  const first=loader.load(),second=loader.load();
  assert.equal(first,second);finish(model);
  assert.equal((await second).model,model);assert.equal(calls,1);
});
test('GPU startup failure automatically falls back to CPU',async()=>{
  const calls=[];
  const loader=createHandLoader(async delegate=>{calls.push(delegate);if(delegate==='GPU')throw Error('WebGL unavailable');return {};});
  assert.equal((await loader.load()).delegate,'CPU');assert.deepEqual(calls,['GPU','CPU']);
});
test('GPU inference failure can replace the model with CPU once',async()=>{
  let closed=0,calls=[];
  const loader=createHandLoader(async delegate=>{calls.push(delegate);return {close(){closed++;}};});
  await loader.load();assert.equal((await loader.load(true)).delegate,'CPU');
  await loader.load(true);assert.equal(closed,1);assert.deepEqual(calls,['GPU','CPU']);
});
test('failed asset load can be retried',async()=>{
  let unavailable=true;
  const loader=createHandLoader(async()=>{if(unavailable)throw Error('offline');return {};});
  await assert.rejects(loader.load(),/offline/);unavailable=false;
  assert.ok((await loader.load()).model);
});
