import {videoPoint} from './object-tracking.mjs';
// Perspective arena with an approximate foreground cutout for located props.
// No room mapping, depth sensor, or physical collision claim is made here.
export function drawRaid(ctx,g,video,pointer,objects=[]){
  const w=1280,h=720,r=g.raid,b=g.boss,t=g.clock,exposed=b.state==='exposed';
  const colour=exposed?'#a2ffe0':'#c7a0ff',hot=b.state==='windup'||b.state==='attack';
  const videoReady=video?.readyState>=2&&video.videoWidth;
  function camera(){const scale=Math.max(w/video.videoWidth,h/video.videoHeight),vw=video.videoWidth*scale,vh=video.videoHeight*scale;ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(video,(w-vw)/2,(h-vh)/2,vw,vh);ctx.restore();}
  function line(points,c,width=1){ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke();}
  function glow(x,y,radius,c){const grad=ctx.createRadialGradient(x,y,0,x,y,radius);grad.addColorStop(0,c);grad.addColorStop(1,'transparent');ctx.fillStyle=grad;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);}
  function ring(x,y,rx,ry,c,width=1,rotation=0,start=0,end=Math.PI*2){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,start,end);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke();}
  ctx.save();ctx.fillStyle='#080e1d';ctx.fillRect(0,0,w,h);
  if(videoReady){ctx.save();ctx.filter='saturate(.4) brightness(.45)';camera();ctx.restore();}
  const sky=ctx.createLinearGradient(0,0,w,h);sky.addColorStop(0,'#090f27a8');sky.addColorStop(.55,'#15102a88');sky.addColorStop(1,'#061b2bd9');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  glow(630,310,440,exposed?'#1f947e33':'#7042b03d');glow(1100,110,300,'#4aa3b622');
  // Perspective grid, drifting sparks and broken orbital rings establish depth.
  ctx.save();ctx.globalAlpha=.24;
  for(let i=-8;i<=8;i++)line([{x:640+i*25,y:465},{x:640+i*240,y:720}],'#529bba',1);
  for(let i=0;i<9;i++){const y=465+Math.pow(i/8,2)*255;line([{x:0,y},{x:1280,y}],'#529bba',1);}
  ctx.restore();
  const cx=640-r.lean*28,cy=335;
  for(let i=0;i<3;i++){
    const radius=192+i*32,a=t*(i%2?-.11:.09)+i;
    ring(cx,cy,radius,radius*1.05,colour+'35',1,a,a+.15,a+Math.PI*1.55);
    ring(cx,cy,radius+7,(radius+7)*1.05,colour+'18',3,-a,a+1.8,a+3.5);
  }
  for(let i=0;i<44;i++){const a=i*2.399+t*.055,rad=225+(i%5)*8;const x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=i%4?colour+'44':colour+'bb';ctx.fillRect(-2,-1,i%4?3:9,2);ctx.restore();}
  for(let i=0;i<45;i++){const x=(i*193.7+Math.sin(t*.3+i)*22)%1280,y=(i*79.3-t*(9+i%5)+7200)%720;ctx.globalAlpha=.18+(i%4)*.13;ctx.fillStyle=i%3?'#a3d9e4':'#f0bbff';ctx.fillRect(x,y,i%4===0?2:1,2);}ctx.globalAlpha=1;
  if(hot){const pulse=.55+Math.sin(t*7)*.25;ring(cx,cy,100+Math.sin(t*4)*8,100,'#ff948b99',2);glow(cx,cy,150,`rgba(255,90,130,${pulse*.18})`);}
  const project=([x,y,z])=>({x:640+(x-r.lean*.28)*820/Math.max(.2,z),y:340-y*820/Math.max(.2,z)});
  const faces=[],yaw=Math.sin(t*.4)*.12+(r.impact>0?Math.sin(t*53)*r.impact*.13:0);
  const transform=([x,y,z])=>[x*Math.cos(yaw)+z*Math.sin(yaw),y+Math.sin(t*1.5)*.07,z*Math.cos(yaw)-x*Math.sin(yaw)+8.3+r.impact*.5];
  function face(vertices,base,emissive=false){
    const [a,b,c]=vertices,u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
    const shade=emissive?1:.4+Math.abs((n[0]*-.5+n[1]*.8+n[2]*-.5)/len)*.7;
    faces.push({vertices,depth:vertices.reduce((sum,p)=>sum+p[2],0)/vertices.length,base,shade,emissive});
  }
  function box(x,y,z,sx,sy,sz,base,emissive=false){
    const p=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>transform([x+p[0]*sx/2,y+p[1]*sy/2,z+p[2]*sz/2]));
    for(const indices of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]])face(indices.map(i=>p[i]),base,emissive);
  }
  function crystal(x,y,z,sx,sy,sz,base,emissive=false){
    const p=[[0,sy,0],[0,-sy,0],[-sx,0,0],[sx,0,0],[0,0,-sz],[0,0,sz]].map(p=>transform([x+p[0],y+p[1],z+p[2]]));
    for(const indices of [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]])face(indices.map(i=>p[i]),base,emissive);
  }
  const armour=[54,69,104],edge=[102,120,158],gold=[159,136,134],energy=exposed?[146,255,213]:[218,143,255];
  crystal(0,-.1,.08,1.12,1.55,.7,armour);
  crystal(-.52,.42,-.42,.55,.78,.28,edge);crystal(.52,.42,-.42,.55,.78,.28,[72,85,124]);
  crystal(0,-1.25,.05,.7,.9,.46,[47,60,98]);
  crystal(0,1.38,-.04,.61,.7,.5,edge);box(0,1.32,-.49,.8,.28,.12,[19,24,48]);
  crystal(-.43,2.05,.09,.16,.63,.18,gold);crystal(.43,2.05,.09,.16,.63,.18,gold);
  for(const side of [-1,1]){
    const lift=Math.sin(t*1.7+side)*.09+(hot?.15:0);
    crystal(side*1.22,.55+lift,.06,.58,.66,.54,edge);crystal(side*1.4,.72+lift,-.17,.16,.48,.2,gold);
    crystal(side*1.28,-.25+lift,-.04,.32,.7,.35,armour);crystal(side*1.34,-.96+lift,-.18,.26,.36,.27,[40,52,84]);
    for(let i=0;i<3;i++)crystal(side*(1.18+i*.12),-1.27+lift,-.24,.07,.3,.09,[100,115,146]);
    crystal(side*.43,-1.78,.11,.22,.72,.24,edge);
    box(side*.24,1.35,-.59,.27,.035,.03,energy,true);
    for(let i=0;i<3;i++)box(side*(.52-i*.06),.14-i*.27,-.61,.18,.025,.035,energy,true);
  }
  crystal(0,0,-.76,exposed?.36:.24,exposed?.53:.38,.15,energy,true);
  for(let i=0;i<5;i++){const a=t*.45+i*Math.PI*2/5;crystal(Math.cos(a)*2.25,Math.sin(a)*1.8,Math.sin(a)*.5,.11,.23,.14,[137,198,201]);}
  faces.sort((a,b)=>b.depth-a.depth);
  for(const f of faces){ctx.beginPath();f.vertices.map(project).forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));ctx.closePath();const flash=r.impact>0?(r.impact/.6)*30:0;ctx.fillStyle=`rgb(${f.base.map(c=>Math.min(255,Math.round(c*f.shade+flash))).join(',')})`;ctx.fill();ctx.strokeStyle=f.emissive?colour+'bb':'#b5c8f02b';ctx.lineWidth=f.emissive?1.4:.75;ctx.stroke();}
  const core=project(transform([0,0,-.9]));glow(core.x,core.y,exposed?125:70,exposed?'#79ffd650':'#c784ed45');
  for(const side of [-1,1]){const eye=project(transform([side*.24,1.35,-.62]));glow(eye.x,eye.y,25,colour+'66');}
  if(exposed){ring(core.x,core.y,55,55,'#a7ffdb88',1,t,0,Math.PI*1.5);ring(core.x,core.y,68,68,'#a7ffdb33',1,-t,0,Math.PI);}
  // Draw located real objects AFTER the boss. Their source is live video, not a
  // generated replacement. Coarse model polygons can include background edges.
  if(videoReady)for(const item of objects){
    const points=item.outline.map(([x,y])=>{const p=videoPoint(x,y,video.videoWidth,video.videoHeight);return {x:p.x*w,y:p.y*h};});
    ctx.save();ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));ctx.closePath();ctx.clip();camera();ctx.restore();
    const outlineColour=item.roles.includes('shield')?'#aaffdf':'#ffd3a0';ctx.save();ctx.shadowColor=outlineColour;ctx.shadowBlur=12;line([...points,points[0]],outlineColour+'aa',2);ctx.restore();
  }
  const hand=pointer||r.shieldPoint,sx=hand.x*w,sy=hand.y*h;
  if(r.shieldActive||r.parry>0){
    const shield=objects.find(o=>o.roles.includes('shield'));
    let outline;
    if(shield&&videoReady)outline=shield.outline.map(([x,y])=>{const p=videoPoint(x,y,video.videoWidth,video.videoHeight);return {x:p.x*w,y:p.y*h};});
    else outline=Array.from({length:6},(_,i)=>({x:sx+Math.cos(Math.PI/3*i)*112,y:sy+Math.sin(Math.PI/3*i)*132}));
    ctx.save();ctx.shadowColor='#a3ffdf';ctx.shadowBlur=r.parry>0?40:16;ctx.beginPath();outline.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));ctx.closePath();ctx.fillStyle=r.parry>0?'#caffdf77':'#6dffdc10';ctx.fill();ctx.strokeStyle=r.parry>0?'#fff9cf':'#9dffdd';ctx.lineWidth=r.parry>0?6:2;ctx.stroke();ctx.restore();
    if(r.parry>0){const q=1-r.parry/.45;ring(sx,sy,90+q*170,100+q*170,`rgba(180,255,222,${1-q})`,4);glow(sx,sy,180,'#c6ffe440');}
  }
  for(const bolt of r.bolts){
    const q=Math.max(0,Math.min(1,(7-bolt.depth)/6.35));
    const target=bolt.shieldPoint||(r.shieldActive?r.shieldPoint:{x:(640+bolt.lane*170)/w,y:.67});
    const endX=target.x*w,endY=target.y*h,x=core.x+(endX-core.x)*q,y=core.y+(endY-core.y)*q;
    const size=9+q*q*(bolt.kind==='beam'?44:26),c=bolt.returning?'#b7ffe1':'#ff8fbc';
    ctx.save();ctx.shadowColor=c;ctx.shadowBlur=24;const trailQ=Math.max(0,Math.min(1,q+(bolt.returning?.12:-.12)));
    line([{x:core.x+(endX-core.x)*trailQ,y:core.y+(endY-core.y)*trailQ},{x,y}],c+'aa',Math.max(3,size*.4));
    glow(x,y,size*3,c+'55');ctx.fillStyle='#fff4e8';ctx.beginPath();ctx.arc(x,y,size*.45,0,Math.PI*2);ctx.fill();ring(x,y,size,size,c,3,t);ring(x,y,size*1.5,size*.6,c+'88',1,-t);ctx.restore();
  }
  if(r.slash>0){
    const q=1-r.slash/.38,dir=r.slashDirection;
    ctx.save();ctx.globalAlpha=Math.min(1,r.slash*6);ctx.shadowColor='#ffbc81';ctx.shadowBlur=35;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(640-dir*(330+q*90),530-i*8);ctx.bezierCurveTo(640-dir*130,220-i*8,640+dir*60,390-i*8,640+dir*390,190-i*8);ctx.strokeStyle=i===1?'#fffbe5':i===0?'#ffb97577':'#ffd6ae';ctx.lineWidth=i===1?4:i===0?22:2;ctx.stroke();}ctx.restore();
  }
  if(r.impact>0){
    const q=1-r.impact/.6;ctx.save();ctx.globalAlpha=Math.max(0,1-q);for(let i=0;i<20;i++){const a=i*2.399,dist=30+q*180;const x=core.x+Math.cos(a)*dist,y=core.y+Math.sin(a)*dist;line([{x,y},{x:x+Math.cos(a)*15,y:y+Math.sin(a)*15}],'#ffdfaf',i%3?2:4);}ctx.font='700 34px system-ui';ctx.fillStyle='#fff1d5';ctx.textAlign='center';ctx.shadowColor='#ffb96a';ctx.shadowBlur=15;ctx.fillText('-'+r.lastDamage,core.x+80,core.y-35-q*55);ctx.restore();
  }
  if(r.combo>1){ctx.font='600 12px system-ui';ctx.textAlign='left';ctx.fillStyle='#ffdbad';ctx.fillText(r.combo+' HIT CHAIN',34,125);}
  if(r.dodge>0){ctx.fillStyle='#83ceff10';ctx.fillRect(0,0,w,h);line([{x:30,y:210},{x:8,y:360},{x:30,y:510}],'#b7edff',4);line([{x:1250,y:210},{x:1272,y:360},{x:1250,y:510}],'#b7edff',4);}
  const vignette=ctx.createRadialGradient(640,340,180,640,340,760);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#020815c9');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  if(g.flash>0){ctx.fillStyle=`rgba(255,65,90,${g.flash})`;ctx.fillRect(0,0,w,h);}
  ctx.restore();
}
