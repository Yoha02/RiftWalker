const LIVE_ABILITIES=['bridge','shield','reflect','strike'];
// Inventory is a history; equipped powers require a recent camera observation.
export function observeLiveItem(game,answer,now){
  if(answer?.source!=='gemini-decision'||!Array.isArray(answer.acceptedAbilities))return false;
  const powers=answer.acceptedAbilities.filter(a=>LIVE_ABILITIES.includes(a));
  // One ambiguous snapshot may be motion blur during a swipe. Preserve only a
  // briefly confirmed item, never refresh its lease with repeated uncertainty.
  const prior=game.liveItem,visible=answer.answers?.visible;
  const ambiguous=visible&&visible.probability>.2&&prior?.powers.length&&
    prior.powers.some(key=>answer.answers?.[key]?.probability>=.5);
  if(!powers.length&&ambiguous&&now<prior.expiresAt&&!prior.grace){
    prior.expiresAt=Math.min(prior.expiresAt,now+1000);prior.grace=true;return true;
  }
  game.liveItem={powers,label:answer.label||'Held object',seenAt:now,expiresAt:now+4500};
  return true;
}
export function currentLivePowers(game,now){
  if(!game.liveItem||now>=game.liveItem.expiresAt)return {};
  return Object.fromEntries(game.liveItem.powers.map(power=>[power,true]));
}
export function clearLiveItem(game){game.liveItem=null;}
