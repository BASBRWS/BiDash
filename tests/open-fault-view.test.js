import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterOpenFaults,formatFaultDuration,buildOpenFaultMemo} from '../site/core/open-fault-view.js';

const rows=[
  {naam:'MSI A',typeId:'MSI',vc:'Rhoon',rd:'WNZ',weg:'A15',duurUren:2,operationeleStatus:'Niet operationeel door storing',code:'1003'},
  {naam:'DRIP wind',typeId:'DRIP',vc:'Rhoon',rd:'WNZ',weg:'A15',duurUren:30,wind:true,operationeleStatus:'Niet operationeel door storing'},
  {naam:'DRIP RIA4',typeId:'DRIP',vc:'Midden-Nederland',rd:'MN',weg:'A2',duurUren:50,ria4:true,operationeleStatus:'Niet operationeel door storing'},
  {naam:'DRIP beide',typeId:'DRIP',vc:'Rhoon',rd:'WNZ',weg:'A16',duurUren:10,wind:true,ria4:true,operationeleStatus:'Operationeel'}
];

test('filter op assettype werkt los van zoek- en VC-filter',()=>{
  assert.equal(filterOpenFaults(rows,{type:'DRIP'}).length,3);
  assert.deepEqual(filterOpenFaults(rows,{type:'MSI'}).map(x=>x.naam),['MSI A']);
});

test('wind- en RIA4-vinkboxen werken als losse speciale DRIP-selecties en samen als OF',()=>{
  assert.deepEqual(filterOpenFaults(rows,{wind:true}).map(x=>x.naam),['DRIP wind','DRIP beide']);
  assert.deepEqual(filterOpenFaults(rows,{ria4:true}).map(x=>x.naam),['DRIP RIA4','DRIP beide']);
  assert.equal(filterOpenFaults(rows,{wind:true,ria4:true}).length,3);
});

test('operationele status is als derde toestand filterbaar',()=>{
  assert.deepEqual(filterOpenFaults(rows,{status:'Niet operationeel door storing'}).map(x=>x.naam),['MSI A','DRIP wind','DRIP RIA4']);
  assert.deepEqual(filterOpenFaults(rows,{status:'Operationeel'}).map(x=>x.naam),['DRIP beide']);
});

test('duur wordt leesbaar weergegeven',()=>{
  assert.equal(formatFaultDuration(0.5),'30 min');
  assert.equal(formatFaultDuration(2),'2,0 uur');
  assert.equal(formatFaultDuration(30),'1 d 6 u');
});

test('memo bevat beheerder, VC, type, status en duurstatistiek',()=>{
  const m=buildOpenFaultMemo(rows,{peildatum:'2026-09-15T10:00:00Z'});
  assert.equal(m.total,4);
  assert.equal(m.wind,2);
  assert.equal(m.ria4,2);
  assert.equal(m.oldestDurationHours,50);
  assert.ok(m.byRd.some(([k,n])=>k==='WNZ'&&n===3));
  assert.ok(m.byVc.some(([k,n])=>k==='Rhoon'&&n===3));
  assert.ok(m.byStatus.some(([k,n])=>k==='Niet operationeel door storing'&&n===3));
});

test('DVM HUB verrijkt uitsluitend de gezamenlijke meldingen zonder historie opnieuw toe te voegen',()=>{
  const src=readFileSync(new URL('../site/engines/dvm-faults-extension.js',import.meta.url),'utf8');
  assert.match(src,/typeId/);
  assert.match(src,/rd:/);
  assert.doesNotMatch(src,/DRIP_HIST_STATE/);
  assert.match(src,/baseFaults\(\)\.map\(enrichBase\)/);
  assert.match(src,/operationeleStatus/);
  assert.match(src,/resolveDrip/);
  assert.match(src,/ria4/);
  assert.match(src,/wind/);
});

test('Assetmanagement UI injecteert assettype, status, wind, RIA4 en memo',()=>{
  const src=readFileSync(new URL('../site/core/open-fault-parent-ui.js',import.meta.url),'utf8');
  for(const id of ['faultType','faultOperationalStatus','faultWind','faultRia4','faultMemo'])assert.match(src,new RegExp(id));
  assert.match(src,/Memo huidige selectie/);
  assert.match(src,/Regionale beheerders/);
  assert.match(src,/Operationele status/);
  assert.match(src,/Afdrukken \/ PDF/);
});
