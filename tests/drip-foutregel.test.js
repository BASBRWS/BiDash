/* DRIP-storingen kregen geen impact: RULES.foutcodes had geen enkele regel met
   assetType 'DRIP', dus foutregel() gaf null en de melding bleef "Passende foutregel
   ontbreekt". Deze test controleert twee dingen tegelijk:

   A. Er zijn DRIP-foutregels met de afgesproken percentages, gematcht op de
      alarmtekst.
   B. De functionele toestand (GESTOPT/IN-BEDRIJF, LANGDURIG/INTERMITTEREND) is
      leidend: een gestopt paneel telt volledig, een werkend paneel houdt een gemeld
      alarm laag, en een gemengde/langdurige onderbreking legt een ondergrens.

   De test voert de verzonden implementaties uit: de foutcodes uit dvm-1.js en
   foutregel() plus dripToestandImpact() letterlijk uit dvm-2.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const engine=read('site/engines/dvm-2.js');
const regels=read('site/engines/dvm-1.js');

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
/* De echte foutcodes-array uit dvm-1.js, zodat de test de verzonden percentages
   gebruikt en niet een kopie. */
function haalFoutcodes(){
  const start=regels.indexOf('foutcodes:[');
  const open=regels.indexOf('[',start);
  let diepte=0;
  for(let j=open;j<regels.length;j++){
    if(regels[j]==='[')diepte++;
    else if(regels[j]===']'&&--diepte===0)return vm.runInNewContext(regels.slice(open,j+1));
  }
  throw new Error('foutcodes-array niet gevonden');
}

const ctx=vm.createContext({Number,String,Object,Array,Math,console,RULES:{foutcodes:haalFoutcodes()}});
for(const naam of ['lc','dripToestandImpact','dripRegel','foutregel'])
  vm.runInContext(haalFunctie(engine,naam),ctx,{filename:naam});
const foutregel=(m,typeId='DRIP')=>vm.runInContext('foutregel',ctx)(m,typeId);
const drip=(melding,extra={})=>({melding:'DRIP openstaand · '+melding,gevolg:'DRIP openstaand',...extra});

/* ── A: de foutregels bestaan met de afgesproken percentages ── */

test('er zijn DRIP-foutregels met de afgesproken percentages',()=>{
  const codes=vm.runInContext('RULES.foutcodes',ctx).filter(f=>f.assetType==='DRIP');
  const byPatroon=Object.fromEntries(codes.map(f=>[f.patroon,f]));
  assert.equal(byPatroon['contact met display verloren'].availPct,100);
  assert.equal(byPatroon['contact met display verloren'].perfPct,100);
  assert.equal(byPatroon['kritische'].availPct,80);
  assert.equal(byPatroon['kritische'].perfPct,95);
  assert.equal(byPatroon['temperatuur boven het maximum'].availPct,25);
  assert.equal(byPatroon['led status fout'].availPct,10);
  assert.equal(byPatroon['gereset'].availPct,5);
  assert.equal(byPatroon['deuren staan'].availPct,0);
  assert.equal(byPatroon['deuren staan'].perfPct,0);
});

test('een verloren displaycontact telt als volledige uitval',()=>{
  const f=foutregel(drip('BermDRIP controller heeft contact met display verloren',{technischeToestand:'IN-BEDRIJF'}));
  assert.ok(f,'er hoort nu een foutregel te zijn');
  assert.equal(f.availPct,100);
  assert.equal(f.perfPct,100);
});

test('kritische LED weegt zwaarder dan minor LED',()=>{
  const krit=foutregel(drip('Kritische BermDRIP LED status fout: LED error',{technischeToestand:'IN-BEDRIJF'}));
  const minor=foutregel(drip('Minor BermDRIP LED status fout: LED error',{technischeToestand:'IN-BEDRIJF'}));
  assert.equal(krit.availPct,80);
  assert.equal(krit.perfPct,95);
  assert.equal(minor.availPct,10);
  assert.equal(minor.perfPct,30);
});

test('een open kastdeur is een bekende storing zonder dienstimpact',()=>{
  const f=foutregel(drip('Een of meer deuren staan (nog) open',{technischeToestand:'IN-BEDRIJF'}));
  assert.ok(f,'de melding hoort doorgerekend te worden, niet onbekend te blijven');
  assert.equal(f.availPct,0);
  assert.equal(f.perfPct,0);
});

/* ── B: de functionele toestand is leidend ── */

test('een volledig gestopt paneel telt als volledige uitval, ongeacht de alarmtekst',()=>{
  const f=foutregel(drip('LANGDURIG',{technischeToestand:'GESTOPT',classificatie:'LANGDURIG'}));
  assert.equal(f.availPct,100);
  assert.equal(f.perfPct,100);
  assert.equal(f.code,'DBD-UIT');
});

test('een langdurige onderbreking (gestopt en terug) legt een ondergrens',()=>{
  // Alleen een reset gemeld, maar het paneel is langdurig onderbroken geweest.
  const f=foutregel(drip('De BermDRIP is gereset',{technischeToestand:'GESTOPT + IN-BEDRIJF',classificatie:'LANGDURIG'}));
  assert.equal(f.availPct,60);
  assert.equal(f.perfPct,70);
});

test('een intermitterende onderbreking weegt lichter dan een langdurige',()=>{
  const f=foutregel(drip('De BermDRIP is gereset',{technischeToestand:'GESTOPT + IN-BEDRIJF',classificatie:'INTERMITTEREND'}));
  assert.equal(f.availPct,25);
  assert.equal(f.perfPct,40);
});

test('een werkend paneel houdt een gemeld alarm laag',()=>{
  const f=foutregel(drip('De BermDRIP is gereset',{technischeToestand:'IN-BEDRIJF'}));
  assert.equal(f.availPct,5);
  assert.equal(f.perfPct,10);
});

test('een langdurige melding zonder alarm en zonder toestand valt terug op de classificatie',()=>{
  const f=foutregel(drip('LANGDURIG',{classificatie:'LANGDURIG'}));
  assert.equal(f.availPct,60);
  assert.equal(f.perfPct,70);
});

test('een ongedefinieerde fout zonder toestand blijft onbekend, niet doorgerekend',()=>{
  const f=foutregel(drip('Ongedefinieerde fout (test result 8)'));
  assert.equal(f,null,'zonder onderbouwing hoort de melding niet doorgerekend te worden');
});

test('de kritische LED wint ook binnen een gemengde melding met een open deur',()=>{
  const f=foutregel(drip('Kritische BermDRIP LED status fout: LED error | Een of meer deuren staan (nog) open | De BermDRIP is gereset',{technischeToestand:'IN-BEDRIJF'}));
  assert.equal(f.availPct,80);
});

test('MSI en andere assettypen blijven ongewijzigd',()=>{
  const msi=foutregel({melding:'Fatale fout',gevolg:''},'MSI');
  assert.equal(msi.availPct,100);
  const cam=foutregel({melding:'geen beeld',gevolg:''},'CAM');
  assert.equal(cam.availPct,80);
});
