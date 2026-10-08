import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import {makeExport,mergeImport,DEFAULT_STATE} from '../site/core/model.js';
import {simulateSignalForecast} from '../site/core/signal-forecast-original.js';

const row=(code,van,tot,extra={})=>({Code:code,Verkeerscentrale:'VC Zuidwest-Nederland (Rhoon)',Rijksweg:'A15',Netwerkschakel:'Testschakel '+code,'HMP van':van,'HMP tot':tot,Status:'Voorlopig',...extra});
const asset=(key,hm,tp='MSI',richting='RE',extra={})=>({key,tp,assetType:tp,naam:key,weg:'A15',hm,richting,vc:'ZWN',prognoseActief:true,bouwjaar:2020,...extra});
const fault=(hm,code='1003',extra={})=>({locatie:'A15 RE '+hm,weg:'A15',richting:'RE',hm,vc:'ZWN',foutcode:code,assetType:'MSI',melding:'Lamp(en) defect',start:'2026-01-01T06:00:00Z',...extra});
function runtime(rows=[row('T1',0,10),row('T2',10,20)]){
 const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);
 vm.runInContext(readFileSync(new URL('../site/engines/dvm-netwerkschakels.js',import.meta.url),'utf8'),r);
 r.fixture=rows;r.eval('herstelNetwerkschakels({bestand:"synthetic.xlsx",rijen:fixture})');return r;
}
function calculate(r,assets,faults){r.fixtureAssets=assets;r.fixtureFaults=faults;r.eval('ASSET_REGISTER_STATE={assets:fixtureAssets};bouwAssetIndex();STATE=doorrekenen(fixtureFaults,{actueel:true,peildatum:Date.parse("2026-01-02T06:00:00Z")})');return r.eval('STATE');}
test('matrixgrenzen, aflopende HMP, nul, VC en A/N zijn expliciet',()=>{
 const r=runtime([row('T1','0','10,6'),row('T2',20,10.6)]);
 assert.equal(r.koppelNetwerkschakel(asset('a',0)).schakel.code,'T1');
 assert.equal(r.koppelNetwerkschakel(asset('a',10.6)).schakel.code,'T2');
 assert.equal(r.koppelNetwerkschakel(asset('a',20)).schakel.code,'T2');
 assert.ok(r.koppelNetwerkschakel(asset('a',null)).reden);
 assert.ok(r.koppelNetwerkschakel(asset('a',5,'MSI','RE',{weg:'N15'})).reden);
 assert.ok(r.koppelNetwerkschakel(asset('a',5,'MSI','RE',{vc:'ZN'})).reden);
 const east=runtime([row('O1',0,10,{Verkeerscentrale:'VC Noord- en Oost-Nederland (Wolfheze)'})]);
 assert.equal(east.koppelNetwerkschakel(asset('e',5,'MSI','RE',{vc:'NON'})).schakel.code,'O1');
});
test('echte overlap wordt niet willekeurig toegewezen, meerdere regels per code blijven één schakel',()=>{
 const r=runtime([row('T1',0,12),row('T2',10,20)]);
 assert.match(r.koppelNetwerkschakel(asset('a',11)).reden,/Meerdere/);
 const m=runtime([row('T1',0,5),row('T1',10,15)]);
 assert.equal(m.netwerkRapportRijen().length,1);
 assert.equal(m.koppelNetwerkschakel(asset('a',12)).schakel.code,'T1');
 assert.ok(m.koppelNetwerkschakel(asset('a',7)).reden);
});
test('zijdefilter is rijrichting, HMP-richting wordt daar niet voor gebruikt',()=>{
 const r=runtime([row('T1',0,10,{Zijde:'R','Richting HMP':'aflopend'})]);
 assert.equal(r.koppelNetwerkschakel(asset('a',5)).schakel.code,'T1');
 assert.ok(r.koppelNetwerkschakel(asset('a',5,'MSI','LI')).reden);
});
test('ongeldige matrix beschadigt de bestaande bron niet',()=>{
 const r=runtime(),before=r.DVM_NETWERKSCHAKELS_STATE;
 assert.throws(()=>r.herstelNetwerkschakels({rijen:[row('BROKEN','',10)]}),/Ongeldige/);
 assert.equal(r.DVM_NETWERKSCHAKELS_STATE,before);
 assert.throws(()=>r.normaliseerNetwerkschakels([row('T',0,10),row('T',0,10)]),/Dubbele/);
});
test('doorrekening gebruikt lokaal schakelareaal, niet tweemaal het hele wegareaal',()=>{
 const r=runtime(),s=calculate(r,[asset('a',2),asset('b',3),asset('c',12),asset('d',13),asset('e',14),asset('f',15)],[fault(2),fault(12)]);
 assert.equal(s.wegdelen.length,2);
 const t1=s.wegdelen.find(w=>w.netwerkschakel==='T1'),t2=s.wegdelen.find(w=>w.netwerkschakel==='T2');
 assert.equal(t1.N,2);assert.equal(t2.N,4);
 assert.equal(t1.besch,100-t1.typeBron.MSI.availUren/(2*24)*100);
 assert.equal(t2.besch,100-t2.typeBron.MSI.availUren/(4*24)*100);
 assert.equal(t1.meldingen[0].trace.wegdeel,t1.key);
 assert.equal(t1.meldingen[0].wegKey,t1.key);
 const d=r.eval('DIENSTEN')[0];
 assert.ok(Math.abs(s.netwerk[d.id].besch-(t1.diensten[d.id].besch*2+t2.diensten[d.id].besch*4)/6)<.01);
 assert.equal(r.netwerkRapportRijen().length,2);
});
test('rijrichtingen, LUS, camera en DRIP houden aparte noemers en type-impact',()=>{
 const r=runtime(),assets=[asset('m1',2),asset('m2',2,'MSI','LI'),asset('l1',3,'LUS'),asset('l2',4,'LUS'),asset('c1',4,'CAM'),asset('d1',5,'DRIP')];
 const s=calculate(r,assets,[fault(3,'1006',{melding:'Beide lussen fout',assetType:'LUS'})]);
 const right=s.wegdelen.find(w=>w.richting==='RE'),left=s.wegdelen.find(w=>w.richting==='LI');
 assert.equal(right.typeBron.LUS.N,2);assert.equal(right.typeBron.LUS.n,1);
 assert.equal(right.typeBron.CAM.N,1);assert.equal(right.typeBron.DRIP.N,1);
 assert.equal(left.n,0);assert.equal(left.besch,100);
 assert.ok(right.diensten.incident||Object.values(right.diensten).some(d=>d.besch<100));
});
test('register buiten de matrix en ontbrekende HMP blijven apart, zonder dubbele noemer',()=>{
 const r=runtime(),s=calculate(r,[asset('a',2),asset('outside',25)],[fault(25),fault('', '1003',{locatie:'A15 RE',hm:null})]);
 assert.ok(s.wegdelen.some(w=>!w.netwerkschakel&&w.n));
 assert.equal(s.wegdelen.find(w=>w.netwerkschakel==='T1').N,1);
 assert.equal(s.meldingen.length,2);
 assert.match(r.netwerkRapportHtml(),/apart zichtbaar/);
});
test('niet doorgerekende meldingen zijn gekoppeld zichtbaar en worden geen gezond percentage',()=>{
 const r=runtime();calculate(r,[asset('loop',3,'LUS')],[fault(3,'UNKNOWN',{assetType:'LUS',melding:'Detector onbekende fout'})]);
 const rows=r.netwerkRapportRijen();assert.equal(rows[0].blinde,1);assert.equal(rows[0].besch,null);
 assert.ok(Object.values(rows[0].diensten).every(x=>x===null));
 assert.match(r.netwerkRapportHtml(),/Niet doorgerekend/);
});
test('NDW en verkeerskosten rekenen op aparte schakels met matrixlengte en juiste rijrichting',()=>{
 const r=runtime(),s=calculate(r,[asset('a',2),asset('b',12),asset('left',2,'MSI','LI')],[fault(2),fault(12)]);
 r.fixtureTraffic={schema:1,publication:'2026-01-02T06:00:00Z',files:['synthetic'],sha256:['synthetic'],stats:{},sites:[
  {id:'RIGHT',road:'A15',direction:'RE',hm:3,q:900,speed:100,time:'2026-01-02T06:00:00Z',lanes:[{q:900}],issues:[]},
  {id:'LEFT',road:'A15',direction:'LI',hm:3,q:200,speed:100,time:'2026-01-02T06:00:00Z',lanes:[{q:200}],issues:[]}
 ]};r.eval("RULES.kosten={...kostenBasis(),ndw69Snapshot:fixtureTraffic,scenario67:{uren:2,reductie:20,bron:'Synthetisch scenario'}}");
 const w=s.wegdelen.find(w=>w.netwerkschakel==='T1'&&w.richting==='RE'),c=r.sc67Config(w);
 assert.equal(c.km,10);assert.equal(c.q,900);assert.equal(c.ndwUsed.id,'RIGHT');
 const z=r.kostenDagResultaat(w),delay=10/100*60/(1-.2*r.sc67Severity(w))-6;
 assert.ok(Math.abs(z.vvu-900*2*delay/60)<1e-9);assert.ok(z.kosten>0);
 r.eval('RULES.kosten.scenario67.uren=""');assert.equal(r.kostenDagResultaat(w).kosten,null);
});
test('historiereeksen en leeftijdscohorten worden niet over andere schakels hergebruikt',()=>{
 const r=runtime(),s=calculate(r,[asset('a',2),asset('b',12)],[fault(2),fault(12)]);
 r.history=s;r.eval('STORINGS_INSPECTIE={typen:{MSI:{dekkingDagen:365.25}}};history.meldingen.forEach(m=>{m.duurBetrouwbaar=true;m.duurUren=24});MC_HISTORIE_LIVE=bouwLiveMcHistorie(history)');
 const h=r.eval('MC_HISTORIE_LIVE');assert.equal(Object.keys(h.wegdelen).length,2);
 const wd=s.wegdelen[0];assert.equal(r.mcHistVoor(wd.vc,wd.weg,wd.richting,wd.N,wd).events,1);
 const build=r.f71Build();assert.equal(build.groups.length,2);
});
test('totaalexport, deelimport en integrale export bewaren matrix apart van parameters',()=>{
 const r=runtime();r.eval('ASSET_REGISTER_STATE={assets:[],ruweRegisterRijen:[],bestand:"synthetic"}');
 const full=r.totaalExportBundle();assert.equal(full.netwerkschakels.rijen.length,2);
 assert.equal(r.totaalExportBundle({netwerkschakels:false}).netwerkschakels,null);
 r.herstelNetwerkschakels(full.netwerkschakels);assert.equal(r.netwerkRapportRijen().length,2);
 const state={...DEFAULT_STATE(),dvm:full},b=makeExport(state,new Set(['netwerkschakels']));
 assert.equal(b.delen.dvm.netwerkschakels.rijen.length,2);assert.equal(b.delen.dvm.parameters,undefined);
 const merged=mergeImport(state,b);assert.equal(merged.dvm.netwerkschakels.rijen.length,2);
 const no=makeExport(state,new Set(['parameters']));assert.equal(no.delen.dvm.netwerkschakels,undefined);
 assert.equal(mergeImport(state,no).dvm.netwerkschakels.rijen.length,2);
});
test('echte totaalimport herstelt matrix, respecteert deelimport en wist bij volledige vervanging',async()=>{
 const r=runtime();r.uiPauze=async()=>{};r.alert=()=>{};r.confirm=()=>true;
 r.renderAlles=()=>{};r.renderDataGereedheid=()=>{};r.renderDatasetBeheer=()=>{};r.toonTab=()=>{};
 r.eval('ASSET_REGISTER_STATE={assets:[],ruweRegisterRijen:[],bestand:"synthetic"};bouwAssetIndex()');
 const restore=async(b,modus)=>r.totaalImportJson({name:'synthetic.json',text:async()=>JSON.stringify(b)},modus);
 const base={formaat:'DVM-dienstimpact-totaal',versie:54};
 await restore({...base,netwerkschakels:{bestand:'replacement.xlsx',rijen:[row('NEW',20,30)]}},'merge');
 assert.equal(r.DVM_NETWERKSCHAKELS_STATE.schakels[0].code,'NEW');
 await restore({...base,exportSelectie:{netwerkschakels:false},netwerkschakels:null},'vervang');
 assert.equal(r.DVM_NETWERKSCHAKELS_STATE.schakels[0].code,'NEW');
 await restore(base,'merge');assert.equal(r.DVM_NETWERKSCHAKELS_STATE.schakels[0].code,'NEW');
 await restore(base,'vervang');assert.equal(r.netwerkschakelsActief(),false);
});
test('Excel upload kiest het matrixblad en een mislukte upload behoudt de bron',async()=>{
 const r=runtime();vm.runInContext(readFileSync(new URL('../site/vendor/xlsx.full.min.js',import.meta.url),'utf8'),r);
 r.fixtureRows=[row('NEW',10,0)];
 r.eval('testBook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(testBook,XLSX.utils.json_to_sheet([{Toelichting:"Geen matrix"}]),"Toelichting");XLSX.utils.book_append_sheet(testBook,XLSX.utils.json_to_sheet(fixtureRows),"Matrix");testBytes=XLSX.write(testBook,{type:"array",bookType:"xlsx"})');
 let rebuilds=0;r.datasetNaMutatie=async()=>{rebuilds++;};r.uiPauze=async()=>{};r.importKlaar=()=>{};
 await r.leesNetwerkschakelBestand({name:'synthetic.xlsx',arrayBuffer:async()=>r.eval('testBytes')});
 assert.equal(rebuilds,1);assert.equal(r.DVM_NETWERKSCHAKELS_STATE.schakels[0].code,'NEW');
 const saved=r.DVM_NETWERKSCHAKELS_STATE;
 r.eval('testBook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(testBook,XLSX.utils.json_to_sheet([{Uitleg:"Leeg"}]),"Uitleg");testBytes=XLSX.write(testBook,{type:"array",bookType:"xlsx"})');
 await assert.rejects(r.leesNetwerkschakelBestand({name:'broken.xlsx',arrayBuffer:async()=>r.eval('testBytes')}),/geen regels/);
 assert.equal(r.DVM_NETWERKSCHAKELS_STATE,saved);assert.equal(rebuilds,1);
});
test('WIS-prognose gebruikt schakelgroepen en matrixlengte, wissen herstelt wegindeling',async()=>{
 const r=runtime();calculate(r,[asset('a',2),asset('b',12)],[]);
 const assets=r.eval('ASSET_REGISTER_STATE.assets');
 const result=await simulateSignalForecast(assets,{mcRuns:100,startYear:2026,endYear:2027,referenceYear:2026});
 assert.equal(result.roads.length,2);assert.ok(result.roads.every(w=>w.routeKm===10&&w.netwerkschakel));
 assert.ok(result.assets.every(a=>a.share===1));
 r.herstelNetwerkschakels(null);
 const old=await simulateSignalForecast(assets,{mcRuns:100,startYear:2026,endYear:2027,referenceYear:2026});
 assert.equal(old.roads.length,1);assert.equal(old.roads[0].netwerkschakel,'');
});
