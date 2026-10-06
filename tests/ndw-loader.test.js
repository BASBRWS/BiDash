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

test('als lokale NDW data ontbreekt kan een oude dashboard- of DVM-export gericht worden gelezen',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/accept="\.json,\.html,\.htm"/);
  assert.match(source,/"ndw69Snapshot"/);
  assert.match(source,/const NDW69_DATA/);
  assert.match(source,/file\.slice\(offset,end\)\.text\(\)/);
  assert.match(source,/parseJsonWorker/);
  assert.match(source,/JSON\.parse\(e\.data\)/);
  assert.match(source,/bidashKiesNdwBestand/);
  assert.match(source,/id="bidashNdwChooseButton"/);
  assert.match(source,/input\.click\(\)/);
  assert.doesNotMatch(source,/Geen lokale NDW-set gevonden[\s\S]{0,400}input\.click\(\)/);
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


test('NDW loader maakt verschil tussen gemeten intensiteit en scenarioaannames zichtbaar',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/NDW levert het voertuigaantal/);
  assert.match(source,/6 hinderuren en 30% snelheidsreductie zijn scenarioaannames/);
  assert.match(source,/andere bron dan de NDW CMDB-import/);
});


test('NDW loader exposeert een directe file-handler voor DVM bronbeheer',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/globalThis\.bidashLaadNdwFile=async function\(file\)/);
  assert.match(source,/await globalThis\.bidashLaadNdwFile\(file\)/);
});
