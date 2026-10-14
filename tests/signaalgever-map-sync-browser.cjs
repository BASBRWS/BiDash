const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const site=path.join(__dirname,'../site');
 const server=require('node:http').createServer((req,res)=>{
  const p=path.join(site,new URL(req.url,'http://localhost').pathname);
  try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+'/engines/dvm.html');
  await page.waitForFunction(()=>window.__BIDASH_STORINGSBUNDELAAR__&&window.__BIDASH_DVM_SOURCE_EXPORT_COMPLETE__&&window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(()=>{
   const rows=['ZWN','NWN'].flatMap((vc,i)=>[1,2].map(lane=>({entityid:vc+lane,'ci-type':'VKS signaalgevers',asset:`MSI A${i?9:4} R 26,200 ${lane}`,wegnummer:i?'9':'4','hm-bord':'26,2',baanpositie:'R',regio:vc,status:'Operationeel'})));
   analyseerAssetRegister(rows,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
  });
  const run=async(vc,hour,ids)=>page.evaluate(async({vc,hour,ids})=>{
   const header=`MTM storinglijst\n16-08-2026 ${String(hour).padStart(2,'0')}:30:00`;
   const text=header+'\n'+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A${vc==='nwn'?9:4} R 26,200|16-08-2026 00:00:00|`).join('\n');
   const file=new File([text],hour+'.txt');Object.defineProperty(file,'webkitRelativePath',{value:`mtm/${vc}/storinglijst/2026/08/16/${hour}.txt`});
   return leesSignaalgeverMap([file],{vcs:new Set([vc])});
  },{vc,hour,ids});
  await run('nwn',4,[1]);await run('zwn',4,[1,2]);
  let r=await run('zwn',5,[2]);assert.equal(r.open,3);assert.equal(r.historie,3);
  const snapshot=await page.evaluate(()=>({rows:gecombineerdeLiveStoringsRijen(),history:gecombineerdeStoringsRijen(),status:__BIDASH_SIGNAALGEVER_TOTAAL__,faults:HUB.faults()}));
  assert.equal(snapshot.rows.length,3);assert.equal(snapshot.faults.length,3);
  assert.equal(snapshot.history.filter(x=>x.vc==='zwn'&&x.MSI==='MSI 1').length,1);
  assert.equal(snapshot.history.find(x=>x.vc==='zwn'&&x.MSI==='MSI 1')._mtmKwaliteit,'verdwenen_uit_snapshot');
  assert.equal(snapshot.status.laatstePerVc.nwn,await page.evaluate(()=>new Date(2026,7,16,4,30).getTime()));
  assert.equal(snapshot.status.laatstePerVc.zwn,await page.evaluate(()=>new Date(2026,7,16,5,30).getTime()));
  r=await run('zwn',5,[2]);assert.equal(r.open,3);assert.equal(r.historie,3);
  const dlPromise=page.waitForEvent('download');await page.locator('#sgPDownload').click();
  const dl=await dlPromise,backup=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  assert.equal(backup.formaat,'DVM-dienstimpact-totaal');assert.equal(backup.liveStoringen[0].rijen.length,3);
  assert.equal(backup.bronbeheer.signaalgeverTotaal.laatstePerVc.zwn,snapshot.status.laatstePerVc.zwn);
  await page.evaluate(async b=>{await totaalImportJson(new File([JSON.stringify(b)],'backup.json'));},backup);
  r=await run('zwn',6,[]);assert.equal(r.open,2);assert.equal(r.historie,3);
  r=await run('zwn',7,[]);assert.equal(r.open,1);assert.equal(r.historie,3);
  const before=await page.evaluate(()=>JSON.stringify({l:LIVE_STORINGSBRONNEN,h:STORINGSBRONNEN,s:__BIDASH_SIGNAALGEVER_TOTAAL__}));
  assert.match(await page.evaluate(async()=>{
   const file=new File(['MTM storinglijst\n16-08-2026 07:30:00\n|1|broken'],'bad.txt');Object.defineProperty(file,'webkitRelativePath',{value:'mtm/zwn/storinglijst/2026/08/16/bad.txt'});
   try{await leesSignaalgeverMap([file],{vcs:new Set(['zwn'])});return 'succeeded';}catch(e){return e.message;}
  }),/alarmregel/);
  assert.equal(await page.evaluate(()=>JSON.stringify({l:LIVE_STORINGSBRONNEN,h:STORINGSBRONNEN,s:__BIDASH_SIGNAALGEVER_TOTAAL__})),before);
  assert.deepEqual(errors,[]);
  console.log('MTM map sync: VC preservation, live adapter, history closure, repeat import, download/restore, empty snapshot and failed-file preservation passed.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
