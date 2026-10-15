const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{if(req.url==='/storage-test.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Opslagregressie</title><body>Opslagregressie</body>');return;}try{const p=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote']});
  const context=await browser.newContext();const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/storage-test.html');
  const basic=await page.evaluate(async()=>{
   const S=await import('/core/storage.js');
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bidash-integraal',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const rawWrite=(key,value)=>new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('abort'));tx.onerror=e=>reject(tx.error||e.target?.error||Error('test storage failed'));try{tx.objectStore('workspace').put(value,key);}catch(e){tx.abort();reject(e);}});
   const old={schema:1,marker:'legacy',nil:null,zero:0,planning:{xml:'<Project/>'}};await rawWrite('current',old);
   const legacy=await S.read();await S.writeValue('other-cache',{x:0});
   const file=new File(['opaque'], 'synthetic.txt',{lastModified:123});await S.writeValue('opaque-file',file);const restoredFile=await S.readValue('opaque-file');if(!(restoredFile instanceof File)||restoredFile.lastModified!==123||await restoredFile.text()!=='opaque')throw Error('Ondoorzichtige browserwaarde niet behouden');
   const state={schema:1,marker:'new',payload:'漢🙂'.repeat(900000),nil:null,zero:0,missing:undefined};await S.write(state);
   const first=await S.read(),keys=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const put=IDBObjectStore.prototype.put;let count=0,failed='';
   IDBObjectStore.prototype.put=function(value,key){if(Array.isArray(key)&&++count===3)throw Error('Synthetic disk failure');return put.apply(this,arguments);};
   try{await S.write({...state,marker:'should-not-replace'});}catch(e){failed=e.message;}finally{IDBObjectStore.prototype.put=put;}
   const after=await S.read(),keysAfter=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await S.write({schema:1,marker:'final',nil:null,zero:0});
   const cleanKeys=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   // Verwijder één bevestigd deel, lezen moet falen in plaats van gedeeltelijke data te tonen.
   await S.write(state);const stored=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').delete(['bidash-workspace-part',stored.generation,1]);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
   let missing='';try{await S.read();}catch(e){missing=e.message;}
   await Promise.all([S.write(state),S.write(old)]);const last=await S.read();if(last.marker!=='legacy')throw Error('Gelijktijdige schrijfvolgorde verloren');
   await rawWrite('current',{storage:'BiDash-workspace-parts',version:99,generation:'bad',parts:0});let unsupported='';try{await S.read();}catch(e){unsupported=e.message;}if(!unsupported.includes('opslagindeling'))throw Error('Onbekend opslagformaat niet gemeld');await S.write(old);db.close();
   return {legacy,first:{marker:first.marker,length:first.payload.length,nil:first.nil,zero:first.zero,missing:Object.hasOwn(first,'missing')},after:{marker:after.marker,length:after.payload.length},failed,unchangedKeys:JSON.stringify(keys)===JSON.stringify(keysAfter),cleanKeys,other:await S.readValue('other-cache'),missing};
  });
  assert.equal(basic.legacy.marker,'legacy');assert.equal(basic.first.marker,'new');assert.equal(basic.first.nil,null);assert.equal(basic.first.zero,0);assert.equal(basic.first.missing,true);assert.equal(basic.after.marker,'new');assert.equal(basic.after.length,basic.first.length);assert.match(basic.failed,/Synthetic/);assert.equal(basic.unchangedKeys,true);assert.deepEqual(basic.cleanKeys,['current','opaque-file','other-cache']);assert.deepEqual(basic.other,{x:0});assert.match(basic.missing,/onvolledig|ongeldige opslagblokken/);
  console.log('Migratie, null/0, mislukte deelopslag, vorige stand, opruimen en ontbrekende blokken geslaagd.');
  const large=await page.evaluate(async()=>{
   const S=await import('/core/storage.js'),{storageSize}=await import('/core/workspace-parts.js');
   const payload='漢'.repeat(72*1024*1024),state={schema:1,dvm:null,bi:null,planning:null,links:[],expertReviews:[],history:[],qualityAudit:null,qualityHistory:[],marker:'large',payload,nil:null,zero:0};
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bidash-integraal',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   let oldError='';try{await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.oncomplete=resolve;tx.onerror=e=>reject(tx.error||e.target?.error||Error('test storage failed'));tx.onabort=()=>reject(tx.error||Error('abort'));try{tx.objectStore('workspace').put(state,'old-too-large');}catch(e){tx.abort();reject(e);}});}catch(e){oldError=e?.message||String(e);}
   const started=performance.now();await S.write(state);const writeMs=Math.round(performance.now()-started),loaded=await S.read();
   const manifest=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   let maxSize=0;await new Promise((resolve,reject)=>{const tx=db.transaction('workspace'),r=tx.objectStore('workspace').openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(Array.isArray(c.key))maxSize=Math.max(maxSize,storageSize(c.value));c.continue();}};tx.oncomplete=resolve;tx.onerror=e=>reject(tx.error||e.target?.error||Error('test storage failed'));});db.close();
   return {oldError,writeMs,parts:manifest.parts,maxSize,length:loaded.payload.length,equal:loaded.payload===payload,zero:loaded.zero,nil:loaded.nil};
  });
  assert.match(large.oldError,/too large|too big/i,'Oorspronkelijke put reproduceert de browsergrens');assert.ok(large.parts>100);assert.ok(large.maxSize<=4*1024*1024);assert.equal(large.length,72*1024*1024);assert.equal(large.equal,true);assert.equal(large.zero,0);assert.equal(large.nil,null);console.log('Werkruimte met 144 MiB Unicode opgeslagen en volledig teruggelezen.',JSON.stringify(large));
  const ndw=await context.newPage();await ndw.goto('http://127.0.0.1:'+server.address().port+'/engines/dvm.html');await ndw.waitForFunction(()=>typeof window.__BIDASH_READ_WORKSPACE__==='function');assert.equal(await ndw.evaluate(async()=>(await __BIDASH_READ_WORKSPACE__()).marker),'large');await ndw.close();console.log('NDW leest dezelfde complete gesplitste werkruimte.');
  // De echte import gebruikt dezelfde opslag en de gelezen werkruimte start opnieuw op.
  const app=await context.newPage();await app.goto('http://127.0.0.1:'+server.address().port+'/index.html');await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await app.locator('[data-group=data]').click();
  const bundle={formaat:'BiDash-integraal',versie:1,delen:{links:[],expertReviews:[],history:[{bron:'synthetic',waarde:0,ontbreekt:null,tekst:'🙂漢'.repeat(600000)}]}};
  await app.locator('#files').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await app.locator('#applyImport').click();await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Import voltooid'));
  const imported=await app.evaluate(async()=>{const x=await (await import('/core/storage.js')).read();return {rows:x.history.length,n:x.history[0].tekst.length,zero:x.history[0].waarde,nil:x.history[0].ontbreekt,payloadSize:x.payload.length};});assert.deepEqual(imported,{rows:1,n:1800000,zero:0,nil:null,payloadSize:72*1024*1024});
  await app.reload();await app.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));assert.equal(await app.evaluate(async()=>(await (await import('/core/storage.js')).read()).payload.length),72*1024*1024);console.log('Echte import en herladen behouden de werkruimte boven de oude recordgrens.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
