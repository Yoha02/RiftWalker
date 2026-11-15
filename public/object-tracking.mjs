// Convert cloud coordinates from the actual central crop back to the video.
export function objectFromCrop(item,width,height,now){
  const side=Math.min(width,height)*.95;
  const xy=([x,y])=>({x:((width-side)/2+x*side)/width,y:((height-side)/2+y*side)/height});
  const a=xy([item.box[1],item.box[0]]),b=xy([item.box[3],item.box[2]]);
  return {...item,box:[a.y,a.x,b.y,b.x],outline:item.outline.map(p=>{const q=xy(p);return [q.x,q.y];}),expiresAt:now+4500};
}
export function shiftObject(item,motion){
  if(motion.confidence<.55)return item;
  const dx=Math.max(-item.box[1],Math.min(1-item.box[3],motion.dx)),dy=Math.max(-item.box[0],Math.min(1-item.box[2],motion.dy));
  return {...item,box:[item.box[0]+dy,item.box[1]+dx,item.box[2]+dy,item.box[3]+dx],outline:item.outline.map(([x,y])=>[x+dx,y+dy])};
}
export function videoPoint(x,y,width,height,viewWidth=1280,viewHeight=720){
  const scale=Math.max(viewWidth/width,viewHeight/height),vw=width*scale,vh=height*scale;
  return {x:1-((viewWidth-vw)/2+x*vw)/viewWidth,y:((viewHeight-vh)/2+y*vh)/viewHeight};
}
