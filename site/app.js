import {GROUPS,ROUTES,resolveRoute} from './ui/routes.js';
import {DEFAULT_STATE,DVM_PARTS,BI_RULE_KEYS,LABELS,validate,makeExport,mergeImport,combine} from './core/model.js';
import {read,write} from './core/storage.js';
import {toonVersies} from './core/versie.js';
import {runQualityAudit,QUALITY_CATEGORIES} from './core/quality-audit.js';
import {applyQuery,operatorsFor} from './core/query-filter.js';
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
async function sync(){if(busy||failedImport)return;busy=true;status('Lokale gegevens en uitkomsten bijwerken…');try{await capture();await write(state);render();status('Lokaal opgeslagen · '+new Date().toLocaleTimeString('nl-NL'));}catch(e){fail(e);}finally{busy=false;}}
function queue(){clearTimeout(timer);timer=setTimeout(sync,1800);}
window.addEventListener('message',ev=>{if(ev.origin!==location.origin||!Object.values(frames).some(f=>f.contentWindow===ev.source))return;if(ev.data?.type==='hub:planning-loaded'&&ev.source===frames.planning?.contentWindow){frames.bi?.contentWindow?.HUB?.syncPlanningRules();queue();}if(ev.data?.type==='hub:planning-fullscreen'&&ev.source===frames.planning?.contentWindow)setPlanningFullscreen(ev.data.active);if(ev.data?.type==='hub:version'&&ev.data.engine){engineVersies[ev.data.engine]=String(ev.data.versie??'');toonVersies(document,engineVersies);}if(ev.data?.type==='hub:changed'&&!busy)queue();});
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
 renderNative();
 renderQualityDashboard();
 $('#inventory').textContent=`Lokaal: DVM ${state.dvm?'geladen':'leeg'} · BI ${state.bi?'geladen':'leeg'} · planning ${state.planning?'geladen':'leeg'} · ${state.links.length} koppelingen.`;
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
 const trend=history.length>1?`<section><div class="section-heading"><h2>Ontwikkeling</h2><span class="muted">Laatste ${history.length} audits</span></div><div class="quality-trend">${history.map(x=>`<div class="quality-trend-item" title="${esc(qualityDate(x.generatedAt))}: ${num(x.score,0)}"><span style="height:${Math.max(4,(Number(x.score)||0)/max*100)}%" class="tone-${x.blockers?'red':x.score<85?'amber':'green'}"></span><small>${num(x.score,0)}</small></div>`).join('')}</div></section>`:'';
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
 $('#applyImport').onclick=async()=>{if(busy)return;busy=true;clearTimeout(timer);$('#applyImport').disabled=true;status('Bronnen lokaal verwerken; een groot DVM-register kan even duren…');const previous=state;try{await restore(proposed);state=proposed;await capture();await write(state);render();host.replaceChildren();status('Import voltooid en lokaal opgeslagen.');}catch(e){state=previous;failedImport=true;fail(Error('Import niet opgeslagen: '+e.message+' Herlaad de pagina om de vorige opgeslagen werkruimte terug te zetten.'));}finally{busy=false;}};
}
$('#files').onchange=e=>{preview([...e.target.files]).catch(fail);e.target.value='';};
$('#exportOptions').innerHTML=[...DVM_PARTS,'biData','biRules','planning','links','quality'].map(k=>`<label><input type="checkbox" data-part="${k}" checked>${LABELS[k]}</label>`).join('');
$('#exportOptions').onchange=()=>{$('#dependencies').textContent=makeExport(state,selection()).afhankelijkheden.join(' ');};
$('#all').onclick=()=>document.querySelectorAll('[data-part]').forEach(x=>x.checked=true);$('#none').onclick=()=>document.querySelectorAll('[data-part]').forEach(x=>x.checked=false);
$('#export').onclick=async()=>{try{if(busy)throw Error('Wacht tot import of opslag gereed is.');await capture();const sel=selection();if(!sel.size)throw Error('Kies minstens één onderdeel.');download(makeExport(state,sel),'bidash-integraal_'+new Date().toISOString().slice(0,10)+'.json');}catch(e){fail(e);}};
for(const [id,key,name] of [['exportDvm','dvm','dvm-dienstimpact-totaal.json'],['exportBi','bi','bidash-wvm-dataset.json'],['exportXml','planning','planning.xml']])$( '#'+id).onclick=async()=>{try{if(busy)throw Error('Wacht tot de lopende bewerking gereed is.');await capture();if(!state[key])throw Error('Dit onderdeel is nog niet geladen.');download(key==='planning'?state.planning.xml:state[key],name,key==='planning'?'text/xml':'application/json');}catch(e){fail(e);}};
$('#save').onclick=sync;$('#refresh').onclick=sync;$('#signalFilter').onchange=render;
$('#linkForm').onsubmit=e=>{e.preventDefault();const l={dienst:$('#linkService').value,functie:$('#linkFunction').value,eigenaar:$('#linkOwner').value.trim()};state.links=state.links.filter(x=>x.dienst!==l.dienst||x.functie!==l.functie);state.links.push(l);sync();};
$('#links').onclick=e=>{if(e.target.dataset.remove!==undefined){state.links.splice(Number(e.target.dataset.remove),1);sync();}};
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='runQualityAudit')executeQualityAudit().catch(fail);if(b.id==='exportQualityAudit'&&state.qualityAudit)download(state.qualityAudit,'bidash-kwaliteitsaudit_'+new Date().toISOString().slice(0,10)+'.json');if(b.dataset.qualityOpen==='faultRules'){await show('impactRules');const d=await engine('dvm');if(typeof d.openFaultRules==='function')await d.openFaultRules();}if(b.dataset.route)show(b.dataset.route);if(b.dataset.open){const [name,tab]=b.dataset.open.split(':');const r=Object.values(ROUTES).find(r=>r.engine===name&&r.target===tab);show(r?.id||'overview');}if(b.dataset.scenario){await show('services');const d=await engine('dvm');d.scenario(b.dataset.scenario);}});
$('#primaryNav').innerHTML=GROUPS.map(g=>`<button data-route="${g.items[0][0]}" data-group="${g.id}"><span class="nav-icon" aria-hidden="true">${g.icon}</span>${g.label}</button>`).join('');
// De schil toont haar eigen versie meteen; engineversies komen erbij zodra een
// module zich meldt. Zo staat er nooit een leeg of verouderd nummer in de balk.
toonVersies(document,engineVersies);
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));

try{busy=true;state=(await read())||DEFAULT_STATE();await restore(state);await capture();render();status('Werkruimte gereed. Kies Laden & exporteren voor jouw bestanden.');}catch(e){fail(e);}finally{busy=false;}

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
 return rows.map(asset=>({...asset,contract:asset.raw?.contract,aannemer:asset.raw?.aannemer,leverancier:asset.raw?.leverancier,openFaults:counts.get(asset.key)||0,assetFaultCodes:[...(codes.get(asset.key)||[])]}));
}
function queryFaults(rows){
 const codes=faultCodesByAsset(rows);
 return rows.map(fault=>({...fault,assetFaultCodes:[...(codes.get(fault.assetKey)||[])]}));
}
function queryField(type,key){return (type==='assets'?ASSET_QUERY_FIELDS:FAULT_QUERY_FIELDS).find(field=>field.key===key);}
function renderQueryBuilder(type){
 const host=$('#'+(type==='assets'?'assetQueryBuilder':'faultQueryBuilder'));if(!host)return;const query=queries[type],fields=type==='assets'?ASSET_QUERY_FIELDS:FAULT_QUERY_FIELDS;
 const rules=query.rules.map((rule,index)=>{const field=queryField(type,rule.field)||fields[0],operators=operatorsFor(field.type),noValue=['empty','notEmpty'].includes(rule.operator),join=index?`<select data-query-join aria-label="Logische koppeling"><option value="and" ${rule.join!=='or'?'selected':''}>EN</option><option value="or" ${rule.join==='or'?'selected':''}>OF</option></select>`:'<span class="query-where">WAAR</span>';return `<div class="query-rule" data-query-rule="${index}">${join}<select data-query-field>${fields.map(item=>`<option value="${esc(item.key)}" ${item.key===field.key?'selected':''}>${esc(item.label)}</option>`).join('')}</select><select data-query-operator>${operators.map(([value,label])=>`<option value="${esc(value)}" ${value===rule.operator?'selected':''}>${esc(label)}</option>`).join('')}</select><input data-query-value value="${esc(rule.value||'')}" placeholder="Waarde" ${noValue?'disabled':''}><button data-query-remove="${index}" aria-label="Filterregel verwijderen">Verwijderen</button></div>`;}).join('');
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
 $('#services').innerHTML=d?.liveBronnen?d.diensten.map(x=>`<div class="service-row"><div class="service-line"><span>${esc(x.naam)}</span><b class="${x.besch==null?'range':''}">${x.besch==null?num(x.lo)+'–'+num(x.hi):num(x.besch,2)}%</b></div>${x.besch==null?'<div class="range-band"></div>':`<progress max="100" value="${x.besch}"></progress>`}<small>Norm ${num(x.norm)}% · ${x.besch==null?'brondekking nog niet bevestigd':'berekend uit de subprocessen'}</small></div>`).join(''):empty('Dienstimpact wacht op brondata','Laad een DVM-totaalbestand met de open storingen.');
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
