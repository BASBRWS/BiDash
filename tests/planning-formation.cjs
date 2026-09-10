const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const server=require('http').createServer((req,res)=>{const f=path.join(process.cwd(),'site',req.url==='/'?'index.html':new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(8080,r));
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:path.resolve(process.env.CHROMIUM_PATH)}:{}),args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote'],headless:true});
 try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://localhost:8080')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))requests.push(r.url());});page.on('dialog',async d=>{console.log('DIALOG',d.message().slice(0,150));await d.accept();});
 await page.goto('http://localhost:8080');await page.locator('#primaryNav [data-route=data]').click();
 const apply=async()=>{await page.locator('#applyImport').waitFor({timeout:30000});await page.locator('#applyImport').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Import voltooid')||document.querySelector('#status').classList.contains('error'),{},{timeout:180000});const s=await page.locator('#status').innerText();console.log(s);assert(s.includes('Import voltooid'));};
 // Two overlapping tasks must both contribute to cumulative VWM formation.
 const xml='<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Name>Testplanning</Name><StartDate>2026-09-01T08:00:00</StartDate><FinishDate>2026-09-30T17:00:00</FinishDate><Tasks><Task><UID>1</UID><ID>1</ID><Name>Contractvoorbereiding</Name><OutlineLevel>1</OutlineLevel><OutlineNumber>1</OutlineNumber><Summary>1</Summary><Start>2026-09-01T08:00:00</Start><Finish>2026-09-30T17:00:00</Finish></Task><Task><UID>2</UID><ID>2</ID><Name>A2 onderhoud</Name><OutlineLevel>2</OutlineLevel><OutlineNumber>1.1</OutlineNumber><Summary>0</Summary><Start>2026-09-02T08:00:00</Start><Finish>2026-09-25T17:00:00</Finish><Duration>PT32H0M0S</Duration></Task><Task><UID>3</UID><ID>3</ID><Name>Tweede taak</Name><OutlineLevel>2</OutlineLevel><Summary>0</Summary><Start>2026-09-02T08:00:00</Start><Finish>2026-09-25T17:00:00</Finish><Duration>PT32H0M0S</Duration></Task></Tasks></Project>';
 await page.locator('#files').setInputFiles({name:'testplanning.xml',mimeType:'text/xml',buffer:Buffer.from(xml)});await apply();
 let bi=page.frames().find(f=>f.url().endsWith('/bi.html'));console.log('PLANNING',await bi.evaluate(()=>HUB.summary().planning));assert((await bi.evaluate(()=>HUB.summary().planning.regels))>0);

 await page.locator('#primaryNav [data-route=planning]').click();const pl=page.frames().find(f=>new URL(f.url()).pathname.endsWith('/planning.html'));
 const verify=async()=>{const x=await pl.evaluate(()=>{const task=IPL_MODEL.regels.find(r=>r.kind!=='mile'),t=(task.t0+task.t1)/2,phase=vf(task),rate=VROLES.reduce((n,k)=>n+(Number(VCFG[phase]?.[k])||0),0);return {total:totalAt(t),expected:2*rate,phase,rate,cap:HCAP.VWM};});assert(x.rate>0);assert(Math.abs(x.total-x.expected)<1e-9);return x;};
 const initial=await verify();
 await bi.evaluate(phase=>setV(phase,'IBP',DB.vwmFte[phase].IBP+1),initial.phase);const changed=await verify();assert(Math.abs(changed.total-initial.total-2)<1e-9);
 await page.locator('#planningFullscreen').click();await page.waitForTimeout(300);assert(await pl.locator('#ipl-fmt-VWM').isVisible());assert(await pl.locator('#ipl-fmt-CIV').isVisible());
 assert(await pl.evaluate(()=>{const c=document.getElementById('ipl-fmt-VWM');return c.width>100&&c.height>=90&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}));
 await page.locator('#closePlanningFullscreen').click();await page.setViewportSize({width:390,height:844});await page.locator('#planningFullscreen').click();await page.waitForTimeout(300);assert(await pl.locator('#ipl-fmt-VWM').isVisible());assert(await pl.evaluate(()=>document.getElementById('ipl-fmt-VWM').getBoundingClientRect().width>100));
 await page.locator('#closePlanningFullscreen').click();await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Lokaal opgeslagen'));
 await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));const restored=page.frames().find(f=>new URL(f.url()).pathname.endsWith('/planning.html'));assert(await restored.evaluate(()=>Object.keys(VCFG).length)>0);assert.equal(await restored.evaluate(()=>{const r=IPL_MODEL.regels.find(x=>x.kind!=='mile');return totalAt((r.t0+r.t1)/2);}),changed.total);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('Cumulatieve VWM, gewijzigde regels, fullscreen grafieken en herstel geslaagd');

 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
