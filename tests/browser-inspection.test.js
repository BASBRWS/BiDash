import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('de hoofdschil maakt dynamische onderdelen zonder geblokkeerde inline stijl',()=>{
  const app=read('site/app.js');
  const faults=read('site/core/open-fault-parent-ui.js');
  const css=read('site/style.css');
  assert.doesNotMatch(app,/<[^>]+style=/);
  assert.doesNotMatch(faults,/(?:\.style\.|style=)/);
  assert.match(app,/quality-height-\$\{hoogte\}/);
  assert.match(css,/\.fault-filter-summary\{/);
  assert.match(css,/\.fault-memo-actions\{/);
  assert.match(css,/\.quality-height-100\{height:100%\}/);
});

test('queryvelden krijgen een naam en een toegankelijke omschrijving',()=>{
  const app=read('site/app.js');
  for(const suffix of ['join','field','operator','value'])assert.match(app,new RegExp('name="\\$\\{basis\\}-'+suffix+'"'));
  assert.match(app,/data-query-field aria-label="Veld"/);
  assert.match(app,/data-query-operator aria-label="Vergelijking"/);
  assert.match(app,/data-query-value aria-label="Filterwaarde"/);
});

test('DVM-regelvelden krijgen stabiele namen en tips zijn niet interactief in summary',()=>{
  const dvm2=read('site/engines/dvm-2.js');
  const dvm3=read('site/engines/dvm-3.js');
  assert.match(dvm3,/benoemRegelvelden\(document\.getElementById\('tab-regels'\)\)/);
  assert.match(dvm3,/el\.name=`dvm-regel-\$\{basis\}`/);
  assert.doesNotMatch(dvm2,/class="tip[^>]*tabindex=/);
  assert.match(dvm2,/class="tip\$\{left\?' tip-left':''\}" role="note"/);
});
