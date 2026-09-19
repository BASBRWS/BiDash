import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBiDashContext,faultsForService,planningForFaults,worksForFaults} from '../site/core/context-api.js';
import {answerQuestion,parseQuestion} from '../site/core/query-assistant.js';

const services=[{
  id:'im',naam:'Incidentmanagement',norm:99,besch:97.8,lo:97.8,hi:97.8,
  subprocessen:[
    {naam:'Incident detecteren',aandeelDienst:.4,bronnen:[{typeId:'LUS',gewicht:.7,status:'actueel'},{typeId:'CAM',gewicht:.3,status:'actueel'}]},
    {naam:'Maatregelen tonen',aandeelDienst:.6,bronnen:[{typeId:'MSI',gewicht:1,status:'actueel'}]}
  ]
}];
const faults=[
  {id:'m1',assetKey:'A1',naam:'MSI A15',typeId:'MSI',weg:'A15',vc:'ZWN',code:'1003',impact:100,bijdrageAvail:24},
  {id:'l1',assetKey:'L1',naam:'LUS A15',typeId:'LUS',weg:'A15',vc:'ZWN',code:'1006',impact:40,bijdrageAvail:8},
  {id:'m2',assetKey:'A2',naam:'MSI A12',typeId:'MSI',weg:'A12',vc:'ZWN',code:'1001',impact:20,bijdrageAvail:2}
];
const functions=[{id:'f1',naam:'Wegverkeersleider',benodigd:12,actueel:10}];
const dvm={
  services,
  works:[{id:'w1',weg:'A15',startMs:Date.UTC(2026,9,1),eindMs:Date.UTC(2026,9,20),assetKeys:['A1'],uRoutes:['U12'],omschrijving:'asfaltwerk'}],
  uroutes:[{id:'u1',uRoute:'U12',weg:'A15',assetKeys:['A1']}],
  eol:{loaded:true,count:12,bestand:'eol.xlsx'},
  historySources:[{key:'h1',naam:'historie 2026',count:100,doel:'prognose'}]
};
const bi={
  planning:{
    bestand:'planning.xml',nRel:2,nCross:1,shift:0,
    regels:[
      {id:'p1',naam:'A15 vervanging',code:'P1',kind:'bar',blok:'B1',dienst:'VWM',t0:2026.75,t1:2027,roads:['A15']},
      {id:'p2',naam:'A12 onderhoud',code:'P2',kind:'bar',blok:'B2',dienst:'GPO',t0:2026.5,t1:2026.8,roads:['A12']}
    ],
    relaties:[{from:'p1',to:'p2',type:'FS'}]
  },
  capacity:{
    geconfig:true,nTaken:2,nMetFte:2,totFte:8,
    kwartalen:[{label:'Q4 26',jaar:2026,q:4,tot:8,per:{VWM:6,GPO:2}}],
    perDienst:{VWM:{piek:6,piekKw:'Q4 26',grens:5,overKw:1},GPO:{piek:2,piekKw:'Q4 26',grens:3,overKw:0}}
  },
  functions,
  triggers:[]
};
const state={dvm:{assetregister:{rijen:[{}]},liveStoringen:[{rijen:[{},{},{}]}],werkzaamheden:{rijen:[{}]},uRoutes:{rijen:[{}]},eol:{regels:new Array(12)}},bi:{},planning:{xml:'<x/>'},links:[{dienst:'im',functie:'f1',eigenaar:'VWM'}],history:[]};
const context=buildBiDashContext({faults,assets:[],roads:[],services,functions,dvm,bi,links:state.links,state});

test('Context API legt storing via assettype aan dienstverlening',()=>{
  const rows=faultsForService(context,'im');
  assert.equal(rows.length,3);
  const msi=rows.find(x=>x.id==='m1');
  assert.ok(msi.serviceLinks.some(x=>x.serviceId==='im'));
  assert.ok(msi.gewogenVerlies>0);
});

test('Context API koppelt planning aan storing via corridor',()=>{
  const rows=planningForFaults(context,[faults[0]]);
  assert.deepEqual(rows.map(x=>x.id),['p1']);
});

test('Context API koppelt werkzaamheden aan storing via asset of weg',()=>{
  const rows=worksForFaults(context,[faults[0]]);
  assert.deepEqual(rows.map(x=>x.id),['w1']);
});

test('vraag waarom dienstverlening laag is gebruikt relatieketen',()=>{
  const answer=answerQuestion('Waarom is Incidentmanagement onder de norm?',{data:context});
  assert.equal(answer.context.dataset,'relations');
  assert.match(answer.title,/Storing/);
  assert.ok(answer.rows.some(r=>r.naam==='MSI A15'));
  assert.match(answer.note,/subprocess/);
});

test('planningvraag levert echte activiteiten',()=>{
  const answer=answerQuestion('Wat staat er gepland op de A15 in Q4 2026?',{data:context});
  assert.equal(answer.context.dataset,'planning');
  assert.equal(answer.rows.length,1);
  assert.equal(answer.rows[0].naam,'A15 vervanging');
});

test('capaciteitsvraag toont overschrijding uit bestaande planning',()=>{
  const answer=answerQuestion('Waar wordt de capaciteit overschreden?',{data:context});
  assert.equal(answer.context.dataset,'capacity');
  assert.equal(answer.rows.length,1);
  assert.equal(answer.rows[0].dienst,'VWM');
});

test('planning en storingen worden corridor-gebaseerd verbonden',()=>{
  const answer=answerQuestion('Welke planning valt samen met storingen op de A15?',{data:context});
  assert.equal(answer.context.dataset,'relations');
  assert.equal(answer.title,'Planning ↔ open storingen');
  assert.equal(answer.rows[0].naam,'A15 vervanging');
});

test('werkzaamheden en storingen worden via bestaande koppeling verbonden',()=>{
  const answer=answerQuestion('Welke werkzaamheden raken de storingen op de A15?',{data:context});
  assert.equal(answer.context.dataset,'relations');
  assert.equal(answer.title,'Werkzaamheden ↔ open storingen');
  assert.equal(answer.rows[0].id,'w1');
});

test('dienstverlening en formatie gebruiken expliciete links',()=>{
  const answer=answerQuestion('Welke formatie is gekoppeld aan Incidentmanagement?',{data:context});
  assert.equal(answer.context.dataset,'relations');
  assert.equal(answer.title,'Dienstverlening ↔ formatie');
  assert.equal(answer.rows[0].naam,'Wegverkeersleider');
  assert.equal(answer.rows[0].tekort,'2');
});

test('parser onthoudt planningcontext bij doorvragen',()=>{
  const first=parseQuestion('Wat staat er gepland op A15 in Q4 2026?',{data:context});
  const next=parseQuestion('En alleen VWM?',{data:context,previousContext:first.context});
  assert.equal(next.context.filters.road,'A15');
  assert.equal(next.context.filters.year,2026);
  assert.equal(next.context.filters.quarter,4);
  assert.equal(next.context.planningDienst,'VWM');
});


test('dienststoringen worden doorgekoppeld naar planning',()=>{
  const answer=answerQuestion('Welke planning raakt Incidentmanagement?',{data:context});
  assert.equal(answer.context.dataset,'relations');
  assert.equal(answer.title,'Dienstverlening ↔ storingen ↔ planning');
  assert.ok(answer.rows.some(r=>r.naam==='A15 vervanging'));
});

test('dienststoringen worden doorgekoppeld naar werkzaamheden',()=>{
  const answer=answerQuestion('Welke werkzaamheden raken Incidentmanagement?',{data:context});
  assert.equal(answer.context.dataset,'relations');
  assert.equal(answer.title,'Dienstverlening ↔ storingen ↔ werkzaamheden');
  assert.equal(answer.rows[0].id,'w1');
});

test('planningafhankelijkheden komen uit het planningmodel',()=>{
  const answer=answerQuestion('Welke afhankelijkheden zijn er in de planning?',{data:context});
  assert.equal(answer.context.dataset,'planning');
  assert.equal(answer.title,'Planningafhankelijkheden');
  assert.equal(answer.rows[0].from,'A15 vervanging');
  assert.equal(answer.rows[0].to,'A12 onderhoud');
});


test('projectvraag verbreekt oude dienstcontext en herkent meerdere kwartalen',()=>{
  const previous={dataset:'relations',filters:{vc:'ZWN',typeId:'DRIP'},serviceId:'im'};
  const parsed=parseQuestion('Welke projecten spelen er in Q3 en Q4 in 2027?',{data:context,previousContext:previous});
  assert.equal(parsed.context.dataset,'planning');
  assert.equal(parsed.context.serviceId,null);
  assert.equal(parsed.context.filters.vc,undefined);
  assert.equal(parsed.context.filters.typeId,undefined);
  assert.deepEqual(parsed.context.filters.quarters,[3,4]);
  assert.equal(parsed.context.filters.periodLabel,'Q3 + Q4 2027');
});

test('brede periodetermen worden deterministisch vertaald',()=>{
  const cases=[
    ['Welke projecten lopen in de tweede helft van 2027?','tweede helft 2027'],
    ['Wat staat er gepland in het najaar van 2027?','najaar 2027'],
    ['Welke projecten lopen van april tot oktober 2027?','apr–okt 2027'],
    ['Welke projecten lopen in 2027 en 2028?','2027–2028'],
    ['Welke projecten lopen tot eind 2027?','tot eind 2027']
  ];
  for(const [question,label] of cases){
    const parsed=parseQuestion(question,{data:context});
    assert.equal(parsed.context.dataset,'planning',question);
    assert.equal(parsed.context.filters.periodLabel,label,question);
    assert.ok(parsed.context.filters.periodRanges?.length,question);
  }
});

test('relatieve periode ondersteunt komende maanden, kwartalen en jaren',()=>{
  for(const question of ['Welke projecten lopen in de komende 6 maanden?','Welke projecten lopen in de komende 2 kwartalen?','Welke projecten lopen in de komende 2 jaar?']){
    const parsed=parseQuestion(question,{data:context});
    assert.equal(parsed.context.dataset,'planning');
    assert.ok(parsed.context.filters.periodRanges?.length);
  }
});

test('nieuwe onbekende vraag neemt niet stilzwijgend vorige dienstcontext over',()=>{
  const previous={dataset:'relations',filters:{vc:'ZWN'},serviceId:'im'};
  const parsed=parseQuestion('Hoe zit het met contractmanagement?',{data:context,previousContext:previous});
  assert.notEqual(parsed.context.dataset,'relations');
  assert.equal(parsed.context.serviceId,null);
});
