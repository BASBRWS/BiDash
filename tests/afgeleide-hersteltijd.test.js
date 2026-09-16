/* Een storing die uit de nieuwe momentopname verdwijnt wordt afgesloten op de
   peildatum van die lijst. De duur die daaruit volgt is een bovengrens: het
   herstel lag ergens tussen de vorige en de nieuwe momentopname. Zo'n duur mag
   de herstelduurstatistiek niet vullen, anders groeit de MTTR mee met de
   afstand tussen twee momentopnamen.

   De test voert de verzonden implementaties uit: closeHistoryRow uit
   live-snapshot.js en normRij plus bouwLiveMcHistorie letterlijk uit dvm-2.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {closeHistoryRow} from '../site/core/live-snapshot.js';

const bron=readFileSync(new URL('../site/engines/dvm-2.js',import.meta.url),'utf8');

function haalFunctie(tekst,naam){
  const start=tekst.indexOf('function '+naam+'(');
  assert.notEqual(start,-1,'functie '+naam+' niet gevonden');
  let diepte=0;
  for(let j=tekst.indexOf('{',start);j<tekst.length;j++){
    if(tekst[j]==='{')diepte++;
    else if(tekst[j]==='}'&&--diepte===0)return tekst.slice(start,j+1);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}
function context(extra={}){
  const ctx=vm.createContext({Math,Number,String,Object,Array,Date,isFinite,isNaN,parseFloat,parseInt,console,...extra});
  for(const naam of ['lc','num','parseDatum','normRij','kwantielWaarde','bouwLiveMcHistorie'])
    vm.runInContext(haalFunctie(bron,naam),ctx,{filename:naam});
  vm.runInContext('function normAssetRichting(v){return String(v||"").trim().toUpperCase();}',ctx);
  return ctx;
}

const UUR=3600000;
const START=Date.parse('2026-08-01T06:00:00Z');

/* Eén verdwenen storing, afgesloten op een peildatum die we kunnen verschuiven. */
function afgeslotenRij(peildatum){
  return closeHistoryRow(
    {entityid:'MSI-1',os_id:'A12 Re 60.000',van:new Date(START).toISOString(),status:'open',open:'ja'},
    {closedAt:peildatum,startAt:START,sourceFile:'momentopname-B.xlsx'});
}

test('closeHistoryRow legt vast dat de afsluiting is afgeleid',()=>{
  const rij=afgeslotenRij(START+100*UUR);
  assert.equal(rij._afgeslotenDoorNieuweMomentopname,true);
  assert.equal(rij._afsluitBronBestand,'momentopname-B.xlsx');
  assert.ok(rij._afsluitPeildatum,'de gebruikte peildatum is vastgelegd');
  assert.ok(Math.abs(Number(rij.storingsduur_uren)-100)<1e-6,'duur is peildatum minus start');
});

test('normRij merkt een afgeleide duur als onbetrouwbaar',()=>{
  const ctx=context();
  const afgeleid=ctx.normRij(afgeslotenRij(START+100*UUR));
  assert.equal(afgeleid.duurAfgeleid,true);
  assert.equal(afgeleid.duurBetrouwbaar,false,'een afgeleide duur telt niet als meting');
  assert.ok(Math.abs(afgeleid.duurUren-100)<1e-6,'de duur zelf blijft beschikbaar');
  assert.ok(afgeleid.afsluitPeildatum,'de peildatum is herleidbaar');

  const gemeten=ctx.normRij({entityid:'MSI-2',os_id:'A12 Re 61.000',
    van:new Date(START).toISOString(),tot:new Date(START+30*UUR).toISOString(),storingsduur_uren:30});
  assert.equal(gemeten.duurAfgeleid,false);
  assert.equal(gemeten.duurBetrouwbaar,true,'een gemeten duur telt wel');
});

/* Bouwt de invoer voor de duurverdeling: drie gemeten storingen plus één
   afgeleide, waarvan we de peildatum verschuiven. */
function historieMet(peildatum,ctx){
  const gemeten=[24,48,72].map((uren,i)=>ctx.normRij({
    entityid:'MSI-G'+i,os_id:'A12 Re '+(70+i)+'.000',
    van:new Date(START).toISOString(),tot:new Date(START+uren*UUR).toISOString(),storingsduur_uren:uren}));
  const afgeleid=ctx.normRij(afgeslotenRij(peildatum));
  const meldingen=[...gemeten,afgeleid].map(m=>({...m,typeId:'MSI',assetKey:'k'+m.entityid,zwaarteA:1,zwaarteP:1}));
  return {meldingen,wegdelen:[{vc:'ZWN',weg:'A12',richting:'Re',meldingen}]};
}
function duurAnkers(peildatum,{telAfgeleideMee=false}={}){
  const ctx=context({
    ASSET_INDEX:null,
    STORINGS_INSPECTIE:{typen:{MSI:{dekkingDagen:365}}},
    DATA_DREMPELS:{assetDuren:3},
    VC_MAP:{},
    STORINGSBRONNEN:[{naam:'historie-synthetisch.xlsx'}]
  });
  const st=historieMet(peildatum,ctx);
  if(telAfgeleideMee)st.meldingen.forEach(m=>{if(m.duurAfgeleid)m.duurBetrouwbaar=true;});
  const model=ctx.bouwLiveMcHistorie(st);
  assert.ok(model,'de duurverdeling is opgebouwd');
  return model.wegdelen['ZWN|A12 Re'].durP;
}

test('de herstelduurverdeling groeit niet mee met de afstand tussen twee momentopnamen',()=>{
  const kort=duurAnkers(START+100*UUR);
  const lang=duurAnkers(START+2000*UUR);
  assert.deepEqual(lang,kort,'alleen een verder weg liggende peildatum verandert de verdeling niet');
  // De gemeten duren zijn 1, 2 en 3 dagen; de mediaan hoort daarbinnen te vallen.
  const mediaan=kort[10];
  assert.ok(mediaan>=1&&mediaan<=3,'mediaan ligt binnen de gemeten duren, nu '+mediaan);
});

test('zou de afgeleide duur wel meetellen, dan verschuift de verdeling wel',()=>{
  const kort=duurAnkers(START+100*UUR,{telAfgeleideMee:true});
  const lang=duurAnkers(START+2000*UUR,{telAfgeleideMee:true});
  assert.notDeepEqual(lang,kort,'de test meet werkelijk het effect van de afgeleide duur');
});
