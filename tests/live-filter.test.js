import test from 'node:test';
import assert from 'node:assert/strict';
import {
  liveFilterValue,normalizeLiveFilter,liveRowMatchesFilter,filterLiveRows,collectLiveFacetValues,installDvmLiveFilterPatch
} from '../site/core/live-filter.js';

test('standaard live filter laat alle actuele storingen door',()=>{
  const filter=normalizeLiveFilter({});
  assert.equal(filter.actief,true);
  assert.equal(filter.dimensies.type.mode,'all');
  assert.equal(liveRowMatchesFilter({type:'MSI',gevolg:'Rijstrook dicht',noodmaatregel:'Afkruisen',foutcode:'1003'},filter),true);
});

test('include-regels combineren dimensies met EN-logica',()=>{
  const filter=normalizeLiveFilter({dimensies:{
    type:{mode:'include',values:['MSI']},
    gevolg:{mode:'include',values:['Rijstrook dicht']},
    noodmaatregel:{mode:'all'},
    foutcode:{mode:'include',values:['1003']}
  }});
  assert.equal(liveRowMatchesFilter({type:'MSI',gevolg:'Rijstrook dicht',noodmaatregel:'',foutcode:'1003'},filter),true);
  assert.equal(liveRowMatchesFilter({type:'CAM',gevolg:'Rijstrook dicht',noodmaatregel:'',foutcode:'1003'},filter),false);
  assert.equal(liveRowMatchesFilter({type:'MSI',gevolg:'Geen',noodmaatregel:'',foutcode:'1003'},filter),false);
});

test('lege bronwaarden zijn expliciet filterbaar',()=>{
  assert.equal(liveFilterValue('  '),'(leeg)');
  const rows=[{id:1},{id:2},{id:3}];
  const facets=row=>row.id===1?{type:'MSI',gevolg:'',noodmaatregel:'',foutcode:'1003'}:row.id===2?{type:'MSI',gevolg:'Hinder',noodmaatregel:'',foutcode:'1003'}:{type:'CAM',gevolg:'Hinder',noodmaatregel:'Omleiding',foutcode:'2001'};
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

test('browserpatch doet niets in Node',()=>{
  assert.equal(installDvmLiveFilterPatch(globalThis),false);
});
