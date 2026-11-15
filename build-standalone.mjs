import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=file=>readFile(path.join(root,file),'utf8');
const [html,css,core,camera,handLoader,autoWeave,liveItems,raid,raidView,objectMotion,objectTracking,game]=await Promise.all(['public/index.html','public/style.css','public/core.mjs','public/camera.mjs','public/hand-loader.mjs','public/auto-weave.mjs','public/live-items.mjs','public/raid.mjs','public/raid-view.mjs','public/object-motion.mjs','public/object-tracking.mjs','public/game.mjs'].map(read));
const offlineStatus=`async function status(){api={configured:false};$('auto-weave').checked=false;$('auto-weave').disabled=true;$('api-status').textContent='Practice mode - no key needed';$('footer-status').textContent='STANDALONE PRACTICE / NO SERVER NEEDED';document.querySelector('.practice').open=true;}`;
const client=game.replace(/^import .*;\r?\n/gm,'').replace(/async function status\(\)\{[^\n]+\}/,offlineStatus)
  .replaceAll('Open this game at localhost in Chrome or Edge to access the camera.','Open this HTML file directly in Chrome or Edge and allow camera access.')
  .replaceAll('Camera access needs localhost or HTTPS in a supported browser.','Open this HTML file directly in Chrome or Edge to use the camera.');
const js=[raid,core,camera,handLoader,autoWeave,liveItems,objectMotion,objectTracking,raidView].map(s=>s.replace(/^\uFEFF/,'').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n'+client;
if(js.includes('async function status(){try{'))throw new Error('Standalone status replacement failed');
if(/^import /m.test(js))throw new Error('Unbundled local import');
const output=html.replace('<link rel="stylesheet" href="/style.css">',`<style>${css}</style>`)
  .replace('href="/" aria-label="Riftmender home"','href="#" aria-label="Riftmender home"')
  .replace('<script type="module" src="/game.mjs"></script>',`<script type="module">${js.replaceAll('</script','<\\/script')}</script>`)
  .replace('Copy <code>.env.example</code> to <code>.env</code> in the project folder, set <code>GEMINI_API_KEY</code>, then restart <code>npm start</code>. The key stays on your local server. Model access must be tested with your account.','This file runs practice gameplay and camera controls without a server or Gemini key. To use real object recognition later, launch the full project with START-RIFTMENDER.cmd and configure the key there.')
  .replace('Set up Gemini locally','About this standalone edition');
await writeFile(path.join(root,'PLAY-RIFTMENDER.html'),output);
console.log('Created PLAY-RIFTMENDER.html. Open directly in Chrome; no local server or Gemini key required.');
