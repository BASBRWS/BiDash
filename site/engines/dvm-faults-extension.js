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
  const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const iso=v=>{if(v==null||v==='')return '';const n=num(v),d=new Date(n!=null?n:v);return Number.isFinite(d.getTime())?d.toISOString():'';};
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
    const list=window.DVM_SPECIAL_DRIP_LISTS?.[kind];
    const helper=window.__BIDASH_SPECIAL_DRIP_CLASSIFICATION__;
    if(list?.records?.length&&helper?.matchesRecord){
      return objects.filter(Boolean).some(x=>list.records.some(r=>helper.matchesRecord(x,r)));
    }
    // Older lists have no location records. Only retain a classification
    // already validated on the asset; code-only references are ambiguous.
    return false;
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
  /* De kolom Beheerder toonde wat er toevallig in `rd` stond. Bij DRIP-bronnen is
     dat soms een getal uit de bron in plaats van een regiodienst. Rapportages
     gebruiken hiervoor al rapportRdWaarde(): alleen een herkende regiodienst telt,
     anders wordt hij uit de verkeerscentrale afgeleid. De storingslijst hoort
     dezelfde regel te volgen, zodat er nooit een getal als beheerder verschijnt. */
  const regioDienst=(...bronnen)=>{
    for(const b of bronnen){
      if(!b)continue;
      try{
        const w=rapportRdWaarde(b);
        if(w&&w!==ONBEKEND_RD)return w;
      }catch(error){
        const rd=String(b.rd||'').trim();
        if(rd&&!/^[\d.,\s]+$/.test(rd))return rd;
      }
    }
    return '';
  };
  const dripLike=x=>upper(x?.typeId)==='DRIP'||yes(x?._dripHistorieOpen)||/\bDRIP\b/i.test([x?.naam,x?.asset,x?.bron,x?.melding,x?.omschrijving,x?.locatie].filter(Boolean).join(' '));

  function enrichBase(row,i){
    const m=row;
    const probe={...(m||{}),...(row||{}),asset:row?.naam||m?.assetNaam||m?.asset||row?.asset||'',code:row?.code||m?.code||m?.foutcode||''};
    const existingKey=row.assetKey||m?.assetKey||'',existingAsset=assetByKey(existingKey);
    const resolved=!existingAsset&&row.assetMatchStatus!=='locatieconflict'&&dripLike(probe)?resolveDrip(probe):null;
    const asset=existingAsset||resolved?.asset||assetByKey(resolved?.assetKey),key=existingKey||resolved?.assetKey||asset?.key||'';
    const drip=resolved?.drip||(asset?.tp==='DRIP'?drips().find(d=>String(d._assetKey||d.assetKey||'')===String(asset.key)):null);
    const typeId=row.typeId||m?.typeId||asset?.tp||(dripLike(probe)?'DRIP':'');
    const sp=special(asset,drip,probe);
    let peil=null;try{peil=STATE?.peildatum||LIVE_PEILDATUM||Date.now();}catch(e){peil=Date.now();}
    const start=m?.tVan??m?.t??m?.start??row?.start??null,end=m?.tTot??m?.einde??row?.einde??null;
    const out={...row,
      assetKey:key,typeId,
      rd:regioDienst(row,m,asset,{rd:'',vc:row.vc||m?.vc||asset?.vc||''}),district:row.district||m?.district||asset?.district||'',
      vc:row.vc||m?.vc||asset?.vc||'',
      weg:row.weg||m?.weg||asset?.weg||'',richting:row.richting||m?.richting||asset?.richting||'',hm:row.hm??m?.hm??asset?.hm??null,
      naam:row.naam||m?.assetNaam||asset?.naam||drip?.asset||'',
      start:iso(start),einde:iso(end),duurUren:row.afgeleidUitHistorie?(num(row.duurUren)):duur(start,end,row.duurUren,peil),
      bron:row.bron||'Open-storingenmomentopname',wind:sp.wind,ria4:sp.ria4,
      matchMethode:resolved?.method||'',matchScore:resolved?.score||null
    };
    out.operationeleStatus=operationeleStatus(asset,out);
    return out;
  }
  function allFaults(){return baseFaults().map(enrichBase);}
  hub.faults=allFaults;
  if(baseDetail)hub.detail=function(key){const d=baseDetail(key)||{};return {...d,faults:allFaults().filter(f=>String(f.assetKey)===String(key))};};
  hub.__bidashFaultsExtended=true;
})();
