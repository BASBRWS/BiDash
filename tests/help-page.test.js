import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('hoofdpagina bevat Help knop naar gepubliceerde uitleg',()=>{
  const html=read('site/index.html');
  assert.match(html,/href="help\.html"[^>]*>\? Help<\/a>/);
});

test('Help pagina is een viewer voor de echte Markdown documentatie',()=>{
  const html=read('site/help.html');
  assert.match(html,/id="helpNav"/);
  assert.match(html,/id="helpContent"/);
  assert.match(html,/src="help\.js"/);
  assert.match(html,/De Help toont rechtstreeks de Markdown-documentatie/);
  assert.match(html,/Terug naar BiDash/);
});

test('documentatie wordt voor publicatie inclusief afbeeldingen gebundeld',()=>{
  assert.equal(existsSync(new URL('../site/docs/processflow.md',import.meta.url)),true);
  assert.equal(existsSync(new URL('../site/docs/afbeeldingen/bidash-processflow.svg',import.meta.url)),true);
  const bundle=read('site/help-docs.js');
  assert.match(bundle,/docs\/processflow\.md/);
  assert.match(bundle,/Processflow van BiDash/);
});

test('repo documentatie bevat dezelfde functionele storingsflow',()=>{
  const help=read('docs/GEBRUIKERSHULP.md');
  const flow=read('docs/processflow.md');
  const system=read('docs/SYSTEEMWERKING.md');
  for(const text of [help,flow,system]){
    assert.match(text,/nieuwe.*momentopname|momentopname.*vervang/is);
    assert.match(text,/MSI.*histor/is);
  }
});
