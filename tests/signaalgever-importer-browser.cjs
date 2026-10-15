const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),fixture=path.join(__dirname,'../.browser-test/sg-importer');fs.rmSync(fixture,{recursive:true,force:true});
 function file(rootDir,vc,date,hour,ids,text){const [y,m,d]=date.split('-'),dir=path.join(rootDir,'mtm',vc,'storinglijst',y,m,d);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,hour+'.txt'),text??`MTM storinglijst\n${d}-${m}-${y} ${hour}:30:00\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A4 R 26,200|${id===1?'01-01-2024':d+'-'+m+'-'+y} 00:00:00|`).join('\n'));}
 const input=path.join(fixture,'initial');file(input,'zwn','2025-01-01','00',[1,2]);file(input,'zwn','2025-01-01','01',[1]);file(input,'zwn','2025-01-01','02',[1]);file(input,'zwn','2026-10-14','00',[1,3,4]);file(input,'zwn','2026-10-14','01',[1,4]);file(input,'zwn','2026-10-14','02',[1,4]);file(input,'nwn','2026-10-14','00',[1]);
 const invalid=path.join(fixture,'invalid');file(invalid,'zwn','2026-10-15','00',[],'');
 const update=path.join(fixture,'update');for(const hour of ['00','01','02'])file(update,'zwn','2026-10-15',hour,[]);
 const server=require('node:http').createServer((req,res)=>{try{const p=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote']});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port;await page.goto(url+'/signaalgever-importer.html');
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));
  const initial=await page.evaluate(async()=>{const {write}=await import('/core/storage.js?v=20261015-1215');await write({schema:1,dvm:null,bi:null,planning:null,links:[],expertReviews:[],history:[],qualityAudit:null,qualityHistory:[],marker:'dashboard-must-remain'});return document.getElementById('runtime').contentWindow.eval('ASSET_REGISTER_STATE');});assert.equal(initial,null);
  await page.selectOption('#vc','zwn');await page.locator('#until').fill('2026-10-14');await page.locator('#folder').setInputFiles(input);
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('ZWN opgeslagen.'));
  const read=()=>page.evaluate(async()=>await(await import('/core/storage.js?v=20261015-1215')).createWorkspaceStorage('bidash-signaalgever-importer').read());
  let saved=await read();assert.deepEqual(Object.keys(saved.stands),['zwn']);assert.deepEqual(saved.stands.zwn.open.map(r=>r.event_id).sort(),['1','4']);assert.equal(saved.stands.zwn.open.find(r=>r.event_id==='1').van,await page.evaluate(()=>new (document.getElementById('runtime').contentWindow.Date)(2024,0,1).toISOString()));
  assert.ok(!saved.stands.zwn.historie.some(r=>r.event_id==='2'));assert.equal(saved.stands.zwn.historie.find(r=>r.event_id==='3').levenscyclus_status,'HERSTELD_AFGELEID');
  await page.selectOption('#vc','nwn');await page.locator('#folder').setInputFiles(path.join(input,'mtm','nwn'));await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('NWN opgeslagen.'));
  saved=await read();assert.deepEqual(Object.keys(saved.stands).sort(),['nwn','zwn']);assert.equal(saved.stands.zwn.open.length,2);assert.equal(saved.stands.nwn.open.length,1);
  await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));assert.equal(await page.locator('#results tr').count(),2);
  const dl=page.waitForEvent('download');await page.locator('#download').click();const download=await dl,bundle=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.deepEqual(bundle.signaalgeverImport.vcs.sort(),['nwn','zwn']);
  await page.selectOption('#vc','zwn');await page.locator('#until').fill('2026-10-15');const before=JSON.stringify(await read());
  await page.locator('#folder').setInputFiles(invalid);await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert.match(await page.locator('#status').textContent(),/momentopname/);assert.equal(JSON.stringify(await read()),before);
  // Stoppen halverwege een bronlezing laat de vorige VC-stand staan.
  await page.evaluate(()=>{const h=document.getElementById('runtime').contentWindow.__BIDASH_STORINGSBUNDELAAR__,read=h.sbLeesTekst;h.sbLeesTekst=async f=>{await new Promise(r=>setTimeout(r,300));return read(f);};});
  await page.locator('#folder').setInputFiles(update);await page.locator('#cancel').click();await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert.equal(JSON.stringify(await read()),before);
  await page.locator('#folder').setInputFiles(update);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('ZWN opgeslagen.'));
  saved=await read();assert.equal(saved.stands.zwn.open.length,0);assert.equal(saved.stands.nwn.open.length,1);assert.equal(saved.stands.zwn.historie.find(r=>r.event_id==='1').levenscyclus_status,'HERSTELD_AFGELEID');
  assert.equal(await page.evaluate(async()=>(await(await import('/core/storage.js?v=20261015-1215')).read()).marker),'dashboard-must-remain');
  // Het echte bronbeheer herkent de VC-overdracht en behoudt onafhankelijke bronnen.
  const dvm=await context.newPage();dvm.on('pageerror',e=>errors.push(e.message));await dvm.goto(url+'/engines/dvm.html');await dvm.waitForFunction(()=>window.__BIDASH_DVM_SOURCE_EXPORT_COMPLETE__&&window.BIDASH_SIGNAALGEVER_IMPORT);
  const result=await dvm.evaluate(async bundle=>{
    const rows=['ZWN','NWN','MN'].map((vc,i)=>({entityid:vc,'ci-type':'VKS signaalgevers',asset:'MSI A4 R 26,200 1',wegnummer:'4','hm-bord':'26,2',baanpositie:'R',regio:vc,status:'Operationeel'}));analyseerAssetRegister(rows,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
    const H=__BIDASH_STORINGSBUNDELAAR__,text='MTM storinglijst\n14-10-2026 00:30:00\n|9|1003|1003 Fatale fout bij MSI 1|A4 R 26,200|14-10-2026 00:00:00|';const f={name:'0.txt',webkitRelativePath:'mtm/mn/storinglijst/2026/10/14/0.txt'};
    const snap=H.sbSignaalgeverSnapshot(text,f,{vc:'mn',datum:new Date(2026,9,14)});const mn=H.sbSignaalgeverSynchroniseer({open:[],historie:[],laatstePerVc:{},snapshotDekking:{}},[snap]);
    await pasSignaalgeverBundelToe('synthetic',mn.open,mn.historie,'test',{bijwerken:true,laatstePerVc:mn.laatstePerVc,snapshotDekking:mn.snapshotDekking,liveRest:[{key:'camera',rijen:[{vc:'zwn',assetTypeHint:'CAM',melding:'Camera defect'}]},{key:'drip',virtueel:true,afgeleidVan:'dripHistorie',rijen:[{vc:'zwn',assetTypeHint:'DRIP',melding:'DRIP defect'}]}]});
    await leesSignaalgeverTotaalBestand(new File([JSON.stringify(bundle)],'importer.json'));
    const one=gecombineerdeLiveStoringsRijen().map(r=>r.vc+'|'+(r.event_id||r.assetTypeHint)).sort();
    await leesSignaalgeverTotaalBestand(new File([JSON.stringify(bundle)],'importer.json'));
    const two=gecombineerdeLiveStoringsRijen().map(r=>r.vc+'|'+(r.event_id||r.assetTypeHint)).sort();
    const backup=totaalExportBundle(undefined,{autosaveLean:false}),local=totaalExportBundle(undefined,{autosaveLean:true});await totaalImportJson(new File([JSON.stringify(local)],'local.json'));return {one,two,watermarks:backup.bronbeheer.signaalgeverTotaal.laatstePerVc,localRows:local.liveStoringen.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).length,restored:gecombineerdeLiveStoringsRijen().length,backup};
  },bundle);
  assert.deepEqual(result.one,['mn|9','nwn|1','zwn|1','zwn|4','zwn|CAM','zwn|DRIP']);assert.deepEqual(result.two,result.one);assert.ok(result.watermarks.mn);assert.ok(result.watermarks.zwn);assert.ok(result.watermarks.nwn);assert.equal(result.localRows,4);assert.equal(result.restored,6);
  // Ook de echte Data & export-route bewaart de geïmporteerde VC-stand bij herladen.
  const app=await context.newPage();app.on('pageerror',e=>errors.push(e.message));await app.goto(url+'/index.html#data');await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await app.locator('#files').setInputFiles({name:'base.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(result.backup))});await app.locator('#applyImport').click();await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Import voltooid'));
  await app.locator('#files').setInputFiles({name:'vc.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await app.locator('#applyImport').click();await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Import voltooid'));
  const check=()=>app.evaluate(async()=>{const s=await(await import('/core/storage.js?v=20261015-1215')).read();return s.dvm.liveStoringen.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).length;});assert.equal(await check(),4);await app.reload();await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));assert.equal(await check(),4);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.IMPORTER_QA_SHOT)await page.screenshot({path:process.env.IMPORTER_QA_SHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('Losse MTM-importer: geen All Assets nodig, VC-selectie, retentie, oude open storing, herstelvenster, lokale hervatting, download, bronfout, stoppen, opslagisolatie en echte DVM-overdracht geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
