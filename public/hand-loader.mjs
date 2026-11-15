// Share startup across rapid off/on toggles; failed loads remain retryable.
export function createHandLoader(create) {
  let pending=null, current=null;
  return {
    load(cpuOnly=false) {
      if(pending)return pending;
      if(current&&(!cpuOnly||current.delegate==='CPU'))return Promise.resolve(current);
      if(current){try{current.model.close();}catch{}current=null;}
      pending=(async()=>{
        let model,delegate=cpuOnly?'CPU':'GPU';
        try{model=await create(delegate);}catch(error){
          if(cpuOnly)throw error;
          delegate='CPU';model=await create(delegate);
        }
        current={model,delegate};return current;
      })().finally(()=>{pending=null;});
      return pending;
    }
  };
}
