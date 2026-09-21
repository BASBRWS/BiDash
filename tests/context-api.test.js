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
const state={dvm:{assetregister:{rijen:[{}]},liveStoringen:[{rijen:[{},{},{}]}],werkzaamheden:{rijen:[{}]},uRoutes:{rijen:[{}]}},bi:{},planning:{xml:'<x/>'},links:[{dienst:'im',functie:'f1',eigenaar:'VWM'}],history:[]};
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


test('onbekende term uit planning wordt dynamisch als planning herkend',()=>{
  const local=buildBiDashContext({
    faults:[],assets:[],roads:[],services:[],functions:[],dvm:{},
    bi:{planning:{bestand:'test.xml',regels:[
      {id:'ifat1',naam:'Systeemtest IFAT verkeerscentrale',code:'IFAT-01',kind:'mile',blok:'Testen',dienst:'VWM',wbs:'TEST',wbsPath:['VWM','Testen','IFAT'],t0:2027.25,t1:2027.25},
      {id:'ifat2',naam:'Tweede IFAT keten',code:'IFAT-02',kind:'mile',blok:'Testen',dienst:'VWM',wbs:'TEST',wbsPath:['VWM','Testen','IFAT'],t0:2028,t1:2028}
    ],relaties:[],nRel:0,nCross:0,shift:0},functions:[]},links:[],state:{dvm:{},history:[]}
  });
  const previous={dataset:'relations',filters:{vc:'ZWN'},serviceId:'im'};
  const answer=answerQuestion('Wanneer is de eerst volgende IFAT?',{data:local,previousContext:previous});
  assert.equal(answer.context.dataset,'planning');
  assert.equal(answer.context.serviceId,null);
  assert.equal(answer.context.filters.planningLabel,'IFAT');
  assert.equal(answer.title,'Planningterm · IFAT');
  assert.equal(answer.rows[0].naam,'Systeemtest IFAT verkeerscentrale');
  assert.match(answer.text,/eerstvolgende/i);
});

test('planningcode en WBS-pad zijn dynamisch bevraagbaar',()=>{
  const local=buildBiDashContext({
    faults:[],assets:[],roads:[],services:[],functions:[],dvm:{},
    bi:{planning:{bestand:'test.xml',regels:[
      {id:'x1',naam:'Validatie bediening',code:'VAL-77',kind:'bar',blok:'Integratie',dienst:'VWM',wbs:'WBS-900',wbsPath:['Programma X','Integratie','Gate-Z'],t0:2027.5,t1:2027.75}
    ],relaties:[],nRel:0,nCross:0,shift:0},functions:[]},links:[],state:{dvm:{},history:[]}
  });
  for(const question of ['Wanneer is VAL-77?','Wanneer is WBS-900?','Wanneer is Gate-Z?']){
    const answer=answerQuestion(question,{data:local});
    assert.equal(answer.context.dataset,'planning',question);
    assert.equal(answer.rows[0].naam,'Validatie bediening',question);
  }
});


test('oudste asset gebruikt installatiedatum uit All Assets',()=>{
  const local={assets:[
    {key:'a1',source:'DVM',naam:'MSI oud',tp:'MSI',vc:'ZWN',weg:'A15',installationDate:'15-03-2001',installationYear:2001,eolYear:2026},
    {key:'a2',source:'DVM',naam:'MSI ouder',tp:'MSI',vc:'ZWN',weg:'A15',installationDate:'02-01-2001',installationYear:2001,eolYear:2025},
    {key:'a3',source:'DVM',naam:'MSI nieuw',tp:'MSI',vc:'ZWN',weg:'A15',installationDate:'10-06-2019',installationYear:2019,eolYear:2039}
  ],faults:[],roads:[],services:[]};
  const answer=answerQuestion('Wat is de oudste asset?',{data:local});
  assert.equal(answer.context.dataset,'assets');
  assert.equal(answer.title,'Oudste asset uit All Assets');
  assert.equal(answer.rows[0].naam,'MSI ouder');
  assert.equal(answer.rows[0]._installLabel,'2-1-2001');
});

test('oudste asset respecteert type en VC filters',()=>{
  const local={assets:[
    {key:'a1',source:'DVM',naam:'MSI ZWN 2005',tp:'MSI',vc:'ZWN',weg:'A15',installationYear:2005},
    {key:'a2',source:'DVM',naam:'MSI NWN 1998',tp:'MSI',vc:'NWN',weg:'A12',installationYear:1998},
    {key:'a3',source:'DVM',naam:'LUS ZWN 1999',tp:'LUS',vc:'ZWN',weg:'A15',installationYear:1999}
  ],faults:[],roads:[],services:[]};
  const answer=answerQuestion('Wat is de oudste MSI asset in ZWN?',{data:local});
  assert.equal(answer.rows.length,1);
  assert.equal(answer.rows[0].naam,'MSI ZWN 2005');
});

test('EOL-vraag gebruikt alleen EOL-waarden uit All Assets',()=>{
  const local={assets:[
    {key:'a1',source:'DVM',naam:'Asset 1',tp:'MSI',vc:'ZWN',weg:'A15',installationYear:2000,eolYear:2025},
    {key:'a2',source:'DVM',naam:'Asset 2',tp:'MSI',vc:'ZWN',weg:'A15',installationYear:2020,eolYear:2040},
    {key:'b1',source:'BI',naam:'BI asset',tp:'MSI',vc:'ZWN',weg:'A15',installationYear:1990,eolYear:2000}
  ],faults:[],roads:[],services:[]};
  const answer=answerQuestion('Welke assets zijn voorbij EOL?',{data:local});
  assert.equal(answer.title,'EOL / levensduur uit All Assets');
  assert.equal(answer.rows.length,1);
  assert.equal(answer.rows[0].naam,'Asset 1');
  assert.equal(answer.metrics.find(x=>x.label==='Bron').value,'All Assets');
});

test('Context API heeft geen aparte EOL-bron meer',()=>{
  const local=buildBiDashContext({assets:[],faults:[],roads:[],services:[],functions:[],dvm:{eol:{source:'assetregister',loaded:true,count:3}},bi:{},state:{dvm:{assetregister:{rijen:[{},{},{}]}}}});
  assert.equal(local.sources.some(x=>x.id==='eol'),false);
  assert.equal(local.eol.source,'assetregister');
});
