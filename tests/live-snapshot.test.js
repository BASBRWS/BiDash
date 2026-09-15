import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveIncidentKey,diffSnapshot,closeHistoryRow,useTargetedLiveXlsx,installDvmLiveSnapshotPatch} from '../site/core/live-snapshot.js';

const source=readFileSync(new URL('../site/core/live-snapshot.js',import.meta.url),'utf8');

test('liveIncidentKey blijft stabiel tussen momentopnamen',()=>{
  const a=liveIncidentKey({typeId:'MSI',assetId:'A1 Li 6.685 1',start:1000,road:'A1',direction:'LI',hm:6.685,lane:'1',faultCode:'1003',message:'Fatale fout'});
  const b=liveIncidentKey({typeId:'MSI',assetId:'A1 Li 6.685 1',start:1000,road:'A1',direction:'LI',hm:6.685,lane:'1',faultCode:'1003',message:'Fatale fout'});
  assert.equal(a,b);
});

test('event-id heeft voorrang als stabiele identiteit',()=>{
  assert.equal(liveIncidentKey({eventId:' INC-42 ',assetId:'x'}),'EVENT|INC-42');
  assert.equal(liveIncidentKey({eventId:'inc-42',assetId:'y'}),'EVENT|INC-42');
});

test('open XLSX gebruikt de gerichte streamlezer',()=>{
  assert.equal(useTargetedLiveXlsx('20260731-kruislampfouten_met_link_v3.xlsx'),true);
  assert.equal(useTargetedLiveXlsx('open-storingen.xlsm'),true);
  assert.equal(useTargetedLiveXlsx('open-storingen.xls'),false);
  assert.equal(useTargetedLiveXlsx('open-storingen.csv'),false);
  assert.match(source,/xlsxEersteBladLicht\(file,STORINGS_KOLOMMEN_LICHT,null,vg\)/);
  assert.match(source,/leesOpenStoringenBron\(file/);
  assert.match(source,/Excel-worker reageert niet binnen 30 seconden/);
});

test('diffSnapshot behandelt dubbelen als multiset',()=>{
  const key=x=>x.id;
  assert.deepEqual(diffSnapshot([{id:'a'},{id:'a'},{id:'b'}],[{id:'a'},{id:'b'}],key),[{id:'a'}]);
});

test('closeHistoryRow sluit de melding en actualiseert duur',()=>{
  const row=closeHistoryRow({Van:'2026-09-10T10:00:00Z',Tot:'2026-09-11T10:00:00Z',Status:'open',Open:'ja'},{closedAt:Date.parse('2026-09-12T10:00:00Z'),startAt:Date.parse('2026-09-10T10:00:00Z'),sourceFile:'nieuw.xlsx'});
  assert.equal(row.Tot,'2026-09-12T10:00:00.000Z');
  assert.equal(row.Status,'gesloten');
  assert.equal(row.Open,'nee');
  assert.equal(row.storingsduur_uren,48);
  assert.equal(row._afgeslotenDoorNieuweMomentopname,true);
});

test('browserpatch doet niets in Node',()=>{
  assert.equal(installDvmLiveSnapshotPatch(globalThis),false);
});
