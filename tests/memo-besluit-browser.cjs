const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const site=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{try{const p=path.join(site,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await page.locator('[data-group=services]').click();await page.waitForSelector('#engine-dvm iframe');const frame=await (await page.locator('#engine-dvm iframe').elementHandle()).contentFrame();await frame.waitForFunction(()=>window.HUB?.__bidashFaultsExtended);
  const before=await frame.evaluate(()=>{
   const now=new Date().toISOString(),assets=[{entityid:'S1',asset:'MSI A4 RE 26.200 1','ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'}];
   analyseerAssetRegister(assets,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=assets;
   const rows=[{event_id:'f1',locatie:'A4 RE 26.200',MSI:'1',vc:'ZWN',assettype:'MSI',foutcode:'1003',melding:'Fatale fout bij MSI 1',van:now,laatste_gezien:now,bron_peildatum:now,levenscyclus_status:'OPEN_BEVESTIGD',_liveOpen:true}];
   LIVE_STORINGSBRONNEN=[{key:'synthetic',naam:'synthetic',rijen:rows,peildatum:Date.parse(now)}];LIVE_PEILDATUM=Date.parse(now);STATE=doorrekenen(rows,{actueel:true,peildatum:LIVE_PEILDATUM});STATE.peildatum=LIVE_PEILDATUM;STATE.bestand='synthetic';renderOverzicht();opentMemo('overzicht');return JSON.stringify(STATE);
  });
  const preview=frame.locator('#memoPreview');await preview.waitFor();assert.match(await preview.innerText(),/Conceptbeslispunten/);
  const count=await frame.locator('#memoBesluitEditor details').count();assert.ok(count>=2);
  const values={actie:'Voer een herstelopdracht van drie maanden uit voor de storingslevenscyclus.',eigenaar:'Eigenaar storingsketen',einddatum:'2027-01-14',resultaat:'een getoetste incidentidentificatie, sluitregels en broncontroles',terugDatum:'2027-01-21',besluitvormer:'DT'};
  for(let i=0;i<count;i++){
   await frame.locator('#memoBesluitEditor details').nth(i).locator('summary').click();
   for(const [k,v] of Object.entries(values)){const input=frame.locator('#memoBesluit-'+i+'-'+k);await input.fill(v);await input.dispatchEvent('change');}
  }
  const regular=await preview.innerText();for(const text of ['Instemmen met een uitvoeringsopdracht','drie maanden','Eigenaar storingsketen','14 januari 2027','incidentidentificatie','21 januari 2027','DT','ter vaststelling'])assert.ok(regular.includes(text),text);
  assert.equal(regular.includes('Conceptbeslispunten'),false);
  const expected=await preview.locator('.memo-besluitblok').innerText();
  await frame.locator('#memoLieke').check();assert.equal(await preview.locator('.memo-besluitblok').innerText(),expected);
  await page.locator('#engine-dvm iframe').scrollIntoViewIfNeeded();
  await frame.locator('#memoKosten').check({timeout:5000});assert.equal(await preview.locator('.memo-besluitblok').innerText(),expected);
  await frame.locator('input[name=memoNiveau][value=bestuurlijk]').check();assert.equal(await preview.locator('.memo-besluitblok').innerText(),expected);
  await frame.locator('#memoKoppelBW').check();assert.equal(await frame.locator('#memoBesluit-0-eigenaar').inputValue(),values.eigenaar);assert.match(await preview.innerText(),/1 van/);
  await frame.locator('#memoBesluitEditor details').nth(count).locator('summary').click();
  await frame.locator('#memoBesluit-'+count+'-eigenaar').fill('Risico-eigenaar');await frame.locator('#memoBesluit-'+count+'-eigenaar').dispatchEvent('change');
  await frame.locator('#memoKoppelBW').uncheck();
  await frame.locator('#memoBesluitEditor details').first().locator('summary').click();await frame.locator('#memoBesluit-0-eigenaar').fill(values.eigenaar);await frame.locator('#memoBesluit-0-eigenaar').dispatchEvent('change');
  await frame.locator('#memoKoppelBW').check();assert.equal(await frame.locator('#memoBesluit-'+count+'-eigenaar').inputValue(),'Risico-eigenaar');
  await frame.locator('#memoKoppelBW').uncheck();assert.equal(await preview.locator('.memo-besluitblok').innerText(),expected);
  assert.equal(await frame.evaluate(()=>JSON.stringify(STATE)),before);
  const printPromise=page.waitForEvent('popup');await frame.locator('button[onclick="memoPrint()"]').click();const print=await printPromise;await print.waitForLoadState('domcontentloaded');assert.equal(await print.locator('.memo-besluitblok').innerText(),expected);await print.close();
  const filePromise=page.waitForEvent('download');await frame.locator('button[onclick="memoWord()"]').click();const download=await filePromise;assert.match(download.suggestedFilename(),/\.docx$/);assert.equal(await download.failure(),null);
  const docxText=JSON.parse(require('node:child_process').execFileSync('python3',['-c','import sys,zipfile,json,xml.etree.ElementTree as E; r=E.fromstring(zipfile.ZipFile(sys.argv[1]).read("word/document.xml")); print(json.dumps(" ".join(r.itertext())))',await download.path()],{encoding:'utf8'}));
  for(const text of ['Eigenaar storingsketen','14 januari 2027','21 januari 2027','DT'])assert.ok(docxText.includes(text),text);
  const roundtrip=await frame.evaluate(async()=>{const b=HUB.export({fullSources:true});await HUB.import(b);opentMemo('overzicht');return {text:document.querySelector('#memoPreview .memo-besluitblok').innerText,owner:document.getElementById('memoBesluit-0-eigenaar').value};});
  assert.equal(roundtrip.owner,values.eigenaar);assert.equal(roundtrip.text,expected);
  assert.deepEqual(errors,[]);console.log('Memo browser geslaagd: afzonderlijke afspraken, gewone/Lieke-memo, opties, print, Word en export/herimport.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
