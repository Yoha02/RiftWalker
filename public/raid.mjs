export function createRaid(){return {lean:0,bolts:[],slash:0,parry:0,impact:0,lastDamage:0,combo:0,slashDirection:1,ready:false,awaitingItem:false,strikeReady:false,dodge:0,dodgeCooldown:0,lastAttack:false,lastDodge:false,shieldPoint:{x:.5,y:.65},shieldActive:false};}
export function stepRaid(g,dt,input,{event,hurt,damageBoss}){
  const r=g.raid,b=g.boss,p=g.player;
  p.invuln=Math.max(0,p.invuln-dt);p.attackCd=Math.max(0,p.attackCd-dt);
  r.slash=Math.max(0,r.slash-dt);r.parry=Math.max(0,r.parry-dt);r.dodge=Math.max(0,r.dodge-dt);r.dodgeCooldown=Math.max(0,r.dodgeCooldown-dt);
  r.impact=Math.max(0,r.impact-dt);
  r.lean+=(Math.max(-1,Math.min(1,input.move||0))-r.lean)*Math.min(1,dt*9);
  if(input.pointer)r.shieldPoint={x:Math.max(.02,Math.min(.98,input.pointer.x)),y:Math.max(.02,Math.min(.98,input.pointer.y))};
  const powers=input.liveMode?(input.livePowers||{}):g.powers;
  r.strikeReady=!!powers.strike;
  if(!r.ready&&(!input.liveMode||powers.shield||powers.reflect||powers.strike)){
    r.ready=true;if(input.liveMode)b.timer=Math.min(b.timer,2);
  }
  r.awaitingItem=b.state==='intro'&&input.liveMode&&!r.ready;
  r.shieldActive=!!(powers.shield||powers.reflect)&&(input.liveMode||!!input.guard);
  p.guard=r.shieldActive;
  if(input.jump&&!r.lastDodge&&r.dodgeCooldown<=0){r.dodge=.55;r.dodgeCooldown=1.2;event(g,'DODGE — slip past the incoming blast.');}
  r.lastDodge=!!input.jump;
  if(input.attack&&!r.lastAttack&&p.attackCd<=0){
    if(powers.strike||!input.liveMode){
      p.attackCd=.6;r.slash=.38;r.slashDirection=input.swipeDirection||g.player.face||1;
      r.lastDamage=b.state==='exposed'?(powers.strike?24:12):5;r.impact=.55;r.combo++;
      damageBoss(g,r.lastDamage);
      event(g,powers.strike?'RIFT STRIKE — your held prop cuts through the rift.':'Practice strike.','power');
    }else event(g,'Show a phone or pen until STRIKE lights up, then swipe.');
  }
  r.lastAttack=!!input.attack;
  if(g.phase!=='boss')return;
  if(!r.awaitingItem)b.timer-=dt;
  if(b.state==='intro'&&b.timer<=0){b.state='windup';b.timer=2.4;b.attack='orbs';event(g,'The Warden is in front of you. Raise a book to return its attack.','boss');}
  else if(b.state==='windup'&&b.timer<=0){b.state='attack';b.timer=b.attack==='beam'?1.6:2.2;b.fired=false;b.nextShot=0;}
  else if(b.state==='attack'){
    b.nextShot=(b.nextShot||0)-dt;
    if(!b.fired||(b.attack==='orbs'&&b.nextShot<=0)){
      b.fired=true;b.nextShot=.8;
      r.bolts.push({depth:7,lane:r.lean,kind:b.attack,returning:false});
    }
    if(b.timer<=0){b.state='exposed';b.timer=4;event(g,'CORE EXPOSED — swipe your phone or pen.','boss');}
  }else if(b.state==='exposed'&&b.timer<=0){b.cycle++;b.state='windup';b.attack=b.cycle%2?'beam':'orbs';b.timer=b.hp<75?1.7:2.4;}
  for(const bolt of r.bolts){
    bolt.depth+=(bolt.returning?8:-(b.hp<75?5:3.7))*dt;
    if(bolt.returning&&bolt.depth>=7){r.lastDamage=bolt.kind==='beam'?22:16;r.impact=.6;r.combo++;damageBoss(g,r.lastDamage);bolt.done=true;}
    else if(!bolt.returning&&bolt.depth<=.65){
      if(r.shieldActive){
        bolt.returning=true;bolt.depth=.65;bolt.shieldPoint={...r.shieldPoint};r.parry=.45;g.stats.blocks++;g.stats.reflects++;
        b.state='exposed';b.timer=4;event(g,'BOUNCED BACK — your held shield returns the blast.','power');
      }else {if(r.dodge<=0&&Math.abs(r.lean-bolt.lane)<.6){r.combo=0;hurt(g);}else event(g,'DODGED - strike back.');bolt.done=true;}
    }
  }
  r.bolts=r.bolts.filter(bolt=>!bolt.done);
  if(g.phase==='won')r.bolts=[];
}
