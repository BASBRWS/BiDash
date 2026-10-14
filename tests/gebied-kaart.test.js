import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';

test('PDOK-tegels gebruiken RD New, de officiële matrixnaam en dezelfde projectie als de knelpunten',()=>{
 const r=dvmRuntime(),v={links:60000,rechts:110000,onder:410000,boven:450000,W:900,H:530,pad:22};
 const tiles=r.gebiedKaartTegels(v);assert.ok(tiles.length>0&&tiles.length<=64);
 for(const t of tiles){
  assert.match(t.url,/^https:\/\/service\.pdok\.nl\/kadaster\/brt-achtergrondkaart\/wmts\/v2_0\/standaard\/EPSG:28992\/\d{2}\/\d+\/\d+\.png$/);
  const span=256*3440.64/2**t.niveau;
  assert.ok(Math.abs((t.x-v.pad)/(v.W-2*v.pad)*(v.rechts-v.links)+v.links-(-285401.92+t.col*span))<1e-6);
  assert.ok(Math.abs(v.boven-(t.y-v.pad)/(v.H-2*v.pad)*(v.boven-v.onder)-(903401.92-t.row*span))<1e-6);
  assert.ok(t.col>=0&&t.col<2**t.niveau&&t.row>=0&&t.row<2**t.niveau);
 }
 const cols=[...new Set(tiles.map(t=>t.col))].sort((a,b)=>a-b);assert.equal(cols.at(-1)-cols[0]+1,cols.length);
 assert.equal(r.gebiedKaartTegels({...v,rechts:v.links}).length,0);
 assert.equal(r.gebiedKaartTegels({...v,W:NaN}).length,0);
});

test('zonder NWB of assetcoördinaten verschijnt de landelijke kaart zonder verzonnen knelpunten',()=>{
 const r=dvmRuntime(),html=r.renderRijkswegKaart([]);
 assert.match(html,/data-kaart-tegel=/);assert.match(html,/Geen bruikbare RD-coördinaten/);
 assert.match(html,/0 van 0 knelpunten geplaatst/);assert.doesNotMatch(html,/class="choke-punt/);
 assert.doesNotMatch(html,/undefined/);
});

test('registercoördinaten bepalen de uitsnede en ontbrekende knelpunten blijven expliciet geteld',()=>{
 const r=dvmRuntime();r.rows=[{entityid:'S',asset:'MSI A15 RE 12.345 1','ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel','rd-locatie-x':80000,'rd-locatie-y':430000}];
 vm.runInContext('analyseerAssetRegister(rows,"synthetic")',r);
 const c={key:'A15 RE',vc:'ZWN',wd:{weg:'A15',richting:'RE',vc:'ZWN'},hmMin:12.345,hmMax:12.345,n:2,dichtheid:2,beschLok:70,leden:[{rdX:80000,rdY:430000}]};
 const missing={...c,key:'N99 RE',wd:{weg:'N99',richting:'RE',vc:'ZWN'},leden:[]};
 const before=JSON.stringify(r.rows),html=r.renderRijkswegKaart([c,missing]);
 assert.match(html,/1 van 2 knelpunten geplaatst/);assert.match(html,/1 zonder bruikbare locatie/);
 assert.match(html,/class="choke-punt/);assert.equal(JSON.stringify(r.rows),before);
 assert.doesNotMatch(html,/NWB-2025|undefined wegen/);
});

test('alleen de PDOK-tegelbron is als externe afbeelding toegestaan, brondata blijft lokaal',()=>{
 const html=readFileSync(new URL('../site/engines/dvm.html',import.meta.url),'utf8');
 assert.match(html,/img-src 'self' data: blob: https:\/\/service.pdok.nl\/kadaster\/brt-achtergrondkaart\/wmts\/v2_0\/;/);
 assert.match(html,/connect-src 'self';/);assert.match(html,/<meta name="referrer" content="no-referrer">/);
 assert.doesNotMatch(html,/connect-src[^;]*pdok|img-src[^;]*\*/);
});
