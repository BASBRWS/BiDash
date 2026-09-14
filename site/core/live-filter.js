const EMPTY='(leeg)';
export const LIVE_FILTER_DIMENSIONS=['type','gevolg','noodmaatregel','foutcode'];

export function liveFilterValue(value){
  const text=String(value==null?'':value).trim();
  return text||EMPTY;
}

function normalizeDimension(input){
  const mode=input?.mode==='include'?'include':'all';
  const values=[...new Set((Array.isArray(input?.values)?input.values:[]).map(liveFilterValue))];
  return {mode,values};
}

export function normalizeLiveFilter(input={}){
  const dims={};
  for(const key of LIVE_FILTER_DIMENSIONS)dims[key]=normalizeDimension(input?.dimensies?.[key]);
  return {versie:1,actief:input?.actief!==false,dimensies:dims};
}

export function liveRowMatchesFilter(facets,filterInput={}){
  const filter=normalizeLiveFilter(filterInput);
  if(!filter.actief)return true;
  for(const key of LIVE_FILTER_DIMENSIONS){
    const rule=filter.dimensies[key];
    if(rule.mode!=='include')continue;
    if(!rule.values.includes(liveFilterValue(facets?.[key])))return false;
  }
  return true;
}

export function filterLiveRows(rows,facetFn,filterInput={}){
  const list=Array.isArray(rows)?rows:[];
  const filter=normalizeLiveFilter(filterInput);
  if(!filter.actief)return list.slice();
  return list.filter(row=>liveRowMatchesFilter(facetFn(row),filter));
}

export function collectLiveFacetValues(rows,facetFn){
  const result=Object.fromEntries(LIVE_FILTER_DIMENSIONS.map(k=>[k,new Map()]));
  for(const row of Array.isArray(rows)?rows:[]){
    const facets=facetFn(row)||{};
    for(const key of LIVE_FILTER_DIMENSIONS){
      const value=liveFilterValue(facets[key]);
      result[key].set(value,(result[key].get(value)||0)+1);
    }
  }
  return Object.fromEntries(Object.entries(result).map(([key,map])=>[
    key,[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'nl')).map(([value,count])=>({value,count}))
  ]));
}

const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_DVM_LIVE_FILTER_ACTIVE__)return;
  const H=globalThis.__BIDASH_LIVE_FILTER_HELPERS__;
  if(!H||typeof doorrekenen!=='function'||typeof normRij!=='function'||typeof classificeer!=='function')return;

  const LABELS={type:'Type storing / asset',gevolg:'Gevolg',noodmaatregel:'Noodmaatregel',foutcode:'Foutcode / rekenregel'};

  function html(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function cfg(){
    RULES.liveFilter=H.normalizeLiveFilter(RULES.liveFilter||{});
    return RULES.liveFilter;
  }
  function rawRows(){return LIVE_STORINGSBRONNEN.flatMap(b=>b.rijen||[]);}
  function facets(raw){
    const m=normRij(raw),type=classificeer(m)||'ONBEKEND';
    let foutcode='';
    try{const f=foutregel(m,type);foutcode=f&&f.code!=null?String(f.code):'';}catch(e){}
    return {type,gevolg:m.gevolg||'',noodmaatregel:m.noodmaatregel||'',foutcode};
  }
  function filteredRows(){return H.filterLiveRows(rawRows(),facets,cfg());}
  function linkedCount(rows){
    if(typeof koppelMeldingAanAsset!=='function')return 0;
    let n=0;
    for(const raw of rows){
      const m=normRij(raw),type=classificeer(m);if(!type)continue;
      try{if(koppelMeldingAanAsset(m,type).asset)n++;}catch(e){}
    }
    return n;
  }
  function invalidate(){
    ANALYSE_SIGNATURE='';
    if(typeof probeerAnalyseActiveren==='function')probeerAnalyseActiveren('overzicht');
  }
  function setDimensionAll(key){
    const f=cfg();f.dimensies[key]={mode:'all',values:[]};invalidate();
  }
  function setDimensionNone(key){
    const f=cfg();f.dimensies[key]={mode:'include',values:[]};invalidate();
  }
  function setValue(key,value,checked){
    const f=cfg(),available=(H.collectLiveFacetValues(rawRows(),facets)[key]||[]).map(x=>x.value),rule=f.dimensies[key];
    if(rule.mode==='all')rule.values=available.slice();
    rule.mode='include';
    const set=new Set(rule.values.map(H.liveFilterValue));
    if(checked)set.add(H.liveFilterValue(value));else set.delete(H.liveFilterValue(value));
    rule.values=[...set];invalidate();
  }
  function reset(){RULES.liveFilter=H.normalizeLiveFilter({});invalidate();}
  function setActive(active){cfg().actief=!!active;invalidate();}

  function render(){
    const anchor=document.getElementById('dataStatusPanel');if(!anchor)return;
    let host=document.getElementById('liveFilterPanel');
    if(!host){host=document.createElement('section');host.id='liveFilterPanel';host.className='card';host.style.borderLeft='5px solid var(--rws-geel)';anchor.insertAdjacentElement('afterend',host);}
    const rows=rawRows();
    if(!rows.length){host.innerHTML='<h3>Storingsfilter / telregels</h3><p class="muted">Laad een actuele open-storingslijst. Daarna kun je bepalen welke meldingen meetellen in het actuele overzicht.</p>';return;}
    const f=cfg(),kept=filteredRows(),facetsMap=H.collectLiveFacetValues(rows,facets),linked=linkedCount(kept);
    const dims=H.LIVE_FILTER_DIMENSIONS.map(key=>{
      const rule=f.dimensies[key],items=facetsMap[key]||[];
      return '<details style="margin:10px 0"><summary style="font-weight:800;color:var(--rws-blauw)">'+html(LABELS[key])+' <span class="badge">'+(rule.mode==='all'?'alles':rule.values.length+' geselecteerd')+'</span></summary>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button type="button" class="tb-btn live-filter-all" data-filter-dim="'+key+'" style="background:#fff;color:var(--rws-blauw);border-color:var(--border)">Alles</button><button type="button" class="tb-btn live-filter-none" data-filter-dim="'+key+'" style="background:#fff;color:var(--rws-blauw);border-color:var(--border)">Niets</button></div>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:6px">'+items.map(item=>{const checked=rule.mode==='all'||rule.values.includes(item.value);return '<label style="display:flex;gap:7px;align-items:flex-start;font-size:12px"><input type="checkbox" class="live-filter-value" data-filter-dim="'+key+'" data-filter-value="'+html(item.value)+'" '+(checked?'checked':'')+'><span>'+html(item.value)+' <small class="muted">('+item.count+')</small></span></label>';}).join('')+'</div></details>';
    }).join('');
    host.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin-bottom:5px">Storingsfilter / telregels <span class="badge">rule engine</span></h3><p class="muted" style="margin:0">De bronlijst blijft volledig bewaard. Alleen meldingen die door deze telregels komen, voeden assetimpact, dienstverlening en kosten. Filteren sluit een storing niet af en beïnvloedt de A/B-historisering niet.</p></div><button type="button" id="liveFilterReset" class="tb-btn" style="background:#fff;color:var(--rws-blauw);border-color:var(--border)">Reset filters</button></div>'+
      '<div class="grid4" style="margin:14px 0"><div class="kpi"><div class="k-val">'+rows.length.toLocaleString('nl-NL')+'</div><div class="k-lab">geladen open meldingen</div></div><div class="kpi"><div class="k-val">'+kept.length.toLocaleString('nl-NL')+'</div><div class="k-lab">tellen mee</div></div><div class="kpi"><div class="k-val">'+(rows.length-kept.length).toLocaleString('nl-NL')+'</div><div class="k-lab">uitgesloten door telregels</div></div><div class="kpi"><div class="k-val">'+linked.toLocaleString('nl-NL')+'</div><div class="k-lab">meetellend én assetgekoppeld</div></div></div>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input id="liveFilterActive" type="checkbox" '+(f.actief?'checked':'')+'> Telregels toepassen op het actuele overzicht</label>'+dims;
    host.querySelector('#liveFilterActive')?.addEventListener('change',e=>setActive(e.target.checked));
    host.querySelector('#liveFilterReset')?.addEventListener('click',reset);
    host.querySelectorAll('.live-filter-all').forEach(el=>el.addEventListener('click',()=>setDimensionAll(el.dataset.filterDim)));
    host.querySelectorAll('.live-filter-none').forEach(el=>el.addEventListener('click',()=>setDimensionNone(el.dataset.filterDim)));
    host.querySelectorAll('.live-filter-value').forEach(el=>el.addEventListener('change',()=>setValue(el.dataset.filterDim,el.dataset.filterValue,el.checked)));
  }

  const originalDoorrekenen=doorrekenen;
  doorrekenen=function(rows,opties){
    if(opties&&opties.actueel&&Array.isArray(rows))rows=H.filterLiveRows(rows,facets,cfg());
    return originalDoorrekenen(rows,opties);
  };
  const originalActivate=probeerAnalyseActiveren;
  probeerAnalyseActiveren=function(...args){const result=originalActivate.apply(this,args);render();return result;};

  window.DVM_LIVE_FILTER={config:cfg,rawRows,filteredRows,facets,render,reset,setActive,setDimensionAll,setDimensionNone,setValue};
  globalThis.__BIDASH_DVM_LIVE_FILTER_ACTIVE__=true;
  render();
})();`;

export function installDvmLiveFilterPatch(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_DVM_LIVE_FILTER_ACTIVE__)return true;
  scope.__BIDASH_LIVE_FILTER_HELPERS__={
    LIVE_FILTER_DIMENSIONS,liveFilterValue,normalizeLiveFilter,liveRowMatchesFilter,filterLiveRows,collectLiveFacetValues
  };
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_DVM_LIVE_FILTER_ACTIVE__;
  }catch(error){
    console.error('BiDash storingsfilter kon niet worden gestart.',error);
    return false;
  }
}
