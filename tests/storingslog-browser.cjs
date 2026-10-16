const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site');
 const server=require('node:http').createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://local').pathname);if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end('ontbreekt');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const base='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:1440,height:900}}),requests=[];
  page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('blob:')&&!req.url().startsWith('data:'))requests.push(req.url());});
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));
  await page.locator('[data-route="services"]').first().click();await page.waitForFunction(()=>!!document.querySelector('#engine-dvm iframe')?.contentWindow.HUB);
  const dvm=page.frames().find(f=>f.url().includes('/engines/dvm.html'));
  await dvm.evaluate(()=>{
   console.warn('MODULE_TEST',new Error('oorzaak met stack'),{privateSource:'VERBODEN_BRON'});
   setTimeout(()=>{throw new Error('UNCUGHT_MODULE_TEST');},0);
   Promise.reject(new Error('PROMISE_MODULE_TEST'));
   parent.postMessage({type:'hub:import-progress',engine:'dvm',bestand:'test.json',pct:20,fase:'BROWSER_IMPORT_TEST',active:true},location.origin);
  });
  await page.waitForFunction(()=>BIDASH_DIAGNOSTICS.report().entries.some(e=>e.event==='promise.unhandled'));
  await page.evaluate(()=>window.postMessage({type:'hub:import-progress',fase:'ONGELDIGE_AFZENDER',active:false},location.origin));
  for(const route of ['organisation','planning']){await page.locator(`[data-route="${route}"]`).first().click();await page.waitForTimeout(150);}
  for(const engine of ['bi','planning']){
   const frame=page.frames().find(f=>f.url().includes('/engines/'+engine+'.html'));assert(frame,engine+' geladen');
   await frame.evaluate(name=>console.error('MODULE_'+name+'_TEST'),engine);
  }
  await page.locator('[data-route="data"]').first().click();
  // Echte importfout met behoud van een werkende downloadknop.
  await page.locator('#files').setInputFiles({name:'defect.json',mimeType:'application/json',buffer:Buffer.from('{"formaat":"DVM-dienstimpact-totaal", kapot')});
  await page.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));
  await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>{const until=performance.now()+650;while(performance.now()<until){}resolve();},0)));
  await page.waitForFunction(()=>BIDASH_DIAGNOSTICS.report().entries.some(e=>e.event==='performance.longtask'));
  let pending=page.waitForEvent('download');await page.locator('#downloadDiagnostics').click();let dl=await pending;
  assert.match(dl.suggestedFilename(),/^bidash-storingslog_.*\.json$/);
  let report=JSON.parse(fs.readFileSync(await dl.path(),'utf8')),text=JSON.stringify(report);
  for(const value of ['MODULE_TEST','UNCUGHT_MODULE_TEST','PROMISE_MODULE_TEST','MODULE_bi_TEST','MODULE_planning_TEST','BROWSER_IMPORT_TEST','files.selected','engine.ready','navigation','stack','defect.json'])assert(text.includes(value),value);
  assert(!text.includes('VERBODEN_BRON'));assert(!text.includes('ONGELDIGE_AFZENDER'));
  assert.match(report.context.version,/2\.61/);assert.equal(report.context.modules.dvm.ready,true);assert(report.context.modules.dvm.patches.__BIDASH_DVM_LIVE_PATCH_ACTIVE__);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));
  assert(await page.evaluate(()=>BIDASH_DIAGNOSTICS.report().entries.some(e=>JSON.stringify(e).includes('MODULE_TEST'))));
  // Hoofdschil blijft bruikbaar op mobiel.
  await page.setViewportSize({width:390,height:844});await page.locator('[data-route="data"]').first().click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=400));assert(await page.locator('#downloadDiagnostics').isVisible());
  await page.locator('#clearDiagnostics').click();assert(!await page.evaluate(()=>JSON.stringify(BIDASH_DIAGNOSTICS.report()).includes('MODULE_TEST')));
  assert.deepEqual(requests,[]);
  // Download werkt onafhankelijk van geslaagde applicatieboot.
  const broken=await browser.newPage();await broken.route('**/app.js?*',r=>r.abort());await broken.goto(base);
  pending=broken.waitForEvent('download');await broken.locator('#downloadDiagnostics').click();dl=await pending;
  report=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert(report.entries.some(e=>e.event==='resource.error'));
  // Losse importer gebruikt hetzelfde log, met eigen pagina-/VC-context.
  const importer=await browser.newPage();await importer.goto(base+'/signaalgever-importer.html');
  await importer.waitForFunction(()=>document.querySelector('#status').textContent.includes('Gereed.'));
  await importer.evaluate(()=>console.error(new Error('IMPORTER_TEST')));
  pending=importer.waitForEvent('download');await importer.locator('#downloadDiagnostics').click();dl=await pending;
  report=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.equal(report.context.page,'signaalgever-importer');assert(JSON.stringify(report).includes('IMPORTER_TEST'));
  // Ook bij geweigerde sessionStorage werkt een geheugenlog en download.
  const denied=await browser.newPage();await denied.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new Error('opslag geweigerd');}}));await denied.goto(base);
  pending=denied.waitForEvent('download');await denied.locator('#downloadDiagnostics').click();dl=await pending;
  report=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.match(report.retention.persistence,/geheugen/);
  console.log('Storingslog browser: modulefouten, promises, voortgang, importfout, long task, download, herladen, wissen, mobiel, bootfout, losse importer en opslagweigering geslaagd.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
