// Local block matching tracks moving foreground features even when a prop hides
// the fingers. This estimates camera motion; it is not object identification.
export function estimateObjectMotion(previous,current,width,height,region=null){
  if(!previous||previous.length!==current.length)return {confidence:0,dx:0,dy:0,x:.5,y:.5};
  const matches=[];let textured=0;
  const left=Math.max(12,Math.floor((region?.[1]||0)*width)-4),right=Math.min(width-12,Math.ceil((region?.[3]??1)*width)+4);
  const top=Math.max(12,Math.floor((region?.[0]||0)*height)-4),bottom=Math.min(height-12,Math.ceil((region?.[2]??1)*height)+4);
  const stride=region?3:6;
  for(let y=top;y<bottom;y+=stride)for(let x=left;x<right;x+=stride){
    let mean=0,variance=0;
    for(let py=-2;py<=2;py++)for(let px=-2;px<=2;px++)mean+=previous[(y+py)*width+x+px];
    mean/=25;
    for(let py=-2;py<=2;py++)for(let px=-2;px<=2;px++)variance+=Math.abs(previous[(y+py)*width+x+px]-mean);
    if(variance/25<14)continue;textured++;
    function cost(dx,dy){
      let targetMean=0,error=0;
      for(let py=-2;py<=2;py++)for(let px=-2;px<=2;px++)targetMean+=current[(y+py+dy)*width+x+px+dx];
      targetMean/=25;
      for(let py=-2;py<=2;py++)for(let px=-2;px<=2;px++)error+=Math.abs(previous[(y+py)*width+x+px]-mean-current[(y+py+dy)*width+x+px+dx]+targetMean);
      return error/25;
    }
    const stationary=cost(0,0);if(stationary<7)continue;
    let best=stationary,dx=0,dy=0;
    for(let cy=-10;cy<=10;cy+=2)for(let cx=-10;cx<=10;cx+=2){const c=cost(cx,cy);if(c<best){best=c;dx=cx;dy=cy;}}
    if((dx||dy)&&best<24&&best<stationary*.65)matches.push({dx,dy,x:(x+dx)/width,y:(y+dy)/height});
  }
  // Whole-frame displacement is more likely camera movement than a prop swipe.
  if(matches.length<3||(!region&&matches.length/Math.max(1,textured)>.72))return {confidence:0,dx:0,dy:0,x:.5,y:.5,cameraMoved:matches.length>=3};
  const median=key=>matches.map(m=>m[key]).sort((a,b)=>a-b)[Math.floor(matches.length/2)];
  const dx=median('dx'),dy=median('dy');
  const coherent=matches.filter(m=>Math.abs(m.dx-dx)<=2&&Math.abs(m.dy-dy)<=2);
  if(coherent.length<3)return {confidence:0,dx:0,dy:0,x:.5,y:.5};
  return {dx:dx/width,dy:dy/height,x:coherent.reduce((s,m)=>s+m.x,0)/coherent.length,y:coherent.reduce((s,m)=>s+m.y,0)/coherent.length,confidence:coherent.length/matches.length};
}
export function createPropSwipe(){
  let previousTime=0,lastMove=0,cooldownUntil=0,travelX=0,travelY=0;
  return {
    reset(){previousTime=lastMove=travelX=travelY=0;},
    update(motion,now,armed){
      const elapsed=previousTime?(now-previousTime)/1000:.08;previousTime=now;
      const moving=motion.confidence>=.55&&Math.hypot(motion.dx,motion.dy)/Math.max(.04,elapsed)>.18;
      if(!armed||elapsed>.3){travelX=travelY=0;return false;}
      if(!moving){if(now-lastMove>160)travelX=travelY=0;return false;}
      if(travelX*motion.dx+travelY*motion.dy<0)travelX=travelY=0;
      travelX+=motion.dx;travelY+=motion.dy;lastMove=now;
      if(now>=cooldownUntil&&Math.hypot(travelX,travelY)>=.075){cooldownUntil=now+600;travelX=travelY=0;return true;}
      return false;
    }
  };
}
