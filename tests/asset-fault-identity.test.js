import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import {dvmAssetMatchMemoKey} from '../site/core/dvm-analysis-rebuild-performance.js';

const asset=(id,lane=1,loc='A15 RE 12.345',vc='ZWN',type='MSI')=>({entityid:id,asset:`${type} ${loc} ${lane}`,'ci-type':type==='LUS'?'Inductielus':'VKS signaalgevers',regio:vc,status:'Operationeel'});
const fault=(lane=1,extra={})=>({locatie:'A15 RE 12.345',vc:'ZWN',assettype:'MSI',foutcode:'1003',melding:`Fatale fout bij MSI ${lane}`,van:'2026-01-01',tot:'2026-01-02',...extra});
function runtime(rows){const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);r.rows=rows;r.eval('analyseerAssetRegister(rows,"synthetic")');return r;}
const match=(r,row,type='MSI')=>r.koppelMeldingAanAsset(r.normRij(row),type);

test('register en storingen herkennen streepjes zonder verlies van N-prefix, zijde of HMP nul',()=>{
 const r=runtime([]);
 for(const [text,road,side,hm] of [
  ['Camera 08-A4-Li-7,49','A4','LI',7.49],['A015-RE-12.345','A15','RE',12.345],
  ['N031-G-HMP-42,125','N31','G',42.125],['A15-R-12-345','A15','RE',12.345],
  ['A15_RE_HM_0,000','A15','RE',0],['A15 RE 12.345','A15','RE',12.345],
  ['A15R-12,345','A15','RE',12.345]]){
  for(const p of [r.assetLocatie({asset:text},r.registerWaarde),r.normRij({locatie:text})]){
   assert.equal(p.weg,road,text);assert.equal(p.richting,side,text);assert.equal(p.hm,hm,text);
  }
 }
});

test('streepjescamera wordt aan matrix en melding gekoppeld zonder bronwijziging',()=>{
 const rows=[{entityid:'CAM',asset:'Camera 08-A4-Li-7,49','ci-type':'VID Cameras',regio:'ZWN',status:'Operationeel'}],r=runtime(rows);
 vm.runInContext(readFileSync(new URL('../site/engines/dvm-netwerkschakels.js',import.meta.url),'utf8'),r);
 r.eval('herstelNetwerkschakels({rijen:[{Code:"X",Netwerkschakel:"Test",Verkeerscentrale:"ZWN",Rijksweg:"A4","HMP van":7,"HMP tot":8}]});netwerkRegister()');
 const a=r.eval('ASSET_REGISTER_STATE.assets[0]');assert.equal(a.netwerkschakel,'X');assert.equal(a.hm,7.49);assert.equal(a.richting,'LI');
 assert.equal(match(r,{locatie:'A4-Li-7,49',vc:'ZWN'},'CAM').asset.key,'ID:CAM');
 assert.equal(rows[0].asset,'Camera 08-A4-Li-7,49');
});

test('rijstrook uit meldtekst of gevolg voorkomt samenvoegen via oude locatiealias',()=>{
 const r=runtime([1,2,3].map(lane=>asset('S'+lane,lane)));
 r.eval('RULES.assetConfig.aliases.MSIA15RE12345="ID:S1"');
 for(const lane of [1,2,3])assert.equal(match(r,fault(lane)).asset.key,'ID:S'+lane);
 assert.equal(match(r,fault(2,{melding:'Lamp defect',Gevolg:'Geen beeldstand op rijstrook 2'})).asset.key,'ID:S2');
 assert.equal(match(r,fault(3,{melding:'Lamp defect',MSI:'MSI 3'})).asset.key,'ID:S3');
 assert.equal(r.eval('RULES.assetConfig.aliases.MSIA15RE12345'),'ID:S1');
});

test('verkeerde oude locatiealias verplaatst geen melding naar een ander hectometerpunt',()=>{
 const r=runtime([asset('WRONG',1,'A15 RE 20.000'),asset('RIGHT',2)]);
 r.eval('RULES.assetConfig.aliases.MSIA15RE12345="ID:WRONG"');
 const m=r.normRij(fault(2)),k=r.koppelMeldingAanAsset(m,'MSI');r.pasAssetKoppelingToe(m,k);
 assert.equal(m.assetKey,'ID:RIGHT');assert.equal(m.hm,12.345);
 const missing=match(r,fault(2,{locatie:'A15 RE 5.000'}));assert.equal(missing.asset,null);
});

test('zonder bekende rijstrook blijft een locatiealias bij meerdere eenheden onbeslist',()=>{
 const r=runtime([asset('S1',1),asset('S2',2)]);
 r.eval('RULES.assetConfig.aliases.MSIA15RE12345="ID:S1"');
 assert.equal(match(r,fault(1,{melding:'Storing MSI'})).asset,null);
 assert.equal(r.meldingStrook({melding:'Fatale fout bij MSI 1 en MSI 2'}),'');
});

test('automatische en opgeslagen koppelingen overschrijden geen bekende VC, zijde of rijstrook',()=>{
 for(const row of [fault(1,{vc:'NWN'}),fault(1,{locatie:'A15 LI 12.345'}),fault(2)]){
  const r=runtime([asset('S1')]),m=r.normRij(row),id=r.assetLogId(m,'MSI');
  r.id=id;r.eval('RULES.assetConfig.aliases[assetLogSleutel(id)]="ID:S1"');
  assert.equal(r.koppelMeldingAanAsset(m,'MSI').asset,null);
 }
 const r=runtime([asset('R',1,'A15 RE 12.345'),asset('G',1,'A15G 12.345'),asset('S',1,'A15S 12.345')]);
 assert.equal(match(r,fault(1,{locatie:'A15 G 12.345'})).asset.key,'ID:G');
 assert.equal(match(r,fault(1,{locatie:'A15 S 12.345'})).asset.key,'ID:S');
});

test('koppelsleutel onderscheidt type, VC en rijstrook en gebruikt geen algemene foutcode',()=>{
 const r=runtime([asset('S1'),asset('S2',2,'A15 RE 12.545')]);
 const ids=[fault(1),fault(2),fault(1,{vc:'NWN'}),fault(1,{assettype:'LUS'})].map(row=>{const m=r.normRij(row);return r.assetLogId(m,r.classificeer(m));});
 assert.equal(new Set(ids).size,4);assert.ok(ids.every(id=>id!=='1003'));
 const near=r.normRij(fault(1)),far=r.normRij(fault(1,{locatie:'A15 RE 123.451',melding:'Storing MSI'}));
 assert.notEqual(r.assetLogSleutel(r.assetLogId(near,'MSI')),r.assetLogSleutel(r.assetLogId(far,'MSI')));
 r.eval('RULES.assetConfig.aliases["1003"]="ID:S1"');
 assert.equal(match(r,fault(2,{locatie:'A15 RE 12.545'})).asset.key,'ID:S2');
});

test('locatiecorrectie accepteert de bronlocatie van dezelfde MSI en bewaart de rijstrook',()=>{
 const r=runtime([asset('S1')]);
 r.eval('RULES.assetConfig.overrides["ID:S1"]={locatie:{weg:"N31",richting:"LI",hm:42.125}};ASSET_CONFIG_VERSIE++;bouwAssetIndex()');
 const m=r.normRij(fault(1,{entityid:'S1'})),k=r.koppelMeldingAanAsset(m,'MSI');assert.equal(k.asset.key,'ID:S1');
 r.pasAssetKoppelingToe(m,k);assert.equal(m.weg,'N31');assert.equal(m.hm,42.125);assert.equal(m.strook,'1');
 assert.equal(match(r,fault(2,{entityid:'S1'})).asset,null);
});

test('Detectielusnummer uit de meldtekst hoort bij de juiste registereenheid',()=>{
 const r=runtime([asset('L1',1,'A15 RE 12.345','ZWN','LUS'),asset('L2',2,'A15 RE 12.345','ZWN','LUS')]);
 assert.equal(match(r,{locatie:'A15 RE 12.345',vc:'ZWN',melding:'Detector 2 defect',assettype:'LUS',foutcode:'1006'},'LUS').asset.key,'ID:L2');
 assert.equal(match(r,{locatie:'A15 RE 12.345',vc:'ZWN',MSI:'DETECTIELUS',melding:'Detector 2 defect',assettype:'LUS',foutcode:'1006'},'LUS').asset.key,'ID:L2');
});

test('live doorrekening behoudt verschillende foutcodes en rijstroken, exacte dubbelen tellen eenmaal',()=>{
 const r=runtime([asset('S1'),asset('S2',2)]);
 r.eval('RULES.assetConfig.aliases.MSIA15RE12345="ID:S1"');
 r.faults=[fault(1,{event_id:'1'}),fault(2,{event_id:'2'}),fault(2,{event_id:'2'}),fault(2,{event_id:'3',foutcode:'1001',melding:'Fout in lampcircuit bij MSI 2'})];
 const result=r.eval('doorrekenen(faults,{actueel:true,peildatum:Date.parse("2026-01-02")})');
 assert.equal(result.meldingen.length,3);assert.equal(result.stats.dubbel,1);
 assert.equal(result.meldingen.filter(m=>m.assetKey==='ID:S1').length,1);
 assert.equal(result.meldingen.filter(m=>m.assetKey==='ID:S2').length,2);
 const backup=r.totaalExportBundle();assert.equal(backup.parameters.assetConfig.aliases.MSIA15RE12345,'ID:S1');
 const restored=runtime(r.rows);restored.config=backup.parameters.assetConfig;restored.eval('RULES.assetConfig=config');
 assert.equal(match(restored,fault(2)).asset.key,'ID:S2');
});

test('zelfde incidentnummer op dezelfde locatie in twee VC’s blijft twee meldingen',()=>{
 const r=runtime([asset('S1',1,'A15 RE 12.345','ZWN'),asset('S2',1,'A15 RE 12.345','NWN')]);
 r.faults=[fault(1,{event_id:'1'}),fault(1,{event_id:'1',vc:'NWN'})];
 const result=r.eval('doorrekenen(faults,{actueel:true,peildatum:Date.parse("2026-01-02")})');
 assert.equal(result.meldingen.length,2);assert.deepEqual([...result.meldingen.map(m=>m.assetKey)],['ID:S1','ID:S2']);
});

test('importcache onderscheidt oorspronkelijke zijbaan, hectoletter en eenheid uit tekst',()=>{
 const m={weg:'A15',richting:'RE',hm:12.345,vc:'ZWN'};
 assert.notEqual(dvmAssetMatchMemoKey({...m,zijdeBron:'G'},'MSI'),dvmAssetMatchMemoKey({...m,zijdeBron:'S'},'MSI'));
 assert.notEqual(dvmAssetMatchMemoKey({...m,hectoletter:'A'},'MSI'),dvmAssetMatchMemoKey({...m,hectoletter:'B'},'MSI'));
 assert.notEqual(dvmAssetMatchMemoKey({...m,melding:'MSI 1'},'MSI'),dvmAssetMatchMemoKey({...m,melding:'MSI 2'},'MSI'));
});
