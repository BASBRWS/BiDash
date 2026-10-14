import {OPEN_FAULT_TYPES,OPEN_OPERATIONAL_STATUSES,filterOpenFaults,formatFaultDuration,buildOpenFaultMemo} from './open-fault-view.js';
import {applyQuery} from './query-filter.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hmFormat=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:3}),impactFormat=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1}),countFormat=new Intl.NumberFormat('nl-NL');
const fmtHm=v=>Number.isFinite(Number(v))?hmFormat.format(Number(v)):'';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
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
  let revision=0,snapshot=null,pending=null,selection=null,renderTicket=0,faultPage=0,renderTimer;
  const pageSize=60;
  const visible=()=>{const main=doc.getElementById('faults');return !!main&&!main.hidden;};
  function filters(){return {query:doc.getElementById('faultSearch')?.value||'',vc:doc.getElementById('faultVc')?.value||'',type:doc.getElementById('faultType')?.value||'',status:doc.getElementById('faultOperationalStatus')?.value||'',wind:!!doc.getElementById('faultWind')?.checked,ria4:!!doc.getElementById('faultRia4')?.checked};}
  async function build(version){
    const current=()=>version===revision&&visible();
    const all=(scope.HUB?.faultsAsync?await scope.HUB.faultsAsync({isCurrent:current}):scope.HUB?.faults?.())||[];
    if(!current())return null;
    const codes=new Map(),vcs=new Set(),rows=[];
    for(let i=0;i<all.length;i++){
      const fault=all[i];if(fault.vc)vcs.add(fault.vc);
      if(fault.assetKey&&fault.code){if(!codes.has(fault.assetKey))codes.set(fault.assetKey,new Set());codes.get(fault.assetKey).add(String(fault.code));}
      if((i+1)%512===0){await pause();if(!current())return null;}
    }
    for(let i=0;i<all.length;i++){
      rows.push({...all[i],assetFaultCodes:[...(codes.get(all[i].assetKey)||[])]});
      if((i+1)%512===0){await pause();if(!current())return null;}
    }
    if(!current())return null;
    snapshot={rows,vcs:[...vcs].sort(),revision:version};return snapshot;
  }
  function data(){
    if(snapshot)return Promise.resolve(snapshot);
    if(!pending){const version=revision;pending=build(version).finally(()=>{if(version===revision)pending=null;});}
    return pending;
  }
  async function filtered(source,isCurrent=()=>true){
    if(!source)return null;
    const f=filters(),query=doc.__bidashQueries?.faults,key=JSON.stringify([f,query]);
    if(selection?.source===source&&selection.key===key)return selection.rows;
    const rows=[];
    for(let i=0;i<source.rows.length;i+=512){
      const part=filterOpenFaults(source.rows.slice(i,i+512),f);
      for(const row of applyQuery(part,query,FAULT_QUERY_FIELDS))rows.push(row);
      await pause();if(source.revision!==revision||!isCurrent())return null;
    }
    selection={source,key,rows};return rows;
  }
  function schedule({resetPage=false,debounce=0}={}){
    renderTicket++;clearTimeout(renderTimer);if(resetPage)faultPage=0;
    if(!visible())return;
    doc.getElementById('faultTable')?.setAttribute('aria-busy','true');
    const count=doc.getElementById('faultCount');if(count)count.textContent='Storingslijst bijwerken…';
    renderTimer=setTimeout(render,debounce);
  }
  function invalidate(){revision++;snapshot=null;pending=null;selection=null;schedule({resetPage:true});}
  // Eén eigenaar voor deze tabel. De schil vraagt een render aan en bouwt geen tweede lijst.
  doc.__bidashRenderOpenFaults=schedule;

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
      const el=doc.getElementById(id);if(el&&!el.dataset.bidashFaultFilter){el.dataset.bidashFaultFilter='1';el.addEventListener('change',()=>schedule({resetPage:true}));}
    }

    const heading=main.querySelector('.section-heading');
    if(heading&&!doc.getElementById('faultMemo')){
      const btn=doc.createElement('button');btn.id='faultMemo';btn.className='primary';btn.textContent='Memo huidige selectie';btn.addEventListener('click',openMemo);heading.append(btn);
    }
    if(!doc.getElementById('faultFilterSummary')){
      const p=doc.createElement('p');p.id='faultFilterSummary';p.className='muted fault-filter-summary';row.insertAdjacentElement('afterend',p);
    }
    if(!doc.getElementById('faultCount')){
      const pager=doc.createElement('div');pager.className='pager';pager.innerHTML='<span id="faultCount" role="status"></span><div><button id="faultPrev">← Vorige</button><button id="faultNext">Volgende →</button></div>';
      doc.getElementById('faultTable')?.insertAdjacentElement('afterend',pager);
      doc.getElementById('faultPrev').onclick=()=>{faultPage--;schedule();};
      doc.getElementById('faultNext').onclick=()=>{faultPage++;schedule();};
    }
    if(!doc.getElementById('faultMemoDialog')){
      const dialog=doc.createElement('dialog');dialog.id='faultMemoDialog';dialog.innerHTML='<div class="dialog-heading"><h2>Memo open storingen</h2><button id="faultMemoClose" aria-label="Sluiten">✕</button></div><div id="faultMemoBody"></div><div class="fault-memo-actions"><button id="faultMemoCopy">Kopieer memo</button><button id="faultMemoPrint" class="primary">Afdrukken / PDF</button></div>';
      doc.body.append(dialog);doc.getElementById('faultMemoClose').onclick=()=>dialog.close();doc.getElementById('faultMemoCopy').onclick=copyMemo;doc.getElementById('faultMemoPrint').onclick=()=>scope.parent.print();
    }
    return true;
  }

  async function render(){
    if(!visible()||!ensure())return;
    const ticket=++renderTicket,current=()=>ticket===renderTicket&&visible(),table=doc.getElementById('faultTable');
    if(!table)return;table.setAttribute('aria-busy','true');
    doc.getElementById('faultCount').textContent='Storingslijst bijwerken…';
    doc.getElementById('faultPrev').disabled=true;doc.getElementById('faultNext').disabled=true;
    try{
      const source=await data();if(!source||!current())return;
      const vc=doc.getElementById('faultVc');if(vc){const selected=vc.value;vc.innerHTML='<option value="">Alle centrales</option>'+source.vcs.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');vc.value=selected;}
      const rows=await filtered(source,current);if(!rows||!current())return;
      faultPage=Math.max(0,Math.min(faultPage,Math.max(0,Math.ceil(rows.length/pageSize)-1)));
      const f=filters(),special=[f.wind?'windwaarschuwing':'',f.ria4?'RIA4':''].filter(Boolean).join(' + ');
      const summary=doc.getElementById('faultFilterSummary');if(summary)summary.textContent=`${countFormat.format(rows.length)} van ${countFormat.format(source.rows.length)} open storingen zichtbaar${f.type?' · '+typeLabel(f.type):''}${f.status?' · '+f.status:''}${special?' · '+special:''}.`;
      table.innerHTML=rows.length?`<table><thead><tr><th>Asset / melding</th><th>Type</th><th>Status</th><th>Locatie</th><th>VC</th><th>Beheerder</th><th>Duur</th><th>Code</th><th>Impact</th></tr></thead><tbody>${rows.slice(faultPage*pageSize,(faultPage+1)*pageSize).map(m=>{
        const cat=tags(m);return `<tr><td>${m.assetKey?`<button data-asset="${esc(m.assetKey)}" data-source="DVM">${esc(m.naam||m.assetKey)}</button>`:esc(m.naam||'Niet gekoppeld')}<br><small class="muted">${esc(m.omschrijving||'')}</small>${cat.length?`<br><small>${cat.map(x=>`<span class="pill">${esc(x)}</span>`).join(' ')}</small>`:''}</td><td>${esc(typeLabel(m.typeId))}</td><td>${esc(m.operationeleStatus||'Operationeel')}</td><td>${esc(locationLabel(m))}</td><td>${esc(m.vc||'Onbekend')}</td><td>${esc(m.rd||'Onbekend')}</td><td>${esc(formatFaultDuration(m.duurUren))}${m.duurBetrouwbaar===false?'<br><small>Duur onzeker</small>':''}</td><td>${esc(m.code||'—')}</td><td>${m.impact!=null&&m.impact!==''&&Number.isFinite(Number(m.impact))?impactFormat.format(Number(m.impact))+'%':'Niet doorgerekend'}</td></tr>`;
      }).join('')}</tbody></table>`:'<div class="empty"><b>Geen open storingen in deze selectie.</b>Pas het assettype, de status, speciale DRIP-selectie, VC of zoekterm aan.</div>';
      doc.getElementById('faultCount').textContent=`${countFormat.format(rows.length)} resultaten · pagina ${faultPage+1} van ${Math.max(1,Math.ceil(rows.length/pageSize))}`;
      doc.getElementById('faultPrev').disabled=faultPage===0;doc.getElementById('faultNext').disabled=(faultPage+1)*pageSize>=rows.length;
    }catch(error){if(current()){doc.getElementById('faultCount').textContent='Storingslijst kon niet worden bijgewerkt.';console.error(error);}}
    finally{if(ticket===renderTicket)table.setAttribute('aria-busy','false');}
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
  async function openMemo(){
    const d=doc.getElementById('faultMemoDialog'),body=doc.getElementById('faultMemoBody');if(!d||!body)return;
    let peildatum=null;try{peildatum=scope.HUB?.summary?.()?.peildatum||null;}catch(e){}
    const rows=await filtered(await data());if(!rows)return;
    const m=buildOpenFaultMemo(rows,{peildatum});d.__memo=m;body.innerHTML=memoHtml(m);d.showModal();
  }
  async function copyMemo(){
    const d=doc.getElementById('faultMemoDialog'),m=d?.__memo;if(!m)return;const text=memoText(m);
    try{await scope.parent.navigator.clipboard.writeText(text);}catch(e){const ta=doc.createElement('textarea');ta.value=text;doc.body.append(ta);ta.select();doc.execCommand('copy');ta.remove();}
    const b=doc.getElementById('faultMemoCopy');if(b){const oud=b.textContent;b.textContent='Gekopieerd';setTimeout(()=>b.textContent=oud,1200);}
  }

  const start=()=>{
    ensure();schedule();
    const main=doc.getElementById('faults');
    if(main)new MutationObserver(()=>schedule()).observe(main,{attributes:true,attributeFilter:['hidden']});
    scope.addEventListener('bidash:faults-extension-ready',invalidate);
    scope.parent.addEventListener('hashchange',()=>schedule());
    scope.parent.addEventListener('popstate',()=>schedule());
  };
  doc.addEventListener('bidash:data-change',invalidate);
  doc.addEventListener('bidash:query-change',event=>{if(event.detail?.type==='faults')schedule({resetPage:true,debounce:event.detail?.debounce||0});});
  if(scope.document.readyState==='complete')start();else scope.addEventListener('load',start,{once:true});
  return true;
}
