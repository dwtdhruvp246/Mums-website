import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const root=path.resolve(import.meta.dirname,'..');
const temporary=await mkdtemp(path.join(tmpdir(),'catering-pwa-'));
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
try {
  const code=ts.transpileModule(await readFile(path.join(root,'lib/pwa-install.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  await writeFile(path.join(temporary,'install.mjs'),code);
  const {observePwaInstall,installInstructions}=await import(pathToFileURL(path.join(temporary,'install.mjs')));
  const manifestUrl='https://example.com/Mums-website/manifest.webmanifest';
  const navigator={userAgent:'Chrome',platform:'Linux',maxTouchPoints:0};
  class Browser extends EventTarget {
    modes=new Map();
    matchMedia(query){if(!this.modes.has(query))this.modes.set(query,Object.assign(new EventTarget(),{matches:false}));return this.modes.get(query);}
  }
  function harness(nav={...navigator},browser=new Browser()){
    let state;const controller=observePwaInstall(browser,nav,manifestUrl,next=>{state=next;});
    return {browser,controller,get state(){return state;}};
  }
  function invitation(outcome){return Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{},userChoice:Promise.resolve({outcome})});}
  const h=harness();
  check(!h.state.installed&&!h.state.canPrompt&&!h.state.message,'An uninstalled visitor starts with the install action and no menu instructions');
  await h.controller.install();
  check(!h.state.installed&&h.state.message.includes('preparing installation')&&!h.state.message.includes('menu'),'A tap before browser readiness gives feedback without directing users to a menu');
  const dismissed=invitation('dismissed');h.browser.dispatchEvent(dismissed);
  check(dismissed.defaultPrevented&&h.state.canPrompt,'Capture a browser invitation for the install button');
  await h.controller.install();
  check(!h.state.installed&&!h.state.canPrompt&&h.state.message.includes('not completed'),'Cancelling the browser dialog keeps the reminder and the install action');
  h.browser.dispatchEvent(invitation('accepted'));await h.controller.install();
  check(!h.state.installed,'Accepting a prompt alone does not hide the message before installation is confirmed');
  h.browser.dispatchEvent(new Event('appinstalled'));
  check(h.state.installed,'Confirmed installation hides the message immediately');
  h.controller.dispose();
  const secondVisit=harness();check(!secondVisit.state.installed,'No persistent dismissal or stale installed flag hides the reminder on a later visit');secondVisit.controller.dispose();
  const standaloneBrowser=new Browser();standaloneBrowser.matchMedia('(display-mode: standalone)').matches=true;
  const standalone=harness({...navigator},standaloneBrowser);check(standalone.state.installed,'Installed standalone app has no reminder');
  standaloneBrowser.matchMedia('(display-mode: standalone)').matches=false;standaloneBrowser.matchMedia('(display-mode: standalone)').dispatchEvent(new Event('change'));
  check(!standalone.state.installed,'Returning to ordinary browser mode restores the reminder when needed');standalone.controller.dispose();
  const ios=harness({...navigator,standalone:true});check(ios.state.installed,'iOS standalone mode is detected');ios.controller.dispose();
  const earlyBrowser=new Browser();earlyBrowser.__cateringInstallPrompt=invitation('dismissed');
  const early=harness({...navigator},earlyBrowser);check(early.state.canPrompt,'An invitation captured before hydration remains usable');early.controller.dispose();
  const related=harness({...navigator,getInstalledRelatedApps:async()=>[{platform:'webapp',url:manifestUrl}]});await tick();
  check(related.state.installed,'A related installation can hide the reminder in a browser tab');related.controller.dispose();
  const unrelated=harness({...navigator,getInstalledRelatedApps:async()=>[{platform:'webapp',id:'https://other.example/'}]});await tick();
  check(!unrelated.state.installed,'An unrelated installed app cannot hide the reminder');unrelated.controller.dispose();
  const failed=harness({...navigator,getInstalledRelatedApps:async()=>{throw new Error('restricted');}});await tick();
  check(!failed.state.installed,'Restricted installation detection still displays instructions');failed.controller.dispose();
  const byId=harness({...navigator,getInstalledRelatedApps:async()=>[{platform:'webapp',id:'https://example.com/'}]});await tick();
  check(byId.state.installed,'Recognise the original computed app identity, resolved against the start origin');byId.controller.dispose();
  check(installInstructions({...navigator,userAgent:'iPhone Safari'}).includes('Share → Add to Home Screen'),'iPhone receives Home Screen instructions');
  check(installInstructions({...navigator,platform:'MacIntel',maxTouchPoints:5}).includes('Home Screen'),'iPad desktop browser mode receives iPad instructions');
  check(installInstructions({...navigator,userAgent:'Macintosh Safari'}).includes('Add to Dock'),'Mac Safari receives Dock instructions');
  check(installInstructions({...navigator,userAgent:'Android Firefox'}).includes('Google Chrome'),'Unsupported Android browsers receive a direct-install alternative');
  check(installInstructions({...navigator,userAgent:'Firefox'}).includes('Chrome or Edge'),'Unsupported desktop browsers receive an actionable alternative');
  check(!/menu|⋮|3 dots|address bar/.test(installInstructions({...navigator,userAgent:'Android Chrome'})),'Android Chrome is never sent to the three-dot menu');
  let directCalls=0;
  const direct=harness({...navigator,install:async()=>{directCalls++;}});
  check(direct.state.canPrompt,'An available direct browser API needs no deferred event');
  await direct.controller.install();check(directCalls===1&&direct.state.installed,'Direct install calls the browser exactly once and hides only after it resolves successfully');direct.controller.dispose();
  const aborted=harness({...navigator,install:async()=>{throw Object.assign(new Error('cancelled'),{name:'AbortError'});}});
  await aborted.controller.install();check(!aborted.state.installed&&aborted.state.message.includes('not completed'),'Cancelling a direct install leaves the persistent action visible');aborted.controller.dispose();
  const rejected=harness({...navigator,install:async()=>{throw new Error('unavailable');}});
  await rejected.controller.install();check(!rejected.state.installed&&rejected.state.message.includes('try Install app again'),'A failed direct install gives retry feedback without pretending to be installed');rejected.controller.dispose();
  let sameTapCalls=0;
  const sameTap=harness({...navigator,userActivation:{isActive:true}});
  await sameTap.controller.install();
  const offeredOnTap=invitation('dismissed');offeredOnTap.prompt=async()=>{sameTapCalls++;};sameTap.browser.dispatchEvent(offeredOnTap);await tick();
  check(sameTapCalls===1,'If the first tap unlocks the browser offer, the same active gesture opens the prompt');sameTap.controller.dispose();
  let delayedCalls=0;
  const delayed=harness({...navigator,userActivation:{isActive:false}});
  await delayed.controller.install();
  const delayedOffer=invitation('dismissed');delayedOffer.prompt=async()=>{delayedCalls++;};delayed.browser.dispatchEvent(delayedOffer);await tick();
  check(delayedCalls===0&&delayed.state.canPrompt&&delayed.state.message.includes('Ready to install'),'An offer after the original gesture expires waits for an explicit new tap');
  await delayed.controller.install();check(delayedCalls===1,'The ready install button opens the browser confirmation directly');delayed.controller.dispose();

  const manifest=JSON.parse(await readFile(path.join(root,'public/manifest.webmanifest'),'utf8'));
  check(manifest.display==='standalone'&&manifest.prefer_related_applications===false,'Manifest opens a standalone web app');
  for(const origin of ['https://example.com/','https://example.com/Mums-website/']){
    const url=new URL('manifest.webmanifest',origin);
    check(new URL(manifest.scope,url).href===origin&&new URL(manifest.start_url,url).href===origin,'Manifest scope and launch stay inside the host path');
    check(new URL(manifest.id,new URL(origin).origin).href===new URL('/',origin).href,'Explicit id preserves the originally installed app identity on each origin');
    check(manifest.icons.every(icon=>new URL(icon.src,url).href.startsWith(origin+'pwa/')),'Icons resolve within the app path');
  }
  for(const [name,size] of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-touch-icon',180]]){
    const png=await readFile(path.join(root,'public/pwa',name+'.png'));
    check(png.readUInt32BE(16)===size&&png.readUInt32BE(20)===size,'PNG icon has its declared dimensions: '+name);
  }
  const component=await readFile(path.join(root,'app/pwa-install.tsx'),'utf8');
  check(!/onDismiss|onClose|localStorage|sessionStorage|>Later</.test(component),'Install strip has no dismissal control or stored suppression');

  // Exercise the actual worker with mocked cache/network boundaries, including private requests.
  const listeners={},cached=[],responses=[];let fetchFails=false,claimed=false;
  const offlineResponse=new Response('offline');
  const cache={put:async url=>cached.push(url)};
  const deleted=[];
  runInNewContext(await readFile(path.join(root,'public/sw.js'),'utf8'),{
    self:{registration:{scope:'https://example.com/Mums-website/'},clients:{claim:async()=>{claimed=true;}},addEventListener:(type,listener)=>{listeners[type]=listener;}},
    URL,Response,caches:{open:async()=>cache,match:async()=>offlineResponse,keys:async()=>['unrelated','catering-desk-public-v0:/','catering-desk-public-v0:/Mums-website/'],delete:async name=>deleted.push(name)},
    fetch:async(input)=>{if(fetchFails)throw new Error('offline');if(typeof input==='string')return new Response(input.endsWith('.html')?'<meta name="catering-offline">':'png',{headers:{'content-type':input.endsWith('.html')?'text/html':'image/png'}});return new Response('network');},
  });
  let work;listeners.install({waitUntil:promise=>{work=promise;}});await work;
  check(cached.length===5&&cached.every(url=>/\/(offline.html|pwa\/[^/]+\.png)$/.test(url)),'Worker precaches only the public offline page and brand icons');
  listeners.activate({waitUntil:promise=>{work=promise;}});await work;
  check(claimed&&deleted.length===1&&deleted[0].endsWith(':/Mums-website/'),'Worker activation removes only old public caches for its own scope');
  const request=(url,extras={})=>({method:'GET',mode:'cors',url,headers:new Headers(),...extras});
  const intercept=req=>{let response;listeners.fetch({request:req,respondWith:promise=>{response=promise;responses.push(promise);}});return response;};
  for(const req of [
    request('https://example.com/Mums-website/api/auth/config'),
    request('https://example.com/Mums-website/auth/callback'),
    request('https://example.com/Mums-website/?code=private'),
    request('https://example.com/Mums-website/',{headers:new Headers({RSC:'1'})}),
    request('https://project.supabase.co/rest/v1/catering_workspaces'),
    request('https://project.supabase.co/auth/v1/token'),
    request('https://example.com/another-app/'),
    request('https://example.com/Mums-website/',{method:'POST'}),
    request('https://example.com/Mums-website/pages-assets/main-123.js'),
  ])check(intercept(req)===undefined,'Private, out-of-scope and non-allowlisted requests are not intercepted: '+req.url);
  check(await (await intercept(request('https://example.com/Mums-website/',{mode:'navigate'}))).text()==='network','Online navigation always comes from the network');
  fetchFails=true;
  check(await (await intercept(request('https://example.com/Mums-website/',{mode:'navigate'}))).text()==='offline','Offline navigation receives the public fallback without caching workspace HTML');
  check(cached.length===5,'Navigation never adds user data to the cache');
  console.log(JSON.stringify({result:'PASS',checks,scope:'Install lifecycle, no dismissal, iOS/desktop guidance, root/project paths, icons and worker cache privacy. No database writes.'}));
} finally {await rm(temporary,{recursive:true,force:true});}
