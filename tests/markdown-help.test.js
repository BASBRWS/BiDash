import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderMarkdown,resolveDocumentTarget} from '../site/core/markdown.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('relatieve documentatiepaden blijven binnen de gepubliceerde docs map',()=>{
  assert.equal(resolveDocumentTarget('afbeeldingen/bidash-processflow.svg','docs/processflow.md'),'docs/afbeeldingen/bidash-processflow.svg');
  assert.equal(resolveDocumentTarget('../site/index.html','docs/processflow.md'),'index.html');
  assert.equal(resolveDocumentTarget('javascript:alert(1)','docs/processflow.md'),'#');
});

test('processflow Markdown rendert SVG, tabel en koppen',()=>{
  const markdown=read('docs/processflow.md');
  const html=renderMarkdown(markdown,{documentPath:'docs/processflow.md'});
  assert.match(html,/<h1[^>]*>Processflow van BiDash<\/h1>/);
  assert.match(html,/src="docs\/afbeeldingen\/bidash-processflow\.svg"/);
  assert.match(html,/src="docs\/afbeeldingen\/rekenketen-dvm\.svg"/);
  assert.match(html,/<table>/);
  assert.match(html,/Actuele storingslijst is een vervangende momentopname/);
});

test('HTML uit Markdown wordt geescaped',()=>{
  const html=renderMarkdown('# Test\n\n<script>alert(1)</script>');
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
