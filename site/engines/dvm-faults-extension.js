/* Verrijk de publieke DVM-HUB met presentatiegegevens voor Assetmanagement > Open storingen.
   Geen nieuwe impactberekening: DRIP-historie blijft prognosebron, maar aantoonbaar
   open DRIP-incidenten worden tevens als actuele melding aangeboden. */
(() => {
  const hub=window.HUB;if(!hub||hub.__bidashFaultsExtended)return;
  const baseFaults=typeof hub.faults==='function'?hub.faults.bind(hub):()=>[];
  const baseDetail=typeof hub.detail==='function'?hub.detail.bind(hub):null;
  const matcher=window.__BIDASH_DRIP_FAULT_MATCH__||null;
  const statusRules=window.__BIDASH_ASSET_OPERATIONAL_STATUS__||null;
  const yes=v=>v===true||v===1||/^(1|ja|yes|true|x)$/i.test(String(v??'').trim());
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const iso=v=>{const n=num(v),d=new Date(n!=null?n:v);return Number.isFinite(d.getTime())?d.toISOString():'';};
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  const upper=v=>String(v??'').trim().toUpperCase();
  const assets=()=>{try{return ASSET_REGISTER_STATE?.assets||[];}catch(e){return [];}};
  const drips=()=>{try{return ((STATE&&STATE.drips)||DRIP_STATE)?.drips||[];}catch(e){return [];}};
  const assetByKey=key=>key?assets().find(a=>String(a.key)===String(key)):null;
  const tokenVariants=v=>matcher?.tokenVariants?matcher.tokenVariants(v):new Set([norm(v)].filter(Boolean));
  const objectTokens=x=>matcher?.objectTokens?matcher.objectTokens(x):new Set([x?.entityid,x?.id,x?.key,x?.naam,x?.asset,x?.code,x?.idCdms,x?.histCode,x?.uid,x?.osid,x?.logId,x?.dynac,x?.cdms].map(norm).filter(Boolean));
  const intersects=(a,b)=>{for(const x of a)if(b.has(x))return true;return false;};

  function resolveDrip(x){
    if(matcher?.matchDripIncident){
      try{return matcher.matchDripIncident(x,assets(),drips());}catch(error){console.warn('DRIP-match overgeslagen.',error);}
    }
    const ds=drips();
    const d=ds.find(r=>(x.matchAssetKey&&(r._assetKey===x.matchAssetKey||r.assetKey===x.matchAssetKey))||(x.matchUid&&r.uid===x.matchUid)||(x.code&&upper(r.histCode||r.idCdms)===upper(x.code)))||null;
    const key=x.matchAssetKey||d?._assetKey||d?.assetKey||'';
    return d||key?{drip:d,asset:assetByKey(key),assetKey:key,method:'oude sleutelmatch',score:0}:null;
  }

  function specialListMatch(kind,...objects){
    const refs=window.DVM_SPECIAL_DRIP_LISTS?.[kind]?.identifiers||[];
    if(!refs.length)return false;
    const set=new Set();for(const r of refs)for(const t of tokenVariants(r.token||r.raw||r))set.add(t);
    return objects.filter(Boolean).some(x=>intersects(objectTokens(x),set));
  }
  const special=(asset,drip,incident)=>{
    const vals=[asset,drip,incident].filter(Boolean);
    const text=vals.flatMap(x=>[x.asset,x.naam,x.type,x.model,x.hardware,x.functie,x.opmerking,x.locatie]).join(' ').toLowerCase();
    return {
      wind:vals.some(x=>yes(x.wind)||yes(x.windwaarschuwing)||yes(x.specialWind))||specialListMatch('wind',asset,drip,incident)||/windwaarschuw/.test(text),
      ria4:vals.some(x=>yes(x.ria4)||yes(x.ria_4)||yes(x['ria-4'])||yes(x.specialRia4))||specialListMatch('ria4',asset,drip,incident)||/\bria\s*[- ]?4\b/.test(text)
    };
  };
  const duur=(start,einde,expliciet,peil)=>{
    const d=num(expliciet);if(d!=null&&d>=0)return d;
    const a=num(start),b=num(einde)??num(peil);return a!=null&&b!=null&&b>=a?(b-a)/36e5:null;
  };
  const operationeleStatus=(asset,fault)=>{
    if(statusRules?.operationalStatusForFault)return statusRules.operationalStatusForFault(asset,fault);
    if(asset?.prognoseActief===false||/niet\s+operationeel/i.test(String(asset?.status||'')))return 'Niet operationeel';
    if(upper(fault?.typeId)==='MSI'&&upper(fault?.code)==='1003')return 'Niet operationeel door storing';
    if(upper(fault?.typeId)==='DRIP'&&(fault?.wind||fault?.ria4))return 'Niet operationeel door storing';
    return 'Operationeel';
  };
  const dripLike=x=>upper(x?.typeId)==='DRIP'||yes(x?._dripHistorieOpen)||/\bDRIP\b/i.test([x?.naam,x?.asset,x?.bron,x?.melding,x?.omschrijving,x?.locatie].filter(Boolean).join(' '));

  function enrichBase(row,i){
    let m=null;try{m=STATE?.meldingen?.[i]||null;}catch(e){}
    const probe={...(m||{}),...(row||{}),asset:row?.naam||m?.assetNaam||m?.asset||row?.asset||'',code:row?.code||m?.code||m?.foutcode||''};
    const existingKey=row.assetKey||m?.assetKey||'',existingAsset=assetByKey(existingKey);
    const resolved=!existingAsset&&dripLike(probe)?resolveDrip(probe):null;
    const asset=existingAsset||resolved?.asset||assetByKey(resolved?.assetKey),key=existingKey||resolved?.assetKey||asset?.key||'';
    const drip=resolved?.drip||(asset?.tp==='DRIP'?drips().find(d=>String(d._assetKey||d.assetKey||'')===String(asset.key)):null);
    const typeId=row.typeId||m?.typeId||asset?.tp||(dripLike(probe)?'DRIP':'');
    const sp=special(asset,drip,probe);
    let peil=null;try{peil=STATE?.peildatum||LIVE_PEILDATUM||Date.now();}catch(e){peil=Date.now();}
    const start=m?.tVan??m?.t??m?.start??row?.start??null,end=m?.tTot??m?.einde??row?.einde??null;
    const out={...row,
      assetKey:key,typeId,
      rd:row.rd||m?.rd||asset?.rd||'',district:row.district||m?.district||asset?.district||'',
      vc:row.vc||m?.vc||asset?.vc||'',
      weg:row.weg||m?.weg||asset?.weg||'',richting:row.richting||m?.richting||asset?.richting||'',hm:row.hm??m?.hm??asset?.hm??null,
      naam:row.naam||m?.assetNaam||asset?.naam||drip?.asset||'',
      start:iso(start),einde:iso(end),duurUren:duur(start,end,m?.duur??row?.duurUren,peil),
      bron:row.bron||'Open-storingenmomentopname',wind:sp.wind,ria4:sp.ria4,
      matchMethode:resolved?.method||'',matchScore:resolved?.score||null
    };
    out.operationeleStatus=operationeleStatus(asset,out);
    return out;
  }
  function openDripFaults(){
    let hist=null;try{hist=DRIP_HIST_STATE;}catch(e){}
    if(!hist||!Array.isArray(hist.incidenten))return [];
    const peil=num(hist.tot)??Date.now();
    const openKeys=new Set((window.__BIDASH_DRIP_OPEN_FROM_HISTORY_HELPERS__?.deriveOpenDripRows(hist.incidenten)||[]).map(r=>[upper(r.drip_code),Date.parse(r.van)||0].join('|')));
    return hist.incidenten.filter(x=>openKeys.has([upper(x.code||x.asset),num(x.start)||0].join('|'))).map((x,i)=>{
      const resolved=resolveDrip(x),d=resolved?.drip||null,key=x.matchAssetKey||resolved?.assetKey||d?._assetKey||d?.assetKey||'',asset=resolved?.asset||assetByKey(key),sp=special(asset,d,x);
      const naam=asset?.naam||d?.asset||d?.idCdms||x.asset||x.code||`DRIP ${i+1}`;
      const detail=x.alarmmeldingen||x.classificatie||x.technischeToestand||'Openstaande DRIP-storing';
      const out={id:`drip-open-${x.code||i}-${x.start||i}`,assetKey:key,naam,typeId:'DRIP',
        weg:asset?.weg||d?.weg||x.weg||'',richting:asset?.richting||d?.richting||x.richting||'',
        hm:asset?.hm??d?.hm??x.hm??null,vc:asset?.vc||d?.vc||x.vc||'',rd:asset?.rd||d?.rd||'',district:asset?.district||d?.district||'',
        code:x.code||d?.histCode||d?.idCdms||'',impact:null,prestatie:null,omschrijving:detail,
        start:iso(x.start),einde:'',duurUren:duur(x.start,null,x.duurUren,peil),
        bron:x.sourceName||'DRIP-storingshistorie',wind:sp.wind,ria4:sp.ria4,afgeleidUitHistorie:true,
        matchMethode:resolved?.method||'',matchScore:resolved?.score||null};
      out.operationeleStatus=operationeleStatus(asset,out);
      return out;
    });
  }
  function allFaults(){
    const rows=baseFaults().map(enrichBase),extra=openDripFaults(),out=[],seen=new Set();
    for(const f of [...rows,...extra]){
      const key=[f.typeId,f.assetKey||f.naam,f.code,f.start||'',f.omschrijving].join('|').toUpperCase();
      if(seen.has(key))continue;seen.add(key);out.push(f);
    }
    return out;
  }
  hub.faults=allFaults;
  if(baseDetail)hub.detail=function(key){const d=baseDetail(key)||{};return {...d,faults:allFaults().filter(f=>String(f.assetKey)===String(key))};};
  hub.__bidashFaultsExtended=true;
})();
