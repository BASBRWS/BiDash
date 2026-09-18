import {OPEN_FAULT_TYPES,OPEN_OPERATIONAL_STATUSES,filterOpenFaults,formatFaultDuration,buildOpenFaultMemo} from './open-fault-view.js';
import {applyQuery} from './query-filter.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtHm=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('nl-NL',{maximumFractionDigits:3}):'';
const fmtDate=v=>{if(!v)return 'Onbekend';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('nl-NL'):'Onbekend';};
const FAULT_QUERY_FIELDS=[
  {key:'naam'},{key:'assetKey'},{key:'typeId'},{key:'code'},{key:'assetFaultCodes'},
  {key:'weg'},{key:'richting'},{key:'hm',type:'number'},{key:'vc'},{key:'rd'},
  {key:'operationeleStatus'},{key:'impact',type:'number'},{key:'duurUren',type:'number'},{key:'rekenStatus'},{key:'omschrijving'}
];

function typeLabel(type){return OPEN_FAULT_TYPES.find(([v])=>v===String(type||'').toUpperCase())?.[1]||type||'Onbekend';}
function locationLabel(f){return [f.weg||'',f.richting||'',f.hm!=null&&f.hm!==''?'hm '+fmtHm(f.hm):''].filter(Boolean).join(' ')||'Locatie onbekend';}
function tags(f){const a=[];if(f.wind||f.windwaarschuwing)a.push('Windwaarschuwing');if(f.ria4)a.push('RIA4');return a;}

export function installOpenFaultParentUi(scope=globalThis){
  if(!scope||!scope.document||scope.parent===scope)return false;
  let doc;try{doc=scope.parent.document;}catch(e){return false;}
  if(doc.__bidashOpenFaultUiInstalled)return true;
  doc.__bidashOpenFaultUiInstalled=true;
  let drawing=false,scheduled=false;

  function faults(){try{return scope.HUB?.faults?.()||[];}catch(e){return [];}}
  function filters(){return {query:doc.getElementById('faultSearch')?.value||'',vc:doc.getElementById('faultVc')?.value||'',type:doc.getElementById('faultType')?.value||'',status:doc.getElementById('faultOperationalStatus')?.value||'',wind:!!doc.getElementById('faultWind')?.checked,ria4:!!doc.getElementById('faultRia4')?.checked};}
  function filtered(){
    const base=filterOpenFaults(faults(),filters()),codes=new Map();
    for(const fault of faults()){if(!fault.assetKey||!fault.code)continue;const set=codes.get(fault.assetKey)||new Set();set.add(String(fault.code));codes.set(fault.assetKey,set);}
    const enriched=base.map(fault=>({...fault,assetFaultCodes:[...(codes.get(fault.assetKey)||[])]}));
    return applyQuery(enriched,doc.__bidashQueries?.faults,FAULT_QUERY_FIELDS);
  }
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;ensure();render();},0);}

  function selectControl(id,labelText,options){
    const label=doc.createElement('label');label.textContent=labelText;
    const sel=doc.createElement('select');sel.id=id;sel.innerHTML=options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');label.append(sel);return label;
  }
  function checkControl(id,labelText){const label=doc.createElement('label');label.className='check';label.innerHTML=`<input type="checkbox" id="${esc(id)}"> ${esc(labelText)}`;return label;}

  function ensure(){
    const main=doc.getElementById('faults'),row=main?.querySelector('.filter-row');if(!row)return false;
    if(!doc.getElementById('faultType'))row.append(selectControl('faultType','Assettype',OPEN_FAULT_TYPES));
    if(!doc.getElementById('faultOperationalStatus'))row.append(selectControl('faultOperationalStatus','Operationele status',OPEN_OPERATIONAL_STATUSES));
    if(!doc.getElementById('faultWind'))row.append(checkControl('faultWind','Alleen DRIP windwaarschuwing'));
    if(!doc.getElementById('faultRia4'))row.append(checkControl('faultRia4','Alleen DRIP RIA4'));
    for(const id of ['faultType','faultOperationalStatus','faultWind','faultRia4']){
      const el=doc.getElementById(id);if(el&&!el.dataset.bidashFaultFilter){el.dataset.bidashFaultFilter='1';el.addEventListener('change',render);}
    }
    const search=doc.getElementById('faultSearch');if(search&&!search.dataset.bidashFaultFilter){search.dataset.bidashFaultFilter='1';search.addEventListener('input',render);}
    const vc=doc.getElementById('faultVc');if(vc&&!vc.dataset.bidashFaultFilter){vc.dataset.bidashFaultFilter='1';vc.addEventListener('change',render);}

    const heading=main.querySelector('.section-heading');
    if(heading&&!doc.getElementById('faultMemo')){
      const btn=doc.createElement('button');btn.id='faultMemo';btn.className='primary';btn.textContent='Memo huidige selectie';btn.addEventListener('click',openMemo);heading.append(btn);
    }
    if(!doc.getElementById('faultFilterSummary')){
      const p=doc.createElement('p');p.id='faultFilterSummary';p.className='muted';p.style.margin='8px 0';row.insertAdjacentElement('afterend',p);
    }
    if(!doc.getElementById('faultMemoDialog')){
      const dialog=doc.createElement('dialog');dialog.id='faultMemoDialog';dialog.innerHTML='<div class="dialog-heading"><h2>Memo open storingen</h2><button id="faultMemoClose" aria-label="Sluiten">✕</button></div><div id="faultMemoBody"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button id="faultMemoCopy">Kopieer memo</button><button id="faultMemoPrint" class="primary">Afdrukken / PDF</button></div>';
      doc.body.append(dialog);doc.getElementById('faultMemoClose').onclick=()=>dialog.close();doc.getElementById('faultMemoCopy').onclick=copyMemo;doc.getElementById('faultMemoPrint').onclick=()=>scope.parent.print();
    }
    return true;
  }

  function render(){
    if(drawing||!ensure())return;drawing=true;
    try{
      const all=faults(),rows=filtered(),table=doc.getElementById('faultTable');if(!table)return;
      const f=filters(),special=[f.wind?'windwaarschuwing':'',f.ria4?'RIA4':''].filter(Boolean).join(' + ');
      const summary=doc.getElementById('faultFilterSummary');if(summary)summary.textContent=`${rows.length.toLocaleString('nl-NL')} van ${all.length.toLocaleString('nl-NL')} open storingen zichtbaar${f.type?' · '+typeLabel(f.type):''}${f.status?' · '+f.status:''}${special?' · '+special:''}.`;
      const html=rows.length?`<table><thead><tr><th>Asset / melding</th><th>Type</th><th>Status</th><th>Locatie</th><th>VC</th><th>Beheerder</th><th>Duur</th><th>Code</th><th>Impact</th></tr></thead><tbody>${rows.map(m=>{
        const cat=tags(m);return `<tr><td>${m.assetKey?`<button data-asset="${esc(m.assetKey)}" data-source="DVM">${esc(m.naam||m.assetKey)}</button>`:esc(m.naam||'Niet gekoppeld')}<br><small class="muted">${esc(m.omschrijving||'')}</small>${cat.length?`<br><small>${cat.map(x=>`<span class="pill">${esc(x)}</span>`).join(' ')}</small>`:''}</td><td>${esc(typeLabel(m.typeId))}</td><td>${esc(m.operationeleStatus||'Operationeel')}</td><td>${esc(locationLabel(m))}</td><td>${esc(m.vc||'Onbekend')}</td><td>${esc(m.rd||'Onbekend')}</td><td>${esc(formatFaultDuration(m.duurUren))}${m.duurBetrouwbaar===false?'<br><small>Duur onzeker</small>':''}</td><td>${esc(m.code||'—')}</td><td>${m.impact!=null&&m.impact!==''&&Number.isFinite(Number(m.impact))?Number(m.impact).toLocaleString('nl-NL',{maximumFractionDigits:1})+'%':'Niet doorgerekend'}</td></tr>`;
      }).join('')}</tbody></table>`:'<div class="empty"><b>Geen open storingen in deze selectie.</b>Pas het assettype, de status, speciale DRIP-selectie, VC of zoekterm aan.</div>';
      if(table.innerHTML!==html)table.innerHTML=html;
    }finally{drawing=false;}
  }

  function memoText(m){
    const lines=[`Memo open storingen`,`Peildatum: ${fmtDate(m.peildatum)}`,`Gegenereerd: ${fmtDate(m.created)}`,`Selectie: ${m.total} open storingen`,`Per assettype: ${m.byType.map(([k,n])=>`${typeLabel(k)} ${n}`).join(', ')||'geen'}`,`Per operationele status: ${m.byStatus.map(([k,n])=>`${k} ${n}`).join(', ')||'geen'}`,`Windwaarschuwing DRIP: ${m.wind}`,`RIA4 DRIP: ${m.ria4}`,`Gemiddelde duur: ${formatFaultDuration(m.averageDurationHours)}`,`Langste open duur: ${formatFaultDuration(m.oldestDurationHours)}`,'','Storingen:'];
    m.rows.forEach((r,i)=>lines.push(`${i+1}. ${r.naam||'Onbekend'}; ${typeLabel(r.typeId)}; ${r.operationeleStatus||'Operationeel'}; ${locationLabel(r)}; VC ${r.vc||'onbekend'}; beheerder ${r.rd||'onbekend'}; duur ${formatFaultDuration(r.duurUren)}; ${r.omschrijving||''}${tags(r).length?' ['+tags(r).join(', ')+']':''}`));
    return lines.join('\n');
  }
  function memoHtml(m){
    const typeRows=m.byType.map(([k,n])=>`<li><b>${esc(typeLabel(k))}</b>: ${n}</li>`).join('');
    const statusRows=m.byStatus.map(([k,n])=>`<li><b>${esc(k)}</b>: ${n}</li>`).join('');
    return `<p class="muted">Peildatum ${esc(fmtDate(m.peildatum))}. De memo volgt de filters die op het tabblad Open storingen actief zijn.</p><div class="cards compact"><div class="card">Open storingen<strong>${m.total}</strong><small>huidige selectie</small></div><div class="card">Gemiddelde duur<strong>${esc(formatFaultDuration(m.averageDurationHours))}</strong><small>waar duur bekend is</small></div><div class="card">Langste duur<strong>${esc(formatFaultDuration(m.oldestDurationHours))}</strong><small>openstaand in selectie</small></div><div class="card">Speciale DRIP<strong>${m.wind+m.ria4}</strong><small>${m.wind} wind · ${m.ria4} RIA4</small></div></div><h3>Samenvatting</h3><ul>${typeRows||'<li>Geen storingen.</li>'}</ul><h4>Operationele status</h4><ul>${statusRows||'<li>Geen status.</li>'}</ul><p><b>Verkeerscentrales:</b> ${esc(m.byVc.map(([k,n])=>`${k} (${n})`).join(', ')||'Onbekend')}</p><p><b>Regionale beheerders:</b> ${esc(m.byRd.map(([k,n])=>`${k} (${n})`).join(', ')||'Onbekend')}</p><h3>Open storingen</h3><div class="table-scroll"><table><thead><tr><th>Naam</th><th>Type</th><th>Status</th><th>Locatie</th><th>VC</th><th>Beheerder</th><th>Duur</th><th>Duiding</th></tr></thead><tbody>${m.rows.map(r=>`<tr><td><b>${esc(r.naam||'Onbekend')}</b>${tags(r).length?`<br><small>${esc(tags(r).join(' · '))}</small>`:''}</td><td>${esc(typeLabel(r.typeId))}</td><td>${esc(r.operationeleStatus||'Operationeel')}</td><td>${esc(locationLabel(r))}</td><td>${esc(r.vc||'Onbekend')}</td><td>${esc(r.rd||'Onbekend')}</td><td>${esc(formatFaultDuration(r.duurUren))}</td><td>${esc(r.omschrijving||'')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function openMemo(){
    const d=doc.getElementById('faultMemoDialog'),body=doc.getElementById('faultMemoBody');if(!d||!body)return;
    let peildatum=null;try{peildatum=scope.HUB?.summary?.()?.peildatum||null;}catch(e){}
    const m=buildOpenFaultMemo(filtered(),{peildatum});d.__memo=m;body.innerHTML=memoHtml(m);d.showModal();
  }
  async function copyMemo(){
    const d=doc.getElementById('faultMemoDialog'),m=d?.__memo;if(!m)return;const text=memoText(m);
    try{await scope.parent.navigator.clipboard.writeText(text);}catch(e){const ta=doc.createElement('textarea');ta.value=text;doc.body.append(ta);ta.select();doc.execCommand('copy');ta.remove();}
    const b=doc.getElementById('faultMemoCopy');if(b){const oud=b.textContent;b.textContent='Gekopieerd';setTimeout(()=>b.textContent=oud,1200);}
  }

  const start=()=>{
    ensure();render();
    const table=doc.getElementById('faultTable');if(table)new MutationObserver(()=>schedule()).observe(table,{childList:true,subtree:true});
    scope.addEventListener('bidash:faults-extension-ready',schedule);
    scope.parent.addEventListener('hashchange',schedule);
    scope.parent.addEventListener('popstate',schedule);
  };
  doc.addEventListener('bidash:query-change',event=>{if(event.detail?.type==='faults')schedule();});
  if(scope.document.readyState==='complete')start();else scope.addEventListener('load',start,{once:true});
  return true;
}
