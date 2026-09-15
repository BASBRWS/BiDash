import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('site/core/asset-register-special-filter.js');

test('assetregister krijgt aparte vinkboxen voor Windwaarschuwing en RIA4',()=>{
  assert.match(src,/assetWind/);
  assert.match(src,/assetRia4/);
  assert.match(src,/Windwaarschuwing/);
  assert.match(src,/RIA4/);
});

test('assetregister krijgt filter met drie operationele toestanden',()=>{
  assert.match(src,/assetOperationalStatus/);
  assert.match(src,/Niet operationeel door storing/);
  assert.match(src,/OPERATIONAL_STATUS/);
  assert.match(src,/operationalStatusForAsset/);
});

test('beide speciale filters combineren als OF en gebruiken DVM-classificatie',()=>{
  assert.match(src,/sel\.wind&&wind/);
  assert.match(src,/sel\.ria4&&ria4/);
  assert.match(src,/specialWind/);
  assert.match(src,/specialRia4/);
});

test('BI-assets vallen buiten een actieve speciale DRIP-selectie',()=>{
  assert.match(src,/name==='dvm'/);
  assert.match(src,/if\(sel\.wind\|\|sel\.ria4\)return \[\]/);
});

test('wijziging van filter hergebruikt bestaande assetregister-renderroute',()=>{
  assert.match(src,/assetSource/);
  assert.match(src,/dispatchEvent\(new Event\('change'/);
  assert.match(read('site/core/model.js'),/import '\.\/asset-register-special-filter\.js'/);
});

test('browserfilter is inert wanneer modeltests zonder DOM draaien',async()=>{
  assert.match(src,/typeof window==='undefined'\|\|typeof document==='undefined'/);
  await import('../site/core/asset-register-special-filter.js?node-guard='+Date.now());
});
