import test from 'node:test';
import assert from 'node:assert/strict';
import {addPrimaveraMonths,primaveraExportFilename} from '../site/core/primavera-export.js';

test('Primavera-maandverschuiving behoudt tijd, fractie en tijdzone',()=>{
  assert.equal(addPrimaveraMonths('2030-01-31T08:09:10.123+01:00',1),'2030-02-28T08:09:10.123+01:00');
  assert.equal(addPrimaveraMonths('2030-03-31T17:00:00Z',-1),'2030-02-28T17:00:00Z');
});
test('schrikkeldag, jaarovergang en datum zonder tijd blijven geldig',()=>{
  assert.equal(addPrimaveraMonths('2032-01-31T08:00:00',1),'2032-02-29T08:00:00');
  assert.equal(addPrimaveraMonths('2032-02-29',12),'2033-02-28');
  assert.equal(addPrimaveraMonths('2030-01-15T08:00:00',-2),'2029-11-15T08:00:00');
});
test('ongeldige brondata en ongeldige verschuivingen worden geweigerd',()=>{
  for(const date of ['','geen datum','2030-02-30','2030-13-01','2030-01-01T25:00:00'])assert.throws(()=>addPrimaveraMonths(date,1),/Ongeldig/);
  for(const months of [NaN,Infinity,0.5])assert.throws(()=>addPrimaveraMonths('2030-01-01',months),/hele kalendermaanden/);
  assert.throws(()=>addPrimaveraMonths('9999-12-31',1),/datumbereik/);
});
test('scenario-bestandsnaam bewaart bronidentiteit zonder paden',()=>{
  const date=new Date('2030-04-05T12:00:00Z');
  assert.equal(primaveraExportFilename('Planning test.XML',date),'Planning test-scenario-2030-04-05.xml');
  assert.equal(primaveraExportFilename('../planning.xml',date),'.._planning-scenario-2030-04-05.xml');
});
