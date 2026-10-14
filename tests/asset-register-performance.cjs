const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const site=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{
  try{const p=path.join(site,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await page.locator('[data-group=assets]').click();
  const idle=()=>page.waitForFunction(()=>document.getElementById('assetTable').getAttribute('aria-busy')==='false'&&document.getElementById('assetCount').textContent.includes('resultaten'));
  await idle();const dvm=page.frames().find(f=>f.url().includes('/dvm.html'));
  await dvm.evaluate(()=>{
   window.testRows=Array.from({length:50000},(_,i)=>({key:'test:'+i,naam:'MSI test '+i,tp:'MSI',weg:i%2?'A15':'A4',richting:'RE',hm:i/1000,vc:i%2?'ZWN':'NWN',prognoseActief:i!==0}));
   window.testFaults=[{assetKey:'test:1',code:'1001'},{assetKey:'test:1',code:'1003'},{assetKey:'test:3',code:'1001'}];
   window.testAssetReads=0;HUB.assets=()=>{testAssetReads++;return testRows;};HUB.faults=()=>testFaults;
   parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);
  });
  await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('assetCount').textContent.includes('50.000 resultaten'));await idle();
  assert.match(await page.locator('#assetCount').innerText(),/50\.000 resultaten/);assert.equal(await page.locator('#assetTable tbody tr').count(),60);
  const reads=await dvm.evaluate(()=>testAssetReads);
  const start=Date.now();await page.locator('#assetNext').click();await idle();
  assert.match(await page.locator('#assetCount').innerText(),/pagina 2 /);assert.equal(await dvm.evaluate(()=>testAssetReads),reads);
  console.log('Synthetisch register 50.000 assets, bladeren ms',Date.now()-start);
  await page.locator('#assetFaultOnly').check();await idle();assert.equal(await page.locator('#assetTable tbody tr').count(),2);
  assert.equal(await page.locator('#assetTable tbody tr').first().locator('td').last().innerText(),'2');
  await page.locator('#assetFaultOnly').uncheck();await idle();
  await page.locator('#assets .query-module summary').click();
  await page.locator('#assetQueryBuilder [data-query-add]').click();
  await page.locator('#assetQueryBuilder [data-query-field]').selectOption('assetFaultCodes');
  await page.locator('#assetQueryBuilder [data-query-operator]').selectOption('equals');
  await page.locator('#assetQueryBuilder [data-query-value]').fill('1001');
  await page.waitForTimeout(180);await idle();
  await page.locator('#assetQueryBuilder [data-query-add]').click();
  await page.locator('#assetQueryBuilder [data-query-field]').nth(1).selectOption('assetFaultCodes');
  await page.locator('#assetQueryBuilder [data-query-operator]').nth(1).selectOption('equals');
  await page.locator('#assetQueryBuilder [data-query-value]').nth(1).fill('1003');
  await page.waitForTimeout(180);await idle();assert.equal(await page.locator('#assetTable tbody tr').count(),1);
  assert.equal(await page.locator('#assetTable [data-asset]').getAttribute('data-asset'),'test:1');
  await page.locator('#assetQueryBuilder [data-query-reset]').click();await idle();
  await page.evaluate(()=>{const input=document.getElementById('assetSearch');for(const value of ['MSI','A15','test 49999']){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}});
  await page.waitForTimeout(180);await idle();assert.equal(await page.locator('#assetTable [data-asset]').getAttribute('data-asset'),'test:49999');
  await page.locator('#assetSearch').fill('');await page.waitForTimeout(180);await idle();
  await dvm.evaluate(()=>{testRows[0].weg='N31';testFaults=[];parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);});
  const beforeReads=await dvm.evaluate(()=>testAssetReads);await page.locator('#refresh').click();await dvm.waitForFunction(n=>testAssetReads>n,beforeReads);await idle();
  await page.locator('#assetSearch').fill('N31');await page.waitForTimeout(180);await idle();
  assert.equal(await page.locator('#assetTable tbody tr').count(),1);assert.match(await page.locator('#assetTable tbody tr').innerText(),/Niet operationeel/);
  await page.locator('#assetFaultOnly').check();await idle();assert.equal(await page.locator('#assetTable tbody tr').count(),0);
  await page.locator('[data-group=overview]').click();await page.locator('[data-group=assets]').click();await idle();
  assert.deepEqual(errors,[]);console.log('Register, paging, EN-foutcodes, zoeken, bronmutatie en leeg storingsbeeld geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
