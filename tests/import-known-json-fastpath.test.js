import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {knownBiDashJsonHead,fileLooksLikeKnownBiDashJson,installKnownJsonFastPath} from '../site/core/import-known-json-fastpath.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function knownFile(){
  return {
    name:'bidash-integraal_2026-09-14.json',size:80*1024*1024,
    slice(start,end){return {text:async()=>'{"formaat":"BiDash-integraal","versie":1,"delen":{}}'};}
  };
}

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

test('runtime fastpath stuurt bekende export rechtstreeks naar de oorspronkelijke importer',async()=>{
  let coreCalls=0,universalCalls=0,shown=0;
  const input={dataset:{},onchange:async()=>{coreCalls++;}};
  const type={value:'auto'};
  const doc={getElementById:id=>id==='files'?input:id==='importType'?type:null};
  const scope={document:doc,BIDASH_LOAD_PROGRESS:{show(){shown++;}}};
  installKnownJsonFastPath(scope);

  // Eerste timer bewaart de oorspronkelijke app-handler. Daarna bootsen we de
  // universele importer na die er een wrapper omheen zet.
  await wait(10);
  input.onchange=async()=>{universalCalls++;};
  input.dataset.bidashUniversalImporter='1';
  await wait(40);

  assert.equal(input.dataset.bidashKnownJsonFastpath,'1');
  await input.onchange({target:{files:[knownFile()]}});
  assert.equal(coreCalls,1);
  assert.equal(universalCalls,0);
  assert.equal(shown,1);
});
