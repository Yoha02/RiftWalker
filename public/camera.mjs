// A granted permission alone is not proof that the camera delivers video.
export function waitForCameraFrames(video, track, {isCurrent=()=>true, timeoutMs=8000, minimumFrames=3}={}) {
  return new Promise((resolve,reject)=>{
    const started=performance.now();let count=0,last=-1,callback=null,watch=null,done=false;
    const finish=(error)=>{
      if(done)return;done=true;clearInterval(watch);
      if(callback!==null)video.cancelVideoFrameCallback?.(callback);
      if(error)return reject(error);
      resolve({verifiedAt:new Date().toISOString(),label:track.label||'Camera',width:video.videoWidth,height:video.videoHeight,observedFrames:count,observationMs:Math.round(performance.now()-started)});
    };
    const sample=time=>{
      if(done)return;
      if(!isCurrent()||track.readyState==='ended')return finish(new Error('Camera connection changed before video could be verified.'));
      if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&Number.isFinite(time)&&time!==last){last=time;count++;}
      if(count>=minimumFrames)finish();
    };
    const frame=(_now,metadata)=>{sample(metadata.mediaTime);if(!done)callback=video.requestVideoFrameCallback(frame);};
    if(video.requestVideoFrameCallback)callback=video.requestVideoFrameCallback(frame);
    watch=setInterval(()=>{
      if(!isCurrent()||track.readyState==='ended')return finish(new Error('Camera connection changed before video could be verified.'));
      if(!video.requestVideoFrameCallback)sample(video.currentTime);
      if(!done&&performance.now()-started>=timeoutMs)finish(new Error('Camera opened but no advancing video frames were verified. Check the camera, close other camera apps, and reconnect.'));
    },50);
  });
}
