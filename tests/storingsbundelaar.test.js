/* De signaalgeverbundelaar leest ruwe MTM-storinglijsten in BiDash en bouwt daaruit
   de open storingen en de historie, zonder tussen-JSON. Deze test voert de verzonden
   pure functies uit dvm-storingsbundelaar.js uit op synthetische storinglijsten en
   controleert dat:

   A. Eén storinglijst correct in alarmregels wordt geparseerd (locatie, code, unit,
      categorie/meenemen).
   B. Over meerdere snapshots een verdwenen alarm sluit en een nog aanwezig alarm als
      open_aan_einde overblijft.
   C. De geclassificeerde storingen ontstaan (langdurig / intermitterend).
   D. Een pad buiten mtm/<vc>/storinglijst/<jaar>/<maand>/<dag> wordt geweigerd.
   E. De bundeluitvoer (v2.5-velden) door de schema-tolerante mapping van dvm-3.js
      wordt begrepen: normRij → classificeer levert MSI.

   Geen DOM en geen brondata: de invoer is synthetisch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bundelaar=read('site/engines/dvm-storingsbundelaar.js');
const dvm2=read('site/engines/dvm-2.js');
const dvm3=read('site/engines/dvm-3.js');
const dvm1=read('site/engines/dvm-1.js');

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
  const start=dvm1.indexOf('foutcodes:[');const open=dvm1.indexOf('[',start);let diepte=0;
  for(let j=open;j<dvm1.length;j++){if(dvm1[j]==='[')diepte++;else if(dvm1[j]===']'&&--diepte===0)return vm.runInNewContext(dvm1.slice(open,j+1));}
  throw new Error('foutcodes-array niet gevonden');
}

/* De bundelaar-functies. Ze verwijzen alleen naar elkaar en naar de module-lokale
   Sets/helpers, die we meenemen. */
const ctx=vm.createContext({Number,String,Object,Array,Math,Date,Set,Map,parseFloat,parseInt,isNaN,isFinite,console,RegExp,TextDecoder,RULES:{foutcodes:haalFoutcodes()}});
// Module-lokale constanten en helpers uit de bundelaar meenemen.
vm.runInContext(`const MSI_DEGRADATIE=new Set(['1001','1002','1061','6002']);const DETECTOR_CODES=new Set(['1005','1006','1007','1008','4017','4019','5004']);const SYSTEEM_CODES=new Set(['1011','2001','4006','4014','4015','4020','4021','4023','4027','6005']);`,ctx);
for(const naam of ['sbGroupBy','sbVcAlias','sbGeldigeDatum','sbParseDT','sbMediaan','sbLocatie','sbMtmCategorie','sbSnapshotDatum','sbMtmRijenUitTekst','sbClassificeer','sbBouwBundel','sbPadInfoMtm','sbBestandGeschikt'])
  vm.runInContext(haalFunctie(bundelaar,naam),ctx,{filename:naam});
// Mapping + classificeer uit dvm-2/3 voor deel E.
for(const naam of ['lc','num','parseDatum','normAssetRichting','normRij','classificeer'])
  vm.runInContext(haalFunctie(dvm2,naam),ctx,{filename:naam});
for(const naam of ['signaalgeverOpenActief','signaalgeverOpenRij','signaalgeverHistorieRij','signaalgeverTotaalBronnen'])
  vm.runInContext(haalFunctie(dvm3,naam),ctx,{filename:naam});

const call=(naam,...args)=>vm.runInContext(naam,ctx)(...args);

/* Eén storinglijstregel: |id|code|<desc>|<locatie>|<start>| */
const regel=(id,code,desc,loc,start)=>`|${id}|${code}|${code} ${desc}|${loc}|${start}|`;

test('A. een storinglijst wordt in alarmregels geparseerd',()=>{
  const tekst=['snapshot 16-08-2026 22:30:00',
    regel('101','1001','Fout in lampcircuit bij MSI 1 lamp LAMPF2','A4 R 26,200','16-08-2026 07:28:00'),
    regel('102','1005','Detectorstation DET.3 beide lussen','A4 R 27,000','16-08-2026 08:00:00')
  ].join('\n');
  const rows=call('sbMtmRijenUitTekst',tekst,'zwn');
  assert.equal(rows.length,2);
  const msi=rows.find(r=>r.event_id==='101');
  assert.equal(msi.code,'1001');
  assert.equal(msi.weg,'A4');
  assert.equal(msi.km,26.2);
  assert.equal(msi.unit,'MSI 1');
  assert.equal(msi.categorie,'MSI');
  assert.equal(msi.meenemen,true);
  const det=rows.find(r=>r.event_id==='102');
  assert.equal(det.categorie,'DETECTOR');
  assert.equal(det.meenemen,false); // detector telt niet mee als storing
});

test('B. een verdwenen alarm sluit, een blijvend alarm blijft open_aan_einde',()=>{
  const desc='Fout in lampcircuit bij MSI 1 lamp LAMPF2';
  const snapshots=[
    {vc:'zwn',snapshot:'2026-08-16T00:30:00.000Z',rows:call('sbMtmRijenUitTekst',regel('101','1001',desc,'A4 R 26,200','16-08-2026 00:00:00'),'zwn')},
    {vc:'zwn',snapshot:'2026-08-16T01:00:00.000Z',rows:call('sbMtmRijenUitTekst',[regel('101','1001',desc,'A4 R 26,200','16-08-2026 00:00:00'),regel('102','1001',desc,'A4 R 27,000','16-08-2026 00:45:00')].join('\n'),'zwn')},
    {vc:'zwn',snapshot:'2026-08-16T01:30:00.000Z',rows:call('sbMtmRijenUitTekst',regel('102','1001',desc,'A4 R 27,000','16-08-2026 00:45:00'),'zwn')}
  ];
  const {open}=call('sbBouwBundel',snapshots,{});
  const ids=open.map(r=>r.event_id).sort().join('|');
  assert.equal(ids,'102','alleen 102 staat aan het einde nog open');
  assert.equal(open[0].eindstatus,'open_aan_einde');
});

test('C. herhaalde korte storingen worden intermitterend geclassificeerd',()=>{
  const desc='Fout in lampcircuit bij MSI 1';
  const eps=[0,10,20].map(min=>({asset_key:'zwn|A4 R 26,200|MSI 1',start:new Date(2026,7,16,7,min).toISOString(),einde_bewezen:new Date(2026,7,16,7,min+2).toISOString(),duur_min_uur:0.1,omschrijving:desc}));
  const storingen=call('sbClassificeer',eps,{langUur:4,minEpisodes:3,vensterMin:60});
  assert.ok(storingen.length>=1);
  assert.match(storingen[0].classificatie,/INTERMITTEREND/);
  assert.equal(storingen[0].aantal_cycli,3);
});

test('D. een pad buiten de MTM-mapstructuur wordt geweigerd',()=>{
  assert.ok(call('sbPadInfoMtm','X/mtm/zwn/storinglijst/2026/08/16/160826.txt'));
  assert.equal(call('sbPadInfoMtm','X/cdms/zwn/log/2026/08/16/x.txt'),null); // DRIP, geen MTM
  assert.equal(call('sbPadInfoMtm','X/mtm/zwn/verkeerd/2026/08/16/x.txt'),null);
  assert.equal(call('sbPadInfoMtm','X/mtm/onbekendevc/storinglijst/2026/08/16/x.txt'),null);
});

test('E. de bundeluitvoer wordt door de schema-tolerante mapping als MSI herkend',()=>{
  const desc='Fout in lampcircuit bij MSI 1 lamp LAMPF2';
  const snapshots=[
    {vc:'zwn',snapshot:'2026-08-16T00:30:00.000Z',rows:call('sbMtmRijenUitTekst',regel('101','1001',desc,'A4 R 26,200','16-08-2026 00:00:00'),'zwn')},
    {vc:'zwn',snapshot:'2026-08-16T01:00:00.000Z',rows:call('sbMtmRijenUitTekst',regel('101','1001',desc,'A4 R 26,200','16-08-2026 00:00:00'),'zwn')}
  ];
  const bundel=call('sbBouwBundel',snapshots,{});
  const pseudo={datasets:{mtm:{alarm_episodes:bundel.open,storingen:bundel.storingen}},metadata:{versie:'maplezen'}};
  const {open}=call('signaalgeverTotaalBronnen',pseudo);
  assert.ok(open.length>=1,'er hoort een open melding te zijn');
  const r=call('normRij',open[0]);
  assert.equal(r.weg,'A4');
  assert.equal(call('classificeer',r),'MSI');
});
