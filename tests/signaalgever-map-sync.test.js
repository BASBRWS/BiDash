import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import {installDvmLiveSnapshotPatch} from '../site/core/live-snapshot.js';

function runtime(){
  const c=dvmRuntime();
  vm.runInContext(readFileSync(new URL('../site/engines/dvm-storingsbundelaar.js',import.meta.url),'utf8'),c);
  return c;
}
const c=runtime(),h=c.__BIDASH_STORINGSBUNDELAAR__;
const stamp=hour=>`2026-08-16T${String(hour).padStart(2,'0')}:30:00.000Z`;
const alarm=(id,vc='zwn',code='1003',unit=1,start='2026-08-16T00:00:00.000Z')=>({event_id:id,event_key:vc+'|'+id,verkeerscentrale:vc,code,start,description:code==='1006'?'Detectorstation DET.3 beide lussen fout':`Fatale fout bij MSI ${unit}`,locatie:'A4 R 26,200',weg:'A4',richting_kenmerk:'R',km:26.2,unit:code==='1006'?'DETECTIELUS':`MSI ${unit}`,asset_key:vc+'|A4 R 26,200|'+unit,meenemen:true,categorie:code==='1006'?'DETECTIELUS':'MSI',impact:code==='1006'?'DETECTIE':'UITVAL'});
const snap=(hour,rows,vc='zwn')=>({vc,snapshot:stamp(hour),rows:rows.map(r=>({...r,_syncKey:h.sbSignaalgeverSleutel(c.signaalgeverOpenRij(r))}))});
const stand=(open=[],historie=[],laatstePerVc={})=>({open,historie,laatstePerVc,histRest:[],liveRest:[]});
const row=(a,hour)=>c.signaalgeverOpenRij({...a,laatste_snapshot:stamp(hour)});
const plain=x=>JSON.parse(JSON.stringify(x));

test('een VC-update behoudt andere VC, oude historie, camera en DRIP',()=>{
  const cam={vc:'ZWN',melding:'Camera defect',assetTypeHint:'CAM'},drip={vc:'NWN',melding:'Display defect',assetTypeHint:'DRIP'};
  const hist={vc:'MN',locatie:'A1 L 10,000',MSI:'MSI 1',foutcode:'1003',van:'2025-01-01',tot:'2025-01-02',assetTypeHint:'MSI'};
  const basis=h.sbSignaalgeverStand([{key:'hist',rijen:[hist,cam]}],[{key:'live',rijen:[row(alarm('1'),0),row(alarm('2','nwn'),3),cam]},{key:'drip',virtueel:true,afgeleidVan:'dripHistorie',rijen:[drip]}],null);
  const original=plain(basis);
  const r=h.sbSignaalgeverSynchroniseer(basis,[snap(1,[])]);
  assert.equal(r.open.length,1);assert.equal(r.open[0].vc,'nwn');
  assert.equal(r.historie.length,2);assert.ok(r.historie.some(x=>x===hist));
  assert.equal(basis.liveRest.length,2);assert.equal(basis.histRest[0].rijen[0],cam);
  assert.equal(r.laatstePerVc.zwn,Date.parse(stamp(1)));assert.equal(r.laatstePerVc.nwn,Date.parse(stamp(3)));
  assert.deepEqual(plain(basis),original,'de invoer blijft intact');
});
test('herhaald en overlappend inlezen levert één open en één historische melding',()=>{
  const ss=[snap(4,[alarm('1')]),snap(5,[alarm('1')])];
  const a=h.sbSignaalgeverSynchroniseer(stand(),ss);
  const b=h.sbSignaalgeverSynchroniseer(a,ss);
  assert.equal(a.open.length,1);assert.equal(b.open.length,1);
  assert.equal(a.historie.length,1);assert.equal(b.historie.length,1);
  const d=h.sbSignaalgeverSynchroniseer(b,[snap(6,[alarm('1')])]);
  assert.equal(d.open.length,1);assert.equal(d.historie.length,1);assert.equal(d.historie[0].tot,stamp(6));
});
test('een verdwenen korte melding wordt eenmaal historisch, ook LUS',()=>{
  const basis=stand([row(alarm('1'),0),row(alarm('2','zwn','1006'),0)],[],{zwn:Date.parse(stamp(0))});
  const r=h.sbSignaalgeverSynchroniseer(basis,[snap(1,[])]);
  assert.equal(r.open.length,0);assert.equal(r.historie.length,2);
  assert.ok(r.historie.every(x=>x._mtmKwaliteit==='gesloten'&&x._mtmEindeBovengrens===stamp(1)));
  assert.ok(r.historie.every(x=>x.tot===stamp(0)&&x.duurBetrouwbaar===false));
  assert.equal(h.sbSignaalgeverSynchroniseer(r,[snap(1,[])]).historie.length,2);
});
test('een open historische episode krijgt de nieuwste gesloten toestand zonder extra rij',()=>{
  const a=h.sbSignaalgeverSynchroniseer(stand(),[snap(4,[alarm('1')]),snap(5,[alarm('1')])]);
  const b=h.sbSignaalgeverSynchroniseer(a,[snap(6,[])]);
  assert.equal(b.historie.length,1);assert.equal(b.historie[0]._mtmKwaliteit,'gesloten');
  assert.equal(b.historie[0]._mtmEindeBovengrens,stamp(6));
});
test('oudere mapsneden vullen historie aan zonder open storingen terug te zetten',()=>{
  const recent=row(alarm('recent'),8);
  const basis=stand([recent],[],{zwn:Date.parse(stamp(8))});
  const old=alarm('oud','zwn','1003',2);
  const r=h.sbSignaalgeverSynchroniseer(basis,[snap(4,[old]),snap(5,[])]);
  assert.equal(r.open.length,1);assert.equal(r.open[0],recent);
  assert.equal(r.historie.length,1);assert.equal(r.updates.zwn.ouder,true);
  assert.equal(r.laatstePerVc.zwn,Date.parse(stamp(8)));
});
test('datagaten krijgen geen bewezen herstel en een blijvend alarm wordt niet dubbel opgenomen',()=>{
  const basis=stand([row(alarm('1'),0)],[],{zwn:Date.parse(stamp(0))});
  const gone=h.sbSignaalgeverSynchroniseer(basis,[snap(8,[])]);
  assert.equal(gone.historie.length,1);assert.equal(gone.historie[0]._mtmKwaliteit,'einde_onzeker_datagat');
  assert.equal(gone.historie[0]._mtmEindeBovengrens,null);
  const same=h.sbSignaalgeverSynchroniseer(basis,[snap(8,[alarm('1')])]);
  assert.equal(same.open.length,1);assert.equal(same.historie.length,1);
  assert.equal(same.historie[0]._mtmKwaliteit,'open_aan_einde');
});
test('de sleutel onderscheidt VC, rijstrook, detector, foutcode en hergebruikte nummers',()=>{
  const variants=[alarm('1'),alarm('1','nwn'),alarm('1','zwn','1003',2),alarm('1','zwn','1006'),alarm('1','zwn','1001'),alarm('1','zwn','1003',1,'2026-08-16T00:10:00.000Z')];
  assert.equal(new Set(variants.map(a=>h.sbSignaalgeverSleutel(c.signaalgeverOpenRij(a)))).size,variants.length);
  assert.equal(h.sbSignaalgeverSleutel(row(alarm('1','zwn'),0)),h.sbSignaalgeverSleutel(row(alarm('99','WNZ'),0)),'alias en veranderde bron-ID veranderen de incidentidentiteit niet');
});
test('oude DVM-totaal en MTM-totaal zijn geldige basisbestanden',()=>{
  const open=row(alarm('1','WNZ'),3);
  const d={formaat:'DVM-dienstimpact-totaal',storingshistorie:[{key:'old',rijen:[{incident_id:'SGI-1',locatie:'A1 L 10,000',start:'2025-01-01'}]}],liveStoringen:[{rijen:[open]}]};
  const s=h.sbSignaalgeverBasis(d);
  assert.equal(s.open.length,1);assert.equal(s.laatstePerVc.zwn,Date.parse(stamp(3)));
  assert.equal(s.histRest[0].rijen.length,1,'verliesarme oude historie blijft als bron bewaard');
  const mtm=h.sbSignaalgeverBasis({metadata:{watermarks:{mtm:{zwn:stamp(4)}}},datasets:{mtm:{alarm_episodes:[{...alarm('1'),eindstatus:'open_aan_einde',laatste_snapshot:stamp(3)}]}}});
  assert.equal(mtm.open.length,1);assert.equal(mtm.laatstePerVc.zwn,Date.parse(stamp(4)));
  assert.throws(()=>h.sbSignaalgeverBasis({hello:'world'}),/basisbestand/);
});
test('een lege VC-momentopname behoudt haar exacte watermerk na JSON roundtrip',()=>{
  const a=h.sbSignaalgeverSynchroniseer(stand(),[snap(5,[])]);
  const b=h.sbSignaalgeverBasis({formaat:'DVM-dienstimpact-totaal',liveStoringen:[{key:'signaalgever-totaal-open',rijen:[]}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:a.laatstePerVc}}});
  const r=h.sbSignaalgeverSynchroniseer(b,[snap(4,[alarm('1')])]);
  assert.equal(r.open.length,0);assert.equal(r.laatstePerVc.zwn,Date.parse(stamp(5)));
});
test('een optioneel basisbestand neemt geen oudere actuele stand over',()=>{
  const current=stand([row(alarm('new'),5)],[],{zwn:Date.parse(stamp(5))});
  const old=stand([row(alarm('old','zwn','1003',2),3),row(alarm('nwn','nwn'),2)],[],{zwn:Date.parse(stamp(3)),nwn:Date.parse(stamp(2))});
  const s=h.sbSignaalgeverCombineerStand(current,old);
  assert.equal(s.open.length,2);assert.ok(s.open.some(x=>x.event_id==='new'));assert.ok(!s.open.some(x=>x.event_id==='old'));
});
test('lege lijsten vereisen herkenbare header, onleesbare of onvolledige bestanden zijn geen herstel',()=>{
  const f={name:'160826.txt',webkitRelativePath:'mtm/zwn/storinglijst/2026/08/16/160826.txt'},info={vc:'zwn',datum:new Date(stamp(0))};
  const r=h.sbSignaalgeverSnapshot('MTM storinglijst\n16-08-2026 02:30:00\nGeen storingen',f,info);
  assert.equal(r.rows.length,0);
  assert.throws(()=>h.sbSignaalgeverSnapshot('',f,info),/momentopname/);
  assert.throws(()=>h.sbSignaalgeverSnapshot('MTM storinglijst\n16-08-2026 02:30:00\n|1|1003|kapot',f,info),/alarmregel/);
});
test('legacy light-historie behoudt meerdere meldingen met dezelfde locatie/start',()=>{
  const r={locatie:'A4 R 26,200',weg:'A4',start:'2025-01-01'};
  const old=[{...r},{...r},{...r}];
  assert.equal(h.sbSignaalgeverVoegSamen(old,[]).rijen.length,3);
  assert.equal(h.sbSignaalgeverVoegSamen(old,plain(old)).rijen.length,3);
});
test('gelijke momentopnamen worden eenmaal verwerkt, tegenstrijdige lijsten worden geweigerd',()=>{
  const s=snap(4,[alarm('1')]),before=plain(s);
  assert.equal(h.sbSignaalgeverSynchroniseer(stand(),[s,plain(s)]).open.length,1);
  assert.deepEqual(plain(s),before);
  assert.throws(()=>h.sbSignaalgeverSynchroniseer(stand(),[s,snap(4,[])]),/Tegenstrijdige/);
});
test('de echte mapimport, live doorrekening en totaalexport/herimport blijven samen consistent',async()=>{
  const r=runtime(),get=r.document.getElementById;
  const element=()=>({...get('x'),open:false,hidden:false,textContent:'',showModal(){this.open=true;},close(){this.open=false;},querySelector(){return element();},setAttribute(){},removeAttribute(){},click(){}});
  r.document.getElementById=()=>element();r.document.createElement=()=>element();
  r.uiPauze=async()=>{};r.leesBlobAlsArrayBuffer=f=>f.arrayBuffer();r.eval=code=>vm.runInContext(code,r);r.confirm=()=>true;
  assert.equal(installDvmLiveSnapshotPatch(r),true);
  vm.runInContext(readFileSync(new URL('../site/engines/dvm-source-export-completeness.js',import.meta.url),'utf8'),r);
  r.fixture=['ZWN','NWN'].flatMap(vc=>[1,2].map(lane=>({entityid:vc+lane,'ci-type':'VKS signaalgevers',asset:`MSI A4 R 26,200 ${lane}`,wegnummer:'4','hm-bord':'26,2',baanpositie:'R',regio:vc,status:'Operationeel'})));
  vm.runInContext("analyseerAssetRegister(fixture,'synthetic');ASSET_REGISTER_STATE.ruweRegisterRijen=fixture",r);
  const run=(vc,hour,ids)=>{
    const txt=`MTM storinglijst\n16-08-2026 ${String(hour).padStart(2,'0')}:30:00\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A4 R 26,200|16-08-2026 00:00:00|`).join('\n');
    const file=new File([txt],hour+'.txt');Object.defineProperty(file,'webkitRelativePath',{value:`mtm/${vc}/storinglijst/2026/08/16/${hour}.txt`});
    return r.leesSignaalgeverMap([file],{vcs:new Set([vc])});
  };
  await run('nwn',4,[1]);await run('zwn',4,[1,2]);
  assert.equal(vm.runInContext('STATE.meldingen.length',r),3,'dezelfde bron-ID in twee VC’s blijft een afzonderlijk incident');
  let result=await run('zwn',5,[2]);assert.equal(result.open,2);assert.equal(result.historie,3);
  assert.equal(vm.runInContext('STATE.meldingen.length',r),2);
  assert.equal(vm.runInContext('gecombineerdeStoringsRijen().filter(x=>x._mtmKwaliteit==="gesloten").length',r),1);
  result=await run('zwn',5,[2]);assert.equal(result.open,2);assert.equal(result.historie,3);
  const backup=r.totaalExportBundle(undefined,{autosaveLean:false});
  assert.equal(backup.bronbeheer.signaalgeverTotaal.laatstePerVc.zwn,new Date(2026,7,16,5,30).getTime());
  await r.totaalImportJson(new File([JSON.stringify(backup)],'backup.json'));
  result=await run('zwn',6,[]);assert.equal(result.open,1);assert.equal(result.historie,3);
  assert.equal(vm.runInContext('STATE.meldingen.length',r),1);
  const before=vm.runInContext('JSON.stringify([STORINGSBRONNEN,LIVE_STORINGSBRONNEN,window.__BIDASH_SIGNAALGEVER_TOTAAL__])',r);
  const bad=new File(['MTM storinglijst\n16-08-2026 07:30:00\n|1|broken'],'bad.txt');Object.defineProperty(bad,'webkitRelativePath',{value:'mtm/zwn/storinglijst/2026/08/16/bad.txt'});
  await assert.rejects(()=>r.leesSignaalgeverMap([bad],{vcs:new Set(['zwn'])}),/alarmregel/);
  assert.equal(vm.runInContext('JSON.stringify([STORINGSBRONNEN,LIVE_STORINGSBRONNEN,window.__BIDASH_SIGNAALGEVER_TOTAAL__])',r),before);
});
