import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('site/engines/dvm-source-manager.js');

test('DVM-bronbeheer heeft voor alle negen bronsoorten een eigen uploadroute',()=>{
  const expected={
    assetregister:['dripInput','leesDripBestand'],
    windDrips:['windDripListInput','special:wind'],
    ria4Drips:['ria4DripListInput','special:ria4'],
    eol:['eolInputTop','leesEolReferentie'],
    storingshistorie:['autoLogInput','leesStoringsBestanden'],
    dripHistorie:['dripHistInput','leesDripHistorieBestanden'],
    uRoutes:['uRouteInput','leesURouteBestand'],
    werkzaamheden:['werkInput','leesWerkBestand'],
    liveStoringen:['liveLogInput','leesLiveStoringsBestanden']
  };
  for(const [type,[input,handler]] of Object.entries(expected)){
    assert.match(source,new RegExp(`${type}:\\{input:'${input}'.*handler:'${handler}'`),type);
  }
});

test('speciale DRIP-lijsten zijn classificatiebronnen en geen storingshistorie',()=>{
  assert.match(source,/Windwaarschuwing DRIP’s laden/);
  assert.match(source,/RIA4 DRIP’s laden/);
  assert.match(source,/window\.loadDripSpecialList\('wind'/);
  assert.match(source,/window\.loadDripSpecialList\('ria4'/);
  assert.match(source,/\['assetregister','dripHistorie'\]\.includes\(type\).*window\.applyDripSpecialLists\(\)/);
});

test('historieknoppen omzeilen de generieke storingsherkenner',()=>{
  assert.match(source,/storingshistorie:\{input:'autoLogInput'.*handler:'leesStoringsBestanden'/);
  assert.match(source,/dripHistorie:\{input:'dripHistInput'.*handler:'leesDripHistorieBestanden'/);
  assert.doesNotMatch(source,/handler:'laadStoringsBestandenAutomatisch'/);
});

test('bronbeheer blijft ook zonder geladen datasets toegankelijk en toont lege bronkaarten',()=>{
  assert.match(source,/tab==='datasets'\?true/);
  for(const type of ['windDrips','ria4Drips','storingshistorie','dripHistorie','liveStoringen'])assert.match(source,new RegExp(`${type}:\\{titel:`));
});

test('DVM-bronbeheer verwijdert de generieke totaalimport uit de primaire beheeracties',()=>{
  assert.match(source,/includes\('totaalImportInput'\)\)button\.remove\(\)/);
  assert.match(source,/Bron-specifiek laden:/);
});

test('adapter laadt classificatielijsten vóór bronbeheer',()=>{
  const adapter=read('site/engines/dvm-adapter.js');
  const original=adapter.indexOf('dvm-adapter-original.js');
  const special=adapter.indexOf('dvm-special-drip-lists.js');
  const manager=adapter.indexOf('dvm-source-manager.js');
  assert.ok(original>=0&&special>original&&manager>special);
});
