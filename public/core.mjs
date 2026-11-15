import {createRaid,stepRaid} from './raid.mjs';
export const VIEW={w:1280,h:720};
export const POWER_INFO={
  bridge:{name:'Worldweave',short:'Bridge',colour:'#77e7d5',symbol:'═',hint:'Flat or elongated • ruler, notebook, cardboard'},
  shield:{name:'Aegis',short:'Shield',colour:'#89baff',symbol:'◇',hint:'Broad surface • book, lid, cardboard'},
  reflect:{name:'Mirrorwake',short:'Reflect',colour:'#e5bcff',symbol:'✧',hint:'Visible shine • spoon, foil, mirror'},
  strike:{name:'Riftblade',short:'Strike',colour:'#ffbb83',symbol:'↗',hint:'Elongated prop • pen, spoon, cardboard wand'}
};
export const GAPS=[{x:570,w:380,y:560},{x:1530,w:280,y:560}];
export function createGame(){return {phase:'title',time:0,clock:0,player:{x:155,y:500,w:30,h:50,vx:0,vy:0,grounded:false,face:1,hp:5,invuln:0,attackCd:0,guard:false},cameraX:0,checkpoint:155,powers:{},bridges:[],shards:[360,1110,1330,1960,2370].map((x,i)=>({x,y:i===2?388:510,taken:false})),particles:[],shots:[],events:[],flash:0,shake:0,practice:false,boss:null,raid:null,liveItem:null,stats:{falls:0,hits:0,blocks:0,reflects:0,scans:0},lastJump:false,lastAttack:false,lastBuild:false};}
export function event(g,text,kind='info'){g.events.push({text,kind,time:g.time});if(g.events.length>40)g.events.shift();}
export function startGame(g){g.phase='traverse';event(g,'The Broken Reach · find a way across.');}
export function unlock(g,ability,item){if(!POWER_INFO[ability])return;g.powers[ability]={label:item.label||'Borrowed object',source:item.source||'practice',flavour:item.flavour||''};g.practice ||= item.source!=='gemini-decision';g.stats.scans++;event(g,`${POWER_INFO[ability].name} borrowed from ${item.label}.`,'power');burst(g,g.player.x,g.player.y,POWER_INFO[ability].colour,28);}
export function platforms(g){if(g.phase==='boss'||g.phase==='won')return [{x:0,w:1280,y:560}];return [{x:-100,w:670,y:560},{x:950,w:580,y:560},{x:1810,w:1100,y:560},{x:1230,w:200,y:430},...g.bridges.map(i=>({...GAPS[i],bridge:true}))];}
export function nearGap(g){return GAPS.findIndex((p,i)=>!g.bridges.includes(i)&&g.player.x>=p.x-190&&g.player.x<=p.x+p.w+80);}
export function buildBridge(g){if(g.phase!=='traverse')return false;const i=nearGap(g);if(i<0){event(g,'Move to a glowing bridge anchor.');return false;}if(!g.powers.bridge){event(g,'Borrow Worldweave from a flat or elongated real object.','scan');return false;}g.bridges.push(i);burst(g,GAPS[i].x+GAPS[i].w/2,550,'#77e7d5',70);event(g,'A piece of your world closes the gap.','power');return true;}
export function beginBoss(g){g.liveItem=null;g.raid=createRaid();g.phase='boss';g.cameraX=0;Object.assign(g.player,{x:185,y:500,vx:0,vy:0,hp:5,invuln:1});g.shots=[];g.boss={x:1000,y:320,hp:150,maxHp:150,state:'intro',timer:7,cycle:0,attack:'beam',fired:false};event(g,'The Rift Warden · defend, then strike its exposed core.','boss');}
export function burst(g,x,y,colour,count=16){for(let i=0;i<count;i++){const a=i/count*Math.PI*2;const speed=30+(i*47%170);g.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-35,life:0.6+(i%6)*0.13,max:1.3,colour,size:2+i%4});}if(g.particles.length>500)g.particles.splice(0,g.particles.length-500);}
function hurt(g){const p=g.player;if(p.invuln>0)return;p.hp--;p.invuln=1.2;g.stats.hits++;g.flash=0.25;g.shake=0.35;burst(g,p.x,p.y,'#ff7d8e',18);if(p.hp<=0){g.phase='dead';event(g,'The light remains. Try the encounter again.');}}
function damageBoss(g,amount){const b=g.boss;if(!b||g.phase!=='boss')return;b.hp=Math.max(0,b.hp-amount);burst(g,b.x,b.y,'#ffd1a3',24);g.shake=0.15;if(b.hp===0){g.phase='won';g.shots=[];event(g,'RIFT MENDED · your world made the difference.','win');burst(g,b.x,b.y,'#77e7d5',100);}}
function fire(g){const p=g.player;if(p.attackCd>0)return;p.attackCd=0.5;g.shots.push({x:p.x+20*p.face,y:p.y+12,vx:p.face*900,vy:0,life:2,owner:'player',r:10,damage:g.powers.strike?20:10});burst(g,p.x+30*p.face,p.y+15,'#ffbb83',6);}
export function retry(g){if(g.boss){beginBoss(g);return;}g.phase='traverse';Object.assign(g.player,{x:g.checkpoint,y:450,hp:5,vx:0,vy:0,invuln:1});}
export function step(g,dt,input={}){
  dt=Math.max(0,Math.min(dt,0.033));g.clock+=dt;
  for(const p of g.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;}g.particles=g.particles.filter(p=>p.life>0);
  g.flash=Math.max(0,g.flash-dt);g.shake=Math.max(0,g.shake-dt);
  if(g.phase==='title'||g.phase==='dead'||g.phase==='won'||input.paused)return;
  g.time+=dt;if(g.phase==='boss'&&g.raid){stepRaid(g,dt,input,{event,hurt,damageBoss});return;}const p=g.player;p.invuln=Math.max(0,p.invuln-dt);p.attackCd=Math.max(0,p.attackCd-dt);
  const axis=Math.max(-1,Math.min(1,Number(input.move)||0));p.vx+=(axis*300-p.vx)*Math.min(1,dt*14);if(Math.abs(axis)>.1)p.face=axis>0?1:-1;
  p.guard=!!input.guard && !!(g.powers.shield||g.powers.reflect);
  if(input.jump&&!g.lastJump&&p.grounded){p.vy=-760;p.grounded=false;burst(g,p.x,p.y+45,'#a7d6cf',8);}
  if(input.attack&&!g.lastAttack)fire(g);
  if(input.build&&!g.lastBuild)buildBridge(g);
  g.lastJump=!!input.jump;g.lastAttack=!!input.attack;g.lastBuild=!!input.build;
  const oldBottom=p.y+p.h;p.vy+=1850*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.grounded=false;
  // Wait at an unfinished left anchor while live recognition is enabled.
  if(input.autoWeaveAssist&&g.phase==='traverse'){
    for(const [i,gap] of GAPS.entries()){
      const edge=gap.x-p.w/2-2;
      if(!g.bridges.includes(i)&&p.x>=edge&&p.x-p.vx*dt<=edge+5&&oldBottom<=gap.y+5&&p.vx>0){p.x=edge;p.vx=0;}
    }
  }
  for(const platform of platforms(g)){if(p.vy>=0&&oldBottom<=platform.y+5&&p.y+p.h>=platform.y&&p.x+p.w/2>platform.x&&p.x-p.w/2<platform.x+platform.w){p.y=platform.y-p.h;p.vy=0;p.grounded=true;}}
  p.x=Math.max(35,Math.min(g.phase==='boss'?1200:2800,p.x));
  if(g.phase==='traverse'){
    if(p.x>1000&&p.x<1500&&p.grounded)g.checkpoint=1030;if(p.x>1850&&p.grounded)g.checkpoint=1870;
    for(const s of g.shards){if(!s.taken&&Math.hypot(p.x-s.x,p.y+20-s.y)<50){s.taken=true;burst(g,s.x,s.y,'#ffe3a0',20);event(g,`Light recovered · ${g.shards.filter(s=>s.taken).length}/5`,'shard');}}
    if(p.y>800){g.stats.falls++;p.x=g.checkpoint;p.y=400;p.vx=p.vy=0;event(g,'The rift returns you to your last anchor.');}
    g.cameraX+=(Math.max(0,Math.min(1600,p.x-360))-g.cameraX)*Math.min(1,dt*5);
    if(p.x>2660)beginBoss(g);
  }
  if(g.phase==='boss')updateBoss(g,dt);
  for(const shot of g.shots){shot.life-=dt;shot.x+=shot.vx*dt;shot.y+=(shot.vy||0)*dt;
    if(shot.owner==='player'&&g.boss&&g.phase==='boss'&&Math.abs(shot.x-g.boss.x)<105&&shot.y>190&&shot.y<560){damageBoss(g,g.boss.state==='exposed'?shot.damage:2);shot.life=0;}
    if(shot.owner==='enemy'&&Math.abs(shot.x-p.x)<shot.r+25&&Math.abs(shot.y-(p.y+25))<shot.r+25){
      if(p.guard){g.stats.blocks++;if(g.powers.reflect){shot.owner='player';shot.vx=900;shot.vy=(g.boss.y-shot.y)*1.8;shot.damage=30;shot.life=2;g.stats.reflects++;g.boss.state='exposed';g.boss.timer=4;event(g,'REFLECTED · the core is exposed.','power');}else{shot.life=0;burst(g,p.x,p.y,'#89baff',12);}}else{shot.life=0;hurt(g);}
    }
  }g.shots=g.shots.filter(s=>s.life>0&&s.x>-100&&s.x<3100);
}
function updateBoss(g,dt){const b=g.boss,p=g.player;b.timer-=dt;const enraged=b.hp<75;
  if(b.state==='intro'&&b.timer<=0){b.state='windup';b.timer=2.2;b.attack='orbs';event(g,'ORB VOLLEY · jump, or hold a borrowed shield.','boss');}
  else if(b.state==='windup'&&b.timer<=0){b.state='attack';b.timer=b.attack==='beam'?1.5:2.4;b.fired=false;b.nextShot=0;}
  else if(b.state==='attack'){
    if(b.attack==='beam'&&!b.fired){b.fired=true;if(p.y+p.h>435){if(p.guard){g.stats.blocks++;burst(g,p.x,p.y,'#a9beff',25);if(g.powers.reflect){damageBoss(g,18);g.stats.reflects++;event(g,'MIRRORWAKE · beam returned.','power');}}else hurt(g);}}
    if(b.attack==='orbs'){b.nextShot-=dt;if(b.nextShot<=0){b.nextShot=enraged?.6:.8;g.shots.push({x:b.x-100,y:510,vx:enraged?-520:-390,vy:0,r:17,owner:'enemy',life:4});}}
    if(b.timer<=0&&g.phase==='boss'){b.state='exposed';b.timer=enraged?3.3:4.2;event(g,'CORE EXPOSED · swipe or press J to counterattack.','boss');}
  }else if(b.state==='exposed'&&b.timer<=0){b.cycle++;b.state='windup';b.attack=b.cycle%2?'beam':'orbs';b.timer=enraged?1.65:2.2;event(g,b.attack==='beam'?'RIFT BEAM · jump high or guard.':'ORB VOLLEY · prepare your defense.','boss');}
}
export function objective(g){if(g.phase==='boss'&&g.raid)return ['The Warden is in your world','Show a book to shield and return attacks. Show a phone or pen, then swipe to strike. Pinch or Space to dodge.'];if(g.phase==='boss'){const b=g.boss;if(b.state==='exposed')return ['The core is exposed','Swipe or press J. Your borrowed Riftblade deals double damage.'];return [b.attack==='beam'?'Survive the rift beam':'Face the Rift Warden','Jump to dodge. Hold an open palm / K to use a borrowed shield.'];}if(g.phase==='won')return ['You mended the rift','The smallest things can change a world.'];if(!g.powers.bridge)return ['Borrow a bridge from your world','Scan a ruler, notebook or cardboard. Choose Worldweave.'];if(g.bridges.length<2)return ['Stitch the islands together','Approach a glowing anchor and press E or use Weave bridge.'];return ['Find the Warden’s gate','Follow the islands to the right. Borrow shield and strike powers before the fight.'];}
