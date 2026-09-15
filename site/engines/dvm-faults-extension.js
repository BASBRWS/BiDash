/* Verrijk de publieke DVM-HUB met presentatiegegevens voor Assetmanagement > Open storingen.
   Geen nieuwe impactberekening: DRIP-historie blijft prognosebron, maar aantoonbaar
   open DRIP-incidenten worden tevens als actuele melding aangeboden. */
(() => {
  const hub=window.HUB;if(!hub||hub.__bidashFaultsExtended)return;
  const baseFaults=typeof hub.faults==='function'?hub.faults.bind(hub):()=>[];
  const baseDetail=typeof hub.detail==='function'?hub.detail.bind(hub):null;
  const yes=v=>v===true||v===1||/^(1|ja|yes|true|x)$/i.test(String(v??'').trim());
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const iso=v=>{const n=num(v),d=new Date(n!=null?n:v);return Number.isFinite(d.getTime())?d.toISOString():'';};
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  const openDrip=x=>{
    if(!x||typeof x!=='object')return false;
    if(x.censored===true)return true;
    if(/\b(open|openstaand|actief|onopgelost|niet\s*hersteld)\b/i.test(String(x.technischeToestand||'')))return true;
    return x.einde==null&&(x.duurUren==null||!Number.isFinite(Number(x.duurUren)));
  };
  const assets=()=>{try{return ASSET_REGISTER_STATE?.assets||[];}catch(e){return [];}};
  const drips=()=>{try{return ((STATE&&STATE.drips)||DRIP_STATE)?.drips||[];}catch(e){return [];}};
  const assetByKey=key=>key?assets().find(a=>a.key===key):null;
  const dripByIncident=x=>{
    const ds=drips();
    return ds.find(d=>(x.matchAssetKey&&(d._assetKey===x.matchAssetKey||d.assetKey===x.matchAssetKey))||(x.matchUid&&d.uid===x.matchUid)||(x.code&&String(d.histCode||d.idCdms||'').toUpperCase()===String(x.code).toUpperCase()))||null;
  };
  function specialListMatch(kind,...objects){
    const refs=window.DVM_SPECIAL_DRIP_LISTS?.[kind]?.identifiers||[];
    if(!refs.length)return false;
    const set=new Set(refs.map(r=>norm(r.token||r.raw||r)).filter(Boolean));
    const vals=[];
    for(const x of objects.filter(Boolean))vals.push(x.entityid,x.id,x.key,x.naam,x.asset,x.code,x.idCdms,x.histCode,x.uid,x.osid,x.logId,x.dynac,x.cdms);
    return vals.some(v=>set.has(norm(v)));
  }
  const special=(asset,drip,incident)=>{
    const vals=[asset,drip,incident].filter(Boolean);
    const text=vals.flatMap(x=>[x.asset,x.naam,x.type,x.model,x.hardware,x.functie,x.opmerking]).join(' ').toLowerCase();
    return {
      wind:vals.some(x=>yes(x.wind)||yes(x.windwaarschuwing)||yes(x.specialWind))||specialListMatch('wind',asset,drip,incident)||/windwaarschuw/.test(text),
      ria4:vals.some(x=>yes(x.ria4)||yes(x.ria_4)||yes(x['ria-4'])||yes(x.specialRia4))||specialListMatch('ria4',asset,drip,incident)||/\bria\s*[- ]?4\b/.test(text)
    };
  };
  const duur=(start,einde,expliciet,peil)=>{
    const d=num(expliciet);if(d!=null&&d>=0)return d;
    const a=num(start),b=num(einde)??num(peil);return a!=null&&b!=null&&b>=a?(b-a)/36e5:null;
  };
  function enrichBase(row,i){
    let m=null;try{m=STATE?.meldingen?.[i]||null;}catch(e){}
    const asset=assetByKey(row.assetKey||m?.assetKey),drip=asset?.tp==='DRIP'?drips().find(d=>(d._assetKey||d.assetKey)===asset.key):null;
    const sp=special(asset,drip,m||row);
    let peil=null;try{peil=STATE?.peildatum||LIVE_PEILDATUM||Date.now();}catch(e){peil=Date.now();}
    const start=m?.tVan??m?.t??m?.start??null,end=m?.tTot??m?.einde??null;
    return {...row,
      typeId:row.typeId||m?.typeId||asset?.tp||'',
      rd:row.rd||m?.rd||asset?.rd||'',district:row.district||m?.district||asset?.district||'',
      vc:row.vc||m?.vc||asset?.vc||'',
      naam:row.naam||m?.assetNaam||asset?.naam||'',
      start:iso(start),einde:iso(end),duurUren:duur(start,end,m?.duur,peil),
      bron:row.bron||'Open-storingenmomentopname',wind:sp.wind,ria4:sp.ria4
    };
  }
  function openDripFaults(){
    let hist=null;try{hist=DRIP_HIST_STATE;}catch(e){}
    if(!hist||!Array.isArray(hist.incidenten))return [];
    const peil=num(hist.tot)??Date.now();
    return hist.incidenten.filter(openDrip).map((x,i)=>{
      const d=dripByIncident(x),key=x.matchAssetKey||d?._assetKey||d?.assetKey||'',asset=assetByKey(key),sp=special(asset,d,x);
      const naam=asset?.naam||d?.asset||d?.idCdms||x.asset||x.code||`DRIP ${i+1}`;
      const detail=x.alarmmeldingen||x.classificatie||x.technischeToestand||'Openstaande DRIP-storing';
      return {id:`drip-open-${x.code||i}-${x.start||i}`,assetKey:key,naam,typeId:'DRIP',
        weg:asset?.weg||d?.weg||x.weg||'',richting:asset?.richting||d?.richting||x.richting||'',
        hm:asset?.hm??d?.hm??x.hm??null,vc:asset?.vc||d?.vc||x.vc||'',rd:asset?.rd||d?.rd||'',district:asset?.district||d?.district||'',
        code:x.code||d?.histCode||d?.idCdms||'',impact:null,prestatie:null,omschrijving:detail,
        start:iso(x.start),einde:'',duurUren:duur(x.start,null,x.duurUren,peil),
        bron:x.sourceName||'DRIP-storingshistorie',wind:sp.wind,ria4:sp.ria4,afgeleidUitHistorie:true};
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
  if(baseDetail)hub.detail=function(key){const d=baseDetail(key)||{};return {...d,faults:allFaults().filter(f=>f.assetKey===key)};};
  hub.__bidashFaultsExtended=true;
})();
