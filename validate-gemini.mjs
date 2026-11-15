import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const values={};
for(const line of (await readFile(path.join(root,'.env'),'utf8')).split(/\r?\n/)){
  const match=line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if(match)values[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const key=values.GEMINI_API_KEY;
if(!key){console.error('FAIL: GEMINI_API_KEY is empty in .env.');process.exit(1);}
const redact=value=>String(value).replaceAll(key,'[REDACTED]');
let failed=false;
async function check(label,endpoint,payload){
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/${endpoint}`,{
      method:payload?'POST':'GET',
      headers:{'x-goog-api-key':key,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{}),
      signal:AbortSignal.timeout(30000)
    });
    const body=await response.json();
    if(!response.ok){failed=true;console.error(`${label}: HTTP ${response.status} - ${redact(body.error?.message||'Request rejected')}`);return null;}
    console.log(`${label}: PASS (HTTP ${response.status})`);return body;
  }catch(error){failed=true;console.error(`${label}: CONNECTION FAILED - ${redact(error.cause?.message||error.message)}`);return null;}
}
console.log('Testing the local key against Google. No camera images are sent.\n');
const models=await check('Key / model listing','models');
if(models){
  const decisionModel=values.GEMINI_DECISION_MODEL||'gemini-decision-1';
  const namingModel=values.GEMINI_MODEL||'gemini-4-hydrogen';
  const decisions=await check(`Decision model (${decisionModel})`,'decisions',{
    model:decisionModel,input:[{type:'text',text:'A notebook is on the table.'}],
    questions:{visible:{type:'noul',instructions:'Does the provided text mention a notebook?'}}
  });
  if(decisions&&!Number.isFinite(decisions.answers?.visible?.noul)){
    failed=true;console.error('Decision response did not contain the answer shape expected by this game.');
  }
  await check(`Naming model (${namingModel})`,`models/${encodeURIComponent(namingModel)}:generateContent`,{
    contents:[{parts:[{text:'Reply with the word OK.'}]}],generationConfig:{maxOutputTokens:32}
  });
}
console.log('\n'+(failed?'One or more checks failed. Share the status messages above; do not share the key.':'Key and configured model requests succeeded. Camera-image recognition still needs an in-game test.'));
console.log('Use START-RIFTMENDER.cmd and http://127.0.0.1:4173 for Gemini. The standalone HTML disables API calls.');
process.exitCode=failed?1:0;
