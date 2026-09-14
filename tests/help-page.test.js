import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('hoofdpagina bevat Help knop naar gepubliceerde uitleg',()=>{
  const html=read('site/index.html');
  assert.match(html,/href="help\.html"[^>]*>\? Help<\/a>/);
});

test('Help pagina beschrijft actuele storingslijst en hoofdproces',()=>{
  const html=read('site/help.html');
  assert.match(html,/Wat gebeurt er als je een nieuwe XLSX met open storingen laadt/);
  assert.match(html,/MSI-storing staat in A maar niet meer in B/);
  assert.match(html,/Van bronbestand naar besluitinformatie/);
  assert.match(html,/Terug naar BiDash/);
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
