import {LIVE_FILTER_FIELDS,normalizeLiveOverviewFilter} from './live-overview-filter.js';

export function filterConfigFromCard(card,current={}){
  const next=normalizeLiveOverviewFilter(current);
  if(!card)return next;
  for(const field of LIVE_FILTER_FIELDS){
    const boxes=[...card.querySelectorAll(`input[data-live-filter-value][data-field="${field.key}"]`)];
    const visible=new Set(boxes.map(cb=>cb.dataset.value).filter(Boolean));
    const excluded=(next.excluded[field.key]||[]).filter(key=>!visible.has(key));
    for(const cb of boxes)if(!cb.checked&&cb.dataset.value)excluded.push(cb.dataset.value);
    next.excluded[field.key]=[...new Set(excluded)].sort();
  }
  return normalizeLiveOverviewFilter(next);
}

export function liveDashboardCountModel(preview={},processed=0){
  const total=Number(preview.total)||0;
  const included=Number(preview.included)||0;
  const excluded=Number(preview.excluded)||0;
  return {total,included,excluded,processed:Math.max(0,Number(processed)||0),active:Number(preview.active)||0};
}

export function installLiveOverviewFilterSync(scope=globalThis){
  if(!scope?.document||scope.__BIDASH_LIVE_FILTER_SYNC_ACTIVE__)return !!scope?.__BIDASH_LIVE_FILTER_SYNC_ACTIVE__;
  const api=scope.DVM_LIVE_OVERVIEW_FILTER;
  if(!api?.get||!api?.set||!api?.preview)return false;

  let timer=null,applying=false;
  const processedCount=()=>{
    try{return scope.HUB?.faults?.().length||0;}catch(e){return 0;}
  };
  const fmt=n=>(Number(n)||0).toLocaleString('nl-NL');

  function decorateSummary(card,pending=false){
    if(!card)return;
    const host=card.querySelector('[data-live-filter-summary]');
    const spans=host?[...host.querySelectorAll('.live-filter-kpis > span')]:[];
    if(spans.length<4)return;
    const preview=api.preview(),m=liveDashboardCountModel(preview,processedCount());
    const values=[m.total,m.included,m.excluded,pending?'…':m.processed];
    const labels=['open bronregels','geselecteerd voor DVM','uitgesloten door filter',pending?'doorrekening wordt bijgewerkt':'doorgerekende meldingen'];
    spans.forEach((span,i)=>{const b=span.querySelector('b'),small=span.querySelector('small');if(b)b.textContent=typeof values[i]==='number'?fmt(values[i]):values[i];if(small)small.textContent=labels[i];});
    let note=card.querySelector('[data-live-filter-pipeline-note]');
    if(!note){note=scope.document.createElement('p');note.dataset.liveFilterPipelineNote='1';note.className='muted';note.style.cssText='font-size:11px;margin:-4px 0 12px;line-height:1.45';host.insertAdjacentElement('afterend',note);}
    note.textContent=pending
      ?'Selectie gewijzigd. De actuele DVM-doorrekening wordt automatisch bijgewerkt.'
      :`${fmt(m.included)} geselecteerde bronregels leveren na locatiecontrole, foutregelcontrole en ontdubbeling ${fmt(m.processed)} doorgerekende open meldingen op. Het bronbestand blijft ${fmt(m.total)} regels bevatten.`;
  }

  function decorateNotice(){
    const notice=scope.document.getElementById('liveOverviewFilterNotice');if(!notice)return;
    const text=notice.querySelector('span');if(!text)return;
    const m=liveDashboardCountModel(api.preview(),processedCount());
    text.textContent=`${fmt(m.total)} bronregels · ${fmt(m.included)} geselecteerd · ${fmt(m.processed)} doorgerekend · ${fmt(m.excluded)} door filter uitgesloten.`;
  }

  function decorateCard(card){
    if(!card)return;
    const apply=card.querySelector('[data-live-filter-apply]');
    if(apply)apply.textContent='Dienstimpact bekijken';
    let auto=card.querySelector('[data-live-filter-auto-note]');
    if(!auto){auto=scope.document.createElement('div');auto.dataset.liveFilterAutoNote='1';auto.className='data-missing';auto.style.margin='10px 0';auto.innerHTML='<b>Automatisch toepassen.</b> Iedere wijziging in de vinkjes wordt direct doorgerekend. Je hoeft de selectie niet apart op te slaan.';const grid=card.querySelector('.live-filter-grid');if(grid)grid.before(auto);}
    decorateSummary(card,false);
  }

  function applyFromCard(card){
    if(!card||applying)return;
    applying=true;
    try{
      api.set(filterConfigFromCard(card,api.get()));
      decorateSummary(scope.document.getElementById('liveOverviewFilterCard')||card,false);
      decorateNotice();
    }finally{applying=false;}
  }

  function schedule(card){
    clearTimeout(timer);
    decorateSummary(card,true);
    timer=setTimeout(()=>applyFromCard(card),350);
  }

  function wire(card){
    if(!card||card.dataset.liveFilterAutoSync==='1')return;
    card.dataset.liveFilterAutoSync='1';
    decorateCard(card);
    card.addEventListener('change',event=>{
      if(event.target?.matches?.('input[data-live-filter-value]'))schedule(card);
    });
    card.addEventListener('click',event=>{
      if(event.target?.closest?.('[data-field-all],[data-field-none]'))setTimeout(()=>schedule(card),0);
    });
    const reset=card.querySelector('[data-live-filter-reset]');
    reset?.addEventListener('click',event=>{
      event.preventDefault();event.stopImmediatePropagation();clearTimeout(timer);
      api.reset();
      const fresh=scope.document.getElementById('liveOverviewFilterCard');
      if(fresh&&fresh!==card)wire(fresh);else{card.querySelectorAll('input[data-live-filter-value]').forEach(cb=>cb.checked=true);decorateSummary(card,false);}
      decorateNotice();
    },true);
  }

  function enhance(){
    wire(scope.document.getElementById('liveOverviewFilterCard'));
    decorateNotice();
  }

  const observer=new MutationObserver(()=>queueMicrotask(enhance));
  observer.observe(scope.document.documentElement,{subtree:true,childList:true});
  scope.addEventListener('beforeunload',()=>observer.disconnect(),{once:true});
  scope.DVM_LIVE_FILTER_SYNC={enhance,apply:()=>applyFromCard(scope.document.getElementById('liveOverviewFilterCard'))};
  scope.__BIDASH_LIVE_FILTER_SYNC_ACTIVE__=true;
  enhance();
  return true;
}
