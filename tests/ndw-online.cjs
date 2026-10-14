/* Synthetische openbare bron. Een expliciete lokale NDW_REAL_CACHE-proef leest
   een al opgehaalde openbare kopie. Geen gebruikersgegevens of bronextracten. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const site=path.join(__dirname,'../site'),SOURCE='https://opendata.ndw.nu/snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz';
const pub=new Date(Date.now()-60000).toISOString();
const xml='<mc:messageContainer xmlns:mc="urn:synthetic:container" xmlns:com="urn:synthetic:common" xmlns:roa="urn:synthetic:road" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><mc:payload xsi:type="roa:MeasurementSiteTablePublication"><com:publicationTime>'+pub+'</com:publicationTime><roa:measurementSite id="S" version="1"><roa:measurementSiteName><com:value>A15 km 25.000 Re</com:value></roa:measurementSiteName><roa:measurementSpecificCharacteristics index="1"><roa:specificMeasurementValueType>trafficFlow</roa:specificMeasurementValueType><roa:specificLane>lane1</roa:specificLane><roa:vehicleType>anyVehicle</roa:vehicleType></roa:measurementSpecificCharacteristics></roa:measurementSite></mc:payload><mc:payload xsi:type="roa:MeasuredDataPublication"><com:publicationTime>'+pub+'</com:publicationTime><roa:siteMeasurements><roa:measurementSiteReference id="S" version="1"/><roa:measurementTimeDefault>'+pub+'</roa:measurementTimeDefault><roa:physicalQuantity index="1"><roa:vehicleFlowRate>900</roa:vehicleFlowRate></roa:physicalQuantity></roa:siteMeasurements></mc:payload></mc:messageContainer>';
let bytes=zlib.gzipSync(xml),sha=crypto.createHash('sha256').update(bytes).digest('hex');
let manifest={schema:1,status:'ready',source:SOURCE,file:'snapshot-'+sha+'.xml.gz',sha256:sha,bytes:bytes.length,publication:pub,downloadedAt:new Date().toISOString(),refreshMinutes:5,retained:false};
if(process.env.NDW_REAL_CACHE){
 manifest=JSON.parse(fs.readFileSync(path.join(process.env.NDW_REAL_CACHE,'latest.json')));
 bytes=fs.readFileSync(path.join(process.env.NDW_REAL_CACHE,manifest.file));
}
let mode='ready',release;
(async()=>{
 const requests=[];
 const server=require('node:http').createServer(async(req,res)=>{
  const uri=new URL(req.url,'http://localhost').pathname.replace(/^\/Project/,'');
  if(uri.startsWith('/ndw/')){
   requests.push(uri);
   if(mode==='hold')await new Promise(r=>release=r);
   if(mode==='unavailable'){res.statusCode=503;res.end('Offline');return;}
   if(uri.endsWith('latest.json')){
    const m={...manifest};
    if(mode==='old')m.publication='2025-01-01T00:00:00Z';
    if(mode==='unsafe')m.file='https://external.invalid/feed';
    if(mode==='retained')m.retained=true;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(m));return;
   }
   res.setHeader('Content-Type','application/gzip');
   if(mode==='broken'){const b=Buffer.from(bytes);b[bytes.length-1]^=1;res.end(b);return;}
   if(mode==='partial'){res.end(bytes.subarray(0,-10));return;}
   res.end(bytes);return;
  }
  try{
   const p=path.join(site,uri);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));
  }catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto(origin+'/Project/engines/dvm.html');
  await page.waitForFunction(()=>window.__BIDASH_NDW_LOADER_ACTIVE__&&window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(()=>{
   ASSET_REGISTER_STATE={assets:[]};
   window.ndwOnlineRoad={key:'TEST:ONLINE',weg:'A15',richting:'RE',meldingen:[{hm:25,avail:80}]};
   kostenDagRows=()=>[ndwOnlineRoad];kostenDagVervers=()=>{};
   RULES.kosten={...kostenBasis(),scenarioWegen67:{'TEST:ONLINE':{uren:2,reductie:20,bron:'Synthetische invoer'}}};
   window.ndwParseLengths=[];
   const parse=DOMParser.prototype.parseFromString;
   DOMParser.prototype.parseFromString=function(text,...args){ndwParseLengths.push(text.length);return parse.call(this,text,...args);};
   HUB.open('datasets');
  });
  assert.equal(await page.locator('[data-ndw-latest]').count(),2);
  await page.locator('[data-ndw-latest]').first().click();
  await page.waitForFunction(()=>ndw69Data()?.online?.source,{},{timeout:180000});
  assert.match(await page.locator('#tab-datasets').innerText(),/Meetlocaties uit gecombineerde snapshot/i);
  assert.match(await page.locator('#tab-datasets').innerText(),/minuten oud/);
  assert.equal(await page.evaluate(()=>HUB.export({fullSources:true}).parameters.kosten.ndw69Snapshot.online.source),SOURCE);
  assert.equal(await page.evaluate(()=>__BIDASH_NDW_PENDING_V23__),null);
  assert.ok(await page.evaluate(()=>ndwParseLengths.every(n=>n<2000000)),'XML wordt per blok gelezen');
  if(process.env.NDW_REAL_CACHE){
   assert.ok(await page.evaluate(()=>ndw69Data().sites.some(s=>s.q!==null)));
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   console.log('Werkelijke openbare NDW-kopie via knop, gzip, streaming XML, tijdcontrole en export geladen.');return;
  }
  assert.equal(await page.evaluate(()=>ndw69Data().sites[0].q),900);
  assert.equal(await page.evaluate(()=>ndw69Data().sites[0].road),'A15');
  assert.equal(await page.evaluate(()=>ndw69Data().sites[0].direction),'RE');
  assert.equal(await page.evaluate(()=>sc67Config(ndwOnlineRoad).q),900);
  assert.equal(await page.evaluate(()=>sc67Config(ndwOnlineRoad).ndwUsed.id),'S');
  assert.equal(await page.evaluate(()=>sc67Config(ndwOnlineRoad).uren),2);
  assert.equal(await page.evaluate(()=>sc67Config(ndwOnlineRoad).reductie),20);
  const previous=await page.evaluate(()=>JSON.stringify(ndw69Data()));
  for(const failure of ['unavailable','old','unsafe','broken','partial']){
   mode=failure;
   const error=await page.evaluate(async()=>{try{await bidashHaalLaatsteNdw();return '';}catch(e){return e.message;}});
   assert.ok(error,failure);
   assert.equal(await page.evaluate(()=>JSON.stringify(ndw69Data())),previous,'vorige meting behouden bij '+failure);
   assert.equal(await page.locator('[data-ndw-latest]:disabled').count(),0);
  }
  mode='hold';
  await page.evaluate(()=>{window.onlineRun=bidashHaalLaatsteNdw();});
  await page.waitForFunction(()=>document.querySelector('[data-ndw-latest]').disabled);
  assert.match(await page.evaluate(async()=>{try{await bidashLaadNdwFiles([new File(['x'],'x.xml')]);return '';}catch(e){return e.message;}}),/nog verwerkt/);
  mode='retained';release();
  await page.evaluate(()=>onlineRun);
  assert.match(await page.locator('#tab-datasets').innerText(),/vorige geldige openbare kopie/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  assert.ok(requests.every(u=>u==='/ndw/latest.json'||/^\/ndw\/snapshot-[a-f0-9]{64}\.xml\.gz$/.test(u)));
  console.log('NDW ophalen: bronknoppen, v3 namespaces, streaming, versheid, hash, fouten, parallelle upload en herkomst geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
