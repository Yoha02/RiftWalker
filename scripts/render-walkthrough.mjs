// Documentation-only scene replay. Uses actual game logic and drawing code,
// with a small Canvas-to-SVG adapter; no browser, camera, model, or API key.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import * as core from '../public/core.mjs';
import {drawRaid} from '../public/raid-view.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=path.join(root,'docs/images');await mkdir(output,{recursive:true});
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const n=x=>Number(x.toFixed(3));
function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
class SvgCanvas {
  constructor(){this.nodes=[];this.defs=[];this.stack=[];this.d='';this.s={matrix:[1,0,0,1,0,0],fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,font:'14px sans-serif',textAlign:'start',dash:[]};}
  save(){this.stack.push({...this.s,matrix:[...this.s.matrix],dash:[...this.s.dash]});}
  restore(){this.s=this.stack.pop();if(!this.s)throw Error('Unbalanced canvas state');}
  translate(x,y){this.s.matrix=multiply(this.s.matrix,[1,0,0,1,x,y]);}
  scale(x,y){this.s.matrix=multiply(this.s.matrix,[x,0,0,y,0,0]);}
  rotate(a){this.s.matrix=multiply(this.s.matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);}
  beginPath(){this.d='';}
  moveTo(x,y){this.d+=`M${n(x)},${n(y)} `;}
  lineTo(x,y){this.d+=`L${n(x)},${n(y)} `;}
  closePath(){this.d+='Z ';}
  bezierCurveTo(a,b,c,d,e,f){this.d+=`C${n(a)},${n(b)} ${n(c)},${n(d)} ${n(e)},${n(f)} `;}
  quadraticCurveTo(a,b,c,d){this.d+=`Q${n(a)},${n(b)} ${n(c)},${n(d)} `;}
  ellipse(x,y,rx,ry,rotation,start,end){
    const segments=Math.max(8,Math.ceil(Math.abs(end-start)*12));
    for(let i=0;i<=segments;i++){const a=start+(end-start)*i/segments,px=Math.cos(a)*rx,py=Math.sin(a)*ry;this[i===0&&!this.d?'moveTo':'lineTo'](x+px*Math.cos(rotation)-py*Math.sin(rotation),y+px*Math.sin(rotation)+py*Math.cos(rotation));}
  }
  arc(x,y,r,a,b){this.ellipse(x,y,r,r,0,a,b);}
  setLineDash(dash){this.s.dash=[...dash];}
  gradient(type,attributes){const id=`grad${this.defs.length}`,stops=[];this.defs.push({id,type,attributes,stops});return {id,addColorStop:(offset,colour)=>stops.push({offset,colour})};}
  createLinearGradient(x1,y1,x2,y2){return this.gradient('linearGradient',`x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"`);}
  createRadialGradient(x1,y1,r1,x2,y2,r2){return this.gradient('radialGradient',`cx="${n(x2)}" cy="${n(y2)}" r="${n(r2)}" fx="${n(x1)}" fy="${n(y1)}"`);}
  paint(value,kind){
    if(value?.id)return `${kind}="url(#${value.id})"`;
    let colour=String(value),opacity=1;
    if(colour==='transparent'){colour='#000';opacity=0;}
    if(/^#[0-9a-f]{8}$/i.test(colour)){opacity=parseInt(colour.slice(7,9),16)/255;colour=colour.slice(0,7);}
    if(/^#[0-9a-f]{4}$/i.test(colour)){opacity=parseInt(colour[4],16)/15;colour='#'+[...colour.slice(1,4)].map(c=>c+c).join('');}
    const rgba=colour.match(/^rgba\(([^)]+)\)$/);if(rgba){const parts=rgba[1].split(',');opacity=Number(parts.pop());colour=`rgb(${parts.join(',')})`;}
    return `${kind}="${xml(colour)}" ${kind}-opacity="${n(opacity)}"`;
  }
  attrs(){return `transform="matrix(${this.s.matrix.map(n).join(' ')})" opacity="${n(this.s.globalAlpha)}"`;}
  fill(){this.nodes.push(`<path d="${this.d}" ${this.paint(this.s.fillStyle,'fill')} ${this.attrs()}/>`);}
  stroke(){this.nodes.push(`<path d="${this.d}" fill="none" ${this.paint(this.s.strokeStyle,'stroke')} stroke-width="${this.s.lineWidth}" stroke-linejoin="round" stroke-dasharray="${this.s.dash.join(' ')}" ${this.attrs()}/>`);}
  fillRect(x,y,w,h){this.nodes.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${this.paint(this.s.fillStyle,'fill')} ${this.attrs()}/>`);}
  fillText(text,x,y){const size=this.s.font.match(/([\d.]+)px/)?.[1]||14,weight=this.s.font.match(/^(\d{3}) /)?.[1]||400;this.nodes.push(`<text x="${n(x)}" y="${n(y)}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${this.s.textAlign==='center'?'middle':this.s.textAlign==='right'?'end':'start'}" ${this.paint(this.s.fillStyle,'fill')} ${this.attrs()}>${xml(text)}</text>`);}
  body(){return `<defs>${this.defs.map(g=>`<${g.type} id="${g.id}" gradientUnits="userSpaceOnUse" ${g.attributes}>${g.stops.map(s=>`<stop offset="${s.offset}" ${this.paint(s.colour,'stop-color').replace('stop-color-opacity','stop-opacity')}/>`).join('')}</${g.type}>`).join('')}</defs>${this.nodes.join('')}`;}
}
for(const prop of ['fillStyle','strokeStyle','lineWidth','globalAlpha','font','textAlign'])Object.defineProperty(SvgCanvas.prototype,prop,{get(){return this.s[prop];},set(v){this.s[prop]=v;}});
const client=await readFile(path.join(root,'public/game.mjs'),'utf8');
const renderer=client.slice(client.indexOf('function path('),client.indexOf('function frame('));
function renderGame(game){
  const ctx=new SvgCanvas();
  const scope={...core,g:game,ctx,drawRaid,stream:null,$:()=>({readyState:0}),performance:{now:()=>0},activePointer:()=>null,currentObjects:()=>[]};
  vm.runInNewContext(renderer+'\nrender();',scope,{timeout:3000});
  if(ctx.stack.length)throw Error('Unbalanced rendered scene');return ctx.body();
}
function frame(scene,title,subtitle,badge,footer){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="886" viewBox="0 0 1280 886" role="img" aria-label="${xml(title)}"><title>${xml(title)}</title><rect width="1280" height="886" fill="#0b1420"/><text x="36" y="31" font-family="Arial,sans-serif" font-size="12" fill="#91dcca" letter-spacing="3">RIFT WALKER / YOUR WORLD IS THE INVENTORY</text><text x="36" y="69" font-family="Arial,sans-serif" font-size="29" fill="#f1f6f5">${xml(title)}</text><text x="36" y="95" font-family="Arial,sans-serif" font-size="14" fill="#9fb6c3">${xml(subtitle)}</text><rect x="1013" y="34" width="232" height="37" rx="7" fill="#203636" stroke="#477b70"/><text x="1129" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#a9f0d8">${xml(badge)}</text><defs><clipPath id="sceneclip"><rect width="1280" height="720"/></clipPath></defs><g transform="translate(0 112)" clip-path="url(#sceneclip)">${scene}</g><rect y="832" width="1280" height="54" fill="#0b1420"/><text x="36" y="865" font-family="Arial,sans-serif" font-size="13" fill="#92a9b7">${xml(footer)}</text></svg>`;
}
const stages=[];
let g=core.createGame();core.startGame(g);g.clock=8;g.player.x=490;for(let i=0;i<30;i++)core.step(g,1/60);g.cameraX=170;
stages.push(['01-broken-reach','01 / Reach the impossible gap','A tiny traveler, floating islands, and a path that stops short.','CHAPTER ONE',structuredClone(g)]);
core.unlock(g,'bridge',{source:'practice',label:'Notebook'});core.buildBridge(g);g.particles=[];
stages.push(['02-worldweave','02 / Borrow a bridge','A flat or elongated object supplies Worldweave. The missing path becomes traversable.','BRIDGE EQUIPPED',structuredClone(g)]);
for(let i=0;i<105;i++)core.step(g,1/60,{move:1});g.cameraX=Math.max(0,g.player.x-470);
stages.push(['03-cross-the-rift','03 / Keep moving','Walk across the woven platform and continue toward the Warden.','PATH RESTORED',structuredClone(g)]);
core.beginBoss(g);g.clock=10;g.boss.state='windup';g.boss.attack='orbs';g.boss.timer=2;
stages.push(['04-reality-raid','04 / The Warden crosses over','The second chapter switches to a perspective boss encounter.','CHAPTER TWO',structuredClone(g)]);
core.unlock(g,'shield',{source:'practice',label:'Book'});g.raid.bolts=[{depth:.66,lane:0,kind:'orbs',returning:false}];core.step(g,1/60,{guard:true,pointer:{x:.76,y:.66}});g.raid.bolts[0].depth=1.6;
stages.push(['05-aegis','05 / Turn defense into damage','An equipped shield catches the incoming blast and returns it to the Warden.','SHIELD / RETURN FIRE',structuredClone(g)]);
g.raid.bolts=[];g.raid.parry=0;core.unlock(g,'strike',{source:'practice',label:'Pen'});g.boss.state='exposed';g.boss.timer=4;core.step(g,1/60,{attack:true,swipeDirection:1});
stages.push(['06-riftblade','06 / Strike the exposed core','A recognized pen or phone equips Riftblade. A swipe triggers the attack.','STRIKE / CORE OPEN',structuredClone(g)]);
for(const [file,title,subtitle,badge,state] of stages){
  const footer='DOCUMENTATION REPLAY / Actual game drawing code, manually equipped practice state. No live AI or camera result is claimed.';
  await writeFile(path.join(output,file+'.svg'),frame(renderGame(state),title,subtitle,badge,footer));
}
console.log(`Rendered ${stages.length} documentation scenes from the current game code.`);
