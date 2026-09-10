const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const server=require('http').createServer((req,res)=>{const f=path.join(process.cwd(),'site',req.url==='/'?'index.html':new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(8080,r));
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:path.resolve(process.env.CHROMIUM_PATH)}:{}),args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote'],headless:true});
 try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://localhost:8080')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))requests.push(r.url());});page.on('dialog',async d=>{console.log('DIALOG',d.message().slice(0,150));await d.accept();});
 await page.goto('http://localhost:8080');await page.locator('#primaryNav [data-route=data]').click();
 const apply=async()=>{await page.locator('#applyImport').waitFor({timeout:30000});await page.locator('#applyImport').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Import voltooid')||document.querySelector('#status').classList.contains('error'),{},{timeout:180000});const s=await page.locator('#status').innerText();console.log(s);assert(s.includes('Import voltooid'));};
 // Check original MS Project parser and restored settings before the large DVM import.
 const xml='<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Name>Testplanning</Name><StartDate>2026-09-01T08:00:00</StartDate><FinishDate>2026-09-30T17:00:00</FinishDate><Tasks><Task><UID>1</UID><ID>1</ID><Name>VWM</Name><OutlineLevel>1</OutlineLevel><OutlineNumber>1</OutlineNumber><Summary>1</Summary><Start>2026-09-01T08:00:00</Start><Finish>2026-09-30T17:00:00</Finish></Task><Task><UID>2</UID><ID>2</ID><Name>A2 onderhoud</Name><OutlineLevel>2</OutlineLevel><OutlineNumber>1.1</OutlineNumber><Summary>0</Summary><Start>2026-09-02T08:00:00</Start><Finish>2026-09-05T17:00:00</Finish><Duration>PT32H0M0S</Duration></Task></Tasks></Project>';
 await page.locator('#files').setInputFiles({name:'testplanning.xml',mimeType:'text/xml',buffer:Buffer.from(xml)});await apply();
 let bi=page.frames().find(f=>f.url().endsWith('/bi.html'));console.log('PLANNING',await bi.evaluate(()=>HUB.summary().planning));assert((await bi.evaluate(()=>HUB.summary().planning.regels))>0);
 const p6='<APIBusinessObjects><Project><ObjectId>1</ObjectId><Name>P6 test</Name><WBS><ObjectId>10</ObjectId><Name>VWM</Name><ParentObjectId>0</ParentObjectId></WBS><Activity><ObjectId>20</ObjectId><Id>A20</Id><Name>Onderhoud</Name><WBSObjectId>10</WBSObjectId><StartDate>2026-09-01T08:00:00</StartDate><FinishDate>2026-09-03T17:00:00</FinishDate><Type>Task Dependent</Type></Activity><ResourceAssignment><ActivityObjectId>20</ActivityObjectId><ResourceObjectId>30</ResourceObjectId><PlannedUnitsPerTime>2</PlannedUnitsPerTime></ResourceAssignment></Project><Resource><ObjectId>30</ObjectId><Name>Begeleiding</Name></Resource></APIBusinessObjects>';
 await page.locator('#files').setInputFiles({name:'testp6.xml',mimeType:'text/xml',buffer:Buffer.from(p6)});await apply();
 console.log('P6',await bi.evaluate(()=>({planning:HUB.summary().planning,fte:HUB.export().p6Capaciteit?.totFte})));assert.equal(await bi.evaluate(()=>HUB.export().p6Capaciteit?.totFte),2);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await page.locator('#primaryNav [data-route=planning]').click();
 const pl=page.frames().find(f=>new URL(f.url()).pathname.endsWith('/planning.html'));
 await pl.locator('#iplCanvas').waitFor({state:'visible'});await pl.locator('#iplCanvas').scrollIntoViewIfNeeded();assert((await pl.locator('#iplCanvas').boundingBox()).height>40);assert(await pl.locator('#kpi-bar').isHidden());
 assert.equal(await pl.locator('#ipl-timescale').inputValue(),'fit');
 await page.locator('#planningFullscreen').click();await page.waitForTimeout(200);
 assert(await page.locator('body').evaluate(e=>e.classList.contains('planning-fullscreen')));
 assert(await pl.evaluate(()=>document.getElementById('iplCanvas').parentElement.clientWidth>innerWidth-45));
 await page.locator('#closePlanningFullscreen').click();await page.waitForTimeout(200);
 assert(!await page.locator('body').evaluate(e=>e.classList.contains('planning-fullscreen')));

 
 await page.locator('#primaryNav [data-route=data]').click();await page.locator('#none').click();await page.locator('[data-part=planning]').check();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const dl=await downloadPromise;const bundle=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.deepEqual(Object.keys(bundle.delen),['planning']);assert.equal(bundle.delen.planning.xml,p6);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));await page.locator('#primaryNav [data-route=planning]').click();const restored=page.frames().find(f=>new URL(f.url()).pathname.endsWith('/planning.html'));await restored.locator('#iplCanvas').waitFor({state:'visible'});assert((await restored.locator('#iplCanvas').boundingBox()).width>100);
 await page.setViewportSize({width:390,height:844});await page.locator('#primaryNav [data-route=overview]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth)<=400);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('Visible timeline, selective export, P6 restore and mobile: passed');

 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
