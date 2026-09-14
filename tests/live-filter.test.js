import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_FILTER_DIMENSIONS,liveFilterValue,normalizeLiveFilter,liveRowMatchesFilter,filterLiveRows,collectLiveFacetValues,installDvmLiveFilterPatch
} from '../site/core/live-filter.js';
import {diffSnapshot} from '../site/core/live-snapshot.js';

test('standaard live filter laat alle actuele storingen door',()=>{
  const filter=normalizeLiveFilter({});
  assert.equal(filter.actief,true);
  assert.deepEqual(LIVE_FILTER_DIMENSIONS,['type','melding','gevolg','noodmaatregel','foutcode']);
  assert.equal(filter.dimensies.type.mode,'all');
  assert.equal(liveRowMatchesFilter({type:'MSI',melding:'Fatale fout',gevolg:'Rijstrook dicht',noodmaatregel:'Afkruisen',foutcode:'1003'},filter),true);
});

test('include-regels combineren dimensies met EN-logica',()=>{
  const filter=normalizeLiveFilter({dimensies:{
    type:{mode:'include',values:['MSI']},
    melding:{mode:'include',values:['Fatale fout']},
    gevolg:{mode:'include',values:['Rijstrook dicht']},
    noodmaatregel:{mode:'all'},
    foutcode:{mode:'include',values:['1003']}
  }});
  assert.equal(liveRowMatchesFilter({type:'MSI',melding:'Fatale fout',gevolg:'Rijstrook dicht',noodmaatregel:'',foutcode:'1003'},filter),true);
  assert.equal(liveRowMatchesFilter({type:'CAM',melding:'Fatale fout',gevolg:'Rijstrook dicht',noodmaatregel:'',foutcode:'1003'},filter),false);
  assert.equal(liveRowMatchesFilter({type:'MSI',melding:'Fatale fout',gevolg:'Geen',noodmaatregel:'',foutcode:'1003'},filter),false);
  assert.equal(liveRowMatchesFilter({type:'MSI',melding:'Lampcircuit',gevolg:'Rijstrook dicht',noodmaatregel:'',foutcode:'1003'},filter),false);
});

test('lege bronwaarden zijn expliciet filterbaar',()=>{
  assert.equal(liveFilterValue('  '),'(leeg)');
  const rows=[{id:1},{id:2},{id:3}];
  const facets=row=>row.id===1?{type:'MSI',melding:'A',gevolg:'',noodmaatregel:'',foutcode:'1003'}:row.id===2?{type:'MSI',melding:'B',gevolg:'Hinder',noodmaatregel:'',foutcode:'1003'}:{type:'CAM',melding:'C',gevolg:'Hinder',noodmaatregel:'Omleiding',foutcode:'2001'};
  const values=collectLiveFacetValues(rows,facets);
  assert.deepEqual(values.gevolg.map(x=>x.value),['Hinder','(leeg)']);
  const filter=normalizeLiveFilter({dimensies:{gevolg:{mode:'include',values:['(leeg)']}}});
  assert.deepEqual(filterLiveRows(rows,facets,filter).map(x=>x.id),[1]);
});

test('uitgeschakeld filter bewaart selectie maar telt alles mee',()=>{
  const rows=[{type:'MSI'},{type:'CAM'}];
  const filter=normalizeLiveFilter({actief:false,dimensies:{type:{mode:'include',values:['MSI']}}});
  assert.equal(filterLiveRows(rows,x=>x,filter).length,2);
  assert.deepEqual(filter.dimensies.type.values,['MSI']);
});

test('telregels wijzigen de ruwe momentopname en A-B vergelijking niet',()=>{
  const oldRows=[{id:'A',type:'MSI'},{id:'B',type:'CAM'}];
  const newRows=[{id:'A',type:'MSI'}];
  const filter=normalizeLiveFilter({dimensies:{type:{mode:'include',values:['MSI']}}});
  const filtered=filterLiveRows(oldRows,x=>x,filter);
  assert.deepEqual(filtered.map(x=>x.id),['A']);
  assert.deepEqual(oldRows.map(x=>x.id),['A','B']);
  assert.deepEqual(diffSnapshot(oldRows,newRows,x=>x.id).map(x=>x.id),['B']);
});

test('browserpatch doet niets in Node',()=>{
  assert.equal(installDvmLiveFilterPatch(globalThis),false);
});
