import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clampProgress,overallReadPercent,progressBarPercent} from '../site/core/load-progress.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('bestandsvoortgang wordt over meerdere bytes correct geaggregeerd',()=>{
  assert.equal(overallReadPercent(1000,200,300),50);
  assert.equal(overallReadPercent(1000,900,300),100);
  assert.equal(overallReadPercent(0,0,0),null);
  assert.equal(progressBarPercent(50),41.5);
});

test('voortgangspercentages worden begrensd',()=>{
  assert.equal(clampProgress(-20),0);
  assert.equal(clampProgress(125),100);
  assert.equal(clampProgress('x'),null);
  assert.equal(clampProgress(null),null);
});

test('hoofdapp leest bestanden met echte FileReader voortgang en laat voor zware parse eerst schilderen',()=>{
  const source=read('site/core/load-progress.js');
  assert.match(source,/scope\.File\.prototype\.text=function/);
  assert.match(source,/reader\.onprogress/);
  assert.match(source,/requestAnimationFrame/);
  assert.match(source,/Bestand gelezen · inhoud controleren/);
  assert.match(source,/hub:import-progress/);
  assert.match(source,/applyImport/);
});

test('voortgangsmodule start vóór de hoofdapp en DVM meldt bronfasen aan de schil',()=>{
  const routes=read('site/ui/routes.js');
  const forecast=read('site/core/signal-forecast.js');
  const bridge=read('site/core/import-progress-bridge.js');
  assert.match(routes,/import '\.\.\/core\/load-progress\.js';/);
  assert.match(forecast,/installDvmImportProgressBridge\(globalThis\)/);
  assert.match(bridge,/scope\.zetImportVoortgang=function/);
  assert.match(bridge,/type:'hub:import-progress'/);
  assert.match(bridge,/active:o\.actief!==false/);
});
