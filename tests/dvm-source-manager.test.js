import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('site/engines/dvm-source-manager.js');

test('DVM-bronbeheer heeft voor alle zeven bronsoorten een eigen uploadroute',()=>{
  const expected={
    assetregister:['dripInput','leesDripBestand'],
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

test('historieknoppen omzeilen de generieke storingsherkenner',()=>{
  assert.match(source,/storingshistorie:\{input:'autoLogInput'.*handler:'leesStoringsBestanden'/);
  assert.match(source,/dripHistorie:\{input:'dripHistInput'.*handler:'leesDripHistorieBestanden'/);
  assert.doesNotMatch(source,/handler:'laadStoringsBestandenAutomatisch'/);
});

test('bronbeheer blijft ook zonder geladen datasets toegankelijk en toont lege bronkaarten',()=>{
  assert.match(source,/tab==='datasets'\?true/);
  for(const type of ['storingshistorie','dripHistorie','liveStoringen']){
    assert.match(source,new RegExp(`${type}:\\{titel:`));
  }
});

test('DVM-bronbeheer verwijdert de generieke totaalimport uit de primaire beheeracties',()=>{
  assert.match(source,/includes\('totaalImportInput'\)\)button\.remove\(\)/);
  assert.match(source,/Bron-specifiek laden:/);
});

test('adapter laadt de bron-specifieke beheerlaag na de bestaande DVM-adapter',()=>{
  const adapter=read('site/engines/dvm-adapter.js');
  const original=adapter.indexOf('dvm-adapter-original.js');
  const manager=adapter.indexOf('dvm-source-manager.js');
  assert.ok(original>=0&&manager>original);
});
