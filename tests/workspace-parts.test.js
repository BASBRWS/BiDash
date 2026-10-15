import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceParts,workspaceDecoder,storageSize,WORKSPACE_PART_BYTES} from '../site/core/workspace-parts.js';
function roundtrip(value,budget=4096){const decoder=workspaceDecoder(),parts=[],g=workspaceParts(value,{budget});let x=g.next();while(!x.done){const part=structuredClone(x.value);parts.push(part);decoder.add(part);x=g.next();}return {value:decoder.finish(structuredClone(x.value)),parts,root:x.value};}

test('opslag behoudt null, nul, ontbrekende waarden, Unicode, grote teksten en bronrijen',()=>{
 const rows=Array.from({length:150},(_,i)=>({id:i,hm:i===0?0:null,tekst:'漢🙂ë'.repeat(90)}));
 const input={schema:1,dvm:{assetregister:{rijen:rows},parameters:{cfg:{norm:0}},liveStoringen:[]},planning:{xml:'<Project>漢🙂</Project>'.repeat(2000)},nil:null,no:false,empty:'',missing:undefined,nan:NaN,infinite:Infinity};
 const result=roundtrip(input);assert.ok(result.parts.length>10);assert.deepEqual(result.value,input);assert.ok(Object.hasOwn(result.value,'missing'));
 for(const part of result.parts)assert.ok(storageSize(part,10000)<=4096,'Een opslagdeel blijft begrensd');
});
test('kleine oude werkruimtewaarden houden hun typen en lege structuren',()=>{
 const a=new Array(20);a[5]=0;a.tag='extra';
 const obj={arr:a,date:new Date('2026-10-15'),map:new Map([['x',null]]),set:new Set([0]),bytes:new Uint8Array([0,1,255])};
 assert.deepEqual(roundtrip(obj).value,obj);assert.deepEqual(roundtrip(null).value,null);assert.equal(roundtrip(undefined).value,undefined);
});
test('geneste grote arrays, objecten en strings worden teruggebouwd zonder JSON-coercie',()=>{
 const obj=Object.create(null);for(let i=0;i<300;i++)obj['veld'+i]={a:['x'.repeat(500),i]};
 const value=roundtrip({obj,list:Array.from({length:100},()=>obj)}).value;assert.equal(Object.getPrototypeOf(value.obj),null);assert.deepEqual(value.obj,obj);assert.deepEqual(value.list[99],obj);
});
test('een zeer lange veldnaam en tekstfragmenten midden in een surrogate pair blijven gelijk',()=>{
 const key='🙂'.repeat(1000),value={[key]:'🙂'.repeat(3000)};assert.deepEqual(roundtrip(value).value,value);
});
test('ontbrekende delen geven een fout, geen stille gedeeltelijke werkruimte',()=>{
 const result=roundtrip('text'.repeat(5000)),decoder=workspaceDecoder();
 for(const p of result.parts.slice(0,-1))decoder.add(p);assert.throws(()=>decoder.finish(result.root),/onvolledig/);
 const bad=workspaceDecoder();assert.throws(()=>bad.finish({ref:999}),/onvolledig/);
});
test('de standaard blokgrens is ruim kleiner dan de gemelde browsergrens',()=>{
 assert.equal(WORKSPACE_PART_BYTES,4*1024*1024);const big={rijen:Array.from({length:20000},(_,i)=>({id:i,tekst:'a'.repeat(100)}))};const x=roundtrip(big,WORKSPACE_PART_BYTES);assert.ok(x.parts.length>1);assert.deepEqual(x.value,big);
});
