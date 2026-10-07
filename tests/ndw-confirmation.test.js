import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function runtime(){
 const r=dvmRuntime();
 r.fixture={schema:1,publication:'2026-01-05T07:01:00Z',files:['synthetic.xml'],sha256:['synthetic'],stats:{sites:2,validSites:2},sites:[
  {id:'NEAR',road:'A15',direction:'RE',hm:25,q:900,period:60,time:'2026-01-05T07:00:00Z',speed:100,lanes:[{lane:'1',q:900}],issues:[]},
  {id:'OTHER',road:'A15',direction:'RE',hm:30,q:600,period:60,time:'2026-01-05T07:00:00Z',speed:100,lanes:[{lane:'1',q:600}],issues:[]}
 ]};
 r.rows=[
  {key:'LOCAL',weg:'A15',richting:'RE',meldingen:[{hm:25,avail:80}]},
  {key:'EXTENDED',weg:'A15',richting:'RE',meldingen:[{hm:35,avail:80}]},
  {key:'MISSING',weg:'A99',richting:'RE',meldingen:[{hm:25,avail:80}]}
 ];
 vm.runInContext("RULES.kosten={ndw69Snapshot:fixture,scenario67:{uren:6,reductie:30,km:2,bron:'Synthetisch scenario'}}",r);
 r.kostenDagRows=()=>r.rows;
 r.kostenSchermVervers=()=>{r.refreshes++;};r.refreshes=0;
 r.messages=[];r.parent={postMessage:m=>r.messages.push(m)};
 return r;
}
const confirm=(r,key,checked=true)=>r.ndw69Confirm({dataset:{weg:key},checked});

test('bevestigen verhoogt bevestigd en verlaagt controle, zonder dezelfde kosten tweemaal te tellen',()=>{
 const r=runtime(),before=r.rows.map(w=>r.kostenDagResultaat(w).kosten);
 assert.deepEqual(JSON.parse(JSON.stringify(r.ndw69Coverage(r.rows))),{total:3,available:2,confirmed:0,pending:2,disabled:0,extended:1,extendedPending:1,unmatched:1});
 confirm(r,'EXTENDED');
 const c=r.ndw69Coverage(r.rows);
 assert.equal(c.confirmed,1);assert.equal(c.pending,1);assert.equal(c.extendedPending,0);
 assert.deepEqual(r.rows.map(w=>r.kostenDagResultaat(w).kosten),before);
 assert.equal(r.refreshes,1);assert.equal(r.messages.filter(m=>m.type==='hub:changed').length,1);
 assert.match(r.ndw69Summary(r.rows),/NDW locaties bevestigd: 1 van 2/);
 assert.match(r.ndw69Summary(r.rows),/Nog te controleren: 1/);
 assert.match(r.ndw69Summary(r.rows),/Ruimere koppelingen: 1, waarvan 0 nog te controleren/);
 confirm(r,'EXTENDED');assert.equal(r.ndw69Coverage(r.rows).confirmed,1);
 confirm(r,'EXTENDED',false);assert.equal(r.ndw69Coverage(r.rows).confirmed,0);
});

test('opslaan behoudt bevestiging en een ander meetpunt maakt opnieuw controle nodig',()=>{
 const r=runtime();confirm(r,'EXTENDED');
 const w=r.rows[1],c=r.sc67Config(w);
 const fields=Object.entries(c).filter(([key])=>['q','uren','reductie','km','snelheid','bron','status','delayMode'].includes(key)).map(([key,value])=>({dataset:{sc67:key},type:typeof value==='number'?'number':'text',value:String(value)}));
 r.sc67Bewaar({closest:()=>({dataset:{sc67Key:w.key},querySelectorAll:()=>fields})});
 assert.equal(r.ndw69Coverage(r.rows).confirmed,1);
 r.ndw69Choose({dataset:{weg:w.key},value:'NEAR'});
 assert.equal(r.ndw69Coverage(r.rows).confirmed,0);assert.equal(r.ndw69Coverage(r.rows).pending,2);
});

test('bevestigen laat nog niet opgeslagen verkeersvelden staan, daarna opslaan herberekent',()=>{
 const r=runtime(),w=r.rows[1],before=r.kostenDagResultaat(w).kosten;
 let closes=0;const status={textContent:''},feedback={textContent:''};
 const dialog={open:true,close(){closes++;},querySelector(){return null;}};
 r.document.getElementById=id=>id==='kostenDialog'?dialog:null;
 const section={querySelector:selector=>selector==='[data-ndw-status]'?status:feedback};
 const fields=Object.entries(r.sc67Config(w)).filter(([key])=>['q','uren','reductie','km','snelheid','bron','status','delayMode'].includes(key)).map(([key,value])=>({dataset:{sc67:key},type:typeof value==='number'?'number':'text',value:String(key==='uren'?12:value)}));
 r.ndw69Confirm({dataset:{weg:w.key},checked:true,closest:()=>section});
 assert.equal(closes,0,'bevestigen sluit het formulier niet');
 assert.equal(fields.find(f=>f.dataset.sc67==='uren').value,'12');
 assert.match(status.textContent,/locatie bevestigd/);assert.match(feedback.textContent,/verkeersinvoer/);
 assert.equal(r.kostenDagResultaat(w).kosten,before,'nog niet opgeslagen invoer verandert geen kosten');
 dialog.open=false;
 r.sc67Bewaar({closest:()=>({dataset:{sc67Key:w.key},querySelectorAll:()=>fields})});
 assert.equal(r.ndw69Coverage(r.rows).confirmed,1);
 assert.equal(r.kostenDagResultaat(w).kosten,before*2,'de opgeslagen hinderuren werken numeriek door');
});

test('kostenvenster noemt de ontbrekende invoer in plaats van alleen bevestiging te vragen',()=>{
 const r=runtime();
 assert.deepEqual(Array.from(r.sc67OntbrekendeInvoer({q:900,uren:'',delayMode:'direct',minuten:'',bron:''})),['hinderuren','extra minuten per voertuig','bron en onderbouwing']);
 assert.deepEqual(Array.from(r.sc67OntbrekendeInvoer({q:0,uren:0,delayMode:'direct',minuten:0,bron:'Synthetisch'})),[]);
 vm.runInContext('RULES.kosten.scenario67.uren=""',r);
 assert.match(r.kostenModelEditor(r.rows[0]),/Nog nodig: hinderuren/);
 assert.equal(r.kostenDagResultaat(r.rows[0]).kosten,null);
});

test('uitgezet gebruik en ontbrekende metingen zijn geen bevestigde of te controleren koppeling',()=>{
 const r=runtime();confirm(r,'LOCAL');
 r.ndw69Use({dataset:{weg:'LOCAL'},checked:false});
 confirm(r,'MISSING');
 const c=r.ndw69Coverage(r.rows);
 assert.equal(c.confirmed,0);assert.equal(c.pending,1);assert.equal(c.disabled,1);assert.equal(c.unmatched,1);
 assert.equal(r.kostenDagResultaat(r.rows[2]).kosten,null);
});

test('export van kostenparameters bewaart de bevestiging en zijn controlesleutel',()=>{
 const r=runtime();confirm(r,'EXTENDED');
 r.saved=structuredClone(r.ndw69ExportKosten());
 vm.runInContext('RULES.kosten=saved',r);
 assert.equal(r.ndw69Coverage(r.rows).confirmed,1);
 assert.equal(r.ndw69Link(r.rows[1]).confirmed,true);
 // Een andere verkeersbron mag een eerdere bevestiging niet stil overnemen.
 r.saved.ndw69Snapshot.sha256=['new-synthetic'];
 assert.equal(r.ndw69Coverage(r.rows).confirmed,0);
});

test('bronkaart telt bevestigingen en te controleren ruimere koppelingen opnieuw na wijzigen',()=>{
 const r=runtime();r.document.readyState='loading';r.document.title='Test';r.datasetItems=()=>[];
 vm.runInContext(read('site/engines/dvm-source-manager.js'),r);
 const card=()=>r.datasetItems().find(x=>x.type==='ndwVerkeer').meta;
 assert.match(card(),/NDW locaties bevestigd: 0/);assert.match(card(),/Nog te controleren: 2/);
 confirm(r,'EXTENDED');
 assert.match(card(),/NDW locaties bevestigd: 1/);assert.match(card(),/Nog te controleren: 1/);
 assert.match(card(),/1 ruimere koppelingen, waarvan 0 nog te controleren/);
 assert.match(card(),/1 zonder passende meting/);
});

test('adapter en Verkeerskosten tonen dezelfde actuele bevestiging naast berekenbare wegdelen',()=>{
 const r=runtime();r.hubDienstContext=()=>({assets:[],services:[],types:[]});
 r.FORECAST_SUMMARY=null;r.FORECAST_TRIGGERS=[];
 const adapter=read('site/engines/dvm-adapter-original.js');
 const summary=adapter.match(/  summary\(\)\{([\s\S]*?)\n  assets\(\)/)[1].replace(/\},\s*$/,'}');
 vm.runInContext('window.testSummary=function(){'+summary,r);
 const app=read('site/app.js'),render=app.match(/^function renderCosts\(\).*$/m)[0];
 const elements={costVc:{value:''},costKpis:{innerHTML:''},costTable:{innerHTML:''}};
 r.$=selector=>elements[selector.slice(1)];r.money=v=>String(v);r.num=v=>String(v);r.date=()=>'';r.empty=()=>'';
 vm.runInContext(render,r);
 const refresh=()=>{r.summaries={dvm:r.testSummary()};r.renderCosts();};
 refresh();assert.match(elements.costKpis.innerHTML,/NDW locaties bevestigd<strong>0 \/ 2/);
 // Gebruik de echte berichtenhandler: een bevestiging moet de zichtbare teller
 // verversen voordat de bestaande opslag-debounce afloopt.
 const frame={HUB:{summary:()=>r.testSummary()}};
 r.frames={dvm:{contentWindow:frame}};r.view='costs';r.busy=false;r.queues=0;r.queue=()=>r.queues++;
 r.addEventListener=(type,handler)=>{if(type==='message')r.onMessage=handler;};
 vm.runInContext(app.match(/^window.addEventListener\('message'.*$/m)[0],r);
 confirm(r,'EXTENDED');
 r.onMessage({origin:r.location.origin,source:frame,data:r.messages.at(-1)});
 assert.match(elements.costKpis.innerHTML,/NDW locaties bevestigd<strong>1 \/ 2/);
 assert.match(elements.costKpis.innerHTML,/NDW locaties te controleren<strong>1/);
 assert.match(elements.costKpis.innerHTML,/Berekenbare wegdelen<strong>2 \/ 3/);
 assert.match(elements.costTable.innerHTML,/Bevestigd/);
 assert.equal(r.queues,1);
 r.onMessage({origin:'https://untrusted.example',source:frame,data:r.messages.at(-1)});
 assert.equal(r.queues,1,'berichten van een andere herkomst worden geweigerd');
});
