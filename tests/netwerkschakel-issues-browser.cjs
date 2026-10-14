const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const site=path.join(__dirname,'../site');
(async()=>{
 const server=require('node:http').createServer((req,res)=>{
  const p=path.join(site,new URL(req.url,'http://localhost').pathname);
  try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/engines/dvm.html');
  await page.waitForFunction(()=>window.__BIDASH_NETWERKSCHAKELS_ACTIVE__&&window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(async()=>{
   const rows=Array.from({length:24},(_,i)=>({entityid:'U'+i,asset:'Synthetisch onbekend '+i,'ci-type':'VKS signaalgevers',wegnummer:'000',hm:0,regio:'ZWN',status:'Operationeel'}));
   rows.push({entityid:'D',asset:'DRIP A31 RE 2.000','ci-type':'OBJ Bijzondere borden-drips',regio:'ZWN',status:'Operationeel'});
   rows.push({entityid:'OUT',asset:'MSI A15 RE 25.000','ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'});
   analyseerAssetRegister(rows,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   DRIP_STATE=verwerkDrips(rows);dvmPasDripLocatiesToe();
   herstelNetwerkschakels({bestand:'synthetic',rijen:[
    {Code:'A1',Netwerkschakel:'Test A',Verkeerscentrale:'ZWN',Rijksweg:'A15','HMP van':0,'HMP tot':10},
    {Code:'N1',Netwerkschakel:'Test N',Verkeerscentrale:'ZWN',Rijksweg:'N31','HMP van':40,'HMP tot':50}]});
   LIVE_STORINGSBRONNEN=[{key:'test',naam:'synthetic-open',peildatum:Date.parse('2026-01-02'),rijen:[
    {entityid:'D',locatie:'A31 RE 2.000',vc:'ZWN',assetType:'DRIP',foutcode:'DBD-DISPLAY',melding:'Contact met display verloren',start:'2026-01-01',duur_uur:1}]}];
   LIVE_PEILDATUM=LIVE_STORINGSBRONNEN[0].peildatum;await datasetNaMutatie('Testbronnen');HUB.open('datasets');
  });
  await page.locator('#tab-datasets button').filter({hasText:'Koppelingen en grenzen controleren'}).click();
  const dialog=page.locator('#netwerkBeheerDialog');
  const issue=way=>page.locator('#netwerkKoppelControle tbody tr').filter({has:page.locator('td').filter({hasText:new RegExp('^'+way+'(?: RE)?$')})});
  const matrixEnd=page.locator('#netwerkGrenzenBody tr').first().locator('[data-netwerk-field="HMP tot"]');
  await matrixEnd.fill('11');
  await page.locator('#netwerkGrenzenClose').click();
  await page.locator('#tab-datasets button').filter({hasText:'Koppelingen en grenzen controleren'}).click();
  assert.equal(await matrixEnd.inputValue(),'11');
  await issue('A31').getByRole('button',{name:'Oplossen',exact:true}).click();
  const asset=page.locator('[data-netwerk-asset="ID:D"]');await asset.locator('summary').click();
  await asset.locator('[data-asset-locatie-field="weg"]').fill('N0');
  await asset.getByRole('button',{name:'Locatie opslaan en herberekenen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('netwerkBeheerStatus').textContent.includes('Gebruik een weg'));
  assert.equal(await asset.locator('[data-asset-locatie-field="weg"]').inputValue(),'N0');
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:D').weg),'A31');
  await asset.locator('[data-asset-locatie-field="weg"]').fill('N31');
  await asset.locator('[data-asset-locatie-field="hm"]').fill('42,125');
  await asset.locator('[data-asset-locatie-field="richting"]').selectOption('LI');
  await asset.getByRole('button',{name:'Locatie opslaan en herberekenen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('netwerkBeheerStatus').textContent.startsWith('Assetlocatie opgeslagen'));
  assert.equal(await dialog.evaluate(el=>el.open),true);
  assert.equal(await matrixEnd.inputValue(),'11');
  assert.equal(await page.evaluate(()=>DVM_NETWERKSCHAKELS_STATE.schakels[0].tot),10);
  assert.equal(await issue('A31').count(),0);
  assert.equal(await page.evaluate(()=>STATE.meldingen[0].netwerkschakel),'N1');
  assert.equal(await page.evaluate(()=>STATE.wegdelen.find(w=>w.netwerkschakel==='N1').typeBron.DRIP.N),1);
  assert.equal(await page.evaluate(()=>DRIP_STATE.drips[0].weg),'N31');
  assert.equal(await page.getByRole('button',{name:'Vorige assets',exact:true}).isDisabled(),true);
  await issue('ONBEKEND').getByRole('button',{name:'Oplossen',exact:true}).click();
  assert.equal(await page.locator('[data-netwerk-asset]').count(),20);
  await page.getByRole('button',{name:'Volgende assets',exact:true}).click();
  assert.equal(await page.locator('[data-netwerk-asset]').count(),4);
  await page.getByRole('button',{name:'Vorige assets',exact:true}).click();
  await page.locator('#netwerkIssueFilter').fill('onbekend 0');
  const unknown=page.locator('[data-netwerk-asset="ID:U0"]');await unknown.locator('summary').click();
  await unknown.locator('[data-asset-locatie-field="weg"]').fill('A15');
  await unknown.locator('[data-asset-locatie-field="richting"]').selectOption('RE');
  await unknown.getByRole('button',{name:'Locatie opslaan en herberekenen',exact:true}).click();
  await page.waitForFunction(()=>ASSET_INDEX.byKey.get('ID:U0').weg==='A15'&&document.getElementById('netwerkBeheerStatus').textContent.startsWith('Assetlocatie opgeslagen'));
  assert.match(await page.locator('#netwerkIssueAssets').innerText(),/Gekoppeld aan A1/);
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:U0').hm),0);
  assert.equal(await page.evaluate(()=>ASSET_REGISTER_STATE.ruweRegisterRijen[0].wegnummer),'000');
  await issue('A15').getByRole('button',{name:'Oplossen',exact:true}).click();
  await page.locator('#netwerkIssueMatrix').click();
  assert.equal(await page.locator('#netwerkGrenzenBody tr:visible').count(),1);
  await matrixEnd.fill('30');
  await page.locator('#netwerkGrenzenSave').click();
  await page.waitForFunction(()=>document.getElementById('netwerkBeheerStatus').textContent.startsWith('Grenzen opgeslagen'));
  assert.equal(await issue('A15').count(),0);
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:OUT').netwerkschakel),'A1');
  await page.locator('#netwerkIssueAdd').click();
  const added=page.locator('#netwerkGrenzenBody tr').last();
  assert.equal(await added.locator('[data-netwerk-field="Rijksweg"]').inputValue(),'A15');
  assert.equal(await added.locator('[data-netwerk-field="HMP van"]').inputValue(),'');
  await added.getByRole('button',{name:'Verwijderen',exact:true}).click();
  await page.locator('#netwerkGrenzenClose').click();
  await page.evaluate(async()=>{const b=HUB.export({fullSources:true});await HUB.import(b);});
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:D').weg),'N31');
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:U0').weg),'A15');
  assert.equal(await page.evaluate(()=>DVM_NETWERKSCHAKELS_STATE.schakels[0].tot),30);
  assert.equal(await page.evaluate(()=>DVM_NETWERKSCHAKELS_STATE.oorspronkelijkeRijen[0]['HMP tot']),10);
  assert.deepEqual(errors,[]);
  console.log('Netwerkschakelproblemen: assetlocatie in dialoog, onbekende weg, paginering, matrixinvoer behouden, grenscorrectie en export/herstel geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
