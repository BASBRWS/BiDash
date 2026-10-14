import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveIncidentKey,diffSnapshot,closeHistoryRow,useTargetedLiveXlsx,installDvmLiveSnapshotPatch} from '../site/core/live-snapshot.js';

const source=readFileSync(new URL('../site/core/live-snapshot.js',import.meta.url),'utf8');
const forecastSource=readFileSync(new URL('../site/core/signal-forecast.js',import.meta.url),'utf8');

test('liveIncidentKey blijft stabiel tussen momentopnamen',()=>{
  const a=liveIncidentKey({typeId:'MSI',assetId:'A1 Li 6.685 1',start:1000,road:'A1',direction:'LI',hm:6.685,lane:'1',faultCode:'1003',message:'Fatale fout'});
  const b=liveIncidentKey({typeId:'MSI',assetId:'A1 Li 6.685 1',start:1000,road:'A1',direction:'LI',hm:6.685,lane:'1',faultCode:'1003',message:'Fatale fout'});
  assert.equal(a,b);
});

test('event-id heeft voorrang als stabiele identiteit',()=>{
  assert.equal(liveIncidentKey({eventId:' INC-42 ',assetId:'x'}),liveIncidentKey({eventId:'inc-42',assetId:'y'}));
  assert.notEqual(liveIncidentKey({eventId:'inc-42',vc:'ZWN'}),liveIncidentKey({eventId:'inc-42',vc:'NWN'}));
});

test('open XLSX gebruikt eerst de achtergrondworker en pas daarna de gerichte fallback',()=>{
  assert.equal(useTargetedLiveXlsx('20260731-kruislampfouten_met_link_v3.xlsx'),true);
  assert.equal(useTargetedLiveXlsx('open-storingen.xlsm'),true);
  assert.equal(useTargetedLiveXlsx('open-storingen.xls'),false);
  assert.equal(useTargetedLiveXlsx('open-storingen.csv'),false);
  assert.match(source,/Open-storingenwerkmap in achtergrond verwerken/);
  assert.match(source,/sheetJsWorkerRijen\(file,STORINGS_KOLOMMEN_LICHT,null,vg\)/);
  assert.match(source,/Excel-worker reageert niet binnen 90 seconden/);
  assert.match(source,/xlsxEersteBladLicht\(file,STORINGS_KOLOMMEN_LICHT,null,vg\)/);
  assert.ok(source.indexOf("sheetJsWorkerRijen(file,STORINGS_KOLOMMEN_LICHT,null,vg)")<source.indexOf("xlsxEersteBladLicht(file,STORINGS_KOLOMMEN_LICHT,null,vg)"));
  assert.match(source,/leesOpenStoringenBron\(file/);
});

test('live-overzichtsfilters zijn tijdelijk niet geactiveerd tijdens importstabilisatie',()=>{
  assert.doesNotMatch(forecastSource,/installDvmLiveOverviewFilterPatch\(globalThis\)/);
  assert.doesNotMatch(forecastSource,/installLiveOverviewFilterSync\(globalThis\)/);
});

test('diffSnapshot behandelt dubbelen als multiset',()=>{
  const key=x=>x.id;
  assert.deepEqual(diffSnapshot([{id:'a'},{id:'a'},{id:'b'}],[{id:'a'},{id:'b'}],key),[{id:'a'}]);
});

test('verdwijnen bewaart laatste waarneming en een bovengrens zonder bewezen herstel',()=>{
  const row=closeHistoryRow({Van:'2026-09-10T10:00:00Z',Tot:'2026-09-11T10:00:00Z',Status:'open',Open:'ja'},{closedAt:Date.parse('2026-09-12T10:00:00Z'),startAt:Date.parse('2026-09-10T10:00:00Z'),sourceFile:'nieuw.xlsx'});
  assert.equal(row.Tot,'2026-09-11T10:00:00Z');
  assert.equal(row.hersteld_op,null);assert.equal(row.levenscyclus_status,'ONBEKEND_DOOR_BRONGAT');
  assert.equal(row.Status,'onbekend');
  assert.equal(row.Open,'onbekend');
  assert.equal(row.storingsduur_uren,48);
  assert.equal(row._afgeslotenDoorNieuweMomentopname,true);
});

test('browserpatch doet niets in Node',()=>{
  assert.equal(installDvmLiveSnapshotPatch(globalThis),false);
});
