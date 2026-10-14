import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('site/core/asset-register-special-filter.js');
const view=read('site/core/asset-register-view.js');

test('assetregister krijgt aparte vinkboxen voor Windwaarschuwing en RIA4',()=>{
  assert.match(src,/assetWind/);
  assert.match(src,/assetRia4/);
  assert.match(src,/Windwaarschuwing/);
  assert.match(src,/RIA4/);
});

test('assetregister krijgt filter met drie operationele toestanden',()=>{
  assert.match(src,/assetOperationalStatus/);
  assert.match(src,/OPERATIONAL_STATUS/);
  assert.match(view,/operationalStatusForAsset/);
  assert.doesNotMatch(src,/api\.assets=/);
  assert.match(read('site/core/asset-operational-status.js'),/Niet operationeel door storing/);
});

test('beide speciale filters combineren als OF en gebruiken DVM-classificatie',()=>{
  assert.match(view,/wind&&row\.wind/);
  assert.match(view,/ria4&&row\.ria4/);
  assert.match(view,/specialWind/);
  assert.match(view,/specialRia4/);
});

test('BI-assets vallen buiten een actieve speciale DRIP-selectie',()=>{
  assert.match(view,/wind:source==='DVM'/);
  assert.match(view,/ria4:source==='DVM'/);
});

test('wijziging van filter hergebruikt bestaande assetregister-renderroute',()=>{
  assert.match(src,/assetSource/);
  assert.match(src,/dispatchEvent\(new Event\('change'/);
  assert.match(read('site/core/model.js'),/import '\.\/asset-register-special-filter\.js(?:\?v=[^']+)?'/);
});

test('browserfilter is inert wanneer modeltests zonder DOM draaien',async()=>{
  assert.match(src,/typeof window==='undefined'\|\|typeof document==='undefined'/);
  await import('../site/core/asset-register-special-filter.js?node-guard='+Date.now());
});
