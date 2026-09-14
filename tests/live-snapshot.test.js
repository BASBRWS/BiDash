import test from 'node:test';
import assert from 'node:assert/strict';
import {liveIncidentKey,diffSnapshot,closeHistoryRow,installDvmLiveSnapshotPatch} from '../site/core/live-snapshot.js';

test('liveIncidentKey blijft stabiel tussen momentopnamen',()=>{
  const a=liveIncidentKey({typeId:'MSI',assetId:'A1 Li 6.685 1',start:1000,road:'A1',direction:'LI',hm:6.685,lane:'1',faultCode:'1003',message:'Fatale fout'});
  const b=liveIncidentKey({typeId:'MSI',assetId:'A1 Li 6.685 1',start:1000,road:'A1',direction:'LI',hm:6.685,lane:'1',faultCode:'1003',message:'Fatale fout'});
  assert.equal(a,b);
});

test('event-id heeft voorrang als stabiele identiteit',()=>{
  assert.equal(liveIncidentKey({eventId:' INC-42 ',assetId:'x'}),'EVENT|INC-42');
  assert.equal(liveIncidentKey({eventId:'inc-42',assetId:'y'}),'EVENT|INC-42');
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
