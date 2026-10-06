import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';

test('DRIP-historie uit oudere export zonder afgeleide arrays wordt hersteld',()=>{
  const c=dvmRuntime();
  c.oudeBronnen=[{
    key:'legacy-drip',
    name:'legacy-drip.json',
    incidenten:[{
      asset:'D501',code:'D501',vc:'NWN',weg:'A1',richting:'LI',hm:4,
      start:Date.UTC(2026,0,1),einde:Date.UTC(2026,0,2),duurUren:24,
      duurBetrouwbaar:true,censored:false,hardUit:true
    }]
  }];
  vm.runInContext("DRIP_STATE={drips:[]};DRIP_HIST_STATE={sources:oudeBronnen};herbouwDripHistorie();",c);
  const hist=vm.runInContext('DRIP_HIST_STATE',c);
  assert.equal(hist.incidenten.length,1);
  assert.deepEqual(Array.from(hist.sources[0].assetCodes),['D501']);
  assert.ok(hist.sources[0].dekkingDatums.length>=1);
  assert.equal(hist.koppeling.nietGekoppeldeIncidenten,1);
});
