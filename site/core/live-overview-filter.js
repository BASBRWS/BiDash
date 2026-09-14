const EMPTY_FILTER_VALUE='__LEEG__';

export const LIVE_FILTER_FIELDS=Object.freeze([
  {key:'storingType',label:'Storingstype / foutregel'},
  {key:'gevolg',label:'Gevolg'},
  {key:'noodmaatregel',label:'Noodmaatregel'},
  {key:'assetType',label:'Assettype'},
  {key:'oorzaak',label:'Oorzaak'},
  {key:'prioriteit',label:'Prioriteit / ernst'},
  {key:'vc',label:'Verkeerscentrale'},
  {key:'rd',label:'Regionale dienst'},
  {key:'district',label:'District'},
  {key:'weg',label:'Weg'}
]);

export {EMPTY_FILTER_VALUE};

export function liveFilterValueKey(value){
  const text=String(value==null?'':value).trim().replace(/\s+/g,' ');
  if(!text)return EMPTY_FILTER_VALUE;
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}

export function normalizeLiveOverviewFilter(config){
  const source=config&&typeof config==='object'&&!Array.isArray(config)?config:{};
  const excludedSource=source.excluded&&typeof source.excluded==='object'&&!Array.isArray(source.excluded)?source.excluded:{};
  const excluded={};
  for(const field of LIVE_FILTER_FIELDS){
    const values=Array.isArray(excludedSource[field.key])?excludedSource[field.key]:[];
    excluded[field.key]=[...new Set(values.map(liveFilterValueKey).filter(Boolean))].sort();
  }
  return {version:1,excluded};
}

export function liveFilterActiveCount(config){
  const c=normalizeLiveOverviewFilter(config);
  return LIVE_FILTER_FIELDS.reduce((sum,field)=>sum+c.excluded[field.key].length,0);
}

export function liveFilterSignature(config){
  return LIVE_FILTER_FIELDS.map(field=>field.key+':'+normalizeLiveOverviewFilter(config).excluded[field.key].join(',')).join('|');
}

export function rowMatchesLiveOverviewFilter(row,config){
  const c=normalizeLiveOverviewFilter(config);
  for(const field of LIVE_FILTER_FIELDS){
    const excluded=new Set(c.excluded[field.key]);
    if(excluded.has(liveFilterValueKey(row&&row[field.key])))return false;
  }
  return true;
}

export function collectLiveFilterFacets(rows){
  const result=Object.fromEntries(LIVE_FILTER_FIELDS.map(field=>[field.key,[]]));
  for(const field of LIVE_FILTER_FIELDS){
    const map=new Map();
    for(const row of rows||[]){
      const raw=row&&row[field.key];
      const key=liveFilterValueKey(raw);
      const current=map.get(key)||{key,label:key===EMPTY_FILTER_VALUE?'(geen waarde)':String(raw??'').trim()||'(geen waarde)',count:0};
      current.count++;
      if(current.label==='(geen waarde)'&&key!==EMPTY_FILTER_VALUE)current.label=String(raw??'').trim()||'(geen waarde)';
      map.set(key,current);
    }
    result[field.key]=[...map.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'nl'));
  }
  return result;
}

export function summarizeLiveOverviewFilter(rows,config){
  const list=rows||[];
  let included=0;
  for(const row of list)if(rowMatchesLiveOverviewFilter(row,config))included++;
  return {total:list.length,included,excluded:list.length-included,active:liveFilterActiveCount(config)};
}

const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_LIVE_OVERVIEW_FILTER_ACTIVE__)return;
  const H=globalThis.__BIDASH_LIVE_OVERVIEW_FILTER_HELPERS__;
  if(!H||typeof RULES==='undefined'||typeof doorrekenen!=='function'||typeof normRij!=='function'||typeof gecombineerdeLiveStoringsRijen!=='function')return;

  const EXTRA_COLUMNS=[
    'storingstype','storingssoort','type_storing','type storing','soort_storing','soort storing','categorie','storingscategorie','fouttype','foutsoort','meldingtype','subcategorie',
    'oorzaak','oorzaakcode','cause','cause_code','prioriteit','priority','urgentie','severity','ernst','kriticiteit',
    'maatregel','mitigatie','tijdelijke_maatregel','tijdelijke maatregel'
  ];
  try{if(typeof STORINGS_KOLOMMEN_LICHT!=='undefined'&&STORINGS_KOLOMMEN_LICHT&&STORINGS_KOLOMMEN_LICHT.add)EXTRA_COLUMNS.forEach(k=>STORINGS_KOLOMMEN_LICHT.add(k));}catch(e){}

  const FACET_LABELS=Object.fromEntries(H.LIVE_FILTER_FIELDS.map(f=>[f.key,f.label]));
  const rawValue=(raw,names)=>{
    const wanted=new Set(names.map(x=>String(x).toLowerCase().replace(/[\s_-]+/g,'')));
    for(const [key,value] of Object.entries(raw||{}))if(wanted.has(String(key).toLowerCase().replace(/[\s_-]+/g,'')))return String(value==null?'':value).trim();
    return '';
  };
  const facetCache=new WeakMap();
  function facetRow(raw){
    if(raw&&typeof raw==='object'&&facetCache.has(raw))return facetCache.get(raw);
    const m=normRij(raw||{}),typeId=classificeer(m)||'';
    let rule=null;try{rule=typeId?foutregel(m,typeId):null;}catch(e){}
    const explicitType=rawValue(raw,['storingstype','storingssoort','type_storing','type storing','soort_storing','soort storing','categorie','storingscategorie','fouttype','foutsoort','meldingtype','subcategorie']);
    const storingType=explicitType||(rule?[rule.code,rule.oms||rule.patroon].filter(Boolean).join(' · '):'')||m.melding||'';
    const row={
      storingType,
      gevolg:m.gevolg||'',
      noodmaatregel:m.noodmaatregel||rawValue(raw,['maatregel','mitigatie','tijdelijke_maatregel','tijdelijke maatregel']),
      assetType:typeId,
      oorzaak:rawValue(raw,['oorzaak','oorzaakcode','cause','cause_code']),
      prioriteit:rawValue(raw,['prioriteit','priority','urgentie','severity','ernst','kriticiteit'])||(rule&&rule.severity)||'',
      vc:m.vc||'',rd:m.rd||'',district:m.district||'',weg:m.weg||''
    };
    if(raw&&typeof raw==='object')facetCache.set(raw,row);
    return row;
  }
  function currentConfig(){
    RULES.cfg=RULES.cfg||{};
    RULES.cfg.liveOverviewFilter=H.normalizeLiveOverviewFilter(RULES.cfg.liveOverviewFilter);
    return RULES.cfg.liveOverviewFilter;
  }
  function fullRows(){return gecombineerdeLiveStoringsRijen().slice();}
  function facetRows(){return fullRows().map(facetRow);}
  function stats(config){return H.summarizeLiveOverviewFilter(facetRows(),config||currentConfig());}

  const originalDoorrekenen=doorrekenen;
  doorrekenen=function(rijenRaw,opties){
    if(!opties||!opties.actueel)return originalDoorrekenen.apply(this,arguments);
    const cfg=currentConfig(),source=Array.isArray(rijenRaw)?rijenRaw:[];
    const filtered=source.filter(raw=>H.rowMatchesLiveOverviewFilter(facetRow(raw),cfg));
    const result=originalDoorrekenen.call(this,filtered,opties);
    result.liveFilter={...stats(cfg),config:cfg};
    return result;
  };

  if(typeof analyseSignatuur==='function'){
    const originalAnalyseSignatuur=analyseSignatuur;
    analyseSignatuur=function(){return originalAnalyseSignatuur.apply(this,arguments)+'|liveFilter:'+H.liveFilterSignature(currentConfig());};
  }

  function escText(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function formConfig(card){
    const base=currentConfig(),next=H.normalizeLiveOverviewFilter(base),facets=H.collectLiveFilterFacets(facetRows());
    for(const field of H.LIVE_FILTER_FIELDS){
      const visibleKeys=new Set((facets[field.key]||[]).map(v=>v.key));
      const excluded=(next.excluded[field.key]||[]).filter(key=>!visibleKeys.has(key));
      card.querySelectorAll('input[data-live-filter-value][data-field="'+field.key+'"]').forEach(cb=>{if(!cb.checked)excluded.push(cb.dataset.value);});
      next.excluded[field.key]=[...new Set(excluded)].sort();
    }
    return H.normalizeLiveOverviewFilter(next);
  }
  function summaryHtml(s){
    return '<div class="live-filter-kpis"><span><b>'+s.total.toLocaleString('nl-NL')+'</b><small>open bronregels</small></span><span><b>'+s.included.toLocaleString('nl-NL')+'</b><small>tellen mee</small></span><span><b>'+s.excluded.toLocaleString('nl-NL')+'</b><small>uitgesloten</small></span><span><b>'+s.active.toLocaleString('nl-NL')+'</b><small>filterwaarden uit</small></span></div>';
  }
  function updatePreview(card){
    const host=card&&card.querySelector('[data-live-filter-summary]');if(!host)return;
    host.innerHTML=summaryHtml(stats(formConfig(card)));
  }
  function facetHtml(field,items,cfg){
    if(!items.length)return '';
    const excluded=new Set(cfg.excluded[field.key]||[]),search=items.length>12?'<input class="live-filter-search" data-filter-search="'+field.key+'" type="search" placeholder="Zoek binnen '+escText(field.label.toLowerCase())+'">':'';
    return '<details class="live-filter-facet" open><summary>'+escText(field.label)+' <span>'+items.length+' waarden</span></summary>'+search+'<div class="live-filter-facet-actions"><button type="button" data-field-all="'+field.key+'">Alles</button><button type="button" data-field-none="'+field.key+'">Niets</button></div><div class="live-filter-values" data-field-values="'+field.key+'">'+items.map(item=>'<label data-filter-label="'+escText(item.label.toLowerCase())+'"><input type="checkbox" data-live-filter-value data-field="'+field.key+'" data-value="'+escText(item.key)+'" '+(excluded.has(item.key)?'':'checked')+'><span>'+escText(item.label)+'</span><small>'+item.count.toLocaleString('nl-NL')+'</small></label>').join('')+'</div></details>';
  }
  function renderFilterCard(){
    const host=document.getElementById('tab-datasets');if(!host)return;
    host.querySelector('#liveOverviewFilterCard')?.remove();
    const rows=facetRows(),cfg=currentConfig(),facets=H.collectLiveFilterFacets(rows),s=stats(cfg);
    const card=document.createElement('div');card.id='liveOverviewFilterCard';card.className='card live-filter-card';
    card.innerHTML='<h3>Filter actuele storingen voor het overzicht <span class="badge">DVM live</span></h3><p class="live-filter-intro">Bepaal welke regels uit de geladen open-storingenmomentopname meetellen in het actuele overzicht, de dienstimpact en de verkeerskosten. <b>De bronlijst zelf blijft volledig.</b> De A↔B-vergelijking en automatische historisering van verdwenen MSI-storingen gebruiken altijd de volledige momentopname.</p><div data-live-filter-summary>'+summaryHtml(s)+'</div>'+(rows.length?'<div class="live-filter-grid">'+H.LIVE_FILTER_FIELDS.map(field=>facetHtml(field,facets[field.key]||[],cfg)).join('')+'</div><div class="live-filter-actions"><button type="button" class="tb-btn primary" data-live-filter-apply>Toepassen en overzicht openen</button><button type="button" class="tb-btn" data-live-filter-reset>Alles meetellen</button></div>':'<div class="data-missing">Laad eerst een actuele open-storingenlijst. Daarna verschijnen hier de waarden die in jouw bestand voorkomen.</div>');
    const grid=host.querySelector('.dataset-grid');if(grid)grid.before(card);else host.appendChild(card);
    card.querySelectorAll('[data-live-filter-value]').forEach(cb=>cb.addEventListener('change',()=>updatePreview(card)));
    card.querySelectorAll('[data-field-all]').forEach(btn=>btn.addEventListener('click',()=>{card.querySelectorAll('input[data-live-filter-value][data-field="'+btn.dataset.fieldAll+'"]').forEach(cb=>cb.checked=true);updatePreview(card);}));
    card.querySelectorAll('[data-field-none]').forEach(btn=>btn.addEventListener('click',()=>{card.querySelectorAll('input[data-live-filter-value][data-field="'+btn.dataset.fieldNone+'"]').forEach(cb=>cb.checked=false);updatePreview(card);}));
    card.querySelectorAll('[data-filter-search]').forEach(inp=>inp.addEventListener('input',()=>{const q=inp.value.trim().toLowerCase();card.querySelectorAll('[data-field-values="'+inp.dataset.filterSearch+'"] label').forEach(label=>label.hidden=!!q&&!String(label.dataset.filterLabel||'').includes(q));}));
    card.querySelector('[data-live-filter-apply]')?.addEventListener('click',()=>setConfig(formConfig(card),true));
    card.querySelector('[data-live-filter-reset]')?.addEventListener('click',()=>setConfig({version:1,excluded:{}},true));
  }
  function renderOverviewNotice(){
    const host=document.getElementById('tab-overzicht');if(!host)return;
    host.querySelector('#liveOverviewFilterNotice')?.remove();
    if(!LIVE_STORINGSBRONNEN.length)return;
    const s=stats(currentConfig()),notice=document.createElement('div');notice.id='liveOverviewFilterNotice';notice.className='live-filter-notice '+(s.active?'active':'');
    notice.innerHTML='<div><b>Storingsfilter'+(s.active?' actief':'')+'</b><span>'+(s.active?(s.included.toLocaleString('nl-NL')+' van '+s.total.toLocaleString('nl-NL')+' open meldingen tellen mee; '+s.excluded.toLocaleString('nl-NL')+' uitgesloten.'):'Alle '+s.total.toLocaleString('nl-NL')+' open meldingen tellen mee.')+'</span></div><button type="button" class="tb-btn" data-live-filter-open>Filter instellen / wijzigen</button>';
    host.prepend(notice);notice.querySelector('[data-live-filter-open]')?.addEventListener('click',openFilter);
  }
  function emitChanged(){try{document.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}}
  function setConfig(config,openOverview){
    RULES.cfg=RULES.cfg||{};RULES.cfg.liveOverviewFilter=H.normalizeLiveOverviewFilter(config);
    if(typeof ANALYSE_SIGNATURE!=='undefined')ANALYSE_SIGNATURE='';
    if(typeof MC_RESULT!=='undefined')MC_RESULT=null;if(typeof DRIP_MC!=='undefined')DRIP_MC=null;
    if(typeof probeerAnalyseActiveren==='function')probeerAnalyseActiveren(openOverview?'overzicht':'datasets',{inspectieAlGereed:true,matchAlGereed:true});
    renderOverviewNotice();emitChanged();
  }
  function openFilter(){
    if(typeof toonTab==='function')toonTab('datasets');
    if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();else renderFilterCard();
    setTimeout(()=>document.getElementById('liveOverviewFilterCard')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
  }

  if(typeof renderDatasetBeheer==='function'){
    const originalRenderDatasetBeheer=renderDatasetBeheer;
    renderDatasetBeheer=function(){const out=originalRenderDatasetBeheer.apply(this,arguments);renderFilterCard();return out;};
  }
  if(typeof renderAlles==='function'){
    const originalRenderAlles=renderAlles;
    renderAlles=function(){const out=originalRenderAlles.apply(this,arguments);renderOverviewNotice();return out;};
  }

  if(!document.getElementById('liveOverviewFilterStyles')){
    const style=document.createElement('style');style.id='liveOverviewFilterStyles';style.textContent='.live-filter-card{border-left:4px solid var(--rws-blauw)}.live-filter-intro{font-size:12px;color:var(--sub);line-height:1.55}.live-filter-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.live-filter-kpis span{border:1px solid var(--border);border-radius:6px;background:var(--panel);padding:10px}.live-filter-kpis b{display:block;font-size:20px;color:var(--rws-blauw)}.live-filter-kpis small{font-size:10.5px;color:var(--sub)}.live-filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.live-filter-facet{border:1px solid var(--border);border-radius:7px;background:var(--panel);padding:9px}.live-filter-facet summary{cursor:pointer;font-weight:800;color:var(--rws-blauw);font-size:12px}.live-filter-facet summary span{font-weight:400;color:var(--sub);margin-left:5px}.live-filter-search{width:100%;margin:8px 0 4px;padding:7px;border:1px solid var(--border);border-radius:5px}.live-filter-facet-actions{display:flex;gap:6px;margin:7px 0}.live-filter-facet-actions button{border:0;background:transparent;color:var(--rws-blauw);font-size:10.5px;font-weight:700;cursor:pointer;text-decoration:underline}.live-filter-values{max-height:220px;overflow:auto;border-top:1px solid var(--border)}.live-filter-values label{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:start;padding:6px 2px;border-bottom:1px solid #e8edf2;font-size:11px}.live-filter-values small{color:var(--sub);font-variant-numeric:tabular-nums}.live-filter-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.live-filter-notice{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;margin:0 0 14px;border:1px solid var(--border);border-left:4px solid var(--groen);background:#fff;border-radius:7px}.live-filter-notice.active{border-left-color:var(--rws-geel);background:var(--rws-geel-l)}.live-filter-notice b{display:block;color:var(--rws-blauw);font-size:12px}.live-filter-notice span{display:block;color:var(--sub);font-size:11px;margin-top:2px}@media(max-width:800px){.live-filter-grid{grid-template-columns:1fr}.live-filter-kpis{grid-template-columns:1fr 1fr}.live-filter-notice{align-items:flex-start;flex-direction:column}}';document.head.appendChild(style);
  }

  globalThis.DVM_LIVE_OVERVIEW_FILTER={get:()=>structuredClone(currentConfig()),set:c=>setConfig(c,false),reset:()=>setConfig({version:1,excluded:{}},false),preview:()=>stats(currentConfig()),facets:()=>H.collectLiveFilterFacets(facetRows()),open:openFilter};
  currentConfig();
  globalThis.__BIDASH_LIVE_OVERVIEW_FILTER_ACTIVE__=true;
  setTimeout(()=>{try{renderOverviewNotice();}catch(e){}},0);
})();`;

export function installDvmLiveOverviewFilterPatch(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_LIVE_OVERVIEW_FILTER_ACTIVE__)return true;
  scope.__BIDASH_LIVE_OVERVIEW_FILTER_HELPERS__={EMPTY_FILTER_VALUE,LIVE_FILTER_FIELDS,liveFilterValueKey,normalizeLiveOverviewFilter,liveFilterActiveCount,liveFilterSignature,rowMatchesLiveOverviewFilter,collectLiveFilterFacets,summarizeLiveOverviewFilter};
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_LIVE_OVERVIEW_FILTER_ACTIVE__;
  }catch(error){
    console.error('BiDash live-overzichtfilter kon niet worden gestart.',error);
    return false;
  }
}
