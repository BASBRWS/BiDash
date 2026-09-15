import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installNdwLoader} from '../site/core/ndw-loader.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('NDW loader leest eerst bestaande of lokaal opgeslagen snapshot',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/ndw69Data\(\)\?\.sites\?\.length/);
  assert.match(source,/indexedDB\.open\('bidash-integraal',1\)/);
  assert.match(source,/objectStore\('workspace'\)\.get\('current'\)/);
  assert.match(source,/state\?\.dvm\?\.parameters\?\.kosten\?\.ndw69Snapshot/);
});

test('als lokale NDW data ontbreekt kan een oude BiDash of DVM export gericht worden gelezen',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/accept="\.json,\.html,\.htm"/);
  assert.match(source,/"ndw69Snapshot"/);
  assert.match(source,/const NDW69_DATA/);
  assert.match(source,/file\.slice\(offset,end\)\.text\(\)/);
  assert.match(source,/parseJsonWorker/);
  assert.match(source,/JSON\.parse\(e\.data\)/);
});

test('NDW loader vult spitsuren en 30 procent alleen waar waarden ontbreken',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/local\.uren=6/);
  assert.match(source,/local\.reductie=30/);
  assert.match(source,/spits 07:00–10:00 en 16:00–19:00/);
  assert.match(source,/hasValue\(local\.uren\)/);
  assert.match(source,/hasValue\(local\.reductie\)/);
});

test('NDW loader koppelt meetpunten per wegdeel en toont voortgang',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/ndw69Link\(w\)/);
  assert.match(source,/siteId:link\.s\.id/);
  assert.match(source,/bidashNdwProgressBar/);
  assert.match(source,/Wegdelen koppelen/);
  assert.match(source,/hub:changed/);
});

test('signal forecast activeert de NDW loader',()=>{
  const source=read('site/core/signal-forecast.js');
  assert.match(source,/installNdwLoader\(globalThis\)/);
});

test('browserpatch is inert buiten browser',()=>{
  assert.equal(installNdwLoader(globalThis),false);
});
