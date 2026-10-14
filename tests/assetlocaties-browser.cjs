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
   const rows=[{entityid:'R',asset:'MSI A15 RE 9.900','ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'},
    {entityid:'G',asset:'MSI A15G 10.100','ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'},
    {entityid:'D',asset:'DRIP A31 RE 2.000','ci-type':'OBJ Bijzondere borden-drips',regio:'ZWN',status:'Operationeel'}];
   analyseerAssetRegister(rows,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   DRIP_STATE=verwerkDrips(rows);dvmPasDripLocatiesToe();
   herstelNetwerkschakels({bestand:'synthetic',rijen:[
    {Code:'A1',Netwerkschakel:'Test A',Verkeerscentrale:'ZWN',Rijksweg:'A15','HMP van':0,'HMP tot':10},
    {Code:'N1',Netwerkschakel:'Test N',Verkeerscentrale:'ZWN',Rijksweg:'N31','HMP van':40,'HMP tot':50}]});
   LIVE_STORINGSBRONNEN=[{key:'test',naam:'synthetic-open',peildatum:Date.parse('2026-01-02'),rijen:[
    {locatie:'A15 G 10.100',vc:'ZWN',assetType:'MSI',foutcode:'1003',melding:'Lamp defect',start:'2026-01-01',duur_uur:1},
    {entityid:'D',locatie:'A31 RE 2.000',vc:'ZWN',assetType:'DRIP',foutcode:'DBD-DISPLAY',melding:'Contact met display verloren',start:'2026-01-01',duur_uur:1}]}];
   LIVE_PEILDATUM=LIVE_STORINGSBRONNEN[0].peildatum;
   await datasetNaMutatie('Testbronnen');
   HUB.open('regels');ASSET_CFG_UI.subtab='assets';ASSET_CFG_UI.query='';ASSET_CFG_UI.focusKey='ID:D';renderRegels();toonRuleSubtab('assets');
  });
  assert.equal(await page.evaluate(()=>STATE.meldingen.find(m=>m.typeId==='MSI').netwerkschakel),'A1');
  assert.equal(await page.evaluate(()=>ASSET_REGISTER_STATE.assets.find(a=>a.entityid==='G').zijdeBron),'G');
  const editor=page.locator('[data-asset-locatie]').filter({has:page.locator('[data-asset-locatie-field="weg"][value="A31"]')});
  await editor.locator('[data-asset-locatie-field="weg"]').fill('N31');
  await editor.locator('[data-asset-locatie-field="hm"]').fill('42,125');
  await editor.locator('[data-asset-locatie-field="richting"]').selectOption('LI');
  await editor.getByRole('button',{name:'Locatie opslaan en herberekenen',exact:true}).click();
  await page.waitForFunction(()=>ASSET_INDEX.byKey.get('ID:D').weg==='N31'&&STATE.meldingen.some(m=>m.netwerkschakel==='N1'));
  assert.equal(await page.evaluate(()=>DRIP_STATE.drips[0].weg),'N31');
  assert.equal(await page.evaluate(()=>STATE.meldingen.find(m=>m.typeId==='DRIP').hm),42.125);
  assert.equal(await page.evaluate(()=>STATE.wegdelen.find(w=>w.netwerkschakel==='N1').typeBron.DRIP.N),1);
  assert.equal(await page.evaluate(()=>ASSET_REGISTER_STATE.ruweRegisterRijen[2].asset),'DRIP A31 RE 2.000');
  assert.match(await page.locator('#assetConfigListHost').innerText(),/handmatige locatiecorrectie/);
  await page.evaluate(async()=>{const b=HUB.export({fullSources:true});window.testBackup=b;await HUB.import(b);});
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:D').weg),'N31');
  assert.equal(await page.evaluate(()=>testBackup.parameters.assetConfig.overrides['ID:D'].locatie.hm),42.125);
  await page.evaluate(()=>{HUB.open('regels');ASSET_CFG_UI.subtab='assets';ASSET_CFG_UI.focusKey='ID:D';renderRegels();toonRuleSubtab('assets');});
  const corrected=page.locator('[data-asset-locatie]').filter({has:page.locator('[data-asset-locatie-field="weg"][value="N31"]')});
  await corrected.locator('[data-asset-locatie-field="weg"]').fill('31');
  await corrected.getByRole('button',{name:'Locatie opslaan en herberekenen',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('assetCfgStatus').textContent.includes('Gebruik een weg'));
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:D').weg),'N31');
  await corrected.getByRole('button',{name:'Herstel alleen bronlocatie',exact:true}).click();
  await page.waitForFunction(()=>ASSET_INDEX.byKey.get('ID:D').weg==='A31');
  assert.equal(await page.evaluate(()=>STATE.meldingen.find(m=>m.typeId==='DRIP').weg),'A31');
  await page.evaluate(async()=>{
   const rows=[1,2,3].map(lane=>({entityid:'LANE'+lane,asset:`MSI A15-RE-12,345 ${lane}`,'ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'}));
   rows.push({entityid:'CAM-HYPHEN',asset:'Camera 08-A4-Li-7,49','ci-type':'VID Cameras',regio:'ZWN',status:'Operationeel'});
   analyseerAssetRegister(rows,'synthetic-hyphens');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   RULES.assetConfig.aliases.MSIA15RE12345='ID:LANE1';
   herstelNetwerkschakels({rijen:[{Code:'CAM-X',Netwerkschakel:'Test camera',Verkeerscentrale:'ZWN',Rijksweg:'A4','HMP van':7,'HMP tot':8},
    {Code:'MSI-X',Netwerkschakel:'Test MSI',Verkeerscentrale:'ZWN',Rijksweg:'A15','HMP van':12,'HMP tot':13}]});
   const faults=[1,2,3].map(lane=>({locatie:'A15-RE-12,345',vc:'ZWN',melding:`Fatale fout bij MSI ${lane}`,foutcode:'1003',van:'2026-01-01',tot:'2026-01-02'}));
   LIVE_STORINGSBRONNEN=[{key:'hyphens',naam:'synthetic',peildatum:Date.parse('2026-01-02'),rijen:[...faults,faults[1]]}];
   LIVE_PEILDATUM=LIVE_STORINGSBRONNEN[0].peildatum;await datasetNaMutatie('Koppelingen controleren');
  });
  const checked=await page.evaluate(()=>({faults:HUB.faults(),camera:ASSET_REGISTER_STATE.assets.find(a=>a.entityid==='CAM-HYPHEN')}));
  assert.equal(checked.faults.length,3);
  assert.deepEqual(checked.faults.map(m=>m.assetKey).sort(),['ID:LANE1','ID:LANE2','ID:LANE3']);
  assert.equal(checked.camera.hm,7.49);assert.equal(checked.camera.richting,'LI');assert.equal(checked.camera.netwerkschakel,'CAM-X');
  assert.deepEqual(errors,[]);
  console.log('Assetlocaties: individuele UI-correctie, zijbaan, areaal, DRIP, live doorrekening, export/herstel en terugzetten geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
