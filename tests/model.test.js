import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STATE,makeExport,mergeImport,combine,validate} from '../site/core/model.js';
test('deelimport behoudt afwezige onderdelen en vervangt expliciete lege lijst',()=>{const state=DEFAULT_STATE();state.dvm={assetregister:{rijen:[{id:1}]},liveStoringen:[{key:'oud'}],parameters:{cfg:{norm:99}}};const next=mergeImport(state,{formaat:'DVM-dienstimpact-totaal',liveStoringen:[]});assert.equal(next.dvm.assetregister.rijen.length,1);assert.equal(next.dvm.liveStoringen.length,0);assert.equal(next.dvm.parameters.cfg.norm,99);assert.equal(state.dvm.liveStoringen.length,1);});
test('gedeeltelijke export lekt geen niet gekozen brondata',()=>{const s=DEFAULT_STATE();s.dvm={assetregister:{rijen:['privé']},parameters:{cfg:{norm:99}}};s.bi={functies:['privé'],config:{fte:1}};const b=makeExport(s,new Set(['parameters','biRules']));assert.equal(b.delen.dvm.assetregister,undefined);assert.equal(b.delen.bi.functies,undefined);assert.equal(b.delen.bi.config.fte,1);assert.equal(b.afhankelijkheden.length,1);});
test('integrale export en import behouden alle geselecteerde Bronbeheerbronnen',()=>{
 const s=DEFAULT_STATE();s.dvm={
  assetregister:{rijen:[{id:'a1'}]},
  storingshistorie:[{key:'signaalgever-totaal-historie',rijen:[{id:'h1'},{id:'h2'}]}],
  liveStoringen:[{key:'signaalgever-totaal-open',rijen:[{id:'o1'}]}],
  dripHistorie:{sources:[{key:'drip',incidenten:[{id:'d1'}]}]},
  uRoutes:{rijen:[{id:'u1'}]},werkzaamheden:{rijen:[{id:'w1'}]},
  parameters:{cfg:{norm:99}},dripSelectie:['D1'],
  bronbeheer:{signaalgeverTotaal:{bestand:'mtm-map',open:1,historie:2},dripTotaal:{bestand:'cdms-map',incidenten:1}}
 };
 const selectie=new Set(['assetregister','storingshistorie','liveStoringen','dripHistorie','uRoutes','werkzaamheden','parameters','dripSelectie']);
 const bundel=makeExport(s,selectie),d=bundel.delen.dvm;
 assert.equal(d.storingshistorie[0].rijen.length,2);assert.equal(d.liveStoringen[0].rijen.length,1);
 assert.equal(d.bronbeheer.signaalgeverTotaal.bestand,'mtm-map');assert.equal(d.bronbeheer.dripTotaal.bestand,'cdms-map');
 const terug=mergeImport(DEFAULT_STATE(),bundel).dvm;
 assert.equal(terug.storingshistorie[0].rijen.length,2);assert.equal(terug.liveStoringen[0].rijen.length,1);
 assert.equal(terug.dripHistorie.sources[0].incidenten.length,1);assert.equal(terug.uRoutes.rijen.length,1);assert.equal(terug.werkzaamheden.rijen.length,1);
 assert.equal(terug.bronbeheer.signaalgeverTotaal.historie,2);assert.equal(terug.bronbeheer.dripTotaal.incidenten,1);
});
test('samenhang volgt alleen expliciete koppeling en beide eigen normen',()=>{const d={diensten:[{id:'im',naam:'IM',norm:99,besch:98}]},b={functies:[{id:'f',naam:'Verkeersleiding',benodigd:10,actueel:8}],triggers:[]};assert.equal(combine(d,b,[]).length,1);const t=combine(d,b,[{dienst:'im',functie:'f'},{dienst:'im',functie:'f'}]);assert.equal(t.length,2);b.functies[0].actueel=12;assert.equal(combine(d,b,[{dienst:'im',functie:'f'}]).length,1);});
test('onbekende beschikbaarheid geeft geen bewezen normoverschrijding',()=>assert.equal(combine({diensten:[{id:'im',norm:99,besch:null}]},null,[]).length,0));
test('onveilige JSON-objecten worden afgewezen',()=>assert.throws(()=>validate(JSON.parse('{"__proto__":{"admin":true}}'))));
test('kwaliteitsaudit en scorehistorie gaan alleen mee als kwaliteit is geselecteerd',()=>{
 const s=DEFAULT_STATE();s.qualityAudit={score:88};s.qualityHistory=[{score:80},{score:88}];
 const zonder=makeExport(s,new Set(['links']));assert.equal(zonder.delen.qualityAudit,undefined);
 const met=makeExport(s,new Set(['quality']));assert.equal(met.delen.qualityAudit.score,88);assert.equal(met.delen.qualityHistory.length,2);
 const hersteld=mergeImport(DEFAULT_STATE(),met);assert.equal(hersteld.qualityAudit.score,88);assert.equal(hersteld.qualityHistory.length,2);
});
test('expertduidingen gaan selectief mee en een ontbrekend veld blijft bij deelimport behouden',()=>{
 const s=DEFAULT_STATE();s.expertReviews=[{dienstId:'im',status:'concept',context:{doel:'Veilig afhandelen'}}];
 const zonder=makeExport(s,new Set(['links']));assert.equal(zonder.delen.expertReviews,undefined);
 const met=makeExport(s,new Set(['expertReviews']));assert.equal(met.delen.expertReviews[0].dienstId,'im');
 const bestaand=DEFAULT_STATE();bestaand.expertReviews=[{dienstId:'vm',status:'concept'}];
 assert.equal(mergeImport(bestaand,{formaat:'BiDash-integraal',versie:1,delen:{links:[]}}).expertReviews[0].dienstId,'vm');
 assert.equal(mergeImport(bestaand,met).expertReviews[0].dienstId,'im');
});
