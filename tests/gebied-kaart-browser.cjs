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
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),...(process.env.PLAYWRIGHT_PROXY_SERVER?{proxy:{server:process.env.PLAYWRIGHT_PROXY_SERVER,bypass:'127.0.0.1,localhost'}}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage({viewport:{width:1100,height:1000},ignoreHTTPSErrors:process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS==='1'}),errors=[],requests=[];let offline=false;
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.PDOK_LIVE==='1'){page.on('requestfailed',r=>console.log('Kaartnetwerk',r.url(),r.failure()?.errorText));page.on('console',m=>{if(m.type()==='error')console.log('Browser',m.text());});}
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=','base64');
  await page.route('https://service.pdok.nl/**',async route=>{
   requests.push({url:route.request().url(),headers:route.request().headers()});
   if(offline)return route.abort('internetdisconnected');
   if(process.env.PDOK_LIVE==='1')return route.continue();
   return route.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:png});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/engines/dvm.html');
  await page.waitForFunction(()=>window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(()=>{
   const row=(id,vc,x,y)=>({entityid:id,asset:'MSI A15 RE 12.345 1','ci-type':'VKS signaalgevers',regio:vc,status:'Operationeel','rd-locatie-x':x,'rd-locatie-y':y});
   analyseerAssetRegister([row('S','ZWN',80000,430000),row('N','NWN',130000,490000)],'synthetic');
   const wd=(vc,x,y)=>{const c={hmMin:12.345,hmMax:12.5,n:2,lengte:1,dichtheid:2,beschLok:70,fatale:1,leden:[{rdX:x,rdY:y}]};return {key:'A15 RE '+vc,weg:'A15',richting:'RE',vc,n:2,besch:99,wegLen:10,chokes:[c],meldingen:c.leden};};
   STATE={wegdelen:[wd('ZWN',80000,430000),wd('NWN',130000,490000)]};
   renderGebied();document.getElementById('loginScherm').style.display='none';document.getElementById('appRoot').style.display='';document.querySelectorAll('.tabpage').forEach(el=>el.classList.add('hidden'));document.getElementById('tab-gebied').classList.remove('hidden');
  });
  await page.waitForFunction(()=>document.querySelector('[data-kaart-status]')?.textContent==='Achtergrondkaart geladen.');
  if(process.env.GEBIED_SCREENSHOT)await page.locator('#chokeRijkswegKaart').screenshot({path:process.env.GEBIED_SCREENSHOT});
  assert.ok(requests.length>0);assert.equal(await page.locator('.choke-punt').count(),2);
  assert.ok(requests.every(r=>!r.headers.referer&&!r.headers.cookie));
  assert.ok(requests.every(r=>/^https:\/\/service\.pdok\.nl\/kadaster\/brt-achtergrondkaart\/wmts\/v2_0\/standaard\/EPSG:28992\/\d{2}\/\d+\/\d+\.png$/.test(r.url)));
  const prior=await page.locator('[data-kaart-tegel]').first().getAttribute('href');
  await page.evaluate(()=>wijzigGebiedZoom(1));
  await page.waitForFunction(()=>document.querySelector('[data-kaart-status]')?.textContent==='Achtergrondkaart geladen.');
  assert.notEqual(await page.locator('[data-kaart-tegel]').first().getAttribute('href'),prior);
  await page.evaluate(()=>wijzigGebiedRegio('ZWN'));
  assert.equal(await page.locator('.choke-punt').count(),1);
  await page.locator('.choke-kaart-link').click();
  assert.equal(await page.evaluate(()=>GEBIED_KAART_ZOOM>=2.6),true);
  offline=true;await page.evaluate(()=>wijzigGebiedRegio('NWN'));
  await page.waitForFunction(()=>document.querySelector('[data-kaart-status]')?.textContent.includes('niet beschikbaar'));
  assert.equal(await page.locator('.choke-punt').count(),1);
  assert.equal(await page.evaluate(()=>STATE.wegdelen.length),2);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#chokeRijkswegKaart').evaluate(el=>el.getBoundingClientRect().width<=390));
  assert.deepEqual(errors,[]);
  console.log('Gebiedskaart geslaagd: kaarttegels, CSP, geen referrer/cookies, zoom, VC-filter, selectie, mobiel en uitval van de kaartbron.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
