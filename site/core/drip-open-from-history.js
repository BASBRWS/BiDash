export const DRIP_OPEN_VIRTUAL_KEY='__drip_open_from_history__';

export function isOpenDripIncident(x){
  if(!x||typeof x!=='object')return false;
  if(x.censored===true)return true;
  const toestand=String(x.technischeToestand||'').trim().toLowerCase();
  if(/\b(open|openstaand|actief|onopgelost|niet\s*hersteld)\b/.test(toestand))return true;
  // In de DRIP-historie wordt een ontbrekende eindtijd alleen als open
  // geïnterpreteerd wanneer ook geen afgeronde duur is vastgelegd.
  return x.einde==null&&(x.duurUren==null||!Number.isFinite(Number(x.duurUren)));
}

function iso(v){
  const n=Number(v);
  if(Number.isFinite(n)){
    const d=new Date(n);if(Number.isFinite(d.getTime()))return d.toISOString();
  }
  const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():'';
}

function incidentKey(x,index=0){
  return [String(x?.code||x?.asset||'').toUpperCase(),Number(x?.start)||index,String(x?.weg||'').toUpperCase(),x?.hm??''].join('|');
}

export function dripOpenRow(x,index=0){
  const code=String(x?.code||x?.asset||'').trim();
  const locatie=String(x?.locatie||'').trim();
  const identificatie=[code,locatie].filter(Boolean).join(' · ')||('DRIP '+(index+1));
  const detail=String(x?.alarmmeldingen||x?.classificatie||'openstaande storing').trim();
  return {
    event_id:`DRIP-OPEN-${code||'ONBEKEND'}-${x?.start||index}`,
    os_id:`DRIP ${identificatie}`,
    asset:`DRIP ${code||identificatie}`,
    melding:`DRIP openstaand · ${detail}`,
    storingsomschrijving:detail,
    gevolg:'DRIP openstaand',
    wegnummer:x?.weg||'',
    weg:x?.weg||'',
    richting:x?.richting||'',
    hm:x?.hm??'',
    vc:x?.vc||'',
    van:iso(x?.start),
    tot:'',
    status:'open',
    open:'ja',
    bron:'DRIP-storingshistorie',
    source_name:x?.sourceName||'',
    drip_code:code,
    _dripHistorieOpen:true
  };
}

export function deriveOpenDripRows(incidenten){
  const out=[],seen=new Set();
  (Array.isArray(incidenten)?incidenten:[]).forEach((x,i)=>{
    if(!isOpenDripIncident(x))return;
    const key=incidentKey(x,i);if(seen.has(key))return;seen.add(key);
    out.push(dripOpenRow(x,i));
  });
  return out;
}

export function deriveOpenDripFaults(incidenten){
  const out=[],seen=new Set();
  (Array.isArray(incidenten)?incidenten:[]).forEach((x,i)=>{
    if(!isOpenDripIncident(x))return;
    const key=incidentKey(x,i);if(seen.has(key))return;seen.add(key);
    const detail=String(x?.alarmmeldingen||x?.classificatie||'openstaande DRIP-storing').trim();
    out.push({
      id:'drip-history-open-'+key,
      assetKey:x?.matchAssetKey||'',
      naam:String(x?.asset||x?.code||'DRIP').trim()||'DRIP',
      weg:x?.weg||'',
      richting:x?.richting||'',
      vc:x?.vc||'',
      hm:x?.hm??null,
      code:String(x?.code||'DRIP-OPEN'),
      impact:null,
      prestatie:null,
      impactLabel:'Nog niet gekwantificeerd',
      omschrijving:`Open DRIP-storing uit ${x?.sourceName||'DRIP-historie'} · ${detail}`,
      wegKey:[x?.weg||'',x?.richting||''].filter(Boolean).join(' '),
      bron:'DRIP-historie',
      typeId:'DRIP',
      afgeleid:true
    });
  });
  return out;
}

const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_DRIP_OPEN_FROM_HISTORY_ACTIVE__)return;
  if(typeof herbouwDripHistorie!=='function'||typeof probeerAnalyseActiveren!=='function')return;
  const H=globalThis.__BIDASH_DRIP_OPEN_FROM_HISTORY_HELPERS__;
  const VIRTUAL_KEY=H.virtualKey;

  function huidigeIncidenten(){
    try{return DRIP_HIST_STATE&&Array.isArray(DRIP_HIST_STATE.incidenten)?DRIP_HIST_STATE.incidenten:[];}
    catch(error){return [];}
  }
  function bronPeildatum(rows){
    let t=null;
    try{
      if(DRIP_HIST_STATE&&Number.isFinite(Number(DRIP_HIST_STATE.tot)))t=Number(DRIP_HIST_STATE.tot);
      if(!t)for(const r of rows){const x=Date.parse(r.van||'');if(Number.isFinite(x)&&(!t||x>t))t=x;}
    }catch(error){}
    return t;
  }
  function syncDripOpenLive(){
    const rows=H.deriveOpenDripRows(huidigeIncidenten());
    const lijst=Array.isArray(LIVE_STORINGSBRONNEN)?LIVE_STORINGSBRONNEN:[];
    const zonder=lijst.filter(b=>!b||b.key!==VIRTUAL_KEY);
    if(rows.length){
      const peildatum=bronPeildatum(rows);
      const bronnen=[...new Set(rows.map(r=>r.source_name).filter(Boolean))];
      zonder.push({
        key:VIRTUAL_KEY,
        naam:'DRIP openstaand uit storingshistorie',
        name:'DRIP openstaand uit storingshistorie',
        rijen:rows,
        peildatum,
        virtueel:true,
        afgeleidVan:'dripHistorie',
        bronNamen:bronnen
      });
      LIVE_STORINGSBRONNEN=zonder;
      if(!LIVE_PEILDATUM&&peildatum)LIVE_PEILDATUM=peildatum;
    }else{
      LIVE_STORINGSBRONNEN=zonder;
      if(!zonder.length)LIVE_PEILDATUM=null;
    }
    globalThis.__BIDASH_DRIP_OPEN_FROM_HISTORY__={
      aantal:rows.length,
      bijgewerkt:new Date().toISOString(),
      bronnen:[...new Set(rows.map(r=>r.source_name).filter(Boolean))]
    };
    return rows.length;
  }

  function patchHubFaults(poging){
    const hub=globalThis.HUB;
    if(!hub||typeof hub.faults!=='function'){
      if((poging||0)<80)setTimeout(()=>patchHubFaults((poging||0)+1),25);
      return;
    }
    if(hub.__bidashDripOpenFaults)return;
    const originalFaults=hub.faults.bind(hub);
    hub.faults=function(){
      const basis=originalFaults();
      const extra=H.deriveOpenDripFaults(huidigeIncidenten()).map(f=>{
        let asset=null;
        try{asset=f.assetKey&&ASSET_INDEX&&ASSET_INDEX.byKey?ASSET_INDEX.byKey.get(f.assetKey):null;}catch(error){}
        return asset?{...f,naam:asset.naam||f.naam,weg:asset.weg||f.weg,richting:asset.richting||f.richting,vc:asset.vc||f.vc,hm:asset.hm!=null?asset.hm:f.hm}:f;
      });
      return [...basis,...extra];
    };
    hub.__bidashDripOpenFaults=true;
  }

  const originalHerbouw=herbouwDripHistorie;
  herbouwDripHistorie=function(){
    const result=originalHerbouw.apply(this,arguments);
    syncDripOpenLive();
    return result;
  };

  if(typeof wisDripHistorie==='function'){
    const originalWis=wisDripHistorie;
    wisDripHistorie=function(){
      const result=originalWis.apply(this,arguments);
      syncDripOpenLive();ANALYSE_SIGNATURE='';probeerAnalyseActiveren('drips');
      return result;
    };
  }

  if(typeof verwijderDataset==='function'){
    const originalVerwijder=verwijderDataset;
    verwijderDataset=async function(){
      const result=await originalVerwijder.apply(this,arguments);
      syncDripOpenLive();ANALYSE_SIGNATURE='';probeerAnalyseActiveren('drips');
      return result;
    };
  }

  if(typeof verwijderAlleDatasets==='function'){
    const originalWisAlles=verwijderAlleDatasets;
    verwijderAlleDatasets=async function(){
      const result=await originalWisAlles.apply(this,arguments);
      syncDripOpenLive();ANALYSE_SIGNATURE='';probeerAnalyseActiveren('drips');
      return result;
    };
  }

  const originalAnalyseSignatuur=analyseSignatuur;
  analyseSignatuur=function(){
    const basis=originalAnalyseSignatuur.apply(this,arguments);
    const d=globalThis.__BIDASH_DRIP_OPEN_FROM_HISTORY__||{aantal:0};
    return basis+'|dripOpen:'+d.aantal+'|'+(d.bijgewerkt||'');
  };

  globalThis.__BIDASH_SYNC_DRIP_OPEN_FROM_HISTORY__=function(){
    const n=syncDripOpenLive();
    ANALYSE_SIGNATURE='';
    probeerAnalyseActiveren('drips');
    if(typeof renderDataGereedheid==='function')renderDataGereedheid();
    return n;
  };

  syncDripOpenLive();
  patchHubFaults(0);
  globalThis.__BIDASH_DRIP_OPEN_FROM_HISTORY_ACTIVE__=true;
})();`;

export function installDripOpenFromHistory(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_DRIP_OPEN_FROM_HISTORY_ACTIVE__)return true;
  scope.__BIDASH_DRIP_OPEN_FROM_HISTORY_HELPERS__={
    virtualKey:DRIP_OPEN_VIRTUAL_KEY,
    deriveOpenDripRows,
    deriveOpenDripFaults
  };
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_DRIP_OPEN_FROM_HISTORY_ACTIVE__;
  }catch(error){
    console.error('BiDash kon open DRIP-storingen uit historie niet activeren.',error);
    return false;
  }
}
