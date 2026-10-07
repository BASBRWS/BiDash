import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import {installDvmLiveSnapshotPatch} from '../site/core/live-snapshot.js';
import {installDripOpenFromHistory} from '../site/core/drip-open-from-history.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const alarm=(overrides={})=>({event_id:'LOOP',code:'1006',description:'Beide lussen fout',categorie:'DETECTOR',unit:'DETECTOR',meenemen:false,eindstatus:'open_aan_einde',weg:'A15',richting_kenmerk:'R',km:25,verkeerscentrale:'ZWN',start:'2026-01-01T06:00:00Z',laatste_snapshot:'2026-01-02T06:00:00Z',...overrides});
function runtime(){
 const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);
 r.fixtureAssets=[{key:'L1',tp:'LUS',assetType:'LUS',naam:'LUS A15',weg:'A15',richting:'RE',hm:25,vc:'ZWN',prognoseActief:true},
  {key:'M1',tp:'MSI',assetType:'MSI',naam:'MSI A15',weg:'A15',richting:'RE',hm:25,vc:'ZWN',prognoseActief:true},
  {key:'D1',tp:'DRIP',assetType:'DRIP',naam:'DRIP D1',code:'D1',weg:'A15',richting:'RE',hm:25,vc:'ZWN',prognoseActief:true}];
 r.eval('ASSET_REGISTER_STATE={assets:fixtureAssets};bouwAssetIndex()');
 r.renderDataGereedheid=()=>{};r.herbouwAssetMatchBeeld=()=>{};r.uiPauze=async()=>{};
 r.probeerAnalyseActiveren=()=>r.eval('STATE=doorrekenen(gecombineerdeLiveStoringsRijen(),{actueel:true})');
 r.analyseSignatuur=()=>'';
 assert.equal(installDvmLiveSnapshotPatch(r),true);
 assert.equal(installDripOpenFromHistory(r),true);
 return r;
}
const bundle=(r,records)=>r.signaalgeverTotaalBronnen({datasets:{mtm:{alarm_episodes:records}}});
async function load(r,records){const b=bundle(r,records);await r.pasSignaalgeverBundelToe('synthetic.json',b.open,b.historie,'test');return b;}

test('oude MTM-uitsluiting verbergt Detectielus niet en de echte doorrekening voedt detectie',async()=>{
 const r=runtime(),b=await load(r,[alarm(),alarm({event_id:'CLOSED',eindstatus:'hersteld'}),alarm({event_id:'MSI-IGNORED',categorie:'MSI',unit:'MSI 1',description:'Lampcircuit',code:'1001'})]);
 assert.equal(b.open.length,1);
 const s=r.eval('STATE');assert.equal(s.meldingen.length,1);
 assert.equal(s.meldingen[0].typeId,'LUS');assert.equal(s.meldingen[0].assetKey,'L1');
 assert.equal(s.meldingen[0].avail,5,'25 procent foutimpact maal bestaand LUS-gewicht 0,2');
 assert.deepEqual(Array.from(r.dienstSchakelsVoorAsset(r.fixtureAssets[0])),['detectie']);
 assert.equal(r.v68BronRijenPerType().LUS,1);
});

test('een detector zonder bekende foutregel blijft open en krijgt geen verzonnen impact',async()=>{
 const r=runtime();await load(r,[alarm({code:'9999',description:'Nieuw detectoralarm'})]);
 const s=r.eval('STATE');assert.equal(s.meldingen.length,0);assert.equal(s.nietDoorgerekend.length,1);
 assert.equal(s.nietDoorgerekend[0].typeId,'LUS');assert.equal(s.nietDoorgerekend[0].avail,null);
});

test('bekende LUS-code zonder typewoord blijft LUS en expliciete camera blijft CAM',()=>{
 const r=runtime();
 assert.equal(r.signaalgeverAssetType(alarm({categorie:'SYSTEEM',unit:'SYSTEEM',description:'Kanaalstoring'})),'LUS');
 assert.equal(r.signaalgeverAssetType(alarm({categorie:'CAM',unit:'CAMERA',code:'2002',description:'Geen beeld'})),'CAM');
 assert.equal(r.signaalgeverAssetType({assetTypeHint:'LUS',code:'9999',description:'Nieuw alarm'}),'LUS');
 assert.equal(r.signaalgeverAssetType(alarm({categorie:'MSI',unit:'MSI 1',code:'1005',description:'Communicatie met OS uitgevallen'})),'MSI');
 assert.equal(r.signaalgeverHistorieRij({asset:'DETECTOR',foutcode:'1007',omschrijving:'Kanaalstoring'}).assetTypeHint,'LUS');
});

test('DRIP en MTM open storingen blijven bestaan bij beide laadvolgordes en lege MTM-openlijst',async()=>{
 for(const dripFirst of [true,false]){
  const r=runtime();
  const drip=()=>{r.eval('DRIP_HIST_STATE={sources:[{key:"drip",name:"synthetic-drip.json"}],incidenten:[{code:"D1",asset:"DRIP D1",weg:"A15",richting:"RE",hm:25,vc:"ZWN",start:Date.UTC(2026,0,1),einde:null,duurUren:null,technischeToestand:"Openstaand",classificatie:"langdurig",sourceKey:"drip",sourceName:"synthetic-drip.json"}]}');r.__BIDASH_SYNC_DRIP_OPEN_FROM_HISTORY__();};
  if(dripFirst)drip();await load(r,[alarm()]);if(!dripFirst)drip();
  let rows=r.gecombineerdeLiveStoringsRijen();assert.equal(rows.length,2);
  assert.equal(rows.filter(x=>x._dripHistorieOpen).length,1);
  await load(r,[]);rows=r.gecombineerdeLiveStoringsRijen();assert.equal(rows.length,1);assert.equal(rows[0]._dripHistorieOpen,true);
 }
});

test('losse live-vervanging behoudt de onafhankelijke DRIP-totaalstroom zonder dubbelen',()=>{
 const r=runtime();r.eval('DRIP_HIST_STATE={incidenten:[{code:"D1",weg:"A15",richting:"RE",hm:25,start:1000,technischeToestand:"Openstaand"}]}');
 r.__BIDASH_SYNC_DRIP_OPEN_FROM_HISTORY__();
 for(let i=0;i<2;i++)r.voegLiveBronnenToe([{key:'loose',naam:'synthetic.csv',rijen:[r.signaalgeverOpenRij(alarm({meenemen:true}))]}]);
 assert.equal(r.gecombineerdeLiveStoringsRijen().length,2);
 assert.equal(r.eval('LIVE_STORINGSBRONNEN.filter(b=>b.virtueel).length'),1);
});

test('DVM-bronoverzichten tonen totaalstromen en historie zonder tweede invoer of verwijderknop',async()=>{
 const r=runtime();r.document.readyState='loading';r.document.title='Test';
 r.eval('DRIP_HIST_STATE={sources:[{key:"drip",name:"synthetic-drip.json"}],incidenten:[{code:"D1",weg:"A15",richting:"RE",hm:25,start:1000,technischeToestand:"Openstaand"},{code:"D2",weg:"A15",richting:"RE",hm:26,start:2000,einde:3000,duurUren:1}]}');
 r.__BIDASH_SYNC_DRIP_OPEN_FROM_HISTORY__();await load(r,[alarm()]);
 r.eval('STORINGSBRONNEN[0].rijen=[{assetTypeHint:"MSI",melding:"MSI",weg:"A15",richting:"RE",hm:25,van:"2025-01-01"}];STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen())');
 vm.runInContext(read('site/engines/dvm-source-manager.js'),r);
 const cards=r.datasetItems(),open=cards.find(x=>x.type==='dvmOpen'),hist=cards.find(x=>x.type==='dvmHistorie');
 assert.equal(open.aanwezig,true);assert.match(open.meta,/2 bronregels/);assert.match(open.meta,/Detectielus, detectie: 1 herkend/);assert.match(open.meta,/DRIP: 1 herkend/);
 assert.match(hist.meta,/3 historische regels en incidenten/);assert.match(hist.meta,/MSI: 1 herkend/);assert.match(hist.meta,/DRIP: 2 herkend/);
 assert.doesNotMatch(r.datasetItemCard(open),/verwijderDataset/);assert.match(r.datasetItemCard(open),/Signaalgevers totaal laden/);
 assert.equal(cards.some(x=>x.key==='__drip_open_from_history__'),false);
 const before=r.gecombineerdeLiveStoringsRijen().length;r.datasetItems();assert.equal(r.gecombineerdeLiveStoringsRijen().length,before);
});
