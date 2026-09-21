import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('EOL bestaat niet meer als losse runtimebron',()=>{
  const files=[
    'site/engines/dvm-1.js',
    'site/engines/dvm-2.js',
    'site/engines/dvm-3.js',
    'site/engines/dvm-source-manager.js',
    'site/engines/dvm-adapter-original.js',
    'site/core/model.js',
    'site/core/context-api.js'
  ];
  for(const file of files){
    const src=read(file);
    assert.doesNotMatch(src,/\bEOL_REF\b/,file);
    assert.doesNotMatch(src,/\bEOL_BRON_NAAM\b/,file);
    assert.doesNotMatch(src,/leesEolReferentie|eolInputTop/,file);
  }
});

test('All Assets blijft EOL en levensduur als assetvelden herkennen',()=>{
  const importer=read('site/core/universal-importer.js');
  assert.match(importer,/eol:\['eol','end of life'/);
  assert.match(importer,/life:\['life median years'/);
  assert.doesNotMatch(importer,/push\('eol'/);
  assert.doesNotMatch(importer,/part==='eol'/);
});

test('DVM export heeft geen apart EOL-deel meer',()=>{
  const dvm3=read('site/engines/dvm-3.js');
  const model=read('site/core/model.js');
  assert.match(dvm3,/versie:55/);
  assert.doesNotMatch(dvm3,/\{id:'eol',label:'EOL-referentie'/);
  assert.doesNotMatch(dvm3,/\neol:\s*neem\('eol'\)/);
  assert.doesNotMatch(model,/DVM_PARTS=\[[^\]]*'eol'/);
});

test('betrouwbaarheidsmodel gebruikt All Assets vóór generieke levensduur',()=>{
  const dvm1=read('site/engines/dvm-1.js');
  assert.match(dvm1,/All Assets \(levensduur\/EOL\)/);
  assert.match(dvm1,/All Assets \(EOL-jaar minus installatiedatum\)/);
  assert.doesNotMatch(dvm1,/EOL-factsheet/);
});

test('chat krijgt installatie- en EOL-velden uit het assetregister',()=>{
  const app=read('site/app.js');
  const chat=read('site/core/query-assistant.js');
  assert.match(app,/installationYear/);
  assert.match(app,/installationDate/);
  assert.match(app,/eolYear/);
  assert.match(chat,/Oudste asset uit All Assets/);
  assert.match(chat,/EOL \/ levensduur uit All Assets/);
});

test('versies markeren de wijziging in assetbroncontract',()=>{
  assert.match(read('site/core/versie.js'),/BIDASH_VERSIE='2\.20'/);
  assert.match(read('site/engines/dvm-source-manager.js'),/DVM_VERSION='103'/);
});
