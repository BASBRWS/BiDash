/* De brondekkingstabel telde open meldingen uit STATE.meldingen. doorrekenen()
   laat een melding vallen zonder locatie of zonder passende foutregel, en die
   meldingen zijn wél zichtbaar op Open storingen. Voor DRIP leverde dat een tabel
   op die nul open meldingen meldde en "volledige bron, geen open storing", terwijl
   de storingslijst veertien open DRIP-storingen toonde. Wie die bron dan als
   volledig bevestigde, kreeg een exacte dienstbeschikbaarheid die het DRIP-verlies
   op nul zette.

   De test voert de verzonden implementaties uit: v68BronRijenPerType() en
   v68TypeStatus() letterlijk uit dvm-2.js, en deriveOpenDripRows() uit
   site/core/drip-open-from-history.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dripOpenRow,deriveOpenDripRows} from '../site/core/drip-open-from-history.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bron=read('site/engines/dvm-2.js');

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
function haalConst(tekst,naam){
  const start=tekst.indexOf('const '+naam+'=');
  assert.notEqual(start,-1,naam+' niet gevonden');
  const eind=tekst.indexOf('\n',start);
  return tekst.slice(start,eind);
}

/* Eén asset per type zou volstaan, maar de noemer moet groot genoeg zijn om een
   verliespercentage te kunnen onderscheiden van nul. */
function context({liveRijen,meldingen,dekking}){
  const ctx=vm.createContext({Math,Number,String,Object,Array,Date,console,
    RULES:{cfg:{liveDekking:{...dekking}}},
    ASSET_REGISTER_STATE:{assets:[
      ...Array.from({length:100},(_,i)=>({key:'msi'+i,tp:'MSI',prognoseActief:true})),
      ...Array.from({length:50},(_,i)=>({key:'drip'+i,tp:'DRIP',prognoseActief:true}))
    ]},
    STATE:{meldingen,stats:{periodeUren:24}},
    LIVE_STORINGSBRONNEN:[{key:'live',naam:'momentopname.xlsx',rijen:liveRijen}],
    // De echte classificatie is hier niet het onderwerp; de rij draagt haar type.
    classificeer:m=>m.typeId||'',
    normRij:m=>m,
    gecombineerdeLiveStoringsRijen(){return this.LIVE_STORINGSBRONNEN.flatMap(b=>b.rijen||[]);}
  });
  vm.runInContext('gecombineerdeLiveStoringsRijen=function(){return LIVE_STORINGSBRONNEN.flatMap(b=>b.rijen||[]);};',ctx);
  vm.runInContext(haalConst(bron,'V68_TYPES'),ctx);
  vm.runInContext(haalConst(bron,'V68_LABEL'),ctx);
  // OBJ_BRON staat in dvm-1.js; v68Subproces vertaalt er de subprocesafhankelijkheden mee naar assettypen.
  vm.runInContext(read('site/engines/dvm-1.js').match(/^const OBJ_BRON = \{.*$/m)[0],ctx);
  for(const naam of ['v68DekkingCfg','v68Assets','v68LiveBronnenVoorType','v68BronRijenPerType','v68TypeStatus','v68ObjType','v68Subproces'])
    vm.runInContext(haalFunctie(bron,naam),ctx,{filename:naam});
  return ctx;
}
const status=ctx=>vm.runInContext('v68TypeStatus()',ctx);
// Reken één subproces door met de typen die v68TypeStatus() oplevert, precies zoals de dienstverlening dat doet.
const subproces=(ctx,afh)=>vm.runInContext(`v68Subproces(${JSON.stringify({naam:'proef',gewicht:1,afh})},v68TypeStatus())`,ctx);

const msiMelding=i=>({typeId:'MSI',trace:{bijdrageAvail:2,bijdragePerf:1}});

test('open meldingen in de bron tellen mee, ook als ze niet doorgerekend zijn',()=>{
  const ctx=context({
    // Veertien DRIP-storingen in de bron, geen ervan doorgerekend.
    liveRijen:[...Array.from({length:5},()=>({typeId:'MSI'})),...Array.from({length:14},()=>({typeId:'DRIP'}))],
    meldingen:Array.from({length:5},msiMelding),
    dekking:{DRIP:true,MSI:true}
  });
  const t=status(ctx);
  assert.equal(t.DRIP.inBron,14,'de tabel moet de open meldingen uit de bron tonen');
  assert.equal(t.DRIP.events,0);
  assert.equal(t.DRIP.nietDoorgerekend,14);
  assert.equal(t.DRIP.aangeleverd,true,'er is wel degelijk iets aangeleverd');
  assert.doesNotMatch(t.DRIP.status,/geen open storing/);
  assert.match(t.DRIP.status,/14 open meldingen in de bron/);
  // Alle 14 zijn blind (0 doorgerekend), dus de status meldt dat en niet "waarvan N".
  assert.match(t.DRIP.status,/geen enkele doorgerekend/);
});

test('een blind type — open meldingen, geen enkele doorgerekend — is onbekend',()=>{
  const ctx=context({
    liveRijen:Array.from({length:14},()=>({typeId:'DRIP'})),
    meldingen:[],
    dekking:{DRIP:true}
  });
  const t=status(ctx);
  /* Zonder deze regel zou een bevestigde bron 100,00% opleveren terwijl het
     DRIP-verlies simpelweg niet is meegerekend. */
  assert.equal(t.DRIP.besch,null);
  assert.equal(t.DRIP.prestatie,null);
  assert.equal(t.DRIP.blindeMeldingen,true);
  assert.match(t.DRIP.status,/geen enkele doorgerekend/);
  assert.match(t.DRIP.status,/beschikbaarheid onbekend/);
});

test('een type met een deel doorgerekend levert nog steeds een waarde',()=>{
  /* Dit is de regressie: 8 open meldingen in de bron, 5 doorgerekend. Eerder werd
     besch dan null gezet, waardoor de hele dienstverlening naar 0,00–100,00% met
     0% brondekking terugviel. De 5 doorgerekende meldingen horen wel te tellen. */
  const ctx=context({
    liveRijen:Array.from({length:8},()=>({typeId:'MSI'})),
    meldingen:Array.from({length:5},msiMelding),
    dekking:{MSI:true}
  });
  const t=status(ctx);
  assert.equal(t.MSI.inBron,8);
  assert.equal(t.MSI.events,5);
  assert.equal(t.MSI.nietDoorgerekend,3);
  assert.equal(t.MSI.blindeMeldingen,false);
  assert.notEqual(t.MSI.besch,null,'een deels doorgerekend type moet een waarde houden');
  assert.ok(t.MSI.besch>99.5&&t.MSI.besch<99.6,'onverwacht percentage: '+t.MSI.besch);
});

test('een bevestigd type met een gat blijft de dienstverlening voeden',()=>{
  /* Reproductie van de gemelde storing: MSI bevestigd met een gat (435 van 657),
     DRIP bevestigd maar blind (0 doorgerekend). Een subproces dat op beide leunt,
     hoort dekking uit MSI te halen en niet op nul te blijven staan. */
  const ctx=context({
    liveRijen:[...Array.from({length:8},()=>({typeId:'MSI'})),...Array.from({length:14},()=>({typeId:'DRIP'}))],
    meldingen:Array.from({length:5},msiMelding),
    dekking:{MSI:true,DRIP:true}
  });
  const r=subproces(ctx,{signalering:0.5,drip:0.5});
  assert.ok(r.bekend>0.49&&r.bekend<0.51,'de MSI-helft moet als bekend meetellen: '+r.bekend);
  assert.ok(r.loB>0,'de ondergrens mag niet nul zijn: '+r.loB);
  assert.ok(r.hiB>r.loB,'DRIP is blind, dus de band moet open blijven aan de bovenkant');
  assert.equal(r.exact,false,'met een blinde DRIP-helft is het subproces geen exacte waarde');
});

test('een subproces dat alleen op een blind type leunt blijft een volle band',()=>{
  const ctx=context({
    liveRijen:Array.from({length:14},()=>({typeId:'DRIP'})),
    meldingen:[],
    dekking:{DRIP:true}
  });
  const r=subproces(ctx,{drip:1});
  assert.equal(r.bekend,0,'een blind type telt niet als bekende dekking');
  assert.equal(r.loB,0);
  assert.ok(r.hiB>99.9,'de bovengrens veronderstelt 100% voor het onbekende type');
});

test('een volledig doorgerekend type blijft een exact percentage geven',()=>{
  const ctx=context({
    liveRijen:Array.from({length:5},()=>({typeId:'MSI'})),
    meldingen:Array.from({length:5},msiMelding),
    dekking:{MSI:true}
  });
  const t=status(ctx);
  assert.equal(t.MSI.nietDoorgerekend,0);
  assert.equal(t.MSI.doorgerekend,true);
  // 100 assets x 24 uur = 2400; 5 meldingen x 2 verlies = 10 → 99,583…%
  assert.ok(t.MSI.besch>99.5&&t.MSI.besch<99.6,'onverwacht percentage: '+t.MSI.besch);
});

test('een bron zonder open meldingen meldt dat nog steeds als zodanig',()=>{
  const ctx=context({liveRijen:[],meldingen:[],dekking:{DRIP:true}});
  const t=status(ctx);
  assert.equal(t.DRIP.inBron,0);
  assert.equal(t.DRIP.nietDoorgerekend,0);
  assert.equal(t.DRIP.status,'volledige bron, geen open storing');
});

test('de tabel toont het bronaantal, met het doorgerekende aantal erbij als die verschillen',()=>{
  assert.match(bron,/\$\{b\.inBron\.toLocaleString\('nl-NL'\)\}/);
  assert.match(bron,/b\.nietDoorgerekend\?.*doorgerekend/);
});

/* ── De oorzaak: de afgeleide DRIP-regel droeg geen locatie ── */

const incident=extra=>({code:'D09',start:Date.parse('2026-08-01T06:00:00Z'),status:'open',open:'ja',
  sourceName:'historie.xlsx',alarmmeldingen:'LED error',...extra});

test('zonder locatie in de historie krijgt de regel er een uit het register',()=>{
  const rijen=deriveOpenDripRows([incident()],()=>({weg:'A10',richting:'LI',hm:1.55,vc:'NWN'}));
  assert.equal(rijen.length,1);
  assert.equal(rijen[0].weg,'A10');
  assert.equal(rijen[0].wegnummer,'A10');
  assert.equal(rijen[0].richting,'LI');
  assert.equal(rijen[0].hm,1.55);
  assert.equal(rijen[0].vc,'NWN');
});

test('een locatie in de historie zelf gaat voor op het register',()=>{
  const rijen=deriveOpenDripRows([incident({weg:'A27',richting:'RE',hm:9.9,vc:'MN'})],
    ()=>({weg:'A10',richting:'LI',hm:1.55,vc:'NWN'}));
  assert.equal(rijen[0].weg,'A27');
  assert.equal(rijen[0].hm,9.9);
  assert.equal(rijen[0].vc,'MN');
});

test('zonder resolver blijft het gedrag zoals het was',()=>{
  const rijen=deriveOpenDripRows([incident()]);
  assert.equal(rijen.length,1);
  assert.equal(rijen[0].weg,'');
  assert.equal(rijen[0].hm,'');
});

test('een resolver die faalt laat de regel staan in plaats van de lijst te breken',()=>{
  const rijen=deriveOpenDripRows([incident()],()=>{throw new Error('register nog niet geladen');});
  assert.equal(rijen.length,1);
  assert.equal(rijen[0].weg,'');
});

test('dripOpenRow neemt de plaats over als losse functie',()=>{
  const r=dripOpenRow(incident(),0,{weg:'N57',richting:'RE',hm:55.038,vc:'ZN'});
  assert.equal(r.weg,'N57');
  assert.equal(r.richting,'RE');
  assert.equal(r.hm,55.038);
  assert.equal(r.vc,'ZN');
});
