import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const special=read('site/engines/dvm-special-drip-lists.js');
const faults=read('site/engines/dvm-faults-extension.js');
const manager=read('site/engines/dvm-source-manager.js');

test('speciale DRIP parser accepteert herkenbare asset en DRIP identifiers',()=>{
  for(const alias of ['entity id','asset id','drip code','dynac','cdms','id cdms','os id'])assert.ok(special.includes(`'${alias}'`),alias);
  assert.match(special,/wb\.SheetNames\|\|\[\]/);
  assert.match(special,/sheet_to_json/);
});

test('classificatie wordt los op assets en DRIP areaal gezet',()=>{
  assert.match(special,/kind==='wind'\?'specialWind':'specialRia4'/);
  assert.match(special,/a\[prop\]=set\.size\?hasToken/);
  assert.match(special,/d\[prop\]=set\.size\?hasToken/);
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
  assert.match(manager,/BIDASH_VERSION='2\.9'/);
  assert.match(manager,/DVM_VERSION='78'/);
});
