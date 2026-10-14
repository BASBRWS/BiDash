import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {matchDripIncident} from '../site/core/drip-fault-match.js';
import {operationalStatusForFault} from '../site/core/asset-operational-status.js';
const source=readFileSync(new URL('../site/engines/dvm-faults-extension.js',import.meta.url),'utf8');
function runtime(assets,rows,drips=[]){
 const context={ASSET_REGISTER_STATE:{assets},STATE:{peildatum:Date.UTC(2026,0,2)},DRIP_STATE:{drips},console,setTimeout,Date,
  window:{HUB:{faults:()=>rows,detail:()=>({})},__BIDASH_DRIP_FAULT_MATCH__:{matchDripIncident},__BIDASH_ASSET_OPERATIONAL_STATUS__:{operationalStatusForFault}}};
 vm.runInNewContext(source,context);return context;
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('verrijking bouwt één sleutelindex per leesactie, niet één registerscan per storing',()=>{
 let keyReads=0;
 const assets=Array.from({length:2000},(_,i)=>({get key(){keyReads++;return 'test:'+i;},naam:'MSI '+i,tp:'MSI',weg:'A15',vc:'ZWN',prognoseActief:true}));
 const rows=Array.from({length:1000},(_,i)=>({assetKey:'test:'+(1000+i),typeId:'MSI',code:'1003',duurUren:0,impact:null,naam:'MSI '+(1000+i)}));
 const c=runtime(assets,rows),out=c.window.HUB.faults();assert.equal(out.length,1000);assert.equal(out[0].operationeleStatus,'Niet operationeel door storing');
 assert.ok(keyReads<=assets.length*2,'assetidentiteit wordt niet N×M opnieuw gelezen');assert.equal(out[0].duurUren,0);assert.equal(out[0].impact,null);
 assert.equal(rows[0].operationeleStatus,undefined,'de bronmelding blijft intact');
});
test('asynchrone verrijking levert exact dezelfde meldingen en kan oud werk afbreken',async()=>{
 const assets=Array.from({length:700},(_,i)=>({key:String(i),tp:'MSI',status:i===0?'Niet operationeel':'Operationeel',prognoseActief:i!==0}));
 const rows=Array.from({length:300},(_,i)=>({assetKey:String(i),typeId:'MSI',code:'1003',start:Date.UTC(2026,0,1),duurUren:i===0?null:i,impact:i===0?null:50}));
 const c=runtime(assets,rows),sync=c.window.HUB.faults(),asyncRows=await c.window.HUB.faultsAsync();
 assert.deepEqual(plain(asyncRows),plain(sync));assert.equal(asyncRows[0].operationeleStatus,'Niet operationeel');
 let current=true;const pending=c.window.HUB.faultsAsync({isCurrent:()=>current});current=false;assert.equal(await pending,null);
});
test('DRIP-conflict, locatie, speciale vlaggen en eerste sleutel blijven behouden',async()=>{
 const assets=[{key:'D',tp:'DRIP',naam:'DRIP D501',weg:'A15',richting:'RE',hm:1,specialWind:true},
  {key:'D',tp:'DRIP',naam:'Dubbele registratie',weg:'A99',hm:99},
  {key:'M',tp:'MSI',prognoseActief:false}];
 const rows=[{assetKey:'D',naam:'DRIP D501',typeId:'DRIP',code:'D501',duurUren:null,impact:null,afgeleidUitHistorie:true},
  {assetKey:'',naam:'DRIP D501',typeId:'DRIP',code:'D501',weg:'A99',richting:'RE',hm:1,assetMatchStatus:'locatieconflict'},
  {assetKey:'M',typeId:'MSI',code:'1003'}];
 const c=runtime(assets,rows);const out=await c.window.HUB.faultsAsync();
 assert.equal(out[0].wind,true);assert.equal(out[0].weg,'A15');assert.equal(out[0].duurUren,null);assert.equal(out[0].impact,null);
 assert.equal(out[1].assetKey,'');assert.equal(out[1].weg,'A99');assert.equal(out[2].operationeleStatus,'Niet operationeel');
 assert.equal(c.window.HUB.detail('D').asset,assets[0]);
});
