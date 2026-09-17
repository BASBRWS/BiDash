/* De nieuwe bron "Signaalgevers totaal (JSON)" leest één gecombineerd bestand
   (datasets.mtm) met open alarmen en historische storingen, als alternatief voor de
   losse Open storingen- en Storingshistorie-uploads. Deze test controleert dat:

   A. signaalgeverTotaalBronnen() de open alarmen filtert op eindstatus
      "open_aan_einde" (en meenemen:false overslaat) en de storingen als historie
      omzet.
   B. De omgezette rijen door normRij() worden begrepen: een open alarm met een
      MSI-omschrijving wordt als MSI geclassificeerd en krijgt een passende
      foutregel; een historische storing zonder omschrijving wordt via signaalgever
      + impactklasse alsnog als MSI herkend.
   C. De bron is geregistreerd in dvm-source-manager.js met een eigen .json-knop en
      handler.

   De test voert de verzonden implementaties uit: de omzetters uit dvm-3.js en
   normRij()/classificeer()/foutregel() letterlijk uit dvm-2.js, met de echte
   foutcodes uit dvm-1.js. Er wordt geen lokale brondata gebruikt; de invoer is een
   synthetische opzet met dezelfde structuur als het exportbestand. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dvm2=read('site/engines/dvm-2.js');
const dvm3=read('site/engines/dvm-3.js');
const dvm1=read('site/engines/dvm-1.js');
const manager=read('site/engines/dvm-source-manager.js');

function haalFunctie(tekst,naam){
  const start=tekst.indexOf('function '+naam+'(');
  assert.notEqual(start,-1,naam+' niet gevonden');
  let diepte=0;
  for(let j=tekst.indexOf('{',start);j<tekst.length;j++){
    if(tekst[j]==='{')diepte++;
    else if(tekst[j]==='}'&&--diepte===0)return tekst.slice(start,j+1);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}
function haalFoutcodes(){
  const start=dvm1.indexOf('foutcodes:[');
  const open=dvm1.indexOf('[',start);
  let diepte=0;
  for(let j=open;j<dvm1.length;j++){
    if(dvm1[j]==='[')diepte++;
    else if(dvm1[j]===']'&&--diepte===0)return vm.runInNewContext(dvm1.slice(open,j+1));
  }
  throw new Error('foutcodes-array niet gevonden');
}

const ctx=vm.createContext({Number,String,Object,Array,Math,Date,parseFloat,parseInt,isNaN,isFinite,console,RULES:{foutcodes:haalFoutcodes()}});
for(const naam of ['lc','num','parseDatum','normAssetRichting','normRij','classificeer','dripToestandImpact','dripRegel','foutregel'])
  vm.runInContext(haalFunctie(dvm2,naam),ctx,{filename:naam});
for(const naam of ['signaalgeverOpenActief','signaalgeverOpenRij','signaalgeverHistorieRij','signaalgeverTotaalBronnen'])
  vm.runInContext(haalFunctie(dvm3,naam),ctx,{filename:naam});
const bronnen=json=>vm.runInContext('signaalgeverTotaalBronnen',ctx)(json);
const normRij=r=>vm.runInContext('normRij',ctx)(r);
const classificeer=m=>vm.runInContext('classificeer',ctx)(m);
const foutregel=(m,t)=>vm.runInContext('foutregel',ctx)(m,t);

/* Synthetische opzet met dezelfde structuur als het exportbestand. */
const fixture={
  metadata:{versie:'2.0'},
  datasets:{
    drip:{},
    mtm:{
      alarm_episodes:[
        {event_id:'1183',code:'1001',start:'2026-08-01T07:28:00.000Z',description:'Fout in lampcircuit bij MSI 1 lamp LAMPF2',locatie:'A4 R 26,200',weg:'A4',richting_kenmerk:'R',km:26.2,categorie:'MSI',meenemen:true,impact:'DEGRADATIE',unit:'MSI 1',verkeerscentrale:'zwn',laatste_snapshot:'2026-08-15T22:30:00.000Z',bronbestanden:['//mtm/zwn/x.txt'],eindstatus:'open_aan_einde'},
        {event_id:'1185',code:'4027',start:'2026-08-01T07:28:00.000Z',description:'Communicatie met OS uitgevallen',locatie:'A4 R 26,300',weg:'A4',richting_kenmerk:'R',km:26.3,categorie:'MSI',meenemen:true,impact:'UITVAL',unit:'MSI 2',verkeerscentrale:'zwn',laatste_snapshot:'2026-08-15T22:30:00.000Z',eindstatus:'open_aan_einde'},
        {event_id:'1190',code:'1001',description:'Fout in lampcircuit',locatie:'A4 R 27,000',weg:'A4',richting_kenmerk:'R',km:27.0,meenemen:true,unit:'MSI 3',verkeerscentrale:'zwn',eindstatus:'hersteld'},
        {event_id:'1192',code:'9999',description:'Storing gemeld',locatie:'A4 R 29,000',weg:'A4',richting_kenmerk:'R',km:29.0,categorie:'MSI',meenemen:true,unit:'MSI 5',verkeerscentrale:'zwn',laatste_snapshot:'2026-08-15T22:30:00.000Z',eindstatus:'open_aan_einde'},
        {event_id:'1191',code:'1001',description:'Fout in lampcircuit',locatie:'A4 R 28,000',weg:'A4',richting_kenmerk:'R',km:28.0,meenemen:false,unit:'MSI 4',verkeerscentrale:'zwn',eindstatus:'open_aan_einde'}
      ],
      storingen:[
        {incident_id:'SGI-1',verkeerscentrale:'MN',locatie:'A1 L 38,950',weg:'A1',richting_kenmerk:'L',km:38.95,signaalgever:'MSI 1',classificatie:'langdurig',start:'2024-12-11T11:34:00',laatste_bewezen_aanwezig:'2025-01-09T00:30:00',incident_venster_uur:684.93,foutcodes:'1003',impactklassen:'UITVAL'}
      ]
    }
  }
};

/* ── A: filtering en omzetting ── */

test('open alarmen worden gefilterd op eindstatus en meenemen',()=>{
  const {open,historie,versie}=bronnen(fixture);
  assert.equal(versie,'2.0');
  // De open_aan_einde-alarmen met meenemen!==false (1190 is hersteld, 1191 meenemen:false).
  assert.equal(open.length,3);
  const ids=open.map(r=>r.event_id).sort();
  assert.deepEqual(ids,['1183','1185','1192']);
  assert.equal(historie.length,1);
});

test('een leeg of ontbrekend mtm-blok levert geen rijen',()=>{
  assert.equal(bronnen({}).open.length,0);
  assert.equal(bronnen({}).historie.length,0);
  assert.equal(bronnen({datasets:{mtm:{}}}).historie.length,0);
});

/* ── B: de rijen worden door normRij begrepen ── */

test('een open MSI-alarm wordt geclassificeerd en krijgt een passende foutregel',()=>{
  const {open}=bronnen(fixture);
  const r=normRij(open.find(x=>x.event_id==='1183'));
  assert.equal(r.weg,'A4');
  assert.equal(r.hm,26.2);
  assert.equal(r.vc,'zwn');
  assert.equal(classificeer(r),'MSI');
  const f=foutregel(r,'MSI');
  assert.ok(f,'een lampcircuitfout hoort een MSI-foutregel te krijgen');
  assert.equal(f.availPct,15);
  assert.equal(f.perfPct,30);
});

test('een OS-communicatie-uitval matcht de zwaardere MSI-regel',()=>{
  const {open}=bronnen(fixture);
  const r=normRij(open.find(x=>x.event_id==='1185'));
  const f=foutregel(r,'MSI');
  assert.ok(f);
  assert.equal(f.availPct,60);
  assert.equal(f.perfPct,70);
});

test('een open alarm met een omschrijving zonder type-trefwoord wordt via categorie/unit toch als MSI herkend',()=>{
  // Dit is de kern van de fix: eerder bleef zo'n rij ongeclassificeerd, waardoor
  // het actuele dashboard leeg bleef ("geen bron geladen").
  const {open}=bronnen(fixture);
  const r=normRij(open.find(x=>x.event_id==='1192'));
  assert.equal(r.weg,'A4');
  assert.equal(classificeer(r),'MSI');
});

test('een historische storing zonder omschrijving wordt via signaalgever als MSI herkend',()=>{
  const {historie}=bronnen(fixture);
  const r=normRij(historie[0]);
  assert.equal(r.weg,'A1');
  assert.equal(r.hm,38.95);
  assert.equal(r.strook,'MSI 1');
  assert.equal(r.classificatie,'langdurig');
  assert.equal(r.duurUren,684.93);
  assert.equal(classificeer(r),'MSI');
});

/* ── C: de bron is geregistreerd ── */

test('de signaalgever-totaalbron heeft een eigen JSON-knop en handler',()=>{
  assert.match(manager,/signaalgeverTotaal:\{input:'signaalgeverTotaalInput'/);
  assert.match(manager,/handler:'leesSignaalgeverTotaal'/);
  assert.match(manager,/accept:'\.json'/);
  assert.match(manager,/SOURCE_ORDER=\[[^\]]*'signaalgeverTotaal'/);
  assert.match(manager,/case 'leesSignaalgeverTotaal': result=await leesSignaalgeverTotaalBestand/);
  assert.match(dvm3,/async function leesSignaalgeverTotaalBestand/);
});

test('de maplezer is als eigen bron met directory-invoer geregistreerd',()=>{
  assert.match(manager,/signaalgeverMap:\{input:'signaalgeverMapInput'/);
  assert.match(manager,/directory:true/);
  assert.match(manager,/handler:'leesSignaalgeverMap'/);
  assert.match(manager,/SOURCE_ORDER=\[[^\]]*'signaalgeverMap'/);
  assert.match(manager,/case 'leesSignaalgeverMap': result=await leesSignaalgeverMap/);
  // ensureInput zet webkitdirectory voor een directory-bron.
  assert.match(manager,/if\(c\.directory\)\{[^}]*webkitdirectory/);
});

test('de geladen JSON wordt onder de eigen kaart getoond, niet onder Open storingen of Storingshistorie',()=>{
  // De bronnen dragen een marker en een gedeelde vlag, en Datasetbeheer filtert ze
  // uit de losse kaarten en toont ze onder signaalgeverTotaal.
  assert.match(dvm3,/_signaalgeverTotaal:true/);
  assert.match(dvm3,/window\.__BIDASH_SIGNAALGEVER_TOTAAL__=\{/);
  assert.match(manager,/function isSignaalgeverTotaalItem\(item\)/);
  assert.match(manager,/signaalgever-totaal-/);
  assert.match(manager,/if\(type==='signaalgeverTotaal'\)\{/);
  // Verwijderen op de eigen kaart wist beide stores.
  assert.match(manager,/type==='signaalgeverTotaal'/);
  assert.match(manager,/STORINGSBRONNEN=STORINGSBRONNEN\.filter\(b=>!b\._signaalgeverTotaal\)/);
  assert.match(manager,/LIVE_STORINGSBRONNEN=LIVE_STORINGSBRONNEN\.filter\(b=>!b\._signaalgeverTotaal\)/);
});
