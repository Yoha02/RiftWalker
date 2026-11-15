// Sample only at an unbuilt gap. Never overlap requests or apply stale results.
export function createAutoWeaver({context,request,result,status,accept=answer=>answer.accepted===true&&answer.source==='gemini-decision'&&answer.ability==='bridge',feedback=()=>['ready','Bridge woven. Keep moving!'],clock=()=>performance.now()}) {
  let busy=false,next=0,generation=0,controller=null,failures=0;
  function cancel(){if(controller){generation++;controller.abort();controller=null;}}
  async function tick(){
    const start=context();
    if(!start){cancel();return;}
    if(busy||clock()<next)return;
    busy=true;const id=++generation,started=clock();
    const abort=new AbortController();controller=abort;
    const same=()=>{const current=context();return id===generation&&current&&current.game===start.game&&current.gap===start.gap&&current.camera===start.camera;};
    const timeout=setTimeout(()=>abort.abort(),8000);
    status('checking','Hold your object steady — checking its shape…');
    try{
      const answer=await request(abort.signal);
      if(!same()||clock()-started>8000)return;
      failures=0;
      if(accept(answer)){
        result(answer,start);status(...feedback(answer,start));
      }else status('looking','Try a phone, notebook or ruler. Hold it inside the camera guide.');
      next=clock()+1200;
    }catch(error){
      if(!same())return;
      failures++;
      const stop=[400,401,402,403,404].includes(error.status)||failures>=3;
      next=clock()+(error.status===429?10000:3000);
      status(stop?'error':'retry',stop?`Live detection stopped: ${error.message}`:'Checking interrupted. Retrying shortly…');
    }finally{clearTimeout(timeout);if(controller===abort)controller=null;busy=false;}
  }
  return {tick,cancel,reset(){cancel();next=0;failures=0;}};
}
