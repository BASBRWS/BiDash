export const DRIP_OPEN_VIRTUAL_KEY='__drip_open_from_history__';

const OPEN_AT_SOURCE_END_TOLERANCE_MS=36*60*60*1000;

function explicitOpenState(x){
  const toestand=String(x?.technischeToestand||x?.status||'').trim().toLowerCase();
  return /\b(open|openstaand|actief|onopgelost|niet\s*hersteld)\b/.test(toestand);
}

function sourceEnds(incidenten){
  const ends=new Map();
  for(const x of Array.isArray(incidenten)?incidenten:[]){
    const key=String(x?.sourceKey||x?.sourceName||'');
    const end=Number(x?.einde);
    if(key&&Number.isFinite(end)&&end>(ends.get(key)||0))ends.set(key,end);
  }
  return ends;
}

export function isOpenDripIncident(x,sourceEnd=null){
  if(!x||typeof x!=='object')return false;
  if(explicitOpenState(x))return true;
  // In de DRIP-historie wordt een ontbrekende eindtijd alleen als open
  // geïnterpreteerd wanneer ook geen afgeronde duur is vastgelegd.
  if(x.einde==null&&(x.duurUren==null||!Number.isFinite(Number(x.duurUren))))return true;
  // `censored` betekent dat een episode aan het einde van het bronvenster nog
  // liep. Oude gecensureerde episodes zijn niet automatisch nu nog open. Alleen
  // een episode die het actuele einde van dezelfde bron raakt, telt als open.
  const end=Number(x.einde),bronEinde=sourceEnd==null?NaN:Number(sourceEnd),afstand=bronEinde-end;
  return x.censored===true&&Number.isFinite(end)&&Number.isFinite(bronEinde)&&afstand>=0&&afstand<=OPEN_AT_SOURCE_END_TOLERANCE_MS;
}

function iso(v){
  if(v==null||v==='')return '';
  const n=Number(v);
  if(Number.isFinite(n)){
    const d=new Date(n);if(Number.isFinite(d.getTime()))return d.toISOString();
  }
  const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():'';
}

function incidentKey(x,index=0){
  return [String(x?.code||x?.asset||'').toUpperCase(),Number(x?.start)||index,String(x?.weg||'').toUpperCase(),x?.hm??''].join('|');
}

/* Een historie-incident draagt niet altijd weg, richting en hm. De storingslijst
   vult die aan uit het assetregister, maar de regel die naar doorrekenen() gaat
   deed dat niet. doorrekenen() laat een melding zonder `weg` vallen, dus zulke
   DRIP-storingen waren wel zichtbaar en telden toch niet mee in de
   beschikbaarheid. `plaats` geeft de aanroeper de kans die locatie aan te vullen
   uit het register; zonder aanvulling blijft het gedrag zoals het was. */
export function dripOpenRow(x,index=0,plaats=null){
  const code=String(x?.code||x?.asset||'').trim();
  const locatie=String(x?.locatie||'').trim();
  const identificatie=[code,locatie].filter(Boolean).join(' · ')||('DRIP '+(index+1));
  const detail=String(x?.alarmmeldingen||x?.classificatie||'openstaande storing').trim();
  const p=plaats||{};
  const weg=String(x?.weg||p.weg||'').trim();
  const richting=String(x?.richting||p.richting||'').trim();
  const hm=x?.hm??p.hm??'';
  const vc=String(x?.vc||p.vc||'').trim();
  return {
    event_id:`DRIP-OPEN-${code||'ONBEKEND'}-${x?.start||index}`,
    os_id:`DRIP ${identificatie}`,
    asset:`DRIP ${code||identificatie}`,
    melding:`DRIP openstaand · ${detail}`,
    storingsomschrijving:detail,
    gevolg:'DRIP openstaand',
    wegnummer:weg,
    weg:weg,
    richting:richting,
    hm:hm,
    vc:vc,
    van:iso(x?.start),
    tot:'',
    status:'open',
    open:'ja',
    bron:'DRIP-storingshistorie',
    source_name:x?.sourceName||'',
    drip_code:code,
    storingsduur_uren:x?.duurUren??null,
    duurBetrouwbaar:x?.duurBetrouwbaar!==false,
    bronPeildatum:iso(x?.einde),
    /* De functionele toestand en duurclassificatie bepalen in foutregel() de
       DRIP-impact (GESTOPT/IN-BEDRIJF, LANGDURIG/INTERMITTEREND). Zonder deze
       velden kan de doorrekening alleen op de losse alarmtekst sturen. */
    classificatie:String(x?.classificatie||'').trim(),
    technischeToestand:String(x?.technischeToestand||x?.technische_toestand||'').trim(),
    _liveOpen:true,
    _dripHistorieOpen:true
  };
}

/* `plaatsVan` is optioneel en levert per incident {weg,richting,hm,vc} uit het
   assetregister. De engine geeft hem mee; tests en andere aanroepers mogen hem
   weglaten. */
export function deriveOpenDripRows(incidenten,plaatsVan=null){
  const out=[],seen=new Set(),ends=sourceEnds(incidenten);
  (Array.isArray(incidenten)?incidenten:[]).forEach((x,i)=>{
    if(!isOpenDripIncident(x,ends.get(String(x?.sourceKey||x?.sourceName||''))))return;
    const key=incidentKey(x,i);if(seen.has(key))return;seen.add(key);
    let plaats=null;
    if(typeof plaatsVan==='function'){try{plaats=plaatsVan(x);}catch(error){plaats=null;}}
    out.push(dripOpenRow(x,i,plaats));
  });
  return out;
}

export function deriveOpenDripFaults(incidenten){
  const out=[],seen=new Set(),ends=sourceEnds(incidenten);
  (Array.isArray(incidenten)?incidenten:[]).forEach((x,i)=>{
    if(!isOpenDripIncident(x,ends.get(String(x?.sourceKey||x?.sourceName||''))))return;
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
  /* Vul weg, richting, hm en VC aan uit het assetregister, op dezelfde manier als
     de storingslijst dat doet. Zonder locatie laat doorrekenen() de melding vallen
     en telt de DRIP-storing niet mee in de beschikbaarheid. */
  function plaatsVanIncident(x){
    const matcher=globalThis.__BIDASH_DRIP_FAULT_MATCH__;
    let assets=[],drips=[];
    try{assets=(ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.assets)||[];}catch(error){}
    try{drips=(((typeof STATE!=='undefined'&&STATE&&STATE.drips)||DRIP_STATE)||{}).drips||[];}catch(error){}
    let hit=null;
    if(matcher&&typeof matcher.matchDripIncident==='function'){
      try{hit=matcher.matchDripIncident(x,assets,drips);}catch(error){hit=null;}
    }
    const asset=hit&&hit.asset?hit.asset:null,drip=hit&&hit.drip?hit.drip:null;
    if(!asset&&!drip)return null;
    return {
      weg:(asset&&asset.weg)||(drip&&drip.weg)||'',
      richting:(asset&&asset.richting)||(drip&&drip.richting)||'',
      hm:(asset&&asset.hm!=null)?asset.hm:((drip&&drip.hm!=null)?drip.hm:null),
      vc:(asset&&asset.vc)||(drip&&drip.vc)||''
    };
  }
  function syncDripOpenLive(){
    const rows=H.deriveOpenDripRows(huidigeIncidenten(),plaatsVanIncident);
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
    try{
      LIVE_STORINGS_INSPECTIE=LIVE_STORINGSBRONNEN.length?inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen()):null;
    }catch(error){console.warn('DRIP-livebron kon niet opnieuw worden geinspecteerd.',error);}
    return rows.length;
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
    probeerAnalyseActiveren('overzicht');
    if(typeof renderDataGereedheid==='function')renderDataGereedheid();
    return n;
  };

  syncDripOpenLive();
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
