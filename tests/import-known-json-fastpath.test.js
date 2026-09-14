import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {knownBiDashJsonHead,fileLooksLikeKnownBiDashJson} from '../site/core/import-known-json-fastpath.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('herkent integrale en DVM totaalexports uit alleen de bestandskop',()=>{
  assert.equal(knownBiDashJsonHead('{"formaat":"BiDash-integraal","versie":1,"delen":{}}'),true);
  assert.equal(knownBiDashJsonHead('\ufeff { "formaat" : "DVM-dienstimpact-totaal", "versie":54 }'),true);
  assert.equal(knownBiDashJsonHead('{"rows":[{"weg":"A12"}]}'),false);
});

test('grote bekende JSON wordt herkend zonder volledige file.text aan te roepen',async()=>{
  let slices=0,fullReads=0;
  const file={
    name:'bidash-integraal_2026-09-14.json',
    size:80*1024*1024,
    slice(start,end){
      slices++;
      assert.equal(start,0);
      assert.ok(end<=256*1024);
      return {text:async()=>'{"formaat":"BiDash-integraal","versie":1,"delen":{}}'};
    },
    async text(){fullReads++;return 'mag niet worden gebruikt';}
  };
  assert.equal(await fileLooksLikeKnownBiDashJson(file),true);
  assert.equal(slices,1);
  assert.equal(fullReads,0);
});

test('fastpath wordt vóór universele importer ingepland',()=>{
  const model=read('site/core/model.js');
  const fast=model.indexOf("import './import-known-json-fastpath.js';");
  const universal=model.indexOf("import './universal-importer.js';");
  assert.ok(fast>=0&&universal>fast);
});
