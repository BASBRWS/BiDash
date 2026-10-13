/* Synthetische browserketen voor de echte upload, rapportage en totaalexport. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const site=path.join(__dirname,'../site');
const x={};vm.createContext(x);vm.runInContext(fs.readFileSync(path.join(site,'vendor/xlsx.full.min.js'),'utf8'),x);
const matrix=[{Code:'TEST1',Verkeerscentrale:'VC Zuidwest-Nederland (Rhoon)',Rijksweg:'A15',Netwerkschakel:'Testvak 1','HMP van':0,'HMP tot':10,Status:'Voorlopig'},
 {Code:'TEST2',Verkeerscentrale:'VC Zuidwest-Nederland (Rhoon)',Rijksweg:'A15',Netwerkschakel:'Testvak 2','HMP van':10,'HMP tot':20,Status:'Voorlopig'}];
const wb=x.XLSX.utils.book_new();x.XLSX.utils.book_append_sheet(wb,x.XLSX.utils.json_to_sheet(matrix),'Matrix');
x.XLSX.utils.book_append_sheet(wb,x.XLSX.utils.json_to_sheet([{Toelichting:'Dit is geen schakel'}]),'Toelichting');
const buffer=Buffer.from(x.XLSX.write(wb,{type:'base64',bookType:'xlsx'}),'base64');
(async()=>{
 const server=require('node:http').createServer((req,res)=>{
  const filename=path.join(site,new URL(req.url,'http://localhost').pathname);
  try{res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(filename));}catch{res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/engines/dvm.html');
  await page.waitForFunction(()=>window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__&&window.__BIDASH_NETWERKSCHAKELS_ACTIVE__);
  await page.evaluate(()=>HUB.open('datasets'));
  assert.match(await page.locator('#tab-datasets').innerText(),/Netwerkschakelmatrix/);
  await page.locator('#netwerkschakelInput').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
  await page.waitForFunction(()=>window.DVM_NETWERKSCHAKELS_STATE?.schakels.length===2&&!document.getElementById('netwerkschakelInput').disabled);
  await page.evaluate(()=>HUB.open('wegdelen'));
  assert.match(await page.locator('#tab-wegdelen').innerText(),/TEST1/);
  assert.match(await page.locator('#tab-wegdelen').innerText(),/Onbekend/);
  await page.evaluate(async()=>{
   const rows=[2,12,25].map(hm=>({'ci-type':'VKS signaalgevers',asset:'MSI A15 RE '+hm.toFixed(3)+' 1',wegnummer:'15',baanpositie:'R','hm-bord':hm,regio:hm===25?'MN':'ZWN',status:'Operationeel'}));
   analyseerAssetRegister(rows,'synthetic-assets');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   LIVE_STORINGSBRONNEN=[{key:'test',naam:'synthetic-open',peildatum:Date.parse('2026-01-02T06:00:00Z'),rijen:[{assetType:'MSI',locatie:'A15 RE 2.000',foutcode:'1003',melding:'Lamp(en) defect',start:'2026-01-01T06:00:00Z'}]}];
   LIVE_PEILDATUM=LIVE_STORINGSBRONNEN[0].peildatum;
   await datasetNaMutatie('Synthetische testbronnen geladen.');
  });
  assert.equal(await page.evaluate(()=>STATE.wegdelen.find(w=>w.netwerkschakel==='TEST1').N),1);
  await page.evaluate(()=>HUB.open('wegdelen'));
  await page.locator('#tab-wegdelen button').filter({hasText:/^RE$/}).first().click();
  assert.match(await page.locator('#tab-wegdeelverslag').innerText(),/Netwerkschakel TEST1/);
  await page.evaluate(async()=>{const b=HUB.export({fullSources:true});await HUB.import(b);});
  assert.equal(await page.evaluate(()=>HUB.export({fullSources:true}).netwerkschakels.rijen.length),2);
  await page.evaluate(()=>HUB.open('datasets'));
  assert.match(await page.locator('#tab-datasets').innerText(),/synthetic.xlsx/);
  await page.locator('#tab-datasets button').filter({hasText:'Koppelingen en grenzen controleren'}).click();
  await page.waitForSelector('#netwerkBeheerDialog[open]');
  assert.match(await page.locator('#netwerkKoppelControle').innerText(),/Hectometer valt buiten matrixgrenzen/);
  await page.locator('#netwerkGrenzenFilter').fill('TEST2');
  assert.equal(await page.locator('#netwerkGrenzenBody tr:visible').count(),1);
  const end=page.locator('#netwerkGrenzenBody tr').nth(1).locator('[data-netwerk-field="HMP tot"]');
  await end.fill('');await page.locator('#netwerkGrenzenSave').click();
  await page.waitForFunction(()=>document.getElementById('netwerkBeheerStatus').textContent.includes('Ongeldige'));
  assert.equal(await page.evaluate(()=>DVM_NETWERKSCHAKELS_STATE.schakels[1].tot),20);
  await end.fill('30');await page.locator('#netwerkGrenzenSave').click();
  await page.waitForFunction(()=>document.getElementById('netwerkBeheerStatus').textContent.startsWith('Grenzen opgeslagen'));
  assert.equal(await page.evaluate(()=>STATE.wegdelen.find(w=>w.netwerkschakel==='TEST2').N),2);
  assert.match(await page.locator('#netwerkKoppelControle').innerText(),/Bron-VC MN, matrix-VC ZWN/);
  assert.equal(await page.evaluate(()=>HUB.export({fullSources:true}).netwerkschakels.oorspronkelijkeRijen[1]['HMP tot']),20);
  await page.locator('#netwerkGrenzenClose').click();
  await page.evaluate(async()=>{const b=HUB.export({fullSources:true});await HUB.import(b);});
  assert.equal(await page.evaluate(()=>DVM_NETWERKSCHAKELS_STATE.schakels[1].tot),30);
  await page.evaluate(()=>HUB.open('datasets'));
  await page.locator('#tab-datasets button').filter({hasText:'Koppelingen en grenzen controleren'}).click();
  await page.locator('#netwerkGrenzenReset').click();
  await page.waitForFunction(()=>document.getElementById('netwerkBeheerStatus').textContent.startsWith('Oorspronkelijke'));
  assert.equal(await page.evaluate(()=>DVM_NETWERKSCHAKELS_STATE.schakels[1].tot),20);
  assert.equal(await page.evaluate(()=>HUB.export({fullSources:true}).netwerkschakels.oorspronkelijkeRijen),undefined);
  await page.locator('#netwerkGrenzenAdd').click();
  assert.equal(await page.locator('#netwerkGrenzenBody tr').count(),3);
  await page.locator('[data-netwerk-remove="2"]').click();
  assert.equal(await page.locator('#netwerkGrenzenBody tr').count(),2);
  await page.locator('#netwerkGrenzenClose').click();
  assert.deepEqual(errors,[]);console.log('Netwerkschakel-upload, grenscorrectie, VC-verschil, herberekening en totaalherstel geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
