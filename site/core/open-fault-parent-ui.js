import {OPEN_FAULT_TYPES,filterOpenFaults,formatFaultDuration,buildOpenFaultMemo} from './open-fault-view.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtHm=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('nl-NL',{maximumFractionDigits:3}):'';
const fmtDate=v=>{if(!v)return 'Onbekend';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('nl-NL'):'Onbekend';};

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
  function filters(){return {query:doc.getElementById('faultSearch')?.value||'',vc:doc.getElementById('faultVc')?.value||'',type:doc.getElementById('faultType')?.value||'',wind:!!doc.getElementById('faultWind')?.checked,ria4:!!doc.getElementById('faultRia4')?.checked};}
  function filtered(){return filterOpenFaults(faults(),filters());}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;ensure();render();},0);}

  function ensure(){
    const main=doc.getElementById('faults'),row=main?.querySelector('.filter-row');if(!row)return false;
    if(!doc.getElementById('faultType')){
      const label=doc.createElement('label');label.textContent='Assettype';
      const sel=doc.createElement('select');sel.id='faultType';sel.innerHTML=OPEN_FAULT_TYPES.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');label.append(sel);row.append(label);
      const wind=doc.createElement('label');wind.className='check';wind.innerHTML='<input type="checkbox" id="faultWind"> Alleen DRIP windwaarschuwing';row.append(wind);
      const ria=doc.createElement('label');ria.className='check';ria.innerHTML='<input type="checkbox" id="faultRia4"> Alleen DRIP RIA4';row.append(ria);
      for(const id of ['faultType','faultWind','faultRia4'])doc.getElementById(id)?.addEventListener('change',render);
      doc.getElementById('faultSearch')?.addEventListener('input',render);
      doc.getElementById('faultVc')?.addEventListener('change',render);
    }
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
      const summary=doc.getElementById('faultFilterSummary');if(summary)summary.textContent=`${rows.length.toLocaleString('nl-NL')} van ${all.length.toLocaleString('nl-NL')} open storingen zichtbaar${f.type?' · '+typeLabel(f.type):''}${special?' · '+special:''}.`;
      const html=rows.length?`<table><thead><tr><th>Asset / melding</th><th>Type</th><th>Locatie</th><th>VC</th><th>Beheerder</th><th>Duur</th><th>Code</th><th>Impact</th></tr></thead><tbody>${rows.map(m=>{
        const cat=tags(m);return `<tr><td>${m.assetKey?`<button data-asset="${esc(m.assetKey)}" data-source="DVM">${esc(m.naam||m.assetKey)}</button>`:esc(m.naam||'Niet gekoppeld')}<br><small class="muted">${esc(m.omschrijving||'')}</small>${cat.length?`<br><small>${cat.map(x=>`<span class="pill">${esc(x)}</span>`).join(' ')}</small>`:''}</td><td>${esc(typeLabel(m.typeId))}</td><td>${esc(locationLabel(m))}</td><td>${esc(m.vc||'Onbekend')}</td><td>${esc(m.rd||'Onbekend')}</td><td>${esc(formatFaultDuration(m.duurUren))}</td><td>${esc(m.code||'—')}</td><td>${Number.isFinite(Number(m.impact))?Number(m.impact).toLocaleString('nl-NL',{maximumFractionDigits:1})+'%':'—'}</td></tr>`;
      }).join('')}</tbody></table>`:'<div class="empty"><b>Geen open storingen in deze selectie.</b>Pas het assettype, de speciale DRIP-selectie, VC of zoekterm aan.</div>';
      if(table.innerHTML!==html)table.innerHTML=html;
    }finally{drawing=false;}
  }

  function memoText(m){
    const lines=[`Memo open storingen`,`Peildatum: ${fmtDate(m.peildatum)}`,`Gegenereerd: ${fmtDate(m.created)}`,`Selectie: ${m.total} open storingen`,`Per assettype: ${m.byType.map(([k,n])=>`${typeLabel(k)} ${n}`).join(', ')||'geen'}`,`Windwaarschuwing DRIP: ${m.wind}`,`RIA4 DRIP: ${m.ria4}`,`Gemiddelde duur: ${formatFaultDuration(m.averageDurationHours)}`,`Langste open duur: ${formatFaultDuration(m.oldestDurationHours)}`,'','Storingen:'];
    m.rows.forEach((r,i)=>lines.push(`${i+1}. ${r.naam||'Onbekend'}; ${typeLabel(r.typeId)}; ${locationLabel(r)}; VC ${r.vc||'onbekend'}; beheerder ${r.rd||'onbekend'}; duur ${formatFaultDuration(r.duurUren)}; ${r.omschrijving||''}${tags(r).length?' ['+tags(r).join(', ')+']':''}`));
    return lines.join('\n');
  }
  function memoHtml(m){
    const typeRows=m.byType.map(([k,n])=>`<li><b>${esc(typeLabel(k))}</b>: ${n}</li>`).join('');
    return `<p class="muted">Peildatum ${esc(fmtDate(m.peildatum))}. De memo volgt de filters die op het tabblad Open storingen actief zijn.</p><div class="cards compact"><div class="card">Open storingen<strong>${m.total}</strong><small>huidige selectie</small></div><div class="card">Gemiddelde duur<strong>${esc(formatFaultDuration(m.averageDurationHours))}</strong><small>waar duur bekend is</small></div><div class="card">Langste duur<strong>${esc(formatFaultDuration(m.oldestDurationHours))}</strong><small>openstaand in selectie</small></div><div class="card">Speciale DRIP<strong>${m.wind+m.ria4}</strong><small>${m.wind} wind · ${m.ria4} RIA4</small></div></div><h3>Samenvatting</h3><ul>${typeRows||'<li>Geen storingen.</li>'}</ul><p><b>Verkeerscentrales:</b> ${esc(m.byVc.map(([k,n])=>`${k} (${n})`).join(', ')||'Onbekend')}</p><p><b>Regionale beheerders:</b> ${esc(m.byRd.map(([k,n])=>`${k} (${n})`).join(', ')||'Onbekend')}</p><h3>Open storingen</h3><div class="table-scroll"><table><thead><tr><th>Naam</th><th>Type</th><th>Locatie</th><th>VC</th><th>Beheerder</th><th>Duur</th><th>Duiding</th></tr></thead><tbody>${m.rows.map(r=>`<tr><td><b>${esc(r.naam||'Onbekend')}</b>${tags(r).length?`<br><small>${esc(tags(r).join(' · '))}</small>`:''}</td><td>${esc(typeLabel(r.typeId))}</td><td>${esc(locationLabel(r))}</td><td>${esc(r.vc||'Onbekend')}</td><td>${esc(r.rd||'Onbekend')}</td><td>${esc(formatFaultDuration(r.duurUren))}</td><td>${esc(r.omschrijving||'')}</td></tr>`).join('')}</tbody></table></div>`;
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
    scope.parent.addEventListener('hashchange',schedule);
    scope.parent.addEventListener('popstate',schedule);
  };
  if(scope.document.readyState==='complete')start();else scope.addEventListener('load',start,{once:true});
  return true;
}
