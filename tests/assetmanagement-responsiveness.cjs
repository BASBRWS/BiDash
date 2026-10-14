const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const site=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{
  try{const p=path.join(site,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await page.locator('[data-group=assets]').click();const dvm=page.frames().find(f=>f.url().includes('/dvm.html'));
  await dvm.waitForFunction(()=>window.HUB?.__bidashFaultsExtended&&window.HUB?.faultsAsync);
  await page.locator('[data-group=overview]').click();
  // Echte adapter, verrijking en statusfilters; uitsluitend de bronnen zijn synthetisch.
  await dvm.evaluate(()=>{
   ASSET_REGISTER_STATE={assets:Array.from({length:50000},(_,i)=>({key:'test:'+i,naam:'MSI '+i,tp:i===1||i===2?'DRIP':'MSI',weg:'A15',richting:'RE',hm:i/1000,vc:'ZWN',status:'Operationeel',prognoseActief:i!==0&&i!==49999,specialWind:i===1,specialRia4:i===2}))};
   const bevestiging=new Date().toISOString();
   STATE={meldingen:Array.from({length:5000},(_,i)=>({eventId:'f:'+i,assetKey:'test:'+(45000+i),assetNaam:'MSI '+(45000+i),typeId:'MSI',weg:'A15',richting:'RE',hm:45+i/1000,vc:'ZWN',code:'1003',avail:100,perf:100,melding:'Lamp defect',duurUren:3,levenscyclus_status:'OPEN_BEVESTIGD',laatste_gezien:bevestiging,bron_peildatum:bevestiging})),nietDoorgerekend:[],wegdelen:[],peildatum:Date.UTC(2026,0,1),stats:{periodeUren:24}};
   parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>{window.testLongTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())testLongTasks.push(e.duration);}).observe({type:'longtask'});});
  const idle=id=>page.waitForFunction(id=>document.getElementById(id+'Table').getAttribute('aria-busy')==='false'&&document.getElementById(id+'Count').textContent.includes('resultaten'),id);
  const start=Date.now();await page.locator('[data-group=assets]').click();await page.waitForFunction(()=>document.getElementById('assetCount').textContent.includes('50.000'));await idle('asset');
  assert.equal(await page.locator('#assetTable tbody tr').count(),60);assert.equal(await page.locator('#faultTable tbody tr').count(),0,'een verborgen storingslijst wordt niet opgebouwd');
  await page.locator('#assetOperationalStatus').selectOption('Niet operationeel door storing');await idle('asset');assert.match(await page.locator('#assetCount').innerText(),/4\.999 resultaten/);
  assert.equal(await dvm.evaluate(()=>HUB.assets()===ASSET_REGISTER_STATE.assets),true,'filters veranderen de adapterpopulatie niet');
  await page.locator('#assetOperationalStatus').selectOption('');await page.locator('#assetWind').check();await idle('asset');assert.match(await page.locator('#assetCount').innerText(),/1 resultaten/);
  await page.locator('#assetRia4').check();await idle('asset');assert.match(await page.locator('#assetCount').innerText(),/2 resultaten/);
  await page.locator('#assetWind').uncheck();await page.locator('#assetRia4').uncheck();await idle('asset');
  await page.locator('#secondaryNav [data-route=faults]').click();await idle('fault');assert.match(await page.locator('#faultCount').innerText(),/5\.000 resultaten/);assert.equal(await page.locator('#faultTable tbody tr').count(),60);
  await page.locator('#faultNext').click();await idle('fault');assert.match(await page.locator('#faultCount').innerText(),/pagina 2 /);
  await page.locator('#faultOperationalStatus').selectOption('Niet operationeel');await idle('fault');assert.match(await page.locator('#faultCount').innerText(),/1 resultaten/);
  assert.equal(await page.locator('#faultTable [data-asset]').getAttribute('data-asset'),'test:49999');
  await page.locator('#faultOperationalStatus').selectOption('');await idle('fault');
  await page.evaluate(()=>{const e=document.getElementById('faultSearch');for(const v of ['MSI','MSI 45000','MSI 49998']){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}});
  await page.waitForTimeout(200);await idle('fault');assert.equal(await page.locator('#faultTable [data-asset]').getAttribute('data-asset'),'test:49998');
  const timings=await page.evaluate(()=>testLongTasks);assert.ok(Math.max(0,...timings)<1000,'navigatie/filteren mag de browser niet langer dan één seconde blokkeren bij 4x vertraagde CPU');
  console.log('50.000 assets / 5.000 echte adaptermeldingen, 4x CPU, grootste browsertaak ms',Math.max(0,...timings),'testduur ms',Date.now()-start);
  // Memo gebruikt de hele selectie, ook wanneer uitsluitend de huidige pagina zichtbaar is.
  await page.locator('#faultSearch').fill('');await page.waitForTimeout(200);await idle('fault');await page.locator('#faultMemo').click();await page.locator('#faultMemoDialog').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.getElementById('faultMemoDialog').__memo.total),5000);await page.locator('#faultMemoClose').click();
  await dvm.evaluate(()=>{STATE.meldingen=[];STATE.nietDoorgerekend=[];parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);});
  await page.waitForFunction(()=>document.getElementById('faultCount').textContent.includes('0 resultaten'));await idle('fault');assert.equal(await page.locator('#faultTable tbody tr').count(),0);
  await page.locator('[data-group=assets]').click();await idle('asset');await page.locator('#assetOperationalStatus').selectOption('Niet operationeel door storing');await idle('asset');assert.match(await page.locator('#assetCount').innerText(),/0 resultaten/);
  await page.locator('#assetOperationalStatus').selectOption('');await idle('asset');
  // Wisselen tijdens zoeken breekt de oude weergave af en houdt de storingslijst verborgen.
  await page.locator('#assetSearch').fill('MSI');await page.locator('[data-group=overview]').click();await page.waitForTimeout(250);assert.equal(await page.locator('#faults').isHidden(),true);
  assert.deepEqual(errors,[]);console.log('Status/speciale filters, paginering, snelle zoekwisselingen, volledige memo en bronmutatie geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
