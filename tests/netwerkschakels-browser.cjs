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
  await page.evaluate(()=>{
   const rows=[{assetType:'MSI',asset:'MSI A15 RE 2.000 1',regio:'ZWN',status:'Operationeel'},
    {assetType:'MSI',asset:'MSI A15 RE 12.000 1',regio:'ZWN',status:'Operationeel'}];
   analyseerAssetRegister(rows,'synthetic-assets');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   LIVE_STORINGSBRONNEN=[{key:'test',naam:'synthetic-open',peildatum:Date.parse('2026-01-02T06:00:00Z'),rijen:[{assetType:'MSI',locatie:'A15 RE 2.000',foutcode:'1003',melding:'Lamp(en) defect',start:'2026-01-01T06:00:00Z'}]}];
   LIVE_PEILDATUM=LIVE_STORINGSBRONNEN[0].peildatum;
   STATE=doorrekenen(gecombineerdeLiveStoringsRijen(),{actueel:true,peildatum:LIVE_PEILDATUM});
  });
  assert.equal(await page.evaluate(()=>STATE.wegdelen.find(w=>w.netwerkschakel==='TEST1').N),1);
  await page.evaluate(()=>HUB.open('wegdelen'));
  await page.locator('#tab-wegdelen button').filter({hasText:'RE'}).first().click();
  assert.match(await page.locator('#tab-wegdeelverslag').innerText(),/Netwerkschakel TEST1/);
  await page.evaluate(async()=>{const b=HUB.export({fullSources:true});await HUB.import(b);});
  assert.equal(await page.evaluate(()=>HUB.export({fullSources:true}).netwerkschakels.rijen.length),2);
  await page.evaluate(()=>HUB.open('datasets'));
  assert.match(await page.locator('#tab-datasets').innerText(),/synthetic.xlsx/);
  assert.deepEqual(errors,[]);console.log('Netwerkschakel-upload, overzicht, rekenverslag en totaalherstel geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
