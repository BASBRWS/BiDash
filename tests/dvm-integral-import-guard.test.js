import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const guard=readFileSync(new URL('../site/engines/dvm-adapter.js',import.meta.url),'utf8');
const original=readFileSync(new URL('../site/engines/dvm-adapter-original.js',import.meta.url),'utf8');

test('DVM-adapter bewaart de bestaande adapter en laadt die parser-synchroon',()=>{
  assert.match(guard,/document\.write\('<script src="dvm-adapter-original\.js"><\/script>'\)/);
  assert.match(original,/window\.HUB=\{/);
  assert.match(original,/structuredClone\(bundle\)/);
});

test('integrale import wacht op beide zware performancepatches',()=>{
  assert.match(guard,/__BIDASH_DVM_COMBI_PERF_ACTIVE__/);
  assert.match(guard,/__BIDASH_ANALYSIS_REBUILD_PERF__/);
  assert.match(guard,/for\(let poging=0;poging<1500&&!optimalisatiesGereed\(\);poging\+\+\)await wacht\(10\)/);
});

test('alleen de overbodige clone van exact het inkomende DVM-bundle wordt overgeslagen',()=>{
  assert.match(guard,/if\(value===bundle\)return value/);
  assert.match(guard,/return nativeClone\.call\(window,value,options\)/);
  assert.match(guard,/finally\{\s*window\.structuredClone=nativeClone/);
});
