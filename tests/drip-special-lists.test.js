import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const special=read('site/engines/dvm-special-drip-lists.js');
const faults=read('site/engines/dvm-faults-extension.js');
const manager=read('site/engines/dvm-source-manager.js');

function helpers(){
  const window={};window.window=window;
  vm.runInNewContext(special,{window,console,setTimeout,clearTimeout});
  return window.__BIDASH_SPECIAL_DRIP_CLASSIFICATION__;
}

test('speciale DRIP parser accepteert herkenbare asset en DRIP identifiers',()=>{
  for(const alias of ['entity id','asset id','drip code','dynac','cdms','id cdms','os id'])assert.ok(special.includes(`'${alias}'`),alias);
  assert.match(special,/wb\.SheetNames\|\|\[\]/);
  assert.match(special,/sheet_to_json/);
});

test('classificatie wordt los op assets en DRIP areaal gezet',()=>{
  assert.match(special,/kind==='wind'\?'specialWind':'specialRia4'/);
  assert.match(special,/a\[prop\]=intrinsic\(a\)\|\|match\(a\)/);
  assert.match(special,/d\[prop\]=intrinsic\(d\)\|\|match\(d\)/);
  assert.match(special,/recordIndex\(records\)/);
});

test('gecombineerde bron wordt per RIA4- en windmarkering gesplitst',()=>{
  const h=helpers(),rows=[
    {'DRIP (Dynac)':'NWN DRI DRIP A8L 4,395 DRIP 080',RIA4:'x',Windwaarschuwing:''},
    {'DRIP (Dynac)':'ZWN DRI DRIP A15R 48,690 DRIP 080',RIA4:'',Windwaarschuwing:'x'},
    {'DRIP (Dynac)':'NON DRI DRIP A50R 166,850 DRIP 080',RIA4:'x',Windwaarschuwing:'x'}
  ];
  const split=h.classifiedRows(rows,'ria4');
  assert.equal(split.explicit,true);
  assert.equal(split.hasWind,true);
  assert.equal(split.hasRia4,true);
  assert.equal(split.ria4.length,2);
  assert.equal(split.wind.length,2);
});

test('bestand met alleen RIA4-kolom wist een bestaande windbron niet',()=>{
  const h=helpers(),split=h.classifiedRows([{'DRIP (CDMS)':'D1',RIA4:'x'}],'ria4');
  assert.equal(split.hasRia4,true);
  assert.equal(split.hasWind,false);
  assert.equal(split.ria4.length,1);
  assert.equal(split.wind.length,0);
});

test('dezelfde DRIP-code in een andere regio en locatie wordt niet meegeclassificeerd',()=>{
  const h=helpers(),record=h.recordForRow({'DRIP (CDMS)':'D80',VC:'NWN',Weg:'A8',Richting:'LI',hm:'4,395'});
  assert.equal(h.matchesRecord({code:'D80',vc:'NWN',weg:'A8',richting:'LI',hm:4.395},record),true);
  assert.equal(h.matchesRecord({code:'D80',vc:'ZWN',weg:'A15',richting:'RE',hm:48.69},record),false);
});

test('speciale DRIP bronnen worden met de DVM export bewaard',()=>{
  assert.match(special,/bundle\.parameters\.dripSpecialLists=exportState\(\)/);
  const adapter=read('site/engines/dvm-adapter.js');
  assert.match(adapter,/bundle\?\.parameters\?\.dripSpecialLists/);
  assert.match(adapter,/restoreDripSpecialLists/);
});

test('open storingen gebruikt zowel assetmarkering als referentielijst',()=>{
  assert.match(faults,/yes\(x\.specialWind\)/);
  assert.match(faults,/yes\(x\.specialRia4\)/);
  assert.match(faults,/specialListMatch\('wind'/);
  assert.match(faults,/specialListMatch\('ria4'/);
});

test('zichtbare versie is verhoogd',()=>{
  assert.match(read('site/core/versie.js'),/BIDASH_VERSIE='2\.20'/);
  assert.match(manager,/DVM_VERSION='103'/);
});
