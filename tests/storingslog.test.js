import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../site/core/storingslog.js',import.meta.url),'utf8');
function browser({storage=new Map(),parent,blocked=false}={}){
 const events={},docEvents={},original=[];
 const scope={location:{pathname:'/index.html',origin:'http://local'},navigator:{userAgent:'test',language:'nl',onLine:true},innerWidth:1200,innerHeight:800,
  console:{warn(...args){original.push(args);},error(...args){original.push(args);}},
  sessionStorage:{getItem:k=>storage.get(k),setItem(k,v){if(blocked)throw Error('quota');storage.set(k,v);}},
  setTimeout:()=>1,setInterval:()=>1,URL,Error,addEventListener(k,fn){(events[k]??=[]).push(fn);},
  document:{visibilityState:'visible',addEventListener(k,fn){(docEvents[k]??=[]).push(fn);},querySelectorAll:()=>[],getElementById:()=>null}};
 scope.window=scope;scope.parent=parent||scope;vm.runInNewContext(code,scope);
 return {scope,log:scope.BIDASH_DIAGNOSTICS,original,emit:(name,event)=>(events[name]||[]).forEach(f=>f(event)),change:event=>(docEvents.change||[]).forEach(f=>f(event))};
}
test('fouten, stacks en beloften, console blijft werken en bronobjecten blijven buiten het log',()=>{
 const b=browser();b.scope.console.error('testfout',new Error('oorzaak'),{operationeleBron:'VERBODEN_BRON'});
 b.emit('unhandledrejection',{reason:new Error('promise fout')});
 b.emit('error',{target:null,message:'event fout',filename:'https://host/app.js?token=PRIVATE',lineno:12,error:new Error('stack')});
 const report=b.log.report(),text=JSON.stringify(report);
 assert.equal(b.original.length,1);assert.match(text,/oorzaak/);assert.match(text,/promise fout/);assert.match(text,/javascript.error/);assert.match(text,/stack/);
 assert.doesNotMatch(text,/VERBODEN_BRON|PRIVATE/);
});
test('600 regels en vaste tekenbegroting, herhaling wordt samengevoegd',()=>{
 const {log}=browser();for(let i=0;i<5000;i++)log.record('warn','event'+i,{message:'x'.repeat(2400)});
 let r=log.report();assert(r.entries.length<=600);assert(JSON.stringify(r.entries).length<=500000);assert(r.retention.dropped>0);
 log.record('error','zelfde',{id:1});log.record('error','zelfde',{id:1});r=log.report();assert.equal(r.entries.at(-1).count,2);
});
test('herladen bewaart stappen en onderscheidt sessies, wissen verwijdert eerdere stappen',()=>{
 const storage=new Map(),b=browser({storage});b.log.record('error','voor reload');b.log.flush();
 const next=browser({storage});assert(next.log.report().entries.some(e=>e.event==='voor reload'));
 assert.notEqual(next.log.report().session,b.log.report().session);
 next.log.clear();assert(!next.log.report().entries.some(e=>e.event==='voor reload'));
});
test('modulefouten komen eenmalig bij de ouder, ook zonder eigen moduleopslag',()=>{
 const parent=browser(),child=browser({parent:parent.scope,blocked:true});child.scope.console.warn('kindfout');child.emit('pagehide',{});
 assert.equal(parent.log.report().entries.filter(e=>e.event==='console.warn').length,1);
 assert.equal(child.original.length,1);
});
test('opslagfout onderbreekt loggen niet, export blijft beschikbaar',()=>{
 const b=browser({blocked:true});b.log.record('error','quota');b.log.flush();
 assert.match(b.log.report().retention.persistence,/geheugen/);assert(b.log.report().entries.some(e=>e.event==='quota'));
});
test('bestandsselectie bevat metadata zonder mappaden of inhoud',()=>{
 const b=browser();b.change({target:{type:'file',id:'files',files:[{name:'test.json',size:123,webkitRelativePath:'PRIVATE/test.json',content:'VERBODEN_BRON'}]}});
 const text=JSON.stringify(b.log.report());assert.match(text,/test.json/);assert.match(text,/123/);assert.doesNotMatch(text,/PRIVATE|VERBODEN_BRON/);
});
test('tokens, URL-parameters en lokale paden worden afgeschermd',()=>{
 const b=browser();b.log.record('error','privacy',{message:'https://user:password@host/test?token=PRIVATE#PRIVATE Bearer secrettoken password=secret C:\\Users\\sebas\\file.json /home/sebas/file.json'});
 const text=JSON.stringify(b.log.report());assert.doesNotMatch(text,/PRIVATE|secrettoken|password@|password=secret|sebas/);
});
