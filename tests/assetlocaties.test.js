import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
const row=(id,loc,extra={})=>({entityid:id,asset:'MSI '+loc,'ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel',...extra});
function runtime(rows=[]){
 const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);
 for(const name of ['dvm-netwerkschakels.js','dvm-netwerkschakels-beheer.js'])vm.runInContext(readFileSync(new URL('../site/engines/'+name,import.meta.url),'utf8'),r);
 r.rows=rows;r.eval('analyseerAssetRegister(rows,"synthetic");ASSET_REGISTER_STATE.ruweRegisterRijen=rows');
 r.renderAlles=()=>{};r.renderRegels=()=>{};r.toonTab=()=>{};r.toonRuleSubtab=()=>{};r.renderDataGereedheid=()=>{};
 return r;
}
const matrix=(road='A15',end=10)=>({Code:road[0]+'1',Netwerkschakel:'Synthetisch vak',Verkeerscentrale:'ZWN',Rijksweg:road,'HMP van':0,'HMP tot':end});
test('N-weg met iedere zijletter, HM/HMP en nul worden correct herkend',()=>{
 const r=runtime();
 for(const letter of ['B','G','M','N','T','W','X','Y']){
  const p=r.assetLocatie(row('x','N031'+letter+' 42,125',{wegnummer:'31'}),r.registerWaarde);
  assert.equal(p.weg,'N31');assert.equal(p.hm,42.125);assert.equal(p.richting,letter);
 }
 for(const field of ['hm','hmp','HMP','HM']){
  const p=r.normRij({weg:'N31',richting:'RE',[field]:0});
  assert.equal(p.weg,'N31');assert.equal(p.hm,0);assert.equal(p.richting,'RE');
 }
 assert.equal(r.normRij({locatie:'N31 LI HMP 42,125'}).hm,42.125);
 assert.equal(r.normRij({locatie:'A15G HM 2,050'}).richting,'G');
 assert.equal(r.assetLocatie({'wegnummer':'31','bps-locatie':'PW031','hm-bord':2,'afstand-tot-hm-bord':47},r.registerWaarde).weg,'N31');
 assert.equal(r.assetLocatie({asset:'MSI A15 R 2.000',hm:9},r.registerWaarde).hm,2);
});
test('zijbaan gebruikt unieke nabije hoofdbaan, bewaart letter en echte HMP',()=>{
 const r=runtime([row('R','A15 RE 2.000'),row('L','A15 LI 2.200'),row('G','A15G 2.050')]);
 const a=r.eval('ASSET_REGISTER_STATE.assets.find(a=>a.entityid==="G")');
 assert.equal(a.richting,'RE');assert.equal(a.hm,2.05);assert.equal(a.zijdeBron,'G');assert.equal(a.hoofdbaanHm,2);
 assert.match(a.zijdeKoppeling,/nabije hoofdrijbaan/);
 const m=r.normRij({locatie:'A15 G 2.050',vc:'ZWN'});assert.equal(m.richting,'RE');assert.equal(m.zijdeBron,'G');
 r.fixture=matrix();r.eval('herstelNetwerkschakels({rijen:[fixture]})');
 r.faults=[{locatie:'A15 G 2.050',vc:'ZWN',assettype:'MSI',foutcode:'1003',melding:'Lamp defect',duur_uur:1}];
 r.eval('STATE=doorrekenen(faults,{actueel:true,peildatum:Date.parse("2026-01-02")})');
 const w=r.eval('STATE.wegdelen.find(w=>w.richting==="RE")');
 assert.equal(w.netwerkschakel,'A1');assert.equal(w.N,2);assert.equal(w.n,1);
});
test('gelijke beide hoofdrijrichtingen worden niet samengevoegd, RD kan onderscheiden',()=>{
 const r=runtime([row('R','A15 RE 2.000'),row('L','A15 LI 2.000'),row('G','A15G 2.000')]);
 assert.equal(r.eval('ASSET_REGISTER_STATE.assets[2].richting'),'G');
 assert.equal(r.eval('ASSET_REGISTER_STATE.assets[2].hoofdbaanHm'),undefined);
 const located=runtime([row('R','A15 RE 2.000',{'rd-locatie-x':100000,'rd-locatie-y':400000}),row('L','A15 LI 2.000',{'rd-locatie-x':100030,'rd-locatie-y':400000}),row('G','A15G 2.000',{'rd-locatie-x':100002,'rd-locatie-y':400000})]);
 assert.equal(located.eval('ASSET_REGISTER_STATE.assets[2].richting'),'RE');
 const outside=runtime([row('R','N15 RE 2.000'),row('G','A15G 2.000')]);
 assert.equal(outside.eval('ASSET_REGISTER_STATE.assets[1].richting'),'G');
});
test('matrixkoppeling gebruikt parent-HMP bij zijbaan vlak buiten een grens',()=>{
 const r=runtime([row('R','A15 RE 9.900'),row('G','A15G 10.100')]);
 r.fixture=matrix();r.eval('herstelNetwerkschakels({rijen:[fixture]});netwerkRegister()');
 const a=r.eval('ASSET_REGISTER_STATE.assets[1]');
 assert.equal(a.hm,10.1);assert.equal(a.hoofdbaanHm,9.9);assert.equal(a.netwerkschakel,'A1');
});
test('locatiecorrectie bouwt index en areaal opnieuw op, export bewaart bron en correctie',async()=>{
 const r=runtime([row('MOVE','A15 RE 2.000')]),key=r.eval('ASSET_REGISTER_STATE.assets[0].key');
 const original=JSON.stringify(r.rows);
 r.eval('RULES.assetConfig.overrides["ID:MOVE"]={levensduur:22}');
 await r.assetConfigBewaarLocatie(encodeURIComponent(key),{weg:'N31',richting:'LI',hm:'42,125'});
 const a=r.eval('ASSET_REGISTER_STATE.assets[0]');
 assert.equal(a.weg,'N31');assert.equal(a.richting,'LI');assert.equal(a.hm,42.125);
 assert.equal(a.bronLocatie.weg,'A15');assert.equal(a.key,key);assert.equal(a.locatieCorrectie,true);
 assert.equal(r.eval('ASSET_REGISTER_STATE.areaal.ZWN["N31 LI"].sig'),1);
 assert.equal(r.eval('ASSET_INDEX.byTypeRoad.has("MSI|A15")'),false);
 assert.equal(r.eval('ASSET_INDEX.byTypeRoad.has("MSI|N31")'),true);
 assert.equal(JSON.stringify(r.rows),original);
 const b=r.totaalExportBundle();assert.equal(b.parameters.assetConfig.overrides[key].locatie.weg,'N31');
 assert.equal(b.assetregister.rijen[0].asset,r.rows[0].asset);
 const fresh=runtime(r.rows);fresh.settings=b.parameters;
 fresh.eval('RULES.assetConfig=settings.assetConfig;ASSET_CONFIG_VERSIE++;herberekenRegisterDekking();bouwAssetIndex()');
 assert.equal(fresh.eval('ASSET_REGISTER_STATE.assets[0].weg'),'N31');
 await r.assetConfigLocatieHerstellen(encodeURIComponent(key));
 assert.equal(r.eval('ASSET_REGISTER_STATE.assets[0].weg'),'A15');
 assert.equal(r.eval('RULES.assetConfig.overrides["ID:MOVE"].levensduur'),22);
});
test('ongeldige correctie laat register en parameters staan, RD is een paar en HMP nul is geldig',async()=>{
 const r=runtime([row('X','A15 RE 2.000')]),key='ID:X';
 const saved=JSON.stringify(r.eval('ASSET_REGISTER_STATE.assets'));
 for(const loc of [{weg:'31',hm:0},{weg:'N31',hm:''},{weg:'N31',hm:-1},{weg:'N31',hm:'12abc'},{weg:'N31',hm:0,richting:'G'},{weg:'N31',hm:0,rdY:400000}]){
  await assert.rejects(r.assetConfigBewaarLocatie(key,loc));assert.equal(JSON.stringify(r.eval('ASSET_REGISTER_STATE.assets')),saved);
 }
 assert.equal(r.dvmValideerLocatie({weg:'N31',richting:'RE',hm:0}).hm,0);
 assert.equal(r.eval('RULES.assetConfig.overrides["ID:X"]'),undefined);
});
test('DRIP-correctie accepteert de oorspronkelijke identiteit/locatie, geen ander bronconflict',async()=>{
 const r=runtime([row('D','A15 RE 2.000',{'ci-type':'OBJ Bijzondere borden-drips',asset:'DRIP A15 RE 2.000'})]);
 const key=r.eval('ASSET_REGISTER_STATE.assets[0].key');
 await r.assetConfigBewaarLocatie(key,{weg:'N31',richting:'LI',hm:42.125});
 const old=r.normRij({entityid:'D',locatie:'A15 RE 2.000'});
 const match=r.koppelMeldingAanAsset(old,'DRIP');assert.equal(match.asset.key,key);
 r.pasAssetKoppelingToe(old,match);assert.equal(old.weg,'N31');assert.equal(old.hm,42.125);assert.equal(old.assetLocatieCorrectie,true);
 const conflict=r.koppelMeldingAanAsset(r.normRij({entityid:'D',locatie:'A4 RE 2.000'}),'DRIP');assert.equal(conflict.asset,null);
});
