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
test('tegengestelde richting en meer dan één kilometer blijven uitgesloten',()=>{
  const r=runtime();
  assert.equal(r.ndw69Candidates(road('A15','LI')).length,0);
  assert.equal(r.ndw69Candidates(road('A15','RE',27)).length,0);
});
test('gekoppelde NDW-intensiteit wordt daadwerkelijk scenario-invoer',()=>{
  const r=runtime(),c=r.ndw69Enrich(road(),{q:'',uren:6,reductie:30,snelheid:100});
  assert.equal(c.q,900);
  assert.equal(c.ndwUsed?.id,'TEST_A');
  assert.equal(c.ndwAuto,true);
});
