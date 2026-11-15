import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForCameraFrames} from '../public/camera.mjs';
function fixture(){let callback;return {video:{readyState:2,videoWidth:1280,videoHeight:720,requestVideoFrameCallback(fn){callback=fn;return 1;},cancelVideoFrameCallback(){callback=null;}},track:{label:'Test external camera',readyState:'live'},frame(time){callback?.(performance.now(),{mediaTime:time});}};}
test('camera verification requires three advancing decoded frames',async()=>{const f=fixture();const result=waitForCameraFrames(f.video,f.track);f.frame(1);f.frame(1);f.frame(2);f.frame(3);const evidence=await result;assert.equal(evidence.observedFrames,3);assert.equal(evidence.width,1280);assert.equal(evidence.label,'Test external camera');});
test('permission with a frozen stream does not verify camera',async()=>{const f=fixture();const result=waitForCameraFrames(f.video,f.track,{timeoutMs:10});f.frame(1);f.frame(1);await assert.rejects(result,/no advancing video/);});
test('switching camera invalidates a pending verification',async()=>{const f=fixture();let current=true;const result=waitForCameraFrames(f.video,f.track,{isCurrent:()=>current});f.frame(1);current=false;f.frame(2);await assert.rejects(result,/connection changed/);});
test('ended camera cannot be reported as verified',async()=>{const f=fixture();const result=waitForCameraFrames(f.video,f.track);f.track.readyState='ended';f.frame(1);await assert.rejects(result,/connection changed/);});
