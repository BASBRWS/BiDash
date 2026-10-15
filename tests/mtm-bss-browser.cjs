const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),dir=path.join(__dirname,'../.browser-test/bss-map'),date='14-10-2026',folder=path.join(dir,'mtm/mn/storinglijst/2026/10/14');fs.mkdirSync(folder,{recursive:true});
 const line=(action,id,time,unit)=>`${action} BSS : BSS_ID= ${id}, 1003 Fatale fout bij MSI ${unit}\tA77 R 11,250\t${date} ${time}`;
 const files=[{name:'141026_1_openstaandestoringen.txt',text:`MTM storinglijst\n${date} 00:30:00\n|101|1003|1003 Fatale fout bij MSI 1|A77 R 11,250|${date} 00:00:00|\n|102|1003|1003 Fatale fout bij MSI 2|A77 R 11,250|${date} 00:00:00|`},{name:'141026storinglijst.txt',text:[line('Registreer','101','00:00',1),line('Registreer','102','00:00',2),line('Hef op','101','01:00',1),line('Registreer','103','01:01',3)].join('\n')}];
 for(const f of files)fs.writeFileSync(path.join(folder,f.name),f.text);
 const server=require('node:http').createServer((req,res)=>{try{const p=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote']});
  const context=await browser.newContext();await context.addInitScript(()=>{Date.now=()=>new Date('2026-10-15T10:00:00Z').getTime();});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url+'/signaalgever-importer.html');await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));await page.selectOption('#vc','mn');await page.locator('#until').fill('2026-10-14');await page.locator('#folder').setInputFiles(dir);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('MN opgeslagen.'));
  const download=page.waitForEvent('download');await page.locator('#download').click();const dl=await download,bundle=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  const summary=s=>({open:s.liveStoringen.flatMap(b=>b.rijen).map(r=>r.event_id).sort(),history:s.storingshistorie.flatMap(b=>b.rijen).map(r=>({id:r.event_id,state:r.levenscyclus_status,repair:r.hersteld_op})).sort((a,b)=>a.id.localeCompare(b.id))});
  const expected=summary(bundle);assert.deepEqual(expected.open,['102','103']);assert.equal(expected.history.length,3);assert.equal(expected.history.find(r=>r.id==='101').state,'HERSTELD_BEVESTIGD');assert.equal(bundle.bronbeheer.signaalgeverTotaal.bssBronnen.mn.bronBalans,true);
  const engine=await context.newPage();engine.on('pageerror',e=>errors.push(e.message));await engine.goto(url+'/engines/dvm.html');await engine.waitForFunction(()=>window.DVM_MTM_BSS&&window.BIDASH_SIGNAALGEVER_IMPORT&&window.__BIDASH_DVM_SOURCE_EXPORT_COMPLETE__);
  const result=await engine.evaluate(async({files,bundle})=>{
   const rows=[1,2,3].map(n=>({entityid:'synthetic-'+n,'ci-type':'VKS signaalgevers',asset:'MSI A77 R 11,250 '+n,wegnummer:'77','hm-bord':'11,25',baanpositie:'R',regio:'MN',status:'Operationeel'}));analyseerAssetRegister(rows,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   const actual=files.map(f=>{const file=new File([f.text],f.name);Object.defineProperty(file,'webkitRelativePath',{value:'mtm/mn/storinglijst/2026/10/14/'+f.name});return file;});
   await leesSignaalgeverMap(actual,{vcs:new Set(['mn'])});const mapped=totaalExportBundle(undefined,{autosaveLean:false});
   await leesSignaalgeverTotaalBestand(new File([JSON.stringify(bundle)],'standalone.json'));const imported=totaalExportBundle(undefined,{autosaveLean:false});
   await totaalImportJson(new File([JSON.stringify(imported)],'roundtrip.json'));const restored=totaalExportBundle(undefined,{autosaveLean:false});
   const before=JSON.stringify([STORINGSBRONNEN,LIVE_STORINGSBRONNEN]);const bad=new File(['Registreer BSS : BSS_ID= broken'],'bad.txt');Object.defineProperty(bad,'webkitRelativePath',{value:'mtm/mn/storinglijst/2026/10/14/bad.txt'});let error='';try{await leesSignaalgeverMap([bad],{vcs:new Set(['mn'])});}catch(e){error=e.message;}
   return {mapped,imported,restored,unchanged:before===JSON.stringify([STORINGSBRONNEN,LIVE_STORINGSBRONNEN]),error};
  },{files,bundle});
  assert.deepEqual(summary(result.mapped),expected);assert.deepEqual(summary(result.imported),expected);assert.deepEqual(summary(result.restored),expected);assert.ok(result.restored.bronbeheer.signaalgeverTotaal.bssBronnen.mn);assert.equal(result.unchanged,true);assert.match(result.error,/BSS-gebeurtenis/);assert.deepEqual(errors,[]);
  console.log('BSS-browser: dezelfde bestanden via standalone en Signaalgevers uit map geven dezelfde incidenten; expliciet herstel, JSON voor Signaalgevers totaal, herimport en behoud na bronfout geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
