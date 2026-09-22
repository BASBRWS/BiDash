/* De DRIP-totaalbron vervangt de losse DRIP-storingshistorie-upload. Ze komt uit
   één JSON-bestand (datasets.drip) of uit de ruwe CDMS-logmap. Deze test voert de
   verzonden pure functies uit zonder DOM en zonder brondata:

   A. sbDripEventsUitTekst leest tab-gescheiden CDMS-logregels (status URGENT/OK en
      power UIT/AAN) met de kalenderdag uit het pad.
   B. sbBouwDripBundel reconstrueert episodes (open/dicht), houdt wat aan het einde
      nog aanstaat open en classificeert intermitterende storingen.
   C. sbPadInfoDrip / sbFilterDripBestanden accepteren alleen cdms/<vc>/log/<...> en
      filteren op regio en periode; sgVolgendeCtxDrip snoeit de maptraversal.
   D. De datasets.drip-uitvoer wordt door dripDatasetNaarBron omgezet naar de
      incidentvorm die DRIP_HIST_STATE kent, en een open episode wordt door
      isOpenDripIncident als openstaand herkend.
   E. sbCombineerMetDripBasis vervangt in een basis alleen de gekozen regio. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {isOpenDripIncident,deriveOpenDripRows} from '../site/core/drip-open-from-history.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bundelaar=read('site/engines/dvm-storingsbundelaar.js');
const dvm2=read('site/engines/dvm-2.js');
const dvm3=read('site/engines/dvm-3.js');

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

const ctx=vm.createContext({Number,String,Object,Array,Math,Date,Set,Map,parseFloat,parseInt,isNaN,isFinite,console,RegExp});
vm.runInContext(`const MSI_DEGRADATIE=new Set();const DETECTOR_CODES=new Set();const SYSTEEM_CODES=new Set();`,ctx);
for(const naam of ['sbGroupBy','sbVcAlias','sbGeldigeDatum','sbClassificeer','sbPad','sbDuurTekst','sbMetWerkers','sbPadInfoDrip','sbDripBestandGeschikt','sbDripEventsUitTekst','sbBouwDripBundel','sbFilterDripBestanden','sbCombineerMetDripBasis','sbDripWatermerken','sgBuitenPeriode','sgVolgendeCtxDrip'])
  vm.runInContext(haalFunctie(bundelaar,naam),ctx,{filename:naam});
for(const naam of ['num','parseDatum'])
  vm.runInContext(haalFunctie(dvm2,naam),ctx,{filename:naam});
for(const naam of ['normDripCode','normDripHistRegio','parseDripHistorieLocatie','parseDripHistorieDatum','dripTotaalIncidentUitRij','dripDatasetNaarBron','dripTotaalBronnen','dripIncidentSleutel','dripTotaalBronKey','mergeDripBronnen'])
  vm.runInContext(haalFunctie(dvm3,naam),ctx,{filename:naam});

const call=(naam,...args)=>vm.runInContext(naam,ctx)(...args);

/* Eén CDMS-logregel: <tijd>\t2\t<sub>\t<asset>\t<loc>\t<...> */
const statusRegel=(t,asset,loc,toestand,waarde)=>[t,'2','1',asset,loc,toestand,waarde,'x'].join('\t');

test('A. een CDMS-logbestand wordt in gebeurtenissen geparseerd',()=>{
  const datum=new Date(2026,7,16);
  const tekst=[
    statusRegel('07:00:00','D80','A15 L 12,300','MELDING','URGENT'),
    statusRegel('08:30:00','D80','A15 L 12,300','MELDING','OK'),
    'kop zonder tijd\tnegeren'
  ].join('\n');
  const events=call('sbDripEventsUitTekst',tekst,'zwn',datum,'cdms/zwn/log/2026/08/16/a.txt');
  assert.equal(events.length,2);
  assert.equal(events[0].asset,'D80');
  assert.equal(events[0].waarde,'URGENT');
  assert.equal(events[1].waarde,'OK');
});

test('B. episodes sluiten en een blijvend alarm blijft open',()=>{
  const datum=new Date(2026,7,16);
  const events=[].concat(
    call('sbDripEventsUitTekst',[statusRegel('07:00:00','D80','A15 L 12,300','M','URGENT'),statusRegel('07:30:00','D80','A15 L 12,300','M','OK')].join('\n'),'zwn',datum,'cdms/zwn/log/2026/08/16/a.txt'),
    call('sbDripEventsUitTekst',statusRegel('09:00:00','D81','A15 L 13,000','M','URGENT'),'zwn',datum,'cdms/zwn/log/2026/08/16/b.txt')
  );
  const {episodes,open}=call('sbBouwDripBundel',events,{});
  const dicht=episodes.find(e=>e.asset==='D80');
  assert.ok(dicht&&dicht.einde_bewezen,'D80 is gesloten');
  assert.equal(open.length,1);
  assert.equal(open[0].asset,'D81');
  assert.equal(open[0].kwaliteitsstatus,'open');
});

test('C. de DRIP-map accepteert alleen cdms/<vc>/log en filtert op regio/periode',()=>{
  assert.ok(call('sbPadInfoDrip','X/cdms/zwn/log/2026/08/16/a.txt'));
  assert.equal(call('sbPadInfoDrip','X/mtm/zwn/storinglijst/2026/08/16/a.txt'),null); // MTM, geen DRIP
  assert.equal(call('sbPadInfoDrip','X/cdms/zwn/verkeerd/2026/08/16/a.txt'),null);
  const mk=p=>({name:p.split('/').pop(),webkitRelativePath:p});
  const files=[mk('X/cdms/zwn/log/2026/08/16/a.txt'),mk('X/cdms/nwn/log/2026/08/16/b.txt'),mk('X/cdms/zwn/log/2026/07/10/c.txt'),mk('X/mtm/zwn/storinglijst/2026/08/16/d.txt')];
  assert.equal(call('sbFilterDripBestanden',files,{vcs:new Set(['zwn'])}).length,2);
  assert.equal(call('sbFilterDripBestanden',files,{vcs:new Set(['zwn']),vanaf:'2026-08-01'}).length,1);
  // Traversal snoeit buiten cdms en buiten de regio.
  assert.equal(call('sgVolgendeCtxDrip',{fase:'root'},'cdms',{vcs:new Set(['zwn'])}).fase,'cdms');
  assert.equal(call('sgVolgendeCtxDrip',{fase:'root'},'mtm',{vcs:new Set(['zwn'])}),null);
  assert.equal(call('sgVolgendeCtxDrip',{fase:'cdms'},'nwn',{vcs:new Set(['zwn'])}),null);
  assert.equal(call('sgVolgendeCtxDrip',{fase:'vc',vc:'zwn'},'log',{vcs:new Set(['zwn'])}).fase,'log');
});

test('D. datasets.drip wordt naar incidenten omgezet en een open episode blijft open',()=>{
  const json={metadata:{versie:'2.5'},datasets:{drip:{
    storingen:[
      {verkeerscentrale:'ZWN',asset:'D80',locatie:'A15 L 12,300',start:'2026-08-16T07:00:00',einde_bewezen:'2026-08-16T13:00:00',totale_storingsduur_uur:6,classificatie:'LANGDURIG',bron:'URGENT/OK',aantal_cycli:1}
    ],
    episodes:[
      {verkeerscentrale:'ZWN',asset:'D81',locatie:'A15 L 13,000',start:'2026-08-17T09:00:00',einde_bewezen:null,duur_min_uur:0,bron:'URGENT/OK',kwaliteitsstatus:'open'}
    ],
    datadekking:[{systeem:'drip',verkeerscentrale:'zwn',datum:'2026-08-16'}]
  }}};
  const {drip,versie}=call('dripTotaalBronnen',json);
  assert.equal(versie,'2.5');
  const {incidenten,dekkingDatums,assetCodes}=call('dripDatasetNaarBron',drip,'drip-totaal','test.json');
  assert.equal(incidenten.length,2,'één storing + één open episode');
  const langdurig=incidenten.find(x=>x.code==='D80');
  assert.equal(langdurig.classificatie,'LANGDURIG');
  assert.equal(langdurig.duurBetrouwbaar,true);
  const openInc=incidenten.find(x=>x.code==='D81');
  assert.equal(openInc.einde,null);
  assert.equal(openInc.duurUren,null);
  assert.equal(dekkingDatums.join(','),'2026-08-16');
  assert.equal(assetCodes.sort().join(','),'D80,D81');
  // De open-DRIP-afleiding (core) herkent het open incident.
  assert.equal(isOpenDripIncident(openInc),true);
  assert.equal(isOpenDripIncident(langdurig),false);
  const openRijen=deriveOpenDripRows(incidenten);
  assert.equal(openRijen.length,1);
  assert.equal(openRijen[0].drip_code,'D81');
});

test('E. combineren met een basis vervangt alleen de gekozen regio',()=>{
  const basis={
    episodes:[{verkeerscentrale:'zwn',asset:'oud-zwn'},{verkeerscentrale:'nwn',asset:'oud-nwn'}],
    storingen:[{verkeerscentrale:'zwn',asset:'s-zwn'},{verkeerscentrale:'nwn',asset:'s-nwn'}]
  };
  const uit=call('sbCombineerMetDripBasis',basis,[{verkeerscentrale:'zwn',asset:'nieuw-zwn'}],[{verkeerscentrale:'zwn',asset:'s-nieuw'}],new Set(['zwn']));
  assert.equal(uit.episodes.map(r=>r.asset).sort().join('|'),'nieuw-zwn|oud-nwn');
  assert.equal(uit.storingen.map(r=>r.asset).sort().join('|'),'s-nieuw|s-nwn');
});

test('F. de DRIP-map leest begrensd parallel en meldt echte voortgang',async()=>{
  let actief=0,maxActief=0;const gereed=[],voortgang=[];
  await call('sbMetWerkers',[1,2,3,4,5,6,7,8],3,async item=>{
    actief++;maxActief=Math.max(maxActief,actief);
    await new Promise(resolve=>setTimeout(resolve,4));
    gereed.push(item);actief--;
  },(klaar,totaal)=>voortgang.push([klaar,totaal]));
  assert.equal(maxActief,3,'maximaal drie gelijktijdige taken in deze test');
  assert.deepEqual(gereed.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
  assert.deepEqual(voortgang.at(-1),[8,8]);
  assert.equal(call('sbDuurTekst',125000),'2 min 5 sec');
});


test('G. Voeg JSON toe houdt bestaande DRIP-bronnen en ontdubbelt overlap',()=>{
  const bestaand={key:'drip-totaal',name:'basis.json',incidenten:[
    {code:'D80',start:100,einde:200,classificatie:'LANGDURIG',hardUit:false}
  ],dekkingDatums:['2026-08-16'],assetCodes:['D80']};
  const extra={key:call('dripTotaalBronKey','extra.json'),name:'extra.json',incidenten:[
    {code:'D80',start:100,einde:200,classificatie:'LANGDURIG',hardUit:false},
    {code:'D81',start:300,einde:400,classificatie:'STORING',hardUit:false}
  ],dekkingDatums:['2026-08-17'],assetCodes:['D80','D81']};
  const bronnen=call('mergeDripBronnen',[bestaand],extra);
  assert.equal(bronnen.length,2);
  assert.equal(bronnen[0].incidenten.length,1);
  assert.equal(bronnen[1].incidenten.length,1,'overlap D80 wordt niet dubbel toegevoegd');
  assert.equal(bronnen[1].incidenten[0].code,'D81');
  assert.match(bronnen[1].key,/^drip-json:extra\.json$/);
});
