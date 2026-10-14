const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const site=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{try{const p=path.join(site,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await page.locator('[data-group=assets]').click();const frame=page.frames().find(f=>f.url().includes('/dvm.html'));await frame.waitForFunction(()=>window.HUB?.__bidashFaultsExtended);
  const result=await frame.evaluate(()=>{
   const now=new Date().toISOString(),old=new Date(Date.now()-72*36e5).toISOString();
   const rows=[1,2].map(n=>({entityid:'S'+n,asset:'MSI A4 RE 26.200 '+n,'ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'}));analyseerAssetRegister(rows,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   const fault=(lane,extra={})=>({event_id:'f'+lane,locatie:'A4 RE 26.200',MSI:String(lane),vc:'ZWN',assettype:'MSI',foutcode:'1003',melding:'Fatale fout bij MSI '+lane,van:old,eerste_gezien:old,laatste_gezien:now,bron_peildatum:now,hersteld_op:null,levenscyclus_status:'OPEN_BEVESTIGD',_liveOpen:true,...extra});
   const raw=[fault(1),fault(1,{event_id:'f1b',foutcode:'1001',melding:'Fout in lampcircuit bij MSI 1'}),fault(2,{levenscyclus_status:'ONBEKEND_DOOR_BRONGAT',_liveOpen:false}),{...fault(1),event_id:'sys',assettype:'SYSTEEM',MSI:'SYSTEEM',melding:'Hoofdvoeding uitgevallen',technische_categorie:'SYSTEEM'}];
   LIVE_STORINGSBRONNEN=[{key:'synthetic',naam:'synthetic',rijen:raw,peildatum:Date.now()}];LIVE_PEILDATUM=Date.now();STATE=doorrekenen(raw,{actueel:true,peildatum:LIVE_PEILDATUM});RULES.cfg.liveDekking={MSI:true};
   parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);
   return {msi:v68TypeStatus().MSI,rows:HUB.faults(),exported:totaalExportBundle()};
  });
  assert.equal(result.rows.length,4);assert.equal(result.msi.besch,null);assert.equal(result.exported.liveStoringen[0].rijen.filter(x=>x.hersteld_op).length,0);
  await page.locator('#secondaryNav [data-route=faults]').click();
  const idle=()=>page.waitForFunction(()=>document.getElementById('faultTable').getAttribute('aria-busy')==='false'&&document.getElementById('faultCount').textContent.includes('resultaten'));
  await idle();assert.match(await page.locator('#faultFilterSummary').innerText(),/4.*technische meldingen.*2 unieke assets/);
  assert.equal(await page.locator('#faultTable tbody tr').count(),4);assert.match(await page.locator('#faultTable thead').innerText(),/Laatste waarneming/i);
  await page.locator('#faultLifecycle').selectOption('ONBEKEND_DOOR_BRONGAT');await idle();assert.equal(await page.locator('#faultTable tbody tr').count(),1);
  await page.locator('#faultLifecycle').selectOption('');await page.locator('#faultType').selectOption('SYSTEEM');await idle();assert.equal(await page.locator('#faultTable tbody tr').count(),1);
  await page.locator('#faultType').selectOption('');await idle();await page.locator('#faultMemo').click();
  assert.equal(await page.locator('#faultMemoDialog').evaluate(d=>d.__memo.lifecycle.geraakteAssets),2);await page.locator('#faultMemoClose').click();
  await frame.evaluate(()=>{for(const m of STATE.meldingen)if(m.assetKey==='ID:S1')m.laatste_gezien=new Date(Date.now()-49*36e5).toISOString();parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);});
  await page.locator('#faultLifecycle').selectOption('OPEN_VEROUDERD');await idle();await page.waitForFunction(()=>document.querySelectorAll('#faultTable tbody tr').length===2);
  assert.match(await page.locator('#faultTable').innerText(),/Onbekend door brononzekerheid/);
  const policy=await frame.evaluate(()=>{
   renderOverzicht();const panel=document.getElementById('tab-overzicht'),input=panel.querySelector('input[onchange*=verouderingUren]');
   if(!input)throw Error('Bronbewaking ontbreekt');input.value='24';input.dispatchEvent(new Event('change',{bubbles:true}));
   return {hours:RULES.cfg.storingsBewaking.verouderingUren,html:panel.innerHTML,exportHours:totaalExportBundle().parameters?.cfg?.storingsBewaking?.verouderingUren};
  });
  assert.equal(policy.hours,24);assert.equal(policy.exportHours,24);assert.match(policy.html,/Storingsmeldingen en bronzekerheid/);
  assert.deepEqual(errors,[]);console.log('Levenscyclus UI geslaagd: meldingen versus assets, onzeker/stale, type SYSTEEM, tijdvelden, filters, memo en onbekende prestatie.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
