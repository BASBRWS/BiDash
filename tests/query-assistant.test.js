import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {answerQuestion,parseQuestion,filterFaults} from '../site/core/query-assistant.js';

const data={
  faults:[
    {id:'1',typeId:'MSI',weg:'A15',vc:'ZWN',code:'1003',impact:100,naam:'MSI-1'},
    {id:'2',typeId:'MSI',weg:'A15',vc:'ZWN',code:'1001',impact:30,naam:'MSI-2'},
    {id:'3',typeId:'LUS',weg:'A15',vc:'ZWN',code:'1006',impact:20,naam:'LUS-1'},
    {id:'4',typeId:'MSI',weg:'A12',vc:'ZWN',code:'1003',impact:null,naam:'MSI-3'}
  ],
  assets:[{key:'a',naam:'A',tp:'MSI',vc:'ZWN',weg:'A15'}],
  roads:[{id:'r1',naam:'A15 R',vc:'ZWN',kosten:1250,vvu:12.5}],
  services:[{id:'incident',naam:'Incidentmanagement',besch:98.5,norm:99}]
};

test('vraagparser herkent type, weg en VC',()=>{
 const parsed=parseQuestion('Hoeveel open MSI-storingen zijn er op de A15 in ZWN?',{data});
 assert.equal(parsed.dataset,'faults');
 assert.deepEqual(parsed.context.filters,{typeId:'MSI',road:'A15',vc:'ZWN'});
});

test('vervolgvraag behoudt de vorige selectie',()=>{
 const first=answerQuestion('Hoeveel open MSI-storingen zijn er op de A15 in ZWN?',{data});
 const next=answerQuestion('En hoeveel daarvan met foutcode 1003?',{data,previousContext:first.context});
 assert.match(next.text,/1 open storing/);
 assert.equal(next.context.filters.road,'A15');
 assert.equal(next.context.filters.code,'1003');
});

test('foutcodegroepering gebruikt de context van het gesprek',()=>{
 const first=answerQuestion('Hoeveel MSI-storingen zijn er op A15?',{data});
 const next=answerQuestion('Welke foutcodes komen het meest voor?',{data,previousContext:first.context});
 assert.deepEqual(next.rows,[{code:'1003',aantal:1},{code:'1001',aantal:1}]);
});

test('schermcontext wordt gebruikt in modus dit scherm',()=>{
 const answer=answerQuestion('Hoeveel storingen zijn er?',{data,mode:'screen',screenContext:{dataset:'faults',filters:{vc:'ZWN',road:'A12'}}});
 assert.match(answer.text,/1 open storing/);
 assert.equal(answer.context.filters.road,'A12');
});

test('niet-doorgerekend filter selecteert alleen meldingen zonder impact',()=>{
 assert.deepEqual(filterFaults(data.faults,{rekenStatus:'niet doorgerekend'}).map(r=>r.id),['4']);
});

test('dienstverleningsvraag gebruikt bestaande dienstwaarden',()=>{
 const answer=answerQuestion('Wat is de huidige dienstverlening?',{data});
 assert.equal(answer.context.dataset,'services');
 assert.equal(answer.rows[0].beschikbaar,'98,5%');
});

test('verkeerskosten worden als bekend subtotaal gepresenteerd',()=>{
 const answer=answerQuestion('Wat zijn de verkeerskosten op A15?',{data});
 assert.equal(answer.context.dataset,'roads');
 assert.match(answer.text,/bekend subtotaal/i);
 assert.equal(answer.metrics[2].value,'1 / 1');
});

test('popup is in de hoofdschil gekoppeld zonder AI of externe endpoint',()=>{
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
 assert.match(html,/id="queryAssistantDialog"/);
 assert.match(html,/id="queryAssistantOpen"/);
 assert.match(html,/Geen AI/);
 assert.match(app,/installQueryAssistant/);
 assert.match(app,/assistantApplyContext/);
});


test('oudste asset gebruikt installatiegegevens uit All Assets',()=>{
 const local={...data,assets:[
   {key:'nieuw',naam:'Nieuw MSI',tp:'MSI',vc:'ZWN',weg:'A15',bouwjaar:2018,eolJaar:2033},
   {key:'oud',naam:'Oud DRIP',tp:'DRIP',vc:'ZWN',weg:'A4',ingebruikname:'2001-06-15',eolJaar:2016},
   {key:'zonder',naam:'Zonder datum',tp:'LUS',vc:'NWN',weg:'A12'}
 ]};
 const answer=answerQuestion('Wat is het oudste asset?',{data:local});
 assert.equal(answer.context.dataset,'assets');
 assert.equal(answer.title,'Oudste asset');
 assert.equal(answer.rows[0].naam,'Oud DRIP');
 assert.equal(answer.rows[0]._installLabel,'15-6-2001');
 assert.match(answer.text,/All Assets/);
});

test('nieuwste asset gebruikt bouwjaar en negeert ontbrekende installatiedatum',()=>{
 const local={...data,assets:[
   {key:'a',naam:'A',tp:'MSI',bouwjaar:2008},
   {key:'b',naam:'B',tp:'MSI',bouwjaar:2021},
   {key:'c',naam:'C',tp:'MSI'}
 ]};
 const answer=answerQuestion('Wat is het nieuwste asset?',{data:local});
 assert.equal(answer.rows[0].naam,'B');
 assert.equal(answer.rows[0]._installLabel,'2021');
 assert.equal(answer.metrics.find(m=>m.label==='Met installatiedatum').value,'2');
});

test('EOL-vraag gebruikt alleen EOL uit All Assets',()=>{
 const local={...data,assets:[
   {key:'a',naam:'A',tp:'MSI',weg:'A15',eolJaar:2025},
   {key:'b',naam:'B',tp:'DRIP',weg:'A4',raw:{eol:{jaar:2032}}}
 ]};
 const answer=answerQuestion('Welke assets zijn over EOL?',{data:local});
 assert.equal(answer.context.dataset,'eol');
 assert.equal(answer.title,'EOL uit All Assets');
 assert.doesNotMatch(answer.text,/geladen.*referentie/i);
 assert.ok(answer.rows.every(row=>row._eol<=new Date().getFullYear()));
});
