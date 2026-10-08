const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ns='http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects';
// Uitsluitend synthetische gegevens, met dezelfde objectsoorten als een P6-export.
const fixture=`<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="${ns}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ext="urn:test" xsi:schemaLocation="${ns} http://xmlns.oracle.com/Primavera/P6/V23.12/API/p6apibo.xsd">
 <ProjectList><Project ObjectId="100"><Id>TEST</Id><Name>Testplanning</Name></Project></ProjectList>
 <DisplayCurrency><Currency><Id>EUR</Id><Symbol>€</Symbol></Currency></DisplayCurrency>
 <OBS><ObjectId>1</ObjectId><ParentObjectId xsi:nil="true"/><Name>Testteam</Name></OBS>
 <Calendar><ObjectId>2</ObjectId><Name>Testkalender</Name><HoursPerDay>8</HoursPerDay></Calendar>
 <FinancialPeriodTemplate><ObjectId>3</ObjectId></FinancialPeriodTemplate>
 <Project><ObjectId>99</ObjectId><Name>Ander project</Name><Activity><ObjectId>11</ObjectId><StartDate>2029-01-01T08:00:00</StartDate></Activity></Project>
 <Project>
  <DataDate>2030-01-01T00:00:00</DataDate><ObjectId>100</ObjectId><Name>Testplanning &amp; scenario</Name><ScheduledFinishDate>2030-12-31T17:00:00</ScheduledFinishDate>
  <WBS><Code>TEST</Code><Name>Testgroep</Name><ObjectId>10</ObjectId><ParentObjectId xsi:nil="true"/><OriginalBudget>50</OriginalBudget><SequenceNumber>1</SequenceNumber></WBS>
  <ActivityCodeType><Name>Testcode</Name><ObjectId>20</ObjectId></ActivityCodeType><ActivityCode><ObjectId>21</ObjectId><CodeTypeObjectId>20</CodeTypeObjectId><CodeValue>X</CodeValue></ActivityCode>
  <Activity>
   <ActualStartDate>2030-01-02T08:00:00</ActualStartDate><ActualFinishDate xsi:nil="true"/><ActualLaborUnits>12</ActualLaborUnits><PlannedDuration>16</PlannedDuration>
   <CalendarObjectId>2</CalendarObjectId><StartDate>2030-01-31T08:09:10.123+01:00</StartDate><FinishDate>2030-02-02T17:00:00</FinishDate><PlannedStartDate>2030-01-31T08:09:10.123+01:00</PlannedStartDate><PlannedFinishDate>2030-02-02T17:00:00</PlannedFinishDate>
   <EarlyStartDate>2030-01-31T08:00:00</EarlyStartDate><EarlyFinishDate>2030-02-02T17:00:00</EarlyFinishDate><LateStartDate>2030-02-03T08:00:00</LateStartDate><LateFinishDate>2030-02-05T17:00:00</LateFinishDate>
   <RemainingEarlyStartDate>2030-02-01T08:00:00</RemainingEarlyStartDate><RemainingEarlyFinishDate>2030-02-02T17:00:00</RemainingEarlyFinishDate><RemainingLateStartDate>2030-02-03T08:00:00</RemainingLateStartDate><RemainingLateFinishDate>2030-02-05T17:00:00</RemainingLateFinishDate>
   <ExpectedFinishDate xsi:nil="true"/><PrimaryConstraintDate>2030-02-10T17:00:00</PrimaryConstraintDate><PrimaryConstraintType>Finish On or Before</PrimaryConstraintType>
   <ObjectId>11</ObjectId><Id>A11</Id><Name><![CDATA[Taak <een>]]></Name><GUID>test-guid</GUID><WBSObjectId>10</WBSObjectId><Type>Task Dependent</Type><Status>In Progress</Status><Code><CodeTypeObjectId>20</CodeTypeObjectId><ValueObjectId>21</ValueObjectId></Code><ext:StartDate>Ongewijzigd</ext:StartDate>
  </Activity>
  <Activity><StartDate>2030-02-20T08:00:00Z</StartDate><FinishDate>2030-02-20T08:00:00Z</FinishDate><PlannedStartDate/><PlannedFinishDate xsi:nil="true"/><ObjectId>12</ObjectId><Id>A12</Id><Name>Mijlpaal</Name><WBSObjectId>10</WBSObjectId><Type>Finish Milestone</Type></Activity>
  <Relationship><ObjectId>30</ObjectId><PredecessorActivityObjectId>11</PredecessorActivityObjectId><SuccessorActivityObjectId>12</SuccessorActivityObjectId><Type>Finish to Start</Type><Lag>0</Lag></Relationship>
  <ResourceAssignment><ActivityObjectId>11</ActivityObjectId><ObjectId>40</ObjectId><ResourceObjectId>41</ResourceObjectId><PlannedStartDate>2030-01-31T08:00:00</PlannedStartDate><PlannedFinishDate>2030-02-02T17:00:00</PlannedFinishDate><ActualStartDate>2030-01-02T08:00:00</ActualStartDate><PlannedUnits>16</PlannedUnits><PlannedCost>100</PlannedCost></ResourceAssignment>
  <ScheduleOptions><PreserveScheduledEarlyAndLateDates>1</PreserveScheduledEarlyAndLateDates></ScheduleOptions>
 </Project><Resource><ObjectId>41</ObjectId><Name>Testresource</Name></Resource>
</APIBusinessObjects>`;

async function compareStructure(frame,before,after){
 return frame.evaluate(({before,after})=>{
  const parser=new DOMParser(),a=parser.parseFromString(before,'application/xml'),b=parser.parseFromString(after,'application/xml'),differences=[];
  function visit(x,y,path){
   if(!y||x.nodeType!==y.nodeType||x.localName!==y.localName||x.namespaceURI!==y.namespaceURI)throw Error('Andere structuur bij '+path);
   if(x.nodeType===1){
    const attrs=n=>Array.from(n.attributes).map(a=>[a.namespaceURI,a.localName,a.value]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if(JSON.stringify(attrs(x))!==JSON.stringify(attrs(y)))throw Error('Andere attributen bij '+path);
   }
   const xc=Array.from(x.childNodes),yc=Array.from(y.childNodes);
   if(xc.length!==yc.length)throw Error('Andere kindstructuur bij '+path);
   if(!xc.length&&x.nodeValue!==y.nodeValue)differences.push({path,before:x.nodeValue,after:y.nodeValue});
   xc.forEach((c,i)=>visit(c,yc[i],path+'/'+(c.localName||c.nodeName)+'['+i+']'));
  }
  visit(a.documentElement,b.documentElement,'root');return differences;
 },{before,after});
}

(async()=>{
 const server=require('http').createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),file=path.join(process.cwd(),'site',url.pathname==='/'?'index.html':url.pathname);
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:path.resolve(process.env.CHROMIUM_PATH)}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin='http://127.0.0.1:'+server.address().port;await page.goto(origin);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));
  async function load(xml,name='testplanning.xml'){
   await page.locator('#primaryNav [data-route=data]').click();
   await page.locator('#files').setInputFiles({name,mimeType:'text/xml',buffer:Buffer.from(xml)});
   await page.locator('#applyImport').click();
   await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Import voltooid')||document.querySelector('#status').classList.contains('error'),{},{timeout:60000});
   assert.match(await page.locator('#status').innerText(),/Import voltooid/);
   return page.frames().find(frame=>new URL(frame.url()).pathname.endsWith('/planning.html'));
  }
  let frame=await load(fixture);
  assert.equal(await frame.evaluate(()=>IPL_MODEL.regels.length),2);
  const noScenario=await frame.evaluate(()=>HUB.exportPrimavera());assert.equal(noScenario.text,fixture);
  await frame.evaluate(()=>{IPL_COLLAPSED={'10':true};IPL_MSHIFT={'11':1};IPL_CASCADE={};});
  let result=await frame.evaluate(()=>HUB.exportPrimavera());assert.equal(result.changedActivities,2);assert.equal(result.changedDates,16);
  const differences=await compareStructure(frame,fixture,result.text);
  assert.equal(differences.length,16);
  for(const difference of differences)assert.match(difference.path,/\/(?:StartDate|FinishDate|PlannedStartDate|PlannedFinishDate|EarlyStartDate|EarlyFinishDate|LateStartDate|LateFinishDate|RemainingEarlyStartDate|RemainingEarlyFinishDate|RemainingLateStartDate|RemainingLateFinishDate)\[/);
  assert(result.text.includes('2030-02-28T08:09:10.123+01:00'));assert(result.text.includes('2030-03-20T08:00:00Z'));
  assert.equal(await frame.evaluate(()=>IPL_RAW_XML),fixture);
  assert.equal(await frame.evaluate(text=>ipl_parseXML(text).regels.length,result.text),2);
  // Beide knoppen downloaden hetzelfde scenario, originele XML blijft apart.
  let waiting=page.waitForEvent('download');await page.locator('#exportPrimavera').click();let download=await waiting;
  assert.match(download.suggestedFilename(),/^testplanning-scenario-\d{4}-\d{2}-\d{2}\.xml$/);
  assert.equal(fs.readFileSync(await download.path(),'utf8'),result.text);
  await page.locator('details:has(#exportXml) > summary').click();waiting=page.waitForEvent('download');await page.locator('#exportXml').click();download=await waiting;assert.equal(fs.readFileSync(await download.path(),'utf8'),fixture);
  await page.locator('#primaryNav [data-route=planning]').click();
  waiting=page.waitForEvent('download');await frame.locator('#ipl-export-primavera').click();download=await waiting;assert.equal(fs.readFileSync(await download.path(),'utf8'),result.text);
  await page.locator('#primaryNav [data-route=data]').click();await page.locator('#none').click();await page.locator('[data-part=planning]').check();
  waiting=page.waitForEvent('download');await page.locator('#export').click();download=await waiting;const bundle=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(bundle.delen.planning.xml,fixture);assert.equal(bundle.delen.planning.state.ipl.mshift['11'],1);
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Lokaal opgeslagen'));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));
  await page.locator('#primaryNav [data-route=data]').click();waiting=page.waitForEvent('download');await page.locator('#exportPrimavera').click();download=await waiting;assert.equal(fs.readFileSync(await download.path(),'utf8'),result.text);
  // Namespaceprefixen blijven intact en zijn ook importeerbaar.
  const prefixed=fixture.replace('xmlns="'+ns+'"','xmlns:p="'+ns+'"').replace(/<(\/?)([A-Z]\w*)(?=[\s/>])/g,'<$1p:$2');
  frame=await load(prefixed);await frame.evaluate(()=>{IPL_SHIFT=-1;IPL_CASCADE={};});result=await frame.evaluate(()=>HUB.exportPrimavera());assert.equal(result.changedActivities,2);await compareStructure(frame,prefixed,result.text);
  // Foutgevallen leveren geen mislukt of verkeerd gelabeld downloadbestand.
  const failures=await frame.evaluate(async xml=>{
   const {createPrimaveraExport}=await import('../core/primavera-export.js');
   const run=(source,regels,cascade)=>{try{createPrimaveraExport({xml:source,regels,cascade});return '';}catch(error){return error.message;}};
   return [run('<Project><Tasks/></Project>',[{id:'11'}],{}),run('<APIBusinessObjects>',[{id:'11'}],{}),run(xml,[{id:'999'}],{}),run(xml,[{id:'11'}],{'11':0.5/12}),run(xml.replace('<ObjectId>12</ObjectId>','<ObjectId>11</ObjectId>'),[{id:'11'}],{})];
  },fixture);
  assert(failures.every(Boolean));assert.match(failures[0],/MS Project/);assert.match(failures[4],/dubbele/);
  // Optionele lokale bronproef. Geen operationele bronwaarden in logs of Git.
  if(process.env.PRIVATE_PRIMAVERA_FILE){
   const source=fs.readFileSync(process.env.PRIVATE_PRIMAVERA_FILE,'utf8');frame=await load(source,'lokale-bron.xml');
   assert.equal((await frame.evaluate(()=>HUB.exportPrimavera())).text,source);
   await frame.evaluate(()=>{IPL_SHIFT=1;IPL_CASCADE={};});const exported=await frame.evaluate(()=>HUB.exportPrimavera());
   const changes=await compareStructure(frame,source,exported.text);assert(changes.length>0);
   assert.equal(await frame.evaluate(text=>ipl_parseXML(text).regels.length,exported.text),await frame.evaluate(()=>IPL_MODEL.regels.length));
   assert.equal(await frame.evaluate(()=>IPL_RAW_XML),source);
   console.log('Lokale Primavera-bron, structuurbehoud en herimport geslaagd.');
  }
  assert.deepEqual(errors,[]);console.log('Primavera-export, cascade, namespaces, bronbehoud, downloads en herstel geslaagd.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
