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
  assert.match(source,/accept="\.xml,\.gz,\.json,\.html,\.htm"/);
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


test('NDW loader exposeert directe file-handlers voor één of twee bronbestanden',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/globalThis\.bidashLaadNdwFiles=async function\(files\)/);
  assert.match(source,/globalThis\.bidashLaadNdwFile=async function\(file\)/);
  assert.match(source,/bidashLaadNdwFiles\(file\?\[file\]:\[\]\)/);
  assert.match(source,/multiple style="display:none"/);
});


test('NDW loader accepteert het actuele gecombineerde DATEX II v3 bronbestand',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/snapshotFromRawNdw/);
  assert.match(source,/ndwXmlSnapshot/);
  assert.match(source,/physicalQuantity/);
  assert.match(source,/measurementSite/);
  assert.match(source,/vehicleFlowRate/);
  assert.match(source,/snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties\.xml\.gz/);
});


test('NDW v3 configuratie zonder meetwaarden geeft gerichte fout',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/NDW-configuratiebestand herkend/);
  assert.match(source,/snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties\.xml\.gz/);
  assert.match(source,/bytes\[0\]===0x1f/);
  assert.match(source,/ndwMonibasLocation/);
  assert.match(source,/ndwWgs84ToRd/);
  assert.match(source,/ndwAssetGrid/);
});


test('NDW DATEX II v2.3 combineert measurement_current en trafficspeed',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/snapshotFromV23Pair/);
  assert.match(source,/measurement_current/);
  assert.match(source,/trafficspeed/);
  assert.match(source,/ndwConfigUitDoc/);
  assert.match(source,/ndwMetingenUitDoc/);
  assert.match(source,/vehicleFlowRate/);
  assert.match(source,/speedSites/);
  assert.match(source,/NDW DATEX II v2\.3: trafficspeed \+ measurement_current/);
});

test('één los v2.3 bestand geeft een gerichte melding dat beide nodig zijn',()=>{
  const source=read('site/core/ndw-loader.js');
  assert.match(source,/moet je measurement_current\.xml\.gz en trafficspeed\.xml\.gz tegelijk selecteren/);
  assert.match(source,/Selecteer voor NDW DATEX II v2\.3 beide bestanden tegelijk/);
});
