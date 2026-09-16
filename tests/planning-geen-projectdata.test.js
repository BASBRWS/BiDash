/* De planningmodule bevatte werkelijke projectinformatie als vaste tekst in de
   broncode: een ingesloten Primavera-export met 103 activiteiten, portfolio- en
   bouwbloklijsten, triggers met besluitdeadlines en urgentieklassen, en
   dashboardcijfers in euro's. Die applicatie wordt publiek gepubliceerd.

   Deze test bewaakt twee dingen: dat die gegevens niet terugkeren in de code, en
   dat de triggers die er stonden nu als bron geladen kunnen worden. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const planning=read('site/engines/planning.html');

/* Namen van werkelijke objecten en projecten die in dit bestand hebben gestaan.
   Ze staan hier als bewaking; de lijst hoort leeg te blijven scoren. */
const OBJECTNAMEN=[
  'A27 Noord','Heinenoordtunnel','Leidsche Rijntunnel','Maasdelta','Sijtwendetunnel',
  'Zuidasdok','Velsertunnel','Coentunnel','Botlektunnel','Wijkertunnel','Schipholtunnel',
  'Zeeburgertunnel','Gaasperdammertunnel','Westerscheldetunnel','Sluiskiltunnel',
  'Ketheltunnel','Thomassentunnel','Drechttunnel','Beneluxtunnel','Vlaketunnel',
  'Koning Willem-Alexandertunnel','Salland Twentetunnel','Besluit Pand Rhoon','Verhuizing Helmond'
];

test('er staan geen namen van werkelijke objecten of projecten meer in de code',()=>{
  const gevonden=OBJECTNAMEN.filter(naam=>planning.includes(naam));
  assert.deepEqual(gevonden,[],'nog aanwezig in planning.html: '+gevonden.join(', '));
});

test('de ingesloten Primavera-export is leeg',()=>{
  assert.match(planning,/const P6_DATA = \{lanes:\[\],acts:\[\],rels:\[\]\};/);
  // Geen losse activiteitregels meer met start- en einddatum.
  assert.doesNotMatch(planning,/"mijlpaal":(true|false)/);
  assert.doesNotMatch(planning,/"lane":"Openstelling/);
});

test('portfolio-, bouwblok- en dashboardcijfers staan niet meer vast in de code',()=>{
  for(const naam of ['PROJECTS','BOUWBLOKKEN','VCS','TRIGGERS_LIVE'])
    assert.match(planning,new RegExp(`const ${naam} = \\[\\];`),naam);
  assert.match(planning,/const DASH_BUILDERS = \{\};/);
  assert.match(planning,/const FTE_DEFS = \[\];/);
  assert.match(planning,/var NT_MODEL = \{ blokken: \[\], regels: \[\] \};/);
  assert.match(planning,/var MJP_MODEL = \{ blokken: \[\], regels: \[\] \};/);
  // Geen bedragen en geen go/no-go- of contractvelden meer.
  assert.doesNotMatch(planning,/EUR \d+M/);
  assert.doesNotMatch(planning,/gono:/);
  assert.doesNotMatch(planning,/supporteinde:/);
});

test('de triggertellers in de opmaak staan op nul in plaats van op een vast getal',()=>{
  assert.match(planning,/id="kpi-rood-n">0</);
  assert.match(planning,/id="kpi-oranje-n">0</);
});

test('er is een laadroute voor het triggerbestand',()=>{
  assert.match(planning,/function ipl_handleTriggerFile\(input\)/);
  assert.match(planning,/onchange="ipl_handleTriggerFile\(this\)"/);
  assert.match(planning,/let TRIGGERS = \{\};/);
  // De lege staat verwijst de gebruiker naar het importscherm.
  assert.match(planning,/Geen triggers geladen/);
});

/* De laadfunctie draaien zoals hij verzonden is: uit het bestand halen en in een
   context uitvoeren met alleen de stukken DOM die hij aanraakt. */
function triggerApi(){
  const namen=['ipl_triggerGeldig','ipl_normaliseerTrigger','ipl_zetTriggers','ipl_wisTriggers','ipl_werkTriggerTellersBij'];
  const delen=namen.map(naam=>{
    const start=planning.indexOf('function '+naam+'(');
    assert.notEqual(start,-1,naam+' niet gevonden');
    let diepte=0;
    for(let j=planning.indexOf('{',start);j<planning.length;j++){
      if(planning[j]==='{')diepte++;
      else if(planning[j]==='}'&&--diepte===0)return planning.slice(start,j+1);
    }
    throw new Error('einde van '+naam+' niet gevonden');
  });
  const tellers={};
  const ctx=vm.createContext({Object,Array,String,Number,Boolean,console,
    document:{getElementById:id=>({set textContent(v){tellers[id]=v;},get textContent(){return tellers[id];}})}});
  vm.runInContext('let TRIGGERS={};let TRIGGERS_BRON="";'+delen.join('\n'),ctx);
  return {ctx,tellers,run:(code)=>vm.runInContext(code,ctx)};
}

test('een geldig triggerbestand wordt geladen en telt mee',()=>{
  const api=triggerApi();
  const bestand={triggers:{een:{naam:'Trigger een',klasse:'rood',oorzaak:'Toelichting',deadline:'1 januari 2030'},
                           twee:{naam:'Trigger twee',klasse:'oranje',oorzaak:'Toelichting'}}};
  const uit=api.run(`ipl_zetTriggers(${JSON.stringify(bestand)},'proef.json')`);
  assert.equal(uit.geladen,2);
  assert.equal(uit.overgeslagen,0);
  assert.equal(api.tellers['kpi-rood-n'],'1');
  assert.equal(api.tellers['kpi-oranje-n'],'1');
  assert.equal(api.run('TRIGGERS_BRON'),'proef.json');
});

test('een onvolledige regel wordt overgeslagen in plaats van half getoond',()=>{
  const api=triggerApi();
  const bestand={triggers:{goed:{naam:'Wel goed',klasse:'rood',oorzaak:'Toelichting'},
                           leeg:{naam:'',klasse:'rood',oorzaak:'x'},
                           klasse:{naam:'Onbekende klasse',klasse:'paars',oorzaak:'x'},
                           geenOorzaak:{naam:'Zonder oorzaak',klasse:'oranje'}}};
  const uit=api.run(`ipl_zetTriggers(${JSON.stringify(bestand)},'proef.json')`);
  assert.equal(uit.geladen,1);
  assert.equal(uit.overgeslagen,3);
});

test('een bestand zonder bruikbare triggers levert een melding op, geen lege lijst',()=>{
  const api=triggerApi();
  assert.throws(()=>api.run(`ipl_zetTriggers({triggers:{}},'leeg.json')`),/Geen bruikbare triggers/);
  assert.throws(()=>api.run(`ipl_zetTriggers(null,'leeg.json')`),/Geen triggers gevonden/);
});

test('wissen zet de tellers terug op nul',()=>{
  const api=triggerApi();
  api.run(`ipl_zetTriggers({triggers:{een:{naam:'T',klasse:'rood',oorzaak:'x'}}},'proef.json')`);
  api.run('ipl_wisTriggers()');
  assert.equal(api.tellers['kpi-rood-n'],'0');
  assert.equal(api.run('Object.keys(TRIGGERS).length'),0);
});

test('het sjabloon bevat geen werkelijke projectinformatie',()=>{
  const sjabloon=read('docs/voorbeeld-triggers.json');
  for(const naam of OBJECTNAMEN)assert.ok(!sjabloon.includes(naam),naam+' staat in het sjabloon');
  const data=JSON.parse(sjabloon);
  assert.ok(Object.keys(data.triggers).length>=1);
});
