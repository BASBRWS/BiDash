import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {makeExport,mergeImport,DEFAULT_STATE} from '../site/core/model.js';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import '../site/core/incident-lifecycle.js';
import {deriveOpenDripRows} from '../site/core/drip-open-from-history.js';
import {filterOpenFaults,buildOpenFaultMemo} from '../site/core/open-fault-view.js';
import {installDvmLiveSnapshotPatch} from '../site/core/live-snapshot.js';
import {operationalStatusForFault} from '../site/core/asset-operational-status.js';
const H=globalThis.DVM_INCIDENT_LIFECYCLE;
const t=h=>new Date(Date.UTC(2026,9,10,h)).toISOString();
function runtime(){const r=dvmRuntime();vm.runInContext(readFileSync(new URL('../site/engines/dvm-storingsbundelaar.js',import.meta.url),'utf8'),r);r.eval=s=>vm.runInContext(s,r);return r;}
const row=(id='1',lane=1,extra={})=>({event_id:id,event_key:'zwn|'+id,verkeerscentrale:'zwn',code:'1003',start:t(0),description:`Fatale fout bij MSI ${lane}`,locatie:'A4 RE 26.200',weg:'A4',richting_kenmerk:'RE',km:26.2,unit:'MSI '+lane,meenemen:true,categorie:'MSI',...extra});
const empty=()=>({open:[],historie:[],laatstePerVc:{},snapshotDekking:{}});
function snapshot(r,h,rows=[],extra={}){return {vc:'zwn',snapshot:t(h),bestand:'synthetic',dekking:{volledig:true},rows:rows.map(x=>({...x,_syncKey:r.__BIDASH_STORINGSBUNDELAAR__.sbSignaalgeverSleutel(r.signaalgeverOpenRij(x))})),...extra};}
const sync=(r,b,s)=>r.__BIDASH_STORINGSBUNDELAAR__.sbSignaalgeverSynchroniseer(b,s);

test('ouderdom van de bevestiging gaat over laatste waarneming, niet over de begintijd',()=>{
 const r={_liveOpen:true,van:'2020-01-01',eerste_gezien:t(0),laatste_gezien:t(50),bron_peildatum:t(50),levenscyclus_status:'OPEN_BEVESTIGD'};
 assert.equal(H.read(r,{now:t(51)}).levenscyclus_status,'OPEN_BEVESTIGD');
 assert.equal(H.read(r,{now:t(99)}).levenscyclus_status,'OPEN_VEROUDERD');
 assert.equal(H.read({...r,laatste_gezien:null},{now:t(51)}).levenscyclus_status,'OPEN_VEROUDERD');
});
test('een start- of importtijd bewijst geen recente open waarneming of herstel',()=>{
 const a=H.read({_liveOpen:true,van:t(0)},{now:t(1)});assert.equal(a.levenscyclus_status,'ONBEKEND_DOOR_BRONGAT');assert.equal(a.hersteld_op,null);assert.equal(a.laatste_gezien,null);
 const b=H.stamp({hersteld_op:t(1)},{levenscyclus_status:'HERSTELD_AFGELEID'});assert.equal(b.hersteld_op,null);
});
test('twee volledige opvolgende snapshots sluiten afgeleid, met behoud van alle vier tijden',()=>{
 const r=runtime(),a=sync(r,empty(),[snapshot(r,1,[row()])]),b=sync(r,a,[snapshot(r,2)]);
 assert.equal(b.open.length,1);assert.equal(b.open[0].levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');assert.equal(b.open[0]._liveOpen,false);
 const c=sync(r,b,[snapshot(r,3)]);assert.equal(c.open.length,0);assert.equal(c.historie.length,1);
 const x=c.historie[0];assert.equal(x.eerste_gezien,t(1));assert.equal(x.laatste_gezien,t(1));assert.equal(x.bron_peildatum,t(3));assert.equal(x.hersteld_op,null);
 assert.equal(x.levenscyclus_status,'HERSTELD_AFGELEID');assert.equal(x.herstel_venster_van,t(1));assert.equal(x.herstel_venster_tot,t(3));assert.ok(x.incident_id);assert.equal(x.duurBetrouwbaar,false);
});
test('een ontbrekende of onvolledige bron houdt de melding zichtbaar zonder herstel',()=>{
 const r=runtime();let state=sync(r,empty(),[snapshot(r,1,[row()])]);
 state=sync(r,state,[snapshot(r,2,[],{dekking:{volledig:false}}),snapshot(r,3,[],{dekking:{volledig:false}})]);
 assert.equal(state.open.length,1);assert.equal(state.open[0].levenscyclus_status,'ONBEKEND_DOOR_BRONGAT');assert.equal(state.open[0].ontbrekend_volledige_snapshots,0);assert.equal(state.historie[0].hersteld_op,null);assert.equal(state.levenscyclusAudit.bronDekkingVolledig,false);
});
test('een tijdgat herstart de afwezigheidscontrole en wordt niet ingevuld met een hersteltijd',()=>{
 const r=runtime(),a=sync(r,empty(),[snapshot(r,1,[row()])]),b=sync(r,a,[snapshot(r,12)]);
 assert.equal(b.open[0].levenscyclus_status,'ONBEKEND_DOOR_BRONGAT');assert.equal(b.snapshotDekking.zwn.bronGap,true);
 const c=sync(r,b,[snapshot(r,13)]);assert.equal(c.open[0].levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');
 const d=sync(r,c,[snapshot(r,14)]);assert.equal(d.open.length,0);assert.equal(d.historie[0].hersteld_op,null);assert.equal(d.historie[0].laatste_gezien,t(1));
});
test('terugkerende aanwezigheid trekt een voorlopige afwezigheid in zonder extra incident',()=>{
 const r=runtime(),a=sync(r,empty(),[snapshot(r,1,[row()]),snapshot(r,2)]),b=sync(r,a,[snapshot(r,3,[row('99')])]);
 assert.equal(b.open.length,1);assert.equal(b.historie.length,1);assert.equal(b.open[0].levenscyclus_status,'OPEN_BEVESTIGD');assert.equal(b.open[0].ontbrekend_volledige_snapshots,0);assert.equal(b.open[0].eerste_gezien,t(1));
});
test('sterke volumedaling sluit niet massaal; volgende volledige snapshots moeten eerst bevestigen',()=>{
 const r=runtime(),rows=Array.from({length:20},(_,i)=>row(String(i),i+1));let a=sync(r,empty(),[snapshot(r,1,rows)]);
 a=sync(r,a,[snapshot(r,2,[rows[0]])]);assert.equal(a.open.length,20);assert.equal(a.snapshotDekking.zwn.volumeVerdacht,true);
 a=sync(r,a,[snapshot(r,3,[rows[0]])]);assert.equal(a.open.length,20);
 a=sync(r,a,[snapshot(r,4,[rows[0]])]);assert.equal(a.open.length,1);assert.equal(a.historie.length,20);
});
test('identieke bron-ID in twee VC’s of op twee rijstroken is geen dubbel incident',()=>{
 const r=runtime(),a=snapshot(r,1,[row('1',1),row('1',2)]),b=snapshot(r,1,[row('1',1,{verkeerscentrale:'nwn'})],{vc:'nwn'}),s=sync(r,empty(),[a,b]);
 assert.equal(s.open.length,3);assert.equal(new Set(s.open.map(x=>x.incident_id)).size,3);
 const again=sync(r,s,[a,b]);assert.equal(again.open.length,3);assert.equal(again.historie.length,3);
});
test('onvolledige locatie blijft als onvolledige identiteit behouden, zonder nieuwe rij per snapshot',()=>{
 const r=runtime(),x=row('unknown',1,{locatie:'Onbekend object',weg:'',richting_kenmerk:'',km:null}),s=sync(r,empty(),[snapshot(r,1,[x]),snapshot(r,2,[x])]);
 assert.equal(s.open.length,1);assert.equal(s.historie.length,1);assert.equal(s.open[0].identiteit_volledig,false);
});
test('systemen en overige alarmen blijven apart van MSI, geen technische bronregel verdwijnt',()=>{
 const r=runtime(),s=sync(r,empty(),[snapshot(r,1,[row(),row('sys',1,{categorie:'SYSTEEM',unit:'SYSTEEM',description:'Hoofdvoeding',code:'2001'}),row('other',1,{categorie:'OVERIG',unit:'OVERIG',description:'Onbekend alarm',code:'9999',meenemen:false})])]);
 assert.equal(s.open.length,3);assert.equal(s.historie.length,3);assert.equal(s.open.find(x=>x.event_id==='sys').assetTypeHint,'SYSTEEM');assert.equal(s.open.find(x=>x.event_id==='other').assetTypeHint,'ONBEKEND');
});
test('expliciet onvolledige snapshots en afwijkende opgegeven aantallen worden niet als volledig behandeld',()=>{
 const r=runtime(),h=r.__BIDASH_STORINGSBUNDELAAR__,f={name:'x.txt',webkitRelativePath:'mtm/zwn/storinglijst/2026/10/10/x.txt'},info={vc:'zwn',datum:new Date(t(1))};
 assert.equal(h.sbSignaalgeverSnapshot('MTM storinglijst gedeeltelijk\n10-10-2026 01:00:00\nGeen storingen',f,info).dekking.volledig,false);
 assert.throws(()=>h.sbSignaalgeverSnapshot('MTM storinglijst\n10-10-2026 01:00:00\nAantal alarmen: 2\nGeen storingen',f,info),/regelaantal/);
});
test('tellingen onderscheiden meldingen, fysieke assets en onvoldoende identiteit',()=>{
 const rows=[{assetKey:'S1',typeId:'MSI',code:'1001',levenscyclus_status:'OPEN_BEVESTIGD',laatste_gezien:t(1)},{assetKey:'S1',typeId:'MSI',code:'1003',levenscyclus_status:'OPEN_BEVESTIGD',laatste_gezien:t(1)},{typeId:'SYSTEEM',technische_categorie:'SYSTEEM',levenscyclus_status:'ONBEKEND_DOOR_BRONGAT'}];
 const s=H.summary(rows,{now:t(2)});assert.equal(s.meldingen,3);assert.equal(s.geraakteAssets,1);assert.equal(s.meldingenZonderUniekAsset,1);assert.equal(s.onzeker,1);
 assert.equal(filterOpenFaults(rows,{lifecycle:'ONBEKEND_DOOR_BRONGAT'}).length,1);assert.equal(buildOpenFaultMemo(rows).lifecycle.geraakteAssets,1);
});
test('een onzekere bron maakt een asset niet bewezen gezond of defect en blokkeert een exact dienstpercentage',()=>{
 const f={typeId:'MSI',code:'1003',levenscyclus_status:'ONBEKEND_DOOR_BRONGAT'};
 assert.equal(operationalStatusForFault({tp:'MSI'},f),'Onbekend door brononzekerheid');
 const r=runtime();r.rows=[{locatie:'A4 RE 26.200',assettype:'MSI',foutcode:'1003',vc:'ZWN',van:t(0),levenscyclus_status:'ONBEKEND_DOOR_BRONGAT'}];r.eval('STATE=doorrekenen(rows,{actueel:true,peildatum:Date.parse("'+t(2)+'")})');
 assert.equal(r.eval('STATE.meldingen.length'),0);assert.equal(r.eval('STATE.nietDoorgerekend.length'),1);
});
function dripRuntime(){const r=runtime();r.uiPauze=async()=>{};r.probeerAnalyseActiveren=()=>{};return r;}
const dripRow=(asset='D80',extra={})=>({verkeerscentrale:'zwn',asset,locatie:'A15 RE 12.000',start:t(0),einde_bewezen:null,duur_min_uur:0,kwaliteitsstatus:'open',bron:'URGENT/OK',conditie:'status|GESTOPT',eerste_gezien:t(0),laatste_gezien:t(0),bron_peildatum:t(0),...extra});
test('DRIP-herstel uit een volgende mapscan sluit een eerder open incident, ook bij dezelfde bronnaam',async()=>{
 const r=dripRuntime();await r.pasDripBundelToe('synthetic',{episodes:[dripRow()],storingen:[]},'maplezen','toevoegen');
 assert.equal(deriveOpenDripRows(r.eval('DRIP_HIST_STATE.incidenten')).length,1);
 const herstel={verkeerscentrale:'zwn',asset:'D80',locatie:'A15 RE 12.000',conditie:'status|GESTOPT',hersteld_op:t(1),bronbestand:'synthetic'};
 await r.pasDripBundelToe('synthetic',{episodes:[],storingen:[],herstelmeldingen:[herstel]},'maplezen','toevoegen');
 const list=r.eval('DRIP_HIST_STATE.incidenten');assert.equal(list.length,1);assert.equal(list[0].hersteld_op,t(1));assert.equal(list[0].levenscyclus_status,'HERSTELD_BEVESTIGD');assert.equal(deriveOpenDripRows(list).length,0);
 const backup=r.totaalExportBundle();assert.equal(backup.dripHistorie.sources[0].herstelmeldingen.length,1);
 r.sources=backup.dripHistorie.sources;r.eval('DRIP_HIST_STATE={sources};herbouwDripHistorie()');assert.equal(deriveOpenDripRows(r.eval('DRIP_HIST_STATE.incidenten')).length,0);
});
test('DRIP-herstel sluit geen andere VC, conditie of nieuw incident na dat herstel',async()=>{
 const r=dripRuntime();await r.pasDripBundelToe('a',{episodes:[dripRow(),dripRow('D80',{verkeerscentrale:'nwn'}),dripRow('D80',{conditie:'status|DISPLAY'}),dripRow('D80',{start:t(2)})],storingen:[]},'maplezen','toevoegen');
 await r.pasDripBundelToe('b',{herstelmeldingen:[{verkeerscentrale:'zwn',asset:'D80',locatie:'A15 RE 12.000',conditie:'status|GESTOPT',hersteld_op:t(1)}]},'maplezen','toevoegen');
 const list=r.eval('DRIP_HIST_STATE.incidenten');assert.equal(list.filter(x=>x.hersteld_op).length,1);assert.equal(deriveOpenDripRows(list).length,3);
});
test('ook een korte gesloten DRIP-episode blijft bewaard als de classificatietabel leeg is',()=>{
 const r=runtime(),source=r.dripDatasetNaarBron({episodes:[dripRow('D80',{einde_bewezen:t(1),duur_min_uur:1,kwaliteitsstatus:'gesloten',hersteld_op:t(1)})],storingen:[]},'s','synthetic');
 assert.equal(source.incidenten.length,1);assert.equal(source.incidenten[0].hersteld_op,t(1));
});
test('meerdere actuele foutcodes op één fysieke MSI blijven meldingen, fysieke uitval telt eenmaal',()=>{
 const r=runtime();r.rows=[{entityid:'S1',asset:'MSI A4 RE 26.200 1','ci-type':'VKS signaalgevers',status:'Operationeel',regio:'ZWN'}];r.eval('analyseerAssetRegister(rows,"synthetic")');
 const a={entityid:'S1',locatie:'A4 RE 26.200',MSI:'1',vc:'ZWN',assettype:'MSI',foutcode:'1003',melding:'Fatale fout bij MSI 1',van:t(0)},b={...a,foutcode:'1001',melding:'Fout in lampcircuit bij MSI 1'};
 for(const rows of [[a,b],[b,a]]){r.faults=rows;const s=r.eval('doorrekenen(faults,{actueel:true,peildatum:Date.parse("'+t(1)+'")})');assert.equal(s.meldingen.length,2);assert.equal(s.meldingen.reduce((n,m)=>n+m.trace.bijdrageAvail,0),24);assert.ok(s.meldingen.every(m=>m.trace.overlapCorrectie));}
});

test('snapshotverantwoording telt elke bronrij en bewaart actuele incidenten in de historie',()=>{
 const r=runtime(),x=row(),s=sync(r,empty(),[snapshot(r,1,[x,x,row('2',2)])]);
 assert.equal(s.snapshotDekking.zwn.aantal,3);assert.equal(s.snapshotDekking.zwn.uniekeMeldingen,2);assert.equal(s.snapshotDekking.zwn.dubbeleBronrijen,1);
 assert.equal(s.levenscyclusAudit.snapshotBalans,true);assert.equal(s.levenscyclusAudit.actueleZonderHistorie,0);assert.equal(s.levenscyclusAudit.administratiefSluitend,true);
 const legacy=sync(r,{...empty(),historie:[{locatie:'legacy',van:t(0)}]},[snapshot(r,1,[x])]);assert.equal(legacy.levenscyclusAudit.administratiefSluitend,false);
});
test('losse live imports behouden onbekende meldingen en werken historie bij na terugkeer',()=>{
 const r=runtime();assert.equal(installDvmLiveSnapshotPatch(r),true);
 const now=new Date().toISOString(),a={event_id:'same',locatie:'A4 RE 26.200',MSI:'1',vc:'ZWN',assettype:'MSI',foutcode:'1003',van:t(0),eerste_gezien:t(0),laatste_gezien:now,bron_peildatum:now,levenscyclus_status:'OPEN_BEVESTIGD'};
 r.a=a;r.eval('voegLiveBronnenToe([{key:"a",naam:"a",rijen:[a]}])');
 for(let i=0;i<2;i++)r.eval('voegLiveBronnenToe([{key:"empty",naam:"empty",rijen:[]}])');
 assert.equal(r.eval('gecombineerdeLiveStoringsRijen().length'),1);assert.equal(r.eval('gecombineerdeLiveStoringsRijen()[0].levenscyclus_status'),'ONBEKEND_DOOR_BRONGAT');
 assert.equal(r.eval('STORINGSBRONNEN.flatMap(b=>b.rijen).length'),1);
 r.eval('voegLiveBronnenToe([{key:"a",naam:"a",rijen:[a]}])');
 assert.equal(r.eval('gecombineerdeLiveStoringsRijen().length'),1);assert.equal(r.eval('STORINGSBRONNEN.flatMap(b=>b.rijen)[0].levenscyclus_status'),'OPEN_BEVESTIGD');assert.equal(r.eval('STORINGSBRONNEN.flatMap(b=>b.rijen)[0].hersteld_op'),null);
});
test('een mislukte losse live bestandenset vervangt geen enkele eerdere bron',async()=>{
 const r=runtime();assert.equal(installDvmLiveSnapshotPatch(r),true);r.alert=()=>{};r.uiPauze=async()=>{};r.zetImportVoortgang=()=>{};r.importMislukt=()=>{};
 r.storingsBronUitBestand=async f=>{if(f.name==='bad.csv')throw Error('synthetic read failure');return {key:f.name,naam:f.name,rijen:[{locatie:'A4 RE 26.200',MSI:'1',assettype:'MSI',foutcode:'1003'}]};};
 r.eval('ASSET_REGISTER_STATE={};LIVE_STORINGSBRONNEN=[{key:"old",naam:"old",rijen:[{event_id:"old"}]}]');
 await r.leesLiveStoringsBestanden([{name:'good.csv'},{name:'bad.csv'}]);assert.equal(r.eval('LIVE_STORINGSBRONNEN.length'),1);assert.equal(r.eval('LIVE_STORINGSBRONNEN[0].key'),'old');
});

test('integrale selectie-export bewaart de uitleg van de storingslevenscyclus',()=>{
 const schema={versie:1,historieOmvatOokActieveIncidenten:true};
 const state={dvm:{liveStoringen:[],bronbeheer:{levenscyclus:schema}}};
 const out=makeExport(state,new Set(['liveStoringen']));assert.deepEqual(out.delen.dvm.bronbeheer.levenscyclus,schema);assert.deepEqual(mergeImport(DEFAULT_STATE(),out).dvm.bronbeheer.levenscyclus,schema);
 const other=makeExport(state,new Set(['parameters']));assert.equal(other.delen.dvm.bronbeheer,undefined);
});
