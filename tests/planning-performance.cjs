const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const server=require('http').createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),file=path.join(process.cwd(),'site',u.pathname==='/'?'index.html':u.pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:path.resolve(process.env.CHROMIUM_PATH)}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));
  // Grote synthetische planning met echte fasematching en positieve VWM-vraag.
  const acts=Array.from({length:2000},(_,i)=>`<Activity><ObjectId>${100+i}</ObjectId><Name>Taak ${i}</Name><WBSObjectId>20</WBSObjectId><StartDate>${2030+Math.floor(i/500)}-${String(i%12+1).padStart(2,'0')}-01T08:00:00</StartDate><FinishDate>${2030+Math.floor(i/500)}-${String(i%12+1).padStart(2,'0')}-20T17:00:00</FinishDate><Type>Task Dependent</Type></Activity>`).join('');
  const xml='<APIBusinessObjects><Project><WBS><ObjectId>10</ObjectId><Name>VWM</Name><ParentObjectId/></WBS><WBS><ObjectId>20</ObjectId><Name>Contractvoorbereiding</Name><ParentObjectId>10</ParentObjectId></WBS>'+acts+'</Project></APIBusinessObjects>';
  await page.locator('#primaryNav [data-route=data]').click();await page.locator('#files').setInputFiles({name:'snelheid-test.xml',mimeType:'text/xml',buffer:Buffer.from(xml)});await page.locator('#applyImport').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Import voltooid'),{},{timeout:60000});
  await page.locator('#primaryNav [data-route=planning]').click();const frame=page.frames().find(f=>f.url().includes('/planning.html'));
  await frame.waitForFunction(()=>IPL_LAYOUT?.layout.length>0&&document.getElementById('ipl-fmt-VWM').width>100);
  const result=await frame.evaluate(()=>{
   ipl_applyVwm({'Contractvoorbereiding':{IBP:0.5,AM:0.25}},HCAP,RCAP);
   const first=IPL_MODEL.regels[0];IPL_CONFIG.fte[first.id]=[{dienst:'CIV',rol:'CIV-test',fte:0.5}];
   const series=ipl_computeDienstFteReeks();
   for(const i of [1,3,30,90,150]){if(!series.buckets[i])continue;const b=series.buckets[i];if(b.VWM!==totalAt(b.t))throw Error('Weekwaarde wijkt af van de oorspronkelijke VWM-regel');}
   if(!series.buckets.some(b=>b.VWM>0))throw Error('Geen positieve VWM-vraag in de test');
   const original=ipl_computeDienstFteReeks;let calls=0;window.ipl_computeDienstFteReeks=function(){calls++;return original();};
   ipl_renderFteNow();const batchCalls=calls;calls=0;renderIPL(true);const scrollCalls=calls;window.ipl_computeDienstFteReeks=original;
   const rows=ipl_buildOrdered(),same=rows===ipl_buildOrdered();IPL_COLLAPSED['20']=true;const collapsed=ipl_buildOrdered();delete IPL_COLLAPSED['20'];
   const old=ipl_regelById(first.id);IPL_MODEL=structuredClone(IPL_MODEL);IPL_MODEL.regels[0].naam='Nieuwe testtaak';const fresh=ipl_regelById(first.id);
   return {batchCalls,scrollCalls,same,collapsedRows:collapsed.length,rows:rows.length,newIndex:fresh!==old&&fresh.naam==='Nieuwe testtaak'};
  });
  assert.equal(result.batchCalls,1);assert.equal(result.scrollCalls,0);assert(result.same);assert(result.collapsedRows<result.rows);assert(result.newIndex);
  await frame.evaluate(()=>{renderIPL();toggleRoles();});await frame.waitForFunction(()=>document.getElementById('rc0')?.width>100);
  assert(await frame.locator('#vdetails').isVisible());
  await frame.evaluate(()=>{IPL_MSHIFT['100']=1;ipl_computeCascade();ipl_renderFteNow();});
  assert(await frame.evaluate(()=>{const s=ipl_computeDienstFteReeks();return s.buckets.slice(0,8).every(b=>b.VWM===totalAt(b.t));}));
  // Laat de bestaande opslagqueue afronden en observeer echte intervalticks.
  await page.waitForTimeout(5000);const bi=page.frames().find(f=>f.url().includes('/bi.html'));
  await bi.evaluate(()=>{ipl_bridgeInvoerGewijzigd();window.PERF_BRIDGE=0;window.PERF_CAP=0;const m=bridgeModel,c=bridgeCapaciteit;window.bridgeModel=function(){PERF_BRIDGE++;return m();};window.bridgeCapaciteit=function(){PERF_CAP++;return c();};});
  await page.waitForTimeout(2400);const idle=await bi.evaluate(()=>({model:PERF_BRIDGE,cap:PERF_CAP}));assert.deepEqual(idle,{model:0,cap:0});
  // Bij verbergen wordt geen FTE-berekening uitgevoerd; openen tekent weer.
  await page.locator('#primaryNav [data-route=overview]').click();
  assert.equal(await frame.evaluate(()=>{const original=ipl_computeDienstFteReeks;let calls=0;window.ipl_computeDienstFteReeks=function(){calls++;return original();};ipl_renderFteNow();window.ipl_computeDienstFteReeks=original;return calls;}),0);
  await page.locator('#primaryNav [data-route=planning]').click();await frame.waitForFunction(()=>document.getElementById('ipl-fmt-VWM').width>100);
  assert.deepEqual(errors,[]);console.log('Gedeelde FTE-berekening, gelijke uitkomsten, scrollcache, rollen, wijzigingen en rustige achtergrond geslaagd.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
