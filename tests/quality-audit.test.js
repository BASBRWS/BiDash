import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runQualityAudit,QUALITY_CATEGORIES} from '../site/core/quality-audit.js';

const now='2026-09-16T10:00:00.000Z';
const state=()=>({
  dvm:{
    assetregister:{rijen:[{entityid:'a1'},{entityid:'a2'}]},
    liveStoringen:[{peildatum:'2026-09-15T08:00:00.000Z',rijen:[{id:'f1'}]}],
    storingshistorie:[{rijen:[{id:'h1'}]}],
    dripHistorie:{sources:[]},uRoutes:{rijen:[]},werkzaamheden:{rijen:[]},
    parameters:{diensten:[{id:'im',afh:{signalering:.6,drip:.4}}]}
  },
  bi:null,planning:null,links:[],history:[],qualityHistory:[]
});
const assets=[
  {key:'a1',tp:'MSI',weg:'A1',vc:'VC1'},
  {key:'a2',tp:'DRIP',weg:'A2',vc:'VC2'}
];
const faults=[{id:'f1',assetKey:'a2',typeId:'DRIP',code:'D9',start:'2026-09-15T07:00:00.000Z',weg:'A2',hm:10,naam:'DRIP A2',duurUren:2,rekenStatus:'Doorgerekend',impact:10}];
const summaries={dvm:{peildatum:'2026-09-15T08:00:00.000Z',diensten:[{id:'im',naam:'Incidentmanagement',norm:99,besch:99.5,dekking:1}],roads:[]}};

test('lege werkruimte wordt blokkerend en niet op koers beoordeeld',()=>{
  const report=runQualityAudit({state:{links:[]},summaries:{},now});
  assert.ok(report.blockers>=2);
  assert.equal(report.verdict.id,'off-track');
  assert.ok(report.score<70);
  assert.equal(report.categories.length,Object.keys(QUALITY_CATEGORIES).length);
});

test('complete synthetische DVM-keten is op koers',()=>{
  const report=runQualityAudit({state:state(),summaries,dvmAssets:assets,faults,now});
  assert.equal(report.blockers,0);
  assert.equal(report.verdict.id,'on-track');
  assert.ok(report.score>=85);
  assert.ok(report.findings.some(f=>f.title==='Assetsleutels zijn uniek'&&f.severity==='good'));
});

test('exact dienstpercentage naast niet-doorgerekende melding is blokkerend',()=>{
  const rows=[{...faults[0],impact:null,rekenStatus:'Geen passende foutregel'}];
  const report=runQualityAudit({state:state(),summaries,dvmAssets:assets,faults:rows,now});
  assert.ok(report.findings.some(f=>f.title==='Exact percentage ondanks onbekende impact'&&f.severity==='critical'));
  assert.equal(report.verdict.id,'off-track');
});

test('bronregels zonder publieke storingen signaleren een ketenbreuk',()=>{
  const report=runQualityAudit({state:state(),summaries,dvmAssets:assets,faults:[],now});
  assert.ok(report.findings.some(f=>f.title==='Storingsbron bereikt het dashboard niet'&&f.severity==='critical'));
});

/* Diensten zonder exact percentage (band), zodat de "exact ondanks onbekende
   impact"-blokker niet meespeelt en we de conflictbeoordeling los kunnen toetsen. */
const bandSummaries={dvm:{peildatum:'2026-09-15T08:00:00.000Z',diensten:[{id:'im',naam:'Incidentmanagement',norm:99,besch:null,lo:80,hi:100,dekking:.5}],roads:[]}};

test('een veilig geblokkeerd locatieconflict is een aandachtspunt, geen blokker',()=>{
  // Negen schone, gekoppelde meldingen zodat de koppelingsgraad gezond is (90%),
  // plus één veilig geblokkeerd conflict. Zo toetsen we de conflictbeoordeling los.
  const schoon=Array.from({length:9},(_,i)=>({id:'s'+i,assetKey:'a2',typeId:'DRIP',code:'D9',start:'2026-09-15T07:00:00.000Z',weg:'A2',richting:'L',hm:10+i,naam:'DRIP A2',rekenStatus:'Doorgerekend',impact:10,duurUren:2}));
  const conflict={id:'c1',assetKey:'',typeId:'DRIP',code:'D9',start:'2026-09-15T07:00:00.000Z',weg:'A2',hm:99,naam:'DRIP A2',rekenStatus:'Geen geldige koppeling',impact:null,duurUren:2,assetMatchStatus:'locatieconflict'};
  const report=runQualityAudit({state:state(),summaries:bandSummaries,dvmAssets:assets,faults:[...schoon,conflict],now});
  const veilig=report.findings.find(f=>f.title==='Locatieconflicten veilig geblokkeerd');
  assert.ok(veilig&&veilig.severity==='warning','veilig geblokkeerd conflict hoort een warning te zijn');
  assert.ok(!report.findings.some(f=>f.title==='Locatieconflict toch doorgerekend'),'er is geen lek, dus geen critical');
  // Het conflict alléén mag geen enkele blokker toevoegen.
  assert.equal(report.blockers,0,'een geblokkeerd conflict is geen blokker');
});

test('een conflict dat tóch een koppeling of impact kreeg is wél blokkerend',()=>{
  const gelekt={id:'c2',assetKey:'a1',typeId:'DRIP',code:'D9',start:'2026-09-15T07:00:00.000Z',weg:'A2',hm:10,naam:'DRIP A2',impact:12,assetMatchStatus:'locatieconflict'};
  const report=runQualityAudit({state:state(),summaries:bandSummaries,dvmAssets:assets,faults:[gelekt],now});
  const lek=report.findings.find(f=>f.title==='Locatieconflict toch doorgerekend');
  assert.ok(lek&&lek.severity==='critical','een gelekt conflict is critical');
  assert.ok(report.blockers>=1);
});

test('een geladen maar lege BI-werkruimte wordt niet als goed beoordeeld',()=>{
  const st=state();st.bi={assets:[],functies:[]};
  const report=runQualityAudit({state:st,summaries:{...summaries,bi:{functies:[]}},dvmAssets:assets,biAssets:[],faults,now});
  const bi=report.findings.find(f=>f.category==='continuity'&&/BI-werkruimte/.test(f.title));
  assert.equal(bi.title,'BI-werkruimte geladen maar leeg');
  assert.equal(bi.severity,'warning');
  assert.ok(!report.findings.some(f=>f.title==='BI-werkruimte aanwezig'));
});

test('een groot verschil tussen bron- en verwerkte assets wordt benoemd',()=>{
  const st=state();st.dvm.assetregister={rijen:Array.from({length:1000},(_,i)=>({entityid:'a'+i}))};
  const report=runQualityAudit({state:st,summaries,dvmAssets:assets,faults,now});
  const gap=report.findings.find(f=>f.title==='Bronregels en verwerkte assets verschillen');
  assert.ok(gap,'het verschil hoort te worden getoond');
  assert.equal(gap.severity,'warning');
  assert.equal(gap.metric,998);
});

test('duplicaten tellen alleen bij gelijk event-ID en bronbestand, niet op locatie alleen',()=>{
  const gemeen={typeId:'DRIP',code:'D9',start:'2026-09-15T07:00:00.000Z',weg:'A2',richting:'L',hm:10,assetKey:'a2'};
  // Zelfde locatie en foutcode, maar verschillend event-ID en bronbestand: geen duplicaat.
  const uniek=[{...gemeen,eventId:'E1',bron:'lijst-A.xlsx'},{...gemeen,eventId:'E2',bron:'lijst-B.xlsx'}];
  const rapportUniek=runQualityAudit({state:state(),summaries:bandSummaries,dvmAssets:assets,faults:uniek,now});
  assert.ok(!rapportUniek.findings.some(f=>f.title==='Mogelijke dubbele open storingen'),'verschillende bron/event mag niet als duplicaat gelden');
  // Identiek event-ID én bronbestand: wél een bronduplicaat.
  const echt=[{...gemeen,eventId:'E9',bron:'lijst-A.xlsx'},{...gemeen,eventId:'E9',bron:'lijst-A.xlsx'}];
  const rapportEcht=runQualityAudit({state:state(),summaries:bandSummaries,dvmAssets:assets,faults:echt,now});
  const dup=rapportEcht.findings.find(f=>f.title==='Mogelijke dubbele open storingen');
  assert.ok(dup&&dup.metric===1,'een echt bronduplicaat hoort te worden gemeld');
});

test('de verwerking van bronregels wordt uitgesplitst wanneer de engine dat meelevert',()=>{
  const st=state();
  const sum={dvm:{...summaries.dvm,stats:{totaal:703,toegepast:481,dubbel:8,nietGecl:0,zonderFoutregel:46,zonderLocatie:3},nietDoorgerekend:49}};
  const report=runQualityAudit({state:st,summaries:sum,dvmAssets:assets,faults,now});
  const split=report.findings.find(f=>f.title==='Verwerking van de actuele bronregels');
  assert.ok(split,'de uitsplitsing hoort te verschijnen');
  assert.match(split.detail,/703 bronregels/);
  assert.match(split.detail,/481 doorgerekend/);
  assert.match(split.detail,/8 ontdubbeld/);
  assert.match(split.detail,/46 zonder passende foutregel/);
});

test('kwaliteitstab, auditknop en lokale rapportexport zijn bedraad',()=>{
  const routes=readFileSync(new URL('../site/ui/routes.js',import.meta.url),'utf8');
  const index=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(routes,/\['quality','Kwaliteit','native','quality'\]/);
  assert.match(index,/id="runQualityAudit"/);
  assert.match(index,/id="qualityDashboard"/);
  assert.match(app,/runQualityAudit\(/);
  assert.match(app,/bidash-kwaliteitsaudit_/);
  assert.match(app,/qualityHistory=.*slice\(-12\)/);
});
