import test from 'node:test';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {deriveOpenDripRows,deriveOpenDripFaults} from '../site/core/drip-open-from-history.js';
import {matchDripIncident} from '../site/core/drip-fault-match.js';
import {formatFaultDuration,buildOpenFaultMemo} from '../site/core/open-fault-view.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const engine=read('site/engines/dvm-2.js');
const between=(a,b)=>engine.slice(engine.indexOf(a),engine.indexOf(b,engine.indexOf(a)));
const incident={code:'D501',asset:'D501',weg:'A99',richting:'LI',hm:4,vc:'NWN',start:Date.UTC(2026,0,1),einde:Date.UTC(2026,0,3),duurUren:48,duurBetrouwbaar:false,censored:true,sourceKey:'synthetic',sourceName:'synthetic.xlsx'};
function scope(){
 const context={RULES:{cfg:{liveDekking:{DRIP:true}},foutcodes:[],assetTypen:[{id:'DRIP',wAvail:1,wPerf:1}],combiRegels:[]},
  DIENSTEN:[],ASSET_REGISTER_STATE:{assets:[{tp:'DRIP'}]},ASSET_INDEX:null,STATE:null,LIVE_STORINGSBRONNEN:[],
  normAssetRichting:v=>String(v||'').toUpperCase(),koppelMeldingAanAsset:()=>({status:'niet-gekoppeld'}),pasAssetKoppelingToe:()=>{},
  datasetPeriode:()=>({}),areaalVoorWegdeel:()=>1};
 vm.createContext(context);
 vm.runInContext(between('function canoniekAssetType(', 'function normAssetVc'),context);
 vm.runInContext(between('function lc(', '/* stap 2: MSI-ernstcontext'),context);
 vm.runInContext(between('const V68_TYPES=', 'function v68ObjType'),context);
 return context;
}
test('onbekende duur is geen minuut en telt niet mee in gemiddelde',()=>{
 assert.equal(formatFaultDuration(null),'Onbekend');assert.equal(formatFaultDuration(undefined),'Onbekend');assert.equal(formatFaultDuration(0),'0 min');
 const memo=buildOpenFaultMemo([{duurUren:null},{duurUren:8},{duurUren:48,duurBetrouwbaar:false}]);assert.equal(memo.averageDurationHours,8);
});
test('historie bewaart start, duur en onzekerheid bij omzetting naar live bron',()=>{
 const [row]=deriveOpenDripRows([incident]);assert.equal(row.van,new Date(incident.start).toISOString());assert.equal(row.storingsduur_uren,48);assert.equal(row.duurBetrouwbaar,false);
 const c=scope(),m=c.normRij(row);assert.equal(m.duurUren,48);assert.equal(m.duurBetrouwbaar,false);assert.equal(c.classificeer(m),'DRIP');assert.equal(c.foutregel(m,'DRIP'),null);
});
test('landelijke telling bewaart niet doorgerekende meldingen en geeft geen exact percentage',()=>{
 const c=scope();c.STATE={meldingen:[],nietDoorgerekend:[{typeId:'DRIP'}],stats:{periodeUren:24}};
 const status=c.v68TypeStatus().DRIP;assert.equal(status.inBron,1);assert.equal(status.nietDoorgerekend,1);assert.equal(status.besch,null);assert.match(status.status,/niet doorgerekend/);
 c.STATE.nietDoorgerekend=[];assert.equal(c.v68TypeStatus().DRIP.besch,100);
});
test('dezelfde DRIP-code op een andere weg wordt ook als enige kandidaat geweigerd',()=>{
 const asset={key:'other',tp:'DRIP',code:'D501',weg:'A98',richting:'LI',hm:4};
 assert.equal(matchDripIncident(incident,[asset],[]),null);
 assert.equal(matchDripIncident({...incident,matchAssetKey:'other'},[asset],[]),null);
});
test('HUB verrijking voegt geen tweede incident toe en bewaart onbekende impact',()=>{
 const row={id:'synthetic',typeId:'DRIP',code:incident.code,naam:'DRIP D501',start:incident.start,duurUren:48,duurBetrouwbaar:false,impact:null,afgeleidUitHistorie:true};
 const window={HUB:{faults:()=>[row]}};
 vm.runInNewContext(read('site/engines/dvm-faults-extension.js'),{window,console,STATE:{meldingen:[]},ASSET_REGISTER_STATE:{assets:[]},DRIP_STATE:{drips:[]},DRIP_HIST_STATE:{incidenten:[incident]}});
 const faults=window.HUB.faults();assert.equal(faults.length,1);assert.equal(faults[0].duurUren,48);assert.equal(faults[0].impact,null);assert.equal(faults[0].start,new Date(incident.start).toISOString());
});

test('de echte rekenketen en adapter behouden één onbekende melding en weigeren een alias op een andere weg',()=>{
 const c=dvmRuntime();
 c.rows=deriveOpenDripRows([incident,incident]);
 c.register=[{entityid:'SYNTHETIC-WRONG','ci-type':'DRI Panelen',asset:'NWN DRI DRIP A98L 4,000 (D501)',status:'Operationeel',wegnummer:'98',baanpositie:'L',type:'DRIP',regio:'VCNWN'}];
 vm.runInContext("RULES.foutcodes=[];RULES.cfg.liveDekking={DRIP:true};RULES.assetConfig=assetConfigBasis();RULES.assetConfig.aliases.D501='ID:SYNTHETIC-WRONG';analyseerAssetRegister(register,'synthetic');STATE=doorrekenen(rows,{actueel:true});",c);
 const state=vm.runInContext('STATE',c);assert.equal(state.meldingen.length,0);assert.equal(state.nietDoorgerekend.length,1);assert.equal(state.nietDoorgerekend[0].assetMatchStatus,'locatieconflict');assert.equal(state.nietDoorgerekend[0].weg,'A99');
 const adapter=read('site/engines/dvm-adapter-original.js'),a=adapter.indexOf('  faults(){'),b=adapter.indexOf('\n  detail(',a);
 vm.runInContext('window.HUB={'+adapter.slice(a,b)+'};',c);
 vm.runInContext(read('site/engines/dvm-faults-extension.js'),c);
 assert.equal(c.HUB.faults().length,1);assert.equal(c.HUB.faults()[0].duurUren,48);assert.equal(c.HUB.faults()[0].assetKey,'');assert.equal(c.HUB.faults()[0].impact,null);
 const status=c.v68TypeStatus().DRIP;assert.equal(status.inBron,1);assert.equal(status.besch,null);
});
test('herstel van oude Dynac-classificatie koppelt op locatie en behoudt de twee kenmerken',()=>{
 const c=dvmRuntime();vm.runInContext(read('site/engines/dvm-special-drip-lists.js'),c);
 const record={ids:[{raw:'D501',token:'D501'},{raw:'A99L_004-000_D',token:'A99L004000D'}],locatie:{vc:'NWN',weg:'',richting:'',hm:0}};
 c.restoreDripSpecialLists({wind:{records:[],identifiers:[]},ria4:{records:[record],identifiers:record.ids}});
 const restored=c.DVM_SPECIAL_DRIP_LISTS.ria4.records[0],h=c.__BIDASH_SPECIAL_DRIP_CLASSIFICATION__;
 assert.equal(restored.locatie.weg,'A99');assert.equal(restored.locatie.hm,4);
 assert.equal(h.matchesRecord({code:'D501',weg:'A99',richting:'LI',hm:4,vc:'NWN'},restored),true);
 assert.equal(h.matchesRecord({code:'D501',weg:'A98',richting:'LI',hm:4,vc:'NWN'},restored),false);
 assert.equal(h.rowLocation({code:'D501'}).hm,null);
});
