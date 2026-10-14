import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetRegisterView} from '../site/core/asset-register-view.js';

const fields=[{key:'naam'},{key:'assetFaultCodes'},{key:'openFaults',type:'number'},{key:'status'}];
const assets=[{key:'a',naam:'Camera A',tp:'CAM',weg:'A15',richting:'RE',hm:0,vc:'ZWN'},
 {key:'b',naam:'MSI B',tp:'MSI',weg:'A4',hm:null,vc:'NWN',prognoseActief:false}];
const faults=[{assetKey:'a',code:'1001'},{assetKey:'a',code:'1003'},{assetKey:'a',code:'1001'},{assetKey:'',code:'1003'}];
const api={assets:()=>assets,faults:()=>faults};
const filters={search:'',vc:'',source:'',onlyFaults:false};

test('register bewaart volgorde, bron en nul-HMP; foutcodes horen bij één DVM-asset',async()=>{
 const view=createAssetRegisterView(),data=await view.ensure(api,{assets:()=>[{key:'a',naam:'BI A',assetType:'Werkplek'}]});
 assert.deepEqual(data.rows.map(row=>[row.source,row.key]),[['DVM','a'],['DVM','b'],['BI','a']]);
 assert.equal(data.rows[0].weg,'A15 RE hm 0');assert.equal(data.rows[0].openFaults,3);
 assert.deepEqual(data.rows[0].assetFaultCodes,['1001','1003']);assert.equal(data.faultCount,4);
 assert.equal(data.rows[1].status,'Niet operationeel');assert.equal(data.rows[2].openFaults,0);
 assert.equal(assets[0].openFaults,undefined);
 const query={rules:[{field:'assetFaultCodes',operator:'equals',value:'1001'},
  {join:'and',field:'assetFaultCodes',operator:'equals',value:'1003'}]};
 assert.deepEqual((await view.select(data,filters,query,fields)).map(row=>row.key),['a']);
 assert.deepEqual((await view.select(data,{...filters,onlyFaults:true},{rules:[]},fields)).map(row=>row.key),['a']);
});

test('bladeren en dezelfde filters hergebruiken het register; mutatie ververst ook lege storingen',async()=>{
 let calls=0,currentFaults=faults;
 const view=createAssetRegisterView(),source={assets:()=>{calls++;return assets;},faults:()=>currentFaults};
 const first=await view.ensure(source),selection=await view.select(first,filters,{rules:[]},fields);
 assert.equal(await view.ensure(source),first);assert.equal(calls,1);
 assert.equal(await view.select(first,filters,{rules:[]},fields),selection);
 currentFaults=[];assets[0].weg='N31';view.invalidate();
 const next=await view.ensure(source);assert.notEqual(next,first);assert.equal(calls,2);
 assert.equal(next.rows[0].openFaults,0);assert.equal(next.rows[0].weg,'N31 RE hm 0');
 assert.deepEqual(await view.select(next,{...filters,onlyFaults:true},{rules:[]},fields),[]);
 assert.equal(await view.select(first,filters,{rules:[]},fields),null);
 assets[0].weg='A15';
});

test('groot register geeft de browser tijd; oude bouw en zoekactie worden afgebroken',async()=>{
 let yields=0,release;
 const view=createAssetRegisterView({yieldControl:()=>{yields++;return new Promise(resolve=>{release=resolve;});}});
 const large=Array.from({length:1200},(_,i)=>({key:String(i),naam:'MSI '+i}));
 const pending=view.ensure({assets:()=>large});await Promise.resolve();
 assert.equal(yields,1);view.invalidate();release();assert.equal(await pending,null);
 const small=await view.ensure(api);assert.equal(small.rows.length,2);
 let current=false;
 assert.equal(await view.select(small,filters,{rules:[]},fields,{isCurrent:()=>current}),null);
 const chunked=createAssetRegisterView({yieldControl:async()=>{yields++;}}),data=await chunked.ensure({assets:()=>large});
 const before=yields;current=true;
 const selected=await chunked.select(data,{...filters,search:'1199'},{rules:[]},fields);
 assert.equal(selected.length,1);assert.ok(yields>before);
 current=false;assert.equal(await chunked.select(data,filters,{rules:[]},fields,{isCurrent:()=>current}),null);
});

test('status en speciale filters blijven over de volledige populatie gaan zonder adapterfilter',async()=>{
 const raw=[{key:'m',naam:'MSI',tp:'MSI'}, {key:'n',naam:'MSI buiten dienst',tp:'MSI',prognoseActief:false},
  {key:'w',naam:'DRIP wind',tp:'DRIP',specialWind:true}, {key:'r',naam:'DRIP RIA4',tp:'DRIP',specialRia4:true}];
 const view=createAssetRegisterView(),data=await view.ensure({assets:()=>raw,faults:()=>[{assetKey:'m',typeId:'MSI',code:'1003'}]},
  {assets:()=>[{key:'w',naam:'BI',assetType:'Werkplek',specialWind:true}]});
 const select=extra=>view.select(data,{...filters,...extra},{rules:[]},fields);
 assert.deepEqual((await select({status:'Niet operationeel door storing'})).map(x=>x.key),['m']);
 assert.deepEqual((await select({status:'Niet operationeel'})).map(x=>x.key),['n']);
 assert.deepEqual((await select({wind:true})).map(x=>x.key),['w']);
 assert.deepEqual((await select({wind:true,ria4:true})).map(x=>x.key),['w','r']);
 assert.equal((await select({})).length,5);assert.equal(raw[0].status,undefined);
});
