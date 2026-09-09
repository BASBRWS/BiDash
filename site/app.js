import {DEFAULT_STATE,DVM_PARTS,BI_RULE_KEYS,LABELS,validate,makeExport,mergeImport,combine} from './core/model.js';
import {read,write} from './core/storage.js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('nl-NL',{maximumFractionDigits:d}):'Onbekend';
const money=n=>Number.isFinite(n)?n.toLocaleString('nl-NL',{style:'currency',currency:'EUR'}):'Onbekend';
const date=s=>s?new Date(s).toLocaleDateString('nl-NL'):'geen bron geladen';
let state=DEFAULT_STATE(),summaries={},busy=false,failedImport=false,timer,view='overview';const frames={},ready={};
function status(s,error=false){$('#status').textContent=s;$('#status').classList.toggle('error',error);}
function show(v){window.scrollTo(0,0);view=v;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==v);document.querySelectorAll('.engine').forEach(el=>el.hidden=el.id!=='engine-'+v);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='bi'||v==='dvm')engine(v).catch(fail);}
function fail(e){status(e.message||String(e),true);console.error(e);}
async function engine(name){
 if(ready[name])return ready[name];
 ready[name]=new Promise((resolve,reject)=>{const f=document.createElement('iframe');frames[name]=f;f.title=name==='dvm'?'Dienstimpact en kosten':'Planning, formatie en contracten';f.sandbox='allow-scripts allow-same-origin allow-downloads allow-modals allow-popups';f.src='engines/'+name+'.html';const timeout=setTimeout(()=>reject(Error('Module '+name+' reageert niet.')),30000);f.onload=()=>{if(f.contentWindow.HUB){clearTimeout(timeout);resolve(f.contentWindow.HUB);}else{clearTimeout(timeout);reject(Error('Module '+name+' is niet volledig geladen.'));}};$('#engine-'+name).append(f);});
 return ready[name];
}
async function restore(next){
 if(next.bi){const b=await engine('bi');b.import(next.bi);}
 if(next.planning){const b=await engine('bi');await b.importPlanning(next.planning);}
 if(next.dvm?.assetregister?.rijen?.length){const d=await engine('dvm');await d.import(next.dvm);}
}
async function capture(){
 if(failedImport)throw Error("Herlaad eerst de pagina om de vorige opgeslagen werkruimte te herstellen.");
 for(const name of Object.keys(ready)){const e=await engine(name);if(name==='dvm'){const b=e.export();if(b.assetregister)state.dvm=b;}else{state.bi=e.export();const p=e.planning();if(p)state.planning=p;}summaries[name]=e.summary();}
}
async function sync(){if(busy||failedImport)return;busy=true;status('Lokale gegevens en uitkomsten bijwerken…');try{await capture();await write(state);render();status('Lokaal opgeslagen · '+new Date().toLocaleTimeString('nl-NL'));}catch(e){fail(e);}finally{busy=false;}}
function queue(){clearTimeout(timer);timer=setTimeout(sync,1800);}
window.addEventListener('message',ev=>{if(ev.origin!==location.origin||!Object.values(frames).some(f=>f.contentWindow===ev.source))return;if(ev.data?.type==='hub:changed'&&!busy)queue();});
function render(){
 const d=summaries.dvm,b=summaries.bi,roads=d?.roads||[],known=roads.filter(r=>Number.isFinite(r.kosten)),total=known.reduce((s,r)=>s+r.kosten,0),fte=b?.functies||[];
 $('#cards').innerHTML=[['DVM-brondag',date(d?.peildatum),'Open storingen uit de laatste geladen bron'],['Verkeerskosten / brondag',known.length?money(total):'Onbekend',`${known.length} van ${roads.length} wegdelen berekenbaar${known.length<roads.length?' · bekend subtotaal':''}; som scenario’s, controleer overlap`],['Beschikbare formatie',fte.length?num(fte.reduce((s,f)=>s+f.actueel,0))+' FTE':'Onbekend','BI-brondatum: '+date(b?.peildatum)],['Planning',b?.planning?num(b.planning.regels,0)+' activiteiten':'Nog niet geladen',b?.planning?.naam||'Laad je bestaande XML']].map(c=>`<div class="card">${esc(c[0])}<strong>${esc(c[1])}</strong><small>${esc(c[2])}</small></div>`).join('');
 $('#services').innerHTML=d?.liveBronnen?`<table><thead><tr><th>Dienst</th><th>Beschikbaarheid</th><th>Norm</th></tr></thead><tbody>${d.diensten.map(s=>`<tr><td>${esc(s.naam)}</td><td>${s.besch==null?num(s.lo)+'–'+num(s.hi):num(s.besch,2)}%${s.besch==null?' (onvolledige dekking)':''}</td><td>${num(s.norm)}%</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Laad een DVM-totaalbestand met open storingen.</p>';
 $('#capacity').innerHTML=fte.length?`<table><thead><tr><th>Bedrijfsfunctie</th><th>Benodigd FTE</th><th>Beschikbaar FTE</th></tr></thead><tbody>${fte.map(f=>`<tr><td>${esc(f.naam)}</td><td>${num(f.benodigd)}</td><td>${num(f.actueel)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Laad je BI-gegevens of vul bedrijfsfuncties en formatie in bij BI Dash.</p>';
 const triggers=combine(d,b,state.links),filter=$('#signalFilter').value;$('#signalCount').textContent='('+triggers.length+')';
 $('#signals').innerHTML=triggers.filter(t=>!filter||t.eigenaar===filter).map(t=>`<article class="signal"><small>${esc(t.eigenaar)} · ${esc(t.sev||'signaal')} · ${esc(t.resp||'Verantwoordelijke nog vastleggen')}</small><strong>${esc(t.titel)}</strong><p>${esc(t.msg)}</p><small>Toegepaste regel: ${esc(t.regel)}</small></article>`).join('')||'<p class="muted">Geen signalen voor deze selectie. Controleer of alle benodigde bronnen zijn geladen.</p>';
 $('#linkService').innerHTML='<option value="">Kies dienst</option>'+(d?.diensten||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.naam)}</option>`).join('');
 $('#linkFunction').innerHTML='<option value="">Kies bedrijfsfunctie</option>'+fte.map(f=>`<option value="${esc(f.id)}">${esc(f.naam)}</option>`).join('');
 $('#links').innerHTML=state.links.map((l,i)=>`<p>${esc(d?.diensten.find(x=>x.id===l.dienst)?.naam||l.dienst)} ↔ ${esc(fte.find(f=>f.id===l.functie)?.naam||l.functie)} · ${esc(l.eigenaar)} <button data-remove="${i}">Verwijderen</button></p>`).join('')||'<p class="muted">Nog geen koppelingen. Laad beide domeinen om te kunnen koppelen.</p>';
 $('#inventory').textContent=`Lokaal: DVM ${state.dvm?'geladen':'leeg'} · BI ${state.bi?'geladen':'leeg'} · planning ${state.planning?'geladen':'leeg'} · ${state.links.length} koppelingen.`;
}
function download(obj,name,type='application/json'){const blob=new Blob([typeof obj==='string'?obj:JSON.stringify(obj)],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
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
$('#exportOptions').innerHTML=[...DVM_PARTS,'biData','biRules','planning','links'].map(k=>`<label><input type="checkbox" data-part="${k}" checked>${LABELS[k]}</label>`).join('');
$('#exportOptions').onchange=()=>{$('#dependencies').textContent=makeExport(state,selection()).afhankelijkheden.join(' ');};
$('#all').onclick=()=>document.querySelectorAll('[data-part]').forEach(x=>x.checked=true);$('#none').onclick=()=>document.querySelectorAll('[data-part]').forEach(x=>x.checked=false);
$('#export').onclick=async()=>{try{if(busy)throw Error('Wacht tot import of opslag gereed is.');await capture();const sel=selection();if(!sel.size)throw Error('Kies minstens één onderdeel.');download(makeExport(state,sel),'bidash-integraal_'+new Date().toISOString().slice(0,10)+'.json');}catch(e){fail(e);}};
for(const [id,key,name] of [['exportDvm','dvm','dvm-dienstimpact-totaal.json'],['exportBi','bi','bidash-wvm-dataset.json'],['exportXml','planning','planning.xml']])$( '#'+id).onclick=async()=>{try{if(busy)throw Error('Wacht tot de lopende bewerking gereed is.');await capture();if(!state[key])throw Error('Dit onderdeel is nog niet geladen.');download(key==='planning'?state.planning.xml:state[key],name,key==='planning'?'text/xml':'application/json');}catch(e){fail(e);}};
$('#save').onclick=sync;$('#refresh').onclick=sync;$('#signalFilter').onchange=render;
$('#linkForm').onsubmit=e=>{e.preventDefault();const l={dienst:$('#linkService').value,functie:$('#linkFunction').value,eigenaar:$('#linkOwner').value.trim()};state.links=state.links.filter(x=>x.dienst!==l.dienst||x.functie!==l.functie);state.links.push(l);sync();};
$('#links').onclick=e=>{if(e.target.dataset.remove!==undefined){state.links.splice(Number(e.target.dataset.remove),1);sync();}};
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view)show(b.dataset.view);if(b.dataset.open){const [name,tab]=b.dataset.open.split(':');show(name);try{(await engine(name)).open(tab);}catch(e){fail(e);}}});
try{busy=true;state=(await read())||DEFAULT_STATE();await restore(state);await capture();render();status('Werkruimte gereed. Kies Laden & exporteren voor jouw bestanden.');}catch(e){fail(e);}finally{busy=false;}
