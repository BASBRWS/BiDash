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

test('beide speciale filters combineren als OF en gebruiken DVM-classificatie',()=>{
  assert.match(src,/sel\.wind&&wind/);
  assert.match(src,/sel\.ria4&&ria4/);
  assert.match(src,/specialWind/);
  assert.match(src,/specialRia4/);
});

test('BI-assets vallen buiten een actieve speciale DRIP-selectie',()=>{
  assert.match(src,/name==='dvm'/);
  assert.match(src,/return active\(\)\?\[\]:rows/);
});

test('wijziging van vinkbox hergebruikt bestaande assetregister-renderroute',()=>{
  assert.match(src,/assetSource/);
  assert.match(src,/dispatchEvent\(new Event\('change'/);
  assert.match(read('site/core/model.js'),/import '\.\/asset-register-special-filter\.js'/);
});
