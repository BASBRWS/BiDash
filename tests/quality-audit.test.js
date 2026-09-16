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
