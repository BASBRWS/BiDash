import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  EMPTY_FILTER_VALUE,LIVE_FILTER_FIELDS,liveFilterValueKey,normalizeLiveOverviewFilter,
  liveFilterActiveCount,liveFilterSignature,rowMatchesLiveOverviewFilter,
  collectLiveFilterFacets,summarizeLiveOverviewFilter
} from '../site/core/live-overview-filter.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('standaardfilter laat iedere nieuwe storingswaarde meetellen',()=>{
  const config=normalizeLiveOverviewFilter();
  assert.equal(liveFilterActiveCount(config),0);
  assert.equal(rowMatchesLiveOverviewFilter({storingType:'Fatale fout',gevolg:'Geen signalering'},config),true);
  assert.equal(rowMatchesLiveOverviewFilter({storingType:'Een later onbekend type'},config),true);
});

test('uitsluitingen werken als OF binnen een facet en EN over facetten',()=>{
  const config=normalizeLiveOverviewFilter({excluded:{
    storingType:['Lampcircuit'],
    gevolg:['Geen beeld'],
    vc:['VC Midden-Nederland']
  }});
  assert.equal(rowMatchesLiveOverviewFilter({storingType:'Lampcircuit',gevolg:'Beperkt',vc:'VC Noord-Oost'},config),false);
  assert.equal(rowMatchesLiveOverviewFilter({storingType:'Fatale fout',gevolg:'Geen beeld',vc:'VC Noord-Oost'},config),false);
  assert.equal(rowMatchesLiveOverviewFilter({storingType:'Fatale fout',gevolg:'Beperkt',vc:'VC Midden-Nederland'},config),false);
  assert.equal(rowMatchesLiveOverviewFilter({storingType:'Fatale fout',gevolg:'Beperkt',vc:'VC Noord-Oost'},config),true);
});

test('lege waarden zijn bewust filterbaar',()=>{
  const config=normalizeLiveOverviewFilter({excluded:{noodmaatregel:[EMPTY_FILTER_VALUE]}});
  assert.equal(liveFilterValueKey('   '),EMPTY_FILTER_VALUE);
  assert.equal(rowMatchesLiveOverviewFilter({noodmaatregel:''},config),false);
  assert.equal(rowMatchesLiveOverviewFilter({noodmaatregel:'Omleiding'},config),true);
});

test('facetwaarden worden hoofdletter- en accentongevoelig samengevoegd',()=>{
  const facets=collectLiveFilterFacets([
    {assetType:'MSI',gevolg:'Vertraging'},
    {assetType:'msi',gevolg:'vertraging'},
    {assetType:'CÁM',gevolg:''},
    {assetType:'cam',gevolg:null}
  ]);
  assert.deepEqual(facets.assetType.map(x=>[x.key,x.count]),[['CAM',2],['MSI',2]]);
  assert.equal(facets.gevolg.find(x=>x.key==='VERTRAGING').count,2);
  assert.equal(facets.gevolg.find(x=>x.key===EMPTY_FILTER_VALUE).count,2);
});

test('samenvatting telt bron, meegeteld en uitgesloten zonder de bron te wijzigen',()=>{
  const rows=[
    {storingType:'A',vc:'Noord'},
    {storingType:'B',vc:'Noord'},
    {storingType:'C',vc:'Zuid'}
  ];
  const before=structuredClone(rows);
  const summary=summarizeLiveOverviewFilter(rows,{excluded:{vc:['Zuid']}});
  assert.deepEqual(summary,{total:3,included:2,excluded:1,active:1});
  assert.deepEqual(rows,before);
});

test('filterconfig is beperkt tot bekende facetten en heeft stabiele signatuur',()=>{
  const a=normalizeLiveOverviewFilter({excluded:{gevolg:[' B ','a','A'],onbekend:['x']}});
  const b=normalizeLiveOverviewFilter({excluded:{gevolg:['A','B']}});
  assert.deepEqual(Object.keys(a.excluded),LIVE_FILTER_FIELDS.map(x=>x.key));
  assert.deepEqual(a.excluded.gevolg,['A','B']);
  assert.equal(liveFilterSignature(a),liveFilterSignature(b));
});

test('browserpatch filtert alleen de actuele doorrekening en laat snapshotbron intact',()=>{
  const source=read('site/core/live-overview-filter.js');
  const forecast=read('site/core/signal-forecast.js');
  assert.match(source,/if\(!opties\|\|!opties\.actueel\)return originalDoorrekenen/);
  assert.match(source,/const filtered=source\.filter/);
  assert.match(source,/RULES\.cfg\.liveOverviewFilter/);
  assert.doesNotMatch(source,/gecombineerdeLiveStoringsRijen\s*=\s*function/);
  assert.match(source,/A↔B-vergelijking en automatische historisering/);
  assert.match(forecast,/installDvmLiveSnapshotPatch\(globalThis\);\s*installDvmLiveOverviewFilterPatch\(globalThis\);/s);
});

test('filter reist mee met bestaande DVM parameterexport en -import',()=>{
  const dvm3=read('site/engines/dvm-3.js');
  assert.match(dvm3,/cfg:RULES\.cfg/);
  assert.match(dvm3,/RULES\.cfg=\{\.\.\.RULES\.cfg,\.\.\.b\.cfg\}/);
});
