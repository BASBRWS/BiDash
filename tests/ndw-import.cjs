/* Synthetische browserregressie: aparte bronnen, hergebruik, fouten en oude routes.
   Geen operationele bestanden of afgeleide brongegevens. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),zlib=require('zlib');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const site=path.join(__dirname,'../site');
const publication='<publicationTime>2026-01-05T07:01:00Z</publicationTime>';
const wrap=(type,body)=>`<publication xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="${type}">${publication}${body}</publication>`;
const characteristic=(index,lane,type,category='anyVehicle')=>`<measurementSpecificCharacteristics index="${index}"><measurementSpecificCharacteristics><period>60</period><specificLane>lane${lane}</specificLane><specificMeasurementValueType>${type}</specificMeasurementValueType><vehicleType>${category}</vehicleType></measurementSpecificCharacteristics></measurementSpecificCharacteristics>`;
const config=wrap('MeasurementSiteTablePublication',`<measurementSiteRecord id="TEST_SITE" version="1"><measurementSiteName><value>A15 km 25.000 Re</value></measurementSiteName>${characteristic(1,1,'trafficFlow')}${characteristic(2,2,'trafficFlow')}${characteristic(3,1,'trafficFlow','lorry')}${characteristic(4,1,'trafficSpeed')}${characteristic(5,2,'trafficSpeed')}</measurementSiteRecord>`);
const value=(index,tag,v)=>`<measuredValue index="${index}"><measuredValue><basicData><${tag}>${v}</${tag}></basicData></measuredValue></measuredValue>`;
const traffic=(q=600)=>wrap('MeasuredDataPublication',`<siteMeasurements><measurementSiteReference id="TEST_SITE" version="1"/><measurementTimeDefault>2026-01-05T07:00:00Z</measurementTimeDefault>${value(1,'vehicleFlowRate',q)}${value(2,'vehicleFlowRate',300)}${value(3,'vehicleFlowRate',60)}${value(4,'speed',100)}${value(5,'speed',120)}</siteMeasurements>`);
const file=(name,xml,gzip=true)=>({name,mimeType:gzip?'application/gzip':'text/xml',buffer:gzip?zlib.gzipSync(xml):Buffer.from(xml)});
(async()=>{
 const server=require('http').createServer((req,res)=>{
  const filename=path.join(site,new URL(req.url,'http://localhost').pathname);
  try{res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(filename));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))requests.push(r.url());});
  await page.goto(origin+'/engines/dvm.html');
  await page.waitForFunction(()=>window.__BIDASH_NDW_LOADER_ACTIVE__&&window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(()=>{
   ASSET_REGISTER_STATE={assets:[]};kostenDagRows=()=>[];kostenDagVervers=()=>{};
   const parser=DOMParser.prototype.parseFromString;
   window.configParses=0;
   DOMParser.prototype.parseFromString=function(xml,...args){if(xml.includes('<measurementSiteRecord'))window.configParses++;return parser.call(this,xml,...args);};
   const input=document.createElement('input');input.type='file';input.id='ndwTestInput';input.multiple=true;document.body.appendChild(input);
  });
  const load=async(files,kind)=>{
   await page.locator('#ndwTestInput').setInputFiles(files);
   return page.evaluate(async kind=>{try{return {result:await bidashLaadNdwFiles([...document.getElementById('ndwTestInput').files],kind)};}catch(error){return {error:error.message};}},kind);
  };
  const snapshot=()=>page.evaluate(()=>JSON.parse(JSON.stringify(ndw69Data())));
  const clear=()=>page.evaluate(()=>{window.__BIDASH_NDW_PENDING_V23__=null;window.__BIDASH_LAST_NDW_PENDING__=null;window.__BIDASH_LAST_NDW_ERROR__=null;RULES.kosten.ndw69Snapshot=null;RULES.kosten.ndw69={};});
  const configFile=file('renamed-config.xml.gz.xml',config),trafficFile=file('trafficspeed.xml.gz (1).xml',traffic());
  assert.equal((await load(configFile,'config')).result.pending,true);
  assert.equal(await page.evaluate(()=>__BIDASH_NDW_PENDING_V23__.config.configInfo.configs.size),1);
  let parses=await page.evaluate(()=>configParses);
  assert.equal((await load(trafficFile,'traffic')).error,undefined);
  assert.equal(await page.evaluate(()=>IMPORT_PROGRESS.fout),false,'nul actuele wegdelen is geen importfout');
  let data=await snapshot();assert.equal(data.sites[0].q,900);assert.equal(data.sites[0].speed,110);assert.equal(data.sites[0].lanes.length,2);assert.deepEqual(data.files,[configFile.name,trafficFile.name]);
  assert.equal(await page.evaluate(()=>configParses),parses,'configuratie niet opnieuw parsen bij trafficspeed');
  assert.equal((await load(file('nieuw.xml',traffic(1200),false),'traffic')).error,undefined);
  assert.equal((await snapshot()).sites[0].q,1500);assert.equal(await page.evaluate(()=>configParses),parses);
  const broken=wrap('MeasuredDataPublication','<siteMeasurements><measurementSiteReference id="TEST_SITE"/>');
  assert.match((await load(file('afgebroken.xml',broken,false),'traffic')).error,/onvolledig/);
  assert.equal((await snapshot()).sites[0].q,1500,'vorige geldige snapshot blijft staan');
  assert.equal(await page.evaluate(()=>__BIDASH_NDW_PENDING_V23__.config.configInfo.configs.size),1,'configuratie blijft na fout beschikbaar');
  assert.equal((await load(trafficFile,'traffic')).error,undefined);
  assert.equal(await page.evaluate(()=>configParses),parses);
  assert.match((await load(configFile,'traffic')).error,/juiste bronkaart/);
  assert.equal((await snapshot()).sites[0].q,900);
  await clear();
  assert.equal((await load(trafficFile,'traffic')).result.waitingFor,'config');
  assert.equal((await load(configFile,'config')).error,undefined);
  assert.equal((await snapshot()).sites[0].q,900);
  await clear();
  assert.equal((await load([configFile,trafficFile])).error,undefined);
  assert.equal((await snapshot()).sites[0].q,900,'oude meervoudige upload blijft werken');
  const exported=await snapshot();
  await clear();
  assert.equal((await load(file('export.json',JSON.stringify({parameters:{kosten:{ndw69Snapshot:exported}}}),false))).error,undefined);
  assert.equal((await snapshot()).sites[0].q,900,'bestaande JSON-export blijft werken');
  await clear();
  const v3Config=config.replaceAll('measurementSiteRecord','measurementSite');
  const v3Traffic=traffic().replace(/<measuredValue index=/g,'<physicalQuantity index=').replace(/<\/measuredValue><\/measuredValue>/g,'</measuredValue></physicalQuantity>');
  assert.equal((await load(file('snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz',`<root>${v3Config}${v3Traffic}</root>`))).error,undefined);
  assert.equal((await snapshot()).sites[0].q,900,'gecombineerd bestand met v3-meetvelden blijft werken');
  // Controleer de hele keten tot het echte wegdeelscenario, niet alleen de parser.
  await clear();
  await page.evaluate(()=>{
   window.testRoad={key:'TEST|A15|RE',weg:'A15',richting:'RE',meldingen:[{hm:25,avail:80}]};
   kostenDagRows=()=>[window.testRoad];
  });
  assert.equal((await load([configFile,trafficFile])).result.gekoppeld,1);
  assert.equal(await page.evaluate(()=>sc67Config(testRoad).q),900);
  assert.equal(await page.evaluate(()=>sc67Config(testRoad).ndwUsed.id),'TEST_SITE');
  await clear();
  await page.evaluate(()=>{ASSET_REGISTER_STATE.assets=[{weg:'A15',richting:'LI',hm:25.2,rdX:155000,rdY:463000}];});
  const located=config.replace('</measurementSiteName>','</measurementSiteName><measurementSiteLocation><latitude>52.15517440</latitude><longitude>5.38720621</longitude></measurementSiteLocation>');
  assert.equal((await load([file('synthetic-located.xml',located,false),trafficFile])).result.gekoppeld,1);
  assert.equal((await snapshot()).sites[0].direction,'RE','expliciete bronrichting niet overschrijven met dichtstbijzijnde asset');
  assert.equal((await snapshot()).sites[0].hm,25);
  await page.evaluate(()=>{ASSET_REGISTER_STATE.assets=[];});
  const monibas=(token)=>{
   const id='RWS01_MONIBAS_0151'+token+'0250ra';
   return [file('synthetic-config.xml',config.replaceAll('TEST_SITE',id).replace('A15 km 25.000 Re',id),false),file('synthetic-traffic.xml',traffic().replaceAll('TEST_SITE',id),false)];
  };
  await clear();
  assert.equal((await load(monibas('hrr'))).result.gekoppeld,1);
  data=await snapshot();assert.equal(data.sites[0].road,'A15');assert.equal(data.sites[0].hm,25);assert.equal(data.sites[0].direction,'RE');
  assert.equal(await page.evaluate(()=>sc67Config(testRoad).q),900);
  await clear();
  assert.equal((await load(monibas('hrl'))).result.gekoppeld,0,'tegengestelde MONIBAS-rijbaan niet koppelen');
  assert.equal((await snapshot()).sites[0].direction,'LI');
  await clear();
  assert.equal((await load(monibas('vwa'))).result.gekoppeld,0,'richting van aansluitingen niet verzinnen');
  assert.equal((await snapshot()).sites[0].direction,'');
  // Bedien de twee echte broninputs, inclusief de bronkaartstatus.
  await clear();
  await page.locator('#ndwConfigInput').setInputFiles(configFile);
  await page.waitForFunction(()=>window.__BIDASH_LAST_NDW_PENDING__?.kind==='config');
  await page.locator('#ndwTrafficspeedInput').setInputFiles(trafficFile);
  await page.waitForFunction(()=>window.__BIDASH_NDW_PENDING_V23__?.traffic?.applied===true);
  await page.evaluate(()=>renderDatasetBeheer());
  const cards=await page.evaluate(()=>datasetItems().filter(x=>x.type==='ndwMeetlocaties'||x.type==='ndwVerkeer'));
  assert.equal(cards.length,2);assert(cards.every(x=>x.aanwezig));assert(cards[0].meta.includes(configFile.name));assert(cards[1].meta.includes(trafficFile.name));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('NDW: aparte uploads, beide laadvolgordes, hergebruik, herstel na fout, rijstrooktotalen en bestaande meervoudige upload geslaagd.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
