import {observeLiveItem,currentLivePowers,clearLiveItem} from './live-items.mjs';
import {drawRaid} from './raid-view.mjs';
import {estimateObjectMotion,createPropSwipe} from './object-motion.mjs';
import {objectFromCrop,shiftObject,videoPoint} from './object-tracking.mjs';
import {createAutoWeaver} from './auto-weave.mjs';
import {createHandLoader} from './hand-loader.mjs';
import {waitForCameraFrames} from './camera.mjs';
import {createGame,startGame,beginBoss,step,unlock,buildBridge,nearGap,retry,objective,platforms,GAPS,POWER_INFO,VIEW} from './core.mjs';
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
let g=createGame(),paused=false,muted=true,audio=null,lastTime=performance.now(),lastUI=0,lastEvent='',api={configured:false};
const keys=new Set();let keyPulses={jump:false,attack:false,build:false};let stream=null,handModel=null,handReady=false,handDelegate='GPU',lastHandFrame=0,lastVideoTime=-1,handX=.5,neutral=.5,lastHandX=.5,lastHandAt=0,lastSwipe=0;
let handInput={move:0,jump:false,guard:false,attack:false},captured=null,selectedAbility='bridge',scanResult=null,scanBusy=false,scanGeneration=0,handGeneration=0,cameraGeneration=0;
let handPoint={x:.5,y:.65};let lastGesture='none';const scans=[];let cameraEvidence=null;
const motionCanvas=document.createElement('canvas');motionCanvas.width=128;motionCanvas.height=72;
const motionCtx=motionCanvas.getContext('2d',{willReadFrequently:true}),propSwipe=createPropSwipe();
let previousMotion=null,motionAt=0,motionVideoTime=-1,propAttack=false,propDirection=1,propPoint=null,propPointAt=0,motionStrength=0;
let trackedObjects=[],locatorMessage='Show your held objects in the camera guide.';
function resetMotion(){previousMotion=null;motionVideoTime=-1;propAttack=false;propPoint=null;motionStrength=0;propSwipe.reset();}
const esc=s=>String(s); // All untrusted model strings are assigned with textContent.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const timeLabel=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function notify(text,kind='info'){g.events.push({text,kind,time:g.time});if(g.events.length>40)g.events.shift();}
function blip(freq=480,type='sine',length=.1){if(muted)return;try{audio ||= new AudioContext();audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.55,audio.currentTime+length);gain.gain.setValueAtTime(.045,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+length);}catch{}}
function modalOpen(){return $('scan-dialog').open||$('help-dialog').open;}
function setPause(value){resetMotion();if(value){objectLocator.cancel();trackedObjects=[];}if(value){autoWeaver.cancel();clearLiveItem(g);}paused=value;keys.clear();keyPulses={jump:false,attack:false,build:false};handInput={move:0,jump:false,guard:false,attack:false};$('pause-overlay').hidden=!value||g.phase==='title'||g.phase==='dead'||g.phase==='won';$('pause').textContent=value?'▶':'Ⅱ';}
function runStart(){startGame(g);$('title-overlay').hidden=true;setPause(false);canvas.focus();blip(650);}
$('start').onclick=runStart;$('boss-demo').onclick=()=>{autoWeaver.reset();clearLiveItem(g);startGame(g);beginBoss(g);$('title-overlay').hidden=true;$('end-overlay').hidden=true;setPause(false);canvas.focus();};$('pause').onclick=()=>setPause(!paused);$('resume').onclick=()=>{setPause(false);canvas.focus();};
$('retry').onclick=()=>{autoWeaver.reset();if(g.phase==='dead')retry(g);else{g=createGame();scans.length=0;lastEvent='';startGame(g);}setPause(false);$('end-overlay').hidden=true;canvas.focus();refreshPowers();};
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));blip(550);};
$('help').onclick=()=>{$('help-dialog').showModal();keys.clear();keyPulses={jump:false,attack:false,build:false};};$('help-close').onclick=()=>$('help-dialog').close();
$('weave').onclick=()=>{if(!modalOpen()&&!paused){if(buildBridge(g))blip(720,'sine',.5);canvas.focus();}};
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(e.key==='Escape'){if(modalOpen())return;setPause(!paused);return;}if(e.key==='?'&&!modalOpen()){$('help-dialog').showModal();return;}if(modalOpen())return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','KeyA','KeyD','KeyW','KeyE','KeyJ','KeyK'].includes(e.code)){e.preventDefault();keys.add(e.code);if(!e.repeat){if(['Space','ArrowUp','KeyW'].includes(e.code))keyPulses.jump=true;if(e.code==='KeyJ')keyPulses.attack=true;if(e.code==='KeyE')keyPulses.build=true;}}if(e.code==='KeyB'&&!e.repeat)openScan();});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();keyPulses={jump:false,attack:false,build:false};handInput={move:0,jump:false,guard:false,attack:false};});document.addEventListener('visibilitychange',()=>{if(document.hidden&&g.phase!=='title')setPause(true);});
function refreshPowers(){
  $('powers').replaceChildren();
  for(const [key,p] of Object.entries(POWER_INFO)){const power=g.powers[key],b=el('button',`power-tile${power?' unlocked':''}`);b.style.setProperty('--power',p.colour);b.append(el('span','glyph',p.symbol),el('strong','',p.name),el('small','',power?power.label:'Not yet borrowed'),el('span','power-state',power?'✓':'+'));b.setAttribute('aria-label',`${p.name}: ${power?power.label:'not borrowed'}. Open scanner.`);b.onclick=()=>openScan(key);$('powers').append(b);}
  $('power-count').textContent=`${Object.keys(g.powers).length} / 4`;
}
for(const [key,label] of Object.entries({bridge:'Notebook → bridge',shield:'Cardboard → shield',reflect:'Spoon → reflect',strike:'Pen → strike'})){const b=el('button','',label);b.onclick=()=>{$('auto-weave').checked=false;autoWeaver.reset();clearLiveItem(g);unlock(g,key,{label:label.split(' → ')[0],source:'practice',flavour:'Manually selected practice item.'});refreshPowers();blip(500);};$('practice-items').append(b);}
function refreshUI(){
  document.body.classList.toggle('raid-mode',!!g.raid);
  $('health').textContent=Array.from({length:5},(_,i)=>i<g.player.hp?'♥':'♡').join(' ');$('health').setAttribute('aria-label',`${g.player.hp} of 5 health`);$('shards').textContent=`✦ ${g.shards.filter(s=>s.taken).length} / 5`;$('timer').textContent=timeLabel(g.time);
  const boss=!!g.boss;$('boss-controls').hidden=!boss;$('traverse-controls').hidden=boss;$('chapter-number').textContent=boss?'CHAPTER 02 / 02':'CHAPTER 01 / 02';$('chapter-title').textContent=boss?'The Warden has crossed over.':'The Broken Reach';$('step-reach').classList.toggle('active',!boss);$('step-warden').classList.toggle('active',boss);
  $('boss-hud').hidden=!boss||g.phase==='won'||g.phase==='dead';if(boss){$('boss-health').style.width=`${g.boss.hp/g.boss.maxHp*100}%`;$('boss-state').textContent=g.raid?.awaitingItem?'SHOW A BOOK OR PEN TO BEGIN':g.boss.state==='exposed'?'CORE EXPOSED — STRIKE':g.boss.state==='windup'?`${g.boss.attack==='beam'?'RIFT BEAM':'ORB VOLLEY'} IN ${Math.max(0,g.boss.timer).toFixed(1)}s`:g.boss.state.toUpperCase();}
  let [title,detail]=objective(g);if($('auto-weave').checked&&api.configured&&g.phase==='traverse'&&g.bridges.length<2){title='Show an object. Mend the rift.';detail='Approach a glowing gap and hold a phone, notebook or ruler inside the camera guide. The bridge weaves automatically.';}$('objective-title').textContent=title;$('objective-detail').textContent=detail;
  const text=g.practice?'PRACTICE RUN':g.stats.scans?'LIVE GEMINI RUN':'LOCAL ADVENTURE';$('run-label').textContent=`${text} ✦`;
  $('weave').disabled=g.phase!=='traverse';$('weave').hidden=boss;
  const latest=g.events.at(-1);if(latest&&latest.text!==lastEvent){lastEvent=latest.text;$('latest-event').textContent=latest.text;$('world-caption').textContent=latest.text;if(['power','shard','win'].includes(latest.kind))blip(latest.kind==='win'?800:600,'sine',.25);}
  if(g.phase==='won'||g.phase==='dead'){$('end-overlay').hidden=false;$('end-kicker').textContent=g.phase==='won'?'RIFT MENDED':'YOUR LIGHT IS STILL HERE';$('end-title').textContent=g.phase==='won'?'You brought a world back.':'One more try, little light.';$('end-stats').textContent=`${timeLabel(g.time)} · ${g.shards.filter(s=>s.taken).length}/5 light fragments · ${g.stats.blocks} blocks · ${g.stats.reflects} reflections`;$('end-source').textContent=g.practice?'Practice run · includes manually selected items':g.stats.scans?'Powers evaluated with Gemini Decision':'No AI-evaluated powers used';$('retry').textContent=g.phase==='won'?'Journey again ↗':'Retry encounter ↗';}
}
// Camera: live capture and local hand tracking. Cloud scans are separate explicit actions.
async function listCameras(){if(!navigator.mediaDevices?.enumerateDevices)throw new Error('Camera access needs localhost or HTTPS in a supported browser.');const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');const selected=stream?.getVideoTracks()[0]?.getSettings().deviceId||$('camera-select').value;$('camera-select').replaceChildren();for(const [i,d] of devices.entries()){const option=el('option','',d.label||`Camera ${i+1}`);option.value=d.deviceId;$('camera-select').append(option);}if(devices.some(d=>d.deviceId===selected))$('camera-select').value=selected;return devices;}
function clearHand(){handInput={move:0,jump:false,guard:false,attack:false};lastHandAt=0;lastGesture='none';const c=$('hand-overlay');c.getContext('2d').clearRect(0,0,c.width,c.height);}
function stopCamera(){resetMotion();objectLocator.cancel();trackedObjects=[];autoWeaver.cancel();clearLiveItem(g);cameraEvidence=null;cameraGeneration++;handGeneration++;handReady=false;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('camera').srcObject=null;$('camera-placeholder').hidden=false;$('camera-badge').textContent='OFFLINE';$('camera-badge').classList.remove('live');$('camera-caption').textContent='NO CAMERA CONNECTED';$('camera-start').disabled=false;$('camera-start').textContent='Connect camera';$('camera-stop').disabled=true;$('hand-toggle').checked=false;$('hand-toggle').disabled=true;$('calibrate').disabled=true;$('tracking-status').textContent='Keyboard controls ready';clearHand();}
async function connectCamera(deviceId=''){
  stopCamera();const generation=++cameraGeneration;$('camera-start').disabled=true;$('camera-detail').textContent='Waiting for camera permission…';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Open this game at localhost in Chrome or Edge to access the camera.');
    const next=await navigator.mediaDevices.getUserMedia({video:deviceId?{deviceId:{exact:deviceId},width:{ideal:1280},height:{ideal:720}}:{width:{ideal:1280},height:{ideal:720}},audio:false});
    if(generation!==cameraGeneration){next.getTracks().forEach(t=>t.stop());return;}
    stream=next;const video=$('camera'),track=next.getVideoTracks()[0];video.srcObject=next;
    track.onended=()=>{if(stream===next){stopCamera();$('camera-detail').textContent='Camera disconnected. Reconnect or continue with keyboard.';}};
    $('camera-stop').disabled=false;$('camera-badge').textContent='CHECKING';$('camera-detail').textContent='Checking that video frames are arriving...';
    await video.play();if(generation!==cameraGeneration)return;
    $('camera-placeholder').hidden=true;await listCameras();
    const evidence=await waitForCameraFrames(video,track,{isCurrent:()=>generation===cameraGeneration});
    if(generation!==cameraGeneration)return;cameraEvidence=evidence;
    $('camera-badge').textContent='VERIFIED';$('camera-badge').classList.add('live');$('camera-caption').textContent=track.label||'CAMERA LIVE';
    $('camera-detail').textContent=`${evidence.label} / ${evidence.width} x ${evidence.height} / advancing video verified`;
    $('hand-toggle').disabled=false;$('hand-toggle').checked=true;enableHands();$('camera-start').textContent='Reconnect';$('camera-start').disabled=false;
    notify(`Camera frames verified: ${evidence.label}. Select your external device if this is the built-in camera.`);
  }catch(e){if(generation!==cameraGeneration)return;stopCamera();$('camera-detail').textContent=e.name==='NotAllowedError'?'Camera permission was denied. Allow camera access for this localhost page, then reconnect.':e.name==='NotFoundError'?'No camera was found. Check the external camera connection.':e.name==='NotReadableError'?'Camera is busy. Close other apps using it, then reconnect.':e.message;}
}
$('camera-start').onclick=()=>connectCamera($('camera-select').value);$('camera-stop').onclick=stopCamera;$('camera-select').onchange=()=>{if(stream)connectCamera($('camera-select').value);};navigator.mediaDevices?.addEventListener?.('devicechange',()=>listCameras().catch(()=>{}));
const handLoader=createHandLoader(async delegate=>{
  const {FilesetResolver,HandLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
  return HandLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate},
    runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5
  });
});
function handFailure(error){
  handReady=false;clearHand();$('hand-toggle').checked=false;$('calibrate').disabled=true;
  $('tracking-status').textContent=`Hand tracker error: ${String(error?.message||error).slice(0,240)}. Toggle Hand controls to retry.`;
}
async function enableHands(cpuOnly=false){
  const generation=++handGeneration;handReady=false;clearHand();$('calibrate').disabled=true;
  $('tracking-status').textContent=cpuOnly?'Retrying hand tracking on CPU...':'Loading hand tracker (internet required)...';
  const slow=setTimeout(()=>{if(generation===handGeneration&&!handReady)$('tracking-status').textContent='Still downloading hand tracker. Check internet access; switch Hand controls off/on to retry.';},15000);
  try{
    const ready=await handLoader.load(cpuOnly);
    if(generation!==handGeneration||!stream||!$('hand-toggle').checked)return;
    handModel=ready.model;handDelegate=ready.delegate;lastVideoTime=-1;lastHandFrame=0;neutral=.5;handReady=true;
    $('calibrate').disabled=false;$('tracking-status').textContent=`Ready (${handDelegate}). Show your whole hand, then Center hand.`;
  }catch(error){if(generation===handGeneration)handFailure(error);}finally{clearTimeout(slow);}
}
$('hand-toggle').onchange=()=>{
  if(!$('hand-toggle').checked){handGeneration++;handReady=false;clearHand();$('tracking-status').textContent='Hand controls off';$('calibrate').disabled=true;return;}
  if(!stream){$('hand-toggle').checked=false;$('tracking-status').textContent='Connect your camera first.';return;}
  enableHands();
};
$('calibrate').onclick=()=>{if(lastHandAt&&performance.now()-lastHandAt<600){neutral=handX;notify('Hand centered. Pinch to jump; open palm to guard.');blip(450);}else $('tracking-status').textContent='Show one hand before centering.';};
function trackHand(now){
  if(!handReady||!handModel||!stream||!$('hand-toggle').checked)return;
  const v=$('camera');if(v.readyState<2||now-lastHandFrame<80||v.currentTime===lastVideoTime)return;lastHandFrame=now;lastVideoTime=v.currentTime;
  try{const result=handModel.detectForVideo(v,now),landmarks=result.landmarks?.[0];const hc=$('hand-overlay');hc.width=v.videoWidth;hc.height=v.videoHeight;const hctx=hc.getContext('2d');hctx.clearRect(0,0,hc.width,hc.height);
    if(!landmarks){clearHand();$('tracking-status').textContent=g.raid?'Fingers hidden? Prop swipes still work locally.':'Show your whole hand to steer and jump.';return;}
    const p=landmarks;handX=1-p[9].x;handPoint={x:handX,y:p[9].y};const d=(a,b)=>Math.hypot((p[a].x-p[b].x)*v.videoWidth/v.videoHeight,p[a].y-p[b].y);const palm=Math.max(.03,d(0,9));const pinch=d(4,8)/palm<.35;const extended=[8,12,16,20].filter((tip,i)=>d(0,tip)>d(0,[6,10,14,18][i])*1.14).length;const open=extended>=4&&!pinch;
    const elapsed=lastHandAt?(now-lastHandAt)/1000:1;const velocity=(handX-lastHandX)/Math.max(.04,elapsed);const swipe=lastHandAt&&Math.abs(velocity)>1.7&&now-lastSwipe>650&&!pinch;if(swipe){lastSwipe=now;g.player.face=velocity>0?1:-1;}
    const offset=handX-neutral;handInput.move=Math.abs(offset)<.055?0:clamp(offset/.2,-1,1);handInput.jump=pinch;handInput.guard=open;handInput.attack=!!swipe;lastHandX=handX;lastHandAt=now;lastGesture=pinch?'PINCH · JUMP':swipe?'SWIPE · STRIKE':open?'PALM · GUARD':'HAND TRACKED';$('tracking-status').textContent=lastGesture;
    const connections=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];hctx.strokeStyle='#8cead8';hctx.lineWidth=3;for(const line of connections){hctx.beginPath();line.forEach((i,j)=>hctx[j?'lineTo':'moveTo'](p[i].x*hc.width,p[i].y*hc.height));hctx.stroke();}for(const point of p){hctx.beginPath();hctx.arc(point.x*hc.width,point.y*hc.height,4,0,Math.PI*2);hctx.fillStyle='#ffdcad';hctx.fill();}
  }catch(error){if(handDelegate==='GPU')enableHands(true);else handFailure(error);}
}
function trackPropMotion(now){
  const video=$('camera');
  if(!stream||!cameraEvidence||!$('prop-motion').checked||g.phase!=='boss'||paused||modalOpen()||document.hidden||video.readyState<2){resetMotion();return;}
  if(now-motionAt<70||video.currentTime===motionVideoTime)return;
  motionAt=now;motionVideoTime=video.currentTime;
  try{
    motionCtx.drawImage(video,0,0,128,72);
    const pixels=motionCtx.getImageData(0,0,128,72).data,gray=new Uint8Array(128*72);
    for(let i=0;i<gray.length;i++)gray[i]=(pixels[i*4]*.299+pixels[i*4+1]*.587+pixels[i*4+2]*.114)|0;
    const globalMotion=estimateObjectMotion(previousMotion,gray,128,72);
    let motion=globalMotion;
    trackedObjects=trackedObjects.filter(item=>now<item.expiresAt).map(item=>{
      const movement=globalMotion.cameraMoved?{confidence:0}:estimateObjectMotion(previousMotion,gray,128,72,item.box);
      if(item.roles.includes('strike'))motion=movement;
      return shiftObject(item,movement);
    });
    previousMotion=gray;
    const powers=liveMode()?currentLivePowers(g,now):g.powers;
    motionStrength=motion.confidence>=.55?Math.min(1,Math.hypot(motion.dx,motion.dy)*24):0;
    if(motion.confidence>=.55){propPoint={x:1-motion.x,y:motion.y};propPointAt=now;}
    if(propSwipe.update(motion,now,!!powers.strike)&&now-lastSwipe>600){
      propAttack=true;lastSwipe=now;propDirection=motion.dx>0?-1:1;
    }
  }catch{resetMotion();$('motion-status').textContent='Camera motion unavailable. J still strikes with an equipped prop.';}
}
function currentObjects(now){return trackedObjects.filter(item=>now<item.expiresAt&&!!stream&&!paused&&!modalOpen()&&$('prop-layer').checked);}
function activePointer(now){
  const shield=currentObjects(now).find(item=>item.roles.includes('shield'));
  if(shield){const b=shield.box,v=$('camera');return videoPoint((b[1]+b[3])/2,(b[0]+b[2])/2,v.videoWidth,v.videoHeight);}
  return lastHandAt&&now-lastHandAt<500?handPoint:propPoint&&now-propPointAt<500?propPoint:null;
}
function updateCombatUI(now){
  const powers=liveMode()?currentLivePowers(g,now):g.powers;
  const shield=!!(powers.shield||powers.reflect),strike=!!powers.strike;
  const mode=paused?'paused':shield&&strike?'both':shield?'shield':strike?'strike':'waiting';
  $('loadout').dataset.mode=mode;
  $('loadout-title').textContent=paused?'Paused':shield&&strike?'Shield + blade':shield?'Aegis online':strike?'Riftblade online':'Your world. Your weapon.';
  $('loadout-hint').textContent=paused?'Resume to reacquire your item.':g.practice&&!liveMode()?'Practice: hold K to block. J or a camera swipe strikes.':shield&&strike?'Hold to block. Sweep left or right to strike.':shield?'Keep it in view. Incoming blasts bounce back.':strike?'Sweep across the camera to strike. Fingers can stay hidden.':'Show a book to defend, or a phone or pen to strike.';
  const located=currentObjects(now);
  $('location-status').textContent=!$('prop-layer').checked&&locatorMessage.startsWith('Live detection stopped')?locatorMessage:!api.objectTracking?'Restart the local server for object outlines and foreground layering.':!$('prop-layer').checked?'Object outlines off.':located.length?'Located: '+located.map(item=>item.label).join(' + '):locatorMessage;
  $('shield-indicator').classList.toggle('equipped',shield);$('strike-indicator').classList.toggle('equipped',strike);
  const on=!!stream&&$('prop-motion').checked&&g.phase==='boss'&&!paused&&!modalOpen();
  $('motion-meter').style.width=`${Math.round(on?motionStrength*100:0)}%`;
  $('motion-status').textContent=!stream?'Connect camera for physical controls.':!$('prop-motion').checked?'Prop motion off. Hand tracking and J remain available.':g.phase!=='boss'?'Local prop motion activates in the boss encounter.':paused?'Motion paused.':strike?'Local swipe tracking armed. Sweep smoothly across the guide.':'Local motion ready. Waiting for a recognized attack prop.';
  $('raid-cue').hidden=!g.raid;
  if(g.raid){
    const r=g.raid;
    const cue=r.awaitingItem?'SHOW AN ITEM TO BEGIN':r.parry>0?'RETURN TO SENDER':r.slash>0?'RIFT STRIKE':g.boss.state==='exposed'?'CORE OPEN — STRIKE NOW':r.shieldActive?'SHIELD READY — HOLD YOUR GROUND':g.boss.state==='windup'?'INCOMING — RAISE YOUR SHIELD':strike?'BLADE READY — SWIPE TO STRIKE':'SHOW A BOOK TO DEFEND';
    $('raid-cue').textContent=cue;$('raid-cue').dataset.kind=r.parry>0||r.shieldActive?'shield':g.boss.state==='exposed'?'strike':'waiting';
  }
}
$('prop-motion').onchange=resetMotion;
$('prop-layer').onchange=()=>{locatorMessage='Show your held objects in the camera guide.';trackedObjects=[];objectLocator.reset();};
$('showcase').onclick=()=>{const on=document.body.classList.toggle('showcase');$('showcase').setAttribute('aria-pressed',String(on));$('showcase').textContent=on?'Exit showcase':'Showcase';};
// One shared recognition loop: all item properties are evaluated in one call.
let autoMessageUntil=0,liveDetectionError='';
function liveMode(){return $('auto-weave').checked&&api.configured;}
function autoContext(){
  const v=$('camera');
  return liveMode()&&!liveDetectionError&&!!stream&&api.liveItems&&cameraEvidence&&v.readyState>=2&&v.videoWidth&&
    ['traverse','boss'].includes(g.phase)&&!paused&&!modalOpen()&&!scanBusy&&!document.hidden ?
    {game:g,gap:g.phase==='boss'?'boss':nearGap(g),camera:cameraGeneration}:null;
}
function croppedSnapshot(){
  const v=$('camera'),c=document.createElement('canvas'),size=Math.min(v.videoWidth,v.videoHeight)*.95;
  c.width=c.height=640;c.getContext('2d').drawImage(v,(v.videoWidth-size)/2,(v.videoHeight-size)/2,size,size,0,0,640,640);
  return c.toDataURL('image/jpeg',.85);
}
const objectLocator=createAutoWeaver({
  context:()=>{const context=autoContext();return context&&api.objectTracking&&$('prop-layer').checked&&g.phase==='boss'?context:null;},
  request:async signal=>{
    const response=await fetch('/api/locate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:croppedSnapshot()}),signal});
    const answer=await response.json();if(!response.ok)throw Object.assign(new Error(answer.error||'Locator failed'),{status:answer.googleStatus||response.status});return answer;
  },
  accept:answer=>answer.source==='gemini-localization'&&Array.isArray(answer.objects),
  result:answer=>{const v=$('camera');trackedObjects=answer.objects.map(item=>objectFromCrop(item,v.videoWidth,v.videoHeight,performance.now()));},
  feedback:answer=>['ready',answer.objects.length?'Objects located. Local motion follows between snapshots.':'No held object located. Keep the book or pen inside the guide.'],
  status:(state,message)=>{locatorMessage=state==='checking'?'Finding the edges of your held objects…':message;if(state==='error'){$('prop-layer').checked=false;trackedObjects=[];}}
});
const autoWeaver=createAutoWeaver({
  context:autoContext,
  request:async signal=>{
    const response=await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({image:croppedSnapshot(),ability:g.phase==='boss'?'shield':'bridge',mode:'live'}),signal});
    const answer=await response.json();
    if(!response.ok)throw Object.assign(new Error(answer.error||'Scan failed'),{status:answer.googleStatus||response.status});
    if(!Array.isArray(answer.acceptedAbilities))throw Object.assign(new Error('Restart the server for live item recognition.'),{status:400});
    return answer;
  },
  accept:answer=>answer.source==='gemini-decision'&&Array.isArray(answer.acceptedAbilities),
  result:(answer,target)=>{
    if(g!==target.game)return;
    observeLiveItem(g,answer,performance.now());
    scans.push({...answer,at:new Date().toISOString(),mode:'live-items'});if(scans.length>150)scans.shift();
    for(const ability of answer.acceptedAbilities){
      if(!g.powers[ability])unlock(g,ability,{...answer,label:POWER_INFO[ability].short+' prop'});
    }
    refreshPowers();
    if(g.phase==='traverse'&&nearGap(g)>=0&&answer.acceptedAbilities.includes('bridge')&&buildBridge(g))blip(720,'sine',.5);
  },
  feedback:answer=>answer.acceptedAbilities.length?['ready','Equipped: '+answer.acceptedAbilities.map(a=>POWER_INFO[a].short).join(' + ')]:['looking','Show one object inside the guide. Your held powers will update automatically.'],
  status:(state,message)=>{
    $('auto-status').textContent=message;$('auto-status').dataset.state=state;
    autoMessageUntil=performance.now()+2500;
    if(state==='error'){liveDetectionError=message;clearLiveItem(g);notify(message);}
  }
});
$('auto-weave').onchange=()=>{liveDetectionError='';resetMotion();autoWeaver.reset();clearLiveItem(g);autoMessageUntil=0;};
function updateAutoWeave(now){
  autoWeaver.tick();
  objectLocator.tick();
  const powers=currentLivePowers(g,now);
  // A recently confirmed bridge prop also works as the hero reaches the anchor.
  if(autoContext()&&g.phase==='traverse'&&nearGap(g)>=0&&powers.bridge){if(buildBridge(g))blip(720,'sine',.5);}
  $('held-powers').textContent=g.practice&&!liveMode()?'PRACTICE ITEMS / MANUALLY EQUIPPED':Object.keys(powers).length?'IN HAND: '+Object.keys(powers).map(a=>POWER_INFO[a].short.toUpperCase()).join(' + '):'IN HAND: show an object';
  const v=$('camera'),guide=$('object-guide');
  if(v.videoWidth){const preview=v.parentElement,scale=Math.min(preview.clientWidth/v.videoWidth,preview.clientHeight/v.videoHeight);
    const size=Math.min(v.videoWidth,v.videoHeight)*.95*scale;guide.style.width=guide.style.height=`${size}px`;}
  guide.hidden=!autoContext();
  if(liveDetectionError){$('auto-status').textContent=liveDetectionError+' Toggle Live items off/on to retry.';return;}if(now<autoMessageUntil)return;
  $('auto-status').textContent=!api.configured?'Live items need the server edition with Gemini configured.':
    !api.liveItems?'Restart START-RIFT-WALKER.cmd to enable the updated live-items server.':
    !$('auto-weave').checked?'Live items off. Manual and practice controls remain available.':
    !stream?'Connect camera. Hand controls and live item checks start automatically.':
    paused||modalOpen()?'Live object checks paused.':
    g.phase==='boss'?'Hold a book to shield. Swipe a recognized phone or pen to strike.':
    'Show an object as you play. Bridges weave automatically near gaps.';
}
// Snapshot scanner. Live results cannot be substituted with manual practice items.
function abilityButtons(){const target=$('ability-options');target.replaceChildren();for(const [key,p] of Object.entries(POWER_INFO)){const b=el('button',`ability-option${key===selectedAbility?' selected':''}`);b.setAttribute('aria-pressed',String(key===selectedAbility));b.append(el('strong','',`${p.symbol} ${p.name}`),el('small','',p.hint));b.disabled=scanBusy;b.onclick=()=>{selectedAbility=key;scanResult=null;$('apply-power').hidden=true;$('decision-result').hidden=true;abilityButtons();};target.append(b);}}
function openScan(ability='bridge'){if(modalOpen())return;autoWeaver.cancel();clearLiveItem(g);selectedAbility=typeof ability==='string'&&POWER_INFO[ability]?ability:'bridge';captured=null;scanResult=null;$('capture-image').hidden=true;$('capture-empty').hidden=false;$('apply-power').hidden=true;$('decision-result').hidden=true;$('evaluate').disabled=true;$('scan-status').textContent=api.configured?'Capture a frame, then evaluate the chosen property.':'Gemini is not configured. Add your key locally, or use labelled practice items.';abilityButtons();$('scan-dialog').showModal();keys.clear();keyPulses={jump:false,attack:false,build:false};}
$('scan-open').onclick=()=>openScan();$('scan-close').onclick=()=>{if(!scanBusy)$('scan-dialog').close();};$('scan-dialog').addEventListener('cancel',e=>{if(scanBusy)e.preventDefault();});$('scan-dialog').addEventListener('close',()=>{scanGeneration++;keys.clear();keyPulses={jump:false,attack:false,build:false};handInput={move:0,jump:false,guard:false,attack:false};});
$('capture').onclick=()=>{if(scanBusy)return;const v=$('camera');if(!stream||v.readyState<2||!v.videoWidth){$('scan-status').textContent='Connect a camera in the right-hand panel first.';return;}const c=document.createElement('canvas');c.width=640;c.height=Math.round(640*v.videoHeight/v.videoWidth);c.getContext('2d').drawImage(v,0,0,c.width,c.height);captured=c.toDataURL('image/jpeg',.85);$('capture-image').src=captured;$('capture-image').hidden=false;$('capture-empty').hidden=true;scanResult=null;$('apply-power').hidden=true;$('decision-result').hidden=true;$('evaluate').disabled=!api.configured;$('scan-status').textContent=api.configured?'Review the frame. Evaluate sends this image to Google.':'Frame captured locally. Configure Gemini to evaluate it.';};
$('evaluate').onclick=async()=>{if(!captured||scanBusy)return;const generation=++scanGeneration;scanBusy=true;$('evaluate').disabled=true;$('capture').disabled=true;$('scan-close').disabled=true;$('scan-status').textContent='Evaluating object properties… the game is paused.';abilityButtons();
  try{const r=await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:captured,ability:selectedAbility}),signal:AbortSignal.timeout(65000)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Scan failed');if(generation!==scanGeneration)return;scanResult=result;scans.push({...result,at:new Date().toISOString()});const box=$('decision-result');box.replaceChildren(el('strong',result.accepted?'result-good':'result-bad',result.accepted?`${result.label} · accepted`:'Another look needed'),el('p','',result.reason));for(const key of ['visible',selectedAbility]){const a=result.answers[key];const row=el('div','result-line');row.append(el('span','',key==='visible'?'Object visible':POWER_INFO[key].name),el('span','',`P ${Math.round(a.probability*100)}% · confidence ${Math.round(a.confidence*100)}%`));box.append(row);}box.append(el('p','micro',`${result.model} · decision ${(result.latencyMs/1000).toFixed(1)}s · real API result`));box.hidden=false;$('apply-power').hidden=!result.accepted;$('scan-status').textContent=result.accepted?result.flavour:'Try another angle, object or ability.';blip(result.accepted?750:250);
  }catch(e){$('scan-status').textContent=e.name==='TimeoutError'?'Scan timed out. No ability was granted. Try again.':e.message;scanResult=null;$('apply-power').hidden=true;}finally{scanBusy=false;$('capture').disabled=false;$('scan-close').disabled=false;$('evaluate').disabled=!captured||!api.configured;abilityButtons();}
};
$('apply-power').onclick=()=>{if(!scanResult?.accepted)return;unlock(g,scanResult.ability,scanResult);refreshPowers();$('scan-dialog').close();canvas.focus();};
$('export').onclick=()=>{const data={game:'Rift Walker',version:'0.4.0',phase:g.phase,durationSeconds:Math.round(g.time),practice:g.practice,powers:g.powers,stats:g.stats,shards:g.shards.filter(s=>s.taken).length,decisions:scans,events:g.events,camera:stream?{verification:cameraEvidence,label:stream.getVideoTracks()[0]?.label,width:$('camera').videoWidth,height:$('camera').videoHeight}:null};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='rift-walker-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function status(){try{const r=await fetch('/api/status');api=await r.json();$('api-status').textContent='';$('api-status').append(el('i'),document.createTextNode(api.configured?'Gemini configured':'Gemini setup needed'));$('api-status').classList.toggle('ready',api.configured);$('footer-status').textContent=api.configured?'GEMINI KEY CONFIGURED · ACCESS UNTESTED':'LOCAL PROTOTYPE · PRACTICE AVAILABLE';}catch{$('api-status').textContent='Server unavailable';}}
// Art direction: entirely procedural, with parallax, geometric stone, glowing filaments and a tiny cloth hero.
function path(points,fill,stroke=null,width=1){ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function line(points,colour,width=1){ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...p));ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();}
function glow(x,y,r,colour){const gr=ctx.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,colour);gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.fillRect(x-r,y-r,r*2,r*2);}
function star(x,y,r,colour,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);path([[0,-r],[r*.28,-r*.28],[r,0],[r*.28,r*.28],[0,r],[-r*.28,r*.28],[-r,0],[-r*.28,-r*.28]],colour);ctx.restore();}
function background(boss){const t=g.clock;const sky=ctx.createLinearGradient(0,0,0,720);sky.addColorStop(0,boss?'#171c35':'#143440');sky.addColorStop(.5,boss?'#3f3449':'#547e83');sky.addColorStop(1,boss?'#1d2335':'#a1b6a2');ctx.fillStyle=sky;ctx.fillRect(0,0,1280,720);
  // Reality Raid: composite the Warden over the live room. This is a camera
  // backdrop, not a claim of room tracking or physical surface registration.
  const video=$('camera');if(boss&&stream&&video.readyState>=2&&video.videoWidth){const scale=Math.max(1280/video.videoWidth,720/video.videoHeight),w=video.videoWidth*scale,h=video.videoHeight*scale;ctx.save();ctx.globalAlpha=.7;ctx.translate(1280,0);ctx.scale(-1,1);ctx.drawImage(video,(1280-w)/2,(720-h)/2,w,h);ctx.restore();ctx.fillStyle='#171b3738';ctx.fillRect(0,0,1280,720);}
  glow(boss?1000:880,180,340,boss?'#a15d7a45':'#f2d8a344');ellipse(920-g.cameraX*.025,170,72,72,boss?'#a39aa573':'#e5d9b393');ellipse(935-g.cameraX*.025,151,67,68,boss?'#29283e':'#3d646b');
  for(let layer=0;layer<3;layer++){const base=400+layer*65,pts=[[0,720]];for(let x=-100;x<=1400;x+=80){const worldX=x+g.cameraX*(.08+layer*.07);const y=base-Math.sin(worldX*.004+layer*2)*80-Math.sin(worldX*.011+layer)*25;pts.push([x,y]);}pts.push([1400,720]);path(pts,boss?['#30334b','#272d41','#1b2939'][layer]:['#527a7d','#3a686e','#28525f'][layer]);}
  for(let i=0;i<7;i++){const x=((i*223-g.cameraX*.18+2000)%1550)-130,y=290+(i*71%190);ctx.globalAlpha=.15;path([[x,y],[x+60,y-15],[x+100,y],[x+70,y+110],[x+20,y+80]],'#c1dbcf');ctx.globalAlpha=1;}
  ctx.save();ctx.globalAlpha=.11;ctx.fillStyle='#d6f2d4';ctx.translate(820,0);ctx.rotate(.32);ctx.fillRect(0,0,50,900);ctx.fillRect(140,0,18,900);ctx.restore();
  for(let i=0;i<60;i++){const x=(i*149+Math.sin(t*.25+i)*20-g.cameraX*.1+10000)%1280,y=(i*83+Math.cos(t*.3+i)*25)%680;ctx.globalAlpha=.18+Math.sin(t+i)*.12;ellipse(x,y,1.1+(i%3)*.5,1.1+(i%3)*.5,'#e4fae1');}ctx.globalAlpha=1;
}
function island(p){const {x,y,w}=p;if(p.bridge){glow(x+w/2,y,Math.min(210,w),'#8bf8df25');for(let n=0;n<w;n+=25){const rise=Math.sin(g.clock*2+n*.02)*2;path([[x+n,y+rise],[x+n+22,y+rise],[x+n+19,y+13],[x+n+2,y+16]],'#7bcfc2','#b1f8e1',1);}line([[x,y-4],[x+w,y-4]],'#c5ffe9',2);return;}
  path([[x,y],[x+w,y],[x+w-15,y+35],[x+w*.9,y+64],[x+w*.8,y+155],[x+w*.55,y+210],[x+w*.43,y+168],[x+w*.22,y+185],[x+w*.08,y+86]],'#183b48');
  path([[x,y+15],[x+w*.35,y+21],[x+w*.43,y+168],[x+w*.22,y+185],[x+w*.08,y+86]],'#234a55');path([[x+w*.35,y+21],[x+w*.69,y+28],[x+w*.55,y+210],[x+w*.43,y+168]],'#14323f');path([[x+w*.69,y+28],[x+w,y+15],[x+w*.9,y+64],[x+w*.8,y+155],[x+w*.55,y+210]],'#254650');
  path([[x-3,y],[x+10,y-12],[x+w-12,y-12],[x+w+3,y],[x+w-7,y+16],[x+10,y+16]],'#4e7b75');line([[x,y],[x+w,y]],'#a3c2a3',4);line([[x+10,y+4],[x+w-7,y+4]],'#6b9c85',2);
  for(let i=0;i<w;i+=31){const h=5+(i*7%13);line([[x+i,y-2],[x+i+2,y-h]],'#9cbba0',1);if(i%3===0)line([[x+i+2,y-h],[x+i+7,y-h-3]],'#9cbba0',1);}
  for(let i=30;i<w;i+=85){const yy=y+32+(i*7%40);line([[x+i,yy],[x+i+15,yy+24],[x+i+8,yy+42]],'#6e958033',1);}
}
function ruins(){const cam=g.cameraX;for(const x of [90,1070,1440,1920,2500]){if(x-cam<-200||x-cam>1480)continue;const y=560,h=90+(x%3)*30;ctx.globalAlpha=.8;path([[x,y],[x+25,y],[x+22,y-h],[x+4,y-h-8]],'#365e64');path([[x-6,y-h],[x+31,y-h],[x+31,y-h-12],[x-3,y-h-19]],'#608580');line([[x+8,y-10],[x+8,y-h+12]],'#85aaa13f',2);ctx.globalAlpha=1;}
  for(const gap of GAPS){for(const x of [gap.x-15,gap.x+gap.w+15]){path([[x-8,560],[x+8,560],[x+5,527],[x-5,527]],'#254e55');star(x,518,9,'#9ef6d7',g.clock*.5);glow(x,518,35,'#82f5d53f');}if(!g.bridges.includes(GAPS.indexOf(gap))){ctx.setLineDash([4,12]);line([[gap.x,560],[gap.x+gap.w,560]],'#91ddc64d',1);ctx.setLineDash([]);ctx.font='11px "Space Grotesk", sans-serif';ctx.textAlign='center';ctx.fillStyle='#b4d8cf';ctx.fillText('WEAVE A WAY FORWARD',gap.x+gap.w/2,610);}}
}
function portal(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);glow(0,-75,130,'#7decd044');for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,-75,42+i*8,78+i*9,Math.sin(g.clock+i)*.06,0,Math.PI*2);ctx.strokeStyle=['#4a8c88','#99ecd6','#c3ffe066'][i];ctx.lineWidth=[8,2,1][i];ctx.stroke();}const gradient=ctx.createRadialGradient(0,-75,0,0,-75,80);gradient.addColorStop(0,'#b3f8ddaa');gradient.addColorStop(1,'#50868411');ellipse(0,-75,38,74,gradient);for(let i=0;i<8;i++){const a=g.clock*.7+i*Math.PI/4;star(Math.cos(a)*55,-75+Math.sin(a)*88,3,'#d0ffe8');}path([[-60,20],[60,20],[53,0],[-53,0]],'#48776d');ctx.restore();}
function hero(){const p=g.player,t=g.clock;ctx.save();ctx.translate(p.x,p.y);if(p.invuln>0&&Math.floor(t*14)%2)ctx.globalAlpha=.4;const bob=p.grounded?Math.sin(t*8)*1.4:0;ctx.translate(0,bob);ellipse(0,51,22,5,'#09243155');const run=Math.abs(p.vx)>20?Math.sin(t*15)*6:0;line([[-7,36],[-9+run,48]],'#142e37',7);line([[7,36],[9-run,48]],'#142e37',7);
  path([[-15,10],[13,8],[20,39],[4,36],[-4,42],[-19,35]],'#e5bd88');path([[-15,10],[-5,16],[-9,35],[-19,35]],'#a1765e');path([[-4,14],[12,11],[17,34],[1,32]],'#f2d9a2');
  line([[-p.face*10,13],[-p.face*(30+Math.abs(p.vx)*.03),12+Math.sin(t*5)*5],[-p.face*47,20+Math.sin(t*5+1)*6]],'#83ded0',6);
  ellipse(0,1,17,20,'#e2c390');ellipse(p.face*3,4,12,13,'#173543');ellipse(p.face*5-4,2,2.5,3,'#a8ffe5');ellipse(p.face*5+4,2,2.5,3,'#a8ffe5');glow(4,4,22,'#7df6dc18');
  if(g.powers.strike){ctx.save();ctx.translate(p.face*20,25);ctx.rotate(p.face*.4);path([[0,10],[-3,-25],[0,-38],[4,-25],[4,10]],'#ffd3a3');line([[-7,6],[10,6]],'#b68a63',3);ctx.restore();}
  if(p.guard){const col=g.powers.reflect?'#d9bbff':'#9ccaff';ctx.save();ctx.translate(p.face*28,17);ctx.scale(p.face,1);ctx.beginPath();ctx.ellipse(0,0,13,37,0,-Math.PI/2,Math.PI/2);ctx.strokeStyle=col;ctx.lineWidth=4;ctx.stroke();glow(0,0,45,col+'33');for(let i=-1;i<=1;i++)line([[2,i*15],[10,i*15+5]],col,1);ctx.restore();}
  ctx.restore();
}
function bossArt(){const b=g.boss,t=g.clock;const exposed=b.state==='exposed',enraged=b.hp<75;const colour=exposed?'#92f8d5':enraged?'#ff8f80':'#c2a4d9';const x=b.x,y=b.y+Math.sin(t*1.5)*12;glow(x,y,230,exposed?'#86ffd326':'#c45d9930');ellipse(x,560,120,16,'#10152e99');
  ctx.save();ctx.translate(x,y);for(let i=0;i<4;i++){const a=t*.15+i*Math.PI/2;const px=Math.cos(a)*145,py=Math.sin(a)*105;path([[px-12,py],[px,py-25],[px+14,py],[px,py+29]],'#495168',colour+'55',1);}
  path([[-90,-50],[-54,-100],[43,-110],[94,-55],[68,80],[32,144],[-27,139],[-77,79]],'#28384e','#68728a',2);path([[-54,-100],[-12,-65],[-22,94],[-27,139],[-77,79],[-90,-50]],'#3f5266');path([[43,-110],[10,-61],[21,98],[32,144],[68,80],[94,-55]],'#202b42');
  path([[-90,-45],[-144,-17],[-152,61],[-114,84],[-96,36]],'#3d4c63');path([[90,-45],[144,-17],[152,61],[114,84],[96,36]],'#29374e');
  path([[-55,-100],[-88,-174],[-44,-144],[-23,-106]],'#58667d');path([[35,-108],[73,-177],[62,-124],[54,-99]],'#44516a');
  path([[-54,-79],[-8,-92],[47,-80],[35,-46],[-33,-43]],'#17263b');line([[-37,-65],[-15,-59]],colour,4);line([[13,-60],[32,-67]],colour,4);
  ctx.save();ctx.rotate(t*.4);star(0,21,exposed?42:25,colour);ctx.restore();glow(0,20,exposed?90:45,colour+'55');
  for(let i=0;i<3;i++){const yy=48+i*23;line([[-40,yy],[-28,yy+9],[-32,yy+18]],colour+'66',2);line([[40,yy],[28,yy+9],[32,yy+18]],colour+'66',2);}
  ctx.restore();
  if(b.state==='windup'&&b.attack==='beam'){ctx.setLineDash([10,14]);line([[80,502],[b.x-80,502]],'#ffb6a8aa',2);ctx.setLineDash([]);glow(b.x-80,502,30,'#ffab7777');}
  if(b.state==='attack'&&b.attack==='beam'){const grd=ctx.createLinearGradient(0,460,0,540);grd.addColorStop(0,'#ff8b7600');grd.addColorStop(.5,'#ffb39abb');grd.addColorStop(1,'#ff8b7600');ctx.fillStyle=grd;ctx.fillRect(0,460,b.x-70,80);line([[0,502],[b.x-70,502]],'#ffe3c8',5);}
}
function render(){if(g.raid){drawRaid(ctx,g,stream?$('camera'):null,activePointer(performance.now()),currentObjects(performance.now()));return;}const boss=!!g.boss;ctx.save();if(g.shake>0)ctx.translate(Math.sin(g.clock*90)*g.shake*10,Math.cos(g.clock*75)*g.shake*8);background(boss);
  ctx.save();ctx.translate(-g.cameraX,0);
  if(boss){for(let i=0;i<9;i++){const x=i*160;path([[x,560],[x+24,560],[x+21,360-i%2*60],[x+3,350-i%2*60]],'#293d4e');line([[x+6,365-i%2*60],[x+6,535]],'#59758144',2);}island({x:-100,w:1480,y:560});bossArt();}
  else{ruins();for(const p of platforms(g))island(p);for(const s of g.shards){if(s.taken)continue;const y=s.y+Math.sin(g.clock*2+s.x)*6;glow(s.x,y,35,'#ffdf9144');star(s.x,y,9,'#ffe0a1',g.clock*.4);}portal(2700,560);}
  for(const s of g.shots){const c=s.owner==='enemy'?'#ff8e99':'#ffd2a3';glow(s.x,s.y,28,c+'55');if(s.owner==='enemy'){ellipse(s.x,s.y,s.r,s.r,c);star(s.x,s.y,s.r*.6,'#ffe4c5',g.clock*3);}else{line([[s.x-Math.sign(s.vx)*34,s.y],[s.x,s.y]],c,5);star(s.x,s.y,10,'#fff2c4',g.clock*4);}}
  hero();for(const p of g.particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ellipse(p.x,p.y,p.size,p.size,p.colour);}ctx.globalAlpha=1;
  ctx.restore();const vignette=ctx.createRadialGradient(640,320,250,640,360,800);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#07142099');ctx.fillStyle=vignette;ctx.fillRect(0,0,1280,720);if(g.flash>0){ctx.fillStyle=`rgba(255,95,110,${g.flash})`;ctx.fillRect(0,0,1280,720);}ctx.restore();
}
function frame(now){const dt=Math.min((now-lastTime)/1000,.033);lastTime=now;trackHand(now);updateAutoWeave(now);trackPropMotion(now);if(lastHandAt&&now-lastHandAt>500)clearHand();const keyboard=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);const h=$('hand-toggle').checked?handInput:{move:0};const livePowers=currentLivePowers(g,now);step(g,dt,{move:keyboard||h.move||0,jump:keyPulses.jump||keys.has('Space')||keys.has('ArrowUp')||keys.has('KeyW')||h.jump,guard:keys.has('KeyK')||h.guard,attack:keyPulses.attack||keys.has('KeyJ')||h.attack||propAttack,swipeDirection:propAttack?propDirection:g.player.face,build:keyPulses.build||keys.has('KeyE'),paused:paused||modalOpen(),autoWeaveAssist:!!autoContext()&&nearGap(g)>=0,liveMode:liveMode(),livePowers,pointer:activePointer(now)});propAttack=false;handInput.attack=false;keyPulses={jump:false,attack:false,build:false};render();if(now-lastUI>100){refreshUI();updateCombatUI(now);lastUI=now;}requestAnimationFrame(frame);}
window.addEventListener('pagehide',()=>{objectLocator.cancel();autoWeaver.cancel();clearLiveItem(g);if(stream)stream.getTracks().forEach(t=>t.stop());});
refreshPowers();status();requestAnimationFrame(frame);
