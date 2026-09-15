import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRAFFIC_SCENARIO_DEFAULTS,installTrafficScenarioDefaults} from '../site/core/traffic-scenario-defaults.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('verkeersscenario gebruikt beide spitsblokken als zes hinderuren',()=>{
  assert.equal(TRAFFIC_SCENARIO_DEFAULTS.amStart,7);
  assert.equal(TRAFFIC_SCENARIO_DEFAULTS.amEnd,10);
  assert.equal(TRAFFIC_SCENARIO_DEFAULTS.pmStart,16);
  assert.equal(TRAFFIC_SCENARIO_DEFAULTS.pmEnd,19);
  assert.equal(TRAFFIC_SCENARIO_DEFAULTS.uren,6);
});

test('generieke snelheidsreductie is 30 procent',()=>{
  assert.equal(TRAFFIC_SCENARIO_DEFAULTS.reductie,30);
});

test('runtimepatch vult alleen ontbrekende scenario-invoer en geeft een bron',()=>{
  const source=read('site/core/traffic-scenario-defaults.js');
  assert.match(source,/c\.uren===''\|\|c\.uren==null/);
  assert.match(source,/c\.reductie===''\|\|c\.reductie==null/);
  assert.match(source,/spits 07:00–10:00 en 16:00–19:00/);
  assert.match(source,/generieke snelheidsreductie 30%/);
});

test('signal forecast activeert verkeersscenario-defaults',()=>{
  const source=read('site/core/signal-forecast.js');
  assert.match(source,/installTrafficScenarioDefaults\(globalThis\)/);
});

test('browserpatch doet niets in Node',()=>{
  assert.equal(installTrafficScenarioDefaults(globalThis),false);
});

test('uitgestelde zware restore behoudt eerder opgeslagen NDW verkeerscontext',()=>{
  const source=read('site/engines/dvm-adapter.js');
  assert.match(source,/bundle\?\.parameters\?\.kosten/);
  assert.match(source,/RULES\.kosten=\{\.\.\.\(RULES\.kosten\|\|\{\}\),\.\.\.kosten\}/);
  assert.match(source,/__BIDASH_DVM_TRAFFIC_RESTORED__/);
  assert.ok(source.indexOf('herstelVerkeerscontext(bundle)')<source.indexOf('return legeSamenvatting()'));
});
