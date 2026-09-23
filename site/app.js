import {GROUPS,ROUTES,resolveRoute} from './ui/routes.js';
import {DEFAULT_STATE,DVM_PARTS,BI_RULE_KEYS,LABELS,validate,makeExport,mergeImport,combine} from './core/model.js';
import {read,write} from './core/storage.js';
import {toonVersies} from './core/versie.js';
import {runQualityAudit,QUALITY_CATEGORIES} from './core/quality-audit.js';
import {applyQuery,operatorsFor} from './core/query-filter.js';
import {installQueryAssistant} from './core/query-assistant.js';
import {buildBiDashContext} from './core/context-api.js';
import {createServiceExpertReview,normalizeServiceExpertReview,expertReviewCompletion,validateServiceExpertReview,upsertServiceExpertReview,modelProposalFromService,expertModelProposal,validateExpertModelProposal} from './core/service-expert-input.js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('nl-NL',{maximumFractionDigits:d}):'Onbekend';
const money=n=>Number.isFinite(n)?n.toLocaleString('nl-NL',{style:'currency',currency:'EUR'}):'Onbekend';
const date=s=>s?new Date(s).toLocaleDateString('nl-NL'):'geen bron geladen';
let state=DEFAULT_STATE(),summaries={},busy=false,failedImport=false,timer,view='overview';const frames={},ready={};
const engineVersies={};
function status(s,error=false){$('#status').textContent=s;$('#status').classList.toggle('error',error);}
let routeTicket=0,assetPage=0;const pageSize=60;
const ASSET_QUERY_FIELDS=[
 {key:'naam',label:'Assetnaam'},{key:'key',label:'Asset-ID'},{key:'tp',label:'Assettype'},{key:'source',label:'Bron'},
 {key:'vc',label:'Verkeerscentrale'},{key:'weg',label:'Locatie of weg'},{key:'status',label:'Status'},
 {key:'contract',label:'Contract'},{key:'aannemer',label:'Aannemer'},{key:'leverancier',label:'Leverancier'},
 {key:'openFaults',label:'Aantal open storingen',type:'number'},{key:'assetFaultCodes',label:'Asset heeft foutcode'}
];
const FAULT_QUERY_FIELDS=[
 {key:'naam',label:'Asset of melding'},{key:'assetKey',label:'Asset-ID'},{key:'typeId',label:'Assettype'},
 {key:'code',label:'Foutcode van deze melding'},{key:'assetFaultCodes',label:'Asset heeft foutcode'},
 {key:'weg',label:'Weg'},{key:'richting',label:'Richting'},{key:'hm',label:'Hectometer',type:'number'},
 {key:'vc',label:'Verkeerscentrale'},{key:'rd',label:'Beheerder'},{key:'operationeleStatus',label:'Operationele status'},
 {key:'impact',label:'Impactpercentage',type:'number'},{key:'duurUren',label:'Duur in uren',type:'number'},
 {key:'rekenStatus',label:'Rekenstatus'},{key:'omschrijving',label:'Omschrijving'}
];
const queries={assets:{rules:[]},faults:{rules:[]}};
document.__bidashQueries=queries;
const DEFAULT_SERVICES=[{id:'im',naam:'Incidentmanagement'},{id:'vm',naam:'Verkeersmanagement'},{id:'rri',naam:'Reis- en route-informatie'},{id:'wiu',naam:'Werk in uitvoering'}];
let expertServiceId='',expertDraft=null,expertMessage='';const expertDrafts=new Map();
const EXPERT_DEPENDENCIES=[['signalering','Signalering'],['camera','Camera'],['detectie','Detectie'],['drip','DRIP'],['communicatie','Communicatie'],['dynamische_strook','Dynamische strook'],['wisselbord','Wisselbord']];
async function ensurePlanning(){const p=await engine('planning'),b=await engine('bi');b.attachPlanning(frames.planning);return p;}
async function show(id){
 const route=resolveRoute(id),group=GROUPS.find(g=>g.id===route.group),ticket=++routeTicket;view=route.id;
 if(route.engine!=='planning'&&document.body.classList.contains('planning-fullscreen'))setPlanningFullscreen(false);
 $('#planningFullscreen').hidden=route.id!=='planning';
 window.scrollTo(0,0);if(location.hash!=='#'+route.id)history.replaceState(null,'','#'+route.id);
 $('#pageTitle').textContent=route.label;$('#pageDescription').textContent=group.desc;$('#breadcrumb').textContent=group.label+' / '+route.label;
 $('#primaryNav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.group===group.id));
 $('#secondaryNav').innerHTML=group.items.map(([key,label])=>`<button data-route="${key}" class="${key===route.id?'active':''}">${esc(label)}</button>`).join('');
 document.querySelectorAll('.view').forEach(el=>el.hidden=route.engine!=='native'||el.id!==route.target);
 document.querySelectorAll('.engine').forEach(el=>el.hidden=true);
 try{
  if(route.engine==='planning'){const p=await ensurePlanning();if(ticket!==routeTicket)return;$('#engine-planning').hidden=false;p.open(route.target);}
  else if(route.engine==='dvm'||route.engine==='bi'){const e=await engine(route.engine);if(ticket!==routeTicket)return;$('#engine-'+route.engine).hidden=false;e.open(route.target);}
  else if(['assets','faults','costs'].includes(route.id)){await engine('dvm');if(route.id==='assets'&&state.bi)await engine('bi');}
  else if(route.id==='organisation')await engine('bi');
  if(ticket!==routeTicket)return;
  for(const name of ['dvm','bi'])if(ready[name])summaries[name]=(await engine(name)).summary();
  render();
 }catch(e){fail(e);}
}
function fail(e){status(e.message||String(e),true);console.error(e);}
async function engine(name){
 if(ready[name])return ready[name];
 ready[name]=new Promise((resolve,reject)=>{const f=document.createElement('iframe');frames[name]=f;f.title=name==='dvm'?'Asset- en dienstanalyse':name==='planning'?'Integrale planning':'Organisatieanalyse';f.sandbox='allow-scripts allow-same-origin allow-downloads allow-modals allow-popups';f.src='engines/'+name+'.html'+(name==='planning'?'?v=planning23':'');const timeout=setTimeout(()=>reject(Error('Module '+name+' reageert niet.')),30000);f.onload=()=>{if(f.contentWindow.HUB){clearTimeout(timeout);resolve(f.contentWindow.HUB);}else{clearTimeout(timeout);reject(Error('Module '+name+' is niet volledig geladen.'));}};$('#engine-'+name).append(f);});
 return ready[name];
}
async function restore(next){
 if(next.bi){const b=await engine('bi');b.import(next.bi);}
 if(next.planning){await ensurePlanning();const b=await engine('bi');await b.importPlanning(next.planning);}
 if(next.dvm?.assetregister?.rijen?.length){const d=await engine('dvm');await d.import(next.dvm);}
}
async function capture(){
 if(failedImport)throw Error("Herlaad eerst de pagina om de vorige opgeslagen werkruimte te herstellen.");
 for(const name of Object.keys(ready)){if(name==='planning')continue;const e=await engine(name);if(name==='dvm'){const b=e.export();if(b.assetregister)state.dvm=b;}else{state.bi=e.export();const p=e.planning();if(p)state.planning=p;}summaries[name]=e.summary();}
}
async function exportSnapshot(){
 await capture();
 const snapshot={...state};
 if(ready.dvm){const d=await engine('dvm');const full=d.export({fullSources:true});if(full.assetregister)snapshot.dvm=full;}
 return snapshot;
}
async function sync(){if(busy||failedImport)return;busy=true;status('Lokale gegevens en uitkomsten bijwerken…');try{await capture();await write(state);render();status('Lokaal opgeslagen · '+new Date().toLocaleTimeString('nl-NL'));}catch(e){fail(e);}finally{busy=false;}}
function queue(){clearTimeout(timer);timer=setTimeout(sync,1800);}
window.addEventListener('message',ev=>{if(ev.origin!==location.origin||!Object.values(frames).some(f=>f.contentWindow===ev.source))return;if(ev.data?.type==='hub:planning-loaded'&&ev.source===frames.planning?.contentWindow){frames.bi?.contentWindow?.HUB?.syncPlanningRules();queue();}if(ev.data?.type==='hub:planning-fullscreen'&&ev.source===frames.planning?.contentWindow)setPlanningFullscreen(ev.data.active);if(ev.data?.type==='hub:version'&&ev.data.engine){engineVersies[ev.data.engine]=String(ev.data.versie??'');toonVersies(document,engineVersies);}if(ev.data?.type==='hub:changed'&&!busy)queue();});

function expertServices(){
 const map=new Map(DEFAULT_SERVICES.map(service=>[service.id,{...service}]));
 for(const service of summaries.dvm?.diensten||[])if(service?.id)map.set(String(service.id),{id:String(service.id),naam:String(service.naam||service.id)});
 for(const review of state.expertReviews||[])if(review?.dienstId&&!map.has(String(review.dienstId)))map.set(String(review.dienstId),{id:String(review.dienstId),naam:String(review.dienstNaam||review.dienstId)});
 return [...map.values()];
}
function expertService(id=expertServiceId){return expertServices().find(service=>service.id===String(id))||expertServices()[0]||{id:'',naam:'Onbekende dienstverlening'};}
function expertStored(id){return (state.expertReviews||[]).find(review=>String(review.dienstId)===String(id));}
function expertStatusLabel(status){return {concept:'Concept',ter_beoordeling:'Ter beoordeling',vastgesteld:'Vastgesteld'}[status]||'Concept';}
function expertField(label,name,value,help='',type='textarea'){
 const control=type==='input'?`<input name="${name}" value="${esc(value)}">`:type==='number'?`<input name="${name}" type="number" min="0" max="100" step="0.01" value="${esc(value)}">`:type==='date'?`<input name="${name}" type="date" value="${esc(value)}">`:`<textarea name="${name}" rows="3">${esc(value)}</textarea>`;
 return `<label class="expert-field"><span>${esc(label)}</span>${help?`<small>${esc(help)}</small>`:''}${control}</label>`;
}
function expertSelect(label,name,value,options,help=''){
 return `<label class="expert-field"><span>${esc(label)}</span>${help?`<small>${esc(help)}</small>`:''}<select name="${name}">${options.map(([key,text])=>`<option value="${esc(key)}" ${String(value)===String(key)?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
}
function expertRelationRows(review){
 if(!review.relaties.length)return '<p class="muted">Nog geen aanvullende relatie vastgelegd.</p>';
 return review.relaties.map((row,index)=>`<div class="expert-repeat-row" data-expert-relation data-row-id="${esc(row.id)}"><div class="expert-repeat-head"><b>Relatie ${index+1}</b><button type="button" data-expert-remove="relatie" data-index="${index}">Verwijderen</button></div><div class="expert-grid">${expertField('Van welk proces, asset, systeem of rol?','relation-bron',row.bron,'Gebruik een herkenbare naam.','input')}${expertSelect('Relatietype','relation-relatie',row.relatie,[['','Kies relatie'],['onderdeel_van','Is onderdeel van'],['afhankelijk_van','Is afhankelijk van'],['levert_aan','Levert informatie aan'],['uitgevoerd_door','Wordt uitgevoerd door'],['getriggerd_door','Wordt getriggerd door'],['beinvloedt','Beïnvloedt'],['compenseert','Compenseert'],['escaleert_naar','Escaleert naar'],['anders','Anders']])}${expertField('Naar welk proces, asset, systeem of rol?','relation-doel',row.doel,'Dit mag ook buiten BiDash liggen.','input')}${expertSelect('Kritiek voor de dienst','relation-kritiek',row.kritiek,[['','Kies belang'],['laag','Laag'],['middel','Middel'],['hoog','Hoog'],['essentieel','Essentieel']])}</div>${expertField('Waarom bestaat deze relatie en wanneer is zij relevant?','relation-duiding',row.duiding)}${expertField('Waarop baseer je dit?','relation-bewijs',row.bewijs,'Procesbeschrijving, werkinstructie, incident, meting of expertkennis.')}</div>`).join('');
}
function expertRuleRows(review){
 if(!review.regelVoorstellen.length)return '<p class="muted">Nog geen regelvoorstel vastgelegd.</p>';
 return review.regelVoorstellen.map((row,index)=>`<div class="expert-repeat-row" data-expert-rule data-row-id="${esc(row.id)}"><div class="expert-repeat-head"><b>Regelvoorstel ${index+1}</b><button type="button" data-expert-remove="regel" data-index="${index}">Verwijderen</button></div><div class="expert-grid">${expertField('ALS, welke waarneembare conditie?','rule-als',row.als,'Gebruik een bronveld, gebeurtenis of meetbare toestand.')}${expertField('DAN, welk gevolg voor de dienstverlening?','rule-dan',row.dan,'Beschrijf het effect, niet alleen de technische fout.')}${expertField('Maatstaf of grenswaarde','rule-maatstaf',row.maatstaf,'Eenheid, tijdvenster en grens horen erbij.','input')}${expertField('Gewicht of ernst','rule-gewicht',row.gewicht,'Leg uit waarom deze waarde past.','input')}</div>${expertField('Uitzonderingen en combinaties','rule-uitzondering',row.uitzondering,'Wanneer geldt de regel niet, of alleen samen met een andere toestand?')}${expertField('Inhoudelijk eigenaar','rule-eigenaar',row.eigenaar,'Wie mag deze regel vaststellen?','input')}${expertField('Onderbouwing','rule-bewijs',row.bewijs,'Norm, rapport, analyse, casus of expertinschatting.')}</div>`).join('');
}
function expertSignalRows(review){
 if(!review.signaalVoorstellen.length)return '<p class="muted">Nog geen signaalvoorstel vastgelegd.</p>';
 return review.signaalVoorstellen.map((row,index)=>`<div class="expert-repeat-row" data-expert-signal data-row-id="${esc(row.id)}"><div class="expert-repeat-head"><b>Signaalvoorstel ${index+1}</b><button type="button" data-expert-remove="signaal" data-index="${index}">Verwijderen</button></div><div class="expert-grid">${expertField('Wanneer moet een signaal ontstaan?','signal-voorwaarde',row.voorwaarde,'Noem grens, duur, combinatie en scope.')}${expertSelect('Ernst','signal-ernst',row.ernst,[['','Kies ernst'],['informatie','Informatie'],['waarschuwing','Waarschuwing'],['kritiek','Kritiek']])}${expertField('Welke actie moet volgen?','signal-actie',row.actie,'Maak de actie uitvoerbaar en controleerbaar.')}${expertField('Actiehouder','signal-eigenaar',row.eigenaar,'Rol of organisatieonderdeel.','input')}${expertField('Reactietijd','signal-responstijd',row.responstijd,'Bijvoorbeeld direct, 30 minuten of volgende werkdag.','input')}${expertField('Wanneer en naar wie escaleren?','signal-escalatie',row.escalatie)}</div></div>`).join('');
}
function expertCurrentService(){return (summaries.dvm?.diensten||[]).find(item=>String(item.id)===String(expertServiceId));}
function expertModelRows(review){
 const rows=review.modelWijziging?.subprocessen||[];
 if(!rows.length)return '<p class="muted">Nog geen modelvoorstel. Kies Neem huidige model over of voeg een subproces toe.</p>';
 return rows.map((row,index)=>`<div class="expert-repeat-row expert-model-row" data-expert-subprocess data-row-id="${esc(row.id)}"><div class="expert-repeat-head"><b>Subproces ${index+1}</b><button type="button" data-expert-remove="subprocess" data-index="${index}">Verwijderen</button></div><div class="expert-grid">${expertField('Naam subproces','subprocess-naam',row.naam,'Gebruik een herkenbare procesnaam.','input')}${expertField('Aandeel in dienstverlening, procent','subprocess-aandeel',row.aandeel,'Alle subprocessen samen moeten 100 procent zijn.','number')}</div><div class="expert-dependency-grid">${EXPERT_DEPENDENCIES.map(([key,label])=>expertField(`${label}, procent`,`subprocess-afh-${key}`,row.afhankelijkheden?.[key]||'','Afhankelijkheden per subproces moeten samen 100 procent zijn.','number')).join('')}</div>${expertField('Onderbouwing','subprocess-onderbouwing',row.onderbouwing,'Waarom hoort dit subproces in de keten en waarom passen deze gewichten?')}</div>`).join('');
}
function expertModelResult(review){
 const test=review.modelWijziging?.test,toepassing=review.modelWijziging?.toepassing;
 const toegepast=toepassing?.status==='toegepast',teruggezet=toepassing?.status==='teruggezet';
 const resultaat=toegepast?toepassing.resultaat:(test||toepassing?.resultaat);if(!resultaat)return '';
 const voor=resultaat.voor,na=resultaat.na;
 const waarde=(row,key)=>Number.isFinite(Number(row?.[key]))?`${num(Number(row[key]),3)}%`:'Geen berekening';
 const titel=toegepast?'Toegepast model':teruggezet?'Vorige model teruggezet':'Laatste proefberekening';
 const toelichting=resultaat.getestOp?`Getest ${date(resultaat.getestOp)}. De actieve basiswaarden zijn na de test automatisch hersteld.`:teruggezet?`Teruggezet ${date(resultaat.teruggezetOp)}.`:`Toegepast ${date(resultaat.toegepastOp)}.`;
 return `<div class="expert-model-result"><b>${titel}</b><div class="expert-current-kpis"><div><small>Beschikbaarheid voor</small><b>${waarde(voor,'besch')}</b></div><div><small>Beschikbaarheid na</small><b>${waarde(na,'besch')}</b></div><div><small>Norm na</small><b>${waarde(na,'norm')}</b></div></div><p>${toelichting}</p></div>`;
}
function expertModelSection(review,current){
 return `<section data-expert-model-section><div class="expert-repeat-title"><div><h2>7. Basiswaarden en subprocessen</h2><p>Test een aangepaste norm en procesketen eerst op de geladen DVM-data. Een proefberekening herstelt daarna automatisch het actieve model.</p></div><div class="expert-model-buttons"><button type="button" data-expert-use-model>Neem huidige model over</button><button type="button" data-expert-add="subprocess">Subproces toevoegen</button></div></div><div class="expert-grid">${expertField('Voorgestelde dienstnorm, procent','modelNorm',review.modelWijziging?.norm||current?.norm||'','Deze norm wordt pas actief na Vaststellen en Toepassen.','number')}</div>${expertModelRows(review)}${expertModelResult(review)}<div class="expert-model-actions"><button type="button" class="primary" data-expert-test-model>Proefberekening uitvoeren</button><button type="button" data-expert-apply-model>Vastgesteld model toepassen</button>${review.modelWijziging?.toepassing?.rollback?'<button type="button" data-expert-undo-model>Vorige model terugzetten</button>':''}</div></section>`;
}
function gebruikHuidigExpertModel(review,current=expertCurrentService()){
 if(!current)return review;
 const voorstel=modelProposalFromService(current);review.modelWijziging.norm=voorstel.norm;review.modelWijziging.subprocessen=voorstel.subprocessen;review.modelWijziging.test=null;return review;
}
function expertChainHtml(service){
 const current=(summaries.dvm?.diensten||[]).find(item=>String(item.id)===String(service.id));
 if(!current)return '<div class="expert-current-empty"><b>Nog geen actuele DVM-keten beschikbaar.</b><span>Je kunt de vragen wel invullen. Laad DVM-bronnen om de bestaande norm, subprocessen en assetafhankelijkheden ernaast te tonen.</span></div>';
 const rows=(current.subprocessen||[]).map(sp=>`<tr><td><b>${esc(sp.naam)}</b></td><td>${num(Number(sp.aandeelDienst||0)*100,1)}%</td><td>${(sp.bronnen||[]).map(bron=>`${esc(bron.obj||bron.typeId)} ${num(Number(bron.gewicht||0)*100,0)}%`).join('<br>')||'Geen bronkoppeling'}</td></tr>`).join('');
 return `<div class="expert-current"><div class="expert-current-kpis"><div><small>Huidige norm</small><b>${num(current.norm,2)}%</b></div><div><small>Huidige uitkomst</small><b>${current.besch==null?`${num(current.lo,2)}–${num(current.hi,2)}%`:num(current.besch,2)+'%'}</b></div><div><small>Subprocessen</small><b>${(current.subprocessen||[]).length}</b></div></div><div class="table-scroll"><table><thead><tr><th>Bestaand subproces</th><th>Aandeel dienst</th><th>Huidige afhankelijkheden</th></tr></thead><tbody>${rows}</tbody></table></div><button type="button" data-expert-use-chain>Gebruik deze keten als startpunt</button></div>`;
}
function collectExpertForm(form){
 const service=expertService(),data=new FormData(form),get=name=>String(data.get(name)||'').trim();
 const previous=expertDraft?.dienstId===service.id?expertDraft:expertDrafts.get(service.id)||expertStored(service.id);
 const review={dienstId:service.id,dienstNaam:service.naam,status:get('status'),
  expert:{naam:get('expertNaam'),rol:get('expertRol'),organisatie:get('expertOrganisatie')},
  context:{doel:get('contextDoel'),resultaat:get('contextResultaat'),gebruikers:get('contextGebruikers'),scope:get('contextScope'),buitenScope:get('contextBuitenScope')},
  proces:{start:get('procesStart'),stappen:get('procesStappen'),beslismomenten:get('procesBeslismomenten'),overdrachten:get('procesOverdrachten'),einde:get('procesEinde')},
  afhankelijkheden:{assets:get('afhankelijkhedenAssets'),informatie:get('afhankelijkhedenInformatie'),functies:get('afhankelijkhedenFuncties'),extern:get('afhankelijkhedenExtern'),bovenstrooms:get('afhankelijkhedenBovenstrooms'),benedenstrooms:get('afhankelijkhedenBenedenstrooms')},
  impact:{faalwijzen:get('impactFaalwijzen'),veiligheid:get('impactVeiligheid'),informatie:get('impactInformatie'),alternatief:get('impactAlternatief'),herstel:get('impactHerstel'),escalatie:get('impactEscalatie')},
  meting:{normDuiding:get('metingNormDuiding'),meetwijze:get('metingMeetwijze'),meetvenster:get('metingMeetvenster'),bron:get('metingBron'),onzekerheid:get('metingOnzekerheid')},
  validatie:{bewijs:get('validatieBewijs'),aannames:get('validatieAannames'),openVragen:get('validatieOpenVragen'),vertrouwen:get('validatieVertrouwen'),akkoordNaam:get('validatieAkkoordNaam'),akkoordDatum:get('validatieAkkoordDatum')},
  modelWijziging:{norm:get('modelNorm'),subprocessen:[...form.querySelectorAll('[data-expert-subprocess]')].map(row=>({
   id:row.dataset.rowId,naam:row.querySelector('[name="subprocess-naam"]').value,aandeel:row.querySelector('[name="subprocess-aandeel"]').value,
   afhankelijkheden:Object.fromEntries(EXPERT_DEPENDENCIES.map(([key])=>[key,row.querySelector(`[name="subprocess-afh-${key}"]`).value]).filter(([,value])=>String(value).trim()!=='')),
   onderbouwing:row.querySelector('[name="subprocess-onderbouwing"]').value
  })),test:previous?.modelWijziging?.test||null,toepassing:previous?.modelWijziging?.toepassing||null},
  relaties:[...form.querySelectorAll('[data-expert-relation]')].map(row=>({id:row.dataset.rowId,bron:row.querySelector('[name="relation-bron"]').value,relatie:row.querySelector('[name="relation-relatie"]').value,doel:row.querySelector('[name="relation-doel"]').value,kritiek:row.querySelector('[name="relation-kritiek"]').value,duiding:row.querySelector('[name="relation-duiding"]').value,bewijs:row.querySelector('[name="relation-bewijs"]').value})),
  regelVoorstellen:[...form.querySelectorAll('[data-expert-rule]')].map(row=>({id:row.dataset.rowId,als:row.querySelector('[name="rule-als"]').value,dan:row.querySelector('[name="rule-dan"]').value,maatstaf:row.querySelector('[name="rule-maatstaf"]').value,gewicht:row.querySelector('[name="rule-gewicht"]').value,uitzondering:row.querySelector('[name="rule-uitzondering"]').value,eigenaar:row.querySelector('[name="rule-eigenaar"]').value,bewijs:row.querySelector('[name="rule-bewijs"]').value})),
  signaalVoorstellen:[...form.querySelectorAll('[data-expert-signal]')].map(row=>({id:row.dataset.rowId,voorwaarde:row.querySelector('[name="signal-voorwaarde"]').value,ernst:row.querySelector('[name="signal-ernst"]').value,actie:row.querySelector('[name="signal-actie"]').value,eigenaar:row.querySelector('[name="signal-eigenaar"]').value,responstijd:row.querySelector('[name="signal-responstijd"]').value,escalatie:row.querySelector('[name="signal-escalatie"]').value})),
  bijgewerktOp:new Date().toISOString()};
 return normalizeServiceExpertReview(review,service);
}
function renderExpertReviewList(){
 const host=$('#expertReviewList');if(!host)return;
 host.innerHTML=`<div class="expert-review-grid">${expertServices().map(service=>{const review=expertStored(service.id),progress=review?expertReviewCompletion(review):{percentage:0};return `<article class="expert-review-card"><div><span class="pill">${esc(review?expertStatusLabel(review.status):'Nog niet gestart')}</span><h3>${esc(service.naam)}</h3><p>${review?`${progress.percentage}% van de kernvragen ingevuld · bijgewerkt ${date(review.bijgewerktOp)}`:'Leg proceskennis, afhankelijkheden en voorstellen vast.'}</p></div><button type="button" data-expert-service="${esc(service.id)}">${review?'Verder invullen':'Start expertinvoer'}</button></article>`;}).join('')}</div>`;
}
function renderExpertInput(){
 const host=$('#expertInputHost');if(!host)return;const services=expertServices();
 const activeForm=$('#expertReviewForm');if(activeForm){const activeDraft=collectExpertForm(activeForm);expertDraft=activeDraft;expertDrafts.set(activeDraft.dienstId,activeDraft);}
 if(!expertServiceId||!services.some(service=>service.id===expertServiceId))expertServiceId=services[0]?.id||'';
 const service=expertService(),stored=expertStored(service.id),cached=expertDrafts.get(service.id),review=expertDraft&&expertDraft.dienstId===service.id?expertDraft:cached||normalizeServiceExpertReview(stored||createServiceExpertReview(service),service),progress=expertReviewCompletion(review),current=expertCurrentService();
 expertDraft=review;
 const missing=progress.ontbrekend.length?`Nog nodig: ${progress.ontbrekend.slice(0,4).join(', ')}${progress.ontbrekend.length>4?' en meer.':'.'}`:'Alle kernvragen zijn ingevuld.';
 host.innerHTML=`<section class="expert-intro"><div><p class="eyebrow">EXPERTVALIDATIE DIENSTVERLENING</p><h2>${esc(service.naam)}</h2><p>Leg vast hoe het proces echt werkt, welke relaties BiDash nog mist en welke regels en signalen inhoudelijk verdedigbaar zijn. Opslaan verandert de rekenregels niet automatisch.</p></div><label>Dienstverlening<select id="expertServiceSelect">${services.map(item=>`<option value="${esc(item.id)}" ${item.id===service.id?'selected':''}>${esc(item.naam)}</option>`).join('')}</select></label></section><section class="expert-progress"><div><b>${progress.percentage}% compleet</b><span>${progress.ingevuld} van ${progress.totaal} kernvragen</span></div><progress max="100" value="${progress.percentage}"></progress><p>${esc(missing)}</p></section>${expertMessage?`<div class="expert-message">${esc(expertMessage)}</div>`:''}<section><h2>Wat BiDash nu gebruikt</h2><p>Controleer deze keten. Noteer afwijkingen als relatie of regelvoorstel, zodat bestaande aannames en expertkennis uit elkaar blijven.</p>${expertChainHtml(service)}</section><form id="expertReviewForm" class="expert-form"><section><div class="section-heading"><div><h2>1. Expert en status</h2><p>Wie geeft de duiding en vanuit welke verantwoordelijkheid?</p></div>${expertSelect('Status','status',review.status,[['concept','Concept'],['ter_beoordeling','Ter beoordeling'],['vastgesteld','Vastgesteld']])}</div><div class="expert-grid">${expertField('Naam expert','expertNaam',review.expert.naam,'Wie kan deze duiding toelichten?','input')}${expertField('Rol en verantwoordelijkheid','expertRol',review.expert.rol,'Bijvoorbeeld landelijk adviseur incidentmanagement.','input')}${expertField('Organisatieonderdeel','expertOrganisatie',review.expert.organisatie,'Team, afdeling of ketenpartner.','input')}</div></section><section><h2>2. Doel en afbakening</h2><p>Deze vragen voorkomen dat een technische beschikbaarheid onterecht gelijk wordt gesteld aan een geleverde dienst.</p><div class="expert-grid">${expertField('Wat is het doel van deze dienstverlening?','contextDoel',review.context.doel,'Beschrijf de publieke of operationele functie.')}${expertField('Welk resultaat moet de weggebruiker en operatie merken?','contextResultaat',review.context.resultaat,'Formuleer een waarneembare uitkomst.')}${expertField('Voor wie wordt de dienst geleverd?','contextGebruikers',review.context.gebruikers,'Weggebruiker, verkeersleider, hulpdienst, aannemer of andere partij.')}${expertField('Wat valt binnen de scope?','contextScope',review.context.scope,'Gebied, tijd, situaties en verantwoordelijkheden.')}${expertField('Wat valt nadrukkelijk buiten de scope?','contextBuitenScope',review.context.buitenScope,'Voorkom dubbeltelling met andere diensten.')}</div></section><section><h2>3. Procesverloop</h2><p>Beschrijf het proces van start tot aantoonbare afronding. Benoem overdrachten en beslismomenten.</p><div class="expert-grid">${expertField('Welke gebeurtenis start het proces?','procesStart',review.proces.start,'Een melding, waarneming, planning of besluit.')}${expertField('Welke stappen worden in welke volgorde uitgevoerd?','procesStappen',review.proces.stappen,'Nummer de stappen en benoem handmatige en geautomatiseerde acties.')}${expertField('Welke beslismomenten veranderen het vervolg?','procesBeslismomenten',review.proces.beslismomenten,'Noem criteria en beslissingsbevoegdheid.')}${expertField('Waar vinden overdrachten plaats?','procesOverdrachten',review.proces.overdrachten,'Tussen rollen, systemen, organisaties of diensten.')}${expertField('Wanneer is het proces aantoonbaar afgerond?','procesEinde',review.proces.einde,'Benoem eindstatus en registratie.')}</div></section><section><h2>4. Afhankelijkheden en ontbrekende context</h2><p>Vul ook relaties in die nog niet in BiDash staan. Scheid een noodzakelijke afhankelijkheid van een handige informatiebron.</p><div class="expert-grid">${expertField('Welke assets en systemen zijn nodig?','afhankelijkhedenAssets',review.afhankelijkheden.assets,'Noem functie, niet alleen productnaam.')}${expertField('Welke informatie moet beschikbaar en betrouwbaar zijn?','afhankelijkhedenInformatie',review.afhankelijkheden.informatie,'Bron, actualiteit, kwaliteit en eigenaar.')}${expertField('Welke rollen en capaciteit zijn nodig?','afhankelijkhedenFuncties',review.afhankelijkheden.functies,'Wie voert uit, beslist en controleert?')}${expertField('Welke externe partijen of afspraken zijn nodig?','afhankelijkhedenExtern',review.afhankelijkheden.extern,'Ketenpartners, contracten, wetgeving en convenanten.')}${expertField('Welke processen leveren invoer aan?','afhankelijkhedenBovenstrooms',review.afhankelijkheden.bovenstrooms,'Wat moet eerder goed gaan?')}${expertField('Welke processen gebruiken de uitkomst?','afhankelijkhedenBenedenstrooms',review.afhankelijkheden.benedenstrooms,'Wat wordt later geraakt?')}</div><div class="expert-repeat-title"><h3>Nieuwe relaties</h3><button type="button" data-expert-add="relatie">Relatie toevoegen</button></div>${expertRelationRows(review)}</section><section><h2>5. Uitval, gevolg en herstel</h2><p>Beschrijf gevolgen per proces, niet alleen per asset. Benoem compensatie en het punt waarop opschaling nodig is.</p><div class="expert-grid">${expertField('Wat zijn de belangrijkste faalwijzen?','impactFaalwijzen',review.impact.faalwijzen,'Wat kan in proces, mens, informatie of techniek misgaan?')}${expertField('Wat is het gevolg voor veiligheid en doorstroming?','impactVeiligheid',review.impact.veiligheid,'Maak verschil tussen vertraagd, beperkt en onmogelijk.')}${expertField('Wat is het gevolg voor informatie en besluitvorming?','impactInformatie',review.impact.informatie,'Wanneer wordt het beeld onvolledig of onbetrouwbaar?')}${expertField('Welke alternatieve werkwijze of compensatie bestaat?','impactAlternatief',review.impact.alternatief,'Vermeld capaciteit, duur en beperkingen.')}${expertField('Wat is nodig voor herstel en normalisatie?','impactHerstel',review.impact.herstel,'Technisch herstel, procesherstel en controle.')}${expertField('Wanneer is escalatie nodig?','impactEscalatie',review.impact.escalatie,'Grens, termijn, verantwoordelijke en ontvanger.')}</div></section><section><h2>6. Prestatie en bewijs</h2><p>Een norm is alleen bruikbaar met een meetwijze, periode, bron en bekende onzekerheid.</p><div class="expert-grid">${expertField('Hoe duid je de huidige dienstnorm?','metingNormDuiding',review.meting.normDuiding,'Wat betekent de norm inhoudelijk en wanneer geldt zij?')}${expertField('Hoe meet je of de dienst wordt geleverd?','metingMeetwijze',review.meting.meetwijze,'Teller, noemer, eenheid en aggregatie.')}${expertField('Over welk tijdvenster en gebied?','metingMeetvenster',review.meting.meetvenster,'Moment, dag, maand, traject, regio of landelijk.')}${expertField('Welke bron bewijst de prestatie?','metingBron',review.meting.bron,'Bronhouder, actualiteit en kwaliteitscontrole.')}${expertField('Welke onzekerheid of ontbrekende dekking blijft bestaan?','metingOnzekerheid',review.meting.onzekerheid,'Wanneer mag geen exact percentage worden getoond?')}</div></section><section><div class="expert-repeat-title"><div><h2>7. Regelvoorstellen</h2><p>Formuleer toetsbare ALS-DAN-regels. Deze voorstellen worden pas na inhoudelijke en technische beoordeling echte rekenregels.</p></div><button type="button" data-expert-add="regel">Regel toevoegen</button></div>${expertRuleRows(review)}</section><section><div class="expert-repeat-title"><div><h2>8. Signaalvoorstellen</h2><p>Een signaal bevat een waarneembare conditie, ernst, actiehouder, actie en reactietijd.</p></div><button type="button" data-expert-add="signaal">Signaal toevoegen</button></div>${expertSignalRows(review)}</section><section><h2>9. Onderbouwing en akkoord</h2><p>Leg aannames en open vragen vast. Vastgesteld vereist een akkoordgever en datum.</p><div class="expert-grid">${expertField('Welke bronnen en praktijkgevallen ondersteunen deze duiding?','validatieBewijs',review.validatie.bewijs,'Documenten, registraties, oefeningen, incidenten of analyses.')}${expertField('Welke aannames zijn gebruikt?','validatieAannames',review.validatie.aannames,'Maak tijdelijke aannames expliciet.')}${expertField('Welke vragen moeten nog worden beantwoord?','validatieOpenVragen',review.validatie.openVragen,'Noem eigenaar en benodigde informatie.')}${expertSelect('Vertrouwen in de duiding','validatieVertrouwen',review.validatie.vertrouwen,[['','Kies niveau'],['1','1, laag'],['2','2'],['3','3, redelijk'],['4','4'],['5','5, hoog']],'Baseer dit op bewijs en overeenstemming, niet op gevoel.')}${expertField('Akkoordgever','validatieAkkoordNaam',review.validatie.akkoordNaam,'Vereist bij status Vastgesteld.','input')}${expertField('Akkoorddatum','validatieAkkoordDatum',review.validatie.akkoordDatum,'Vereist bij status Vastgesteld.','date')}</div></section><div id="expertFormMessage" class="expert-form-message" aria-live="polite"></div><div class="expert-actions"><button type="submit" class="primary">Expertinvoer opslaan</button><button type="button" data-expert-export>Download deze duiding</button><button type="button" data-route="impactRules">Open DVM-impactregels</button><button type="button" data-route="businessRules">Open organisatieregels</button></div></form>`;
 const form=host.querySelector('#expertReviewForm'),rules=form?[...form.querySelectorAll('section')].find(section=>section.querySelector('h2')?.textContent.startsWith('7. Regelvoorstellen')):null;
 if(form&&rules){rules.insertAdjacentHTML('beforebegin',expertModelSection(review,current));rules.querySelector('h2').textContent='8. Regelvoorstellen';const signal=rules.nextElementSibling,approval=signal?.nextElementSibling;if(signal?.querySelector('h2'))signal.querySelector('h2').textContent='9. Signaalvoorstellen';if(approval?.querySelector('h2'))approval.querySelector('h2').textContent='10. Onderbouwing en akkoord';}
}
function render(){
 const d=summaries.dvm,b=summaries.bi,roads=d?.roads||[],known=roads.filter(r=>Number.isFinite(r.kosten)),total=known.reduce((s,r)=>s+r.kosten,0),fte=b?.functies||[];
 $('#cards').innerHTML=[['DVM-brondag',date(d?.peildatum),'Open storingen uit de laatste geladen bron'],['Verkeerskosten / brondag',known.length?money(total):'Onbekend',`${known.length} van ${roads.length} wegdelen berekenbaar${known.length<roads.length?' · bekend subtotaal':''}; som scenario’s, controleer overlap`],['Beschikbare formatie',fte.length?num(fte.reduce((s,f)=>s+f.actueel,0))+' FTE':'Onbekend','BI-brondatum: '+date(b?.peildatum)],['Planning',b?.planning?num(b.planning.regels,0)+' activiteiten':'Nog niet geladen',b?.planning?.naam||'Laad je bestaande XML']].map(c=>`<div class="card">${esc(c[0])}<strong>${esc(c[1])}</strong><small>${esc(c[2])}</small></div>`).join('');
 $('#services').innerHTML=d?.liveBronnen?`<table><thead><tr><th>Dienst</th><th>Beschikbaarheid</th><th>Norm</th></tr></thead><tbody>${d.diensten.map(s=>`<tr><td>${esc(s.naam)}</td><td>${s.besch==null?num(s.lo)+'–'+num(s.hi):num(s.besch,2)}%${s.besch==null?' (onvolledige dekking)':''}</td><td>${num(s.norm)}%</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Laad een DVM-totaalbestand met open storingen.</p>';
 $('#capacity').innerHTML=fte.length?`<table><thead><tr><th>Bedrijfsfunctie</th><th>Benodigd FTE</th><th>Beschikbaar FTE</th></tr></thead><tbody>${fte.map(f=>`<tr><td>${esc(f.naam)}</td><td>${num(f.benodigd)}</td><td>${num(f.actueel)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Laad je BI-gegevens of vul bedrijfsfuncties en formatie in bij BI Dash.</p>';
 const triggers=combine(d,b,state.links),filter=$('#signalFilter').value;$('#signalCount').textContent='('+triggers.length+')';
 $('#signalsList').innerHTML=triggers.filter(t=>!filter||t.eigenaar===filter).map(t=>`<article class="signal"><small>${esc(t.eigenaar)} · ${esc(t.sev||'signaal')} · ${esc(t.resp||'Verantwoordelijke nog vastleggen')}</small><strong>${esc(t.titel)}</strong><p>${esc(t.msg)}</p><small>Toegepaste regel: ${esc(t.regel)}</small></article>`).join('')||'<p class="muted">Geen signalen voor deze selectie. Controleer of alle benodigde bronnen zijn geladen.</p>';
 $('#linkService').innerHTML='<option value="">Kies dienst</option>'+(d?.diensten||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.naam)}</option>`).join('');
 $('#linkFunction').innerHTML='<option value="">Kies bedrijfsfunctie</option>'+fte.map(f=>`<option value="${esc(f.id)}">${esc(f.naam)}</option>`).join('');
 $('#links').innerHTML=state.links.map((l,i)=>`<p>${esc(d?.diensten.find(x=>x.id===l.dienst)?.naam||l.dienst)} ↔ ${esc(fte.find(f=>f.id===l.functie)?.naam||l.functie)} · ${esc(l.eigenaar)} <button data-remove="${i}">Verwijderen</button></p>`).join('')||'<p class="muted">Nog geen koppelingen. Laad beide domeinen om te kunnen koppelen.</p>';
 renderExpertReviewList();
 if(view==='expertInput')renderExpertInput();
 renderNative();
 renderQualityDashboard();
 $('#inventory').textContent=`Lokaal: DVM ${state.dvm?'geladen':'leeg'} · BI ${state.bi?'geladen':'leeg'} · planning ${state.planning?'geladen':'leeg'} · ${state.links.length} koppelingen · ${(state.expertReviews||[]).length} expertduidingen.`;
}
function download(obj,name,type='application/json'){const blob=new Blob([typeof obj==='string'?obj:JSON.stringify(obj)],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
function qualityDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('nl-NL'):'Onbekend';}
function qualityTone(severity){return {critical:'red',warning:'amber',info:'blue',good:'green'}[severity]||'blue';}
function qualitySeverity(severity){return {critical:'Blokkerend',warning:'Waarschuwing',info:'Informatie',good:'Goed'}[severity]||severity;}
function qualityEvidence(finding){
 const items=Array.isArray(finding.items)?finding.items:[];if(!items.length)return '';
 const rows=items.slice(0,25).map(item=>`<tr><td>${esc(item.id||item.naam||'Onbekend')}</td><td>${esc(item.type||'')}</td><td>${esc(item.code||'')}</td><td>${esc(item.locatie||'')}</td><td>${esc(item.reden||'')}</td></tr>`).join('');
 return `<details class="quality-evidence"><summary>Bekijk ${num(items.length,0)} probleemgeval${items.length===1?'':'len'}</summary><div class="table-scroll"><table><thead><tr><th>ID of naam</th><th>Type</th><th>Code</th><th>Locatie</th><th>Reden</th></tr></thead><tbody>${rows}</tbody></table></div>${items.length>25?`<small>Eerste 25 getoond. Het auditrapport bevat maximaal 100 gevallen.</small>`:''}</details>`;
}
function renderQualityDashboard(){
 const host=$('#qualityDashboard');if(!host)return;const report=state.qualityAudit;
 if(!report){host.innerHTML='<div class="empty"><b>Nog geen kwaliteitsaudit uitgevoerd.</b>Klik op Audit uitvoeren om de huidige werkruimte te controleren.</div>';return;}
 const categories=(report.categories||[]).map(c=>`<article class="quality-category"><div class="quality-score-ring tone-${Number(c.score)<70?'red':Number(c.score)<85?'amber':'green'}"><strong>${num(Number(c.score),0)}</strong><span>/ 100</span></div><div><h3>${esc(c.label||QUALITY_CATEGORIES[c.id]?.label||c.id)}</h3><p>${esc(c.description||'')}</p><small>${num(Number(c.critical),0)} blokkerend · ${num(Number(c.warnings),0)} waarschuwingen</small></div></article>`).join('');
 const priorities=(report.findings||[]).filter(f=>f.severity==='critical'||f.severity==='warning');
 const priorityHtml=priorities.length?priorities.map(f=>`<article class="quality-finding tone-${qualityTone(f.severity)}"><div><span class="quality-tag">${esc(qualitySeverity(f.severity))}</span><strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p>${f.action?`<small><b>Actie.</b> ${esc(f.action)}</small>`:''}${qualityEvidence(f)}${f.title==='Open meldingen niet doorgerekend'?'<button data-quality-open="faultRules">Foutcodes beheren</button>':''}</div><span class="quality-category-name">${esc(QUALITY_CATEGORIES[f.category]?.label||f.category)}</span></article>`).join(''):'<div class="quality-ok"><b>Geen blokkerende fouten of waarschuwingen.</b><span>De vaste controles geven geen directe herstelactie.</span></div>';
 const allRows=(report.findings||[]).map(f=>`<tr><td><span class="quality-dot tone-${qualityTone(f.severity)}"></span>${esc(qualitySeverity(f.severity))}</td><td>${esc(QUALITY_CATEGORIES[f.category]?.label||f.category)}</td><td><b>${esc(f.title)}</b><br><small>${esc(f.detail)}</small></td><td>${esc(f.action||'Geen actie nodig.')}</td></tr>`).join('');
 const history=Array.isArray(state.qualityHistory)?state.qualityHistory:[],max=Math.max(100,...history.map(x=>Number(x.score)||0));
 const trend=history.length>1?`<section><div class="section-heading"><h2>Ontwikkeling</h2><span class="muted">Laatste ${history.length} audits</span></div><div class="quality-trend">${history.map(x=>{const hoogte=Math.max(5,Math.min(100,Math.round(((Number(x.score)||0)/max*100)/5)*5));return `<div class="quality-trend-item" title="${esc(qualityDate(x.generatedAt))}: ${num(x.score,0)}"><span class="quality-trend-bar quality-height-${hoogte} tone-${x.blockers?'red':x.score<85?'amber':'green'}"></span><small>${num(x.score,0)}</small></div>`;}).join('')}</div></section>`:'';
 const blockerCount=Number(report.blockers)||0,warningCount=Number(report.warnings)||0;
 host.innerHTML=`<section class="quality-overall tone-${esc(report.verdict?.tone||'blue')}"><div><span class="quality-tag">Laatste audit · ${esc(qualityDate(report.generatedAt))}</span><h2>${esc(report.verdict?.label||'Audit voltooid')}</h2><p>${blockerCount?`${num(blockerCount,0)} blokkerende bevindingen moeten eerst worden opgelost.`:warningCount?`${num(warningCount,0)} waarschuwingen vragen beoordeling.`:'De vaste controles geven geen directe blokkade.'}</p></div><div class="quality-total"><strong>${num(Number(report.score),0)}</strong><span>/ 100</span></div></section><div class="quality-category-grid">${categories}</div><section><div class="section-heading"><h2>Wat vraagt aandacht?</h2><div><button id="exportQualityAudit">Auditrapport exporteren</button><button data-route="data">Back-up samenstellen</button></div></div>${priorityHtml}</section>${trend}<details><summary>Alle controles bekijken</summary><div class="table-scroll"><table><thead><tr><th>Oordeel</th><th>Onderdeel</th><th>Controle</th><th>Actie</th></tr></thead><tbody>${allRows}</tbody></table></div></details><section class="quality-scope"><h2>Reikwijdte van deze audit</h2><p>${esc(report.method||'')}</p><p><b>Meegenomen.</b> ${num(Number(report.scope?.rawAssets),0)} assetregels, ${num(Number(report.scope?.processedAssets),0)} verwerkte assets, ${num(Number(report.scope?.openSourceRows),0)} actuele bronregels en ${num(Number(report.scope?.openFaults),0)} open meldingen.</p></section>`;
}
async function executeQualityAudit(){
 if(busy)throw Error('Wacht tot de lopende bewerking gereed is.');
 busy=true;const button=$('#runQualityAudit'),runStatus=$('#qualityRunStatus');if(button)button.disabled=true;
 try{
  if(runStatus)runStatus.innerHTML='<b>Audit wordt uitgevoerd.</b><span>Werkruimte vastleggen en rekenketen controleren.</span>';
  status('Kwaliteitsaudit voorbereiden…');await new Promise(requestAnimationFrame);
  if(state.dvm){const d=await engine('dvm');const current=d.summary();if(current?.restoreDeferred){status('DVM-bronnen verwerken voor de kwaliteitsaudit…');summaries.dvm=await d.import(state.dvm);}}
  await capture();
  const report=runQualityAudit({state,summaries,dvmAssets:sourceApi('dvm')?.assets?.()||[],biAssets:sourceApi('bi')?.assets?.()||[],faults:allFaults(),now:Date.now()});
  state.qualityAudit=report;const history=Array.isArray(state.qualityHistory)?state.qualityHistory:[];
  state.qualityHistory=[...history,{generatedAt:report.generatedAt,score:report.score,verdict:report.verdict,blockers:report.blockers,warnings:report.warnings}].slice(-12);
  await write(state);render();if(runStatus)runStatus.innerHTML=`<b>Audit voltooid.</b><span>${esc(report.verdict.label)} · score ${num(report.score,0)} van 100.</span>`;status('Kwaliteitsaudit voltooid en lokaal opgeslagen.');
 }catch(error){if(runStatus)runStatus.innerHTML=`<b>Audit afgebroken.</b><span>${esc(error.message||String(error))}</span>`;throw error;
 }finally{busy=false;if(button)button.disabled=false;}
}
function selection(){return new Set([...document.querySelectorAll('[data-part]:checked')].map(e=>e.dataset.part));}
async function preview(files){
 if(busy)throw Error('Wacht tot de lopende bewerking klaar is.');
 await capture();let proposed=structuredClone(state),labels=[];
 for(const f of files){const text=await f.text();const type=$('#importType').value;
  if(type==='planning'||/\.xml$/i.test(f.name)){const doc=new DOMParser().parseFromString(text,'text/xml');if(doc.querySelector('parsererror'))throw Error('Ongeldige XML: '+f.name);proposed.planning={name:f.name,xml:text,state:null};labels.push('Planning XML: '+f.name);continue;}
  const json=validate(JSON.parse(text));
  if(json.formaat==='DVM-dienstimpact-totaal'||json.formaat==='BiDash-integraal'){proposed=mergeImport(proposed,json);labels.push(f.name+': '+(json.formaat==='DVM-dienstimpact-totaal'?DVM_PARTS.filter(k=>Object.hasOwn(json,k)&&json.exportSelectie?.[k]!==false).map(k=>LABELS[k]).join(', '):Object.keys(json.delen).join(', ')));}
  else if(type==='bi'||(Array.isArray(json.assets)&&Array.isArray(json.functies))){proposed.bi=json;labels.push('BI-model: '+f.name);}
  else throw Error('Onbekend JSON-formaat: '+f.name);
 }
 const host=$('#preview');host.innerHTML='<h3>Deze onderdelen worden vervangen</h3><ul>'+labels.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul><p>Niet meegeleverde onderdelen blijven behouden. Maak bij twijfel eerst een export.</p><button id="applyImport" class="primary">Import uitvoeren</button><button id="cancelImport">Annuleren</button>';
 $('#cancelImport').onclick=()=>host.replaceChildren();
 $('#applyImport').onclick=async()=>{if(busy)return;busy=true;clearTimeout(timer);$('#applyImport').disabled=true;status('Bronnen lokaal verwerken; een groot DVM-register kan even duren…');const previous=state;try{await restore(proposed);state=proposed;expertDrafts.clear();expertDraft=null;expertServiceId='';$('#expertInputHost').replaceChildren();await capture();await write(state);render();host.replaceChildren();status('Import voltooid en lokaal opgeslagen.');}catch(e){state=previous;failedImport=true;fail(Error('Import niet opgeslagen: '+e.message+' Herlaad de pagina om de vorige opgeslagen werkruimte terug te zetten.'));}finally{busy=false;}};
}
$('#files').onchange=e=>{preview([...e.target.files]).catch(fail);e.target.value='';};
$('#exportOptions').innerHTML=[...DVM_PARTS,'biData','biRules','planning','links','expertReviews','quality'].map(k=>`<label><input type="checkbox" data-part="${k}" checked>${LABELS[k]}</label>`).join('');
$('#exportOptions').onchange=()=>{$('#dependencies').textContent=makeExport(state,selection()).afhankelijkheden.join(' ');};
$('#all').onclick=()=>document.querySelectorAll('[data-part]').forEach(x=>x.checked=true);$('#none').onclick=()=>document.querySelectorAll('[data-part]').forEach(x=>x.checked=false);
$('#export').onclick=async()=>{try{if(busy)throw Error('Wacht tot import of opslag gereed is.');const snapshot=await exportSnapshot();const sel=selection();if(!sel.size)throw Error('Kies minstens één onderdeel.');download(makeExport(snapshot,sel),'bidash-integraal_'+new Date().toISOString().slice(0,10)+'.json');}catch(e){fail(e);}};
for(const [id,key,name] of [['exportDvm','dvm','dvm-dienstimpact-totaal.json'],['exportBi','bi','bidash-wvm-dataset.json'],['exportXml','planning','planning.xml']])$( '#'+id).onclick=async()=>{try{if(busy)throw Error('Wacht tot de lopende bewerking gereed is.');const snapshot=key==='dvm'?await exportSnapshot():(await capture(),state);if(!snapshot[key])throw Error('Dit onderdeel is nog niet geladen.');download(key==='planning'?snapshot.planning.xml:snapshot[key],name,key==='planning'?'text/xml':'application/json');}catch(e){fail(e);}};
$('#save').onclick=sync;$('#refresh').onclick=sync;$('#signalFilter').onchange=render;
$('#linkForm').onsubmit=e=>{e.preventDefault();const l={dienst:$('#linkService').value,functie:$('#linkFunction').value,eigenaar:$('#linkOwner').value.trim()};state.links=state.links.filter(x=>x.dienst!==l.dienst||x.functie!==l.functie);state.links.push(l);sync();};
$('#links').onclick=e=>{if(e.target.dataset.remove!==undefined){state.links.splice(Number(e.target.dataset.remove),1);sync();}};
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.expertService!==undefined){const form=$('#expertReviewForm');if(form){const draft=collectExpertForm(form);expertDrafts.set(draft.dienstId,draft);}expertServiceId=b.dataset.expertService;expertDraft=expertDrafts.get(expertServiceId)||null;expertMessage='';await show('expertInput');return;}
 if(b.dataset.expertAdd){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);const type=b.dataset.expertAdd,id=`${type}-${Date.now()}`;if(type==='relatie')expertDraft.relaties.push({id,bron:'',relatie:'',doel:'',kritiek:'',duiding:'',bewijs:''});if(type==='regel')expertDraft.regelVoorstellen.push({id,als:'',dan:'',maatstaf:'',gewicht:'',uitzondering:'',eigenaar:'',bewijs:''});if(type==='signaal')expertDraft.signaalVoorstellen.push({id,voorwaarde:'',ernst:'',actie:'',eigenaar:'',responstijd:'',escalatie:''});if(type==='subprocess'){if(!expertDraft.modelWijziging.subprocessen.length)gebruikHuidigExpertModel(expertDraft);expertDraft.modelWijziging.subprocessen.push({id,naam:'',aandeel:'0',afhankelijkheden:{},onderbouwing:''});expertDraft.modelWijziging.test=null;}expertDrafts.set(expertDraft.dienstId,expertDraft);renderExpertInput();return;}
 if(b.dataset.expertRemove){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);const index=Number(b.dataset.index),type=b.dataset.expertRemove;if(type==='relatie')expertDraft.relaties.splice(index,1);if(type==='regel')expertDraft.regelVoorstellen.splice(index,1);if(type==='signaal')expertDraft.signaalVoorstellen.splice(index,1);if(type==='subprocess'){expertDraft.modelWijziging.subprocessen.splice(index,1);expertDraft.modelWijziging.test=null;}expertDrafts.set(expertDraft.dienstId,expertDraft);renderExpertInput();return;}
 if(b.hasAttribute('data-expert-use-chain')){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);const current=expertCurrentService();if(current){if(!expertDraft.proces.stappen)expertDraft.proces.stappen=(current.subprocessen||[]).map((sp,index)=>`${index+1}. ${sp.naam}`).join('\n');if(!expertDraft.afhankelijkheden.assets)expertDraft.afhankelijkheden.assets=[...new Set((current.subprocessen||[]).flatMap(sp=>(sp.bronnen||[]).map(bron=>bron.obj||bron.typeId)).filter(Boolean))].join(', ');if(!expertDraft.meting.normDuiding)expertDraft.meting.normDuiding=`De huidige BiDash-norm is ${current.norm}%. De expert moet duiden wat deze norm inhoudelijk betekent en over welke scope zij geldt.`;gebruikHuidigExpertModel(expertDraft,current);}renderExpertInput();return;}
 if(b.hasAttribute('data-expert-use-model')){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);gebruikHuidigExpertModel(expertDraft);expertDrafts.set(expertDraft.dienstId,expertDraft);renderExpertInput();return;}
 if(b.hasAttribute('data-expert-test-model')){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);const voorstel=expertModelProposal(expertDraft,expertCurrentService()),fouten=validateExpertModelProposal(voorstel),melding=$('#expertFormMessage');if(fouten.length){melding.textContent='Proefberekening niet gestart. '+fouten.join(' ');melding.classList.add('error');return;}try{status('Expertmodel proefberekenen…');const d=await engine('dvm'),resultaat=await d.testServiceModel(voorstel);expertDraft.modelWijziging.test=resultaat;expertDrafts.set(expertDraft.dienstId,expertDraft);state.expertReviews=upsertServiceExpertReview(state.expertReviews,expertDraft);expertMessage='Proefberekening voltooid. Het actieve DVM-model is automatisch teruggezet.';await sync();renderExpertInput();}catch(error){fail(error);}return;}
 if(b.hasAttribute('data-expert-apply-model')){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);const voorstel=expertModelProposal(expertDraft,expertCurrentService()),fouten=[...validateExpertModelProposal(voorstel),...validateServiceExpertReview(expertDraft,{voorStatus:true})],melding=$('#expertFormMessage');if(expertDraft.status!=='vastgesteld')fouten.unshift('Zet de expertduiding eerst op Vastgesteld.');if(fouten.length){melding.textContent='Model niet toegepast. '+[...new Set(fouten)].join(' ');melding.classList.add('error');return;}try{status('Vastgesteld expertmodel toepassen…');const d=await engine('dvm'),resultaat=await d.applyServiceModel(voorstel);summaries.dvm=d.summary();expertDraft.modelWijziging.toepassing={status:'toegepast',rollback:resultaat.rollback,resultaat};expertDrafts.set(expertDraft.dienstId,expertDraft);state.expertReviews=upsertServiceExpertReview(state.expertReviews,expertDraft);expertMessage='Het vastgestelde model is toegepast. Je kunt de vorige modelversie terugzetten.';await sync();renderExpertInput();}catch(error){fail(error);}return;}
 if(b.hasAttribute('data-expert-undo-model')){const form=$('#expertReviewForm');if(form)expertDraft=collectExpertForm(form);const rollback=expertDraft.modelWijziging?.toepassing?.rollback;if(!rollback)return;try{status('Vorige expertmodel terugzetten…');const d=await engine('dvm'),resultaat=await d.restoreServiceModel(rollback);summaries.dvm=d.summary();expertDraft.modelWijziging.toepassing={status:'teruggezet',rollback:null,resultaat};expertDrafts.set(expertDraft.dienstId,expertDraft);state.expertReviews=upsertServiceExpertReview(state.expertReviews,expertDraft);expertMessage='De vorige modelversie is teruggezet en opnieuw doorgerekend.';await sync();renderExpertInput();}catch(error){fail(error);}return;}
 if(b.hasAttribute('data-expert-export')){const form=$('#expertReviewForm');const review=form?collectExpertForm(form):expertDraft;if(review)download(review,`bidash-expertduiding-${review.dienstId||'dienst'}.json`);return;}
 if(b.id==='runQualityAudit')executeQualityAudit().catch(fail);if(b.id==='exportQualityAudit'&&state.qualityAudit)download(state.qualityAudit,'bidash-kwaliteitsaudit_'+new Date().toISOString().slice(0,10)+'.json');if(b.dataset.qualityOpen==='faultRules'){await show('impactRules');const d=await engine('dvm');if(typeof d.openFaultRules==='function')await d.openFaultRules();}if(b.dataset.route){const form=$('#expertReviewForm');if(form){const draft=collectExpertForm(form);expertDrafts.set(draft.dienstId,draft);}show(b.dataset.route);}if(b.dataset.open){const [name,tab]=b.dataset.open.split(':');const r=Object.values(ROUTES).find(r=>r.engine===name&&r.target===tab);show(r?.id||'overview');}if(b.dataset.scenario){await show('services');const d=await engine('dvm');d.scenario(b.dataset.scenario);}});

$('#expertInputHost').addEventListener('change',event=>{if(event.target.closest('[data-expert-model-section]')){const form=$('#expertReviewForm');if(form){const draft=collectExpertForm(form);draft.modelWijziging.test=null;expertDraft=draft;expertDrafts.set(draft.dienstId,draft);form.querySelector('.expert-model-result')?.remove();}return;}if(event.target.id!=='expertServiceSelect')return;const form=$('#expertReviewForm');if(form){const draft=collectExpertForm(form);expertDrafts.set(draft.dienstId,draft);}expertServiceId=event.target.value;expertDraft=expertDrafts.get(expertServiceId)||null;expertMessage='';renderExpertInput();});
$('#expertInputHost').addEventListener('submit',async event=>{if(event.target.id!=='expertReviewForm')return;event.preventDefault();try{const review=collectExpertForm(event.target),fouten=validateServiceExpertReview(review,{voorStatus:true});if(fouten.length){const host=$('#expertFormMessage');host.textContent='Nog niet opslaan als '+expertStatusLabel(review.status)+': '+fouten.join(' ');host.classList.add('error');return;}state.expertReviews=upsertServiceExpertReview(state.expertReviews,review);expertDraft=review;expertDrafts.set(review.dienstId,review);expertMessage=`Expertduiding voor ${review.dienstNaam} is lokaal opgeslagen als ${expertStatusLabel(review.status)}.`;await sync();renderExpertInput();}catch(error){fail(error);}});
$('#primaryNav').innerHTML=GROUPS.map(g=>`<button data-route="${g.items[0][0]}" data-group="${g.id}"><span class="nav-icon" aria-hidden="true">${g.icon}</span>${g.label}</button>`).join('');
// De schil toont haar eigen versie meteen; engineversies komen erbij zodra een
// module zich meldt. Zo staat er nooit een leeg of verouderd nummer in de balk.
toonVersies(document,engineVersies);
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));

try{busy=true;state=(await read())||DEFAULT_STATE();if(!Array.isArray(state.expertReviews))state.expertReviews=[];await restore(state);await capture();render();status('Werkruimte gereed. Kies Laden & exporteren voor jouw bestanden.');}catch(e){fail(e);}finally{busy=false;}

show(location.hash.slice(1)||'overview');

// Gezamenlijke presentatielaag; berekeningen blijven bij hun bestaande eigenaar.
function empty(title,text,route='data'){return `<div class="empty"><b>${esc(title)}</b>${esc(text)}<br><button data-route="${route}">${route==='data'?'Bestanden laden':'Openen'} →</button></div>`;}
function options(id,values){const el=$(id),selected=el.value;el.innerHTML='<option value="">Alle centrales</option>'+[...new Set(values.filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');el.value=selected;}
function sourceApi(name){return frames[name]?.contentWindow?.HUB;}
function catalogue(){return [...(sourceApi('dvm')?.assets()||[]).map(a=>({source:'DVM',key:a.key,naam:a.naam,tp:a.tp,vc:a.vc,weg:[a.weg,a.richting,a.hm!=null?'hm '+num(a.hm,3):''].filter(Boolean).join(' '),status:a.prognoseActief===false?'Niet operationeel':a.status||'Operationeel',raw:a})),...(sourceApi('bi')?.assets()||[]).map(a=>({source:'BI',key:a.key,naam:a.naam,tp:a.assetType,vc:a.vc,weg:a.weg,status:a.status,raw:a}))];}
function allFaults(){return sourceApi('dvm')?.faults()||[];}
function faultCodesByAsset(faults=allFaults()){
 const map=new Map();for(const fault of faults){if(!fault.assetKey||!fault.code)continue;const codes=map.get(fault.assetKey)||new Set();codes.add(String(fault.code));map.set(fault.assetKey,codes);}return map;
}
function queryAssets(rows,faults){
 const codes=faultCodesByAsset(faults),counts=new Map();for(const fault of faults)if(fault.assetKey)counts.set(fault.assetKey,(counts.get(fault.assetKey)||0)+1);
 return rows.map(asset=>({...asset,
   contract:asset.raw?.contract,aannemer:asset.raw?.aannemer,leverancier:asset.raw?.leverancier,
   ingebruikname:asset.raw?.ingebruikname??asset.raw?.ingebruikDatum??null,
   bouwjaar:asset.raw?.bouwjaar??null,bouwjaarBron:asset.raw?.bouwjaarBron||'',
   eolJaar:asset.raw?.eol?.jaar??asset.raw?._eolYear??null,
   eolLevensduur:asset.raw?.eol?.levensduur??asset.raw?._eolLife??null,
   openFaults:counts.get(asset.key)||0,assetFaultCodes:[...(codes.get(asset.key)||[])]
 }));
}
function queryFaults(rows){
 const codes=faultCodesByAsset(rows);
 return rows.map(fault=>({...fault,assetFaultCodes:[...(codes.get(fault.assetKey)||[])]}));
}
function queryField(type,key){return (type==='assets'?ASSET_QUERY_FIELDS:FAULT_QUERY_FIELDS).find(field=>field.key===key);}
function renderQueryBuilder(type){
 const host=$('#'+(type==='assets'?'assetQueryBuilder':'faultQueryBuilder'));if(!host)return;const query=queries[type],fields=type==='assets'?ASSET_QUERY_FIELDS:FAULT_QUERY_FIELDS;
 const rules=query.rules.map((rule,index)=>{const field=queryField(type,rule.field)||fields[0],operators=operatorsFor(field.type),noValue=['empty','notEmpty'].includes(rule.operator),basis=`${type}-query-${index}`,join=index?`<select name="${basis}-join" data-query-join aria-label="Logische koppeling"><option value="and" ${rule.join!=='or'?'selected':''}>EN</option><option value="or" ${rule.join==='or'?'selected':''}>OF</option></select>`:'<span class="query-where">WAAR</span>';return `<div class="query-rule" data-query-rule="${index}">${join}<select name="${basis}-field" data-query-field aria-label="Veld">${fields.map(item=>`<option value="${esc(item.key)}" ${item.key===field.key?'selected':''}>${esc(item.label)}</option>`).join('')}</select><select name="${basis}-operator" data-query-operator aria-label="Vergelijking">${operators.map(([value,label])=>`<option value="${esc(value)}" ${value===rule.operator?'selected':''}>${esc(label)}</option>`).join('')}</select><input name="${basis}-value" data-query-value aria-label="Filterwaarde" value="${esc(rule.value||'')}" placeholder="Waarde" ${noValue?'disabled':''}><button data-query-remove="${index}" aria-label="Filterregel verwijderen">Verwijderen</button></div>`;}).join('');
 host.innerHTML=`<div class="query-toolbar"><button data-query-add>Voorwaarde toevoegen</button><button data-query-reset ${query.rules.length?'':'disabled'}>Query wissen</button><span>SQL-logica, EN wordt vóór OF uitgevoerd.</span></div>${rules}<div class="query-summary">${query.rules.length?`${query.rules.length} voorwaarde${query.rules.length===1?'':'n'} actief. Filters boven deze module blijven ook gelden.`:'Nog geen queryvoorwaarden.'}</div>`;
}
function queryChanged(type){assetPage=0;renderQueryBuilder(type);if(type==='assets')renderAssets();else{renderFaults();document.dispatchEvent(new CustomEvent('bidash:query-change',{detail:{type}}));}}
function installQueryBuilder(type){
 const host=$('#'+(type==='assets'?'assetQueryBuilder':'faultQueryBuilder'));if(!host||host.dataset.ready)return;host.dataset.ready='1';renderQueryBuilder(type);
 host.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-query-add'))queries[type].rules.push({join:'and',field:(type==='assets'?ASSET_QUERY_FIELDS:FAULT_QUERY_FIELDS)[0].key,operator:'contains',value:''});else if(button.hasAttribute('data-query-reset'))queries[type]={rules:[]};else if(button.dataset.queryRemove!==undefined)queries[type].rules.splice(Number(button.dataset.queryRemove),1);queryChanged(type);});
 host.addEventListener('change',event=>{const row=event.target.closest('[data-query-rule]'),index=row?Number(row.dataset.queryRule):-1;if(index>=0&&event.target.matches('[data-query-join]'))queries[type].rules[index].join=event.target.value;else if(index>=0&&event.target.matches('[data-query-field]')){const field=queryField(type,event.target.value),join=queries[type].rules[index].join;queries[type].rules[index]={join,field:event.target.value,operator:operatorsFor(field?.type)[0][0],value:''};}else if(index>=0&&event.target.matches('[data-query-operator]'))queries[type].rules[index].operator=event.target.value;queryChanged(type);});
 host.addEventListener('input',event=>{const row=event.target.closest('[data-query-rule]');if(!row||!event.target.matches('[data-query-value]'))return;queries[type].rules[Number(row.dataset.queryRule)].value=event.target.value;assetPage=0;if(type==='assets')renderAssets();else{renderFaults();document.dispatchEvent(new CustomEvent('bidash:query-change',{detail:{type}}));}});
}

function renderNative(){
 const d=summaries.dvm,b=summaries.bi;
 $('#simulationBadge').hidden=!b?.simulation;
 $('#sourceBadge').textContent=d?.peildatum?'Storingsbeeld · '+date(d.peildatum):state.planning?'Planning geladen':'Nog geen storingsbron';
 const signals=combine(d,b,state.links);
 $('#prioritySignals').innerHTML=signals.length?signals.slice(0,3).map(t=>`<article class="signal"><small>${esc(t.eigenaar)} · ${esc(t.resp||'Verantwoordelijke vastleggen')}</small><strong>${esc(t.titel)}</strong><p>${esc(t.msg)}</p></article>`).join(''):empty('Nog geen gezamenlijke prioriteiten','Laad bronnen en verbind diensten aan bedrijfsfuncties.','rules');
 $('#services').innerHTML=d?.liveBronnen?d.diensten.map(x=>`<div class="service-row"><div class="service-line"><span>${esc(x.naam)}</span><b class="${x.besch==null?'range':''}">${x.besch==null?num(x.lo)+'–'+num(x.hi):num(x.besch,2)}%</b></div>${x.besch==null?'<div class="range-band"></div>':`<progress max="100" value="${x.besch}"></progress>`}<div class="service-meta-action"><small>Norm ${num(x.norm)}% · ${x.besch==null?'brondekking nog niet bevestigd':'berekend uit de subprocessen'}</small><button type="button" data-expert-service="${esc(x.id)}">Expertinvoer</button></div></div>`).join(''):empty('Dienstimpact wacht op brondata','Laad een DVM-totaalbestand met de open storingen.');
 $('#capacity').innerHTML=b?.functies.length?b.functies.map(f=>`<div class="capacity-line"><span>${esc(f.naam)}</span><b>${num(f.actueel)} / ${num(f.benodigd)} FTE</b></div>`).join(''):empty('Formatie nog niet ingevuld','Laad BI-gegevens of vul bedrijfsfuncties in.','businessData');
 $('#planningStatus').innerHTML=b?.planning?`<b>${num(b.planning.regels,0)} planningsactiviteiten</b><span>${esc(b.planning.naam)}</span><br><button data-route="planning">Tijdlijn bekijken →</button>`:'<span>Planning-XML nog niet geladen.</span><br><button data-route="planning">Planning openen →</button>';
 $('#organisationTable').innerHTML=b?.functies.length?`<div class="table-scroll"><table><thead><tr><th>Bedrijfsfunctie</th><th>Benodigd FTE</th><th>Beschikbaar FTE</th><th>Verschil</th></tr></thead><tbody>${b.functies.map(f=>`<tr><td>${esc(f.naam)}</td><td>${num(f.benodigd)}</td><td>${num(f.actueel)}</td><td>${num(f.actueel-f.benodigd)}</td></tr>`).join('')}</tbody></table></div>`:empty('Nog geen bedrijfsfuncties','Vul de formatie in bij Bedrijfsgegevens.','businessData');
 if(view==='assets'){options('#assetVc',catalogue().map(a=>a.vc));renderAssets();}
 if(view==='faults'){options('#faultVc',allFaults().map(f=>f.vc));renderFaults();}
 if(view==='costs'){options('#costVc',(d?.roads||[]).map(r=>r.vc));renderCosts();}
}
function renderAssets(){
 const all=catalogue(),faults=allFaults(),affected=new Set(faults.map(m=>m.assetKey)),q=$('#assetSearch').value.toLowerCase(),vc=$('#assetVc').value,src=$('#assetSource').value,only=$('#assetFaultOnly').checked;
 const rows=applyQuery(queryAssets(all,faults).filter(a=>(!src||src===a.source)&&(!vc||vc===a.vc)&&(!only||(a.source==='DVM'&&affected.has(a.key)))&&(!q||[a.naam,a.weg,a.tp,a.raw.contract,a.raw.aannemer,a.raw.leverancier].join(' ').toLowerCase().includes(q))),queries.assets,ASSET_QUERY_FIELDS);
 assetPage=Math.min(assetPage,Math.max(0,Math.ceil(rows.length/pageSize)-1));
 $('#assetKpis').innerHTML=[['Assets in register',num(all.length,0),'Alle geladen assets, inclusief niet-operationele'],['Open storingen',num(faults.length,0),'Op de brondag '+date(summaries.dvm?.peildatum)],['Bronnen','DVM + BI','Impactregels en identiteit blijven bij hun bron']].map(c=>`<div class="card">${c[0]}<strong>${c[1]}</strong><small>${esc(c[2])}</small></div>`).join('');
 $('#assetTable').innerHTML=rows.length?`<table><thead><tr><th>Asset</th><th>Type / bron</th><th>Locatie</th><th>VC</th><th>Status</th><th>Open</th></tr></thead><tbody>${rows.slice(assetPage*pageSize,(assetPage+1)*pageSize).map(a=>`<tr><td><button data-asset="${esc(a.key)}" data-source="${a.source}">${esc(a.naam)}</button></td><td>${esc(a.tp)} <span class="pill">${a.source}</span></td><td>${esc(a.weg)}</td><td>${esc(a.vc||'Onbekend')}</td><td>${esc(a.status)}</td><td>${a.source==='DVM'?faults.filter(m=>m.assetKey===a.key).length:'—'}</td></tr>`).join('')}</tbody></table>`:empty('Geen assets in deze selectie',all.length?'Pas de filters aan.':'Laad je DVM-totaalbestand of BI-assets.');
 $('#assetCount').textContent=`${num(rows.length,0)} resultaten · pagina ${assetPage+1} van ${Math.max(1,Math.ceil(rows.length/pageSize))}`;$('#assetPrev').disabled=assetPage===0;$('#assetNext').disabled=(assetPage+1)*pageSize>=rows.length;
}
function renderFaults(){const q=$('#faultSearch').value.toLowerCase(),vc=$('#faultVc').value,rows=applyQuery(queryFaults(allFaults()).filter(m=>(!vc||m.vc===vc)&&[m.naam,m.weg,m.code,m.omschrijving].join(' ').toLowerCase().includes(q)),queries.faults,FAULT_QUERY_FIELDS);$('#faultTable').innerHTML=rows.length?`<table><thead><tr><th>Asset / melding</th><th>Weg / richting</th><th>VC</th><th>Code</th><th>Impact</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${m.assetKey?`<button data-asset="${esc(m.assetKey)}" data-source="DVM">${esc(m.naam||m.assetKey)}</button>`:esc(m.naam||'Niet gekoppeld')}<br><small class="muted">${esc(m.omschrijving)}</small></td><td>${esc(m.weg+' '+m.richting)} ${m.hm!=null?'· '+esc(m.hm):''}</td><td>${esc(m.vc)}</td><td>${esc(m.code)}</td><td>${m.impact==null?'Niet doorgerekend':num(m.impact)+'%'}</td></tr>`).join('')}</tbody></table>`:empty('Geen open storingen in deze selectie','Laad open storingen of pas de filters aan.');}
function renderCosts(){const vc=$('#costVc').value,rows=(summaries.dvm?.roads||[]).filter(r=>!vc||r.vc===vc),known=rows.filter(r=>Number.isFinite(r.kosten)),total=known.reduce((s,r)=>s+r.kosten,0);$('#costKpis').innerHTML=[['Bekend subtotaal / brondag',known.length?money(total):'Onbekend'],['Berekenbare wegdelen',known.length+' / '+rows.length],['Brondag',date(summaries.dvm?.peildatum)]].map(c=>`<div class="card">${c[0]}<strong>${esc(c[1])}</strong></div>`).join('');$('#costTable').innerHTML=rows.length?`<table><thead><tr><th>Wegdeel</th><th>VC</th><th>VVU / brondag</th><th>Kosten / brondag</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.naam)}</td><td>${esc(r.vc)}</td><td>${num(r.vvu)}</td><td>${money(r.kosten)}</td><td><button data-cost="${esc(r.id)}">Bekijk berekening →</button></td></tr>`).join('')}</tbody></table>`:empty('Nog geen wegdelen','Laad een actuele storingsbron met assetregister.');}
$('#assetSearch').oninput=()=>{assetPage=0;renderAssets();};for(const id of ['assetVc','assetSource','assetFaultOnly'])$('#'+id).onchange=()=>{assetPage=0;renderAssets();};$('#assetPrev').onclick=()=>{assetPage--;renderAssets();};$('#assetNext').onclick=()=>{assetPage++;renderAssets();};$('#faultSearch').oninput=renderFaults;$('#faultVc').onchange=renderFaults;$('#costVc').onchange=renderCosts;
installQueryBuilder('assets');installQueryBuilder('faults');

function assistantAllData(){
 const faults=allFaults(),dvmApi=sourceApi('dvm'),biApi=sourceApi('bi');
 const dvmContext=dvmApi?.context?.()||{},biContext=biApi?.context?.()||{};
 const functions=biContext.functions?.length?biContext.functions:(summaries.bi?.functies||[]);
 return buildBiDashContext({
  faults:queryFaults(faults),
  assets:queryAssets(catalogue(),faults),
  roads:(summaries.dvm?.roads||[]).slice(),
  services:dvmContext.services?.length?dvmContext.services:(summaries.dvm?.diensten||[]),
  functions,dvm:dvmContext,bi:biContext,links:state.links||[],state
 });
}
function assistantData(mode='all'){
 const data=assistantAllData();if(mode!=='screen')return data;
 if(view==='faults'){
  const q=$('#faultSearch').value.toLowerCase(),vc=$('#faultVc').value;
  data.faults=applyQuery(data.faults.filter(m=>(!vc||m.vc===vc)&&[m.naam,m.weg,m.code,m.omschrijving].join(' ').toLowerCase().includes(q)),queries.faults,FAULT_QUERY_FIELDS);
 }else if(view==='assets'){
  const faults=allFaults(),affected=new Set(faults.map(m=>m.assetKey)),q=$('#assetSearch').value.toLowerCase(),vc=$('#assetVc').value,src=$('#assetSource').value,only=$('#assetFaultOnly').checked;
  data.assets=applyQuery(data.assets.filter(a=>(!src||src===a.source)&&(!vc||vc===a.vc)&&(!only||(a.source==='DVM'&&affected.has(a.key)))&&(!q||[a.naam,a.weg,a.tp,a.raw?.contract,a.raw?.aannemer,a.raw?.leverancier].join(' ').toLowerCase().includes(q))),queries.assets,ASSET_QUERY_FIELDS);
 }else if(view==='costs'){
  const vc=$('#costVc').value;data.roads=data.roads.filter(r=>!vc||r.vc===vc);
 }
 return data;
}
function assistantScreenContext(){
 const filters={};
 if(view==='faults'){if($('#faultVc').value)filters.vc=$('#faultVc').value;if($('#faultSearch').value)filters.search=$('#faultSearch').value;return {dataset:'faults',filters};}
 if(view==='assets'){if($('#assetVc').value)filters.vc=$('#assetVc').value;if($('#assetSource').value)filters.source=$('#assetSource').value;if($('#assetSearch').value)filters.search=$('#assetSearch').value;return {dataset:'assets',filters};}
 if(view==='costs'){if($('#costVc').value)filters.vc=$('#costVc').value;return {dataset:'roads',filters};}
 if(view==='planning')return {dataset:'planning',filters};
 if(view==='organisation')return {dataset:'capacity',filters};
 if(['roads'].includes(view))return {dataset:'roads',filters};
 if(['services','area','region','calculation','memos'].includes(view))return {dataset:'services',filters};
 if(['lifecycle','signalForecast','chains'].includes(view))return {dataset:'assets',filters};
 return {dataset:'overview',filters};
}
async function assistantApplyContext(context={}){
 const f=context.filters||{};
 if(context.dataset==='faults'){
  await show('faults');queries.faults={rules:[]};
  if(f.typeId)queries.faults.rules.push({join:'and',field:'typeId',operator:'equals',value:f.typeId});
  if(f.road)queries.faults.rules.push({join:'and',field:'weg',operator:'equals',value:f.road});
  if(f.code)queries.faults.rules.push({join:'and',field:'code',operator:'equals',value:f.code});
  if(f.rekenStatus==='niet doorgerekend')queries.faults.rules.push({join:'and',field:'impact',operator:'empty',value:''});
  if(f.rekenStatus==='doorgerekend')queries.faults.rules.push({join:'and',field:'impact',operator:'notEmpty',value:''});
  $('#faultVc').value=f.vc||'';$('#faultSearch').value=f.search||'';renderQueryBuilder('faults');renderFaults();return;
 }
 if(context.dataset==='assets'){
  await show('assets');queries.assets={rules:[]};
  if(f.typeId)queries.assets.rules.push({join:'and',field:'tp',operator:'equals',value:f.typeId});
  if(f.road)queries.assets.rules.push({join:'and',field:'weg',operator:'contains',value:f.road});
  $('#assetVc').value=f.vc||'';$('#assetSource').value=f.source||'';$('#assetSearch').value=f.search||'';renderQueryBuilder('assets');renderAssets();return;
 }
 if(context.dataset==='roads'){await show('costs');if(f.vc){$('#costVc').value=f.vc;renderCosts();}return;}
 if(context.dataset==='planning'){await show('planning');return;}
 if(context.dataset==='capacity'){await show('organisation');return;}
 if(context.dataset==='services'||context.dataset==='relations'){await show('services');return;}
 if(context.dataset==='works'||context.dataset==='uroutes'||context.dataset==='history'||context.dataset==='eol'){await show('data');return;}
}

installQueryAssistant({
 getData:assistantData,
 getScreenContext:assistantScreenContext,
 onApplyContext:context=>assistantApplyContext(context).catch(fail),
 onOpenRoute:route=>show(route)
});
$('#closeAsset').onclick=()=>$('#assetDialog').close();
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.asset){const src=b.dataset.source,key=b.dataset.asset,a=src==='DVM'?sourceApi('dvm').detail(key).asset:sourceApi('bi').assets().find(a=>a.key===key);if(!a)return;const fields=[['Bron',src],['Naam',a.naam],['Type',a.tp||a.assetType],['Verkeerscentrale',a.vc],['Weg',a.weg],['Bouwjaar',a.bouwjaar],['EOL',a.eol],['Contract',a.contract],['Aannemer',a.aannemer],['Leverancier',a.leverancier]];const faults=src==='DVM'?sourceApi('dvm').detail(key).faults:[];$('#assetDetail').innerHTML=`<div class="detail-grid">${fields.map(([k,v])=>`<div><small>${k}</small><b>${esc(v??'Onbekend')}</b></div>`).join('')}</div><h3>${faults.length} gekoppelde open meldingen</h3>${faults.map(m=>`<p>${esc(m.code)} · ${m.impact==null?'Niet doorgerekend':num(m.impact)+'%'} impact · ${esc(m.omschrijving)}</p>`).join('')}<button id="detailFaults">${src==='DVM'?'Storingen en impact':'Bedienketens'} bekijken →</button>`;$('#detailFaults').onclick=()=>{$('#assetDialog').close();if(src==='DVM'){$('#faultSearch').value=a.naam;show('faults');}else show('chains');};$('#assetDialog').showModal();}if(b.dataset.cost){await show('services');sourceApi('dvm').openCosts(b.dataset.cost);}});

function setPlanningFullscreen(active){
 active=!!active;if(active&&!frames.planning)return;
 document.body.classList.toggle('planning-fullscreen',active);$('#planningFullscreenBar').hidden=!active;
 frames.planning?.contentWindow?.HUB?.fullscreen(active);
 if(!active&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 if(active)$('#closePlanningFullscreen').focus();
}
$('#planningFullscreen').onclick=()=>{setPlanningFullscreen(true);if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});};
$('#closePlanningFullscreen').onclick=()=>setPlanningFullscreen(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')setPlanningFullscreen(false);});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('planning-fullscreen'))setPlanningFullscreen(false);});
