import test from 'node:test';
import assert from 'node:assert/strict';
import '../site/core/signaalgever-import.js';
import {mergeImport,DEFAULT_STATE,makeExport} from '../site/core/model.js';
const C=globalThis.BIDASH_SIGNAALGEVER_IMPORT;
const now=Date.parse('2026-10-15T10:00:00Z'),limit=C.cutoff(now);
const row=(id,vc='zwn',status='OPEN_BEVESTIGD',end=null)=>({_mtmSleutel:id,incident_id:id,vc,MSI:'MSI 1',assetTypeHint:'MSI',levenscyclus_status:status,hersteld_op:status==='HERSTELD_BEVESTIGD'?end:null,herstel_venster_tot:end});
const stand=(vc,rows=[],historie=rows)=>({open:rows,historie,laatstePerVc:{[vc]:now},snapshotDekking:{[vc]:{volledig:true,bronGap:false,volumeVerdacht:false}},bewaring:{jaren:1}});

test('één kalenderjaar, schrikkeldag en exacte grens blijven behouden',()=>{
 assert.equal(new Date(C.cutoff('2024-02-29T12:00Z')).toISOString(),'2023-02-28T12:00:00.000Z');
 const history=[row('before','zwn','HERSTELD_BEVESTIGD',new Date(limit-1).toISOString()),row('edge','zwn','HERSTELD_BEVESTIGD',new Date(limit).toISOString()),row('inferred','zwn','HERSTELD_AFGELEID',new Date(limit-1).toISOString())];
 const s=C.retain(stand('zwn',[],history),now);assert.deepEqual(s.historie.map(r=>r.incident_id),['edge']);assert.equal(s.bewaring.verwijderd,2);
});
test('oude open, onzekere en legacyregels worden niet op start of tot verwijderd',()=>{
 const statuses=['OPEN_BEVESTIGD','OPEN_VEROUDERD','VERDWENEN_UIT_SNAPSHOT','ONBEKEND_DOOR_BRONGAT',''];
 const history=statuses.map((s,i)=>({...row('a'+i,'zwn',s),van:'2020-01-01',tot:'2020-01-02'}));
 history.push({...row('no-proof','zwn','HERSTELD_AFGELEID'),tot:'2020-01-02'});
 assert.equal(C.retain(stand('zwn',history,history),now).historie.length,6);
 assert.equal(C.retain(stand('zwn',[],history),now).historie.length,6);
 const epoch={...row('epoch','zwn','HERSTELD_BEVESTIGD'),hersteld_op:0};assert.equal(C.retain(stand('zwn',[],[epoch]),now).historie.length,0);
 const mixed={...row('same-id','zwn','HERSTELD_AFGELEID','2020-01-01'),_mtmSleutel:'other-key'};assert.equal(C.retain(stand('zwn',[row('same-id')],[mixed]),now).historie.length,1);
 const conflict=row('keep','zwn','HERSTELD_AFGELEID','2020-01-01');assert.equal(C.retain(stand('zwn',[row('keep')],[conflict]),now).historie.length,1);
});
test('per VC overdracht behoudt andere VC, camera, DRIP, parameters en matrix zonder mutatie',()=>{
 const a=C.bundle({zwn:stand('zwn',[row('old')]),nwn:stand('nwn',[row('north','nwn')])},{now});
 const current={...a,parameters:{norm:0},netwerkschakels:{rijen:[{x:null}]},dripHistorie:{sources:['drip']},bronbeheer:{...a.bronbeheer,dripTotaal:{bestand:'drip'}}};delete current.signaalgeverImport;
 current.liveStoringen.push({key:'camera',rijen:[{vc:'zwn',assetTypeHint:'CAM',id:'cam'}]},{key:'drip',virtueel:true,afgeleidVan:'dripHistorie',rijen:[{vc:'zwn',assetTypeHint:'DRIP',id:'drip'}]});
 const before=JSON.stringify(current),incoming=C.bundle({zwn:stand('zwn',[row('new')])},{now});
 const result=mergeImport({...DEFAULT_STATE(),dvm:current},incoming).dvm;
 assert.equal(JSON.stringify(current),before);assert.deepEqual(result.liveStoringen.flatMap(b=>b.rijen).map(r=>r.incident_id||r.id).sort(),['cam','drip','new','north']);
 assert.equal(result.parameters.norm,0);assert.equal(result.netwerkschakels.rijen[0].x,null);assert.equal(result.bronbeheer.dripTotaal.bestand,'drip');assert.equal(result.bronbeheer.signaalgeverTotaal.laatstePerVc.nwn,now);
 assert.equal(result.signaalgeverImport,undefined);
 assert.deepEqual(C.merge(result,incoming),result,'herhaald laden is idempotent');
 const backup=makeExport({...DEFAULT_STATE(),dvm:result},new Set(['liveStoringen','storingshistorie']));assert.equal(backup.delen.dvm.bronbeheer.signaalgeverTotaal.laatstePerVc.nwn,now);
});
test('lege VC vervangt alleen haar eigen meldingen en behoudt het watermerk',()=>{
 const current=C.bundle({zwn:stand('zwn',[row('a')]),nwn:stand('nwn',[row('b','nwn')])},{now});
 const result=C.merge(current,C.bundle({zwn:stand('zwn',[],[])},{now}));assert.deepEqual(result.liveStoringen.flatMap(b=>b.rijen).map(r=>r.incident_id),['b']);assert.equal(result.bronbeheer.signaalgeverTotaal.laatstePerVc.zwn,now);
});
test('onjuiste VC, ontbrekende peildatum en oudere stand blokkeren vervanging',()=>{
 const valid=C.bundle({zwn:stand('zwn',[row('a')])},{now});
 const bad=structuredClone(valid);bad.liveStoringen[0].rijen[0].vc='nwn';assert.throws(()=>C.merge({},bad),/buiten/);
 const missing=structuredClone(valid);delete missing.bronbeheer.signaalgeverTotaal.laatstePerVc.zwn;assert.throws(()=>C.merge({},missing),/peildatum/);
 const old=C.bundle({zwn:{...stand('zwn'),laatstePerVc:{zwn:now-1}}},{now});assert.throws(()=>C.merge(valid,old),/ouder/);
 const partial=structuredClone(valid);delete partial.storingshistorie;assert.throws(()=>C.merge({},partial),/samen/);
});
