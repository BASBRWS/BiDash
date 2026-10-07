import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';

const road=(weg='A15',richting='RE',hm=25)=>({key:weg+'|'+richting,weg,richting,meldingen:[{hm,avail:80}]});
function runtime(){
  const r=dvmRuntime();
  r.fixture={schema:1,publication:'2026-01-05T07:01:00Z',files:['synthetic.xml'],sha256:['synthetic'],stats:{sites:2,validSites:2},sites:[
    {id:'TEST_A',road:'A015',direction:'R',hm:25.1,q:900,period:60,time:'2026-01-05T07:00:00Z',speed:100,lanes:[{lane:'1',index:'1',q:900}],issues:[]},
    {id:'TEST_N',road:'N15',direction:'RE',hm:25.1,q:300,period:60,time:'2026-01-05T07:00:00Z',speed:80,lanes:[{lane:'1',index:'1',q:300}],issues:[]}
  ]};
  vm.runInContext('RULES.kosten={...kostenBasis(),ndw69Snapshot:fixture}',r);
  return r;
}
test('NDW-index en wegdelen gebruiken dezelfde weg- en richtingssleutel',()=>{
  const r=runtime();
  assert.equal(r.ndw69Link(road()).s?.id,'TEST_A');
  assert.equal(r.ndw69Link(road(' a 015 ','rechts')).s?.id,'TEST_A');
  assert.equal(r.ndw69Link(road('15')).s?.id,'TEST_A');
});
test('A- en N-wegen blijven afzonderlijke verkeersstromen',()=>{
  const r=runtime();
  assert.equal(r.ndw69Link(road('N015')).s?.id,'TEST_N');
  assert.equal(r.ndw69Candidates(road()).length,1);
});
test('tegengestelde richting blijft uitgesloten, ruimere afstand wordt gekoppeld',()=>{
  const r=runtime();
  assert.equal(r.ndw69Candidates(road('A15','LI')).length,0);
  const w=road('A15','RE',27),link=r.ndw69Link(w);
  assert.equal(link.s?.id,'TEST_A');
  assert.ok(link.found.distance>1);
  assert.equal(r.sc67Config(w).ndwUsed.extended,true);
  assert.match(r.ndw69LinkStatus(w),/Ruimere koppeling/);
});
test('gekoppelde NDW-intensiteit wordt daadwerkelijk scenario-invoer',()=>{
  const r=runtime(),c=r.ndw69Enrich(road(),{q:'',uren:6,reductie:30,snelheid:100});
  assert.equal(c.q,900);
  assert.equal(c.ndwUsed?.id,'TEST_A');
  assert.equal(c.ndwAuto,true);
});

test('alle vijftig passende wegdelen krijgen intensiteit en kosten, ook buiten één kilometer',()=>{
  const r=runtime();
  r.rows=Array.from({length:50},(_,i)=>({...road('A15','RE',25+i*2),key:'TEST_'+i}));
  vm.runInContext("RULES.kosten.scenario67={uren:6,reductie:30,km:2,bron:'Synthetisch scenario'}",r);
  assert.equal(r.rows.filter(w=>r.sc67Config(w).q===900).length,50);
  const results=r.rows.map(w=>r.kostenDagResultaat(w));
  assert.equal(results.filter(z=>z.kosten!=null).length,50);
  assert.ok(results.every(z=>z.kosten>0));
  assert.match(r.ndw69Summary(r.rows),/50 van 50 wegdelen/);
});

test('dichtstbijzijnde geldige meting heeft voorrang boven ongeldige lokale meting',()=>{
  const r=runtime();
  r.fixture.sites.push({...r.fixture.sites[0],id:'INVALID_LOCAL',hm:27,q:null,issues:['onvolledig']});
  const w=road('A15','RE',27);
  assert.equal(r.ndw69Link(w).s.id,'TEST_A');
  assert.equal(r.sc67Config(w).q,900);
});

test('opgeslagen meetpunt dat ontbreekt of ongeldig is krijgt een geldig nieuw voorstel',()=>{
  const r=runtime(),w=road();
  r.key=w.key;
  vm.runInContext("RULES.kosten.ndw69={[key]:{siteId:'OLD_SITE',confirmed:true,confirmationKey:'oud'}}",r);
  assert.equal(r.ndw69Link(w).s.id,'TEST_A');
  assert.equal(r.ndw69Link(w).confirmed,false);
  r.fixture={...r.fixture,sites:[...r.fixture.sites,{...r.fixture.sites[0],id:'OLD_SITE',q:null,issues:['onvolledig']}]};
  vm.runInContext('RULES.kosten.ndw69Snapshot=fixture',r);
  assert.equal(r.ndw69Link(road()).s.id,'TEST_A');
});

test('geen meting of hectometer blijft zichtbaar en onbekend, nulmeting blijft nul',()=>{
  const r=runtime(),missing=road('A15','LI');
  assert.equal(r.sc67Config(missing).q,'');
  assert.equal(r.kostenDagResultaat(missing).kosten,null);
  assert.match(r.ndw69LinkStatus(missing),/Geen meetlocatie op dezelfde weg en rijrichting/);
  assert.match(r.ndw69Summary([missing]),/Geen meetlocatie op dezelfde weg en rijrichting/);
  assert.match(r.ndw69Editor(missing),/Geen meetlocatie op dezelfde weg en rijrichting/);
  assert.doesNotMatch(r.ndw69Editor(missing),/\$\{/);
  const noHm=road('A15','RE',null);
  assert.equal(r.ndw69Link(noHm).s,null);
  assert.match(r.ndw69LinkStatus(noHm),/Hectometer/);
  r.fixture.sites[0].q=0;
  assert.equal(r.sc67Config(road()).q,0);
});

test('handmatige invoer en bewust uitgezet NDW-gebruik blijven gerespecteerd',()=>{
  const r=runtime(),w=road();
  assert.equal(r.ndw69Enrich(w,{q:1200}).q,1200);
  r.key=w.key;
  vm.runInContext('RULES.kosten.ndw69={[key]:{disabled:true}}',r);
  assert.equal(r.sc67Config(w).q,'');
  assert.match(r.ndw69LinkStatus(w),/uitgezet/);
});
