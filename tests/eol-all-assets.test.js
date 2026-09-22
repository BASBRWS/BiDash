import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('EOL-referentie is geen zelfstandige DVM-bron meer',()=>{
  const files=[
    'site/engines/dvm-1.js',
    'site/engines/dvm-2.js',
    'site/engines/dvm-3.js',
    'site/engines/dvm-source-manager.js',
    'site/engines/dvm-adapter-original.js',
    'site/core/model.js',
    'site/core/context-api.js'
  ];
  for(const path of files){
    const source=read(path);
    assert.doesNotMatch(source,/\bEOL_REF\b/,path);
    assert.doesNotMatch(source,/\bEOL_BRON_NAAM\b/,path);
    assert.doesNotMatch(source,/\bleesEolReferentie\b/,path);
    assert.doesNotMatch(source,/eolInputTop/,path);
  }
});

test('All Assets behoudt installatie-, EOL- en levensduurvelden',()=>{
  const dvm3=read('site/engines/dvm-3.js');
  const importer=read('site/core/universal-importer.js');
  assert.match(dvm3,/INSTALLATIE_DATUM_KEYS/);
  assert.match(dvm3,/EOL_DATUM_KEYS/);
  assert.match(dvm3,/LEVENSDUUR_KEYS/);
  assert.match(importer,/inService:\[/);
  assert.match(importer,/eol:\[/);
  assert.match(importer,/life:\[/);
  assert.match(importer,/put\(out,'ingebruikname'/);
  assert.match(importer,/put\(out,'eol'/);
  assert.match(importer,/put\(out,'life_median_years'/);
});

test('universele importer maakt geen losse EOL-bundle meer',()=>{
  const importer=read('site/core/universal-importer.js');
  const model=read('site/core/model.js');
  assert.doesNotMatch(importer,/push\('eol'/);
  assert.doesNotMatch(importer,/part==='eol'/);
  assert.doesNotMatch(model,/DVM_PARTS=\[[^\]]*'eol'/);
});

test('DVM totaalexport bevat geen aparte EOL-sectie meer',()=>{
  const dvm3=read('site/engines/dvm-3.js');
  assert.doesNotMatch(dvm3,/\{id:'eol',label:'EOL-referentie'/);
  assert.doesNotMatch(dvm3,/eol:\s*neem\('eol'\)/);
  assert.doesNotMatch(dvm3,/bundle\.eol/);
});

test('DVM-interface biedt geen aparte EOL-upload meer aan',()=>{
  const html=read('site/engines/dvm.html');
  const manager=read('site/engines/dvm-source-manager.js');
  assert.doesNotMatch(html,/btnEol|landingEolBtn|eolInputTop/);
  assert.doesNotMatch(manager,/EOL-referentie laden|eolInputTop/);
});
