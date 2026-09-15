import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterOpenFaults,formatFaultDuration,buildOpenFaultMemo} from '../site/core/open-fault-view.js';

const rows=[
  {naam:'MSI A',typeId:'MSI',vc:'Rhoon',rd:'WNZ',weg:'A15',duurUren:2},
  {naam:'DRIP wind',typeId:'DRIP',vc:'Rhoon',rd:'WNZ',weg:'A15',duurUren:30,wind:true},
  {naam:'DRIP RIA4',typeId:'DRIP',vc:'Midden-Nederland',rd:'MN',weg:'A2',duurUren:50,ria4:true},
  {naam:'DRIP beide',typeId:'DRIP',vc:'Rhoon',rd:'WNZ',weg:'A16',duurUren:10,wind:true,ria4:true}
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

test('duur wordt leesbaar weergegeven',()=>{
  assert.equal(formatFaultDuration(0.5),'30 min');
  assert.equal(formatFaultDuration(2),'2,0 uur');
  assert.equal(formatFaultDuration(30),'1 d 6 u');
});

test('memo bevat beheerder, VC, type en duurstatistiek',()=>{
  const m=buildOpenFaultMemo(rows,{peildatum:'2026-09-15T10:00:00Z'});
  assert.equal(m.total,4);
  assert.equal(m.wind,2);
  assert.equal(m.ria4,2);
  assert.equal(m.oldestDurationHours,50);
  assert.ok(m.byRd.some(([k,n])=>k==='WNZ'&&n===3));
  assert.ok(m.byVc.some(([k,n])=>k==='Rhoon'&&n===3));
});

test('DVM HUB-verrijking voegt type, regionale dienst en open DRIP-historie toe',()=>{
  const src=readFileSync(new URL('../site/engines/dvm-faults-extension.js',import.meta.url),'utf8');
  assert.match(src,/typeId:/);
  assert.match(src,/rd:/);
  assert.match(src,/DRIP_HIST_STATE/);
  assert.match(src,/afgeleidUitHistorie:true/);
  assert.match(src,/ria4/);
  assert.match(src,/wind/);
});

test('Assetmanagement UI injecteert assettype, wind, RIA4 en memo',()=>{
  const src=readFileSync(new URL('../site/core/open-fault-parent-ui.js',import.meta.url),'utf8');
  for(const id of ['faultType','faultWind','faultRia4','faultMemo'])assert.match(src,new RegExp(id));
  assert.match(src,/Memo huidige selectie/);
  assert.match(src,/Regionale beheerders/);
  assert.match(src,/Afdrukken \/ PDF/);
});
