
/* ══════════════════════════════════════════════════════════════
   DOORREKENING — zes stappen, exact conform demo5.html
   ══════════════════════════════════════════════════════════════ */
let STATE = null;

/* ══════════════════════════════════════════════════════════════
   DATA-LAADSTRAAT EN GEREEDHEIDSPOORT

   Bronbestanden worden eerst ingelezen en inhoudelijk beoordeeld. De
   doorrekening start pas wanneer de bronset voor de betreffende analyse
   compleet genoeg is. Expliciete EOL heeft voorrang. Waar die ontbreekt,
   gebruikt het model alleen zichtbare en instelbare generieke terugvalwaarden.
   ══════════════════════════════════════════════════════════════ */
const DATA_DREMPELS=Object.freeze({
  historieDagen:365,
  typeIncidenten:20,
  typeMaanden:12,
  assetIncidenten:5,
  assetDuren:3,
  koppelDekking:0.70,
  bouwjaarDekking:0.70,
  eolDekking:0.70,
  levensduurDekking:0.70
});
const ASSET_LABEL={MSI:'MSI / matrixsignaalgevers',CAM:'Wegkantcamera\u2019s',LUS:'Detectielussen',WISSELBORD:'Wisselborden',DRIP:'DRIP'};
let STORINGSBRONNEN=[];
let STORINGS_INSPECTIE=null;
// Historische bronnen en actuele open storingen zijn bewust twee gescheiden
// gegevensstromen. Alleen HISTORIE_STATE/MC_HISTORIE_LIVE kalibreert Monte
// Carlo; alleen STATE wordt op de live prestatie- en diensttabs getoond.
let HISTORIE_STATE=null;
let LIVE_STORINGSBRONNEN=[];
let LIVE_STORINGS_INSPECTIE=null;
let LIVE_PEILDATUM=null;
let U_ROUTE_STATE=null;
let WERK_STATE=null;
const WERK_BUFFER_KM=2;
let ASSET_REGISTER_STATE=null;
let ASSET_INDEX=null;
let ASSET_MATCH_STATE=null;
let ASSET_CONFIG_VERSIE=0;
let ASSET_CFG_UI={subtab:'regels',query:'',type:'',pendingLogId:'',focusKey:''};
let EOL_BRON_NAAM='';
let EOL_VERSIE=0;
let ANALYSE_SIGNATURE='';
let MC_HISTORIE_LIVE=null;
// De historie-doorrekening is zwaar bij grote signaalgeverbestanden. Ze wordt
// pas gebouwd zodra het prognosetabblad wordt geopend of een simulatie start;
// tot dan markeert deze vlag dat er wél bruikbare historie klaarstaat.
let HISTORIE_UITGESTELD=false;
let TOTAAL_IMPORT_GELADEN=false;

function normAssetTekst(v){
  return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
}
function normAssetVc(v){
  let s=String(v==null?'':v).trim().toUpperCase().replace(/^VC/,'');
  if(s==='WNN')s='NWN';
  if(s==='WNZ')s='ZWN';
  return VC_MAP[s]||s;
}
function normAssetRichting(v){
  const s=String(v==null?'':v).trim().toUpperCase();
  if(['L','LI','LINKS'].includes(s))return 'LI';
  if(['R','RE','RECHTS'].includes(s))return 'RE';
  return s;
}
function assetStrookUitNaam(v){
  const m=String(v||'').trim().match(/(?:\s|_)(\d{1,2})\s*$/);
  return m?String(parseInt(m[1],10)):'';
}
function assetConfigBasis(){
  if(!RULES.assetConfig)RULES.assetConfig={hmTolerantieKm:.35,aliases:{},uitgeslotenLogIds:{},overrides:{}};
  RULES.assetConfig.aliases=RULES.assetConfig.aliases||{};
  RULES.assetConfig.aliasLabels=RULES.assetConfig.aliasLabels||{};
  RULES.assetConfig.uitgeslotenLogIds=RULES.assetConfig.uitgeslotenLogIds||{};
  RULES.assetConfig.uitgeslotenLabels=RULES.assetConfig.uitgeslotenLabels||{};
  RULES.assetConfig.overrides=RULES.assetConfig.overrides||{};
  return RULES.assetConfig;
}
function assetOverrideVoor(key){
  const c=assetConfigBasis();return key&&c.overrides[key]?c.overrides[key]:null;
}
function assetLogId(m,typeId){
  const expliciet=String((m&&(m.logId||m.code||m.osid||m.asset||m.idCdms))||'').trim();
  if(expliciet)return expliciet;
  return [typeId||'',m&&m.weg||'',m&&m.richting||'',m&&m.hm!=null?Number(m.hm).toFixed(3):'',m&&m.strook||''].join(' ' ).trim();
}
function assetLogSleutel(v){return normAssetTekst(v);}
function assetKeyVoor(tp,entityid,naam){
  const id=String(entityid||'').trim();
  return id?'ID:'+id.toUpperCase():(String(tp||'ASSET').toUpperCase()+':'+normAssetTekst(naam));
}
function voegAssetIndex(map,key,asset){
  if(!key)return;const a=map.get(key)||[];a.push(asset);map.set(key,a);
}
function bouwAssetIndex(){
  if(!ASSET_REGISTER_STATE||!ASSET_REGISTER_STATE.assets){ASSET_INDEX=null;return null;}
  const byKey=new Map(),byExact=new Map(),byCode=new Map(),byTypeRoad=new Map(),byRoad=new Map(),byGrid=new Map(),gridSize=5000;
  ASSET_REGISTER_STATE.assets.forEach(a=>{
    byKey.set(a.key,a);
    [a.entityid,a.naam].forEach(v=>voegAssetIndex(byExact,normAssetTekst(v),a));
    if(a.code)voegAssetIndex(byCode,normDripCode(a.code),a);
    voegAssetIndex(byTypeRoad,[a.tp,a.weg].join('|'),a);
    if(a.prognoseActief){voegAssetIndex(byRoad,a.weg,a);if(geldigeRdCoord(a.rdX,a.rdY))voegAssetIndex(byGrid,Math.floor(a.rdX/gridSize)+'|'+Math.floor(a.rdY/gridSize),a);}
  });
  ASSET_INDEX={byKey,byExact,byCode,byTypeRoad,byRoad,byGrid,gridSize,aantal:ASSET_REGISTER_STATE.assets.length};
  window.DVM_ASSET_INDEX=ASSET_INDEX;
  return ASSET_INDEX;
}
function handmatigeAssetVoor(logId,typeId){
  if(!ASSET_INDEX)return null;
  const cfg=assetConfigBasis(),lk=assetLogSleutel(logId),key=cfg.aliases[lk];
  const a=key?ASSET_INDEX.byKey.get(key):null;
  return a&&(!typeId||a.tp===typeId)?a:null;
}
function dripLocatiePast(source,candidate){
  if(!source||!candidate)return false;
  const road=x=>String(x||'').trim().toUpperCase();
  if(source.weg&&candidate.weg&&road(source.weg)!==road(candidate.weg))return false;
  if(source.richting&&candidate.richting&&normAssetRichting(source.richting)!==normAssetRichting(candidate.richting))return false;
  if(source.hm!=null&&candidate.hm!=null&&Math.abs(Number(source.hm)-Number(candidate.hm))>Math.max(.01,Number(assetConfigBasis().hmTolerantieKm)||.35))return false;
  return true;
}
function koppelMeldingAanAsset(m,typeId){
  const logId=assetLogId(m,typeId),logKey=assetLogSleutel(logId),cfg=assetConfigBasis();
  if(!ASSET_INDEX)return {asset:null,status:'geen-register',logId,logKey,suggesties:[]};
  if(cfg.uitgeslotenLogIds[logKey])return {asset:null,status:'buiten-areaal',logId,logKey,suggesties:[]};
  const hand=handmatigeAssetVoor(logId,typeId);
  if(hand&&typeId==='DRIP'&&!dripLocatiePast(m,hand))return {asset:null,status:'locatieconflict',reden:'Opgeslagen DRIP-koppeling wijkt af van de bronlocatie.',logId,logKey,suggesties:[hand]};
  if(hand)return {asset:hand,status:'gekoppeld',methode:'handmatige alias',afstand:null,logId,logKey,suggesties:[hand]};

  let exact=[];
  [logId,m&&m.osid,m&&m.asset,m&&m.entityid].forEach(v=>{
    const k=normAssetTekst(v);if(k&&(ASSET_INDEX.byExact.get(k)||[]).length)exact.push(...ASSET_INDEX.byExact.get(k));
  });
  if(typeId)exact=exact.filter(a=>a.tp===typeId);
  if(typeId==='DRIP')exact=exact.filter(a=>dripLocatiePast(m,a));
  exact=[...new Map(exact.map(a=>[a.key,a])).values()];
  if(exact.length===1)return {asset:exact[0],status:'gekoppeld',methode:'exacte asset-id',afstand:0,logId,logKey,suggesties:exact};

  if(typeId==='DRIP'){
    const code=normDripCode((m&&(m.code||m.asset||m.osid))||logId);
    let cands=((code&&ASSET_INDEX.byCode.get(code))||[]).filter(a=>dripLocatiePast(m,a));
    if(cands.length>1){
      const vc=normAssetVc(m&&m.vc);const regionaal=cands.filter(a=>!vc||!a.vc||normAssetVc(a.vc)===vc);if(regionaal.length)cands=regionaal;
    }
    if(cands.length===1)return {asset:cands[0],status:'gekoppeld',methode:'DRIP-code',afstand:0,logId,logKey,suggesties:cands};
    if(cands.length)exact.push(...cands);
  }

  const weg=String(m&&m.weg||'').trim().toUpperCase(),richting=normAssetRichting(m&&m.richting),vc=normAssetVc(m&&m.vc);
  const hm=m&&m.hm!=null&&!isNaN(m.hm)?Number(m.hm):null;
  const strook=String(m&&m.strook||'').replace(/\D/g,'').replace(/^0+/,'');
  let pool=(weg&&ASSET_INDEX.byTypeRoad.get([typeId,weg].join('|')))||[];
  if(richting){const p=pool.filter(a=>!a.richting||normAssetRichting(a.richting)===richting);if(p.length)pool=p;}
  if(vc){const p=pool.filter(a=>!a.vc||normAssetVc(a.vc)===vc);if(p.length)pool=p;}
  if(typeId==='DRIP')pool=pool.filter(a=>dripLocatiePast(m,a));
  const rang=pool.map(a=>{
    const afstand=hm!=null&&a.hm!=null?Math.abs(a.hm-hm):null;
    let score=afstand==null?10:afstand;
    if(strook){score+=a.strook===strook?-.05:.45;}
    return {a,afstand,score};
  }).sort((x,y)=>x.score-y.score||String(x.a.naam).localeCompare(String(y.a.naam)));
  const suggesties=[...exact,...rang.slice(0,5).map(x=>x.a)];
  const uniekSuggesties=[...new Map(suggesties.map(a=>[a.key,a])).values()].slice(0,5);
  if(hm==null||!rang.length)return {asset:null,status:'niet-gekoppeld',reden:weg?'Geen unieke locatiekoppeling mogelijk.':'Weg en hectometrering ontbreken.',logId,logKey,suggesties:uniekSuggesties};
  const tol=Math.max(.01,Number(cfg.hmTolerantieKm)||.35),best=rang[0],tweede=rang[1];
  const binnen=best.afstand!=null&&best.afstand<=tol;
  const uniek=!tweede||Math.abs(tweede.score-best.score)>.005||!!(strook&&best.a.strook===strook&&tweede.a.strook!==strook);
  if(binnen&&uniek)return {asset:best.a,status:'gekoppeld',methode:'locatie'+(strook&&best.a.strook===strook?' + strook':''),afstand:best.afstand,logId,logKey,suggesties:uniekSuggesties};
  return {asset:null,status:'niet-gekoppeld',reden:binnen?'Meerdere assets passen even goed; handmatige keuze nodig.':`Geen asset binnen ${tol.toFixed(2).replace('.',',')} km.`,afstand:best.afstand,logId,logKey,suggesties:uniekSuggesties};
}
function pasAssetKoppelingToe(m,k){
  m.assetMatchStatus=k.status;m.assetMatchMethode=k.methode||'';m.assetMatchAfstand=k.afstand;
  m.assetLogId=k.logId;m.assetSuggesties=k.suggesties||[];
  if(!k.asset)return m;
  const a=k.asset;m.logWeg=m.weg;m.logRichting=m.richting;m.logHm=m.hm;
  m.assetKey=a.key;m.assetNaam=a.naam;m.assetEntityid=a.entityid;
  m.weg=a.weg||m.weg;m.richting=a.richting||m.richting;m.hm=a.hm!=null?a.hm:m.hm;
  m.rd=a.rd||m.rd;m.district=a.district||m.district;m.districtBron=a.districtBron||m.districtBron;m.vc=a.vc||m.vc;
  m.rdX=a.rdX!=null?a.rdX:null;m.rdY=a.rdY!=null?a.rdY:null;
  m.assetBouwjaar=a.bouwjaar;m.assetEol=a.eolLevensduur;m.assetFabrikant=a.fabrikant;m.assetModel=a.model;
  return m;
}
function herbouwAssetMatchBeeld(){
  if(!ASSET_INDEX){ASSET_MATCH_STATE=null;return null;}
  const groepen=new Map(),matchedAssets=new Set();let totaal=0,gekoppeld=0,uitgesloten=0;
  const voeg=(m,tp,bron)=>{
    totaal++;const k=koppelMeldingAanAsset(m,tp);
    if(k.asset){gekoppeld++;matchedAssets.add(k.asset.key);return;}
    if(k.status==='buiten-areaal'){uitgesloten++;return;}
    const id=k.logId||assetLogId(m,tp),sleutel=[tp,assetLogSleutel(id)].join('|');
    const g=groepen.get(sleutel)||{id,typeId:tp,n:0,bronnen:new Set(),weg:m.weg||'',richting:m.richting||'',hm:m.hm,reden:k.reden||'Geen assetmatch.',suggesties:k.suggesties||[]};
    g.n++;g.bronnen.add(bron||'storingslog');if((!g.suggesties||!g.suggesties.length)&&k.suggesties)g.suggesties=k.suggesties;groepen.set(sleutel,g);
  };
  const gezien=new Set();
  gecombineerdeStoringsRijen().forEach(raw=>{
    const m=normRij(raw),tp=classificeer(m);if(!tp)return;
    const s=[m.eventId,m.osid,m.tVan,m.tTot,m.melding].join('|');if(gezien.has(s))return;gezien.add(s);voeg(m,tp,'DVM-log');
  });
  gecombineerdeLiveStoringsRijen().forEach(raw=>{
    const m=normRij(raw),tp=classificeer(m);if(!tp)return;
    const s=['LIVE',m.eventId,m.osid,m.tVan,m.tTot,m.melding].join('|');if(gezien.has(s))return;gezien.add(s);voeg(m,tp,'open-storingenlijst');
  });
  const H=typeof DRIP_HIST_STATE!=='undefined'?DRIP_HIST_STATE:null;
  if(H&&H.incidenten)H.incidenten.forEach(x=>voeg({...x,logId:x.code||x.asset},'DRIP',x.sourceName||'DRIP-log'));
  const lijst=[...groepen.values()].map(g=>({...g,bronnen:[...g.bronnen]})).sort((a,b)=>b.n-a.n||a.id.localeCompare(b.id));
  ASSET_MATCH_STATE={totaal,gekoppeld,uitgesloten,nietGekoppeld:totaal-gekoppeld-uitgesloten,gekoppeldeAssets:matchedAssets.size,groepen:lijst,bijgewerkt:new Date().toISOString()};
  window.DVM_ASSET_MATCH=ASSET_MATCH_STATE;
  return ASSET_MATCH_STATE;
}

function uniekeWaarden(a){return [...new Set((a||[]).filter(x=>x!=null&&x!==''))];}
function pct0(v){return Math.round(Math.max(0,Math.min(1,v||0))*100)+'%';}
function maandSleutel(t){const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function assetTypeMttrUren(tp){
  const at=assetTypeRec(tp)||{};
  const v=+at.mttr;
  return v>0?v:(+RULES.cfg.hw_mttr>0?+RULES.cfg.hw_mttr:6);
}
function assetNaamUitMelding(m,tp){
  if(m.osid)return m.osid;
  return (ASSET_LABEL[tp]||tp)+' · '+m.weg+(m.richting?' '+m.richting:'')+(m.hm!=null?' hm '+m.hm:'');
}

/* Lichtgewicht broninspectie. Dit classificeert en telt, maar berekent nog
   geen dienstpercentages of prognose. */
function inspecteerStoringsRijen(rijen){
  const typen={},gezien=new Set(); let herkenbaar=0;
  (rijen||[]).forEach(raw=>{
    const m=normRij(raw);
    const tp=classificeer(m); if(!tp)return;
    const koppeling=ASSET_INDEX?koppelMeldingAanAsset(m,tp):null;
    if(koppeling)pasAssetKoppelingToe(m,koppeling);
    if(!m.weg)return;
    const tijd=m.tVan||m.tTot||null;
    const sleutel=[m.eventId||'',m.osid||'',m.weg,m.richting,m.hm,tijd||'',m.melding].join('|');
    if(gezien.has(sleutel))return; gezien.add(sleutel); herkenbaar++;
    const g=typen[tp]||(typen[tp]={typeId:tp,n:0,tijden:[],maanden:new Set(),duurN:0,assets:{},matchN:0,ongekoppeldN:0,uitgeslotenN:0});
    g.n++;
    const prognoseRij=!ASSET_INDEX||!!(koppeling&&koppeling.asset);
    if(koppeling&&koppeling.asset)g.matchN++;else if(koppeling&&koppeling.status==='buiten-areaal')g.uitgeslotenN++;else if(ASSET_INDEX)g.ongekoppeldN++;
    if(prognoseRij&&tijd){g.tijden.push(tijd);g.maanden.add(maandSleutel(tijd));}
    // Alleen gemeten herstelduren tellen als duurdekking; een afgeleide duur niet.
    if(prognoseRij&&m.duurBetrouwbaar)g.duurN++;
    if(!prognoseRij)return;
    const naam=m.assetNaam||assetNaamUitMelding(m,tp);
    const a=g.assets[naam]||(g.assets[naam]={naam,n:0,tijden:[],duurN:0,maanden:new Set()});
    a.n++; if(tijd){a.tijden.push(tijd);a.maanden.add(maandSleutel(tijd));} if(m.duurBetrouwbaar)a.duurN++;
  });
  Object.values(typen).forEach(g=>{
    g.prognoseN=ASSET_INDEX?g.matchN:g.n;
    g.dekkingDagen=g.tijden.length>1?(Math.max(...g.tijden)-Math.min(...g.tijden))/86400e3:0;
    g.maandenN=g.maanden.size;
    g.assetsAlle=Object.values(g.assets).map(a=>{
      a.dekkingDagen=a.tijden.length>1?(Math.max(...a.tijden)-Math.min(...a.tijden))/86400e3:0;
      a.genoeg=a.n>=DATA_DREMPELS.assetIncidenten&&a.duurN>=DATA_DREMPELS.assetDuren&&a.dekkingDagen>=DATA_DREMPELS.historieDagen;
      return a;
    }).sort((a,b)=>b.n-a.n||a.naam.localeCompare(b.naam));
    g.assetsGenoeg=g.assetsAlle.filter(a=>a.genoeg);
    // De landelijke/typeprognose wordt op de gepoolde typehistorie gekalibreerd.
    // Een individuele asset met vijf storingen blijft nuttig voor lokale
    // kalibratie, maar mag de volledige Monte Carlo-poort niet blokkeren.
    g.koppelPct=ASSET_INDEX?g.matchN/Math.max(g.matchN+g.ongekoppeldN,1):1;
    g.frequentieGenoeg=g.prognoseN>=DATA_DREMPELS.typeIncidenten&&g.dekkingDagen>=DATA_DREMPELS.historieDagen&&g.maandenN>=DATA_DREMPELS.typeMaanden&&g.koppelPct>=DATA_DREMPELS.koppelDekking;
    g.mttrBron=g.duurN>=DATA_DREMPELS.assetDuren?'gekoppelde historische duren':`assettype-MTTR ${fmt(assetTypeMttrUren(g.typeId),1)} uur`;
    g.mttrTerugval=g.duurN<DATA_DREMPELS.assetDuren;
    g.genoeg=g.frequentieGenoeg;
    delete g.assets; delete g.tijden; delete g.maanden;
  });
  return {totaalRijen:(rijen||[]).length,herkenbaar,typen,typenGeladen:Object.keys(typen)};
}

function gecombineerdeStoringsRijen(){return STORINGSBRONNEN.flatMap(b=>b.rijen||[]);}
function gecombineerdeLiveStoringsRijen(){return LIVE_STORINGSBRONNEN.flatMap(b=>b.rijen||[]);}

function kwantielWaarde(vals,q){
  if(!vals.length)return null;const p=(vals.length-1)*q,i=Math.floor(p),f=p-i;
  return vals[i]+(vals[Math.min(vals.length-1,i+1)]-vals[i])*f;
}
function bouwLiveMcHistorie(st){
  if(!st||!st.wegdelen||!STORINGS_INSPECTIE||!STORINGS_INSPECTIE.typen.MSI)return null;
  const dekkingJr=Math.max(STORINGS_INSPECTIE.typen.MSI.dekkingDagen/365.25,1/52);
  /* Alleen gemeten herstelduren vormen de duurverdeling. Een duur die is
     afgeleid uit de peildatum van een nieuwe momentopname is een bovengrens en
     zou de MTTR laten meegroeien met de afstand tussen twee momentopnamen. */
  const alleDuren=st.meldingen.filter(m=>m.typeId==='MSI'&&(!ASSET_INDEX||m.assetKey)&&m.duurBetrouwbaar).map(m=>m.duurUren/24).sort((a,b)=>a-b);
  if(!alleDuren.length)return null;
  const ankers=vals=>Array.from({length:21},(_,i)=>Math.max(1/6,kwantielWaarde(vals,i/20)));
  const globaal=ankers(alleDuren),wegdelen={};
  st.wegdelen.forEach(wd=>{
    const ms=wd.meldingen.filter(m=>m.typeId==='MSI'&&(!ASSET_INDEX||m.assetKey));if(!ms.length)return;
    const lokaal=ms.filter(m=>m.duurBetrouwbaar).map(m=>m.duurUren/24).sort((a,b)=>a-b);
    const fvc=VC_MAP[String(wd.vc||'').toUpperCase()]||String(wd.vc||'').toUpperCase();
    const key=fvc+'|'+wd.weg+(wd.richting?(' '+wd.richting):'');
    wegdelen[key]={events:ms.length,rate:ms.length/dekkingJr,durP:lokaal.length>=DATA_DREMPELS.assetDuren?ankers(lokaal):globaal,bron:lokaal.length>=DATA_DREMPELS.assetDuren?'geladen-log-wegdeel':'geladen-log-groepsduur'};
  });
  return {periodeJr:dekkingJr,wegdelen,bronbestanden:STORINGSBRONNEN.map(b=>b.naam)};
}
function heeftStoringsdata(){return !!(STORINGSBRONNEN.length||(typeof DRIP_HIST_STATE!=='undefined'&&DRIP_HIST_STATE&&DRIP_HIST_STATE.incidenten&&DRIP_HIST_STATE.incidenten.length));}
function heeftLiveStoringsdata(){return !!(LIVE_STORINGSBRONNEN.length&&LIVE_STORINGS_INSPECTIE&&LIVE_STORINGS_INSPECTIE.herkenbaar);}
function prognoseBasisState(){return HISTORIE_STATE||null;}
/* Bouwt de uitgestelde historie-doorrekening alsnog, precies zoals
   probeerAnalyseActiveren dat vroeger meteen deed. Wordt aangeroepen zodra de
   prognose daadwerkelijk nodig is (tabblad openen of simulatie starten), zodat
   het laden van een grote signaalgeverbron de pagina niet blokkeert. */
function zorgHistorieState(){
  if(!HISTORIE_UITGESTELD)return HISTORIE_STATE;
  HISTORIE_UITGESTELD=false;
  if(berekenGereedheid().logsAlg&&STORINGSBRONNEN.length){
    const hr=gecombineerdeStoringsRijen();HISTORIE_STATE=doorrekenen(hr);HISTORIE_STATE.bestand=STORINGSBRONNEN.map(b=>b.naam).join(' + ');HISTORIE_STATE.ruweRijen=hr;
    MC_HISTORIE_LIVE=bouwLiveMcHistorie(HISTORIE_STATE);
  }else{HISTORIE_STATE=null;MC_HISTORIE_LIVE=null;}
  return HISTORIE_STATE;
}
function mcHistorieBron(){return MC_HISTORIE_LIVE||MC_HISTORIE;}
function relevanteTypen(alleen){
  if(alleen&&alleen.length)return uniekeWaarden(alleen);
  const a=STORINGS_INSPECTIE?Object.keys(STORINGS_INSPECTIE.typen):[];
  if(typeof DRIP_HIST_STATE!=='undefined'&&DRIP_HIST_STATE&&DRIP_HIST_STATE.incidenten.length)a.push('DRIP');
  return uniekeWaarden(a);
}

function telDistrict(map,key,district){
  if(!key||!districtBekend(district))return;
  const m=map.get(key)||new Map();
  m.set(district,(m.get(district)||0)+1);
  map.set(key,m);
}
function uniekDistrict(map,key){
  const m=map.get(key);if(!m||!m.size)return '';
  const vals=[...m.entries()].sort((a,b)=>b[1]-a[1]);
  return vals.length===1?vals[0][0]:'';
}
function districtAfleidKeys(a){
  const rd=normRd(a.rd),weg=String(a.weg||'').trim().toUpperCase(),richting=normAssetRichting(a.richting||'');
  return {
    exact:rd&&weg&&richting?`${rd}|${weg}|${richting}`:'',
    weg:rd&&weg?`${rd}|${weg}`:''
  };
}
function vulDistrictenAanUitRegister(assets){
  const exact=new Map(),weg=new Map(),stats={bron:0,afgeleid:0,ontbreekt:0,dubbelzinnig:0};
  (assets||[]).forEach(a=>{
    if(!districtBekend(a.district))return;
    const k=districtAfleidKeys(a);
    telDistrict(exact,k.exact,a.district);
    telDistrict(weg,k.weg,a.district);
  });
  (assets||[]).forEach(a=>{
    if(districtBekend(a.district)){a.districtBron=a.districtBron||'bron';stats.bron++;return;}
    const k=districtAfleidKeys(a);
    const ex=uniekDistrict(exact,k.exact),rw=uniekDistrict(weg,k.weg);
    if(ex){a.district=ex;a.districtBron='afgeleid: RD + weg + richting';stats.afgeleid++;return;}
    if(rw){a.district=rw;a.districtBron='afgeleid: RD + weg';stats.afgeleid++;return;}
    a.district='';a.districtBron=(exact.get(k.exact)||weg.get(k.weg))?'dubbelzinnig':'ontbreekt';
    if(a.districtBron==='dubbelzinnig')stats.dubbelzinnig++;else stats.ontbreekt++;
  });
  return stats;
}

function eolWaardeUitRegister(row){
  const datumBron=registerWaardeBron(row,EOL_DATUM_KEYS);
  const levenBron=registerWaardeBron(row,LEVENSDUUR_KEYS);
  const datum=datumBron.waarde,leven=levenBron.waarde;
  const jaar=parseBouwjaar(datum),lev=num(leven);
  return {expliciet:!!(jaar||(lev!=null&&lev>0)),jaar,jaarBron:jaar?datumBron.kolom:'',
    levensduur:lev!=null&&lev>0?lev:null,levensduurBron:lev!=null&&lev>0?levenBron.kolom:''};
}

/* Bouw één registerbeeld voor areaal, bouwjaar en EOL. */
function analyseerAssetRegister(rijen,bestand){
  const assets=[],areaal={};
  (rijen||[]).forEach(row=>{
    const tp=registerAssetType(row,registerWaarde); if(!tp)return;
    const status=String(registerWaarde(row,['status'])||'').trim();
    const prognoseActief=statusActiefVoorPrognose(status);
    const loc=assetLocatie(row,registerWaarde);
    const naamBron=String(registerWaarde(row,['asset'])||'').trim();
    const codeBron=tp==='DRIP'?normDripCode(naamBron):'';
    if(!loc.weg&&!codeBron)return;
    if(!loc.weg)loc.weg='ONBEKEND';
    const bestuur=bestuurlijkeContextUitRow(row,registerWaarde);
    const contractCtx=contractContextUitRow(row,registerWaarde);
    const vc=bestuur.vc;
    const installatieBron=registerWaardeBron(row,INSTALLATIE_DATUM_KEYS);
    const bouwjaar=parseBouwjaar(installatieBron.waarde);
    const eol=eolWaardeUitRegister(row);
    const fabrikant=String(registerWaarde(row,['fabrikant','fabrikaat'])||'').trim();
    const model=String(registerWaarde(row,['hardware','type','model'])||'').trim();
    const entityid=String(registerWaarde(row,['entityid'])||'').trim();
    let rdX=num(registerWaarde(row,['rd-locatie-x','rd locatie x']));
    let rdY=num(registerWaarde(row,['rd-locatie-y','rd locatie y']));
    // Alleen geldige Nederlandse Rijksdriehoekscoördinaten opnemen. Zo kan een
    // tekstwaarde of een ander coördinatenstelsel niet als kaartpunt meetellen.
    if(!(rdX>=0&&rdX<=300000&&rdY>=280000&&rdY<=650000)){rdX=null;rdY=null;}
    const naam=naamBron||entityid||[tp,loc.weg,loc.richting,loc.hm].join(' ');
    const code=tp==='DRIP'?normDripCode(naam):'';
    const strook=assetStrookUitNaam(naam);
    const key=assetKeyVoor(tp,entityid,naam);
    const bronWind=tp==='DRIP'&&histBool(registerWaarde(row,['windwaarschuwing','wind','wind drip']));
    const bronRia4=tp==='DRIP'&&histBool(registerWaarde(row,['ria4','ria-4','ria 4']));
    assets.push({key,_assetKey:key,assetType:tp,tp,entityid,naam,asset:naam,code,strook,status,prognoseActief,
      rd:bestuur.rd,district:bestuur.district,districtBron:bestuur.districtBron,vc,weg:loc.weg,richting:loc.richting,hm:loc.hm,rdX,rdY,
      ingebruikname:installatieBron.waarde,bouwjaar,bouwjaarBron:bouwjaar?installatieBron.kolom:'',eol,
      fabrikant,model,type:model,aannemer:contractCtx.aannemer,contract:contractCtx.contract,leverancier:contractCtx.leverancier,
      wind:bronWind,ria4:bronRia4,sourceWind:bronWind,sourceRia4:bronRia4,specialWind:bronWind,specialRia4:bronRia4});
    if(!prognoseActief)return;
    if(!areaal[vc])areaal[vc]={};
    const areaalKey=loc.weg+(loc.richting?' '+loc.richting:'');
    const vak=areaal[vc][areaalKey]||(areaal[vc][areaalKey]={sig:0,cam:0,lus:0,drip:0});
    if(tp==='MSI')vak.sig++; else if(tp==='CAM')vak.cam++; else if(tp==='LUS')vak.lus++; else if(tp==='DRIP')vak.drip++;
  });
  const districtStats=vulDistrictenAanUitRegister(assets);
  ASSET_REGISTER_STATE={bestand,rijenN:(rijen||[]).length,assets,actiefN:assets.filter(a=>a.prognoseActief).length,areaal,perType:{},districtStats,geladenOp:new Date().toISOString()};
  if(typeof GEBIED_NETWERK_CACHE!=='undefined')GEBIED_NETWERK_CACHE=null;
  window.DVM_ASSET_REGISTER=ASSET_REGISTER_STATE;
  bouwAssetIndex();
  herberekenRegisterDekking();
  if(WERK_STATE)herkoppelWerkAssets();
  return ASSET_REGISTER_STATE;
}

function herberekenRegisterDekking(){
  if(!ASSET_REGISTER_STATE)return;
  if(ASSET_REGISTER_STATE._eolVersie===EOL_VERSIE&&ASSET_REGISTER_STATE._assetConfigVersie===ASSET_CONFIG_VERSIE&&ASSET_REGISTER_STATE.perType&&Object.keys(ASSET_REGISTER_STATE.perType).length)return;
  const per={},lifeByType={},betaByType={};
  const refCache=new Map();
  ASSET_REGISTER_STATE.assets.forEach(a=>{
    const rk=[a.tp,a.fabrikant,a.model].join('|').toLowerCase();
    if(!refCache.has(rk))refCache.set(rk,eolRegelVoor(a.fabrikant,a.model,a.tp));
    const ref=refCache.get(rk);
    a.eolRef=ref&&((ref.life_median!=null&&ref.life_median>0)||ref.eol_date)?ref:null;
    const ov=assetOverrideVoor(a.key),at=assetTypeRec(a.tp)||{};
    const comboOv=a.tp==='DRIP'?RULES.drip.levensduurOverride[dripComboKey(a.fabrikant,a.type)]:null;
    let registerLife=a.eol&&a.eol.levensduur>0?+a.eol.levensduur:null,registerBron=registerLife?'assetregister (levensduur)':null;
    if(registerLife==null&&a.eol&&a.eol.jaar&&a.bouwjaar&&a.eol.jaar>a.bouwjaar){registerLife=a.eol.jaar-a.bouwjaar;registerBron='assetregister (EOL-jaar minus installatiedatum)';}
    let refLife=a.eolRef&&a.eolRef.life_median>0?+a.eolRef.life_median:null,refBron=refLife?'EOL-referentie':null;
    if(refLife==null&&a.eolRef&&a.eolRef.eol_date&&a.bouwjaar){
      const refEolJaar=parseBouwjaar(a.eolRef.eol_date);
      if(refEolJaar&&refEolJaar>a.bouwjaar){refLife=refEolJaar-a.bouwjaar;refBron='EOL-referentie (EOL-jaar)';}
    }
    const eolLife=registerLife!=null?registerLife:refLife,eolBron=registerLife!=null?registerBron:refBron;
    const eolLifeBruikbaar=eolLife!=null&&eolLife>=1&&eolLife<=100;
    if(eolLifeBruikbaar){a.eolLevensduur=eolLife;a.eolLevensduurBron=eolBron;}
    else{a.eolLevensduur=null;a.eolLevensduurBron=null;}

    let life=null,lifeBron=null,lifeSoort=null;
    if(ov&&+ov.levensduur>0){life=+ov.levensduur;lifeBron='assetconfiguratie';lifeSoort='individueel';}
    else if(comboOv!=null&&!isNaN(comboOv)&&+comboOv>0){life=+comboOv;lifeBron='handmatig (fabrikant×type)';lifeSoort='fabrikant';}
    else if(registerLife!=null){life=registerLife;lifeBron=registerBron;lifeSoort='register';}
    else if(refLife!=null){life=refLife;lifeBron=refBron;lifeSoort='referentie';}
    else if(at.levensduur!=null&&+at.levensduur>0){life=+at.levensduur;lifeBron='assettype';lifeSoort='generiek';}
    else if(a.tp==='DRIP'&&RULES.drip.standaardLevensduur!=null&&+RULES.drip.standaardLevensduur>0){life=+RULES.drip.standaardLevensduur;lifeBron='standaard-terugval';lifeSoort='generiek';}
    const lifeBruikbaar=life!=null&&life>=1&&life<=100;
    a.modelLevensduur=lifeBruikbaar?life:null;a.modelLevensduurBron=lifeBruikbaar?lifeBron:null;a.modelLevensduurSoort=lifeBruikbaar?lifeSoort:null;
    if(!a.prognoseActief)return;
    if(lifeBruikbaar)(lifeByType[a.tp]||(lifeByType[a.tp]=[])).push({life,bron:lifeBron});
    (betaByType[a.tp]||(betaByType[a.tp]=[])).push(ov&&+ov.beta>0?+ov.beta:(at.beta||3));
    const g=per[a.tp]||(per[a.tp]={typeId:a.tp,actief:0,metBouwjaar:0,metExplicieteEol:0,metReferentieMatch:0,metRegisterLevensduur:0,metReferentieLevensduur:0,metIndividueleConfig:0,metFabrikantOverride:0,metGeneriekeLevensduur:0,metEffectieveLevensduur:0});
    g.actief++;if(a.bouwjaar)g.metBouwjaar++;if(a.eol&&a.eol.expliciet)g.metExplicieteEol++;if(a.eolRef)g.metReferentieMatch++;
    if(lifeBruikbaar){
      g.metEffectieveLevensduur++;
      if(lifeSoort==='register')g.metRegisterLevensduur++;
      else if(lifeSoort==='referentie')g.metReferentieLevensduur++;
      else if(lifeSoort==='individueel')g.metIndividueleConfig++;
      else if(lifeSoort==='fabrikant')g.metFabrikantOverride++;
      else if(lifeSoort==='generiek')g.metGeneriekeLevensduur++;
    }
    g.generiekeLevensduur=at.levensduur!=null?+at.levensduur:(a.tp==='DRIP'?+RULES.drip.standaardLevensduur:null);
    g.generiekeBeta=at.beta||3;
  });
  Object.values(per).forEach(g=>{
    g.eolGedekt=g.metRegisterLevensduur+g.metReferentieLevensduur;
    g.bouwjaarPct=g.actief?g.metBouwjaar/g.actief:0;
    g.eolPct=g.actief?g.eolGedekt/g.actief:0;
    g.modelPct=g.actief?g.metEffectieveLevensduur/g.actief:0;
    g.generiekPct=g.actief?g.metGeneriekeLevensduur/g.actief:0;
  });
  ASSET_REGISTER_STATE.perType=per;
  ASSET_REGISTER_STATE.reliabilityByType={};
  Object.entries(lifeByType).forEach(([tp,vals])=>{
    const s=vals.map(x=>x.life).sort((a,b)=>a-b),m=Math.floor(s.length/2);
    const lifeMedian=s.length%2?s[m]:(s[m-1]+s[m])/2;
    const bronnen={};vals.forEach(x=>{bronnen[x.bron]=(bronnen[x.bron]||0)+1;});
    const bs=(betaByType[tp]||[]).sort((a,b)=>a-b),bm=Math.floor(bs.length/2),betaMedian=bs.length?(bs.length%2?bs[bm]:(bs[bm-1]+bs[bm])/2):null;
    ASSET_REGISTER_STATE.reliabilityByType[tp]={lifeMedian,betaMedian,n:s.length,bronnen};
  });
  ASSET_REGISTER_STATE._eolVersie=EOL_VERSIE;
  ASSET_REGISTER_STATE._assetConfigVersie=ASSET_CONFIG_VERSIE;
}

function registerGereedVoor(types){
  const nodig=uniekeWaarden(types||[]),miss=[],waarschuwingen=[],details=[];
  if(!ASSET_REGISTER_STATE)return {areaal:false,leeftijd:false,asset:false,eol:false,model:false,alle:false,miss:['Assetlijst is nog niet geladen.'],waarschuwingen,details,typen:nodig};
  herberekenRegisterDekking();
  let areaal=true,leeftijd=true,eol=true,model=true;
  nodig.forEach(tp=>{
    const g=ASSET_REGISTER_STATE.perType[tp];
    if(!g||!g.actief){areaal=false;leeftijd=false;eol=false;model=false;miss.push(`${ASSET_LABEL[tp]||tp}: niet aanwezig in de assetlijst.`);return;}
    if(g.bouwjaarPct<DATA_DREMPELS.bouwjaarDekking){leeftijd=false;miss.push(`${ASSET_LABEL[tp]||tp}: bouwjaardekking ${pct0(g.bouwjaarPct)}, vereist ${pct0(DATA_DREMPELS.bouwjaarDekking)} voor een leeftijdsprognose.`);}
    if(g.modelPct<DATA_DREMPELS.levensduurDekking){model=false;miss.push(`${ASSET_LABEL[tp]||tp}: bruikbare levensduurdekking ${pct0(g.modelPct)}, vereist ${pct0(DATA_DREMPELS.levensduurDekking)}.`);}
    if(g.eolPct<DATA_DREMPELS.eolDekking){eol=false;waarschuwingen.push(`${ASSET_LABEL[tp]||tp}: expliciete EOL-dekking ${pct0(g.eolPct)}. Voor ${g.metGeneriekeLevensduur.toLocaleString('nl-NL')} assets wordt de generieke assettypewaarde gebruikt.`);}
    details.push(g);
  });
  return {areaal,leeftijd,asset:areaal,eol,model,alle:areaal&&leeftijd&&model,miss,waarschuwingen,details,typen:nodig};
}

function dripHistorieGereedheid(){
  const H=typeof DRIP_HIST_STATE!=='undefined'?DRIP_HIST_STATE:null;
  if(!H)return {geladen:false,genoeg:false,assetsGenoeg:[],reden:'Geen DRIP-storingshistorie geladen.'};
  const assets=(H.assetStats||[]).filter(a=>a.n>=DATA_DREMPELS.assetIncidenten&&a.duurN>=DATA_DREMPELS.assetDuren&&a.dekkingDagen>=DATA_DREMPELS.historieDagen);
  const basis=H.incidenten.length>=DATA_DREMPELS.typeIncidenten&&H.dekkingDagen>=DATA_DREMPELS.historieDagen;
  const gekoppeld=!!(H.koppeling&&H.koppeling.gekoppeldeAssets);
  let reden='';
  if(H.dekkingDagen<DATA_DREMPELS.historieDagen)reden=`${H.dekkingDagen} gedekte dagen; minimaal ${DATA_DREMPELS.historieDagen} nodig.`;
  else if(H.incidenten.length<DATA_DREMPELS.typeIncidenten)reden=`${H.incidenten.length} incidenten; minimaal ${DATA_DREMPELS.typeIncidenten} nodig.`;
  else if(!gekoppeld)reden='Historie is lang genoeg; laad de assetlijst om de assetnamen te koppelen.';
  else if(!assets.length)reden='Geen gekoppelde DRIP heeft minimaal 5 incidenten, 3 duurwaarnemingen en 12 maanden dekking.';
  return {geladen:true,genoeg:basis&&gekoppeld&&assets.length>0,assetsGenoeg:assets,reden,basis,gekoppeld};
}

function prognoseGereedheid(){
  const typen=STORINGS_INSPECTIE?Object.values(STORINGS_INSPECTIE.typen):[];
  const goed=typen.filter(g=>g.genoeg),dr=dripHistorieGereedheid();
  const namen=goed.flatMap(g=>g.assetsGenoeg.map(a=>({typeId:g.typeId,naam:a.naam,n:a.n})))
    .concat(dr.assetsGenoeg.map(a=>({typeId:'DRIP',naam:a.code||a.asset||a.weg,n:a.n})));
  return {typen,goed,dr,assets:namen,ietsGenoeg:goed.length>0||dr.genoeg};
}

function prognoseTekorten(p){
  const miss=[];
  p.typen.filter(g=>!g.genoeg).forEach(g=>{
    const x=[];
    if(g.dekkingDagen<DATA_DREMPELS.historieDagen)x.push(`${Math.round(g.dekkingDagen)} van ${DATA_DREMPELS.historieDagen} historische dagen`);
    if(g.prognoseN<DATA_DREMPELS.typeIncidenten)x.push(`${g.prognoseN} van ${DATA_DREMPELS.typeIncidenten} aan het assetregister gekoppelde incidenten`);
    if(g.maandenN<DATA_DREMPELS.typeMaanden)x.push(`${g.maandenN} van ${DATA_DREMPELS.typeMaanden} actieve maanden`);
    if(g.koppelPct<DATA_DREMPELS.koppelDekking)x.push(`koppeldekking ${fmt(g.koppelPct*100,0)}%, vereist ${pct0(DATA_DREMPELS.koppelDekking)}`);
    if(g.ongekoppeldN)x.push(`${g.ongekoppeldN} incidenten nog niet aan All Assets gekoppeld`);
    if(!x.length&&g.mttrTerugval)x.push(`MTTR gebruikt ${g.mttrBron} omdat er ${g.duurN} gekoppelde duurwaarnemingen zijn`);
    miss.push(`${ASSET_LABEL[g.typeId]||g.typeId}: ${x.join(', ')}.`);
  });
  if(p.dr.geladen&&!p.dr.genoeg)miss.push(`DRIP: ${p.dr.reden}`);
  return miss;
}

const MSI_MONTE_CARLO_ACTIEF=false;
function berekenGereedheid(){
  const historieTypes=STORINGS_INSPECTIE?Object.keys(STORINGS_INSPECTIE.typen):[];
  const liveTypes=LIVE_STORINGS_INSPECTIE?Object.keys(LIVE_STORINGS_INSPECTIE.typen):[];
  const algemeenTypes=uniekeWaarden([...historieTypes,...liveTypes]);
  const regAlg=registerGereedVoor(liveTypes);
  const regMsi=registerGereedVoor(['MSI']);
  const regDrip=registerGereedVoor(['DRIP']);
  const logsAlg=!!(STORINGSBRONNEN.length&&STORINGS_INSPECTIE&&STORINGS_INSPECTIE.herkenbaar);
  const liveAlg=heeftLiveStoringsdata();
  const contextBronnen=!!U_ROUTE_STATE&&!!WERK_STATE;
  const basisAlgemeen=liveAlg&&regAlg.areaal;
  const dripAreaal=!!(typeof DRIP_STATE!=='undefined'&&DRIP_STATE&&DRIP_STATE.drips&&DRIP_STATE.drips.length&&regDrip.areaal);
  const msiHist=STORINGS_INSPECTIE&&STORINGS_INSPECTIE.typen.MSI;
  // De Monte Carlo-prognose kalibreert op assetregister + storingshistorie. U-routes
  // en werkzaamheden zijn operationele-blootstellingscontext (verrijking van de memo's),
  // geen kalibratiebron. Ze mogen de prognosepoort daarom niet blokkeren.
  const mcAlgemeen=MSI_MONTE_CARLO_ACTIEF&&logsAlg&&regMsi.alle&&!!(msiHist&&msiHist.genoeg);
  const dripHist=dripHistorieGereedheid();
  const mcDrip=dripAreaal&&regDrip.alle&&dripHist.genoeg;
  const rapportBasis=!!ASSET_REGISTER_STATE;
  return {logsAlg,liveAlg,contextBronnen,historieTypes,liveTypes,algemeenTypes,regAlg,regMsi,regDrip,basisAlgemeen,dripAreaal,mcAlgemeen,mcDrip,dripHist,rapportBasis,iets:basisAlgemeen||mcAlgemeen||dripAreaal||rapportBasis};
}

function ontbrekendVoor(tab){
  const g=berekenGereedheid(),miss=[];
  if(tab==='prognose'){
    miss.push(...g.regMsi.miss);
    if(!g.logsAlg)miss.unshift('Laad na All Assets één of meer herkenbare historische storingslogs.');
    const m=STORINGS_INSPECTIE&&STORINGS_INSPECTIE.typen.MSI;
    if(!m||!m.genoeg)miss.push('MSI-prognosedata voldoet nog niet aan 12 maanden dekking, 20 gekoppelde incidenten, 12 actieve maanden en minimaal 70% koppeldekking aan All Assets.');
    // U-routes en werkzaamheden blokkeren de prognose niet meer; ze verrijken alleen de
    // operationele context in de memo's. Toon dit als optionele aanvulling, niet als blokkade.
    if(!U_ROUTE_STATE)miss.push('Optioneel: laad de U-route-inventarisatie om de routecontext in de memo mee te nemen.');
    if(!WERK_STATE)miss.push('Optioneel: laad de geplande werkzaamheden om de werkcontext in de memo mee te nemen.');
  }else if(tab==='drips'){
    miss.push(...g.regDrip.miss);
    if(!(typeof DRIP_STATE!=='undefined'&&DRIP_STATE&&DRIP_STATE.drips&&DRIP_STATE.drips.length))miss.unshift('Laad een assetlijst waarin DRIP-assets herkenbaar zijn.');
  }else{
    miss.push(...g.regAlg.miss);
    if(!g.liveAlg)miss.unshift('Laad bij de laatste stap een momentopname met uitsluitend open storingen. Historische logs worden hier bewust niet gebruikt.');
    if(!U_ROUTE_STATE)miss.push('Optioneel: laad de U-route-inventarisatie voor routecontext.');
    if(!WERK_STATE)miss.push('Optioneel: laad de geplande werkzaamheden voor werkcontext.');
  }
  return uniekeWaarden(miss);
}

function tabToegestaan(tab){
  const g=berekenGereedheid();
  if(tab==='datasets')return heeftDatasetData();
  if(tab==='prognose')return MSI_MONTE_CARLO_ACTIEF&&!!ASSET_REGISTER_STATE;
  if(tab==='drips')return g.dripAreaal;
  if(tab==='rapport')return !!ASSET_REGISTER_STATE;
  if(tab==='regels')return !!ASSET_REGISTER_STATE;
  return g.basisAlgemeen;
}

function blokkadeHtml(tab){
  const miss=ontbrekendVoor(tab);
  return `<div class="analyse-slot"><h3>Analyse nog geblokkeerd</h3><p>Deze functie start pas wanneer de benodigde brondata inhoudelijk gereed is.</p><ul>${miss.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
}

function updateTabSloten(){
  document.querySelectorAll('#tabs button').forEach(b=>{
    const ok=tabToegestaan(b.dataset.tab);b.classList.toggle('tab-locked',!ok);b.setAttribute('aria-disabled',ok?'false':'true');
    if(!ok){const p=document.getElementById('tab-'+b.dataset.tab);if(p)p.innerHTML=blokkadeHtml(b.dataset.tab);}
  });
}

function statusStap(n,titel,klasse,status,detail){
  return `<div class="data-stap ${klasse}"><div class="data-stap-volg">Stap ${n}</div><div class="data-stap-titel"><span>${esc(titel)}</span><span class="data-stap-status">${esc(status)}</span></div><div class="data-stap-detail">${detail}</div></div>`;
}

function renderDataGereedheid(){
  const host=document.getElementById('dataStatusPanel');if(!host)return;
  const g=berekenGereedheid(),p=prognoseGereedheid(),histOk=heeftStoringsdata(),liveOk=g.liveAlg;
  const rel=relevanteTypen(),statusTypen=rel.length?rel:(ASSET_REGISTER_STATE?Object.keys(ASSET_REGISTER_STATE.perType||{}):[]);
  const reg=registerGereedVoor(statusTypen),match=ASSET_MATCH_STATE,eersteFout=match&&match.groepen&&match.groepen[0];
  const ip=typeof IMPORT_PROGRESS!=='undefined'?IMPORT_PROGRESS:null;
  const progress=ip&&ip.bestand?`<div class="import-progress ${ip.actief?'actief':ip.fout?'error':'done'} ${ip.pct==null?'onbepaald':''}" role="status"><div class="import-progress-kop"><span class="import-progress-bestand">${esc(ip.bestand)}</span><span class="import-progress-pct">${ip.pct==null?(ip.actief?'bezig':''):Math.round(ip.pct)+'%'}</span></div><div class="import-progress-balk"><span style="${ip.pct==null?'':'width:'+Math.max(0,Math.min(100,ip.pct))+'%'}"></span></div><div class="import-progress-fase">${esc(ip.fase||'Bestand verwerken')}</div></div>`:'';

  const ds=ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.districtStats;
  const districtDetail=ds?` District: ${ds.bron.toLocaleString('nl-NL')} bron, ${ds.afgeleid.toLocaleString('nl-NL')} afgeleid, ${(ds.ontbreekt+ds.dubbelzinnig).toLocaleString('nl-NL')} onbekend of niet eenduidig.`:'';
  const assetDetail=ASSET_REGISTER_STATE?`${esc(ASSET_REGISTER_STATE.bestand)} · ${(ASSET_REGISTER_STATE.actiefN||0).toLocaleString('nl-NL')} actieve en ${ASSET_REGISTER_STATE.assets.length.toLocaleString('nl-NL')} herkenbare assets. Stamregister voor identiteit, locatie, areaal en bouwjaar; nooit een storingsbron.${districtDetail}`:'Laad eerst All Assets. Alle andere importknoppen worden daarna vrijgegeven.';
  const levensduurRegels=(reg.details||[]).map(d=>`<div style="margin-top:5px"><b>${esc(ASSET_LABEL[d.typeId]||d.typeId)}</b>: bouwjaar ${pct0(d.bouwjaarPct)}, effectieve levensduur ${pct0(d.modelPct)}, expliciete EOL ${pct0(d.eolPct)}. Terugval: ${d.generiekeLevensduur!=null?fmt(d.generiekeLevensduur,1)+' jaar':'niet ingesteld'}, β ${fmt(d.generiekeBeta,2)}.</div>`).join('');
  const eolDetail=ASSET_REGISTER_STATE?(reg.model?`${reg.eol?'Expliciete EOL-dekking is voldoende.':'Modelgereed: ontbrekende expliciete EOL wordt zichtbaar aangevuld met de generieke assettypewaarde.'}${EOL_BRON_NAAM?' Referentie: '+esc(EOL_BRON_NAAM)+'.':''}${levensduurRegels}`:`Levensduurmodel nog niet compleet. Stel voor elk relevant assettype een mediane levensduur en β in.${levensduurRegels}`):'Wordt na de assetlijst beoordeeld.';

  const histTypes=[];if(STORINGS_INSPECTIE)Object.keys(STORINGS_INSPECTIE.typen).forEach(tp=>histTypes.push(ASSET_LABEL[tp]||tp));if(p.dr.geladen)histTypes.push('DRIP');
  const histNamen=[...STORINGSBRONNEN.map(b=>b.naam),...(((typeof DRIP_HIST_STATE!=='undefined'&&DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[]).map(b=>b.name))];
  const matchDetail=histOk&&match?` Koppeling alle logstromen: <b>${match.gekoppeld.toLocaleString('nl-NL')}</b> van ${match.totaal.toLocaleString('nl-NL')}${match.uitgesloten?`, ${match.uitgesloten.toLocaleString('nl-NL')} verantwoord uitgesloten`:''}.${match.nietGekoppeld?` <button class="asset-match-link" onclick="openAssetConfigForLog('${encodeURIComponent(eersteFout?eersteFout.id:'')}')">${match.nietGekoppeld.toLocaleString('nl-NL')} niet gekoppeld, open assetconfiguratie</button>.`:''}`:'';
  const histDetail=histOk?`${histNamen.length} historische bronbestand(en), uitsluitend voor prognoses. Typen: ${esc(uniekeWaarden(histTypes).join(', ')||'nog niet herkenbaar')}. ${histNamen.map(esc).join(', ')}.${matchDetail}`:(ASSET_REGISTER_STATE?'Laad hier gesloten of meerjarige DVM- en DRIP-historie. Een bestand dat op één peildatum uitsluitend open meldingen bevat, wordt automatisch naar de live stroom verplaatst.':'Wacht op de assetlijst.');
  const progMiss=prognoseTekorten(p),progTypes=p.goed.map(x=>ASSET_LABEL[x.typeId]||x.typeId).concat(p.dr.genoeg?['DRIP']:[]);
  const progDetail=p.ietsGenoeg?`Genoeg historie voor: <b>${esc(progTypes.join(', '))}</b>.${progMiss.length?' Nog onvoldoende: '+progMiss.map(esc).join(' '):''}`:(histOk?(progMiss.length?progMiss.map(esc).join(' '):'Nog geen assettype haalt alle prognosedrempels.'):'Wordt na de historische logs automatisch beoordeeld.');

  const ur=U_ROUTE_STATE,urDetail=ur?`${esc(ur.bestand)} · ${ur.totaal.toLocaleString('nl-NL')} routeverwijzingen, ${ur.metRelation.toLocaleString('nl-NL')} met OSM-relatie en ${ur.geometrieN.toLocaleString('nl-NL')} met lokale routegeometrie. ${ur.werkMatchesN.toLocaleString('nl-NL')} werk-routekoppelingen en ${ur.routeAssetKoppelingenN.toLocaleString('nl-NL')} unieke assets langs de gekoppelde routeassen. ${ur.geometrieN?'U-nummers worden op hoofdweg en afstand gedesambigueerd.':'Geen routegeometrie gevonden; expliciete U-nummers blijven als inventarisatiecontext zichtbaar.'}`:'Laad een U-routebestand. OSM-relatiecodes worden daarna aan de ingebouwde routegeometrie gekoppeld.';
  const ws=WERK_STATE,werkDetail=ws?`${esc(ws.bestand)} · ${ws.totaal.toLocaleString('nl-NL')} HWN-werkzaamheden uit ${(ws.bronTotaal||ws.totaal).toLocaleString('nl-NL')} bronregels; ${(ws.genegeerdN||0).toLocaleString('nl-NL')} niet-relevante regels overgeslagen. ${ws.exactN.toLocaleString('nl-NL')} met controleerbare werkvakgeometrie en ${ws.assetKoppelingenN.toLocaleString('nl-NL')} assetkoppelingen binnen ±${WERK_BUFFER_KM} km. ${ws.uRouteMatchesN.toLocaleString('nl-NL')} U-routecontextkoppelingen. ${ws.exactN?'Exacte 2-km-context is actief waar de bronmatch voldoende zeker is.':'Alle regels zijn alleen op wegniveau te duiden; ze krijgen geen numerieke contextimpact.'}`:'Laad geplande werkzaamheden. Herkende regels worden op weg, periode en traject aan DATEX II-geometrie gekoppeld.';

  const liveTypes=LIVE_STORINGS_INSPECTIE?Object.keys(LIVE_STORINGS_INSPECTIE.typen).map(tp=>ASSET_LABEL[tp]||tp):[];
  const liveDetail=liveOk?`${LIVE_STORINGSBRONNEN.length} momentopnamebestand(en), ${LIVE_STORINGS_INSPECTIE.herkenbaar.toLocaleString('nl-NL')} herkenbare open meldingen. Typen: ${esc(liveTypes.join(', ')||'onbekend')}. Uitdraaidatum en analysemoment: <b>${LIVE_PEILDATUM?new Date(LIVE_PEILDATUM).toLocaleDateString('nl-NL'):'onbekend'}</b>. Deze datum is informatief en geeft geen waarschuwing. Alleen deze stroom voedt de prestatietabs voor dat analysemoment.`:(ASSET_REGISTER_STATE?'Laad als laatste een XLS/CSV met uitsluitend de openstaande storingen op het gekozen analysemoment. Deze regels worden niet gebruikt om Monte Carlo te kalibreren.':'Wacht op de assetlijst.');

  const analyseOpen=g.iets,analyseDetail=analyseOpen?`${g.basisAlgemeen?'Actueel storings- en dienstimpactdashboard gereed. ':''}${g.mcAlgemeen?'Algemene Monte Carlo gereed. ':''}${g.dripAreaal?'DRIP-areaal gereed. ':''}${g.mcDrip?'DRIP Monte Carlo gereed. ':''}${(!ur||!ws)?'Operationele context is nog onvolledig.':''}`:'Nog geen analysepoort geopend.';
  const kernMiss=uniekeWaarden([...(!ASSET_REGISTER_STATE?['Laad eerst All Assets.']:[]),...(ASSET_REGISTER_STATE&&!liveOk?['Laad als laatste de open-storingenlijst voor het actuele dashboard.']:[])]);
  const contextMiss=uniekeWaarden([...(ASSET_REGISTER_STATE&&!U_ROUTE_STATE?['U-routes ontbreken; routecontext blijft leeg.']:[]),...(ASSET_REGISTER_STATE&&!WERK_STATE?['Werkzaamheden ontbreken; werkcontext blijft leeg.']:[])]);
  let details='';if(p.assets.length)details=`<details class="data-assets"><summary>Individueel kalibreerbare assets (${p.assets.length})</summary><div class="data-assets-list">${p.assets.map(a=>`<span class="chip"><b>${esc(a.typeId)}</b> · ${esc(a.naam)} (${a.n})</span>`).join('')}</div></details>`;

  host.innerHTML=`<div class="data-gate-kop"><div><h3>Datagereedheid en gescheiden gegevensstromen, versie 72</h3><p>Vaste basis: assetregister en levensduur, daarna historische storingen voor prognoses en de lijst met open storingen voor het actuele dashboard. U-routes en werkzaamheden zijn aanvullende operationele context. Historie kalibreert alleen prognoses. De open lijst voedt alleen het prestatiedashboard. Werkzaamheden verhogen niet de technische faalkans; ze bepalen de operationele blootstelling. Een exact effect is alleen toegestaan bij een controleerbare ruimtelijke koppeling.</p></div><span class="pill ${analyseOpen?'groen':ASSET_REGISTER_STATE?'geel':'rood'}">${analyseOpen?'Analyse beschikbaar':ASSET_REGISTER_STATE?'Vervolgstappen nodig':'Nog niet gestart'}</span></div>${progress}<div class="data-gate-grid">${statusStap(1,'Assetlijst',ASSET_REGISTER_STATE?'ok':'stop',ASSET_REGISTER_STATE?'gereed':'wacht',assetDetail)}${statusStap(2,'Levensduur & EOL',ASSET_REGISTER_STATE?(reg.model?'ok':'warn'):'stop',ASSET_REGISTER_STATE?(reg.model?'modelgereed':'aanvullen'):'wacht',eolDetail)}${statusStap(3,'Storingshistorie',histOk?(match&&match.nietGekoppeld?'warn':'ok'):'stop',histOk?'prognosebron':'wacht',histDetail)}${statusStap(4,'Prognosedata',p.ietsGenoeg?'ok':histOk?'warn':'stop',p.ietsGenoeg?'gereed':histOk?'onvoldoende':'wacht',progDetail)}${statusStap(5,'U-routes',ur?(ur.ruimtelijkN?'ok':'warn'):'warn',ur?(ur.ruimtelijkN?'ruimtelijk':'inventarisatie'):'optioneel',urDetail)}${statusStap(6,'Werkzaamheden',ws?(ws.exactN?'ok':'warn'):'warn',ws?(ws.exactN?'2 km actief':'wegcontext'):'optioneel',werkDetail)}${statusStap(7,'Open storingen',liveOk?'ok':'stop',liveOk?'dashboardbron':'wacht',liveDetail)}${statusStap(8,'Analyses',analyseOpen?'ok':ASSET_REGISTER_STATE?'warn':'stop',analyseOpen?'open':'geblokkeerd',analyseDetail)}</div><div class="data-missing"><b>${kernMiss.length?'Nog nodig:':'Controle:'}</b> ${kernMiss.length?kernMiss.map(esc).join(' · '):'De kernanalyse is beschikbaar. Historie, U-routes en werkzaamheden blijven per onderdeel als bronstatus zichtbaar.'}${contextMiss.length?`<br><b>Context aanvullen:</b> ${contextMiss.map(esc).join(' · ')}`:''}</div>${details}`;
  const zetKnoppen=(ids,uit)=>ids.forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=uit;});
  zetKnoppen(['btnEol','btnLogs','landingEolBtn','landingLogsBtn'],!ASSET_REGISTER_STATE);
  zetKnoppen(['btnURoutes','landingURoutesBtn'],!ASSET_REGISTER_STATE);
  zetKnoppen(['btnWerk','landingWerkBtn'],!ASSET_REGISTER_STATE);
  zetKnoppen(['btnLive','landingLiveBtn'],!ASSET_REGISTER_STATE);
  const ex=document.getElementById('btnExport');if(ex)ex.disabled=!g.basisAlgemeen;
  const tex=document.getElementById('btnTotaalExport');if(tex)tex.disabled=!heeftDatasetData();
  const db=document.getElementById('btnDatasetBeheer');if(db)db.disabled=!heeftDatasetData();
  updateTabSloten();
}

function heeftDatasetData(){
  return !!(ASSET_REGISTER_STATE||EOL_REF.length||STORINGSBRONNEN.length||LIVE_STORINGSBRONNEN.length||DRIP_HIST_STATE||U_ROUTE_STATE||WERK_STATE);
}
function datasetAantalBron(bron){
  if(Array.isArray(bron?.rijen))return bron.rijen.length;
  if(Array.isArray(bron?.incidenten))return bron.incidenten.length;
  if(Array.isArray(bron?.routes))return bron.routes.length;
  if(Array.isArray(bron?.werken))return bron.werken.length;
  return 0;
}
function datasetItemCard(item){
  const status=item.aanwezig?'gereed':'leeg';
  const klasse=item.aanwezig?(item.zacht?'warn':''):'stop';
  return `<div class="dataset-card ${klasse}">
    <div class="dataset-kop"><div><div class="dataset-titel">${esc(item.titel)}</div><div class="dataset-meta">${item.meta}</div></div><span class="pill ${item.aanwezig?'groen':'rood'}">${status}</span></div>
    <div class="dataset-actions">${item.aanwezig?`<button class="dataset-del" onclick="verwijderDataset('${esc(item.type)}','${esc(encodeURIComponent(item.key||''))}')">Verwijderen</button>`:''}</div>
  </div>`;
}
function datasetItems(){
  const items=[];
  items.push({type:'assetregister',key:'',titel:'Assetregister / All Assets',aanwezig:!!ASSET_REGISTER_STATE,meta:ASSET_REGISTER_STATE?`${esc(ASSET_REGISTER_STATE.bestand)}<br>${(ASSET_REGISTER_STATE.actiefN||0).toLocaleString('nl-NL')} actieve assets, ${(ASSET_REGISTER_STATE.assets||[]).length.toLocaleString('nl-NL')} herkenbaar.`:'Nog niet geladen.'});
  items.push({type:'eol',key:'',titel:'EOL-referentie',aanwezig:!!EOL_REF.length,zacht:true,meta:EOL_REF.length?`${esc(EOL_BRON_NAAM||'EOL-bron')}<br>${EOL_REF.length.toLocaleString('nl-NL')} levensduurregels.`:'Niet geladen; generieke levensduur blijft mogelijk.'});
  STORINGSBRONNEN.forEach(b=>items.push({type:'storingshistorie',key:b.key,titel:'Storingshistorie',aanwezig:true,meta:`${esc(b.naam||b.key)}<br>${datasetAantalBron(b).toLocaleString('nl-NL')} bronregels. Voedt alleen prognoses.`}));
  LIVE_STORINGSBRONNEN.forEach(b=>items.push({type:'liveStoringen',key:b.key,titel:'Open storingen',aanwezig:true,meta:`${esc(b.naam||b.key)}<br>${datasetAantalBron(b).toLocaleString('nl-NL')} bronregels. Voedt alleen actueel dashboard.${b.peildatum?'<br>Peildatum '+new Date(b.peildatum).toLocaleDateString('nl-NL'):''}`}));
  ((DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[]).forEach(s=>items.push({type:'dripHistorie',key:s.key,titel:'DRIP-storingshistorie',aanwezig:true,meta:`${esc(s.name||s.key)}<br>${datasetAantalBron(s).toLocaleString('nl-NL')} incidenten. Voedt DRIP Monte Carlo.`}));
  items.push({type:'uRoutes',key:'',titel:'U-routes',aanwezig:!!U_ROUTE_STATE,meta:U_ROUTE_STATE?`${esc(U_ROUTE_STATE.bestand)}<br>${U_ROUTE_STATE.totaal.toLocaleString('nl-NL')} routes, ${U_ROUTE_STATE.routeAssetKoppelingenN.toLocaleString('nl-NL')} routeassets gekoppeld.`:'Niet geladen.'});
  items.push({type:'werkzaamheden',key:'',titel:'Werkzaamheden',aanwezig:!!WERK_STATE,meta:WERK_STATE?`${esc(WERK_STATE.bestand)}<br>${WERK_STATE.totaal.toLocaleString('nl-NL')} HWN-werkzaamheden, ${WERK_STATE.assetKoppelingenN.toLocaleString('nl-NL')} assetkoppelingen.`:'Niet geladen.'});
  return items;
}
function renderDatasetBeheer(){
  const host=document.getElementById('tab-datasets');if(!host)return;
  const items=datasetItems();
  const aanwezig=items.filter(x=>x.aanwezig).length;
  host.innerHTML=`<div class="card"><h3>Datasetbeheer ${tip('Hier beheer je de ingeladen brondata. Verwijderen wist de gekozen invoerbron en maakt alle afhankelijke berekeningen ongeldig. De tool rekent daarna opnieuw met wat overblijft, of blokkeert onderdelen totdat je opnieuw data laadt.')}</h3>
    <div class="load-actions">
      <button class="tb-btn primary" onclick="openTotaalExportKeuze()" ${aanwezig?'':'disabled'}>⭳ Totaalexport kiezen</button>
      <button class="tb-btn" onclick="document.getElementById('totaalImportInput').click()">⭱ Totaal JSON laden</button>
      <button class="dataset-del" onclick="verwijderAlleDatasets()" ${aanwezig?'':'disabled'}>Alle datasets wissen</button>
    </div>
    <p class="dataset-note">Verwijder je bijvoorbeeld U-routes, dan blijven de technische storingsberekeningen staan maar verdwijnt de routecontext en worden memo's/prognosecontext opnieuw opgebouwd. Verwijder je de live open-storingenlijst, dan sluit het actuele dashboard totdat je een nieuwe momentopname laadt.</p>
  </div>
  <div class="dataset-grid">${items.map(datasetItemCard).join('')}</div>`;
  nummerGrafiekenEnTabellen(host);
}
async function datasetAfgeleidenOngeldig(){
  STATE=null;HISTORIE_STATE=null;MC_HISTORIE_LIVE=null;HISTORIE_UITGESTELD=false;MC_RESULT=null;DRIP_MC=null;ANALYSE_SIGNATURE='';DIENST_SEL=null;
  if(ASSET_REGISTER_STATE){ASSET_REGISTER_STATE._assetConfigVersie=-1;herberekenRegisterDekking();bouwAssetIndex();}
  else{ASSET_INDEX=null;DVM_LEEFTIJD_STATE=null;DRIP_STATE=null;}
  STORINGS_INSPECTIE=ASSET_INDEX?inspecteerStoringsRijen(gecombineerdeStoringsRijen()):null;
  LIVE_STORINGS_INSPECTIE=ASSET_INDEX?inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen()):null;
  if(DRIP_STATE&&EOL_REF.length)DRIP_STATE.drips.forEach(d=>{d._eolRef=eolRegelVoor(d.fabrikant,d.model||d.type,'DRIP');d._rel=null;});
  if(DRIP_HIST_STATE&&DRIP_STATE)koppelDripHistorieAanAreaal();
  if(WERK_STATE){
    zetImportVoortgang('Datasetbeheer',65,'Werkzaamheden en U-routes opnieuw koppelen',{direct:true});
    await herkoppelWerkAssetsLicht((p,fase)=>zetImportVoortgang('Datasetbeheer',65+p*25,fase,{direct:true}));
  }
  else if(U_ROUTE_STATE){U_ROUTE_STATE.werkMatchesN=0;U_ROUTE_STATE.routeAssetKoppelingenN=0;}
  herbouwAssetMatchBeeld();
}
async function datasetNaMutatie(bericht){
  TOTAAL_IMPORT_GELADEN=false;
  await datasetAfgeleidenOngeldig();
  if(heeftDatasetData())probeerAnalyseActiveren('datasets',{inspectieAlGereed:true,matchAlGereed:true});
  else{
    const landing=document.getElementById('landing'),results=document.getElementById('results');
    if(landing)landing.classList.remove('hidden');if(results)results.classList.add('hidden');
    renderDataGereedheid();
  }
  zetStoringsImportStatus(bericht||'Datasetbeheer bijgewerkt. Afhankelijke berekeningen zijn opnieuw beoordeeld.');
}
async function verwijderDataset(type,keyEnc){
  const key=decodeURIComponent(keyEnc||'');
  const namen={assetregister:'het assetregister',eol:'de EOL-referentie',storingshistorie:'deze storingshistorie',liveStoringen:'deze open-storingenlijst',dripHistorie:'deze DRIP-historie',uRoutes:'de U-routes',werkzaamheden:'de werkzaamheden'};
  const extra=type==='assetregister'?' Zonder assetregister worden dashboard, rapport en prognoses geblokkeerd totdat je opnieuw All Assets laadt.':' Afhankelijke berekeningen worden opnieuw opgebouwd met de resterende data.';
  if(!confirm(`Weet je zeker dat je ${namen[type]||'deze dataset'} wilt verwijderen?${extra}`))return;
  if(type==='assetregister'){ASSET_REGISTER_STATE=null;ASSET_INDEX=null;DVM_LEEFTIJD_STATE=null;DRIP_STATE=null;}
  else if(type==='eol'){EOL_REF=[];EOL_BRON_NAAM='';EOL_VERSIE++;}
  else if(type==='storingshistorie'){STORINGSBRONNEN=STORINGSBRONNEN.filter(b=>b.key!==key);}
  else if(type==='liveStoringen'){LIVE_STORINGSBRONNEN=LIVE_STORINGSBRONNEN.filter(b=>b.key!==key);LIVE_PEILDATUM=Math.max(0,...LIVE_STORINGSBRONNEN.map(b=>b.peildatum||0))||null;}
  else if(type==='dripHistorie'){const rest=((DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[]).filter(s=>s.key!==key);DRIP_HIST_STATE=rest.length?{sources:rest}:null;if(DRIP_HIST_STATE)herbouwDripHistorie();}
  else if(type==='uRoutes'){U_ROUTE_STATE=null;if(WERK_STATE)WERK_STATE.werken.forEach(w=>{w.routeMatches=[];});}
  else if(type==='werkzaamheden'){WERK_STATE=null;if(U_ROUTE_STATE){U_ROUTE_STATE.werkMatchesN=0;U_ROUTE_STATE.routeAssetKoppelingenN=0;}}
  await datasetNaMutatie(`${namen[type]||'Dataset'} verwijderd; afhankelijke berekeningen zijn opnieuw beoordeeld.`);
}
async function verwijderAlleDatasets(){
  if(!confirm('Alle ingeladen datasets verwijderen? Parameters en handmatige rule-engine instellingen blijven staan.'))return;
  ASSET_REGISTER_STATE=null;ASSET_INDEX=null;DVM_LEEFTIJD_STATE=null;DRIP_STATE=null;EOL_REF=[];EOL_BRON_NAAM='';EOL_VERSIE++;
  STORINGSBRONNEN=[];STORINGS_INSPECTIE=null;LIVE_STORINGSBRONNEN=[];LIVE_STORINGS_INSPECTIE=null;LIVE_PEILDATUM=null;DRIP_HIST_STATE=null;U_ROUTE_STATE=null;WERK_STATE=null;
  await datasetNaMutatie('Alle datasets verwijderd. Laad opnieuw All Assets om verder te rekenen.');
}

function analyseSignatuur(){
  return [STORINGSBRONNEN.map(b=>b.key+':'+b.rijen.length).sort().join(','),LIVE_STORINGSBRONNEN.map(b=>b.key+':'+b.rijen.length).sort().join(','),ASSET_REGISTER_STATE?ASSET_REGISTER_STATE.bestand+':'+ASSET_REGISTER_STATE.assets.length:'',EOL_BRON_NAAM,EOL_REF.length,U_ROUTE_STATE?U_ROUTE_STATE.bestand+':'+U_ROUTE_STATE.totaal:'',WERK_STATE?WERK_STATE.bestand+':'+WERK_STATE.totaal:'',ASSET_CONFIG_VERSIE].join('|');
}

function probeerAnalyseActiveren(voorkeur,opties){
  opties=opties||{};
  if(ASSET_INDEX){
    if(!opties.inspectieAlGereed)STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
    LIVE_STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen());
    if(!opties.matchAlGereed)herbouwAssetMatchBeeld();
  }
  const g=berekenGereedheid(),sig=analyseSignatuur();
  if(sig!==ANALYSE_SIGNATURE){
    // De historie-doorrekening is de zwaarste stap bij grote signaalgeverbronnen.
    // We stellen haar uit tot het prognosetabblad (zorgHistorieState) in plaats
    // van haar bij elke bronwijziging meteen te bouwen; hier markeren we alleen
    // dat er historie klaarstaat.
    HISTORIE_STATE=null;MC_HISTORIE_LIVE=null;
    HISTORIE_UITGESTELD=!!(g.logsAlg&&STORINGSBRONNEN.length);
    if(g.basisAlgemeen&&LIVE_STORINGSBRONNEN.length){
      const lr=gecombineerdeLiveStoringsRijen(),dr=(typeof DRIP_STATE!=='undefined'?DRIP_STATE:null);
      STATE=doorrekenen(lr,{actueel:true,peildatum:LIVE_PEILDATUM});STATE.bestand=LIVE_STORINGSBRONNEN.map(b=>b.naam).join(' + ');STATE.ruweRijen=lr;STATE.peildatum=LIVE_PEILDATUM;if(dr)STATE.drips=dr;
    }else STATE=null;
    MC_RESULT=null;DRIP_MC=null;ANALYSE_SIGNATURE=sig;
  }
  const landing=document.getElementById('landing'),results=document.getElementById('results');
  if(g.iets||heeftDatasetData()){landing.classList.add('hidden');results.classList.remove('hidden');renderAlles();const doel=voorkeur&&tabToegestaan(voorkeur)?voorkeur:(g.basisAlgemeen?'overzicht':g.mcAlgemeen?'prognose':g.dripAreaal?'drips':ASSET_REGISTER_STATE?'rapport':'datasets');toonTab(doel);}
  else{landing.classList.remove('hidden');results.classList.add('hidden');}
  renderDataGereedheid();
}

document.addEventListener('DOMContentLoaded',()=>{renderDataGereedheid();});

function lc(v){return String(v==null?'':v).toLowerCase();}
function num(v){const x=parseFloat(String(v).replace(',','.'));return isNaN(x)?null:x;}

/* De XLSX gebruikt andere kolomnamen dan de rule-engine CSV. We normaliseren
   elke rij naar een uniform meldingsobject. Kolommen (zie voorbeeld):
   RD | District | vc | os_id | melding | aantal_dagen | van | tot |
   storingsduur_peildatum | kruislampfout | MSI | splitsing | samenvoeging |
   opeenvolgend | verbindingsboog | kruislamp | google_link | Gevolg | ... */
function normRij(m){
  const g = k => { for(const kk of Object.keys(m)){ if(lc(kk)===lc(k)) return m[kk]; } return undefined; };
  const vlag=(...namen)=>{
    for(const naam of namen){
      const v=g(naam);if(v==null||v==='')continue;
      if(v===true||v===1)return 1;
      const s=String(v).trim().toLowerCase();if(['1','x','ja','yes','true','waar'].includes(s))return 1;
      const n=Number(String(v).replace(',','.'));if(isFinite(n)&&n!==0)return 1;
    }
    return 0;
  };
  const entityid=String(g('entityid')||'').trim();
  const osid = String(g('os_id')||g('osid')||g('asset')||g('object')||g('object_id')||g('assetnaam')||g('asset_name')||entityid||'').trim();
  const locatieTekst=String(g('locatie')||g('location')||'').trim();
  const eventId = String(g('event_id')||g('melding_id')||g('incident_id')||g('storing_id')||'').trim();
  // os_id voorbeeld: "A1 Li 6.685"  → weg=A1, richting=Li, hm=6.685
  let weg='', richting='', hm=null;
  const mm = (osid+' '+locatieTekst).match(/\b([AN]\d+)\s*([A-Z]{1,2})?[\s_]*(\d+(?:[.,-]\d{1,3})?)\b/i);
  if(mm){ weg=mm[1].toUpperCase(); richting=normAssetRichting(mm[2]||''); hm=parseFloat(String(mm[3]).replace(',','.').replace('-','.')); }
  if(!weg){ weg = String(g('wegnummer')||g('weg')||'').trim().toUpperCase(); }
  if(!richting)richting=normAssetRichting(g('richting')||g('baanpositie')||'');
  if(hm==null){hm=num(g('hm')||g('hm-bord'));const af=num(g('afstand-tot-hm-bord'));if(hm!=null&&af!=null)hm+=af/1000;}
  // duur in uren: uit aantal_dagen/storingsduur (dagen) → uren
  let dagen = num(g('aantal_dagen')) ?? num(g('storingsduur_peildatum'));
  // clamp duur: een 1109-daagse melding zou het model laten ontploffen. In de
  // areaalberekening telt de daadwerkelijke standtijd binnen de rapportageperiode.
  let duurUren = num(g('storingsduur_uren')) ?? num(g('duur_uur')) ?? num(g('duration_hours'));
  const duurMin=num(g('duur_minuten'))??num(g('duration_minutes'));
  if(duurUren==null&&duurMin!=null)duurUren=duurMin/60;
  if(duurUren==null&&dagen!=null)duurUren=dagen*24;
  const strook = String(g('MSI')||g('strook')||g('strooknummer')||'').trim();
  const gevolg = String(g('Gevolg')||g('gevolg')||'').trim();
  const melding = String(g('melding')||g('storingsomschrijving')||g('omschrijving')||'').trim();
  const msiContext=String(g('msi_context')||g('locatiecontext')||g('context')||'').trim();
  const tVan = parseDatum(g('van')||g('start'));
  const tTot = parseDatum(g('tot')||g('einde')||g('end'));
  return {
    eventId,entityid, osid,
    code:String(g('drip_code')||g('foutcode')||''),
    afgeleidUitHistorie:!!m._dripHistorieOpen,
    bronPeildatum:g('bronPeildatum')||null,
    bron:String(g('source_name')||g('bron')||m._bronBestand||''), locatieTekst, weg, richting, hm, strook, gevolg, melding,
    duurUren, dagen, tVan, tTot,
    /* Een storing die uit de nieuwe momentopname verdween is afgesloten op de
       peildatum van die lijst. De duur is dan een bovengrens, geen meting: het
       herstel lag ergens tussen de vorige en de nieuwe momentopname. */
    duurAfgeleid:!!m._afgeslotenDoorNieuweMomentopname,
    duurBetrouwbaar:duurUren!=null&&duurUren>0&&!m._afgeslotenDoorNieuweMomentopname&&g('duurBetrouwbaar')!==false,
    afsluitPeildatum:String(m._afsluitPeildatum||''),
    rd:String(g('RD')||'').trim(), district:String(g('District')||'').trim(), vc:String(g('vc')||g('regio')||'').trim(),
    liveOpen:!!m._liveOpen,bronBestand:String(m._bronBestand||''),
    /* Voor DRIP bepaalt de functionele toestand de impact; foutregel() leest deze. */
    classificatie:String(g('classificatie')||'').trim(),
    technischeToestand:String(g('technische_toestand')||g('technischeToestand')||g('toestand')||'').trim(),
    /* Expliciete assettypehint (bv. signaalgever = MSI); classificeer() gebruikt deze. */
    assetTypeHint:String(g('assettypehint')||g('assettype')||'').trim(),
    googleLink:String(g('google_link')||g('link')||'').trim(),
    noodmaatregel:String(g('Noodmaatregel')||g('noodmaatregel')||'').trim(),
    msiContext,
    splitsing:vlag('splitsing'), samenvoeging:vlag('samenvoeging'),
    opeenvolgend:vlag('opeenvolgend','opvolgend'), verbindingsboog:vlag('verbindingsboog'),
    rijbaanbreed:vlag('rijbaanbreed','rijbaan_breed'), weefvak:vlag('weefvak'),
    laatstePortaalSplitsing:vlag('laatste_portaal_voor_splitsing','laatste portaal voor splitsing'),
    voorAfrit:vlag('voor_afrit','voor afrit','afrit'), voorToerit:vlag('voor_toerit','voor toerit','toerit')
  };
}
function parseDatum(v){
  if(v==null||v==='') return null;
  if(v instanceof Date) return v.getTime();
  if(typeof v==='number'){ // excel serial
    return Math.round((v-25569)*86400*1000);
  }
  const t=Date.parse(v); return isNaN(t)?null:t;
}

/* stap 1: classificeer assettype */
function classificeer(m){
  /* Een expliciete typehint gaat vóór de tekstherkenning. Signaalgeverstoringen (uit
     de MTM-storinglijsten) zijn altijd MSI-installatiestoringen; hun omschrijving kan
     woorden als "wisselbord" bevatten die anders naar een assettype zouden wijzen dat
     niet in het register zit en de hele doorrekening zou blokkeren. */
  if(m&&m.assetTypeHint) return m.assetTypeHint;
  const hay = (m.osid+' '+m.melding+' '+m.gevolg).toLowerCase();
  if(/\bdrip\b|dynamisch route|route[-\s]?informatie|tekstpaneel/.test(hay)) return 'DRIP';
  if(hay.includes('wisselbord')) return 'WISSELBORD';
  if(/\bcamera\b|cctv/.test(hay)) return 'CAM';
  if(/\blus\b|meetlus|detectielus/.test(hay)) return 'LUS';
  if(/msi|signaalgever|kruislamp|aanstuurcirc|lampcircuit|\bos\b/.test(hay)) return 'MSI';
  return null;
}
/* stap 3: foutcode/patroon */
/* DRIP-impact uit de functionele toestand. De alarmtekst zegt wát er mis is, maar
   of de dienst eronder lijdt hangt af van of het paneel functioneel uit is
   (GESTOPT) of gewoon werkt (IN-BEDRIJF), en of het incident langdurig of
   intermitterend is. Deze toestand is leidend: bij GESTOPT zonder herstel telt de
   volledige uitval, bij louter IN-BEDRIJF blijft een gemeld alarm laag, en een
   gemengde/langdurige onderbreking legt een ondergrens. De drempels zijn een model
   en instelbaar; ze staan bewust bij elkaar. */
function dripToestandImpact(m){
  const toestand=lc([m.technischeToestand,m.melding].filter(Boolean).join(' '));
  const klasse=lc([m.classificatie,m.melding].filter(Boolean).join(' '));
  const gestopt=/gestopt|buiten\s*bedrijf/.test(toestand)||/uitval/.test(klasse);
  const inBedrijf=/in[-\s]?bedrijf/.test(toestand);
  const langdurig=/langdurig/.test(klasse);
  const intermitterend=/intermitterend/.test(klasse);
  if(gestopt&&!inBedrijf)return {availPct:100,perfPct:100,leidend:true,oms:'DRIP volledig gestopt'};
  if(gestopt&&inBedrijf)return langdurig
    ?{availPct:60,perfPct:70,floor:true,oms:'DRIP langdurig onderbroken (gestopt en terug)'}
    :{availPct:25,perfPct:40,floor:true,oms:'DRIP intermitterend onderbroken'};
  if(inBedrijf)return {availPct:0,perfPct:5,werkend:true,oms:'DRIP in bedrijf; gemeld alarm zonder aantoonbare uitval'};
  // Geen toestandssignaal: val terug op de duurclassificatie.
  if(langdurig)return {availPct:60,perfPct:70,floor:true,oms:'DRIP langdurig open incident'};
  if(intermitterend)return {availPct:25,perfPct:40,floor:true,oms:'DRIP intermitterend incident'};
  return null;
}
function dripRegel(code,availPct,perfPct,oms,severity){
  return {code,assetType:'DRIP',actief:true,availPct,perfPct,oms,severity,bron:'toestand'};
}
function foutregel(m,typeId){
  const oms = lc(m.melding+' '+m.gevolg);
  let best=null;
  for(const f of RULES.foutcodes){
    if(!f.actief||f.assetType!==typeId) continue;
    if(oms.includes(lc(f.patroon))){
      const score=(Number(f.availPct)||0)+(Number(f.perfPct)||0);
      const bestScore=best?((Number(best.availPct)||0)+(Number(best.perfPct)||0)):-1;
      if(score>bestScore)best=f;
    }
  }
  // DRIP: de functionele toestand is leidend boven de losse alarmtekst.
  if(typeId==='DRIP'){
    const st=dripToestandImpact(m);
    if(st){
      if(st.leidend)return dripRegel('DBD-UIT',st.availPct,st.perfPct,st.oms,'kritiek');
      if(st.floor){
        const a=Math.max(best?Number(best.availPct)||0:0,st.availPct);
        const p=Math.max(best?Number(best.perfPct)||0:0,st.perfPct);
        return dripRegel('DBD-TOESTAND',a,p,best?`${best.oms} · ${st.oms}`:st.oms,a>=60?'hoog':'middel');
      }
      if(st.werkend)return best||dripRegel('DBD-INBEDRIJF',st.availPct,st.perfPct,st.oms,'laag');
    }
    return best;
  }
  // fallback: kruislampfout=ja zonder herkend patroon → behandel als lampcircuit-fout
  if(!best && typeId==='MSI'){ best = RULES.foutcodes.find(f=>f.code==='1001'); }
  if(!best && typeId==='CAM'){ best = RULES.foutcodes.find(f=>f.code==='2002'); }
  return best;
}
/* stap 2: MSI-ernstcontext uit expliciete velden en de bestaande logvlaggen. */
function bepaalMsiErnstContext(m){
  const tekst=histKolomNaam(m.msiContext||'');
  if(m.voorToerit||/(?:^|_)voor_toerit(?:_|$)|(?:^|_)toerit(?:_|$)/.test(tekst))return {ctx:'voor_toerit',bron:'expliciete context'};
  if(m.voorAfrit||/(?:^|_)voor_afrit(?:_|$)|(?:^|_)afrit(?:_|$)/.test(tekst))return {ctx:'voor_afrit',bron:'expliciete context'};
  if(m.laatstePortaalSplitsing||tekst.includes('laatste_portaal_voor_splitsing'))return {ctx:'laatste_portaal_voor_splitsing',bron:'expliciete context'};
  if(m.weefvak||tekst.includes('weefvak'))return {ctx:'weefvak',bron:'expliciete context'};
  if(tekst.includes('opvolgend')||tekst.includes('opeenvolgend'))return {ctx:'opvolgend',bron:'expliciete context'};
  if(m.rijbaanbreed||tekst.includes('rijbaanbreed')||tekst.includes('rijbaan_breed'))return {ctx:'rijbaanbreed',bron:'expliciete context'};
  // Terugval voor de bestaande signaalgeverlog. Splitsing plus samenvoeging
  // duidt een weefvak aan. Een losse samenvoeging hoort bij een toerit, een
  // verbindingsboog bij een afrit en een losse splitsing bij het laatste portaal.
  if(m.splitsing&&m.samenvoeging)return {ctx:'weefvak',bron:'splitsing en samenvoeging'};
  if(m.samenvoeging)return {ctx:'voor_toerit',bron:'samenvoeging'};
  if(m.verbindingsboog)return {ctx:'voor_afrit',bron:'verbindingsboog'};
  if(m.splitsing)return {ctx:'laatste_portaal_voor_splitsing',bron:'splitsing'};
  if(m.opeenvolgend)return {ctx:'opvolgend',bron:'opeenvolgend'};
  return {ctx:'rijbaanbreed',bron:'standaard MSI-context'};
}
function locatieFactor(m,typeId){
  let ctx=null,bron='';
  if(typeId==='MSI'){const c=bepaalMsiErnstContext(m);ctx=c.ctx;bron=c.bron;}
  else if(typeId==='LUS'&&m.weefvak){ctx='weefvak';bron='weefvakvlag';}
  if(!ctx) return {fA:1,fP:1,ctx:'(geen)',label:'Geen bijzondere context',ernst:null,bron:'geen'};
  let best=null;
  for(const l of RULES.locatieRegels){
    if(!l.actief||l.assetType!==typeId||l.context!==ctx) continue;
    if(!best||l.prioriteit>best.prioriteit) best=l;
  }
  return best?{fA:locatieRegelFactor(best,'besch'),fP:locatieRegelFactor(best,'prest'),ctx,label:best.label||best.context,ernst:typeId==='MSI'?msiErnstWaarde(best):null,bron}:{fA:1,fP:1,ctx,label:ctx,ernst:null,bron:'regel uitgeschakeld of ontbreekt'};
}

function doorrekenen(rijenRaw,opties){
  opties=opties||{};const actueel=!!opties.actueel;
  const rijen = rijenRaw.map(normRij);
  const M=[],nietDoorgerekend=[]; const gezien=new Set(); let dubbel=0, nietGecl=0, zonderFoutregel=0,zonderLocatie=0;
  rijen.forEach(m=>{
    const typeId = classificeer(m);
    if(!typeId){ nietGecl++; return; }
    const koppeling=koppelMeldingAanAsset(m,typeId);
    pasAssetKoppelingToe(m,koppeling);
    const ontbreekt=!m.weg?'Locatie ontbreekt':m.assetMatchStatus==='locatieconflict'?'Assetkoppeling heeft een locatieconflict':null;
    const f = foutregel(m,typeId);
    if(ontbreekt||!f){
      const key=[m.eventId||'',m.osid,m.tVan,m.weg,m.richting,m.hm,m.melding].join('|');
      if(gezien.has(key)){dubbel++;return;}gezien.add(key);
      if(!m.weg)zonderLocatie++;else if(!f)zonderFoutregel++;
      nietDoorgerekend.push({...m,typeId,avail:null,perf:null,rekenStatus:ontbreekt||'Passende foutregel ontbreekt'});
      return;
    }
    // Alleen echte doublures wegfilteren. De oude sleutel zonder datum maakte
    // herhaalde storingen op hetzelfde object over meerdere dagen onzichtbaar.
    const tijdSleutel=m.eventId||[m.tVan||'',m.tTot||''].join('~');
    const sleutel=[tijdSleutel,m.weg,m.richting,m.hm,f.code,m.strook].join('|');
    if(gezien.has(sleutel)){ dubbel++; return; }
    gezien.add(sleutel);
    const at = RULES.assetTypen.find(x=>x.id===typeId);
    const loc = locatieFactor(m,typeId);
    const ac=assetOverrideVoor(m.assetKey)||{};
    const impactFactor=ac.impactFactor!=null?Math.max(0,+ac.impactFactor):1;
    const assetFa=ac.fAvail!=null?Math.max(0,+ac.fAvail):1;
    const assetFp=ac.fPerf!=null?Math.max(0,+ac.fPerf):1;
    // ruwe waarden vóór de cap op 100 (voor het rekenverslag)
    const availRuw = f.availPct*at.wAvail*loc.fA*impactFactor*assetFa;
    const perfRuw  = f.perfPct*at.wPerf*loc.fP*impactFactor*assetFp;
    const availBasis = Math.min(100, availRuw);
    const perfBasis  = Math.min(100, perfRuw);
    // Impactmodel:
    //  'cap'    → impact afgekapt op 100%; overschot boven 100% gaat verloren.
    //  'stapel' → percentage blijft ≤100%, maar het overschot (zwaarte >100%)
    //             werkt door als extra gewicht op de verlies-uren. Zo krijgen
    //             gewicht én locatiefactor ook effect op fatale (100%) fouten.
    const model = (RULES.cfg&&RULES.cfg.impactModel)||'cap';
    const zwaarteA = model==='stapel' ? availRuw/100 : Math.min(1, availRuw/100);
    const zwaarteP = model==='stapel' ? perfRuw/100  : Math.min(1, perfRuw/100);
    M.push({...m, typeId, code:String(f.code), fout:f,
      locCtx:loc.label||loc.ctx,locCtxCode:loc.ctx,locErnst:loc.ernst,locBron:loc.bron,
      at, locFa:loc.fA, locFp:loc.fP,
      zwaarteA, zwaarteP,  // ≥1 mogelijk in stapel-model
      trace:{
        availPct:f.availPct, perfPct:f.perfPct,
        wAvail:at.wAvail, wPerf:at.wPerf,
        fA:loc.fA, fP:loc.fP,locErnst:loc.ernst,locCtx:loc.ctx,locBron:loc.bron,
        assetImpactFactor:impactFactor,assetFa,assetFp,
        assetKey:m.assetKey||'',assetNaam:m.assetNaam||'',assetMatchMethode:m.assetMatchMethode||'',
        availRuw, perfRuw, availBasis, perfBasis,
        model, zwaarteA, zwaarteP,
        combi:[] // gevuld in stap 5
      },
      avail: availBasis,   // stap 4 (getoonde impact %, altijd ≤100)
      perf:  perfBasis,
      t: actueel?(opties.peildatum||Date.now()):m.tVan });
  });

  // stap 5: combiregels
  let combiHits=0;
  RULES.combiRegels.filter(c=>c.actief).forEach(c=>{
    const zelfde = c.type1===c.type2 && String(c.code1)===String(c.code2);
    for(let i=0;i<M.length;i++) for(let j=0;j<M.length;j++){
      if(i===j||(zelfde&&i>=j)) continue;
      const a=M[i], b=M[j];
      if(a.weg!==b.weg||a.richting!==b.richting) continue;
      if(!(a.typeId===c.type1 && (!c.code1||a.code===String(c.code1)))) continue;
      if(!(b.typeId===c.type2 && (!c.code2||b.code===String(c.code2)))) continue;
      if(+c.maxKm>0 && (a.hm==null||b.hm==null||Math.abs(a.hm-b.hm)>+c.maxKm)) continue;
      if(c.venMin!=null && a.t&&b.t&&Math.abs(a.t-b.t)>c.venMin*60000) continue;
      const vA=a.avail, vP=a.perf;
      a.avail=Math.min(+c.capAvail,a.avail+ +c.extraAvail);
      a.perf =Math.min(+c.capPerf, a.perf + +c.extraPerf);
      // zwaarte meebewegen met de combi-opslag (in cap-model begrensd op 1)
      const model=(RULES.cfg&&RULES.cfg.impactModel)||'cap';
      a.zwaarteA = model==='stapel' ? a.zwaarteA + (+c.extraAvail)/100 : Math.min(1,a.avail/100);
      a.zwaarteP = model==='stapel' ? a.zwaarteP + (+c.extraPerf)/100 : Math.min(1,a.perf/100);
      a.trace.zwaarteA=a.zwaarteA; a.trace.zwaarteP=a.zwaarteP;
      a.combi=(a.combi||[]).concat(c.id);
      // trace: leg vast met welke partner-melding en welke opslag
      a.trace.combi.push({id:c.id, oms:c.oms, partner:b.weg+' '+b.richting+(b.hm!=null?(' hm '+b.hm):''),
        partnerCode:b.code, extraAvail:+c.extraAvail, extraPerf:+c.extraPerf,
        vaVoor:vA, vaNa:a.avail, vpVoor:vP, vpNa:a.perf});
      combiHits++;
    }
  });

  // rapportageperiode uit de van/tot data
  const ts=[...M.map(m=>m.tVan),...M.map(m=>m.tTot)].filter(Boolean);
  // Een lijst met open storingen is een puntbeeld. Iedere open storing is op
  // de peildatum volledig actief en wordt daarom niet verdund over zijn
  // historische leeftijd. Historische loganalyse behoudt de werkelijke duur.
  const periodeJr = actueel ? 1/365.25 : (ts.length>=2 ? Math.max((Math.max(...ts)-Math.min(...ts))/(365.25*24*3600e3), 1/52) : (1/12));
  const periodeUren = actueel ? 24 : periodeJr*8760;

  // stap 6: aggregatie per wegdeel (weg+richting), op basis van getelde signaalgevers.
  // Aantal signaalgevers per wegdeel wordt geschat uit het aantal unieke (hm,strook)-
  // posities in de lijst zelf (proxy voor areaalomvang), met een ondergrens.
  const perWeg={};
  M.forEach(m=>{
    const key = wegdeelBestuurKey(m);
    const agg = perWeg[key] = perWeg[key] || {weg:m.weg,richting:m.richting,n:0,availUren:0,perfUren:0,
      posities:new Set(), typePosities:{}, typeLoss:{}, typen:{}, meldingen:[], rd:m.rd,district:m.district,vc:m.vc,basisKey:wegdeelBasisKey(m),bestuurKey:key};
    agg.n++;
    agg.typen[m.typeId]=(agg.typen[m.typeId]||0)+1;
    agg.posities.add(m.hm+'|'+m.strook);
    // effectieve standtijd binnen de rapportageperiode (clamp op periode)
    const assetMttr=(assetOverrideVoor(m.assetKey)||{}).mttr;
    const duurRaw = m.duurUren||(+assetMttr>0?+assetMttr:RULES.cfg.hw_mttr);
    const duur = actueel ? periodeUren : Math.min(duurRaw, periodeUren);
    const factor = 1;
    // gebruik de 'zwaarte' (kan >1 in stapel-model) i.p.v. het afgekapte percentage,
    // zodat gewicht en locatiefactor ook boven 100% doorwerken op de verlies-uren.
    const bijdrageAvail = m.zwaarteA*duur*factor;
    const bijdragePerf  = m.zwaarteP*duur*factor;
    agg.availUren += bijdrageAvail;
    agg.perfUren  += bijdragePerf;
    const tl = agg.typeLoss[m.typeId] = agg.typeLoss[m.typeId] || {availUren:0,perfUren:0,n:0};
    const tp = agg.typePosities[m.typeId] = agg.typePosities[m.typeId] || new Set();
    tl.availUren += bijdrageAvail;
    tl.perfUren += bijdragePerf;
    tl.n++;
    tp.add(m.hm+'|'+m.strook);
    // trace: leg de bijdrage van deze melding aan het areaal vast
    m.trace.wegdeel = agg.basisKey;
    m.trace.bestuurKey = key;
    m.trace.duurRaw = duurRaw;
    m.trace.duurGeclampt = duur;
    m.trace.duurGecapt = duurRaw > periodeUren;
    m.trace.factor = factor;
    m.trace.bijdrageAvail = bijdrageAvail;
    m.trace.bijdragePerf  = bijdragePerf;
    agg.meldingen.push(m);
  });

  const wegdelen=[];
  Object.values(perWeg).forEach(agg=>{
    // Werkelijk aantal signaalgevers uit het RWS asset-register; valt terug op
    // schatting (unieke posities, min 8) als het wegdeel niet in het register staat.
    const ar = areaalVoor(agg.vc, agg.weg, agg.richting);
    const geschat = Math.max(agg.posities.size, 8);
    const typeBron={};
    ['MSI','CAM','LUS','DRIP','WISSELBORD'].forEach(tp=>{
      const loss=agg.typeLoss[tp]||{availUren:0,perfUren:0,n:0};
      const geschatTp=Math.max((agg.typePosities[tp]&&agg.typePosities[tp].size)||loss.n||0,1);
      const Nt=areaalAantalVoorType(ar,tp,geschatTp);
      const beschTp=Math.max(0,Math.min(100,100-loss.availUren/(Nt*periodeUren)*100));
      const perfTp=Math.max(0,Math.min(100,100-loss.perfUren/(Nt*periodeUren)*100));
      typeBron[tp]={besch:Math.round(beschTp*1000)/1000,perf:Math.round(perfTp*1000)/1000,N:Nt,n:loss.n,availUren:loss.availUren,perfUren:loss.perfUren,areaalBron:ar?ar.bron:'schatting'};
    });
    const N = typeBron.MSI.N || geschat;
    const areaalBron = ar ? (ar.sig>0 ? ar.bron : 'schatting') : 'schatting';
    const besch = typeBron.MSI.besch;
    const prest = typeBron.MSI.perf;
    wegdelen.push({
      key: wegdeelBestuurLabel(agg),
      basisKey: agg.basisKey,
      bestuurKey: agg.bestuurKey,
      weg:agg.weg, richting:agg.richting, rd:agg.rd, district:agg.district, vc:agg.vc,
      n:agg.n, N, areaal:ar, areaalBron, Ngeschat:geschat,
      availUren: agg.availUren, perfUren: agg.perfUren, periodeUren,
      besch: Math.round(besch*1000)/1000,
      prestatie: Math.round(prest*1000)/1000,
      storingenJr: actueel?null:Math.round(agg.n/periodeJr*10)/10,
      typen:agg.typen, typeBron, meldingen:agg.meldingen
    });
  });
  wegdelen.sort((a,b)=> a.besch-b.besch || b.n-a.n);

  // ── CHOKE-POINTS: cluster storingen per wegdeel op korte afstand ──
  const CHOKE_VENSTER = (RULES.cfg&&RULES.cfg.chokeVenster)||2;
  // Een lange weg met verspreide storingen kan lokaal toch "dichtslibben".
  // We clusteren op hm binnen CHOKE_VENSTER km en berekenen een LOKALE
  // beschikbaarheid: verlies-uren gedeeld door de signaalgevers ín het segment
  // (geschat als areaal-N × segmentlengte / weglengte, ondergrens 1).
  wegdelen.forEach(wd=>{
    const items=wd.meldingen.filter(m=>m.hm!=null).slice().sort((a,b)=>a.hm-b.hm);
    // weglengte schatten uit de spreiding van alle hm's op dit wegdeel
    const alleHm=items.map(m=>m.hm);
    const wegLen = alleHm.length? Math.max(alleHm[alleHm.length-1]-alleHm[0], 1) : 1;
    const clusters=[]; let cur=null;
    items.forEach(m=>{
      if(cur && (m.hm-cur.hmMax)<=CHOKE_VENSTER){ cur.leden.push(m); cur.hmMax=m.hm; }
      else { cur={hmMin:m.hm,hmMax:m.hm,leden:[m]}; clusters.push(cur); }
    });
    wd.chokes = clusters.map(c=>{
      const lengte=Math.max(c.hmMax-c.hmMin,0.2);
      const availU=c.leden.reduce((s,m)=>s+m.trace.bijdrageAvail,0);
      const perfU=c.leden.reduce((s,m)=>s+m.trace.bijdragePerf,0);
      // lokale signaalgevers in dit segment (naar rato van lengte), min 1
      const Nlok=Math.max(1, Math.round(wd.N * lengte / wegLen));
      const beschLok=Math.max(0, Math.min(100, 100 - availU/(Nlok*periodeUren)*100));
      const prestLok=Math.max(0, Math.min(100, 100 - perfU/(Nlok*periodeUren)*100));
      return {
        hmMin:c.hmMin, hmMax:c.hmMax, lengte, n:c.leden.length,
        dichtheid: c.leden.length/lengte,
        availU, perfU, Nlok,
        beschLok: Math.round(beschLok*100)/100,
        prestLok: Math.round(prestLok*100)/100,
        fatale: c.leden.filter(m=>m.code==='1003').length,
        leden:c.leden
      };
    }).sort((a,b)=> a.beschLok-b.beschLok || b.n-a.n);
    // choke-score: hoe erg is het zwaarste cluster (0 = geen probleem)
    wd.chokeScore = wd.chokes.length ? (100-wd.chokes[0].beschLok) : 0;
    wd.wegLen = wegLen;
  });

  // ── DIENST-DOORREKENING ──
  // Per wegdeel: reken per dienst de ketenbeschikbaarheid door.
  // De beschikbaarheid van een objecttype-schakel = 100 − (100 − b_bron),
  // waar b_bron de MSI/CAM/LUS-areaalwaarde is; ontbreekt een bron dan 100%.
  // Ketenbeschikbaarheid = gewogen (afh) i.p.v. puur serieel, zodat de
  // dominante afhankelijkheid (signalering) de dienst bepaalt maar overige
  // schakels bijdragen. Prestatie analoog met de perf-waarden.
  const brontabel = wd => {
    const t={};
    ['MSI','CAM','LUS','DRIP','WISSELBORD'].forEach(tp=>{
      const b=wd.typeBron&&wd.typeBron[tp];
      t[tp]=b&&b.n?{besch:b.besch,perf:b.perf,N:b.N,n:b.n}:{besch:100,perf:100,N:b?b.N:0,n:0};
    });
    return t;
  };
  wegdelen.forEach(wd=>{
    const bron = brontabel(wd);
    wd.bron = bron;
    wd.diensten={};
    DIENSTEN.forEach(d=>{
      const totaal=dienstWaardeUitSubprocessen(d,bron);
      const besch=totaal.besch,prest=totaal.prestatie;
      wd.diensten[d.id]={
        besch: Math.round(besch*100)/100,
        prestatie: Math.round(prest*100)/100,
        norm:d.norm, detail:totaal.detail, sumW:totaal.gewicht,
        status: statusVan(besch,d.norm)
      };
    });
  });

  // Netwerkbrede dienstwaarden = areaalgewogen gemiddelde. Het aantal
  // storingen als gewicht zou een cirkelredenering geven: slechte wegdelen
  // tellen dan juist zwaarder omdat ze slecht zijn.
  const netwerk={};
  DIENSTEN.forEach(d=>{
    let sb=0,sp=0,w=0, onderNorm=0;
    wegdelen.forEach(wd=>{
      const dd=wd.diensten[d.id]; const ww=wd.N||1;
      sb+=dd.besch*ww; sp+=dd.prestatie*ww; w+=ww;
      if(dd.besch<d.norm) onderNorm++;
    });
    netwerk[d.id]={
      besch: w? Math.round(sb/w*100)/100 : 100,
      prestatie: w? Math.round(sp/w*100)/100 : 100,
      norm:d.norm, onderNorm,
      status: statusVan(w?sb/w:100, d.norm)
    };
  });

  return {
    wegdelen, netwerk,
    meldingen:M, nietDoorgerekend,
    stats:{ totaal:rijen.length, toegepast:M.length, dubbel, nietGecl, zonderFoutregel,zonderLocatie,
      assetGekoppeld:M.filter(m=>m.assetKey).length,
      assetNietGekoppeld:M.filter(m=>!m.assetKey&&m.assetMatchStatus!=='buiten-areaal').length,
      assetBuitenAreaal:M.filter(m=>m.assetMatchStatus==='buiten-areaal').length,
      msi:M.filter(m=>m.typeId==='MSI').length,
      cam:M.filter(m=>m.typeId==='CAM').length,
      lus:M.filter(m=>m.typeId==='LUS').length,
      wisselbord:M.filter(m=>m.typeId==='WISSELBORD').length,
      combiHits, actueel, periodeJr:actueel?periodeJr:Math.round(periodeJr*100)/100,
      periodeUren:Math.round(periodeUren),
      areaalDirect: wegdelen.filter(w=>w.areaalBron==='direct'||w.areaalBron==='geladen-register').length,
      areaalWeg: wegdelen.filter(w=>w.areaalBron==='weg-totaal'||w.areaalBron==='geladen-register-weg').length,
      areaalSchat: wegdelen.filter(w=>w.areaalBron==='schatting').length,
      totaalSig: wegdelen.reduce((s,w)=>s+w.N,0),
      wegdelen:wegdelen.length }
  };
}

/* ══════════════════════════════════════════════════════════════
   MEMO-GENERATOR — bestuurlijke/operationele memo's per tabblad
   Geschreven vanuit VWM (bedienorganisatie) naar een andere beheerder.
   Vaste opbouw: aanleiding · beschrijving · risico · conclusie ·
   gevraagd besluit · verwachte uitkomst besluit. Deterministisch uit
   de werkelijke doorrekening; geen AI-taal, geen holle frasen.
   ══════════════════════════════════════════════════════════════ */

/* Ontvangerniveaus bepalen toon, detaildiepte en het gevraagde besluit.
   VWM schrijft steeds als afzender (bedienorganisatie) naar de beheerder. */
const MEMO_NIVEAUS = {
  technisch: {
    label:'Technisch beheerder',
    aanhef:'Aan: Technisch beheerder DVM',
    detail:'hoog',
    toon:'Cijfermatig en concreet; benoemt foutcodes, hectometrering en storingsduur expliciet.'
  },
  tactisch: {
    label:'Tactisch beheerder / assetmanager',
    aanhef:'Aan: Assetmanagement / tactisch beheer',
    detail:'middel',
    toon:'Koppelt de storingsbeelden aan areaalprestatie en onderhoudsprioriteit.'
  },
  bestuurlijk: {
    label:'Bestuurlijk / HID-niveau',
    aanhef:'Aan: Bestuurlijk verantwoordelijke (HID Regio / GPO)',
    detail:'laag',
    toon:'Beknopt, gericht op dienstverlening, risico en besluit; techniek op hoofdlijnen.'
  }
};

/* Zes bedrijfswaarden — optionele koppeling naar de bedrijfswaardenmatrix. */
const MEMO_BEDRIJFSWAARDEN = ['Veiligheid','Leefbaarheid','Duurzaamheid','Bereikbaarheid','Maatschappelijke impact','Betrouwbare overheid'];

/* Zwaartepunt van de memo: 0 = volledig technisch, 100 = volledig dienstgericht.
   50 = neutraal (het bestaande gedrag). Ingesteld via de schuifknop in de modal. */
let MEMO_ZWAARTEPUNT = 50;
function memoAccentTechniek(){ return MEMO_ZWAARTEPUNT<=35; }
function memoAccentDienst(){ return MEMO_ZWAARTEPUNT>=65; }
/* Korte accentzin die vóór de risicoparagraaf komt en het perspectief expliciet
   verschuift tussen techniek en dienstverlening. */
function memoZwaartepuntAccent(kort){
  if(memoAccentTechniek()) return `De nadruk in deze memo ligt op het technische storingsbeeld: assets, foutcodes, hersteltijd en de concrete herstelinzet. `;
  if(memoAccentDienst()) return `De nadruk in deze memo ligt op het gevolg voor de VWM-dienstverlening en de weggebruiker; het technische detail is samengevat en dient als onderbouwing. `;
  return '';
}
/* Beschrijf het raakvlak met werkzaamheden en U-routes uit de operationele
   context (maakOperationeleContext). Bewust in gevolg-taal: werkzaamheden en
   omleidingen verhogen de technische faalkans niet, maar bepalen de
   operationele blootstelling en het effect op omleidingsroutes. */
function memoOperationeelRaakvlak(context){
  const c=context; if(!c) return '';
  let z='';
  if(!c.werkGeladen&&!c.uRouteGeladen) return 'Geen werkzaamheden of U-routes geladen; het raakvlak met wegwerkzaamheden en omleidingsroutes is in deze memo niet beoordeeld. ';
  const werkLocaties=(c.werkDetails||[]).slice(0,3).map(w=>`${w.id||'werk'}: ${w.locatie}${w.periode?` (${w.periode})`:''}`);
  const routeLocaties=(c.routeDetails||[]).slice(0,3).map(r=>`${r.naam}: ${r.locatie}`);
  const routeInzet=(c.routeDetails||[]).slice(0,3).map(r=>`${r.ref}: ${r.inzetVoorN} voor de route, ${r.inzetNaN} na de route, ${r.assetsLangsN} langs de route-as`);
  if(c.werkGeladen){
    if(c.werkenExact){
      z += `In de betreffende periode raken ${c.werkenExact} exact gelokaliseerde werkvak(ken) ${c.assetsBinnen2Km} van de betrokken assets binnen ±${WERK_BUFFER_KM} km; ${c.verstoordBinnen2Km} van de geanalyseerde storingen valt binnen die werkbuffer. Waar een storing en een werkvak samenvallen, staat de signalering rond de afzetting onder druk: het afkruisen, de snelheidsverlaging en de veilige afscherming van het werkvak leunen juist dáár op de MSI. `;
      if(werkLocaties.length) z += `Locatiebeeld werkzaamheden: ${memoLijst(werkLocaties)}. `;
    } else if(c.werkenWeg){
      z += `In de betreffende periode liggen ${c.werkenWeg} werkvak(ken) op dezelfde weg als de betrokken assets; door ontbrekende hectometers of RD-coördinaten is dit alleen wegcontext en geen exact raakvlak. `;
      if(werkLocaties.length) z += `Bekende werkcontext: ${memoLijst(werkLocaties)}. `;
    } else {
      z += `Er zijn in de betreffende periode geen overlappende werkzaamheden op de betrokken wegen gevonden. `;
    }
  }
  if(c.uRouteGeladen){
    if(c.routeMatches){
      z += `Daarnaast zijn ${c.routeMatches} U-route(s) operationeel gekoppeld aan de werkzaamheden of betrokken wegen. Een U-route is hier geen losse routecode maar een omleiding: de operationele inzet zit in de assets vóór de route, ná de route en langs de route-as. Er zijn ${c.routeInzetAssets||0} inzetassets vóór of ná de gekoppelde route(s) gevonden en ${c.routeAssets} assets langs de route-as; ${c.verstoordOpRoute} van de geanalyseerde storingen ligt op een gekoppelde U-route. Uitval op een U-route raakt de omleiding zelf: bij een afsluiting of incident wordt het verkeer over deze route geleid, waardoor betrouwbare signalering en route-informatie op de U-route extra zwaar wegen. `;
      if(c.routeRefs&&c.routeRefs.length) z += `Concreet betreft dit de route(s) ${memoLijst(c.routeRefs.slice(0,5))}${c.routeRefs.length>5?` en ${c.routeRefs.length-5} andere`:''}. `;
      if(routeLocaties.length) z += `Locatiebeeld U-route(s): ${memoLijst(routeLocaties)}. `;
      if(routeInzet.length) z += `Inzetbeeld: ${memoLijst(routeInzet)}. `;
    } else {
      z += `Er is geen U-route die binnen de veilige afstand hetzelfde werkvak op dezelfde hoofdweg raakt. `;
    }
  }
  if(c.serviceDetails&&c.serviceDetails.length) z += `De geraakte diensten zijn vooral ${memoLijst(c.serviceDetails.slice(0,3).map(d=>d.naam))}. `;
  return z;
}

/* Vertaal een beschikbaarheids-tekort naar een risiconiveau-indicatie. */
function memoRisicoNiveau(besch, norm){
  const t = norm - besch;
  if (besch>=norm) return {kort:'laag', niveau:'V/L', bw:'Beperkt effect op bedrijfswaarden; areaal presteert op of boven norm.'};
  if (t<1)  return {kort:'beperkt', niveau:'M', bw:'Merkbaar effect op Bereikbaarheid; veiligheid vooralsnog geborgd via terugvalbediening.'};
  if (t<3)  return {kort:'verhoogd', niveau:'H', bw:'Effect op Bereikbaarheid en Veiligheid; kans op vermijdbare kosten (Maatschappelijke impact) neemt toe.'};
  return {kort:'hoog', niveau:'ZH', bw:'Structureel effect op Veiligheid en Bereikbaarheid; risico op reputatie-effect (Betrouwbare overheid) bij uitblijven maatregelen.'};
}

/* MSI-assets zoals in deze tool. Alleen deze assets worden geduid. */
function memoAssetContext(){
  return 'matrixsignaalgevers (MSI) en bijbehorende signalering langs het hoofdwegennet';
}

/* Hulpfunctie: samenvattende regel per dienst. */
function memoDienstRegel(d){
  const n=STATE.netwerk[d.id];
  const st=n.besch>=d.norm?'op norm':(n.besch>=d.norm-1?'krap onder norm':(n.besch>=d.norm-3?'onder norm':'kritiek'));
  return `${d.naam.replace(/&amp;/g,'&')}: ${fmt(n.besch,2)}% beschikbaarheid (norm ${fmt(d.norm,1)}%, ${st})`;
}

/* Nederlandse opsomming: ['A','B','C'] → 'A, B en C'. */
function memoLijst(arr){
  arr=arr.filter(Boolean);
  if(!arr.length) return '';
  if(arr.length===1) return arr[0];
  return arr.slice(0,-1).join(', ')+' en '+arr[arr.length-1];
}

/* Extraheer concrete, dataspecifieke feiten uit de doorrekening voor een
   dienst: de wegvakken die deze dienst het hardst raken, de dominante
   foutcodes en de spreiding. Zo krijgen de memo's inhoud die alleen uit
   déze storingslijst kan komen (i.p.v. algemene bewoordingen). */
function memoFeiten(dienstId){
  const F={ zwaarsteWegvakken:[], foutcodes:[], totaalStoringen:0, meestGetroffenWeg:null };
  if(!STATE.wegdelen || !STATE.wegdelen.length) return F;
  // wegvakken gesorteerd op laagste beschikbaarheid voor deze dienst (of areaal)
  const key = dienstId ? (w=>w.diensten[dienstId] ? w.diensten[dienstId].besch : w.besch) : (w=>w.besch);
  const gesorteerd = STATE.wegdelen.filter(w=>w.n>0).slice().sort((a,b)=>key(a)-key(b));
  F.zwaarsteWegvakken = gesorteerd.slice(0,3).map(w=>({
    key:w.key, besch:key(w), n:w.n, N:w.N,
    choke: (w.chokes&&w.chokes[0]&&w.chokes[0].n>=2)?w.chokes[0]:null
  }));
  // dominante foutcodes over alle meldingen
  const codeTeller={};
  (STATE.meldingen||[]).forEach(m=>{ const c=String(m.code||''); codeTeller[c]=(codeTeller[c]||0)+1; });
  F.totaalStoringen=(STATE.meldingen||[]).length;
  F.foutcodes = Object.entries(codeTeller).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([code,n])=>{
    const fc=RULES.foutcodes.find(f=>String(f.code)===code);
    return { code, n, oms:fc?fc.oms:'', pct: F.totaalStoringen?Math.round(n/F.totaalStoringen*100):0 };
  });
  // weg (A2, A10…) met de meeste storingen
  const wegTeller={};
  STATE.wegdelen.forEach(w=>{ if(w.weg) wegTeller[w.weg]=(wegTeller[w.weg]||0)+w.n; });
  const topWeg=Object.entries(wegTeller).sort((a,b)=>b[1]-a[1])[0];
  if(topWeg) F.meestGetroffenWeg={weg:topWeg[0], n:topWeg[1]};
  return F;
}
/* Formuleer een foutcode-zin, bv. "foutcode 1002 (aanstuurcircuit, 42%)". */
function memoFoutcodeZin(fc){
  if(!fc) return '';
  const oms=fc.oms?fc.oms.replace(/\.$/,'').toLowerCase():'';
  return `foutcode ${fc.code}${oms?` (${oms})`:''}`;
}

/* Bouw de zes vaste secties op als tekstobject. */
function memoSecties(bron, niveau, koppelBW){
  const N=MEMO_NIVEAUS[niveau];
  const detailHoog = N.detail==='hoog';
  const detailLaag = N.detail==='laag';
  let s={aanleiding:'',beschrijving:'',risico:'',conclusie:'',besluit:[],uitkomst:''};

  if (bron.type==='overzicht'){
    const onder = DIENSTEN.filter(d=>STATE.netwerk[d.id].besch < d.norm);
    const zwakst = [...DIENSTEN].sort((a,b)=>STATE.netwerk[a.id].besch-STATE.netwerk[b.id].besch)[0];
    const zn = STATE.netwerk[zwakst.id];
    const risk = memoRisicoNiveau(zn.besch, zwakst.norm);
    const F = memoFeiten(zwakst.id);
    const wv = F.zwaarsteWegvakken;
    const wvNamen = wv.map(w=>w.key);
    const topFout = F.foutcodes[0];
    const tweedeFout = F.foutcodes[1];

    s.aanleiding = `VWM levert vier diensten die direct afhankelijk zijn van de matrixsignaalgevers (MSI) langs het hoofdwegennet. De lijst met open storingen${STATE.bestand?` (${esc(STATE.bestand)})`:''}${STATE.peildatum?` per ${new Date(STATE.peildatum).toLocaleDateString('nl-NL')}`:''} is als actueel puntbeeld doorgerekend naar die vier diensten. Historische storingslogs zijn hiervan uitgesloten en worden alleen voor prognoses gebruikt. `
      + (onder.length
          ? `Uit die doorrekening blijkt dat ${onder.length===1?'één dienst':`${onder.length} diensten`} onder de afgesproken norm ${onder.length===1?'presteert':'presteren'}; VWM vraagt de beheerder om afstemming over het herstel.`
          : `De uitkomst valt binnen norm, maar VWM deelt het beeld zodat de beheerder de marge kan bewaken.`);

    // Beschrijving: concrete cijfers, zwaarste dienst, dominante foutcode, zwaarste wegvakken
    let beschr = `De analyse betreft ${STATE.stats.toegepast} storingen op ${STATE.stats.wegdelen} wegvakken, getoetst aan het werkelijke areaal uit het asset-register. `;
    if (onder.length){
      beschr += `${zwakst.naam.replace(/&amp;/g,'&')} komt het laagst uit op ${fmt(zn.besch,2)}% (norm ${fmt(zwakst.norm,1)}%), een tekort van ${fmt(zwakst.norm-zn.besch,2)} procentpunt. `;
      if (wvNamen.length){
        beschr += `Het beeld wordt gedragen door een beperkt aantal wegvakken: ${memoLijst(wv.map(w=>`${w.key} (${fmt(w.besch,1)}%, ${w.n} storingen)`))}. `;
      }
      if (topFout){
        beschr += `Naar oorzaak domineert ${memoFoutcodeZin(topFout)}, goed voor ${topFout.pct}% van de storingen${tweedeFout?`, gevolgd door ${memoFoutcodeZin(tweedeFout)} (${tweedeFout.pct}%)`:''}. `;
      }
    } else {
      beschr += `Alle vier de diensten blijven op of boven norm; de laagste is ${zwakst.naam.replace(/&amp;/g,'&')} met ${fmt(zn.besch,2)}% (norm ${fmt(zwakst.norm,1)}%). `;
    }
    if (detailHoog){
      beschr += `Volledig beeld — ${DIENSTEN.map(memoDienstRegel).join('; ')}.`;
    }
    s.beschrijving = beschr.trim();

    // Risico: koppel aan de concrete zwaarste wegvakken en hun rol
    const chokeWv = wv.find(w=>w.choke);
    s.risico = `Het zwaartepunt van het risico ligt op ${zwakst.naam.replace(/&amp;/g,'&')}${wvNamen.length?`, en binnen die dienst op ${memoLijst(wvNamen.slice(0,2))}`:''}. ${risk.bw} `;
    if (zwakst.id==='vm' || zwakst.id==='im'){
      s.risico += `Concreet betekent dit dat op deze wegvakken rijstroken niet altijd tijdig en geverifieerd kunnen worden afgekruist, wat incidentafhandeling en stuurbaarheid vertraagt. `;
    } else if (zwakst.id==='rri'){
      s.risico += `Concreet betekent dit dat reis- en route-informatie op deze trajecten minder betrouwbaar wordt aangeboden. `;
    } else {
      s.risico += `Concreet betekent dit dat de afscherming en monitoring rond werkvakken op deze trajecten onder druk staat. `;
    }
    if (chokeWv) s.risico += `Op ${chokeWv.key} concentreren de storingen zich bovendien lokaal (hm ${chokeWv.choke.hmMin.toFixed(1)}), waardoor het werkelijke knelpunt scherper is dan het wegvakgemiddelde suggereert. `;
    if (koppelBW) s.risico += `In de bedrijfswaardenmatrix raakt dit primair Bereikbaarheid en Veiligheid (indicatief niveau ${risk.niveau}).`;

    // Conclusie: expliciet, zonder de besluit-frase te herhalen
    s.conclusie = onder.length
      ? `De storingen zijn geconcentreerd genoeg om gericht aan te pakken: ${wvNamen.length?`met herstel op ${memoLijst(wvNamen)} wordt het grootste deel van het tekort op ${zwakst.naam.replace(/&amp;/g,'&')} weggenomen`:'een beperkt aantal wegvakken bepaalt het tekort'}. Een generieke areaalbrede aanpak is daarvoor niet nodig en niet doelmatig.`
      : `De dienstverlening blijft binnen norm. Het reguliere hersteltempo volstaat; aanvullende maatregelen zijn nu niet aan de orde.`;

    // Besluit: concreet, met wegvaknamen en aantallen
    s.besluit = onder.length
      ? [
          `Prioriteer het openstaande herstel op ${memoLijst(wvNamen)}${wv[0]?` (te beginnen bij ${wv[0].key}, ${wv[0].n} storingen)`:''}.`,
          topFout?`Onderzoek of de oververtegenwoordiging van ${memoFoutcodeZin(topFout)} (${topFout.pct}%) een gemeenschappelijke oorzaak heeft die gebundeld kan worden verholpen.`:`Bepaal de hersteltvolgorde op basis van de dienstimpact per wegvak.`,
          `Koppel binnen een af te spreken termijn terug aan VWM over de voortgang, zodat de doorrekening kan worden geactualiseerd.`
        ]
      : [
          `Handhaaf het reguliere hersteltempo; er is geen aanvullende inzet nodig.`,
          `Informeer VWM bij nieuwe storingen op ${F.meestGetroffenWeg?F.meestGetroffenWeg.weg:'de zwaarder belaste wegvakken'} die de marge kunnen aantasten.`
        ];
    if (koppelBW) s.besluit.push(`Weeg dit beeld mee in de bedrijfswaardenmatrix voor de vervolgprioritering.`);

    s.uitkomst = onder.length
      ? `Met herstel op ${memoLijst(wvNamen)} keert ${zwakst.naam.replace(/&amp;/g,'&')} naar verwachting terug boven ${fmt(zwakst.norm,1)}% en daalt het aantal diensten onder norm van ${onder.length} naar nul. VWM verifieert dit in een volgende doorrekening op dezelfde storingslijst.`
      : `De verwachting is dat de dienstverlening op norm blijft. VWM herhaalt de doorrekening bij een volgende actualisatie van de storingslijst.`;
  }

  else if (bron.type==='gebied'){
    const cp = bron.choke; // zwaarste choke-cluster (identiek aan scherm)
    const risk = memoRisicoNiveau(cp.beschLok, RULES.cfg.kpi_msi||99.5);
    // dominante foutcode binnen dit cluster
    let clFout=null;
    if (cp.leden && cp.leden.length){
      const t={}; cp.leden.forEach(m=>{ const c=String(m.code||''); t[c]=(t[c]||0)+1; });
      const top=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];
      if(top){ const fc=RULES.foutcodes.find(f=>String(f.code)===top[0]); clFout={code:top[0], n:top[1], oms:fc?fc.oms:''}; }
    }
    const gat = bron.wdBesch - cp.beschLok;

    s.aanleiding = `Bij het doorrekenen van de storingslijst valt op ${bron.wegKey} een lokale opeenhoping van MSI-storingen op die in het wegvakgemiddelde niet zichtbaar is. VWM legt dit knelpunt voor aan de beheerder, omdat gerichte inzet hier meer oplevert dan areaalbrede aanpak.`;

    s.beschrijving = `${bron.regioNaam?`Binnen ${bron.regioNaam}`:'Netwerkbreed'} telt de choke-point-analyse (clustering binnen ${bron.chokeVenster||2} km) ${bron.totaalClusters} clusters, waarvan ${bron.ernstig} met een lokale beschikbaarheid onder 80%. Het scherpst is ${bron.wegKey} bij hectometer ${cp.hmMin.toFixed(1)}${cp.hmMax>cp.hmMin?`–${cp.hmMax.toFixed(1)}`:''}: daar staan ${cp.n} storingen op ${cp.lengte.toFixed(1)} km (${cp.dichtheid.toFixed(1)} per km). `
      + `Lokaal zakt de signaleringsbeschikbaarheid naar ${fmt(cp.beschLok,1)}%, terwijl ${bron.wegKey} gemiddeld op ${fmt(bron.wdBesch,1)}% staat — een verschil van ${fmt(gat,1)} procentpunt dat in het gemiddelde wegvalt. `;
    if (clFout) s.beschrijving += `Binnen het cluster is ${memoFoutcodeZin(clFout)} het meest voorkomend (${clFout.n} van de ${cp.n}). `;
    else if (detailHoog && cp.fatale) s.beschrijving += `Hiervan zijn ${cp.fatale} fatale uitvallen (foutcode 1003). `;

    s.risico = `Binnen dit segment is de signaleringsdekking bij een incident onvoldoende geborgd. ${risk.bw} `
      + `Valt er een incident tussen hm ${cp.hmMin.toFixed(1)} en ${(cp.hmMax>cp.hmMin?cp.hmMax:cp.hmMin+0.5).toFixed(1)}, dan kan de betrokken rijstrook niet betrouwbaar worden afgekruist, met vertraging in de afhandeling als gevolg. `;
    if (koppelBW) s.risico += `In de bedrijfswaardenmatrix betreft dit Veiligheid en Bereikbaarheid (indicatief niveau ${risk.niveau}).`;

    s.conclusie = `${bron.wegKey} hm ${cp.hmMin.toFixed(1)} is het punt waar herstelinzet het meeste rendement heeft: ${cp.n} storingen op één kort segment. Afhandeling via het wegvakgemiddelde onderschat dit risico met ${fmt(gat,1)} procentpunt.`
      + (bron.ernstig>1?` Na dit knelpunt vragen nog ${bron.ernstig-1} andere ernstige choke-points om aandacht.`:'');

    s.besluit = [
      `Prioriteer het herstel van de MSI-storingen in het segment ${bron.wegKey} hm ${cp.hmMin.toFixed(1)}${cp.hmMax>cp.hmMin?`–${cp.hmMax.toFixed(1)}`:''}.`,
      `Beoordeel of de opeenstapeling op dit segment een structurele oorzaak heeft (bekabeling, voeding, ouderdom) die gebundeld onderhoud rechtvaardigt.`
    ];
    if (koppelBW) s.besluit.push(`Weeg het choke-point mee in de risicoafweging via de bedrijfswaardenmatrix.`);

    s.uitkomst = `Na gericht herstel van dit segment stijgt de lokale beschikbaarheid richting het wegvakgemiddelde van ${fmt(bron.wdBesch,1)}% of hoger, en verdwijnt het knelpunt uit de choke-point-analyse. VWM verifieert dit in een volgende doorrekening.`;
  }

  else if (bron.type==='montecarlo'){
    const n=bron.mc.netwerk;
    const norm = bron.norm!=null ? bron.norm : (RULES.cfg.kpi_msi||99.5);
    const kansOnder = bron.kansOnder;
    const risk = memoRisicoNiveau(n.p50, norm);
    // concrete zwaarste wegvakken uit de prognose (altijd, niet alleen detailHoog)
    const zwak=[...bron.mc.wegRes].sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50).slice(0,3);
    const zwakNamen=zwak.map(x=>x.wd.key);
    const bandBreedte = n.p95 - n.p5;

    s.aanleiding = `Voor de meerjarige onderhoudsplanning heeft VWM het huidige storingspatroon van de MSI-signalering ${bron.mc.horizon} jaar vooruit geprojecteerd, op basis van ${bron.mc.histP} jaar dagelijkse storingsdata. Deze memo deelt de prognose met de beheerder.`;

    s.beschrijving = `De simulatie (${bron.mc.runs.toLocaleString('nl-NL')} runs) komt uit op een verwachte netwerkbrede beschikbaarheid van ${fmt(n.p50,2)}% over ${bron.mc.horizon} jaar, met een 90%-band van ${fmt(n.p5,2)}% tot ${fmt(n.p95,2)}% (spreiding ${fmt(bandBreedte,2)} procentpunt). `;
    if (n.logsN) s.beschrijving += `Voor ${n.logsN} wegvakken is daarbij de werkelijke storingsfrequentie en hersteltijd uit de logbestanden gebruikt. `;
    if (zwak.length){
      s.beschrijving += `De laagste prognoses liggen bij ${memoLijst(zwak.map(x=>`${x.wd.key} (${fmt(x.mc.besch.p50,1)}%, band ${fmt(x.mc.besch.p5,1)}–${fmt(x.mc.besch.p95,1)}%)`))}. `;
    }
    s.beschrijving += memoVcDuidingVoorMonteCarlo(bron);

    s.risico = `De breedte van de band (${fmt(bandBreedte,2)} procentpunt) zegt hoe zeker de prognose is. ${risk.bw} `
      + (kansOnder>5
          ? `De kans dat de norm van ${fmt(norm,1)}% niet wordt gehaald is ${fmt(kansOnder,0)}%${zwakNamen.length?`, met ${memoLijst(zwakNamen.slice(0,2))} als grootste risico`:''}. Dat pleit voor ingrijpen vóórdat de dienstverlening onder norm zakt.`
          : `De kans op normoverschrijding is ${fmt(kansOnder,0)}%; het patroon leidt naar verwachting niet tot een structureel probleem.`);
    if (koppelBW) s.risico += ` In de bedrijfswaardenmatrix raakt dit Bereikbaarheid en Maatschappelijke impact (vermijdbare kosten), indicatief niveau ${risk.niveau}.`;

    s.conclusie = kansOnder>5
      ? `Bij ongewijzigd beleid is normoverschrijding binnen ${bron.mc.horizon} jaar reëel. De winst zit in vervroegd onderhoud op ${zwakNamen.length?memoLijst(zwakNamen):'de zwaarst belaste wegvakken'}, niet in areaalbrede maatregelen.`
      : `De prognose is stabiel binnen norm. Het huidige onderhoudsbeleid volstaat, met periodieke herijking op nieuwe storingsdata.`;

    s.besluit = kansOnder>5
      ? [
          `Neem de prognose op in de meerjarige onderhoudsplanning voor de MSI-signalering.`,
          `Weeg vervroegd onderhoud op ${zwakNamen.length?memoLijst(zwakNamen):'de wegvakken met de laagste prognose'} af tegen de vermeden storingslast.`
        ]
      : [
          `Neem kennis van de prognose en herijk deze bij een volgende actualisatie van de storingsdata.`,
          `Handhaaf het huidige onderhoudsbeleid.`
        ];
    if (koppelBW) s.besluit.push(`Koppel de prognose desgewenst aan de bedrijfswaardenmatrix voor de meerjarige risicoafweging.`);

    s.uitkomst = kansOnder>5
      ? `Met vervroegd of geïntensiveerd onderhoud daalt de kans op normoverschrijding onder de ${fmt(kansOnder,0)}% en schuift de prognose-mediaan omhoog. VWM actualiseert de prognose zodra nieuwe storingsdata beschikbaar is.`
      : `De verwachte beschikbaarheid blijft binnen de bandbreedte ${fmt(n.p5,2)}–${fmt(n.p95,2)}%; er zijn geen aanvullende maatregelen voorzien.`;
  }

  else if (bron.type==='drip-montecarlo'){
    const R=bron.mc, n=R.netwerk;
    const geselecteerdN=R.geselecteerdN!=null?R.geselecteerdN:R.perDrip.length+(R.statusUitgesloten||0);
    const HI=R.historieInfo||{aan:false,gekoppeldeSelectie:0,incidentenSelectie:0,duurWaarnemingen:0,modelDrips:R.perDrip.length,dekkingDagen:0};
    const HV=R.historieVergelijking||null;
    const diensten=DIENSTEN.filter(d=>(R.dienstAandelen[d.id]||0)>0).map(d=>({d,st:R.diensten[d.id]}));
    const zwakste=diensten.slice().sort((a,b)=>a.st.p50-b.st.p50)[0];
    const onderNorm=diensten.filter(x=>x.st.p50<x.d.norm);
    const onderNormP5=diensten.filter(x=>x.st.p5<x.d.norm);
    const top=R.perDrip.slice().sort((a,b)=>b.gemEvents-a.gemEvents).slice(0,5);
    const topNamen=top.map(p=>`${esc(dripMemoLabel(p.d))} (${fmt(p.gemEvents,1)} verwachte storingen)`);
    const totaalGem=R.perDrip.reduce((som,p)=>som+(p.gemEvents||0),0);
    const topAandeel=totaalGem>0?top.reduce((som,p)=>som+(p.gemEvents||0),0)/totaalGem*100:0;
    const jaarWaarden=(R.cum&&R.cum.perJaar)||[];
    const jaren=(R.cum&&R.cum.jaren)||[];
    const piekWaarde=jaarWaarden.length?Math.max(...jaarWaarden):0;
    const piekIndex=jaarWaarden.indexOf(piekWaarde);
    const trendWaarden=jaarWaarden.length>2?jaarWaarden.slice(1,-1):jaarWaarden;
    const eersteVol=trendWaarden.length?trendWaarden[0]:0, laatsteVol=trendWaarden.length?trendWaarden[trendWaarden.length-1]:0;
    const richting=laatsteVol>eersteVol*1.05?'loopt op':laatsteVol<eersteVol*0.95?'neemt af':'blijft ongeveer gelijk';
    const dienstZin=zwakste?`${zwakste.d.naam.replace(/&amp;/g,'&')} komt het laagst uit op ${fmt(zwakste.st.p50,4)}%, met een p5–p95-band van ${fmt(zwakste.st.p5,4)}% tot ${fmt(zwakste.st.p95,4)}% en een norm van ${fmt(zwakste.d.norm,1)}%.`:'';
    const histZin=HI.aan
      ? `${HI.gekoppeldeSelectie} van de ${R.perDrip.length} operationeel doorgerekende DRIPs zijn gekalibreerd met ${HI.incidentenSelectie.toLocaleString('nl-NL')} unieke incidenten en ${HI.duurWaarnemingen.toLocaleString('nl-NL')} bruikbare duurwaarnemingen. De overige ${HI.modelDrips} operationeel doorgerekende DRIPs blijven op het leeftijdsmodel.`
      : `Historische kalibratie stond uit. De uitkomst is daarom gebaseerd op bouwjaar, levensduur, Weibull-vormparameter en de groeps-MTTR.`;
    const vergelijkingZin=HI.aan&&HV&&HV.factor!=null
      ? `Bij dezelfde selectie, periode en leeftijdsaannames geeft het zuivere leeftijdsmodel centraal ${fmt(HV.modelEvents,0)} storingen. Na historische kalibratie is dit ${fmt(HV.gekalibreerdEvents,0)}, een factor ${fmt(HV.factor,2)}. Bij ${HV.verhoogdN} gekoppelde DRIPs verhoogt de historie de centrale verwachting en bij ${HV.verlaagdN} verlaagt zij die.`
      : '';
    const kalibratieDrivers=HI.aan&&HV&&HV.topStijging&&HV.topStijging.length
      ? `De grootste opwaartse kalibratie komt van ${memoLijst(HV.topStijging.slice(0,3).map(x=>`${esc(x.id)} (${fmt(x.model,1)} naar ${fmt(x.gekalibreerd,1)})`))}.`
      : '';

    s.aanleiding = `VWM heeft voor ${R.periodeLabel||R.jaarVan+' tot en met '+R.jaarTot} een Monte Carlo-analyse uitgevoerd voor ${geselecteerdN} geselecteerde DRIPs. Daarvan zijn ${R.perDrip.length} operationele DRIPs doorgerekend${R.statusUitgesloten?`; ${R.statusUitgesloten} niet-operationele DRIPs zijn zichtbaar uitgesloten`:''}. Doel is vast te stellen hoe veroudering, terugkerende storingen en hersteltijden doorwerken in DRIP-beschikbaarheid, onderhoudslast en de vier VWM-diensten.`;

    s.beschrijving = `De selectie omvat ${geselecteerdN} DRIPs. De simulatie rekent met ${R.perDrip.length} operationele DRIPs en ${R.runs.toLocaleString('nl-NL')} simulatieruns${R.statusUitgesloten?`; ${R.statusUitgesloten} niet-operationele geselecteerde DRIPs tellen niet mee in de uitkomst`:''}. De mediaan bedraagt ${fmt(R.eventStats.p50,0)} storingen in de gekozen periode; de 90%-voorspellingsband loopt van ${fmt(R.eventStats.p5,0)} tot ${fmt(R.eventStats.p95,0)} storingen. De bijbehorende netwerkbrede DRIP-beschikbaarheid is mediaan ${fmt(n.p50,4)}%, met een band van ${fmt(n.p5,4)}% tot ${fmt(n.p95,4)}%. De mediane herstelinzet bedraagt ${fmt(R.herstelStats.p50,1)} dagen over de hele periode. ${histZin} ${vergelijkingZin} ${kalibratieDrivers} `
      + (jaarWaarden.length?`De jaarlijkse storingslast ${richting}; de hoogste centrale jaarwaarde ligt in ${jaren[piekIndex]} op ${fmt(piekWaarde,1)} storingen. `:'')
      + (top.length?`De grootste bijdrage komt van ${memoLijst(topNamen.slice(0,3))}. De vijf zwaarste DRIPs leveren samen circa ${fmt(topAandeel,0)}% van het centrale verwachte aantal storingen.`:'');

    s.risico = `${dienstZin} ${onderNorm.length?`${onderNorm.length} diensten liggen in de mediaan onder hun norm.`:'Geen dienst ligt in de mediaan onder de ingestelde norm.'} ${onderNormP5.length?`In de ongunstige p5-uitkomst komen ${onderNormP5.length} diensten onder norm.`:'Ook de p5-uitkomst blijft voor de diensten boven de ingestelde normen.'} Een hoog storingsaantal en een hoog netwerkpercentage kunnen tegelijk voorkomen, omdat elke storing alleen tijdens de gesimuleerde hersteltijd uitval veroorzaakt en de stilstand over het geselecteerde areaal wordt gewogen. De verrekening blijft wel richtingvast; meer gewogen DRIP-stilstand geeft in iedere run een lager dienstpercentage. Het netwerkpercentage mag daarom niet los worden gelezen van storingsaantal, herstelinzet en de concentratie op individuele DRIPs.${HI.aan&&HV&&HV.factor!=null&&(HV.factor>2||HV.factor<0.5)?` De historische kalibratie verandert de centrale storingsverwachting sterk, met factor ${fmt(HV.factor,2)}. Dit maakt controle van incidentdefinitie, koppeling en dekking een expliciet besluitvormingspunt.`:''}`;
    if(koppelBW) s.risico += ` In de bedrijfswaardenmatrix raakt dit vooral Bereikbaarheid, Veiligheid, Maatschappelijke impact en Betrouwbare overheid.`;

    s.conclusie = `${onderNorm.length||onderNormP5.length?'De simulatie laat een dienstverleningsrisico zien dat in de onderhoudsplanning moet worden afgedekt.':'De netwerkbrede dienstverlening blijft binnen norm, maar de onderhoudslast en de concentratie op een beperkt aantal DRIPs vragen wel sturing.'} De uitkomst ondersteunt daarom geen generieke conclusie op basis van alleen het beschikbaarheidspercentage. De combinatie van storingsfrequentie, hersteltijd, functiegewicht, leeftijd en locatie bepaalt waar ingrijpen het meeste effect heeft.`;

    s.besluit = [
      top.length?`Neem de zwaarste DRIPs in een gerichte onderhouds- en oorzaakanalyse op, te beginnen met ${memoLijst(top.slice(0,3).map(p=>esc(dripMemoLabel(p.d))))}.`:`Rangschik de DRIPs op verwachte storingsbijdrage, hersteltijd en dienstgewicht.`,
      `Plan capaciteit op de p50-herstelinzet en gebruik de p95-uitkomst als bovengrens voor een robuuste capaciteitsafweging.`,
      `Herijk de simulatie bij iedere nieuwe storingslog en vergelijk historie aan en uit om het effect van de kalibratie zichtbaar te houden.`,
      R.modelBouwjaarN?`Vul de ontbrekende bouwjaren aan voor ${R.modelBouwjaarN} DRIPs, zodat minder assets op een getrokken cohortjaar steunen.`:`Behoud de huidige bouwjaardekking en controleer mutaties in het areaalregister.`
    ];
    if(koppelBW) s.besluit.push(`Verwerk de zwaarste DRIPs en de p95-onderhoudslast in de bedrijfswaardenmatrix.`);

    s.uitkomst = `Na uitvoering van de gerichte maatregelen moet vooral het aantal storingen en de herstelbelasting bij de zwaarste DRIPs dalen. In een volgende run hoort dit zichtbaar te worden als een lagere p50 en p95 voor storingen en herstelinzet, een hogere DRIP-beschikbaarheid en een kleiner dienstverlies. De vergelijking wordt uitgevoerd met dezelfde periode, selectie en modelinstellingen.`;
  }

  return s;
}

/* ══════════════════════════════════════════════════════════════
   MEMO-BIJLAGE — volledige inhoudelijke onderbouwing per memo.
   De memo zelf blijft beknopt; de bijlage bevat de complete analyse:
   methode, invoerdata, per-object/per-dienst/per-wegvak resultaten,
   de rekenregels en de vertaling naar het besluit. Alles uit de
   werkelijke doorrekening — dezelfde cijfers als op het scherm.
   ══════════════════════════════════════════════════════════════ */

/* Kleine tabel-helper. rijen = array van arrays; num = kolomindexen rechts. */
function bjlTabel(kop, rijen, numCols, opts){
  numCols=numCols||[];
  const cls=(opts&&opts.klein)?'bjl-tbl klein':'bjl-tbl';
  let h=`<table class="${cls}"><thead><tr>`+kop.map((k,i)=>`<th${numCols.includes(i)?' class="num"':''}>${k}</th>`).join('')+`</tr></thead><tbody>`;
  rijen.forEach(r=>{
    h+=`<tr>`+r.map((c,i)=>`<td${numCols.includes(i)?' class="num"':''}>${c}</td>`).join('')+`</tr>`;
  });
  return h+`</tbody></table>`;
}

/* Gemeenschappelijke methode- en invoersectie (alle memo's). */
function bjlMethodeInvoer(){
  const st=STATE.stats;
  const model = (RULES.cfg.impactModel==='stapel') ? 'opstapelen boven 100% (gewicht en locatie tellen door)' : 'afkappen op 100% (conservatief)';
  const invoer = bjlTabel(
    ['Kenmerk','Waarde'],
    [
      ['Databestand', esc(STATE.bestand||'—')],
      ['Aangeboden regels', String(st.totaal)],
      ['Doorgerekende storingen', String(st.toegepast)],
      ['Ontdubbeld / niet-geclassificeerd', `${st.dubbel} / ${st.nietGecl}`],
      ['Waarvan MSI / CAM / LUS', `${st.msi} / ${st.cam} / ${st.lus}`],
      ['Samenloop-combinaties toegepast', String(st.combiHits)],
      ['Wegvakken in analyse', String(st.wegdelen)],
      ['Rekenvenster', st.actueel?`actueel puntbeeld (${st.periodeUren.toLocaleString('nl-NL')} uur; iedere open storing actief)`:`${st.periodeJr} jaar (${st.periodeUren.toLocaleString('nl-NL')} uur)`],
      ['Areaal uit register (direct/weg/schatting)', `${st.areaalDirect} / ${st.areaalWeg||0} / ${st.wegdelen-st.areaalDirect-(st.areaalWeg||0)}`],
      ['Impactmodel', model],
      ['Choke-venster', `${RULES.cfg.chokeVenster||2} km`],
      ['MSI-norm (KPI)', `${fmt(RULES.cfg.kpi_msi,1)}%`]
    ], [1]
  );
  return `<h4>A · Methode en invoerdata</h4>
    <p class="bjl-p">De analyse rekent uitsluitend de aangeboden open-storingenlijst van matrixsignaalgevers (MSI) door naar actuele areaalbeschikbaarheid en dienstprestatie. Historische logs zijn uitgesloten. Per storing bepaalt de rule engine achtereenvolgens: assettype, locatiecontext, foutcode-impact, weging en samenloop. In het puntbeeld is iedere open storing gedurende het volledige rekenvenster actief; de leeftijd van de melding verdunt de actuele impact dus niet. Beschikbaarheid en prestatie worden gescheiden berekend.</p>
    ${invoer}`;
}

/* Rekenregels-sectie: de daadwerkelijk gebruikte parameters. */
function bjlRekenregels(){
  const fc = RULES.foutcodes.filter(f=>f.actief!==false).map(f=>[
    esc(String(f.code)), esc(f.oms||''), fmt(f.availPct,0)+'%', fmt(f.perfPct,0)+'%', esc(f.severity||'')
  ]);
  const at = RULES.assetTypen.map(a=>[esc(a.id), fmt(a.wAvail,2), fmt(a.wPerf,2)]);
  const lr = RULES.locatieRegels.map(l=>[esc(l.assetType),esc(l.label||l.context),l.assetType==='MSI'?String(msiErnstWaarde(l)):'',fmt(locatieRegelFactor(l,'besch'),2),fmt(locatieRegelFactor(l,'prest'),2)]);
  return `<h4>B · Gebruikte rekenregels</h4>
    <p class="bjl-p">Onderstaande parameters zijn toegepast (rule engine, sectie-instellingen). Foutcodes bepalen de basisimpact; assettype- en locatiefactoren wegen die impact.</p>
    <div class="bjl-2kol">
      <div>${bjlTabel(['Foutcode','Omschrijving','Besch.','Prest.','Ernst'], fc, [2,3], {klein:true})}</div>
    </div>
    <div class="bjl-2kol">
      <div>${bjlTabel(['Assettype','Gewicht besch.','Gewicht prest.'], at, [1,2], {klein:true})}</div>
      <div>${bjlTabel(['Type','Locatiecontext','Ernst','Factor besch.','Factor prest.'], lr, [2,3,4], {klein:true})}</div>
    </div>`;
}

/* ── Bijlage OVERZICHT DIENSTEN ── */
function bjlOverzicht(koppelBW){
  // per dienst
  const dienstRijen = DIENSTEN.map(d=>{
    const n=STATE.netwerk[d.id];
    const st=statusVan(n.besch,d.norm);
    return [d.naam.replace(/&amp;/g,'&'), fmt(n.besch,2)+'%', fmt(n.prestatie,2)+'%', fmt(d.norm,1)+'%',
      `${n.onderNorm}/${STATE.stats.wegdelen}`, st.t];
  });
  // objectafhankelijkheid per dienst
  const afhRijen = DIENSTEN.map(d=>{
    const paren=Object.entries(dienstAssetAfhankelijkheid(d)).sort((a,b)=>b[1]-a[1]).map(([o,w])=>`${o.replace(/_/g,' ')} ${Math.round(w*100)}%`);
    return [d.naam.replace(/&amp;/g,'&'), paren.join(', ')];
  });
  // zwaarst geraakte wegvakken (top 12 op laagste dienstbeschikbaarheid over alle diensten)
  const wegRijen = STATE.wegdelen.slice().sort((a,b)=>{
    const la=Math.min(...DIENSTEN.map(d=>a.diensten[d.id].besch));
    const lb=Math.min(...DIENSTEN.map(d=>b.diensten[d.id].besch));
    return la-lb;
  }).slice(0,12).map(w=>[
    esc(w.key), String(w.n), String(w.N),
    fmt(w.diensten.im.besch,1)+'%', fmt(w.diensten.vm.besch,1)+'%', fmt(w.diensten.rri.besch,1)+'%', fmt(w.diensten.wiu.besch,1)+'%'
  ]);

  let h=`<h4>C · Resultaat per dienst</h4>
    <p class="bjl-p">De vier VWM-diensten, areaalgewogen naar het aantal geregistreerde signaalgevers per geraakt wegvak, afgezet tegen hun norm. Er is geen verkeersintensiteit in de brondata; daarom wordt geen verkeersweging geclaimd.</p>
    ${bjlTabel(['Dienst','Beschikbaarheid','Prestatie','Norm','Wegvakken < norm','Status'], dienstRijen, [1,2,3,4], {})}
    <h4>D · Objectafhankelijkheid per dienst</h4>
    <p class="bjl-p">Welke objecttypen elke dienst nodig heeft, met hun relatieve gewicht in de ketenberekening.</p>
    ${bjlTabel(['Dienst','Afhankelijkheden (objecttype · gewicht)'], afhRijen, [], {klein:true})}
    <h4>E · Zwaarst geraakte wegvakken</h4>
    <p class="bjl-p">De twaalf wegvakken met de laagste dienstbeschikbaarheid. n = storingen, N = signaalgevers in het wegvak.</p>
    ${bjlTabel(['Wegvak','n','N','IM','VM','RRI','WIU'], wegRijen, [1,2,3,4,5,6], {klein:true})}`;

  if(koppelBW){
    h+=`<h4>F · Vertaling naar bedrijfswaarden</h4>
      <p class="bjl-p">Indicatieve koppeling van de dienstimpact aan de zes bedrijfswaarden.</p>
      ${bjlTabel(['Bedrijfswaarde','Relevantie in deze analyse'], [
        ['Veiligheid','Signalering en kruisen bij incidenten; direct geraakt bij MSI-uitval.'],
        ['Bereikbaarheid','Stuurbaarheid en doorstroming; hoofdeffect van de storingen.'],
        ['Maatschappelijke impact','Vermijdbare vertraging en kosten bij verminderde dienstverlening.'],
        ['Betrouwbare overheid','Consistentie van de geleverde dienst richting weggebruiker.'],
        ['Leefbaarheid','Beperkt, indirect via omleidingen en congestie.'],
        ['Duurzaamheid','Beperkt; wel relevant bij vervangings- vs. hersteltafweging.']
      ], [], {klein:true})}`;
  }
  return h;
}

/* ── Bijlage GEBIED & CHOKE-POINTS ── */
function bjlGebied(bron, koppelBW){
  // alle clusters ≥2, gesorteerd op ernst — zelfde bron als scherm
  const alle=[];
  STATE.wegdelen.forEach(w=>w.chokes.forEach(c=>{ if(c.n>=2) alle.push({key:w.key, wdBesch:w.besch, ...c}); }));
  alle.sort((a,b)=>a.beschLok-b.beschLok);
  const top = alle.slice(0,20).map(c=>[
    esc(c.key), `${c.hmMin.toFixed(1)}${c.hmMax>c.hmMin?'–'+c.hmMax.toFixed(1):''}`,
    String(c.n), c.lengte.toFixed(1)+' km', c.dichtheid.toFixed(1)+'/km',
    String(c.fatale||0), fmt(c.beschLok,1)+'%', fmt(c.wdBesch,1)+'%'
  ]);
  // storingen binnen het zwaarste cluster (detail)
  const cp=bron.choke;
  const detail=(cp.leden||[]).slice(0,15).map(m=>[
    esc(m.code||''), esc((m.fout&&m.fout.oms)||m.melding||''),
    m.hm!=null?m.hm.toFixed(1):'—',
    Math.round((m.duurUren||0)/24)+' d'+(m.duurAfgeleid?' (afgeleid, bovengrens)':''),
    fmt((m.zwaarteA||0)*100,0)+'%'
  ]);

  let h=`<h4>C · Alle choke-points (≥2 storingen binnen ${bron.chokeVenster||2} km)</h4>
    <p class="bjl-p">Netwerkbrede clusters, gesorteerd op laagste lokale beschikbaarheid. Het contrast tussen lokaal en wegvakgemiddelde toont hoezeer het knelpunt in het gemiddelde wordt gemaskeerd.</p>
    ${bjlTabel(['Weg','hm','n','Lengte','Dichtheid','Fataal','Lokaal','Wegvak-gem.'], top, [2,3,4,5,6,7], {klein:true})}
    <p class="bjl-note">Totaal ${bron.totaalClusters} clusters, waarvan ${bron.ernstig} ernstig (lokale beschikbaarheid &lt; 80%). Tabel toont de 20 zwaarste.</p>
    <h4>D · Storingen in het zwaarste choke-point (${esc(bron.wegKey)} hm ${cp.hmMin.toFixed(1)})</h4>
    <p class="bjl-p">De individuele storingen die samen dit knelpunt vormen.</p>
    ${detail.length?bjlTabel(['Foutcode','Omschrijving','hm','Standtijd','Zwaarte'], detail, [2,3,4], {klein:true}):'<p class="bjl-p">Detailgegevens niet beschikbaar voor dit cluster.</p>'}`;

  if(koppelBW){
    const risk=memoRisicoNiveau(cp.beschLok, RULES.cfg.kpi_msi||99.5);
    h+=`<h4>E · Vertaling naar bedrijfswaarden</h4>
      <p class="bjl-p">${risk.bw} Indicatief risiconiveau voor dit choke-point: <b>${risk.niveau}</b>.</p>
      ${bjlTabel(['Bedrijfswaarde','Effect van dit choke-point'], [
        ['Veiligheid','Verhoogde kans op onvoldoende signaleringsdekking bij incident op dit segment.'],
        ['Bereikbaarheid','Lokaal verminderde stuurbaarheid; effect op doorstroming bij verstoring.'],
        ['Maatschappelijke impact','Concentratie maakt gericht herstel kosteneffectief; uitstel verhoogt vermijdbare hinder.']
      ], [], {klein:true})}`;
  }
  return h;
}

/* ── Bijlage MONTE CARLO ── */
function bjlMonteCarlo(bron, koppelBW){
  const R=bron.mc, n=R.netwerk, norm=bron.norm!=null?bron.norm:(RULES.cfg.kpi_msi||99.5);
  const param=bjlTabel(['Parameter','Waarde'],[
    ['Historische periode', `${R.histP} jaar dagelijkse logs`],
    ['Prognoseperiode', R.periodeLabel||`${R.horizon} jaar`],
    ['Aantal runs', R.runs.toLocaleString('nl-NL')],
    ['Scope', R.scope==='alle'?'alle wegvakken':'netwerkbreed + top-12'],
    ['Storingsproces', 'Gamma-Poisson per wegvak (rate én parameteronzekerheid)'],
    ['Netwerkaggregatie', 'positieve compound-verdeling met behoud van gemiddelde en variantie'],
    ['Leeftijdsmodel', n.ageN?`Weibull/NHPP-factor op ${n.ageN} wegvakken; ${n.stationaryN} stationair`:'stationaire fallback; geen passend bouwjaarcohort'],
    ['Hersteltijden', 'empirisch gebootstrapt; staartmarge bij rechtscensuur'],
    ['Wegvakken op gecomprimeerde reeksen / historieregels', `${n.logsN||0} / ${n.snapN||0}`],
    ['Logreeksen naar areaal verdeeld', `${n.fallbackN||0}`]
  ],[1]);
  const verdeling=bjlTabel(['Percentiel','Beschikbaarheid'],[
    ['p5 (pessimistisch)', fmt(n.p5,2)+'%'],
    ['p25', fmt(n.p25,2)+'%'],
    ['p50 (mediaan)', fmt(n.p50,2)+'%'],
    ['p75', fmt(n.p75,2)+'%'],
    ['p95 (optimistisch)', fmt(n.p95,2)+'%'],
    ['Gemiddeld', fmt(n.gem,2)+'%'],
    ['Kans onder norm', fmt(bron.kansOnder,0)+'%']
  ],[1]);
  // per-wegvak prognose (alle beschikbare)
  const wr=R.wegRes.slice().sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50).map(x=>[
    esc(x.wd.key), x.mc.rate.toFixed(1), x.mc.bron==='logs'?'historische reeks':x.mc.bron==='logs-fallback'?'historie verdeeld':'historieregels',
    fmt(x.wd.besch,2)+'%', fmt(x.mc.besch.p50,2)+'%', fmt(x.mc.besch.p5,1)+'–'+fmt(x.mc.besch.p95,1)+'%'
  ]);

  let h=`<h4>C · Simulatieparameters</h4>
    <p class="bjl-p">De prognose trekt per run zowel een plausibele storingsintensiteit als het aantal storingen. Dit voorkomt dat een korte historie als een exact bekende rate wordt behandeld. Bouwjaarcohorten schalen de rate leeftijdsafhankelijk vooruit; zonder cohort blijft de expliciete stationaire fallback gelden.</p>
    ${param}
    <h4>D · Netwerkbrede prognoseverdeling (${esc(R.periodeLabel||R.horizon+' jaar')})</h4>
    <p class="bjl-p">De volledige percentielverdeling over ${R.runs.toLocaleString('nl-NL')} runs.</p>
    ${verdeling}
    <h4>E · Prognose per wegvak</h4>
    <p class="bjl-p">Per wegvak de gesimuleerde mediaan en 90%-voorspellingsband. 'Logs verdeeld' betekent dat een ontbrekende richtingsreeks naar areaalaandeel is toegewezen, niet als volledig wegtotaal.</p>
    ${bjlTabel(['Wegvak','Stor./jr','Bron','Historisch','Prognose p50','Band p5–p95'], wr, [1,3,4,5], {klein:true})}`;

  if(koppelBW){
    const risk=memoRisicoNiveau(n.p50, norm);
    h+=`<h4>F · Vertaling naar bedrijfswaarden</h4>
      <p class="bjl-p">${risk.bw} Indicatief risiconiveau: <b>${risk.niveau}</b>. Kans op normoverschrijding binnen de horizon: ${fmt(bron.kansOnder,0)}%.</p>
      ${bjlTabel(['Bedrijfswaarde','Effect op meerjarige termijn'], [
        ['Bereikbaarheid','Structurele beschikbaarheid van sturing en signalering over de horizon.'],
        ['Maatschappelijke impact','Vermijdbare kosten en hinder bij oplopende storingslast.'],
        ['Duurzaamheid','Afweging tussen doorgaan met herstel en gepland vervangingsonderhoud.']
      ], [], {klein:true})}`;
  }
  return h;
}

/* ── Bijlage DRIP MONTE CARLO ── */
function bjlDripMethodeInvoer(bron){
  const R=bron.mc;
  const D=(STATE&&STATE.drips)||DRIP_STATE||{bestand:'—',totaal:0};
  const HI=R.historieInfo||{aan:false,gekoppeldeSelectie:0,incidentenSelectie:0,duurWaarnemingen:0,modelDrips:R.perDrip.length,dekkingDagen:0,bronnen:[]};
  const regels=[
    ['DRIP-areaalbestand', esc(D.bestand||'—')],
    ['Actieve DRIPs in simulatie', R.perDrip.length.toLocaleString('nl-NL')],
    ['Prognoseperiode', esc(R.periodeLabel||R.jaarVan+' tot en met '+R.jaarTot)],
    ['Aantal simulatieruns', R.runs.toLocaleString('nl-NL')],
    ['Bouwjaardekking actief areaal', fmt(R.bouwjaarDekking*100,1)+'%'],
    ['DRIPs met cohortbouwjaar', R.modelBouwjaarN.toLocaleString('nl-NL')],
    ['Historische kalibratie', HI.aan?'aan':'uit'],
    ['Historisch gekalibreerde DRIPs', HI.gekoppeldeSelectie.toLocaleString('nl-NL')],
    ['Unieke incidenten in selectie', HI.incidentenSelectie.toLocaleString('nl-NL')],
    ['Bruikbare duurwaarnemingen', (HI.duurWaarnemingen||0).toLocaleString('nl-NL')],
    ['DRIPs uitsluitend op leeftijdsmodel', HI.modelDrips.toLocaleString('nl-NL')],
    ['Dekking storingshistorie', (HI.dekkingDagen||0).toLocaleString('nl-NL')+' dagen'],
    ['Bronnen storingshistorie', HI.bronnen&&HI.bronnen.length?HI.bronnen.map(esc).join(', '):'geen'],
    ['Geprogrammeerde vervanging', R.vervangJaar?String(R.vervangJaar):'niet toegepast'],
    ['Centrale groeps-MTTR', fmt(R.mttrUren,2)+' uur, '+esc(R.mttrBron||'assettype-groep DRIP')]
  ];
  return `<h4>A · Methode en invoerdata voor DRIP</h4>
    <p class="bjl-p">De DRIP-prognose gebruikt een leeftijdsafhankelijk Weibull-NHPP-proces met minimal repair. Een storing herstelt de werking, maar verjongt het asset niet. Daardoor kan één DRIP meerdere keren in de gekozen periode uitvallen. Per run variëren levensduur, Weibull-vormparameter, storingsaantal en reparatieduur. Bij gekoppelde historie wordt de incidentfrequentie met twee modelpriorjaren gekrompen en wordt de per-asset MTTR met vijf priorwaarnemingen uit de groeps-MTTR gestabiliseerd.</p>
    ${bjlTabel(['Kenmerk','Waarde'],regels,[1])}`;
}

function bjlDripMonteCarlo(bron,koppelBW){
  const R=bron.mc, HI=R.historieInfo||{aan:false};
  const HV=R.historieVergelijking||null;
  const H=DRIP_HIST_STATE;
  const scenarioRijen=R.scenarios.map(s=>[
    esc(s.label), fmt(s.dripBesch,4)+'%', fmt((100-s.dripBesch)*100,3)+' bp',
    fmt(s.events,0), fmt(s.herstelDagen,1)+' dagen'
  ]);
  const dienstRijen=DIENSTEN.filter(d=>(R.dienstAandelen[d.id]||0)>0).map(d=>{
    const st=R.diensten[d.id];
    return [d.naam.replace(/&amp;/g,'&'),Math.round((R.dienstAandelen[d.id]||0)*100)+'%',
      fmt(st.p5,4)+'%',fmt(st.p50,4)+'%',fmt(st.p95,4)+'%',fmt((100-st.p50)*100,3)+' bp',fmt(d.norm,1)+'%'];
  });
  const jaarRijen=(R.cum&&R.cum.jaren||[]).map((jaar,i)=>[
    String(jaar),fmt(R.cum.perJaarStats[i].p5,0),fmt(R.cum.perJaar[i],1),fmt(R.cum.perJaarStats[i].p95,0),
    fmt(R.herstelPerJaarStats[i].p50,1)+' d',fmt(R.dripBeschPerJaarStats[i].p50,4)+'%'
  ]);
  const topRijen=R.perDrip.slice().sort((a,b)=>b.gemEvents-a.gemEvents).slice(0,25).map(p=>[
    esc(dripMemoLabel(p.d)),esc(dripLocatieLabel(p.d)||((p.d.weg||'')+' '+(p.d.richting||''))),p.d.bouwjaar?String(p.d.bouwjaar):'cohort',
    p.hist?String(p.hist.n):'—',p.hist&&p.hist.rate!=null?fmt(p.hist.rate,1):'—',fmt(p.gemEvents,1),
    fmt(p.faalPeriode*100,1)+'%',fmt(p.mttrSim,2)+' u',p.historieGekalibreerd?'historie + leeftijd':'leeftijdsmodel'
  ]);
  const kwaliteitsRijen=[
    ['Niet-operationele geselecteerde DRIPs uitgesloten',String(R.statusUitgesloten||0)],
    ['DRIPs zonder werkelijk bouwjaar',String(R.modelBouwjaarN||0)],
    ['Bouwjaardekking',fmt(R.bouwjaarDekking*100,1)+'%'],
    ['Historisch gekalibreerd',HI.aan?String(HI.gekoppeldeSelectie):'nee'],
    ['Modelgebaseerd zonder passende historie',String(HI.modelDrips||R.perDrip.length)],
    ['Losse alarmepisodes niet als incident geteld',H?(H.episodesGenegeerd||0).toLocaleString('nl-NL'):'—'],
    ['Incidenten uitgesloten voor MTTR-kalibratie',H?(H.duurUitgeslotenN||0).toLocaleString('nl-NL'):'—'],
    ['P95-grens betrouwbare herstelduur',H&&H.duurCapUren!=null?fmt(H.duurCapUren,1)+' uur':'—']
  ];
  const vergelijkingBlok=HI.aan&&HV?`<h4>D · Effect van historische kalibratie</h4>
    <p class="bjl-p">Deze gevoeligheidsvergelijking gebruikt dezelfde selectie, periode en leeftijdsaannames. Alleen de per-asset kalibratie met de storingshistorie verschilt. Het betreft centrale verwachte aantallen, niet twee los gedraaide Monte Carlo-verdelingen.</p>
    ${bjlTabel(['Kenmerk','Waarde'],[
      ['Zuiver leeftijdsmodel, centrale events',fmt(HV.modelEvents,1)],
      ['Met historische kalibratie, centrale events',fmt(HV.gekalibreerdEvents,1)],
      ['Verschil',`${HV.verschil>=0?'+':''}${fmt(HV.verschil,1)}`],
      ['Kalibratiefactor',HV.factor!=null?fmt(HV.factor,2):'—'],
      ['DRIPs omhoog / omlaag bijgesteld',`${HV.verhoogdN} / ${HV.verlaagdN}`]
    ],[1])}
    ${bjlTabel(['Richting','DRIP','Weg','Leeftijdsmodel','Gekalibreerd','Verschil'],[
      ...(HV.topStijging||[]).map(x=>['omhoog',esc(x.id),esc(x.weg),fmt(x.model,1),fmt(x.gekalibreerd,1),'+'+fmt(x.verschil,1)]),
      ...(HV.topDaling||[]).map(x=>['omlaag',esc(x.id),esc(x.weg),fmt(x.model,1),fmt(x.gekalibreerd,1),fmt(x.verschil,1)])
    ],[3,4,5],{klein:true})}`:'';
  let h=`<h4>C · Samenhangende scenario's</h4>
    <p class="bjl-p">Iedere rij is één volledige gesimuleerde toekomst. Storingsaantal, reparatieduur, DRIP-beschikbaarheid en dienstimpact blijven binnen een scenario aan elkaar gekoppeld.</p>
    ${bjlTabel(['Scenario','DRIP-besch.','Onbeschikbaarheid','Storingen','Herstelinzet'],scenarioRijen,[1,2,3,4])}
    ${vergelijkingBlok}
    <h4>E · Gevolg voor de dienstverlening</h4>
    <p class="bjl-p">Alleen de DRIP-schakel varieert. De overige objecttypen staan op 100%, zodat het zuivere effect van DRIP-stilstand zichtbaar blijft. Meer gewogen stilstand geeft per run altijd een lager dienstpercentage.</p>
    ${bjlTabel(['Dienst','DRIP-aandeel','p5','p50','p95','Verlies p50','Norm'],dienstRijen,[1,2,3,4,5,6])}
    <h4>F · Jaarlijkse ontwikkeling</h4>
    <p class="bjl-p">De centrale lijn en de p5-p95-band tonen hoe storingslast, herstelinzet en DRIP-beschikbaarheid zich door de tijd ontwikkelen. Een gedeeltelijk eerste of laatste kalenderjaar bevat alleen de werkelijk gekozen maanden.</p>
    ${bjlTabel(['Jaar','Storingen p5','Storingen centraal','Storingen p95','Herstel p50','DRIP-besch. p50'],jaarRijen,[1,2,3,4,5],{klein:true})}
    <h4>G · DRIPs met de grootste verwachte storingsbijdrage</h4>
    <p class="bjl-p">De ranglijst gebruikt het centrale verwachte aantal terugkerende storingen in de volledige gekozen periode. De faalkans is de kans op ten minste één storing en kan bij hoge herhaalfrequentie dicht bij 100% liggen.</p>
    ${bjlTabel(['DRIP + locatie','Locatie','Bouwjaar','Hist. n','Hist./jr','Verw. events','Faalkans','MTTR','Modelbron'],topRijen,[2,3,4,5,6,7],{klein:true})}
    <h4>H · Datakwaliteit en modelgrenzen</h4>
    ${bjlTabel(['Controlepunt','Uitkomst'],kwaliteitsRijen,[1],{klein:true})}
    <p class="bjl-note">Losse alarmepisodes worden niet als afzonderlijke storingen gebruikt. Lange, open of niet-positieve duurwaarden tellen wel mee voor de incidentfrequentie, maar niet automatisch voor de MTTR. De voorspellingsband is een modeluitkomst en geen meetgarantie. Verkeersintensiteit, toekomstige areaalmutaties, nog niet ingevoerd onderhoud en externe verstoringen zijn niet afzonderlijk gemodelleerd.</p>`;
  if(koppelBW){
    h+=`<h4>I · Vertaling naar bedrijfswaarden</h4>
      ${bjlTabel(['Bedrijfswaarde','Betekenis in deze DRIP-prognose'],[
        ['Veiligheid','Beschikbaarheid van actuele aanwijzingen en waarschuwingen langs de weg.'],
        ['Bereikbaarheid','Beschikbaarheid van route-informatie en sturing bij verstoringen.'],
        ['Maatschappelijke impact','Herstelcapaciteit, hinder en vermijdbare kosten bij terugkerende uitval.'],
        ['Betrouwbare overheid','Voorspelbaarheid en continuïteit van de informatie aan weggebruikers.'],
        ['Duurzaamheid','Afweging tussen blijven herstellen, reviseren en planmatig vervangen.']
      ],[],{klein:true})}`;
  }
  return h;
}

function memoContextVoorBron(bron){
  if(!bron)return null;
  if((bron.type==='montecarlo'||bron.type==='drip-montecarlo')&&bron.mc&&bron.mc.context)return bron.mc.context;
  if(bron.type==='gebied'&&bron.choke&&bron.choke.leden){const t=(STATE&&STATE.peildatum)||Date.now();return maakOperationeleContext(t,t+86400e3,bron.choke.leden);}
  if(bron.type==='overzicht'&&STATE&&STATE.meldingen){const t=STATE.peildatum||Date.now();return maakOperationeleContext(t,t+86400e3,STATE.meldingen);}
  return null;
}
function memoScopeLabel(bron){
  const s=bron&&bron.scope?String(bron.scope):'landelijk';
  return s==='landelijk'?'Landelijk VWM':'Verkeerscentrale '+s;
}
function memoVcDuidingVoorMonteCarlo(bron){
  if(!bron||!bron.mc)return '';
  const oud=MC_RESULT;MC_RESULT=bron.mc;
  const rows=mcVcRows();MC_RESULT=oud;
  if(!rows.length)return '';
  if(bron.scope&&bron.scope!=='landelijk'){
    const r=rows.find(x=>x.vc===bron.scope);
    return r?` Voor ${r.vc} is de prognose p50 ${fmt(r.p50,2)}%, met een band van ${fmt(r.p5,2)}% tot ${fmt(r.p95,2)}%. Werkcontext: ${r.ctx.werk} werkzaamheden en ${r.ctx.route} U-routes.`:'';
  }
  return ` Landelijke VC-duiding: ${rows.slice(0,5).map(r=>`${r.vc} p50 ${fmt(r.p50,2)}%, werk ${r.ctx.werk}, U-routes ${r.ctx.route}`).join('; ')}.`;
}
function memoRouteBeeldenBijlageHtml(c){
  if(!c||!c.uRouteGeladen||!(c.routeDetails||[]).length)return '';
  const beelden=(c.routeDetails||[]).filter(r=>r.beeldUrl);
  let h=`<h4>Routebeelden uit U-routebestand</h4><p class="bjl-note">Routebeelden worden in deze bijlage getoond wanneer het U-routebestand een afbeelding-URL, Excel-hyperlink of data URI bevat. Ingesloten Excel-afbeeldingen zonder link worden niet uitgepakt.</p>`;
  if(!beelden.length)return h;
  h+=`<div class="route-context-grid">`+beelden.slice(0,8).map(r=>`<div class="route-context-item route"><div class="route-context-title">${esc(r.naam)}</div><div class="route-context-meta"><b>Locatie:</b> ${esc(r.locatie)}</div>${routeBeeldHtml(r)}</div>`).join('')+`</div>`;
  return h;
}
function memoOperationeleBijlage(bron){
  const c=memoContextVoorBron(bron);
  if(!c||(!c.werkGeladen&&!c.uRouteGeladen))return '';
  const samenvatting=[
    ['Werkzaamheden in periode',String(c.werkenTijd)],
    ['Werkzaamheden op betrokken wegen',String(c.werkenWeg)],
    ['Exact gelokaliseerde werkvakken',String(c.werkenExact)],
    [`Assets binnen ${WERK_BUFFER_KM} km werkbuffer`,String(c.assetsBinnen2Km)],
    ['Gekoppelde U-routes',String(c.routeMatches)],
    ['Inzetassets voor/na U-routes',String(c.routeInzetAssets||0)],
    ['Assets langs U-route-as',String(c.routeAssets||0)],
    ['Dienstduiding',esc(c.serviceTekst||'')]
  ];
  const werkRijen=(c.werkDetails||[]).slice(0,12).map(w=>[esc(w.id||''),esc(w.locatie),esc(w.periode),esc(w.hinder||''),esc(w.afsluiting||''),esc(w.omleiding||''),esc((w.routeRefs||[]).join(', '))]);
  const routeRijen=(c.routeDetails||[]).slice(0,12).map(r=>[esc(r.naam),esc(r.locatie),`${r.inzetVoorN} / ${r.inzetNaN} / ${r.assetsLangsN}`,esc(r.dienstTekst),esc(r.koppelMethode||''),esc((r.werkRefs||[]).join(', ')),routeOsmLinkHtml(r)||'nee',r.beeldUrl?'ja':'nee']);
  let h=`<h4>Operationele context - werkzaamheden, U-routes en diensten</h4>
    <p class="bjl-p">Werkzaamheden en U-routes worden hier als gevolgcontext behandeld. Ze verhogen de technische faalfrequentie niet, maar bepalen wel waar een storing doorwerkt op weggebruikers, werkvakveiligheid en omleidingsinzet. Een U-route is een omleiding; daarom telt de duiding ook de inzetassets voor en na de route mee.</p>
    ${bjlTabel(['Kenmerk','Waarde'],samenvatting,[1],{klein:true})}`;
  if(werkRijen.length)h+=`<h4>Werkzaamheden met locatiebeeld</h4>${bjlTabel(['Werk','Locatie','Periode','Hinder','Afsluiting','Omleiding','U-route'],werkRijen,[],{klein:true})}`;
  if(routeRijen.length)h+=`<h4>U-routes met locatie- en inzetbeeld</h4>${bjlTabel(['U-route','Locatie','Assets voor / na / langs','Diensten','Koppeling','Gekoppeld werk','OSM relatie','Routebeeld'],routeRijen,[2],{klein:true})}`;
  h+=memoRouteBeeldenBijlageHtml(c);
  return h;
}

function memoLiekeScopeNaam(bron){
  const s=bron&&bron.scope?String(bron.scope):'landelijk';
  return s==='landelijk'?'Landelijk VWM':'Verkeerscentrale '+s;
}
function memoLiekeWegdelen(bron){
  const wds=(STATE&&STATE.wegdelen)||[];
  const scope=bron&&bron.scope?String(bron.scope):'landelijk';
  if(scope==='landelijk')return wds;
  return wds.filter(w=>normAssetVc(w.vc)===scope);
}
function memoLiekeAssets(bron){
  if(bron&&bron.type==='drip-montecarlo'&&bron.mc&&Array.isArray(bron.mc.perDrip)){
    return memoLiekeDripPerDrip(bron.mc,bron).map(p=>p.d).filter(Boolean);
  }
  const assets=(ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.assets)||[];
  const scope=bron&&bron.scope?String(bron.scope):'landelijk';
  if(scope==='landelijk')return assets;
  return assets.filter(a=>normAssetVc(a.vc)===scope);
}
function memoLiekeDienstRows(bron){
  const wds=memoLiekeWegdelen(bron);
  return DIENSTEN.map(d=>{
    let sb=0,sp=0,w=0,onder=0;
    wds.forEach(wd=>{
      const dd=wd.diensten&&wd.diensten[d.id]; if(!dd)return;
      const gewicht=wd.N||1; sb+=dd.besch*gewicht; sp+=dd.prestatie*gewicht; w+=gewicht;
      if(dd.besch<d.norm)onder++;
    });
    const besch=w?sb/w:(STATE&&STATE.netwerk&&STATE.netwerk[d.id]?STATE.netwerk[d.id].besch:100);
    const prestatie=w?sp/w:(STATE&&STATE.netwerk&&STATE.netwerk[d.id]?STATE.netwerk[d.id].prestatie:100);
    return {id:d.id,naam:d.naam.replace(/&amp;/g,'&'),norm:d.norm,besch,prestatie,onder,status:statusVan(besch,d.norm)};
  }).sort((a,b)=>a.besch-b.besch);
}
function memoLiekeAssetTekst(bron){
  const assets=memoLiekeAssets(bron),actief=assets.filter(a=>a.prognoseActief!==false);
  const per={};actief.forEach(a=>{const tp=a.tp||a.assetType||'onbekend';per[tp]=(per[tp]||0)+1;});
  const typen=Object.entries(per).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k} ${v.toLocaleString('nl-NL')}`);
  const metJaar=actief.filter(a=>a.bouwjaar).length;
  const districten=uniekeWaarden(actief.map(a=>districtBekend(a.district)?a.district:'').filter(Boolean)).slice(0,4);
  return `${actief.length.toLocaleString('nl-NL')} actieve assets${typen.length?`: ${typen.join(', ')}`:''}. Bouwjaardekking: ${actief.length?fmt(metJaar/actief.length*100,0):'0'}%. ${districten.length?`Districtduiding: ${memoLijst(districten)}.`:'Districtduiding ontbreekt of is niet eenduidig.'}`;
}
function memoLiekeDripPerDrip(R,bron){
  const arr=(R&&R.perDrip)||[];
  const scope=bron&&bron.scope?String(bron.scope):'landelijk';
  if(scope==='landelijk')return arr;
  return arr.filter(p=>normAssetVc(p&&p.d&&p.d.vc)===scope);
}
function memoLiekeDripAantallen(R,bron){
  const actief=memoLiekeDripPerDrip(R,bron).length;
  const scope=bron&&bron.scope?String(bron.scope):'landelijk';
  if(scope==='landelijk'){
    const geselecteerd=R&&R.geselecteerdN!=null?R.geselecteerdN:actief+((R&&R.statusUitgesloten)||0);
    return {geselecteerd,actief,uitgesloten:Math.max(0,geselecteerd-actief)};
  }
  const rec=R&&R.selectiePerVc&&R.selectiePerVc[scope];
  const geselecteerd=rec&&rec.geselecteerd!=null?rec.geselecteerd:actief;
  return {geselecteerd,actief,uitgesloten:Math.max(0,geselecteerd-actief)};
}
function memoLiekeDripNaamHtml(d){
  const naam=dripCodeLabel(d);
  const loc=dripLocatieLabel(d)||[d.weg,d.richting,d.hm!=null?'hmp '+hmKort(d.hm):''].filter(Boolean).join(' ');
  return `<b>${esc(naam)}</b>${loc?` <span class="muted">(${esc(loc)})</span>`:''}`;
}
function memoLiekeDripTopHtml(perDrip,n){
  const top=(perDrip||[]).slice().sort((a,b)=>(b.gemEvents||0)-(a.gemEvents||0)).slice(0,n||3);
  if(!top.length)return 'Geen DRIPs in deze selectie.';
  return memoLijst(top.map(p=>`${memoLiekeDripNaamHtml(p.d)} met ${fmt(p.gemEvents||0,1)} verwachte storing(en)`));
}
function memoLiekeDripHuidigHtml(bron){
  const R=bron&&bron.mc?bron.mc:DRIP_MC;
  const perDrip=memoLiekeDripPerDrip(R,bron);
  const aantallen=memoLiekeDripAantallen(R,bron);
  const actief=perDrip.filter(p=>statusActiefVoorPrognose(p&&p.d&&p.d.status));
  const metJaar=perDrip.filter(p=>p&&p.d&&p.d.bouwjaar).length;
  const hist=perDrip.filter(p=>p.historieGekalibreerd);
  const histIncidenten=hist.reduce((s,p)=>s+(p.hist?p.hist.n:0),0);
  const diensten=dienstDuidingVoorAssets(perDrip.map(p=>p.d).filter(Boolean));
  return `<h3>2 &nbsp; Nu</h3>
    <p>Scope: ${esc(memoLiekeScopeNaam(bron))}. Dit actuele beeld gaat over het DRIP-areaal dat in deze Monte Carlo is gesimuleerd. Het gebruikt niet de algemene open-storingenlijst uit het MSI-dashboard.</p>
    <table class="memo-samenvatting"><tbody>
      <tr><td class="ml">Geselecteerd areaal</td><td><b>${aantallen.geselecteerd.toLocaleString('nl-NL')} DRIPs geselecteerd</b> in deze memo-scope. Daarvan zijn ${aantallen.actief.toLocaleString('nl-NL')} operationele DRIPs doorgerekend${aantallen.uitgesloten?` en ${aantallen.uitgesloten.toLocaleString('nl-NL')} niet-operationele DRIPs uitgesloten`:''}.</td></tr>
      <tr><td class="ml">Assetbeeld</td><td>${esc(memoLiekeAssetTekst(bron))}</td></tr>
      <tr><td class="ml">Bouwjaar</td><td>${perDrip.length?fmt(metJaar/perDrip.length*100,0):'0'}% van de gesimuleerde DRIPs heeft een bouwjaar in het model.</td></tr>
      <tr><td class="ml">Historische koppeling</td><td>${hist.length.toLocaleString('nl-NL')} DRIPs zijn historisch gekalibreerd met ${histIncidenten.toLocaleString('nl-NL')} gekoppelde incidenten.</td></tr>
      <tr><td class="ml">Belangrijkste DRIPs</td><td>${memoLiekeDripTopHtml(perDrip,3)}</td></tr>
      <tr><td class="ml">Dienstduiding</td><td>${esc(dienstDuidingTekst(diensten))}</td></tr>
    </tbody></table>`;
}
function memoLiekeHuidigHtml(bron){
  if(bron&&bron.type==='drip-montecarlo')return memoLiekeDripHuidigHtml(bron);
  const rows=memoLiekeDienstRows(bron),zwak=rows[0]||{naam:'onbekend',besch:100,norm:100};
  const wds=memoLiekeWegdelen(bron);
  const storingen=wds.reduce((s,w)=>s+(w.n||0),0);
  const zwaar=wds.slice().sort((a,b)=>a.besch-b.besch||b.n-a.n).slice(0,3);
  return `<h3>2 &nbsp; Nu</h3>
    <p>Scope: ${esc(memoLiekeScopeNaam(bron))}. Actueel beeld: ${storingen.toLocaleString('nl-NL')} open storingen op ${wds.length.toLocaleString('nl-NL')} wegdelen. Zwakste dienst: ${esc(zwak.naam)} met ${fmt(zwak.besch,2)}% beschikbaarheid bij norm ${fmt(zwak.norm,1)}%.</p>
    <table class="memo-samenvatting"><tbody>
      ${rows.map(r=>`<tr><td class="ml">${esc(r.naam)}</td><td>${fmt(r.besch,2)}% beschikbaarheid, ${fmt(r.prestatie,2)}% prestatie, ${r.onder} wegdelen onder norm.</td></tr>`).join('')}
      <tr><td class="ml">Assetbeeld</td><td>${esc(memoLiekeAssetTekst(bron))}</td></tr>
      <tr><td class="ml">Zwaarste wegdelen</td><td>${zwaar.length?esc(memoLijst(zwaar.map(w=>`${w.key} ${fmt(w.besch,1)}%, ${w.n} storingen`))):'Geen wegdelen met storingen in deze scope.'}</td></tr>
    </tbody></table>`;
}
function memoLiekeHistorieHtml(bron){
  if(bron&&bron.type==='drip-montecarlo'){
    const R=bron.mc||DRIP_MC,perDrip=memoLiekeDripPerDrip(R,bron),hist=perDrip.filter(p=>p.historieGekalibreerd);
    const aantallen=memoLiekeDripAantallen(R,bron);
    const incidenten=hist.reduce((s,p)=>s+(p.hist?p.hist.n:0),0);
    const duur=hist.reduce((s,p)=>s+(p.hist?p.hist.duurN:0),0);
    const bronnen=(R&&R.historieInfo&&R.historieInfo.bronnen)||[];
    const regels=[
      ['DRIP selectie',`${aantallen.geselecteerd.toLocaleString('nl-NL')} DRIPs geselecteerd; ${aantallen.actief.toLocaleString('nl-NL')} operationeel doorgerekend${aantallen.uitgesloten?` en ${aantallen.uitgesloten.toLocaleString('nl-NL')} niet-operationeel uitgesloten`:''}.`],
      ['Historische kalibratie',hist.length?`${hist.length.toLocaleString('nl-NL')} DRIPs gekalibreerd met ${incidenten.toLocaleString('nl-NL')} incidenten en ${duur.toLocaleString('nl-NL')} betrouwbare duurwaarnemingen.`:'Geen DRIPs in deze scope zijn historisch gekalibreerd. Het model gebruikt bouwjaar, levensduur en groeps-MTTR.'],
      ['Bronnen',bronnen.length?bronnen.join(', '):'Geen DRIP-historiebron actief.'],
      ['Scheiding live en historie','De open-storingenlijst uit het dashboard telt hier niet mee. Deze managementmemo kijkt naar de DRIPs die zijn gesimuleerd.']
    ];
    return `<h3>3 &nbsp; Verleden</h3><p>Het verleden wordt hier alleen gebruikt als kalibratie van de gesimuleerde DRIPs. Daardoor blijft de memo consistent met de selectie in de Monte Carlo.</p>
      <table class="memo-samenvatting"><tbody>${regels.map(r=>`<tr><td class="ml">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
  }
  const histN=gecombineerdeStoringsRijen().length;
  const liveN=gecombineerdeLiveStoringsRijen().length;
  const insp=STORINGS_INSPECTIE;
  const typen=insp&&insp.typen?Object.entries(insp.typen).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${ASSET_LABEL[k]||k} ${v}`):[];
  const mc=MC_RESULT;
  const drip=DRIP_MC&&DRIP_MC.historieInfo;
  const regels=[
    ['Historische storingsdata',histN?`${histN.toLocaleString('nl-NL')} regels voor prognosekalibratie${typen.length?`: ${typen.join(', ')}`:''}.`:'Nog geen historische storingsdata geladen.'],
    ['Live storingslijst',liveN?`${liveN.toLocaleString('nl-NL')} regels voor het actuele dashboard. Deze data telt niet mee als historie.`:'Geen open-storingenlijst geladen.'],
    ['MSI Monte Carlo historie',mc?`${mc.histP} jaar historie gebruikt. Open storingen zijn uitgesloten van de kalibratie.`:'Nog geen MSI Monte Carlo gedraaid.'],
    ['DRIP historie',drip&&drip.aan?`${drip.incidentenSelectie.toLocaleString('nl-NL')} incidenten gekoppeld aan ${drip.gekoppeldeSelectie.toLocaleString('nl-NL')} DRIPs.`:'Geen DRIP-historiekalibratie actief in de laatst gedraaide DRIP Monte Carlo.']
  ];
  return `<h3>3 &nbsp; Verleden</h3><p>Het verleden wordt gebruikt om de kans op toekomstige uitval te kalibreren. Het actuele dashboard blijft gescheiden van die historische bron.</p>
    <table class="memo-samenvatting"><tbody>${regels.map(r=>`<tr><td class="ml">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
}
function memoLiekeContextHtml(bron){
  const c=memoContextVoorBron(bron);
  if(!c)return `<h3>4 &nbsp; Werkzaamheden en U-routes</h3><p>Geen operationele context beschikbaar voor deze scope.</p>`;
  const werk=c.werkGeladen?`${c.werkenTijd} werkzaamheden in periode, ${c.werkenWeg} op betrokken wegen, ${c.werkenExact} exact gelokaliseerd.`:'Werkzaamhedenbestand niet geladen.';
  const route=c.uRouteGeladen?`${c.routeMatches} gekoppelde U-routes, ${c.routeInzetAssets||0} inzetassets voor of na de omleiding, ${c.routeAssets||0} assets langs de route-as.`:'U-routebestand niet geladen.';
  const details=[
    ['Werkzaamheden',werk],
    ['U-routes',route],
    ['Dienstduiding',c.serviceTekst||'Geen extra dienstduiding uit de context.']
  ];
  return `<h3>4 &nbsp; Werkzaamheden en U-routes</h3>
    <p>Deze context verandert de technische faalkans niet. De context laat zien waar uitval harder raakt door werkvakken, afsluitingen of omleidingsinzet.</p>
    <table class="memo-samenvatting"><tbody>${details.map(r=>`<tr><td class="ml">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
}
function memoLiekeMsiStats(bron){
  if(bron&&bron.type==='drip-montecarlo')return null;
  const R=bron&&bron.type==='montecarlo'?bron.mc:MC_RESULT;
  if(!R)return null;
  const scope=bron&&bron.scope?String(bron.scope):'landelijk';
  if(scope==='landelijk')return {label:'MSI',p5:R.netwerk.p5,p50:R.netwerk.p50,p95:R.netwerk.p95,norm:(RULES.cfg.kpi_msi||99.5),tot:R.datumTot||'',periode:R.periodeLabel||R.horizon+' jaar',R};
  const oud=MC_RESULT;MC_RESULT=R;
  const row=mcVcRows().find(x=>x.vc===scope);
  MC_RESULT=oud;
  return row?{label:'MSI '+scope,p5:row.p5,p50:row.p50,p95:row.p95,norm:(RULES.cfg.kpi_msi||99.5),tot:R.datumTot||'',periode:R.periodeLabel||R.horizon+' jaar',R}:null;
}
function memoLiekeDripStats(bron){
  if(bron&&bron.type==='montecarlo')return null;
  const R=bron&&bron.type==='drip-montecarlo'?bron.mc:DRIP_MC;
  if(!R)return null;
  return {label:'DRIP',p5:R.netwerk.p5,p50:R.netwerk.p50,p95:R.netwerk.p95,norm:99.5,events:R.eventStats.p50,herstel:R.herstelStats.p50,tot:R.datumTot||String(R.jaarTot||''),periode:R.periodeLabel||R.jaarVan+' t/m '+R.jaarTot,R};
}
function memoLiekePrognoseHtml(bron){
  const msi=memoLiekeMsiStats(bron),drip=memoLiekeDripStats(bron);
  const regels=[];
  if(msi)regels.push(['MSI',`${fmt(msi.p50,2)}% p50, band ${fmt(msi.p5,2)}% tot ${fmt(msi.p95,2)}%, einddatum ${esc(msi.tot||'onbekend')}.`]);
  if(drip)regels.push(['DRIP',`${fmt(drip.p50,4)}% p50, band ${fmt(drip.p5,4)}% tot ${fmt(drip.p95,4)}%, ${fmt(drip.events,0)} verwachte storingen en ${fmt(drip.herstel,1)} hersteldagen tot ${esc(drip.tot||'onbekend')}.`]);
  if(!regels.length)regels.push(['Monte Carlo','Nog geen Monte Carlo gedraaid. Draai eerst de MSI of DRIP Monte Carlo om de toekomstverwachting in deze managementmemo te vullen.']);
  return `<h3>5 &nbsp; Prognose tot einddatum Monte Carlo</h3>
    <p>De prognose gebruikt de laatst gedraaide Monte Carlo. De mediaan is het centrale beeld. De band laat zien hoe onzeker de uitkomst is.</p>
    <table class="memo-samenvatting"><tbody>${regels.map(r=>`<tr><td class="ml">${esc(r[0])}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
}
function memoLiekeJaarReeks(R){
  const start=R&&R.datumVan?new Date(R.datumVan).getFullYear():new Date().getFullYear();
  const eind=R&&R.datumTot?new Date(R.datumTot).getFullYear():(R&&R.jaarTot?R.jaarTot:start);
  const jaren=[];
  for(let j=start+2;j<eind;j+=2)jaren.push(j);
  if(!jaren.includes(eind))jaren.push(eind);
  return jaren.filter(j=>Number.isFinite(j)&&j>=start).slice(0,8);
}
function memoLiekeMsiStap(R,jaar,stat){
  const start=R&&R.datumVan?new Date(R.datumVan).getFullYear():new Date().getFullYear();
  const eind=R&&R.datumTot?new Date(R.datumTot).getFullYear():start+Math.max(1,Math.round(R.horizon||1));
  const f=Math.max(0,Math.min(1,(jaar-start)/Math.max(1,eind-start)));
  const huidig=memoLiekeDienstRows({scope:(MEMO_BRON&&MEMO_BRON.scope)||'landelijk'})[0];
  const basis=huidig?huidig.besch:stat.p50;
  const waarde=basis+(stat.p50-basis)*f;
  const gevolg=waarde>=stat.norm?`Dienstverlening blijft boven norm, focus op monitoren en herstel van zwakke wegdelen.`:waarde>=stat.norm-1?`Marge wordt krap. Plan gericht onderhoud op de wegdelen met de laagste prognose.`:`Normrisico. Zonder gerichte ingreep ontstaat merkbare druk op verkeersmanagement en incidentafhandeling.`;
  return `${fmt(waarde,2)}% verwachte MSI-dienstbeschikbaarheid. ${gevolg}`;
}
function memoLiekeDripBlokken(R){
  if(!R)return [];
  const van=R.datumVan?datumMsLokaal(R.datumVan):new Date(R.jaarVan||new Date().getFullYear(),0,1).getTime();
  const tot=R.datumTot?datumEindeExclusiefMs(R.datumTot):new Date((R.jaarTot||new Date().getFullYear())+1,0,1).getTime();
  const blokken=[]; let cur=van;
  while(cur<tot&&blokken.length<8){
    const d=new Date(cur);
    const einde=Math.min(tot,new Date(d.getFullYear()+2,d.getMonth(),d.getDate()).getTime());
    const label=einde>=tot
      ? `${d.getFullYear()} t/m ${new Date(tot-1).getFullYear()}`
      : `${d.getFullYear()} t/m ${new Date(einde-1).getFullYear()}`;
    blokken.push({label,van:cur,tot:einde,duurJr:jarenTussenMs(cur,einde)});
    cur=einde;
  }
  return blokken;
}
function memoLiekeDripAssetScore(pd,R,blok){
  if(!pd||!pd.d||!R||!blok)return null;
  const profiel=kalibreerDripProfielMetHistorie(
    dripHazardProfiel(pd,pd.modelJaar,blok.van,blok.tot,R.vervangJaar,[pd.modelJaar].filter(Boolean)),
    pd,blok.duurJr,R.historieInfo&&R.historieInfo.aan
  );
  const events=Math.max(0,profiel.h0||0);
  const mttr=profiel.mttrUren||pd.mttrUren||0;
  const herstelDagen=events*mttr/24;
  const faal=1-Math.exp(-events);
  const gewicht=(pd.d.functieGewicht!=null?pd.d.functieGewicht:(RULES.drip.functies.find(f=>f.code===pd.d.functie)||{}).gewicht)||0.5;
  const impact=events*gewicht*Math.max(mttr,1);
  return {pd,d:pd.d,events,mttr,herstelDagen,faal,gewicht,impact,profiel};
}
function memoLiekeDripAssetLabel(d){
  return memoLiekeDripNaamHtml(d);
}
function memoLiekeDripDienstLabel(d){
  const diensten=dienstDuidingVoorAssets([d]||[]);
  return dienstDuidingTekst(diensten)||'dienstduiding niet bekend';
}
function memoLiekeDripBlokDuiding(R,blok,bron){
  const selectie=memoLiekeDripPerDrip(R,bron);
  const scores=selectie.map(pd=>memoLiekeDripAssetScore(pd,R,blok)).filter(Boolean);
  if(!scores.length)return 'Geen gesimuleerde DRIPs in dit blok.';
  const totaalEvents=scores.reduce((s,x)=>s+x.events,0);
  const totaalHerstel=scores.reduce((s,x)=>s+x.herstelDagen,0);
  const faalAssets=scores.filter(x=>x.faal>=0.5).length;
  const top=scores.slice().sort((a,b)=>b.impact-a.impact||b.events-a.events).slice(0,3);
  const topTekst=top.map(x=>`${memoLiekeDripAssetLabel(x.d)}, ${fmt(x.events,1)} verwachte storing(en), ${fmt(x.faal*100,0)}% kans, ${esc(memoLiekeDripDienstLabel(x.d))}`);
  const ernst=totaalEvents>=10||faalAssets>=5?'hoog':totaalEvents>=3||faalAssets>=2?'middel':'laag';
  const gevolg=ernst==='hoog'
    ? 'Gevolg: plan capaciteit en vervanging gericht op deze DRIPs, anders groeit de kans op hinder bij informeren, sturen en omleidingsinzet.'
    : ernst==='middel'
      ? 'Gevolg: neem deze DRIPs op in de onderhoudsprioritering en toets of geplande werkzaamheden of U-routes dezelfde locaties raken.'
      : 'Gevolg: regulier herstel volstaat, met monitoring van de genoemde assets.';
  return `${selectie.length.toLocaleString('nl-NL')} gesimuleerde DRIPs vallen binnen deze memo-scope. In dit blok verwacht het model ${fmt(totaalEvents,1)} storing(en) en ${fmt(totaalHerstel,1)} hersteldagen. ${faalAssets} DRIPs hebben minimaal 50% kans op een storing. Belangrijkste assets: ${memoLijst(topTekst)}. ${gevolg}`;
}
function memoLiekeDripDienstImpact(scores,blok){
  const uren=Math.max(1,(blok.tot-blok.van)/3600e3);
  const totaalGewicht=scores.reduce((s,x)=>s+Math.max(0,x.gewicht||0),0);
  const gewogenDown=scores.reduce((s,x)=>s+(x.events||0)*(x.mttr||0)*Math.max(0,x.gewicht||0),0);
  const dripBesch=totaalGewicht>0?Math.max(0,Math.min(100,100-gewogenDown/(totaalGewicht*uren)*100)):100;
  const dienstRows=DIENSTEN.map(d=>{
    const aandeel=dienstDripAandeel(d);
    const besch=Math.max(0,Math.min(100,100-aandeel*(100-dripBesch)));
    return {id:d.id,naam:d.naam.replace(/&amp;/g,'&'),norm:d.norm,aandeel,besch,verliesBp:(100-besch)*100,status:statusVan(besch,d.norm)};
  }).sort((a,b)=>a.besch-b.besch);
  return {dripBesch,dienstRows,zwakste:dienstRows[0]||null};
}
function memoLiekeDripBlokData(R,blok,bron){
  const selectie=memoLiekeDripPerDrip(R,bron);
  const scores=selectie.map(pd=>memoLiekeDripAssetScore(pd,R,blok)).filter(Boolean);
  const totaalEvents=scores.reduce((s,x)=>s+x.events,0);
  const totaalHerstel=scores.reduce((s,x)=>s+x.herstelDagen,0);
  const faalAssets=scores.filter(x=>x.faal>=0.5).length;
  const top=scores.slice().sort((a,b)=>b.impact-a.impact||b.events-a.events).slice(0,3);
  const impact=memoLiekeDripDienstImpact(scores,blok);
  const ernst=totaalEvents>=10||faalAssets>=5||((impact.zwakste&&impact.zwakste.besch<impact.zwakste.norm)?true:false)
    ? 'hoog' : totaalEvents>=3||faalAssets>=2||((impact.zwakste&&impact.zwakste.besch<impact.zwakste.norm+.05)?true:false) ? 'middel' : 'laag';
  const advies=ernst==='hoog'
    ? 'Stuur op herstelcapaciteit en vervanging van de genoemde DRIPs. Zonder actie groeit de druk op de dienstverlening in deze scope.'
    : ernst==='middel'
      ? 'Neem deze DRIPs mee in de onderhoudsprioritering. Controleer vooral samenloop met werkzaamheden en U-routes.'
      : 'Regulier herstel volstaat. Blijf de genoemde DRIPs volgen bij nieuwe historie of gewijzigde werkzaamheden.';
  return {blok,selectie,scores,totaalEvents,totaalHerstel,faalAssets,top,...impact,ernst,advies};
}
function memoLiekeDripTopListHtml(top){
  if(!top||!top.length)return '<span class="muted">Geen dominante DRIP in dit blok.</span>';
  return `<ul class="lieke-drip-list">${top.map(x=>`<li>${memoLiekeDripNaamHtml(x.d)}<br><span class="muted">${fmt(x.events,1)} verwachte storing(en), ${fmt(x.faal*100,0)}% kans, ${fmt(x.herstelDagen,1)} hersteldagen, ${esc(memoLiekeDripDienstLabel(x.d))}</span></li>`).join('')}</ul>`;
}
function memoLiekeDienstImpactGrafiek(data){
  if(!data||!data.length)return '';
  const labels=data.map(x=>x.blok.label);
  const kleuren=['#003082','#e17000','#1a8a4a','#4f7dbd'];
  const series=DIENSTEN.map((d,i)=>({id:d.id,naam:d.naam.replace(/&amp;/g,'&'),kleur:kleuren[i%kleuren.length],
    data:data.map(b=>{const r=(b.dienstRows||[]).find(x=>x.id===d.id);return r?r.besch:100;})}));
  const alle=series.flatMap(s=>s.data);
  const minY=Math.max(95,Math.floor((Math.min(...alle)-0.05)*10)/10);
  const maxY=100;
  const W=680,H=250,padL=56,padR=18,padT=18,padB=44,n=labels.length;
  const sx=i=>padL+(n<=1?0:(i/(n-1))*(W-padL-padR));
  const sy=v=>padT+(maxY-v)/(maxY-minY||1)*(H-padT-padB);
  let svg=`<svg viewBox="0 0 ${W} ${H}" class="mc-svg" preserveAspectRatio="xMidYMid meet">`;
  for(let g=0;g<=4;g++){
    const v=minY+(maxY-minY)*g/4,y=sy(v);
    svg+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#d0d6de" stroke-width="1"/>`;
    svg+=`<text x="${padL-6}" y="${y+3}" text-anchor="end" class="ax">${fmt(v,2)}%</text>`;
  }
  labels.forEach((lab,i)=>{const x=sx(i);svg+=`<text x="${x}" y="${H-padB+16}" text-anchor="middle" class="ax">${esc(lab)}</text>`;});
  series.forEach(se=>{
    const pts=se.data.map((v,i)=>`${sx(i)},${sy(v)}`).join(' ');
    svg+=`<polyline points="${pts}" fill="none" stroke="${se.kleur}" stroke-width="2.5"/>`;
    se.data.forEach((v,i)=>svg+=`<circle cx="${sx(i)}" cy="${sy(v)}" r="2.8" fill="${se.kleur}"><title>${esc(se.naam)} ${labels[i]}: ${fmt(v,4)}%</title></circle>`);
  });
  svg+=`</svg>`;
  const legend=`<div class="lieke-legend">${series.map(s=>`<span><i style="background:${s.kleur}"></i>${esc(s.naam)}</span>`).join('')}</div>`;
  return `<div class="lieke-chart">${svg}</div>${legend}`;
}
function memoLiekeDripBlokkenTabel(data){
  if(!data||!data.length)return '';
  return `<table class="lieke-blokken"><thead><tr><th>Periode</th><th class="num">Storingen</th><th class="num">Herstel</th><th class="num">DRIP-besch.</th><th>Zwakste dienst</th><th>Belangrijkste DRIPs</th><th>Duiding</th></tr></thead><tbody>
    ${data.map(b=>{
      const zw=b.zwakste;
      return `<tr>
        <td><b>${esc(b.blok.label)}</b><br><span class="muted">${b.selectie.length.toLocaleString('nl-NL')} gesimuleerde DRIPs</span></td>
        <td class="num">${fmt(b.totaalEvents,1)}</td>
        <td class="num">${fmt(b.totaalHerstel,1)} d</td>
        <td class="num">${fmt(b.dripBesch,4)}%</td>
        <td>${zw?`<b>${esc(zw.naam)}</b><br><span class="muted">${fmt(zw.besch,4)}%, verlies ${fmt(zw.verliesBp,2)} bp, norm ${fmt(zw.norm,1)}%</span>`:'-'}</td>
        <td>${memoLiekeDripTopListHtml(b.top)}</td>
        <td><b>${esc(b.ernst)}</b><br><span class="muted">${esc(b.advies)}</span></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}
function memoLiekeDripStap(R,jaar){
  const jaren=(R.cum&&R.cum.jaren)||[];
  if(!jaren.length)return `DRIP-prognose loopt tot ${R.datumTot||R.jaarTot}; geen jaarverdeling beschikbaar.`;
  let idx=jaren.findIndex(j=>j>=jaar); if(idx<0)idx=jaren.length-1;
  const cum=R.cum.cum[idx], per=R.cum.perJaar[idx], besch=R.dripBeschPerJaarStats&&R.dripBeschPerJaarStats[idx]?R.dripBeschPerJaarStats[idx].p50:R.netwerk.p50;
  const dienst=DIENSTEN.map(d=>({d,st:R.dienstPerJaarStats&&R.dienstPerJaarStats[d.id]?R.dienstPerJaarStats[d.id][idx]:null})).filter(x=>x.st).sort((a,b)=>a.st.p50-b.st.p50)[0];
  const dz=dienst?`${dienst.d.naam.replace(/&amp;/g,'&')} ${fmt(dienst.st.p50,4)}%`:'dienstimpact niet berekend';
  const gevolg=besch>=99.5?'Dienstverlening blijft stabiel, maar onderhoudslast blijft volgen.':besch>=99?'Onderhoudslast wordt zichtbaar, prioriteer zwaarste DRIPs.':'Beschikbaarheid komt onder druk, plan herstelcapaciteit en vervanging.';
  return `${fmt(cum,0)} cumulatieve DRIP-storingen, circa ${fmt(per,1)} in dit jaar, DRIP-beschikbaarheid ${fmt(besch,4)}%, zwakste dienst ${dz}. ${gevolg}`;
}
function memoLiekeTweeJaarHtml(bron){
  const msi=memoLiekeMsiStats(bron),drip=memoLiekeDripStats(bron);
  if(!msi&&!drip)return `<h3>6 &nbsp; Verwachte gevolgen per 2 jaar</h3><p>Nog geen Monte Carlo beschikbaar. Draai eerst de MSI of DRIP Monte Carlo met een einddatum om deze tijdlijn te vullen.</p>`;
  if(bron&&bron.type==='drip-montecarlo'&&drip){
    const blokken=memoLiekeDripBlokken(drip.R);
    if(!blokken.length)return `<h3>6 &nbsp; Verwachte gevolgen per 2 jaar</h3><p>Geen geldige blokindeling beschikbaar voor de DRIP Monte Carlo.</p>`;
    const data=blokken.map(b=>memoLiekeDripBlokData(drip.R,b,bron));
    return `<h3>6 &nbsp; Verwachte gevolgen per 2 jaar</h3>
      <p>Deze blokken gebruiken alleen de DRIPs die in deze Monte Carlo-run zijn gesimuleerd en binnen de gekozen memo-scope vallen. De grafiek toont per periode de totale dienstimpact van die scope. De tabel laat zien welke DRIPs de impact veroorzaken.</p>
      ${memoLiekeDienstImpactGrafiek(data)}
      <p class="lieke-duiding">Lees de lijnen als dienstbeschikbaarheid binnen de gekozen scope. Een dalende lijn betekent dat de gesimuleerde DRIP-stilstand meer effect krijgt op de dienstverlening. De tabel eronder verklaart welk DRIP-areaal dat veroorzaakt.</p>
      ${memoLiekeDripBlokkenTabel(data)}`;
  }
  const R=(msi&&msi.R)||(drip&&drip.R);
  const jaren=memoLiekeJaarReeks(R);
  if(!jaren.length)return `<h3>6 &nbsp; Ontwikkeling per 2 jaar</h3><p>Geen einddatum beschikbaar voor een 2-jaarsindeling.</p>`;
  const rows=jaren.map(j=>{
    const regels=[];
    if(msi)regels.push(memoLiekeMsiStap(msi.R,j,msi));
    if(drip)regels.push(memoLiekeDripStap(drip.R,j));
    return [String(j),regels.join(' ')];
  });
  return `<h3>6 &nbsp; Verwachte gevolgen per 2 jaar</h3>
    <table class="memo-samenvatting"><tbody>${rows.map(r=>`<tr><td class="ml">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
}
function memoLiekeDripCurveData(pd,R){
  const van=R.datumVan?datumMsLokaal(R.datumVan):new Date(R.jaarVan||new Date().getFullYear(),0,1).getTime();
  const tot=R.datumTot?datumEindeExclusiefMs(R.datumTot):new Date((R.jaarTot||new Date().getFullYear())+1,0,1).getTime();
  const duurJr=Math.max(0.01,jarenTussenMs(van,tot));
  const stappen=Math.max(4,Math.min(16,Math.ceil(duurJr*2)));
  const data=[];let cumulatief=0;
  for(let i=0;i<stappen;i++){
    const a=van+(tot-van)*i/stappen,b=van+(tot-van)*(i+1)/stappen;
    const blok={van:a,tot:b,duurJr:jarenTussenMs(a,b),label:''};
    const score=memoLiekeDripAssetScore(pd,R,blok);
    const events=score?score.events:0,mttr=score?score.mttr:0,uren=Math.max(1,(b-a)/3600e3);
    cumulatief+=events;
    data.push({label:new Date(b-1).toLocaleDateString('nl-NL',{month:'short',year:'2-digit'}),events,cumulatief,besch:Math.max(0,Math.min(100,100-events*mttr/uren*100))});
  }
  return data;
}
function memoLiekeDripCurveSvg(pd,R){
  const data=memoLiekeDripCurveData(pd,R);if(!data.length)return '';
  const W=680,H=230,padL=52,padR=54,padT=18,padB=44,n=data.length;
  const maxE=Math.max(1,...data.map(x=>x.cumulatief))*1.08;
  const minB=Math.max(0,Math.min(99.9,Math.floor((Math.min(...data.map(x=>x.besch))-.02)*100)/100));
  const sx=i=>padL+(n<=1?0:i/(n-1)*(W-padL-padR));
  const syE=v=>padT+(1-v/maxE)*(H-padT-padB);
  const syB=v=>padT+(100-v)/(100-minB||1)*(H-padT-padB);
  const pad=arr=>arr.map((x,i)=>`${i?'L':'M'}${sx(i).toFixed(1)},${x.toFixed(1)}`).join(' ');
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Storingscurve en beschikbaarheidscurve voor ${esc(dripCodeLabel(pd.d))}">`;
  for(let i=0;i<=4;i++){
    const y=padT+i*(H-padT-padB)/4,e=maxE*(1-i/4),b=100-(100-minB)*i/4;
    svg+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#e5e7eb"/><text x="${padL-6}" y="${y+3}" text-anchor="end" font-size="9" fill="#555">${fmt(e,1)}</text><text x="${W-padR+6}" y="${y+3}" font-size="9" fill="#555">${fmt(b,2)}%</text>`;
  }
  svg+=`<text x="10" y="12" font-size="9" fill="#003082">cumulatieve storingen</text><text x="${W-8}" y="12" text-anchor="end" font-size="9" fill="#e17000">beschikbaarheid per periode</text>`;
  svg+=`<path d="${pad(data.map(x=>syE(x.cumulatief)))}" fill="none" stroke="#003082" stroke-width="2.6"/><path d="${pad(data.map(x=>syB(x.besch)))}" fill="none" stroke="#e17000" stroke-width="2.6"/>`;
  data.forEach((x,i)=>{
    const xe=sx(i),ye=syE(x.cumulatief),yb=syB(x.besch),toon=n<=8||i%Math.ceil(n/8)===0||i===n-1;
    svg+=`<circle cx="${xe}" cy="${ye}" r="3" fill="#003082"><title>${esc(x.label)}: ${fmt(x.cumulatief,2)} cumulatieve storing(en)</title></circle><circle cx="${xe}" cy="${yb}" r="3" fill="#e17000"><title>${esc(x.label)}: ${fmt(x.besch,4)}% beschikbaarheid</title></circle>${toon?`<text x="${xe}" y="${H-padB+15}" text-anchor="middle" font-size="8.5" fill="#555">${esc(x.label)}</text>`:''}`;
  });
  return svg+'</svg>';
}
function memoLiekeDripCurvesHtml(bron){
  if(!bron||bron.type!=='drip-montecarlo')return '';
  const R=bron.mc||DRIP_MC;
  const selectie=memoLiekeDripPerDrip(R,bron).filter(pd=>pd&&pd.d&&(pd.d.wind||pd.d.ria4));
  if(!selectie.length)return `<h3>7 &nbsp; Curves windwaarschuwing en RIA4</h3><p>In de gesimuleerde memo-scope zijn geen DRIPs met het kenmerk windwaarschuwing of RIA4 geselecteerd.</p>`;
  return `<h3>7 &nbsp; Curves per windwaarschuwing en RIA4 DRIP</h3><p>Per geselecteerde DRIP toont blauw het cumulatieve verwachte aantal storingen. Oranje toont de verwachte beschikbaarheid per periode. De curves gebruiken dezelfde bouwjaren, levensduur, historische kalibratie en MTTR als de Monte Carlo.</p>${selectie.map(pd=>{
    const cat=[pd.d.ria4?'RIA4':'',pd.d.wind?'windwaarschuwing':''].filter(Boolean).join(' en ');
    return `<div class="lieke-drip-curve-card"><div class="lieke-drip-curve-head"><div>${memoLiekeDripNaamHtml(pd.d)}</div><div class="cat">${esc(cat)}</div></div>${memoLiekeDripCurveSvg(pd,R)}<div class="lieke-legend"><span><i style="background:#003082"></i>Cumulatieve storingen</span><span><i style="background:#e17000"></i>Beschikbaarheid per periode</span></div></div>`;
  }).join('')}`;
}
function memoLiekeDocument(bron,titel){
  const rows=memoLiekeDienstRows(bron),zwak=rows[0]||{naam:'onbekend',besch:100,norm:100};
  const scope=memoLiekeScopeNaam(bron);
  const msi=memoLiekeMsiStats(bron),drip=memoLiekeDripStats(bron);
  const prog=msi?`MSI p50 ${fmt(msi.p50,2)}% tot ${msi.tot||'einddatum onbekend'}`:(drip?`DRIP p50 ${fmt(drip.p50,4)}% tot ${drip.tot||'einddatum onbekend'}`:'nog geen Monte Carlo');
  let conclusie=zwak.besch>=zwak.norm?'Het actuele dienstbeeld ligt boven norm. De belangrijkste sturing zit in bewaken van de marge, vooral op de zwaarste wegdelen en bij werkzaamheden of U-routes.':'Het actuele dienstbeeld zit onder norm. Gerichte herstelprioriteit is nodig op de wegdelen en assets die de dienstprestatie het hardst raken.';
  if(bron&&bron.type==='drip-montecarlo'){
    const selectie=memoLiekeDripPerDrip(bron.mc||DRIP_MC,bron);
    const aantallen=memoLiekeDripAantallen(bron.mc||DRIP_MC,bron);
    const top=selectie.slice().sort((a,b)=>(b.gemEvents||0)-(a.gemEvents||0))[0];
    conclusie=`Deze memo gaat over ${aantallen.geselecteerd.toLocaleString('nl-NL')} geselecteerde DRIPs in de gekozen scope. Daarvan zijn ${aantallen.actief.toLocaleString('nl-NL')} operationele DRIPs doorgerekend${aantallen.uitgesloten?` en ${aantallen.uitgesloten.toLocaleString('nl-NL')} niet-operationele DRIPs uitgesloten`:''}. De algemene open-storingenlijst uit het dashboard wordt hier niet als huidig storingsaantal gebruikt. De sturing zit vooral op de DRIPs die in de Monte Carlo de meeste verwachte uitval geven${top?`, met <b>${esc(dripCodeLabel(top.d))}</b> als zwaarste bijdrage`:''}.`;
  }
  const datum=new Date().toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});
  return `<div class="memo-doc lieke-memo" id="memoDocInhoud">
    <div class="memo-kop">
      <div>
        <div class="memo-org">Rijkswaterstaat, Wegverkeersmanagement</div>
        <div class="memo-titel">${esc(titel||'Beknopte managementmemo')}</div>
        <div class="memo-meta"><strong>Aan: Lieke</strong> &nbsp;·&nbsp; Scope: ${esc(scope)} &nbsp;·&nbsp; ${datum}</div>
      </div>
      <div class="memo-stempel"><span class="memo-concept">Managementmemo</span><br>Beknopt<br>VWM</div>
    </div>
    <div class="memo-body">
      <h3>1 &nbsp; Kernboodschap</h3>
      <p>${conclusie} De toekomstverwachting is gebaseerd op ${esc(prog)}. De duiding combineert huidig areaal, historische storingsdata, dienstverlening, werkzaamheden en U-routes.</p>
      ${memoLiekeHuidigHtml(bron)}
      ${memoLiekeHistorieHtml(bron)}
      ${memoLiekeContextHtml(bron)}
      ${memoLiekePrognoseHtml(bron)}
      ${memoLiekeTweeJaarHtml(bron)}
      ${memoLiekeDripCurvesHtml(bron)}
      ${kostenMemoHtml(bron)}
      <h3>${bron&&bron.type==='drip-montecarlo'?'8':'7'} &nbsp; Gevraagde managementkeuze</h3>
      <p>Kies of de beheerder stuurt op regulier herstel, gericht onderhoud op de zwakste wegdelen of versnelling van vervanging. VWM actualiseert de memo zodra nieuwe live storingen, historie, werkzaamheden of U-routes worden geladen.</p>
    </div>
  </div>`;
}

/* Bouw de volledige bijlage-HTML voor een memo. */
function memoBijlage(bron, niveau, koppelBW){
  let kern='';
  if (bron.type==='overzicht') kern=bjlOverzicht(koppelBW);
  else if (bron.type==='gebied') kern=bjlGebied(bron, koppelBW);
  else if (bron.type==='montecarlo') kern=bjlMonteCarlo(bron, koppelBW);
  else if (bron.type==='drip-montecarlo') kern=bjlDripMonteCarlo(bron, koppelBW);
  const methode=bron.type==='drip-montecarlo'?bjlDripMethodeInvoer(bron):bjlMethodeInvoer();
  const slot=bron.type==='drip-montecarlo'
    ? 'Alle waarden zijn berekend uit het geselecteerde DRIP-areaal, de ingestelde levensduurparameters en, indien aangezet, de gekoppelde DRIP-storingshistorie. De memo en bijlage gebruiken exact dezelfde simulatieresultaten als het scherm.'
    : 'Alle waarden zijn deterministisch berekend uit de aangeboden storingslijst en het asset-register. De analyse betreft uitsluitend matrixsignaalgevers (MSI) en de bijbehorende signalering. VWM stelt de onderliggende doorrekening desgewenst beschikbaar voor verificatie.';
  return `<div class="memo-bijlage">
    <div class="bjl-kop">
      <div class="bjl-label">Bijlage bij de memo</div>
      <div class="bjl-titel">Inhoudelijke onderbouwing — volledige analyse</div>
      <div class="bjl-sub">Deze bijlage bevat de complete data, methode en resultaten waarop de memo is gebaseerd. De cijfers komen één-op-één overeen met de analyse in de dienstimpact-tool.</div>
    </div>
    ${methode}
    ${kern}
    ${memoOperationeleBijlage(bron)}
    ${bjlRekenregels()}
    <p class="bjl-slot">${slot}</p>
  </div>`;
}

/* Render de memo als document-HTML in de stijl van de bestaande memo-tool. */
/* Kostenmodule v68. VVU alleen na expliciete verkeersinvoer. */
/* Expliciet lineair verkeersscenario, geen gemeten VVU of gevalideerd causaal model. */
function kostenDagModel(w){return (kostenBasis().modelWegen||{})[w.key]||{};}

/* Verkeers-Monte Carlo, onzekerheid van één brondag. */
let TMC70_SESSION=null,TMC70_TOKEN=0;
function tmc70ScopeRows(scope){return kostenDagRows().filter(w=>scope.kind==='weg'?w.key===scope.key:scope.kind==='vc'?normAssetVc(w.vc)===scope.key:true);}
function tmc70ScopeId(scope){return JSON.stringify([scope.kind,scope.key||'']);}
function tmc70Source(scope){
 const c=kostenBasis(),tarief=kostenBereken(c,{vvu:0,periode:'brondag',bron:'Monte Carlo scenario'});
 return {datum:sc67Datum(),tarief:tarief.tarief,prijspeil:c.prijspeil,overlap:v68OverlapBevestigd(),rows:tmc70ScopeRows(scope).map(w=>{const z=kostenDagResultaat(w);return {key:w.key,vc:w.vc,q:sc67Num(z.m.q),uren:sc67Num(z.m.uren),minuten:z.minuten,bron:z.bron||'',ndw:z.m.ndwUsed||null,verlies:z.verlies,route:z.routeMelding,model:z.m};}).sort((a,b)=>a.key.localeCompare(b.key))};
}
function tmc70Fingerprint(source){return JSON.stringify(source);}
function tmc70DefaultRow(row){return tmc71Default(row);}

function tmc70Store(){return kostenBasis().trafficMC70||{};}
function tmc70Save(scope,config,result){const c=kostenBasis(),id=tmc70ScopeId(scope);c.trafficMC70={...(c.trafficMC70||{}),[id]:{config,result}};RULES.kosten=c;}
function tmc70Random(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function tmc70Tri(range,u){const [a,m,b]=range;if(a===b)return a;const f=(m-a)/(b-a);return u<f?a+Math.sqrt(u*(b-a)*(m-a)):b-Math.sqrt((1-u)*(b-a)*(b-m));}
function tmc70Validate(config){
 if(!Number.isInteger(config.runs)||config.runs<100||config.runs>20000)throw Error('Kies 100 tot en met 20.000 runs.');
 if(!Number.isInteger(config.seed)||config.seed<0||config.seed>4294967295)throw Error('De startwaarde moet een geheel getal van 0 tot en met 4294967295 zijn.');
 if(!['samen','onafhankelijk'].includes(config.dependency))throw Error('Kies een geldige samenhang.');
 const selected=config.rows.filter(r=>r.selected);if(!selected.length)throw Error('Selecteer minimaal één wegdeel en vul de drie bereiken in.');
 for(const r of selected)for(const k of ['q','uren','minuten']){const v=r[k];if(!Array.isArray(v)||v.length!==3||!v.every(x=>Number.isFinite(x)&&x>=0)||v[0]>v[1]||v[1]>v[2]||k==='uren'&&v[2]>24)throw Error(r.key+'. Controleer '+({q:'voertuigen per uur',uren:'hinderuren',minuten:'extra minuten'}[k])+'. Minimum moet kleiner dan of gelijk aan meest verwacht en maximum zijn. Hinderuren maximaal 24.');}
 return selected;
}
function tmc70Summary(values,tarief){
 const a=Array.from(values).sort((x,y)=>x-y),n=a.length,q=p=>{const k=(n-1)*p,i=Math.floor(k);return a[i]+(a[Math.min(i+1,n-1)]-a[i])*(k-i);};
 const vvu={p5:q(.05),p50:q(.5),p95:q(.95),mean:a.reduce((x,y)=>x+y,0)/n};
 return {vvu,kosten:Object.fromEntries(Object.entries(vvu).map(([k,v])=>[k,v*tarief]))};
}
async function tmc70Simulate(config,tarief,progress=()=>{},cancelled=()=>false){
 const rows=tmc70Validate(config);if(!Number.isFinite(tarief)||tarief<0)throw Error('Controleer de kostentarieven en het vrachtpercentage.');
 const rng=tmc70Random(config.seed),total=new Float64Array(config.runs),per=rows.map(()=>new Float64Array(config.runs));
 for(let i=0;i<config.runs;i++){
  if(i%200===0){if(cancelled())throw Error('Simulatie gestopt.');progress(i/config.runs);await new Promise(resolve=>setTimeout(resolve,0));}
  const common=config.dependency==='samen'?rng():null;
  for(let j=0;j<rows.length;j++){const r=rows[j],sample=k=>tmc70Tri(r[k],common===null?rng():common),v=sample('q')*sample('uren')*sample('minuten')/60;if(!Number.isFinite(v)||!Number.isFinite(v*tarief))throw Error('De ingevoerde waarden zijn te groot.');per[j][i]=v;total[i]+=v;}
  if(!Number.isFinite(total[i]*tarief))throw Error('Het totaal is te groot.');
 }
 if(cancelled())throw Error('Simulatie gestopt.');
 const summary=tmc70Summary(total,tarief),max=Math.max(...total)*tarief,min=Math.min(...total)*tarief,bins=Array(24).fill(0);
 for(const v of total)bins[max===min?0:Math.min(23,Math.floor((v*tarief-min)/(max-min)*24))]++;
 progress(1);return {...summary,hist:{min,max,bins},per:rows.map((r,j)=>({key:r.key,...tmc70Summary(per[j],tarief)})),runs:config.runs,seed:config.seed,dependency:config.dependency};
}
function tmc70Help(){return `<details><summary>Hoe worden deze VVU en kosten berekend</summary><p>Dit is onzekerheid rond één brondag met de open storingen uit jouw storingslijst. Het model voorspelt geen toekomstige assetstoringen of toekomstige verkeersdagen.</p><p>Per run worden voertuigen per uur, hinderuren en extra minuten getrokken uit een driehoeksverdeling. Je stelt zelf het minimum, de meest verwachte waarde en het maximum in. Gelijke waarden geven een vaste invoer. De knop met 20 procent maakt alleen een voorstel voor aannames, geen gemeten onzekerheidsmarge.</p><p>VVU = voertuigen per uur × hinderuren × extra minuten / 60. Kosten = VVU × het ingestelde gewogen tarief voor personenauto en vracht. De tarieven en het prijspeil blijven tijdens de simulatie vast. De extra minuten uit het bestaande trajectmodel bevatten de storingsimpact al. Deze wordt niet nogmaals vermenigvuldigd. OSM-routes en snelheidsreducties worden niet opnieuw per run berekend; je varieert de resulterende extra reistijd.</p><p>Hinderuren zijn de uren waarin verkeer extra reistijd door deze storing ondervindt. Gebruik bijvoorbeeld de som van ochtendspits en avondspits, met een daarbij passend gemiddeld voertuigaantal en extra vertraging. Een NDW-minuutmeting buiten die uren is geen gemeten spitsgemiddelde. De meetdatum blijft bij de invoer vermeld.</p><p>Bij samen oplopende waarden gebruikt elke invoer op alle wegdelen dezelfde toevalspositie. Dit veronderstelt sterke positieve samenhang. Bij onafhankelijk trekt iedere invoer afzonderlijk. Geen van beide relaties is uit de meetgegevens geschat. Ook bij gezamenlijke trekking moet je dubbele verkeersstromen zelf uit de selectie verwijderen.</p><p>De mediaan is p50. Tussen p5 en p95 valt de middelste 90 procent van de gesimuleerde uitkomsten. Dit is een scenarioband, geen gemeten schade of statistisch betrouwbaarheidsinterval. De scope wordt per run opgeteld; afzonderlijke medianen en percentielen mogen niet worden opgeteld. Ontbrekende invoer is geen nul.</p><p>Methode voor de <a href="https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.triangular.html" target="_blank" rel="noopener">driehoeksverdeling, definitie met minimum, modus en maximum</a>. De gekozen marges zijn jouw aannames.</p>${kostenBronHtml()}</details>`;}
function tmc70Graph(h){const peak=Math.max(...h.bins,1),w=760,bw=680/h.bins.length;return `<svg viewBox="0 0 ${w} 240" role="img" aria-label="Verdeling van gesimuleerde kosten per brondag" style="width:100%;max-width:900px;background:white"><text x="40" y="18" fill="#154273">Aantal runs per kostenklasse</text>${h.bins.map((n,i)=>`<rect x="${40+i*bw}" y="${195-160*n/peak}" width="${bw-2}" height="${160*n/peak}" fill="#007bc7"><title>${n} runs. ${kostenEuro(h.min+(h.max-h.min)*i/h.bins.length)} tot ${kostenEuro(h.min+(h.max-h.min)*(i+1)/h.bins.length)}</title></rect>`).join('')}<line x1="40" x2="720" y1="195" y2="195" stroke="#154273"/><text x="40" y="224">${kostenEuro(h.min)}</text><text x="720" y="224" text-anchor="end">${kostenEuro(h.max)}</text></svg>`;}
function tmc70ResultHtml(r,interactive=true){return `<section class="kosten-blok"><h3>Monte Carlo verkeerskosten per brondag</h3><p>Bronpeildatum ${esc(r.source.datum)}. ${r.per.length} van ${r.source.rows.length} wegdelen geselecteerd. ${r.runs.toLocaleString('nl-NL')} runs. Prijspeil ${esc(r.source.prijspeil)}. Vast tarief ${kostenEuro(r.source.tarief)} per VVU, intern zonder afronding.</p><p><b>Mediaan ${kostenEuro(r.kosten.p50)} per brondag.</b> Middelste 90 procent van ${kostenEuro(r.kosten.p5)} tot ${kostenEuro(r.kosten.p95)}. Gemiddelde ${kostenEuro(r.kosten.mean)}.</p><p>VVU mediaan ${sc67Format(r.vvu.p50)}, band ${sc67Format(r.vvu.p5)} tot ${sc67Format(r.vvu.p95)}. Dit is een som van geselecteerde wegdeelscenario’s. ${r.source.overlap?'Overlapcontrole is bevestigd.':'Overlapcontrole is niet bevestigd, dezelfde verkeersstroom kan meerdere wegdelen raken.'}</p>${mc72Histogram(r,interactive)}<div style="overflow:auto"><table class="tbl"><thead><tr><th>Wegdeel</th><th>VVU mediaan, P50</th><th>Lage kosten, P5</th><th>Lage kosten, P50</th><th>Hoge kosten, P95</th></tr></thead><tbody>${r.per.map(p=>`<tr><td>${esc(p.key)}</td><td>${sc67Format(p.vvu.p50)}</td><td>${kostenEuro(p.kosten.p5)}</td><td>${kostenEuro(p.kosten.p50)}</td><td>${kostenEuro(p.kosten.p95)}</td></tr>`).join('')}</tbody></table></div><p>Samenhang ${r.dependency==='samen'?'alle invoer loopt samen op':'alle invoer onafhankelijk'}. Startwaarde ${r.seed}. ${esc(r.config.note||'Geen aanvullende onderbouwing ingevuld. De bereiken zijn scenarioaannames.')}</p><details><summary>Invoer en bron per gesimuleerd wegdeel</summary>${r.config.rows.filter(x=>x.selected).map(x=>{const s=r.source.rows.find(y=>y.key===x.key);return `<p><b>${esc(x.key)}</b>. Voertuigen per uur ${x.q.map(v=>sc67Format(v)).join(' / ')}. Hinderuren ${x.uren.map(v=>sc67Format(v)).join(' / ')}. Extra minuten ${x.minuten.map(v=>sc67Format(v)).join(' / ')}. Volgorde minimum, meest verwacht, maximum. ${esc(s?.bron||'Verkeerskundig effect zonder aanvullende bron, scenario.')}${s?.ndw?` NDW ${esc(s.ndw.id)}, meetmoment ${esc(s.ndw.time||'onbekend')}.`:''}</p>`;}).join('')}</details></section>`;}
function tmc70Memo(bron){
 if(!bron?.kostenAan||['montecarlo','drip-montecarlo'].includes(bron.type))return '';
 const scope=bron.wegKey?{kind:'weg',key:bron.wegKey}:bron.scope&&bron.scope!=='landelijk'?{kind:'vc',key:normAssetVc(bron.scope)}:{kind:'all',key:''};
 const saved=tmc70Store()[tmc70ScopeId(scope)];if(!saved?.config?.includeMemo||!saved.result)return '';
 if(saved.result.fingerprint!==tmc70Fingerprint(tmc70Source(scope)))return '<p>De verkeers-Monte Carlo is verouderd door gewijzigde invoer of bronnen. Voer de simulatie opnieuw uit om de resultaten in deze memo mee te nemen.</p>';
 return tmc70ResultHtml(saved.result,false)+tmc70Help();
}
function tmc70Open(kind='all',key=''){
 TMC70_TOKEN++;let d=document.getElementById('tmc70Dialog');if(!d){d=document.createElement('dialog');d.id='tmc70Dialog';d.style.cssText='width:96vw;max-width:1250px;max-height:92vh;overflow:auto;border:2px solid #154273;border-radius:8px;padding:20px';document.body.appendChild(d);d.addEventListener('close',()=>{TMC70_TOKEN++;});}
 const scope={kind,key},source=tmc70Source(scope),fingerprint=tmc70Fingerprint(source),saved=tmc70Store()[tmc70ScopeId(scope)],same=saved?.config?.fingerprint===fingerprint;
 let config=same?saved.config:{runs:5000,seed:20260731,dependency:'samen',note:'',includeMemo:false,rows:source.rows.map(tmc70DefaultRow),fingerprint};
 config=tmc71Config(config,source);TMC70_SESSION={scope,source,fingerprint,config};
 const input=(v,k,i)=>`<input type="number" min="0" ${k==='uren'?'max="24"':''} step="any" data-tmc-value="${k}" data-index="${i}" aria-label="${{q:'Voertuigen per uur',uren:'Hinderuren',minuten:'Extra minuten'}[k]} ${['minimum','meest verwacht','maximum'][i]}" value="${esc(v??'')}" style="width:85px;margin:2px">`;
 d.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px"><h2>Monte Carlo verkeersberekening</h2><button onclick="document.getElementById('tmc70Dialog').close()">Sluiten</button></div><p>Scope ${esc(kind==='all'?'Alle verkeerscentrales':key)}. Bronpeildatum ${esc(source.datum)}.</p>${kind!=='weg'?`<label>Verkeerscentrale <select id="tmc70VC" onchange="tmc70Switch(this.value)"><option value="">Alle</option>${[...new Set(kostenDagRows().map(w=>normAssetVc(w.vc)))].sort().map(vc=>`<option value="${esc(vc)}" ${kind==='vc'&&vc===key?'selected':''}>${esc(vc||'Onbekend')}</option>`).join('')}</select></label>`:''}<p>Alles is vooringevuld als scenario. Opgeslagen waarden en NDW-intensiteiten gaan voor. Waar invoer ontbreekt, gebruiken we 1.000 voertuigen per uur, 6 hinderuren en 0,5 extra minuut. De marges zijn 20 procent voor voertuigen en uren en 50 procent voor extra minuten. Controleer dit voor jouw spits. Het zijn aannames, geen gemeten onzekerheidsmarges. Een lege onderbouwing blokkeert dit scenario niet.</p>${!same&&saved?'<p>Bronnen of verkeersinvoer zijn gewijzigd. De oude uitkomst wordt niet getoond. De bereiken zijn opnieuw gevuld vanuit de actuele invoer.</p>':''}<div id="tmc70Inputs"><p><label>Runs <select id="tmc70Runs">${[100,1000,5000,10000,20000].map(n=>`<option ${n===config.runs?'selected':''}>${n}</option>`).join('')}</select></label> <label>Startwaarde <input id="tmc70Seed" type="number" min="0" max="4294967295" value="${config.seed}"></label> <label>Samenhang <select id="tmc70Dependency"><option value="samen" ${config.dependency==='samen'?'selected':''}>Alle waarden lopen samen op</option><option value="onafhankelijk" ${config.dependency==='onafhankelijk'?'selected':''}>Alle waarden onafhankelijk</option></select></label></p><p><button onclick="tmc70Spread()">Voorstel marges van 20 procent</button> <button onclick="tmc70Select(false)">Alles uit</button> <button onclick="tmc70Select(true)">Complete regels aan</button></p><p>Per veld, minimum, meest verwacht, maximum. Extra minuten gelden per voertuig en bevatten alleen het effect van de assetstoring.</p><div style="overflow:auto"><table class="tbl"><thead><tr><th>Meenemen</th><th>Wegdeel en bron</th><th>Voertuigen per uur</th><th>Hinderuren per brondag</th><th>Extra minuten per voertuig</th></tr></thead><tbody>${config.rows.map((r,i)=>{const b=source.rows[i];return `<tr data-tmc-row="${i}"><td><input type="checkbox" data-tmc-selected ${r.selected?'checked':''} aria-label="${esc(r.key)} meenemen"></td><td>${esc(r.key)}<br><small>${b.ndw?`NDW ${esc(b.ndw.time||'')}, ${b.ndw.confirmed?'locatie bevestigd':'locatie nog controleren'}`:'Handmatige verkeersinvoer'}<br>${esc(b.bron||'Effect en hinderuren zijn scenarioaannames')}<br>${b.q==null?'Voertuigen aangenomen, 1.000 per uur. ':''}${b.uren==null?'Hinderuren aangenomen, 6. ':''}${b.minuten==null?'Extra vertraging aangenomen, 0,5 minuut. ':''}</small></td>${['q','uren','minuten'].map(k=>`<td style="min-width:280px">${r[k].map((v,j)=>input(v,k,j)).join('')}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div><label style="display:block;margin:14px 0">Onderbouwing van jouw onzekerheidsmarges <textarea id="tmc70Note" rows="2" style="width:98%">${esc(config.note)}</textarea></label><label><input id="tmc70Memo" type="checkbox" ${config.includeMemo?'checked':''}> Neem deze simulatie mee als Kosten in de memo voor dezelfde scope is aangevinkt</label></div><p><button id="tmc70Run" onclick="tmc70Run()">Opslaan en Monte Carlo uitvoeren</button> <button onclick="tmc70SaveOnly()">Instellingen opslaan</button> <button onclick="tmc70Cancel()">Simulatie stoppen</button></p><p id="tmc70Status" role="status" aria-live="polite"></p><div id="tmc70Result">${same&&saved.config.version71&&saved.result?tmc70ResultHtml(saved.result):''}</div>${tmc70Help()}`;
 d.querySelector('#tmc70Inputs').addEventListener('input',tmc70Dirty);
 if(!d.open)d.showModal();
}
function tmc70Switch(value){tmc70Open(value?'vc':'all',value);}
function tmc70Dirty(){TMC70_TOKEN++;document.getElementById('tmc70Result').innerHTML='';document.getElementById('tmc70Status').textContent='Invoer gewijzigd. Sla op en voer de simulatie opnieuw uit.';document.getElementById('tmc70Run').disabled=false;}
function tmc70Cancel(){TMC70_TOKEN++;document.getElementById('tmc70Status').textContent='Simulatie gestopt.';document.getElementById('tmc70Run').disabled=false;}
function tmc70Read(){
 const d=document.getElementById('tmc70Dialog'),get=id=>d.querySelector('#'+id),config={version71:true,runs:Number(get('tmc70Runs').value),seed:get('tmc70Seed').value===''?null:Number(get('tmc70Seed').value),dependency:get('tmc70Dependency').value,note:get('tmc70Note').value,includeMemo:get('tmc70Memo').checked,fingerprint:TMC70_SESSION.fingerprint,rows:[]};
 d.querySelectorAll('[data-tmc-row]').forEach(tr=>{const r={key:TMC70_SESSION.source.rows[Number(tr.dataset.tmcRow)].key,selected:tr.querySelector('[data-tmc-selected]').checked};for(const k of ['q','uren','minuten'])r[k]=Array.from(tr.querySelectorAll('[data-tmc-value="'+k+'"]')).map(x=>x.value===''?null:Number(x.value));config.rows.push(r);});return config;
}
function tmc70Spread(){document.querySelectorAll('#tmc70Dialog [data-tmc-row]').forEach(tr=>{for(const k of ['q','uren','minuten']){const a=tr.querySelectorAll('[data-tmc-value="'+k+'"]'),v=a[1].value===''?NaN:Number(a[1].value);if(Number.isFinite(v)&&v>=0){a[0].value=Number((v*.8).toFixed(8));a[2].value=Number(Math.min(k==='uren'?24:Infinity,v*1.2).toFixed(8));}}});tmc70Dirty();}
function tmc70Select(on){document.querySelectorAll('#tmc70Dialog [data-tmc-row]').forEach(tr=>{const inputs=Array.from(tr.querySelectorAll('[data-tmc-value]'));tr.querySelector('[data-tmc-selected]').checked=on&&inputs.every(x=>x.value!==''&&Number.isFinite(Number(x.value)));});tmc70Dirty();}
function tmc70SaveOnly(){try{const c=tmc70Read();tmc70Validate(c);tmc70Save(TMC70_SESSION.scope,c,null);tmc70Dirty();document.getElementById('tmc70Status').textContent='Instellingen opgeslagen. Ze gaan mee in de totaalexport als Parameters is aangevinkt. Voer de simulatie uit voor resultaten.';}catch(e){document.getElementById('tmc70Status').textContent=e.message;}}
async function tmc70Run(){
 const session=TMC70_SESSION,token=++TMC70_TOKEN,button=document.getElementById('tmc70Run'),status=document.getElementById('tmc70Status');
 try{
  const config=tmc70Read();tmc70Validate(config);
  if(session.fingerprint!==tmc70Fingerprint(tmc70Source(session.scope)))throw Error('Bronnen of verkeerswaarden zijn gewijzigd. Sluit en open deze simulatie opnieuw.');
  tmc70Save(session.scope,config,null);document.getElementById('tmc70Result').innerHTML='';button.disabled=true;
  const result=await tmc70Simulate(config,session.source.tarief,p=>{status.textContent='Simulatie '+Math.round(p*100)+' procent.';},()=>token!==TMC70_TOKEN);
  if(token!==TMC70_TOKEN)return;
  if(session.fingerprint!==tmc70Fingerprint(tmc70Source(session.scope)))throw Error('De bronnen zijn tijdens de run gewijzigd. Open de simulatie opnieuw.');
  Object.assign(result,{config,source:session.source,fingerprint:session.fingerprint});tmc70Save(session.scope,config,result);document.getElementById('tmc70Result').innerHTML=tmc70ResultHtml(result);status.textContent='Gereed. Instellingen en resultaat zijn opgeslagen en gaan mee in de totaalexport met Parameters.';
 }catch(e){if(token===TMC70_TOKEN)status.textContent=e.message;}finally{if(token===TMC70_TOKEN)button.disabled=false;}
}

/* Gescheiden MSI-prognose en expliciete voorinvulling voor huidige kosten. */
let F71_MODEL=null,F71_SESSION=null,F71_TOKEN=0;
const F71_DAY=86400000,F71_YEAR=365.25*86400000;
function tmc71Range(v,p,max=Infinity){return [Math.max(0,v*(1-p)),v,Math.min(max,v*(1+p))];}
function tmc71Default(row){const q=Number.isFinite(row.q)?row.q:1000,h=Number.isFinite(row.uren)?row.uren:6,d=Number.isFinite(row.minuten)?row.minuten:.5;return {key:row.key,selected:true,q:tmc71Range(q,.2),uren:tmc71Range(h,.2,24),minuten:tmc71Range(d,.5)};}
function tmc71Config(config,source){
 if(config.version71)return config;
 const c={...config,version71:true,note:config.note||'Vooringevuld scenario. Voertuigen per uur uit opgeslagen invoer of NDW, anders 1.000. Hinderuren uit invoer, anders 6. Extra minuten uit verkeersmodel, anders 0,5. Marges zijn aannames, geen gemeten spitsprofiel.'};
 c.rows=source.rows.map(s=>{const old=config.rows.find(x=>x.key===s.key),r=tmc71Default(s);if(old)for(const k of ['q','uren','minuten']){if(old[k]?.every(Number.isFinite)){r[k]=old[k][0]===old[k][2]?tmc71Range(old[k][1],k==='minuten'?.5:.2,k==='uren'?24:Infinity):old[k];}}return r;});return c;
}
function f71GroupKey(a){return [a.weg,normAssetRichting(a.richting),normAssetVc(a.vc)].join('|');}
function f71Iso(ms){return new Date(ms).toISOString().slice(0,10);}
function f71Year(ms){const d=new Date(ms),y=d.getUTCFullYear();return y+(ms-Date.UTC(y,0,1))/(Date.UTC(y+1,0,1)-Date.UTC(y,0,1));}
function f71Build(){
 const assets=[...new Map((ASSET_REGISTER_STATE?.assets||[]).filter(a=>a.tp==='MSI'&&a.prognoseActief).map(a=>[a.key,a])).values()],groups=new Map(),byRoad=new Map();
 for(const a of assets){const key=f71GroupKey(a);let g=groups.get(key);if(!g){g={key,weg:a.weg,richting:normAssetRichting(a.richting),vc:normAssetVc(a.vc),assets:[],events:[],cohorts:[]};groups.set(key,g);}g.assets.push(a);const rk=[a.weg,normAssetRichting(a.richting)].join('|');if(!byRoad.has(rk))byRoad.set(rk,[]);if(Number.isFinite(a.hm))byRoad.get(rk).push({hm:a.hm,key});}
 byRoad.forEach(a=>a.sort((x,y)=>x.hm-y.hm));
 const seen=new Set(),diag={raw:0,duplicate:0,invalid:0,unmatched:0,matched:0,durations:0,years:assets.filter(a=>a.bouwjaar).length,explicit:0,assets:assets.length},sources=[];let first=Infinity,last=-Infinity;
 for(const b of STORINGSBRONNEN||[]){let from=Infinity,to=-Infinity;for(const r of b.rijen||[]){diag.raw++;const ms=parseDatum(r.start??r.Start??r.startdatum),loc=String(r.locatie||r.asset||'').toUpperCase(),m=loc.match(/\b([AN]\d+)\s*(LI|RE|L|R)\s+(\d+(?:[,.]\d+)?)/);if(!Number.isFinite(ms)||!m){diag.invalid++;continue;}const road=m[1],dir=normAssetRichting(m[2]),hm=Number(m[3].replace(',','.'));from=Math.min(from,ms);to=Math.max(to,ms);first=Math.min(first,ms);last=Math.max(last,ms);const signature=[road,dir,hm.toFixed(3),Math.round(ms/1000)].join('|');if(seen.has(signature)){diag.duplicate++;continue;}seen.add(signature);
  const pool=byRoad.get(road+'|'+dir)||[];let lo=0,hi=pool.length;while(lo<hi){const mid=(lo+hi)>>1;if(pool[mid].hm<hm)lo=mid+1;else hi=mid;}const best=Math.min(pool[lo]?Math.abs(pool[lo].hm-hm):Infinity,pool[lo-1]?Math.abs(pool[lo-1].hm-hm):Infinity);if(best>.1){diag.unmatched++;continue;}
  const keys=new Set();for(let i=Math.max(0,lo-1);i>=0&&Math.abs(pool[i].hm-hm)<=best+.00001;i--)keys.add(pool[i].key);for(let i=lo;i<pool.length&&Math.abs(pool[i].hm-hm)<=best+.00001;i++)keys.add(pool[i].key);if(keys.size!==1){diag.unmatched++;continue;}
  const g=groups.get([...keys][0]);const end=parseDatum(r.einde??r.end??r.hersteld),hours=end>ms?(end-ms)/3600000:null;g.events.push({ms,hours});diag.matched++;if(hours)diag.durations++;
 }if(Number.isFinite(from))sources.push({name:b.naam,from:f71Iso(from),to:f71Iso(to)});}
 for(const g of groups.values()){
  const cohorts=new Map();for(const a of g.assets){const rel=assetReliability(a),k=[a.bouwjaar||0,rel.L,rel.beta,rel.bron].join('|');if(!cohorts.has(k))cohorts.set(k,{year:a.bouwjaar||null,L:rel.L,beta:rel.beta,n:0,source:rel.bron});cohorts.get(k).n++;if(!['assettype','standaard','standaard-terugval'].includes(rel.bron))diag.explicit++;}g.cohorts=[...cohorts.values()];
  const current=kostenDagRows().find(w=>w.weg===g.weg&&normAssetRichting(w.richting)===g.richting&&normAssetVc(w.vc)===g.vc),middle=g.assets.filter(a=>Number.isFinite(a.hm)).sort((a,b)=>a.hm-b.hm),hm=middle[Math.floor(middle.length/2)]?.hm;
  const w=current||{key:g.weg+' '+g.richting+' · VC '+g.vc,weg:g.weg,richting:g.richting,vc:g.vc,meldingen:hm==null?[]:[{hm,avail:100,typeId:'MSI'}]};const z=kostenDagResultaat(w);g.label=w.key;g.current=!!current;g.traffic={q:Number.isFinite(sc67Num(z.m.q))?Number(z.m.q):1000,minuten:Number.isFinite(z.minuten)?z.minuten:.5,bron:z.bron||'',ndw:z.m.ndwUsed||null,fallbackQ:sc67Num(z.m.q)===null,fallbackDelay:!Number.isFinite(z.minuten)};
 }
 return {groups:[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key)),diag,sources,first:Number.isFinite(first)?Math.floor(first/F71_DAY)*F71_DAY:null,last:Number.isFinite(last)?Math.floor(last/F71_DAY)*F71_DAY:null,liveDate:sc67Datum()};
}
function f71Exposure(g,a,b){if(b<=a)return 0;const ya=f71Year(a),yb=f71Year(b);return g.cohorts.reduce((sum,c)=>{if(!c.year)return sum+c.n*(b-a)/F71_YEAR;return sum+c.n*Math.log(2)*(Math.pow(Math.max(0,yb-c.year)/c.L,c.beta)-Math.pow(Math.max(0,ya-c.year)/c.L,c.beta));},0);}
function f71Months(from,to){const out=[];for(let t=from;t<to;){const d=new Date(t),end=Math.min(to,Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));out.push({from:t,to:end,label:f71Iso(t).slice(0,7)});t=end;}return out;}
function f71Fingerprint(model){const s=JSON.stringify({model,tarief:kostenBasis().bestuurder,passagier:kostenBasis().passagier,passagiers:kostenBasis().passagiers,vracht:kostenBasis().vracht,vrachtPct:kostenBasis().vrachtPct,prijspeil:kostenBasis().prijspeil});let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return s.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
function f71Defaults(m){const first=m.first??Date.UTC(2025,0,1),last=m.last??Date.UTC(2026,0,1),start=last+F71_DAY,end=new Date(start);end.setUTCFullYear(end.getUTCFullYear()+1);return {from:f71Iso(start),to:f71Iso(end.getTime()-F71_DAY),histFrom:f71Iso(first),histTo:f71Iso(last),runs:500,seed:20260817,mttr:assetTypeMttrUren('MSI'),cv:.75,qMargin:20,delayMargin:50,amStart:7,amEnd:10,pmStart:16,pmEnd:19,weekdays:true,vc:'',includeMemo:false,selected:m.groups.map(g=>g.key)};}
function f71Normal(rng){return Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());}
function f71Gamma(k,rng){if(k<1)return f71Gamma(k+1,rng)*Math.pow(Math.max(1e-12,rng()),1/k);const d=k-1/3,c=1/Math.sqrt(9*d);for(;;){const x=f71Normal(rng),v=Math.pow(1+c*x,3);if(v<=0)continue;const u=Math.max(1e-12,rng());if(u<1-.0331*x*x*x*x||Math.log(u)<x*x/2+d*(1-v+Math.log(v)))return d*v;}}
function f71Validate(c,m){
 const from=Date.parse(c.from+'T00:00:00Z'),to=Date.parse(c.to+'T00:00:00Z')+F71_DAY,hf=Date.parse(c.histFrom+'T00:00:00Z'),ht=Date.parse(c.histTo+'T00:00:00Z')+F71_DAY;
 if(![from,to,hf,ht].every(Number.isFinite)||to<=from||ht<=hf||from<ht||to-from>10.01*F71_YEAR)throw Error('Controleer de datums. Prognose begint na de historische periode en duurt maximaal 10 jaar.');
 if(!Number.isInteger(c.runs)||c.runs<100||c.runs>2000||!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295)throw Error('Kies 100 tot 2.000 runs en een geldige gehele startwaarde.');
 if(!Number.isFinite(c.mttr)||c.mttr<=0||c.mttr>8760||!Number.isFinite(c.cv)||c.cv<0||c.cv>3||![c.qMargin,c.delayMargin].every(x=>Number.isFinite(x)&&x>=0&&x<=100))throw Error('Controleer herstelduur, spreiding en verkeersmarges.');
 if(![c.amStart,c.amEnd,c.pmStart,c.pmEnd].every(Number.isFinite)||c.amStart<0||c.amEnd<c.amStart||c.pmStart<c.amEnd||c.pmEnd<c.pmStart||c.pmEnd>24)throw Error('Kies twee niet-overlappende spitsvensters tussen 0 en 24 uur.');
 const groups=m.groups.filter(g=>c.selected.includes(g.key)&&(!c.vc||g.vc===c.vc));if(!groups.length)throw Error('Selecteer minimaal één wegdeel.');if(!m.diag.matched)throw Error('Laad eerst koppelbare signaalgeverhistorie.');
 const all=m.groups.map(g=>({g,H:f71Exposure(g,hf,ht),n:g.events.filter(e=>e.ms>=hf&&e.ms<ht).length})),totalN=all.reduce((s,x)=>s+x.n,0),totalH=all.filter(x=>x.n>0).reduce((s,x)=>s+x.H,0);if(!(totalH>0&&totalN>0&&Number.isFinite(totalH)))throw Error('In deze historische periode ontbreken bruikbare meldingen of assetblootstelling. Controleer ook levensduur en vormparameter.');
 const pool=totalN/totalH,months=f71Months(from,to),prepared=groups.map(g=>{const h=all.find(x=>x.g.key===g.key);return {g,n:h.n,H:h.H,shape:h.n+5,rate:(h.n>0?h.H:0)+5/pool,monthH:months.map(p=>f71Exposure(g,p.from,p.to)),durations:g.events.filter(e=>e.ms>=hf&&e.ms<ht&&e.hours>0).map(e=>e.hours)};});
 if(prepared.some(x=>!Number.isFinite(x.H)||!x.monthH.every(v=>Number.isFinite(v)&&v>=0)))throw Error('Controleer de levensduur, bouwjaren en vormparameters van de geselecteerde signaalgevers.');
 const estimate=prepared.reduce((s,p)=>s+p.shape/p.rate*p.monthH.reduce((a,b)=>a+b,0),0)*c.runs;if(!Number.isFinite(estimate)||estimate>40000000)throw Error('Deze selectie vraagt circa '+Math.round(estimate/1e6)+' miljoen storingsgebeurtenissen. Kies minder runs, een kortere periode of minder wegdelen.');
 return {from,to,hf,ht,prepared,months,estimate};
}
function f71PeakHours(a,b,c){let total=0;for(let day=Math.floor(a/24);day*24<b;day++){const weekday=new Date(day*F71_DAY).getUTCDay();if(c.weekdays&&(weekday===0||weekday===6))continue;for(const [lo,hi] of [[c.amStart,c.amEnd],[c.pmStart,c.pmEnd]])total+=Math.max(0,Math.min(b,day*24+hi)-Math.max(a,day*24+lo));}return total;}
async function f71Simulate(c,m,tarief,progress=()=>{},cancelled=()=>false){
 const p=f71Validate(c,m);if(!Number.isFinite(tarief)||tarief<0)throw Error('Controleer de kostentarieven.');const rng=tmc70Random(c.seed),total=new Float64Array(c.runs),counts=new Float64Array(c.runs),monthly=p.months.map(()=>new Float64Array(c.runs)),monthEvents=p.months.map(()=>new Float64Array(c.runs)),way=p.prepared.map(()=>new Float64Array(c.runs)),yearKeys=[...new Set(p.months.map(x=>x.label.slice(0,4)))],yearly=yearKeys.map(()=>new Float64Array(c.runs));let processed=0;
 const globalDur=p.prepared.flatMap(x=>x.durations),sigma=Math.sqrt(Math.log(1+c.cv*c.cv)),mu=Math.log(c.mttr)-sigma*sigma/2;
 for(let run=0;run<c.runs;run++){
  if(run%2===0){if(cancelled())throw Error('Simulatie gestopt.');progress(run/c.runs);await new Promise(r=>setTimeout(r,0));}
  for(let gi=0;gi<p.prepared.length;gi++){
   const x=p.prepared[gi],mult=f71Gamma(x.shape,rng)/x.rate,q=tmc70Tri(tmc71Range(x.g.traffic.q,c.qMargin/100),rng()),minutes=tmc70Tri(tmc71Range(x.g.traffic.minuten,c.delayMargin/100),rng()),vvuHour=q*minutes/60;let a=null,b=null,idx=0;
   const add=(start,end)=>{while(idx<p.months.length&&p.months[idx].to/3600000<=start)idx++;let j=idx;while(j<p.months.length&&p.months[j].from/3600000<end){const v=f71PeakHours(Math.max(start,p.months[j].from/3600000),Math.min(end,p.months[j].to/3600000),c)*vvuHour;monthly[j][run]+=v;way[gi][run]+=v;total[run]+=v;j++;}};
   for(let mi=0;mi<p.months.length;mi++){
    const mm=p.months[mi],lo=mm.from/3600000,hi=mm.to/3600000,rate=mult*x.monthH[mi]/(hi-lo);if(!(rate>0))continue;let t=lo;
    for(;;){t+=-Math.log(Math.max(1e-12,rng()))/rate;if(t>=hi)break;counts[run]++;monthEvents[mi][run]++;processed++;if(processed%20000===0){if(cancelled())throw Error('Simulatie gestopt.');await new Promise(r=>setTimeout(r,0));}if(processed>80000000)throw Error('De getrokken aantallen zijn te groot. Verkort de periode of verminder de runs.');
     const durations=x.durations.length>=5?x.durations:globalDur.length>=5?globalDur:null,repair=durations?durations[Math.floor(rng()*durations.length)]:Math.exp(mu+sigma*f71Normal(rng)),end=Math.min(p.to/3600000,t+repair);
     if(a===null){a=t;b=end;}else if(t<=b)b=Math.max(b,end);else{add(a,b);a=t;b=end;}
    }
   }if(a!==null)add(a,b);
  }
  for(let j=0;j<p.months.length;j++)yearly[yearKeys.indexOf(p.months[j].label.slice(0,4))][run]+=monthly[j][run];
 }
 if(cancelled())throw Error('Simulatie gestopt.');progress(1);
 const summary=tmc70Summary(total,tarief),selected={assets:p.prepared.reduce((s,x)=>s+x.g.assets.length,0),years:p.prepared.reduce((s,x)=>s+x.g.cohorts.filter(a=>a.year).reduce((t,a)=>t+a.n,0),0),explicit:p.prepared.reduce((s,x)=>s+x.g.cohorts.filter(a=>!['assettype','standaard','standaard-terugval'].includes(a.source)).reduce((t,a)=>t+a.n,0),0)};return {...summary,events:tmc70Summary(counts,1).vvu,monthly:p.months.map((m,j)=>({label:m.label,...tmc70Summary(monthly[j],tarief),events:tmc70Summary(monthEvents[j],1).vvu})),yearly:yearKeys.map((label,j)=>({label,...tmc70Summary(yearly[j],tarief)})),per:p.prepared.map((x,j)=>({key:x.g.label,assets:x.g.assets.length,historical:x.n,...tmc70Summary(way[j],tarief)})),runs:c.runs,tarief,config:c,source:{diag:m.diag,selected,sources:m.sources,liveDate:m.liveDate,groups:p.prepared.map(x=>({key:x.g.label,cohorts:x.g.cohorts,traffic:x.g.traffic,n:x.n,H:x.H,durations:x.durations.length})),historyAssumption:'Dekking tussen ingestelde begin- en einddatum als volledig aangenomen. Actueel register als historische populatie gebruikt.',durationSource:globalDur.length>=5?'Empirische herstelduren, groeps- of geselecteerde populatie':'Lognormale aanname uit MTTR en spreiding',prijspeil:kostenBasis().prijspeil},fingerprint:f71Fingerprint(m)};
}
function f71Help(){return `<details><summary>Hoe werkt de toekomstprognose voor signaalgevers</summary><p>Alleen operationele MSI-signaalgevers uit het assetregister worden gebruikt. De historische locaties worden op weg, rijrichting en hectometer aan het register gekoppeld, binnen 100 meter. Bij twijfel tussen verkeerscentrales wordt de melding uitgesloten. Identieke locaties met hetzelfde startmoment tellen eenmaal. Het gaat om locatie-episodes, niet om bewezen unieke defecte lampen of individuele assetstoringen.</p><p>Per wegdeel wordt de historische frequentie gekalibreerd op de opgetelde leeftijdsgewichten van de signaalgevers. De macht neemt toe met de ingestelde Weibull-vormparameter. Levensduur komt eerst uit een assetoverride, expliciete EOL of referentie, daarna uit de assettype-instelling. Deze levensduur is een modelschaal, geen harde uitvaldatum. De vormparameter wordt niet uit deze logs geschat. Zonder bouwjaar is het aandeel stationair.</p><p>De frequentie volgt een Gamma-Poisson model met vijf gedeelde pseudo-episodes als groepsprior. Wegdelen zonder gekoppelde historie gebruiken alleen deze gedeelde prior. Ontbrekende historie wordt niet als nul storingen behandeld. Per maand wordt de leeftijdsafhankelijke intensiteit berekend; binnen een maand zijn startmomenten uniform in de tijd. De huidige registerpopulatie wordt ook als historische populatie gebruikt. De ingestelde historische periode wordt als gedekt aangenomen. Uittreding, vervanging en ontbrekende registraties kunnen daarom de kalibratie vertekenen.</p><p>Een herstel zet de leeftijd niet terug. Zonder minimaal vijf bruikbare herstelduren wordt een lognormale herstelduur getrokken uit MTTR en spreiding. De starttoestand is operationeel, open storingen van een oudere bronpeildatum worden niet als nog steeds open aangenomen. Alle assets blijven in bedrijf, zonder geplande vervanging.</p><p>Verkeerskosten ontstaan alleen tijdens de ingestelde spitsvensters zolang een gesimuleerde storing voortduurt. De modeldag telt 24 uur, klokwisselingen worden niet gemodelleerd. Bij overlappende storingen telt de hinder binnen één wegdeel eenmaal. Dezelfde verkeersstroom kan meerdere wegdelen raken. De verkeerswerking is een representatief wegdeelscenario, geen gemeten effect van iedere afzonderlijke signaalgever. Voertuigaantal en extra vertraging worden per wegdeel en run gevarieerd en blijven binnen die run constant. Tarieven blijven vast, zonder inflatie of discontering.</p><p>VVU = voertuigen per uur × overlappende spitsuren × extra minuten / 60. Kosten = VVU × gewogen tarief. Maand-, jaar- en periodetotalen worden binnen elke run opgeteld. Medianen en percentielen uit afzonderlijke regels mogen niet worden opgeteld. De banden zijn scenario-uitkomsten, geen gegarandeerde voorspellingen.</p><p>Methoden, <a href="https://www.itl.nist.gov/div898/handbook/apr/section1/apr172.htm" target="_blank" rel="noopener">NIST power-law model voor herstelbare systemen</a> en <a href="https://www.itl.nist.gov/div898/handbook/apr/section1/apr165.htm" target="_blank" rel="noopener">NIST Gamma-model voor onzekere storingsintensiteit</a>. De verkeersrelatie, priorsterkte en spitsinstellingen zijn modelaannames.</p>${kostenBronHtml()}</details>`;}
function f71Graph(rows){const max=Math.max(...rows.map(x=>x.kosten.p95),1),sx=i=>60+(rows.length===1?0:i/(rows.length-1)*800),sy=v=>220-v/max*180;return `<svg viewBox="0 0 920 280" role="img" aria-label="Maandelijkse kostenprognose, mediaan en middelste 90 procent" style="background:white;width:100%"><text x="60" y="20">${kostenEuro(max)} per maand</text><polygon fill="#cce8f5" points="${rows.map((r,i)=>sx(i)+','+sy(r.kosten.p95)).join(' ')} ${rows.map((r,i)=>[sx(i),sy(r.kosten.p5)]).reverse().map(x=>x.join(',')).join(' ')}"/><polyline fill="none" stroke="#154273" stroke-width="3" points="${rows.map((r,i)=>sx(i)+','+sy(r.kosten.p50)).join(' ')}"/>${rows.map((r,i)=>`<circle cx="${sx(i)}" cy="${sy(r.kosten.p50)}" r="3" fill="#154273"><title>${r.label}, mediaan ${kostenEuro(r.kosten.p50)}, p5 ${kostenEuro(r.kosten.p5)}, p95 ${kostenEuro(r.kosten.p95)}</title></circle>`).join('')}<text x="60" y="255">${rows[0]?.label||''}</text><text x="860" y="255" text-anchor="end">${rows[rows.length-1]?.label||''}</text></svg>`;}
function f71ResultHtml(r,interactive=true){const table=rows=>`<div style="overflow:auto"><table class="tbl"><thead><tr><th>Periode</th><th>VVU mediaan, P50</th><th>Lage kosten, P5</th><th>Lage kosten, P50</th><th>Hoge kosten, P95</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.label?mc72PeriodCaption(x.label,r.config):x.key)}</td><td>${sc67Format(x.vvu.p50)}</td><td>${kostenEuro(x.kosten.p5)}</td><td>${kostenEuro(x.kosten.p50)}</td><td>${kostenEuro(x.kosten.p95)}</td></tr>`).join('')}</tbody></table></div>`;return `<section class="kosten-blok"><h3>Toekomstprognose signaalgevers en verkeerskosten</h3><p>${esc(r.config.from)} tot en met ${esc(r.config.to)}. ${r.per.reduce((s,x)=>s+x.assets,0)} signaalgevers in ${r.per.length} geselecteerde wegdelen. ${r.runs} runs. Historie ${esc(r.config.histFrom)} tot en met ${esc(r.config.histTo)}.</p><p><b>Mediaan ${kostenEuro(r.kosten.p50)} voor de hele periode.</b> Middelste 90 procent ${kostenEuro(r.kosten.p5)} tot ${kostenEuro(r.kosten.p95)}. ${sc67Format(r.vvu.p50)} VVU. Gesimuleerde locatie-episodes, mediaan ${sc67Format(r.events.p50,0)}, band ${sc67Format(r.events.p5,0)} tot ${sc67Format(r.events.p95,0)}.</p><p>Herstelduur, ${esc(r.source.durationSource)}. ${r.source.selected.explicit} van ${r.source.selected.assets} geselecteerde assets hebben een specifiekere levensduur dan de generieke assettype-instelling. ${r.source.selected.years} geselecteerde assets hebben een bouwjaar. Prijspeil ${esc(r.source.prijspeil)}.</p>${mc72Forecast(r,interactive)}<h4>Jaarblokken, alleen de geselecteerde dagen binnen ieder jaar</h4>${table(r.yearly)}<details><summary>Maandblokken</summary>${table(r.monthly)}</details><details><summary>Subtotalen per wegdeel</summary>${table(r.per)}</details><details><summary>Herkomst en aannames</summary><p>${esc(r.source.historyAssumption)}. Exacte locatie en starttijd zijn gebruikt om ${r.source.diag.duplicate} herhaalde regels weg te filteren. ${r.source.diag.unmatched} locaties konden niet eenduidig worden gekoppeld, ${r.source.diag.invalid} regels hadden onvoldoende locatie- of datuminvoer.</p>${r.source.sources.map(s=>`<p>${esc(s.name)}, ${s.from} tot ${s.to}.</p>`).join('')}${r.source.groups.map(g=>`<p><b>${esc(g.key)}</b>. ${g.n} historische episodes. Levensduurcohorten ${g.cohorts.map(c=>esc(c.n+' assets, bouwjaar '+(c.year||'onbekend')+', '+c.L+' jaar, vorm '+c.beta+', '+c.source)).join('; ')}. Voertuigen per uur ${g.traffic.q}, extra minuten ${sc67Format(g.traffic.minuten)}. ${g.traffic.fallbackQ?'Voertuigaantal 1.000 is een aanname. ':''}${g.traffic.fallbackDelay?'Extra vertraging 0,5 minuut is een aanname. ':''}${g.traffic.ndw?'NDW '+esc(g.traffic.ndw.id)+' '+esc(g.traffic.ndw.time)+'. ':''}${esc(g.traffic.bron||'Verkeerskundig effect is een scenarioaanname.')}</p>`).join('')}</details></section>`;}
function f71Open(){
 F71_TOKEN++;const m=f71Build();F71_MODEL=m;const fingerprint=f71Fingerprint(m),saved=kostenBasis().forecastMSI71,same=saved?.fingerprint===fingerprint,c=same?saved.config:f71Defaults(m);F71_SESSION={m,fingerprint};
 let d=document.getElementById('f71Dialog');if(!d){d=document.createElement('dialog');d.id='f71Dialog';d.style.cssText='width:96vw;max-width:1250px;max-height:92vh;overflow:auto;padding:22px;border:2px solid #154273';document.body.appendChild(d);d.addEventListener('close',()=>F71_TOKEN++);}
 const inp=(key,label,type='number')=>`<label style="display:inline-block;margin:8px">${label}<br><input data-f71="${key}" type="${type}" step="any" value="${esc(c[key])}" style="max-width:170px"></label>`;
 d.innerHTML=`<div style="display:flex;justify-content:space-between"><h2>Toekomstprognose, alleen signaalgevers</h2><button onclick="document.getElementById('f71Dialog').close()">Sluiten</button></div><p>${m.diag.assets} actieve signaalgevers, ${m.diag.years} met bouwjaar, ${m.diag.explicit} met specifieke levensduur of EOL. ${m.diag.matched} gekoppelde historische locatie-episodes. ${m.diag.duplicate} herhaalde regels verwijderd. ${m.diag.durations} bruikbare herstelduren.</p><p>Invoer is vooraf ingevuld. Controleer de aangenomen historische dekking, herstelduur en verkeerswerking. Generieke MSI-levensduur en vormparameter stel je in bij Rekenregels. De DRIP-prognose blijft afzonderlijk.</p><div id="f71Inputs">${inp('from','Prognose vanaf','date')}${inp('to','Tot en met','date')}${inp('histFrom','Historie gedekt vanaf','date')}${inp('histTo','Historie gedekt tot en met','date')}${inp('runs','Aantal runs')}${inp('seed','Startwaarde')}${inp('mttr','Gemiddelde herstelduur, uur')}${inp('cv','Relatieve spreiding herstelduur')}${inp('qMargin','Marge voertuigen, procent')}${inp('delayMargin','Marge extra minuten, procent')}${inp('amStart','Ochtendspits vanaf, uur')}${inp('amEnd','Ochtendspits tot, uur')}${inp('pmStart','Avondspits vanaf, uur')}${inp('pmEnd','Avondspits tot, uur')}<p><label><input data-f71="weekdays" type="checkbox" ${c.weekdays?'checked':''}> Alleen spitskosten op maandag tot en met vrijdag</label></p><label>Verkeerscentrale <select data-f71="vc" onchange="f71Filter()"><option value="">Alle</option>${[...new Set(m.groups.map(g=>g.vc))].sort().map(vc=>`<option ${c.vc===vc?'selected':''}>${esc(vc)}</option>`).join('')}</select></label><p><button onclick="f71Select(true)">Alle zichtbare wegdelen aan</button> <button onclick="f71Select(false)">Alle zichtbare wegdelen uit</button></p><details><summary>Selectie en vooringevulde verkeersinvoer per wegdeel</summary><p>Voertuigaantal en extra minuten komen uit jouw opgeslagen verkeersberekening of een NDW-kandidaat. Ontbrekende waarden worden aangevuld met 1.000 voertuigen per uur en 0,5 extra minuut. Je kunt deze twee waarden hieronder per wegdeel aanpassen.</p><div style="overflow:auto"><table class="tbl"><thead><tr><th>Meenemen</th><th>Wegdeel</th><th>Assets</th><th>Historische episodes</th><th>Voertuigen per uur</th><th>Extra minuten</th><th>Verkeersbron</th></tr></thead><tbody>${m.groups.map((g,i)=>{const ov=c.traffic?.[g.key]||g.traffic;return `<tr data-f71-row="${i}" data-vc="${esc(g.vc)}"><td><input type="checkbox" data-f71-selected ${c.selected.includes(g.key)?'checked':''}></td><td>${esc(g.label)}</td><td>${g.assets.length}</td><td>${g.events.length}</td><td><input type="number" min="0" step="any" data-f71-q value="${ov.q}" style="width:90px"></td><td><input type="number" min="0" step="any" data-f71-minutes value="${ov.minuten}" style="width:90px"></td><td>${g.traffic.fallbackQ?'Voertuigaantal aangenomen':g.traffic.ndw?'NDW '+esc(g.traffic.ndw.time)+' kandidaat':'Opgeslagen invoer'}. ${g.traffic.fallbackDelay?'Vertraging aangenomen':'Vertraging uit verkeersmodel'}</td></tr>`;}).join('')}</tbody></table></div></details><p><label><input data-f71="includeMemo" type="checkbox" ${c.includeMemo?'checked':''}> Toon deze prognose ook in kostenmemo’s met dezelfde scope</label></p></div><button id="f71RunButton" onclick="f71Run()">Opslaan en toekomstprognose uitvoeren</button> <button onclick="f71Stop()">Stoppen</button><p id="f71Status" role="status" aria-live="polite"></p><div id="f71Result">${same&&saved.result?f71ResultHtml(saved.result):''}</div>${f71Help()}`;
 d.querySelector('#f71Inputs').addEventListener('input',f71Dirty);if(!d.open)d.showModal();f71Filter();
}
function f71Filter(){const d=document.getElementById('f71Dialog'),vc=d.querySelector('[data-f71="vc"]').value;d.querySelectorAll('[data-f71-row]').forEach(tr=>tr.hidden=!!vc&&tr.dataset.vc!==vc);}
function f71Dirty(){F71_TOKEN++;document.getElementById('f71Result').innerHTML='';document.getElementById('f71RunButton').disabled=false;document.getElementById('f71Status').textContent='Invoer gewijzigd. Voer opnieuw uit.';}
function f71Stop(){f71Dirty();document.getElementById('f71Status').textContent='Simulatie gestopt.';}
function f71Select(on){document.querySelectorAll('#f71Dialog [data-f71-row]').forEach(tr=>{if(!tr.hidden)tr.querySelector('[data-f71-selected]').checked=on;});f71Dirty();}
function f71Read(){const d=document.getElementById('f71Dialog'),c={selected:[],traffic:{}};d.querySelectorAll('[data-f71]').forEach(x=>c[x.dataset.f71]=x.type==='checkbox'?x.checked:x.type==='number'?(x.value===''?NaN:Number(x.value)):x.value);d.querySelectorAll('[data-f71-row]').forEach(tr=>{const g=F71_SESSION.m.groups[Number(tr.dataset.f71Row)],q=tr.querySelector('[data-f71-q]'),min=tr.querySelector('[data-f71-minutes]');c.traffic[g.key]={q:q.value===''?NaN:Number(q.value),minuten:min.value===''?NaN:Number(min.value)};if(tr.querySelector('[data-f71-selected]').checked)c.selected.push(g.key);});return c;}
function f71ApplyTraffic(m,c){return {...m,groups:m.groups.map(g=>{const v=c.traffic?.[g.key];if(!v)return g;if(c.selected.includes(g.key)&&(!c.vc||c.vc===g.vc)&&![v.q,v.minuten].every(x=>Number.isFinite(x)&&x>=0))throw Error('Controleer voertuigen en extra minuten voor '+g.label);const changed=v.q!==g.traffic.q||v.minuten!==g.traffic.minuten;return {...g,traffic:{...g.traffic,...v,bron:changed?'Handmatig aangepast voor de toekomstprognose':g.traffic.bron}};})};}
async function f71Run(){const token=++F71_TOKEN,s=F71_SESSION,status=document.getElementById('f71Status'),button=document.getElementById('f71RunButton');try{
 const c=f71Read(),m=f71ApplyTraffic(s.m,c);f71Validate(c,m);if(s.fingerprint!==f71Fingerprint(f71Build()))throw Error('Bronnen zijn gewijzigd. Sluit en open de prognose opnieuw.');
 const k=kostenBasis();k.forecastMSI71={config:c,fingerprint:s.fingerprint,result:null};RULES.kosten=k;document.getElementById('f71Result').innerHTML='';button.disabled=true;
 const tariff=kostenBereken(k,{vvu:0,periode:'prognose',bron:'scenario'}).tarief,r=await f71Simulate(c,m,tariff,p=>status.textContent='Prognose '+Math.round(p*100)+' procent.',()=>token!==F71_TOKEN);if(token!==F71_TOKEN)return;if(s.fingerprint!==f71Fingerprint(f71Build()))throw Error('Bronnen zijn tijdens de simulatie gewijzigd. Voer opnieuw uit.');r.fingerprint=s.fingerprint;
 const out=kostenBasis();out.forecastMSI71={config:c,fingerprint:s.fingerprint,result:r};RULES.kosten=out;document.getElementById('f71Result').innerHTML=f71ResultHtml(r);status.textContent='Gereed. Invoer en prognose gaan mee in de totaalexport met Parameters. Bewaar ook assetregister en storingshistorie.';
 }catch(e){if(token===F71_TOKEN)status.textContent=e.message;}finally{if(token===F71_TOKEN)button.disabled=false;}}
function f71Memo(bron){const s=kostenBasis().forecastMSI71;if(!bron?.kostenAan||!s?.config?.includeMemo||!s.result||['drip-montecarlo','montecarlo'].includes(bron.type))return '';const requested=bron.scope&&bron.scope!=='landelijk'?normAssetVc(bron.scope):'';if(bron.wegKey||requested!==s.config.vc)return '';if(s.fingerprint!==f71Fingerprint(f71Build()))return '<p>De signaalgeverprognose is verouderd. Voer opnieuw uit voor actuele prognosecijfers.</p>';return f71ResultHtml(s.result,false)+f71Help();}

/* Interactieve presentatie. De simulaties en opgeslagen percentielen blijven ongewijzigd. */
function mc72Explain(){return `<details class="mc72-explain"><summary>Wat betekenen P5, P50 en P95</summary><p>De P geeft de positie aan wanneer alle simulatie-uitkomsten van laag naar hoog zijn gesorteerd. P5 is een lage uitkomst, ongeveer 5 procent ligt daaronder. P50 is de mediaan, de helft ligt lager en de helft hoger. P95 is een hoge uitkomst, ongeveer 5 procent ligt daarboven. P95 is dus niet het maximum. Bij veel gelijke uitkomsten kunnen deze aandelen afwijken.</p><p><b>Deze grafiek toont kosten of voertuigverliesuren, geen beschikbaarheid.</b> Lage kosten en weinig voertuigverliesuren zijn gunstig. Daarom heet P5 hier laag en P95 hoog. Bij een grafiek van beschikbaarheid betekent P95 juist een hoge beschikbaarheid. De betekenis van hoog blijft gelijk, maar wat gunstig is hangt af van de getoonde grootheid.</p><p>Het gekleurde gebied tussen P5 en P95 bevat de middelste 90 procent van de gesimuleerde uitkomsten. Dit is een scenarioband. P50 is niet hetzelfde als het gemiddelde.</p></details>`;}
function mc72Css(){return `<style>.mc72-chart{margin:16px 0;padding:14px;border:1px solid #b8c9d6;border-radius:8px;background:#fff;color:#16334b;break-inside:avoid}.mc72-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:10px 0}.mc72-controls label{font-size:13px;display:block}.mc72-controls select,.mc72-controls button{font:inherit;padding:6px;max-width:100%}.mc72-controls label span{display:block}.mc72-legend{display:flex;flex-wrap:wrap;gap:10px 20px;margin:10px 0;font-size:13px}.mc72-readout{border-left:4px solid #007bc7;background:#eef6fa;padding:12px;min-height:100px}.mc72-values{display:flex;gap:14px 28px;flex-wrap:wrap;margin:8px 0}.mc72-values div{min-width:140px}.mc72-values b{display:block;font-size:18px}.mc72-chart svg{display:block;width:100%;height:auto;max-height:500px;touch-action:pan-y}.mc72-chart svg:focus{outline:2px solid #007bc7;outline-offset:2px}.mc72-note{font-size:13px;line-height:1.5}.mc72-explain{margin:12px 0}.mc72-explain p{line-height:1.5}@media print{.mc72-controls{display:none!important}.mc72-chart{padding:8px;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}.mc72-chart svg{width:100%!important;height:auto!important;max-height:none!important}.mc72-readout{min-height:0}.mc72-explain{font-size:11px}}</style>`;}
function mc72Period(label,config){
 const isYear=/^\d{4}$/.test(label),match=/^(\d{4})-(\d{2})$/.exec(label);if(!isYear&&!match)return {label,days:null,fullDays:null,partial:false};
 const y=Number(isYear?label:match[1]),mo=isYear?0:Number(match[2])-1,lo=Date.UTC(y,mo,1),hi=isYear?Date.UTC(y+1,0,1):Date.UTC(y,mo+1,1),from=Date.parse((config?.from||'')+'T00:00:00Z'),to=Date.parse((config?.to||'')+'T00:00:00Z')+86400000;
 const a=Number.isFinite(from)?Math.max(lo,from):lo,b=Number.isFinite(to)?Math.min(hi,to):hi,days=Math.max(0,Math.round((b-a)/86400000)),fullDays=Math.round((hi-lo)/86400000);
 return {label,days,fullDays,partial:days<fullDays,from:new Date(a).toISOString().slice(0,10),to:new Date(Math.max(a,b-86400000)).toISOString().slice(0,10)};
}
function mc72PeriodCaption(label,config){const p=mc72Period(label,config);return p.partial?label+' · gedeeltelijk, '+p.days+' van '+p.fullDays+' dagen':label;}
function mc72Payload(r){const trim=x=>({label:x.label,kosten:x.kosten,vvu:x.vvu});return {type:'forecast',config:{from:r.config.from,to:r.config.to},monthly:(r.monthly||[]).map(trim),yearly:(r.yearly||[]).map(trim)};}
function mc72Options(p){return p.type==='hist'?{selected:0}:{period:'monthly',metric:'kosten',normal:'total',lo:0,hi:p.monthly.length-1,selected:0,low:true,median:true,high:true,band:true};}
function mc72Number(v,metric){return metric==='kosten'?kostenEuro(v):sc67Format(v)+' VVU';}
function mc72Model(p,o){
 const source=p[o.period]||[],last=source.length-1,lo=Math.max(0,Math.min(last,Number(o.lo)||0)),hi=Math.max(lo,Math.min(last,Number.isFinite(Number(o.hi))?Number(o.hi):last)),metric=o.metric==='vvu'?'vvu':'kosten';
 const rows=source.slice(lo,hi+1).map((r,i)=>{const period=mc72Period(r.label,p.config),divisor=o.normal==='daily'&&period.days>0?period.days:1,v=r[metric];return {index:lo+i,label:r.label,period,raw:v,values:{p5:v.p5/divisor,p50:v.p50/divisor,p95:v.p95/divisor},divisor};});
 const selected=Math.max(lo,Math.min(hi,Number(o.selected)||0));return {rows,source,lo,hi,selected,metric,max:Math.max(1,...rows.map(r=>r.values.p95)),unit:o.normal==='daily'?'per kalenderdag':o.period==='yearly'?'per jaarblok':'per maandblok'};
}
function mc72Details(p,o){
 if(p.type==='hist'){const h=p.hist,i=Math.max(0,Math.min(h.bins.length-1,Number(o.selected)||0)),n=h.bins[i]||0,total=h.bins.reduce((a,b)=>a+b,0),lo=h.min+(h.max-h.min)*i/h.bins.length,hi=h.min+(h.max-h.min)*(i+1)/h.bins.length;return `<b>Kostenklasse ${i+1} van ${h.bins.length}</b><p>${kostenEuro(lo)} tot ${kostenEuro(hi)} per brondag. ${n.toLocaleString('nl-NL')} runs, ${sc67Format(total?n/total*100:0)} procent van alle runs.</p><p>Een balk telt simulaties met kosten binnen deze klasse. De balkhoogte is geen beschikbaarheid.</p>`;}
 const m=mc72Model(p,o),r=m.rows.find(x=>x.index===m.selected);if(!r)return '<p>Geen periodes beschikbaar.</p>';const noun=m.metric==='kosten'?'kosten':'voertuigverliesuren';
 return `<b>${esc(r.label)}. ${esc(r.period.from)} tot en met ${esc(r.period.to)}.</b><p>${r.period.days} kalenderdagen${r.period.partial?' van '+r.period.fullDays+', gedeeltelijke periode':''}. Getoond ${m.unit}.</p><div class="mc72-values"><div>Lage ${noun}, P5<b>${mc72Number(r.values.p5,m.metric)}</b></div><div>Mediaan, P50<b>${mc72Number(r.values.p50,m.metric)}</b></div><div>Hoge ${noun}, P95<b>${mc72Number(r.values.p95,m.metric)}</b></div></div>${o.normal==='daily'?`<p>De opgeslagen periode-uitkomsten zijn gedeeld door ${r.period.days} kalenderdagen, inclusief dagen zonder spitskosten. Dit zijn geen afzonderlijk gesimuleerde dagpercentielen. Periodebedrag mediaan ${mc72Number(r.raw.p50,m.metric)}.</p>`:''}${r.period.partial?'<p>De korte periode verklaart een lager periodetotaal. Dat betekent op zichzelf niet dat de beschikbaarheid verbetert. Gebruik gemiddeld per kalenderdag voor vergelijking van periodes met verschillende lengtes.</p>':''}`;
}
function mc72ForecastSvg(p,o,interactive){
 const m=mc72Model(p,o),rows=m.rows;if(!rows.length)return '<p>Geen prognose beschikbaar.</p>';const W=1000,L=130,R=970,T=35,B=290,sx=i=>rows.length===1?(L+R)/2:L+i/(rows.length-1)*(R-L),sy=v=>B-v/m.max*(B-T),colors={p5:'#237a45',p50:'#154273',p95:'#ba4a00'},active=rows.findIndex(r=>r.index===m.selected),caption='Prognose '+(m.metric==='kosten'?'kosten':'voertuigverliesuren')+' '+m.unit;
 let svg=`<svg viewBox="0 0 ${W} 360" ${interactive?'tabindex="0" onkeydown="mc72Keys(event,this)" onpointermove="mc72Pointer(event,this)" onclick="mc72Pointer(event,this)"':''} role="img" aria-label="${esc(caption)}. Selecteer een periode met de keuzelijst of pijltoetsen."><text x="${L}" y="20" font-size="15">${esc(caption)}</text>`;
 for(let i=0;i<=4;i++){const v=m.max*i/4,y=sy(v);svg+=`<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#d9e3e9"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="12">${esc(m.metric==='kosten'?kostenEuro(v):sc67Format(v,0))}</text>`;}
 if(o.band)svg+=`<polygon fill="#d6e9f4" points="${rows.map((r,i)=>sx(i)+','+sy(r.values.p95)).join(' ')} ${rows.map((r,i)=>sx(i)+','+sy(r.values.p5)).reverse().join(' ')}"/>`;
 for(const [field,flag] of [['p5','low'],['p50','median'],['p95','high']])if(o[flag]){svg+=`<polyline fill="none" stroke="${colors[field]}" stroke-width="${field==='p50'?3:1.8}" ${field==='p50'?'':'stroke-dasharray="5 4"'} points="${rows.map((r,i)=>sx(i)+','+sy(r.values[field])).join(' ')}"/>`;svg+=rows.map((r,i)=>`<circle data-mc72-point="${r.index}" cx="${sx(i)}" cy="${sy(r.values[field])}" r="${r.index===m.selected?5:3}" fill="${colors[field]}"><title>${esc(mc72PeriodCaption(r.label,p.config))}, ${field.toUpperCase()} ${mc72Number(r.values[field],m.metric)} ${m.unit}</title></circle>`).join('');}
 const stride=Math.max(1,Math.ceil(rows.length/7));rows.forEach((r,i)=>{if(i%stride===0||i===rows.length-1)svg+=`<text x="${sx(i)}" y="${B+25+(i===rows.length-1&&i%stride!==0?17:0)}" text-anchor="middle" font-size="12">${esc(r.label)}${r.period.partial?' *':''}</text>`;});
 svg+=`<line data-mc72-cursor x1="${sx(Math.max(0,active))}" x2="${sx(Math.max(0,active))}" y1="${T}" y2="${B}" stroke="#007bc7" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${L}" y="350" font-size="12">* Gedeeltelijke periode. Tik op de grafiek of kies hieronder een periode.</text></svg>`;return svg;
}
function mc72HistSvg(p,o,interactive){const h=p.hist,max=Math.max(...h.bins,1),bw=800/h.bins.length,x=i=>130+i*bw,selected=Number(o.selected)||0,range=h.max-h.min,tx=v=>range>0?130+(v-h.min)/range*800:530;let svg=`<svg viewBox="0 0 1000 350" ${interactive?'tabindex="0" onkeydown="mc72Keys(event,this)" onpointermove="mc72Pointer(event,this)" onclick="mc72Pointer(event,this)"':''} role="img" aria-label="Verdeling van kosten per brondag. Balkhoogte is het aantal runs."><text x="130" y="20">Aantal runs per kostenklasse</text>`;for(let i=0;i<=4;i++){const n=max*i/4,y=270-200*i/4;svg+=`<line x1="130" x2="930" y1="${y}" y2="${y}" stroke="#d9e3e9"/><text x="118" y="${y+4}" text-anchor="end" font-size="12">${Math.round(n)}</text>`;}
 svg+=h.bins.map((n,i)=>`<rect data-mc72-bar="${i}" x="${x(i)}" y="${270-200*n/max}" width="${Math.max(1,bw-2)}" height="${200*n/max}" fill="${i===selected?'#ba4a00':'#007bc7'}"><title>${n} runs. Kosten ${kostenEuro(h.min+range*i/h.bins.length)} tot ${kostenEuro(h.min+range*(i+1)/h.bins.length)}</title></rect>`).join('');
 for(const [k,color,y] of [['p5','#237a45',36],['p50','#154273',50],['p95','#ba4a00',64]]){const v=p.kosten[k];svg+=`<line x1="${tx(v)}" x2="${tx(v)}" y1="70" y2="270" stroke="${color}" stroke-dasharray="4 3" stroke-width="2"/><text x="${tx(v)}" y="${y}" text-anchor="middle" font-size="12" fill="${color}">${k.toUpperCase()} ${kostenEuro(v)}</text>`;}
 return svg+`<text x="130" y="300">${kostenEuro(h.min)}</text><text x="930" y="300" text-anchor="end">${kostenEuro(h.max)}</text><text x="130" y="330">Kosten per brondag. Selecteer een balk om het aantal runs te bekijken.</text></svg>`;
}
function mc72Body(p,o,interactive){
 if(p.type==='hist'){const options=p.hist.bins.map((_,i)=>`<option value="${i}" ${i===Number(o.selected)?'selected':''}>Kostenklasse ${i+1}</option>`).join('');return `<h4>Verdeling van kosten, huidige situatie</h4>${mc72HistSvg(p,o,interactive)}${interactive?`<div class="mc72-controls"><label>Kostenklasse <select data-mc72-option="selected" onchange="mc72Change(this)">${options}</select></label><button onclick="mc72Step(this,-1)">Vorige klasse</button><button onclick="mc72Step(this,1)">Volgende klasse</button></div>`:''}<div class="mc72-legend"><span style="color:#237a45">P5, lage kosten</span><span style="color:#154273">P50, mediaan</span><span style="color:#ba4a00">P95, hoge kosten</span></div><div class="mc72-readout" data-mc72-readout role="status" aria-live="polite">${mc72Details(p,o)}</div>${mc72Explain()}`;}
 const m=mc72Model(p,o);if(!m.rows.length)return '<p>Geen prognoseperiodes beschikbaar.</p>';const select=(key,label,choices,value)=>`<label><span>${label}</span><select data-mc72-option="${key}" onchange="mc72Change(this)">${choices.map(([v,t])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`,indices=m.source.map((r,i)=>[i,r.label]),noun=m.metric==='kosten'?'kosten':'VVU';
 return `${interactive?`<div class="mc72-controls">${select('period','Tijdblokken',[['monthly','Maanden'],['yearly','Jaren']],o.period)}${select('metric','Grootheid',[['kosten','Kosten in euro'],['vvu','Voertuigverliesuren']],o.metric)}${select('normal','Bedrag of verlies',[['total','Totaal in de periode'],['daily','Gemiddeld per kalenderdag']],o.normal)}${select('lo','Vanaf',indices,m.lo)}${select('hi','Tot en met',indices,m.hi)}<button onclick="mc72Reset(this)">Hele periode</button></div>`:''}<div class="mc72-legend">${[['low','Lage '+noun+', P5','#237a45'],['median','Mediaan, P50','#154273'],['high','Hoge '+noun+', P95','#ba4a00'],['band','Middelste 90 procent','#50758e']].map(([k,l,c])=>`<label style="color:${c}">${interactive?`<input type="checkbox" data-mc72-option="${k}" ${o[k]?'checked':''} onchange="mc72Change(this)"> `:''}${l}</label>`).join('')}</div>${mc72ForecastSvg(p,o,interactive)}${interactive?`<div class="mc72-controls">${select('selected','Bekijk periode',m.rows.map(r=>[r.index,mc72PeriodCaption(r.label,p.config)]),m.selected)}<button onclick="mc72Step(this,-1)">Vorige periode</button><button onclick="mc72Step(this,1)">Volgende periode</button></div>`:''}<div class="mc72-readout" data-mc72-readout role="status" aria-live="polite">${mc72Details(p,o)}</div><p class="mc72-note">Elke jaarwaarde komt uit de jaarsommen per run. Jaarpercentielen worden niet berekend door maandpercentielen op te tellen. Inzoomen verandert de simulatie en de tabeltotalen niet.</p>${mc72Explain()}`;
}
function mc72Forecast(r,interactive=true){const p=mc72Payload(r),o=mc72Options(p);return mc72Css()+`<div class="mc72-chart" ${interactive?`data-mc72="forecast" data-payload="${esc(JSON.stringify(p))}" data-options="${esc(JSON.stringify(o))}"`:''}>${mc72Body(p,o,interactive)}</div>`;}
function mc72Histogram(r,interactive=true){const hist=r.hist.max===r.hist.min?{...r.hist,bins:[r.hist.bins.reduce((a,b)=>a+b,0)]}:r.hist,p={type:'hist',hist,kosten:r.kosten},o=mc72Options(p);return mc72Css()+`<div class="mc72-chart" ${interactive?`data-mc72="hist" data-payload="${esc(JSON.stringify(p))}" data-options="${esc(JSON.stringify(o))}"`:''}>${mc72Body(p,o,interactive)}</div>`;}
function mc72Context(el){const root=el.closest('[data-mc72]');return {root,p:JSON.parse(root.dataset.payload),o:JSON.parse(root.dataset.options)};}
function mc72Draw(root,p,o,focus){root.dataset.options=JSON.stringify(o);root.innerHTML=mc72Body(p,o,true);if(focus)root.querySelector('[data-mc72-option="'+focus+'"]')?.focus();}
function mc72Change(el){const {root,p,o}=mc72Context(el),key=el.dataset.mc72Option;o[key]=el.type==='checkbox'?el.checked:['lo','hi','selected'].includes(key)?Number(el.value):el.value;if(key==='period'){o.lo=0;o.hi=(p[o.period]||[]).length-1;o.selected=0;}if(key==='lo'&&o.lo>o.hi)o.hi=o.lo;if(key==='hi'&&o.hi<o.lo)o.lo=o.hi;if(p.type==='forecast'){const m=mc72Model(p,o);o.lo=m.lo;o.hi=m.hi;o.selected=m.selected;}mc72Draw(root,p,o,key);}
function mc72Pick(el,index){const {root,p,o}=mc72Context(el),m=p.type==='forecast'?mc72Model(p,o):{lo:0,hi:p.hist.bins.length-1},i=Math.max(m.lo,Math.min(m.hi,index));if(o.selected===i)return;o.selected=i;root.dataset.options=JSON.stringify(o);const readout=root.querySelector('[data-mc72-readout]');if(readout)readout.innerHTML=mc72Details(p,o);const select=root.querySelector('[data-mc72-option="selected"]');if(select)select.value=String(i);
 if(p.type==='hist')root.querySelectorAll('[data-mc72-bar]').forEach(b=>b.setAttribute('fill',Number(b.dataset.mc72Bar)===i?'#ba4a00':'#007bc7'));
 else{root.querySelectorAll('[data-mc72-point]').forEach(point=>point.setAttribute('r',Number(point.dataset.mc72Point)===i?5:3));const x=m.rows.length===1?550:130+(i-m.lo)/(m.hi-m.lo)*840,line=root.querySelector('[data-mc72-cursor]');if(line){line.setAttribute('x1',x);line.setAttribute('x2',x);}}
}
function mc72Step(el,delta){const {o}=mc72Context(el);mc72Pick(el,Number(o.selected)+delta);}
function mc72Keys(event,el){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const {p,o}=mc72Context(el),m=p.type==='hist'?{lo:0,hi:p.hist.bins.length-1}:mc72Model(p,o);mc72Pick(el,event.key==='Home'?m.lo:event.key==='End'?m.hi:Number(o.selected)+(event.key==='ArrowRight'?1:-1));}
function mc72Pointer(event,svg){if(event.type==='pointermove'&&event.pointerType==='touch')return;const {p,o}=mc72Context(svg),point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const matrix=svg.getScreenCTM();if(!matrix)return;const pos=point.matrixTransform(matrix.inverse());if(pos.y<30||pos.y>290)return;let i;if(p.type==='hist'){if(pos.x<130||pos.x>930)return;i=Math.min(p.hist.bins.length-1,Math.floor((pos.x-130)/800*p.hist.bins.length));}else{if(pos.x<130||pos.x>970)return;const m=mc72Model(p,o);i=m.lo+Math.round((pos.x-130)/840*(m.hi-m.lo));}mc72Pick(svg,i);}
function mc72Reset(el){const {root,p,o}=mc72Context(el);o.lo=0;o.hi=p[o.period].length-1;o.selected=0;mc72Draw(root,p,o,'period');}

function kostenDagRows(){return typeof STATE!=='undefined'&&STATE?.stats?.actueel?[...new Map((STATE.wegdelen||[]).map(w=>[w.key,w])).values()]:[];}


function kostenModelBewaar(el){
 const p=el.closest('[data-model-weg]'),m={};p.querySelectorAll('[data-model]').forEach(x=>m[x.dataset.model]=x.value);
 if(['q','minuten'].some(k=>m[k]===''||!Number.isFinite(Number(m[k]))||Number(m[k])<0)||!m.bron.trim()){alert('Vul geldige verkeerswaarden en een onderbouwing in.');return;}
 const c=kostenBasis();c.modelWegen={...(c.modelWegen||{}),[p.dataset.modelWeg]:m};RULES.kosten=c;
 document.getElementById('kostenDialog').close();kostenSchermVervers();kostenOpenWeg(encodeURIComponent(p.dataset.modelWeg));
}

function kostenDagVervers(){const el=document.getElementById('kostenDagInhoud');if(el){const vc=document.getElementById('kostenDagVc').value;el.innerHTML=kostenDagHtml(kostenDagRows().filter(w=>!vc||(w.vc||'Onbekend')===vc));}}
function kostenDagOpslaan(){
 const dt=new Date(typeof LIVE_PEILDATUM!=='undefined'?LIVE_PEILDATUM:NaN),rows=kostenDagRows();
 if(!rows.length||!Number.isFinite(dt.getTime())){alert('Geen actuele bron met geldige peildatum.');return;}
 const berekend=rows.map(kostenDagResultaat).filter(z=>z.kosten!==null);if(!berekend.length){alert('Geen berekenbare wegdeelscenario’s. Vul eerst verkeerswaarden en een bron in.');return;}
 const dag=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(dt),c=kostenBasis();c.dagstanden={...(c.dagstanden||{})};
 if(c.dagstanden[dag]&&!confirm('Dagstand '+dag+' bestaat. Vervangen door huidige berekening?'))return;
 c.dagstanden[dag]={prijspeil:c.prijspeil,opgeslagen:new Date().toISOString(),totaalWegdelen:rows.length,rows:berekend.map(z=>({...z,wd:{key:z.wd.key,vc:z.wd.vc}}))};RULES.kosten=c;alert('Dagscenario '+dag+' opgeslagen met '+berekend.length+' van '+rows.length+' berekenbare wegdelen. Bewaar met totaalexport.');
}
function kostenHistorieGroepen(vc,mode){
 const groups={};Object.entries(kostenBasis().dagstanden||{}).sort().forEach(([dag,s])=>{
 const rows=(s.rows||[]).filter(z=>(!vc||(z.wd?.vc||'Onbekend')===vc)&&z.kosten!==null);if(!rows.length)return;
 let label=dag;if(mode==='maand')label=dag.slice(0,7);if(mode==='week'){const d=new Date(dag+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));label=d.toISOString().slice(0,10);}
 const signature=JSON.stringify(rows.map(z=>[z.wd.key,z.model||'legacy',z.m||{},z.tarief,!!z.route]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));let hash=2166136261;for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619)>>>0;const scenario=hash.toString(16);const key=label+' / '+s.prijspeil+' / '+scenario,g=groups[key]||(groups[key]={label:label+' ['+scenario+']',prijspeil:s.prijspeil,totaal:0,n:0});g.totaal+=rows.reduce((a,z)=>a+z.kosten,0);g.n++;
 });return Object.values(groups).map(g=>({...g,gemiddelde:g.totaal/g.n}));
}
function kostenHistorieOpen(){
 let d=document.getElementById('kostenHistorie');if(!d){d=document.createElement('dialog');d.id='kostenHistorie';d.style.cssText='width:90%;max-width:1100px;max-height:90vh;overflow:auto';document.body.appendChild(d);}
 const vcs=[...new Set(Object.values(kostenBasis().dagstanden||{}).flatMap(s=>s.rows.map(z=>z.wd.vc||'Onbekend')))].sort();
 d.innerHTML=`<button onclick="this.closest('dialog').close()">Sluiten</button><h2>Historische geschatte dagkosten</h2><select id="kostenHistVc" onchange="kostenHistorieTeken()"><option value="">Alle verkeerscentrales</option>${vcs.map(v=>`<option>${esc(v)}</option>`).join('')}</select> <select id="kostenHistMode" onchange="kostenHistorieTeken()"><option value="dag">Dag</option><option value="week">Week: gemiddelde per beschikbare dag</option><option value="maand">Maand: gemiddelde per beschikbare dag</option></select><div id="kostenHistGrafiek"></div><p>Alleen volledig berekenbare opgeslagen dagstanden tellen mee. Ontbrekende dagen zijn geen nul. Week begint maandag; gemiddelden zijn geen volledige week- of maandramingen. Prijspeilen en scenario-instellingen worden apart gehouden. De code achter de datum onderscheidt de scenario’s.</p>`;
 d.querySelector('#kostenHistVc').value=document.getElementById('kostenDagVc')?.value||'';d.showModal();kostenHistorieTeken();
}
function kostenHistorieTeken(){
 const data=kostenHistorieGroepen(document.getElementById('kostenHistVc').value,document.getElementById('kostenHistMode').value),max=Math.max(1,...data.map(g=>g.gemiddelde)),n=data.length;
 document.getElementById('kostenHistGrafiek').innerHTML=!n?'<p>Nog geen volledig berekenbare dagstanden voor deze selectie.</p>':`<svg viewBox="0 0 1000 300" role="img" aria-label="Geschatte gemiddelde euro per dag"><text x="10" y="20">${esc(kostenEuro(max))} / dag</text>${data.map((g,i)=>`<rect x="${50+i*930/n}" y="${260-g.gemiddelde/max*220}" width="${Math.max(1,850/n)}" height="${g.gemiddelde/max*220}" fill="#167da5"><title>${g.label}: ${kostenEuro(g.gemiddelde)}/dag, ${g.n} dagstanden, prijspeil ${g.prijspeil}</title></rect>`).join('')}<text x="50" y="290">${data[0].label}</text><text x="850" y="290">${data[n-1].label}</text></svg><table class="tbl"><tr><th>Dag / periodebegin</th><th>Gemiddelde €/dag</th><th>Beschikbare dagen</th><th>Prijspeil</th></tr>${data.map(g=>`<tr><td>${g.label}</td><td>${kostenEuro(g.gemiddelde)}</td><td>${g.n}</td><td>${esc(g.prijspeil)}</td></tr>`).join('')}</table>`;
}
function kostenBasis(){
  const c=RULES.kosten||{};
  return {bestuurder:10.42,passagier:8.34,passagiers:0.25,vracht:63.10,vrachtPct:10,prijspeil:2022,...c,records:c.records||{}};
}
function kostenEuro(v){return (Math.round((v+Number.EPSILON*8*Math.max(1,Math.abs(v)))*100)/100).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});}
const KOSTEN_BEGELEID={};
function kostenBegeleidToggle(type,aan){
  KOSTEN_BEGELEID[type]=aan;
  const el=document.getElementById(type==='drip-montecarlo'?'mcBegeleidDrip':'mcBegeleidAlgemeen');
  if(el)el.outerHTML=monteCarloBegeleidendSchrijvenKaart(type);
}

function kostenWegCel(wd){
 const z=kostenDagResultaat(wd),ndw=z.m.ndwUsed;
 return `<b>${z.kosten==null?'Niet berekenbaar':kostenEuro(z.kosten)+' / dag'}</b>${ndw?`<br>NDW ${sc67Format(z.m.q,0)} vtg/u<br>${ndw.confirmed?'Locatie bevestigd':'Kandidaat, controle nodig'}`:''}<br><button onclick="kostenOpenWeg('${encodeURIComponent(wd.key).replace(/'/g,'%27')}')">VVU en kosten wijzigen</button>`;
}

function kostenWegTotaalHtml(rows){
  return kostenDagHtml(rows);
}
function kostenMemoHtml(bron){
  if(!bron||!bron.kostenAan)return '';
  if(bron.type==='drip-montecarlo'||bron.type==='montecarlo')return `<section class="kosten-blok"><h3>Geen kostenprognose berekend</h3><p>De Monte Carlo simuleert assetstoringen en beschikbaarheid. Zonder verkeersintensiteit en een gevalideerd verkeerskundig effectscenario worden daar geen VVU of eurobedragen uit afgeleid.</p>${kostenBronHtml()}</section>`;
  let rows=(typeof STATE!=='undefined'&&STATE&&STATE.wegdelen)||[];
  if(bron.scope&&bron.scope!=='landelijk')rows=rows.filter(w=>normAssetVc(w.vc)===bron.scope);
  if(bron.wegKey)rows=rows.filter(w=>w.key===bron.wegKey);
  return `<section class="kosten-blok">${kostenWegTotaalHtml(rows)}${sc67MemoAannames(rows)}${tmc70Memo(bron)}${f71Memo(bron)}${kostenBronHtml()}</section>`;
}
function kostenSchermVervers(){
  kostenDagVervers();
  if(document.getElementById('fVc')&&document.getElementById('wegtabelHost')&&typeof STATE!=='undefined'&&STATE)tekenWegtabel();
}
function kostenSchoneKopie(el){
  const kopie=el.cloneNode(true);
  kopie.querySelectorAll('.kosten-invoer').forEach(x=>x.remove());
  kopie.querySelectorAll('.kosten-blok a').forEach(a=>{a.appendChild(document.createTextNode(' ('+a.href+')'));});
  return kopie;
}
function kostenOpenWeg(key){
  let d=document.getElementById('kostenDialog');
  if(!d){d=document.createElement('dialog');d.id='kostenDialog';d.style.cssText='max-width:850px;width:90%;max-height:85vh;overflow:auto';document.body.appendChild(d);}
  const weg=decodeURIComponent(key);
  const w=kostenDagRows().find(x=>x.key===weg);
  d.innerHTML='<button onclick="this.closest(\'dialog\').close()">Sluiten</button><h2>'+esc(weg)+'</h2>'+(w?kostenModelEditor(w):'<p>Geen actueel wegdeel gevonden.</p>');d.showModal();
}
function kostenBereken(c,r){
  const n=v=>v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
  const auto=n(c.bestuurder),pas=n(c.passagier),bezet=n(c.passagiers),vracht=n(c.vracht),mix=n(c.vrachtPct);
  if([auto,pas,bezet,vracht,mix].some(x=>x==null)||mix>100)return {fout:'Controleer tarieven en vrachtpercentage.'};
  const autoTarief=auto+pas*bezet,tarief=autoTarief*(1-mix/100)+vracht*mix/100;
  let vvu=null;
  if(r.mode==='verkeer'){
    const waarden=[r.intensiteit,r.uren,r.minuten].map(n);
    if(waarden.every(x=>x!==null))vvu=waarden[0]*waarden[1]*waarden[2]/60;
  }else vvu=n(r.vvu);
  const compleet=vvu!==null&&!!String(r.periode||'').trim()&&!!String(r.bron||'').trim();
  return {autoTarief,tarief,vvu,kosten:compleet?vvu*tarief:null};
}

function kostenBronHtml(){return '<p class="muted">Bronnen methode: <a href="https://www.rwseconomie.nl/vraag-en-antwoord/veelgestelde-vragen-see/wat-kost-een-file" target="_blank" rel="noopener">RWS, kosten van files</a> en <a href="https://www.kimnet.nl/documenten/2023/12/04/nieuwe-waarderingskengetallen-voor-reistijd-betrouwbaarheid-en-comfort" target="_blank" rel="noopener">KiM, waarderingskengetallen, december 2023</a>. De starttarieven zijn overgenomen uit de aangeleverde uitgangspunten. Exacte tariefwaarden, waaronder de passagierswaarde, zijn nog niet onafhankelijk bevestigd. De verkeersmix en bezetting zijn aannames, geen landelijke standaard. Bij gewijzigde tarieven moet de gebruiker prijspeil en onderbouwing controleren.</p>';}



function kostenTariefBewaar(el){
  const c=kostenBasis(),v=Number(el.value),k=el.dataset.kostTarief;
  if(el.value===''||!Number.isFinite(v)||v<0||(k==='vrachtPct'&&v>100)){el.value=c[k];return;}
  c[k]=v;RULES.kosten=c;
  kostenSchermVervers();
}
function kostenInstellingenHtml(){
  const c=kostenBasis();
  const velden=[['bestuurder','Bestuurder euro per persoonuur'],['passagier','Passagier euro per persoonuur'],['passagiers','Extra passagiers per auto'],['vracht','Vracht euro per voertuiguur'],['vrachtPct','Aandeel vracht in VVU, procent'],['prijspeil','Prijspeil tarieven']];
  return `<div class="card"><h3>Kostenmodule, reistijdwaardering</h3><p>Deze tarieven waarderen bekende VVU. Ze bepalen niet hoeveel verkeersvertraging een assetstoring veroorzaakt. Zonder verkeersinvoer blijft de uitkomst niet berekenbaar.</p>${velden.map(([k,l])=>`<label style="display:inline-block;margin:8px">${l}<br><input type="number" min="0" step="any" value="${c[k]}" data-kost-tarief="${k}" onchange="kostenTariefBewaar(this)"></label>`).join('')}<p>Ter referentie uit de aangeleverde tabel: woon-werk 10,78; zakelijk 21,20; overig 9,60 euro per bestuurdersuur. Tarieven zijn niet geïndexeerd naar het huidige jaar.</p>${v68KostenInstellingenExtra()}${kostenBronHtml()}</div>`;
}

/* Versie 72. Betrouwbaarheidslaag voor landelijke KPI's en brondekking. */
const V68_TYPES=['MSI','CAM','LUS','DRIP','WISSELBORD','COMM'];
const V68_LABEL={MSI:'Signalering',CAM:'Camera',LUS:'Detectie',DRIP:'DRIP',WISSELBORD:'Wisselbord',COMM:'Communicatie'};
function v68DekkingCfg(){RULES.cfg.liveDekking=RULES.cfg.liveDekking||{};return RULES.cfg.liveDekking;}
function v68Assets(){return (ASSET_REGISTER_STATE?.assets||[]).filter(a=>a.prognoseActief!==false);}
function v68LiveBronnenVoorType(tp){
  const out=[];
  for(const bron of LIVE_STORINGSBRONNEN||[]){
    const heeft=(bron.rijen||[]).some(raw=>{try{return classificeer(normRij(raw))===tp;}catch(error){return false;}});
    if(!heeft)continue;
    const basisNamen=Array.isArray(bron.bronNamen)?bron.bronNamen.filter(Boolean):[];
    out.push({naam:basisNamen.length?basisNamen.join(' + '):(bron.naam||bron.name||bron.key||'Open-storingenbron'),afgeleidVan:bron.afgeleidVan||'',peildatum:bron.peildatum||null});
  }
  return out;
}
/* Hoeveel open meldingen staan er per assettype in de actuele bronnen, los van de
   vraag of ze doorgerekend konden worden. doorrekenen() laat een melding vallen
   zonder locatie of zonder passende foutregel; zulke meldingen zijn wel zichtbaar
   in Open storingen. Zonder deze telling meldt de brondekking nul open meldingen
   terwijl de storingslijst ze toont. */
function v68BronRijenPerType(){
  const uit={};V68_TYPES.forEach(tp=>{uit[tp]=0;});
  let rijen=[];try{rijen=gecombineerdeLiveStoringsRijen();}catch(error){return uit;}
  for(const raw of rijen){
    let tp='';try{tp=classificeer(normRij(raw))||'';}catch(error){continue;}
    if(uit[tp]!=null)uit[tp]++;
  }
  return uit;
}
function v68TypeStatus(){
  const cfg=v68DekkingCfg(),assets=v68Assets(),meldingen=STATE?.meldingen||[],bronRijen=v68BronRijenPerType(),uit={};
  V68_TYPES.forEach(tp=>{
    const virtueel=tp==='COMM',n=virtueel?1:assets.filter(a=>a.tp===tp).length,events=meldingen.filter(m=>m.typeId===tp),bronnen=v68LiveBronnenVoorType(tp);
    const bewaard=(STATE?.nietDoorgerekend||[]).filter(m=>m.typeId===tp).length;
    const inBron=Math.max(Number(bronRijen[tp])||0,events.length+bewaard);
    /* Een melding die wel in de bron staat maar niet is doorgerekend, telt niet mee
       in het verlies. Het berekende percentage is daardoor optimistisch (te hoog);
       het gat blijft zichtbaar in de tabel. Zie de blindeMeldingen-uitleg hieronder
       voor het geval waarin er niets doorgerekend is. */
    const nietDoorgerekend=Math.max(0,inBron-events.length);
    const aangeleverd=inBron>0||events.length>0;
    const compleet=cfg[tp]===true;
    const availLoss=events.reduce((s,m)=>s+(Number(m.trace?.bijdrageAvail)||0),0),perfLoss=events.reduce((s,m)=>s+(Number(m.trace?.bijdragePerf)||0),0),uren=STATE?.stats?.periodeUren||24;
    const basis=n*uren;
    const afgeleid=bronnen.some(b=>b.afgeleidVan==='dripHistorie');
    const doorgerekend=nietDoorgerekend===0;
    /* Staan er wel open meldingen in de bron maar is er niet één doorgerekend, dan
       is het berekende verlies nul en zou de dienst 100% beschikbaar lijken terwijl
       niemand weet wat die meldingen doen. Zo'n type is onbekend, niet volledig;
       we geven het als band door. Zijn er wél doorgerekende meldingen (bijvoorbeeld
       435 van 657), dan is het verlies daaruit een bruikbare, zij het optimistische,
       waarde. Die gebruiken we, met het gat zichtbaar in de tabel. Alleen een gat
       zonder enige doorgerekende melding mag de doorrekening laten vervallen. */
    const blindeMeldingen=events.length===0&&inBron>0;
    const status=blindeMeldingen
      ? `${inBron.toLocaleString('nl-NL')} open ${inBron===1?'melding':'meldingen'} in de bron, niet doorgerekend (controleer locatie, koppeling en foutregel); beschikbaarheid onbekend`
      : nietDoorgerekend>0
        ? `${inBron.toLocaleString('nl-NL')} open meldingen in de bron, waarvan ${nietDoorgerekend.toLocaleString('nl-NL')} niet doorgerekend (controleer locatie, koppeling en foutregel)`
        : compleet
          ? (aangeleverd?(afgeleid?'actueel uit DRIP-historie':'actueel gemeten'):'volledige bron, geen open storing')
          : (aangeleverd?(afgeleid?'uit DRIP-historie, nog te bevestigen':'actueel aangeleverd, volledigheid niet bevestigd'):'niet aangeleverd');
    uit[tp]={tp,n,events:events.length,inBron,nietDoorgerekend,doorgerekend,blindeMeldingen,aangeleverd,compleet,bronnen,afgeleid,status,
      besch:compleet&&basis&&!blindeMeldingen?Math.max(0,Math.min(100,100-availLoss/basis*100)):null,
      prestatie:compleet&&basis&&!blindeMeldingen?Math.max(0,Math.min(100,100-perfLoss/basis*100)):null,
      availLoss,perfLoss};
  });return uit;
}
function v68ObjType(obj){return obj==='communicatie'?'COMM':OBJ_BRON[obj];}
function v68Subproces(sp,typen){
  const deps=Object.entries(sp.afh||{}).filter(([,w])=>Number(w)>0),som=deps.reduce((s,[,w])=>s+Number(w),0)||1;
  let loB=0,hiB=0,loP=0,hiP=0,bekend=0;
  const bronnen=deps.map(([obj,w0])=>{const w=Number(w0)/som,tp=v68ObjType(obj),b=typen[tp];if(b?.compleet&&b.besch!=null){loB+=w*b.besch;hiB+=w*b.besch;loP+=w*b.prestatie;hiP+=w*b.prestatie;bekend+=w;}else{hiB+=w*100;hiP+=w*100;}return {obj,tp,w,status:b?.status||'niet gemodelleerd'};});
  return {naam:sp.naam,gewicht:Number(sp.gewicht)||0,loB,hiB,loP,hiP,bekend,exact:bekend>.999999,bronnen};
}
function v68Dienst(d,typen){
  /* Een nog niet genormaliseerd aandeel telt als 1, gelijk aan
     normaliseerSubprocesAandelen en dienstWaardeUitSubprocessen. Zo leveren de
     twee dienstpaden dezelfde uitkomst en kan een ontbrekend gewicht nooit stil
     tot nul wegingen en een lege dienstwaarde leiden. */
  const aandeel=sp=>Math.max(0,Number(sp.gewicht==null?1:sp.gewicht)||0);
  const subs=SUBPROCESSEN[d.id]||[],som=subs.reduce((s,x)=>s+aandeel(x),0)||1;let loB=0,hiB=0,loP=0,hiP=0,dekking=0;
  const detail=subs.map(sp=>{const r=v68Subproces(sp,typen),w=aandeel(sp)/som;loB+=w*r.loB;hiB+=w*r.hiB;loP+=w*r.loP;hiP+=w*r.hiP;dekking+=w*r.bekend;return {...r,w};});
  const exact=dekking>.999999;return {d,exact,besch:exact?loB:null,prestatie:exact?loP:null,loB,hiB,loP,hiP,dekking,detail};
}
function v68LandelijkModel(){const typen=v68TypeStatus();return {typen,diensten:DIENSTEN.map(d=>v68Dienst(d,typen)),assets:v68Assets().length};}
function v68Pct(v){return v==null?'Onbekend':fmt(v,2)+'%';}
function v68Bereik(r){return r.exact?v68Pct(r.besch):`${fmt(r.loB,2)} tot ${fmt(r.hiB,2)}%`;}
function v68DekkingBewaar(el){const cfg=v68DekkingCfg();cfg[el.dataset.v68Type]=el.checked;ANALYSE_SIGNATURE='';probeerAnalyseActiveren('overzicht');}
function v68NietDoorgerekendHtml(){
  const rows=STATE?.nietDoorgerekend||[];
  if(!rows.length)return '';
  return `<div class="card"><h3>${rows.length} open meldingen niet doorgerekend</h3><p>Deze meldingen tellen mee als open storing. Zonder passende foutregel of geldige koppeling is hun impact onbekend. De overige detailberekeningen bevatten alleen het doorgerekende deel.</p><details><summary>Bronmeldingen en reden bekijken</summary><table class="tbl"><thead><tr><th>Asset of bronlocatie</th><th>Bron</th><th>Reden</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${esc(m.assetNaam||m.osid||'Onbekend')}</td><td>${esc(m.bron||m.bronBestand||'')}</td><td>${esc(m.rekenStatus)}</td></tr>`).join('')}</tbody></table></details></div>`;
}
function v68BronnenHtml(model){return `<div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Assetbron</th><th class="num">Actief areaal</th><th class="num">Open meldingen</th><th>Status en herkomst</th><th>Bevestiging</th></tr></thead><tbody>${V68_TYPES.map(tp=>{const b=model.typen[tp],bronTekst=(b.bronnen||[]).map(x=>x.naam+(x.afgeleidVan==='dripHistorie'?' · actuele selectie afgeleid uit DRIP-historie':'')).join(' + ');return `<tr><td><b>${V68_LABEL[tp]}</b></td><td class="num">${b.n.toLocaleString('nl-NL')}</td><td class="num">${b.inBron.toLocaleString('nl-NL')}${b.nietDoorgerekend?`<br><small>${b.events.toLocaleString('nl-NL')} doorgerekend</small>`:''}</td><td>${esc(b.status)}${bronTekst?`<br><small>${esc(bronTekst)}</small>`:''}</td><td><label><input type="checkbox" data-v68-type="${tp}" ${b.compleet?'checked':''} onchange="v68DekkingBewaar(this)"> Volledige actuele storingsbron voor dit areaal</label></td></tr>`;}).join('')}</tbody></table></div>`;}
function v68LandelijkHtml(){
 const m=v68LandelijkModel(),gekoppeld=STATE?.stats?.assetGekoppeld||0,toegepast=STATE?.stats?.toegepast||0;
 return v68NietDoorgerekendHtml()+`<div class="card" style="border-left:5px solid var(--rws-blauw)"><h3>Landelijke beschikbaarheid over het volledige assetregister</h3><p>Dit blok gebruikt alle ${m.assets.toLocaleString('nl-NL')} actieve DVM-assets in het geladen register als areaalbasis. De tabellen verderop tonen de geraakte wegdelen. Een exact landelijk dienstpercentage verschijnt alleen als alle benodigde actuele storingsbronnen als volledig zijn bevestigd.</p><div class="grid4">${m.diensten.map(r=>`<div class="kpi"><div class="k-val" style="font-size:${r.exact?'25px':'17px'}">${v68Bereik(r)}</div><div class="k-lab">${r.d.naam.replace(/&amp;/g,'&')}<br>brondekking ${fmt(r.dekking*100,1)}%</div></div>`).join('')}</div><p>${gekoppeld} van ${toegepast} doorgerekende meldingen zijn gekoppeld aan een specifiek asset. Een brede band betekent dat één of meer benodigde bronnen onbekend zijn. De ondergrens veronderstelt 0% voor onbekende bronnen, de bovengrens 100%. Deze band is een databand, geen statistische onzekerheidsmarge.</p><details><summary>Brondekking bekijken en bevestigen</summary>${v68BronnenHtml(m)}<p>Vink alleen volledig aan wanneer de bron voor het volledige bedoelde areaal en de getoonde peildatum alle open storingen bevat. De bevestigingen gaan mee in parameterexport en totaalexport.</p></details></div>`;
}
function v68MemoKader(bron){
 if(!STATE||!bron||bron.type==='montecarlo'||bron.type==='drip-montecarlo')return '';
 const m=v68LandelijkModel(),onbekend=V68_TYPES.filter(tp=>!m.typen[tp].compleet),open=V68_TYPES.filter(tp=>m.typen[tp].nietDoorgerekend>0);
 return `<h3>Datadekking en landelijke duiding</h3><p>De landelijke noemer bestaat uit ${m.assets.toLocaleString('nl-NL')} actieve DVM-assets in het geladen register. ${open.length?`Voor ${open.map(tp=>`${V68_LABEL[tp]} (${m.typen[tp].nietDoorgerekend})`).join(', ')} staan open meldingen in de bron die niet konden worden doorgerekend; die tellen niet mee in het verlies. ` : ''}${onbekend.length?`Voor ${onbekend.map(tp=>V68_LABEL[tp]).join(', ')} is de volledigheid van de actuele storingsbron niet bevestigd. Dienstpercentages zijn daarom als databand weergegeven en niet als exact landelijk percentage.`:'Alle benodigde actuele storingsbronnen zijn als volledig bevestigd; de landelijke dienstpercentages kunnen exact worden berekend.'}</p><table class="tbl"><thead><tr><th>Dienstverlening</th><th>Landelijke beschikbaarheid</th><th>Brondekking</th></tr></thead><tbody>${m.diensten.map(r=>`<tr><td>${esc(r.d.naam.replace(/&amp;/g,'&'))}</td><td>${v68Bereik(r)}</td><td>${fmt(r.dekking*100,1)}%</td></tr>`).join('')}</tbody></table><p>Een band is een databand: onbekende bronnen tellen in de ondergrens als 0% en in de bovengrens als 100%. Het is geen statistisch betrouwbaarheidsinterval.</p>`;
}
function v68KostenStatus(c){if(!sc67Valid(c)||!String(c.bron||'').trim())return 'niet_berekenbaar';return c.ndwUsed?'scenario':c.status==='onderbouwd'?'onderbouwd':'scenario';}
function v68MigreerKosten(c){
  const uit=c?{...c,records:{...(c.records||{})}}:{};
  if(uit.ndw69Snapshot)ndw69ValidateData(uit.ndw69Snapshot);
  const s=uit.scenario67||{};
  if(Number(s.q)===1000&&Number(s.uren)===2&&Number(s.km)===2&&Number(s.snelheid)===100&&Number(s.reductie)===20&&String(s.bron||'').toLowerCase().includes('voorbeeldscenario'))uit.scenario67={...s,q:'',uren:'',reductie:'',bron:'',status:'scenario'};
  Object.entries(uit.scenarioWegen67||{}).forEach(([k,v])=>{if(Number(v.q)===1000&&Number(v.uren)===2&&Number(v.reductie)===20&&String(v.bron||'').toLowerCase().includes('voorbeeldscenario'))uit.scenarioWegen67[k]={...v,q:'',uren:'',reductie:'',bron:'',status:'scenario'};});
  return uit;
}
function v68KostenStatusLabel(s){return s==='onderbouwd'?'Onderbouwd':s==='scenario'?'Scenario':'Niet berekenbaar';}
function v68OverlapBevestigd(){return kostenBasis().overlapBevestigd===true;}
function v68OverlapBewaar(el){const c=kostenBasis();c.overlapBevestigd=el.checked;RULES.kosten=c;kostenSchermVervers();}
function v68KostenInstellingenExtra(){return `<p><label><input type="checkbox" ${v68OverlapBevestigd()?'checked':''} onchange="v68OverlapBewaar(this)"> Overlap tussen getroffen verkeersstromen is gecontroleerd en gecorrigeerd</label></p><p>Zonder deze bevestiging blijft het landelijke bedrag een optelsom van wegdeelscenario’s en geen landelijk kostentotaal.</p>`;}

function ndw69Mode(el){const root=el.closest('[data-sc67-key]');root.querySelectorAll('[data-delay-fields]').forEach(x=>x.hidden=x.dataset.delayFields!==el.value);}
const NDW69_DATA={"schema": 1, "publication": "1970-01-01T00:00:00Z", "configurationPublication": "", "files": [], "sha256": [], "stats": {}, "sites": []};
/* NDW 69. Read-only snapshot, auditable candidate matching and cost provenance. */
const NDW69_INDEX=new WeakMap();
function ndw69Data(){return RULES.kosten?.ndw69Snapshot||NDW69_DATA;}
function ndw69Index(){
 const d=ndw69Data();if(NDW69_INDEX.has(d))return NDW69_INDEX.get(d);
 const byRoad=new Map(),byId=new Map();
 for(const s of d.sites){byId.set(s.id,s);if(s.road&&s.direction&&s.hm!=null){const k=s.road+'|'+s.direction;if(!byRoad.has(k))byRoad.set(k,[]);byRoad.get(k).push(s);}}
 const index={byRoad,byId};NDW69_INDEX.set(d,index);return index;
}
function ndw69ExportKosten(){return {...kostenBasis(),ndw69Snapshot:ndw69Data()};}
function ndw69ValidateData(d){
 if(d?.schema!==1||!Array.isArray(d.sites)||!Array.isArray(d.files)||!Array.isArray(d.sha256)||!d.stats||!Number.isFinite(Date.parse(d.publication)))throw Error('NDW-momentopname heeft een ongeldig formaat.');
 const ids=new Set();for(const s of d.sites){
  if(typeof s.id!=='string'||ids.has(s.id)||!Array.isArray(s.lanes)||!Array.isArray(s.issues)||!Number.isFinite(Date.parse(s.time)))throw Error('NDW-meetlocatie heeft ongeldige of dubbele identificatie.');ids.add(s.id);
  if(s.q!==null&&(!Number.isFinite(s.q)||s.q<0||!s.lanes.length||s.issues.length||s.lanes.some(l=>!Number.isFinite(l.q)||l.q<0)||Math.abs(s.q-s.lanes.reduce((a,l)=>a+l.q,0))>.001))throw Error('NDW-voertuigtotaal komt niet overeen met de geldige rijstroken.');
 }
 return d;
}
const NDW69_MATCHES=new WeakMap();
function ndw69Road(x){return String(x||'').toUpperCase().replace(/^[AN]0*/,'').replace(/^0+/,'');}
function ndw69Direction(x){const s=String(x||'').toUpperCase();return s==='R'?'RE':s==='L'?'LI':s;}
function ndw69Date(t){if(!t)return 'onbekend';return new Date(t).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function ndw69Day(t){if(!t||!Number.isFinite(new Date(t).getTime()))return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));}
function ndw69Mismatch(){return ndw69Day(STATE?.peildatum)!==ndw69Day(ndw69Data().publication);}
function ndw69Candidates(w){
 if(!w)return [];const data=ndw69Data(),cached=NDW69_MATCHES.get(w);if(cached?.data===data)return cached.out;
 // Use exactly the representative most severe fault that drives the existing cost scenario.
 const m=[...(w.meldingen||[])].sort((a,b)=>(Number(b.avail)||0)-(Number(a.avail)||0)||((a.hm??Infinity)-(b.hm??Infinity)))[0];
 if(!m||m.hm==null||!Number.isFinite(Number(m.hm))){NDW69_MATCHES.set(w,{data,out:[]});return [];}
 const pool=ndw69Index().byRoad.get(ndw69Road(w.weg)+'|'+ndw69Direction(w.richting))||[];
 const out=pool.map(s=>({s,distance:Math.abs(s.hm-Number(m.hm)),targetHm:Number(m.hm)})).filter(x=>x.distance<=1).sort((a,b)=>a.distance-b.distance||a.s.id.localeCompare(b.s.id));
 NDW69_MATCHES.set(w,{data,out});return out;
}
function ndw69Link(w){
 const choice=(kostenBasis().ndw69||{})[w?.key]||{},candidates=ndw69Candidates(w);
 const found=choice.siteId?candidates.find(x=>x.s.id===choice.siteId):candidates.find(x=>x.s.q!==null)||candidates[0];
 const confirmationKey=found?JSON.stringify([found.s.id,ndw69Data().sha256[0],w.weg,w.richting,found.targetHm]):'';
 return {choice,candidates,found,s:found?.s||null,confirmationKey,confirmed:!!choice.confirmed&&!choice.disabled&&!!confirmationKey&&choice.confirmationKey===confirmationKey,disabled:!!choice.disabled};
}
function ndw69Enrich(w,c){
 if(!w)return c;
 const link=ndw69Link(w),s=link.s,manual=c.q!==''&&c.q!=null&&c.ndwAuto!==true;
 if(link.disabled||!s||s.q===null||manual)return {...c,ndwUsed:null,...(c.ndwAuto===true?{q:''}:{})};
 return {...c,q:s.q,ndwAuto:true,status:'scenario',ndwUsed:{id:s.id,version:s.version,name:s.name,time:s.time,publication:ndw69Data().publication,hash:ndw69Data().sha256[0],q:s.q,period:s.period,speed:s.speed,lanes:s.lanes,distance:link.found.distance,targetHm:link.found.targetHm,hm:s.hm,lat:s.lat,lon:s.lon,confirmed:link.confirmed,mismatch:ndw69Mismatch()}};
}
function ndw69Write(key,change){const c=kostenBasis();c.ndw69={...(c.ndw69||{}),[key]:{...((c.ndw69||{})[key]||{}),...change}};RULES.kosten=c;SC67_CACHE={fingerprint:'',routes:{},busy:false,error:''};kostenSchermVervers();const d=document.getElementById('kostenDialog');if(d?.open){d.close();kostenOpenWeg(encodeURIComponent(key));}}
function ndw69Choose(el){ndw69Write(el.dataset.weg,{siteId:el.value,confirmed:false});}
function ndw69Confirm(el){const w=kostenDagRows().find(w=>w.key===el.dataset.weg),l=ndw69Link(w);ndw69Write(el.dataset.weg,{confirmed:el.checked,siteId:l.s?.id||'',confirmationKey:el.checked?l.confirmationKey:''});}
function ndw69Use(el){
 const key=el.dataset.weg,c=kostenBasis(),local={...((c.scenarioWegen67||{})[key]||{})};
 local.ndwAuto=el.checked;if(el.checked)local.q='';else{local.q='';local.ndwUsed=null;}
 c.scenarioWegen67={...(c.scenarioWegen67||{}),[key]:local};RULES.kosten=c;ndw69Write(key,{disabled:!el.checked});
}
function ndw69Summary(rows){
 if(!ndw69Data().sites.length)return `<section class="ndw69"><h3>NDW-verkeersgegevens</h3><p>Nog geen NDW-momentopname geladen. Gebruik een recente DVM-totaalexport met verkeersgegevens of voer het verkeersscenario lokaal in. Ontbrekende voertuigaantallen zijn geen nulmeting.</p></section>`;
 const matches=rows.map(w=>({w,c:sc67Config(w),l:ndw69Link(w)})),used=matches.filter(x=>x.c.ndwUsed),stats=ndw69Data().stats;
 return `<section class="ndw69" style="background:#eef5fa;padding:16px;margin:14px 0;border-left:4px solid #007bc7"><h3>NDW verkeersmeting vooraf geladen</h3><p><b>${used.length} van ${rows.length} wegdelen met een vooraf ingevulde intensiteit.</b> ${stats.sites.toLocaleString('nl-NL')} meetlocaties ingelezen, ${stats.validSites.toLocaleString('nl-NL')} met een compleet en geldig rijstrooktotaal in deze momentopname.</p><p>Publicatie verkeersmeting ${ndw69Date(ndw69Data().publication)}. Bronpeildatum storingen ${esc(sc67Datum())}. ${ndw69Mismatch()?'<b>De meetdag wijkt af van de storingsdag.</b>':''} Een minuutmeting is geen daggemiddelde. Kosten met deze intensiteit blijven een scenario, ook na bevestiging van de locatie.</p><p>Voorstel op hetzelfde wegnummer en dezelfde richting, maximaal 1 km verschil in hectometer bij de zwaarste storing. De weg en richting kunnen uit de MONIBAS-code zijn afgeleid. Controleer de rijbaan en lokale op- en afritten. Meetpunten achter elkaar worden niet opgeteld.</p><details class="kosten-invoer"><summary>Voertuigen per uur en koppeling per wegdeel bekijken</summary><div class="tbl-scroll" style="max-height:400px"><table class="tbl"><thead><tr><th>Wegdeel</th><th>Meetlocatie</th><th>Voertuigen/uur</th><th>Meetmoment</th><th>Status</th><th></th></tr></thead><tbody>${matches.map(({w,c,l})=>`<tr><td>${esc(w.key)}</td><td>${esc(l.s?.id||'Geen kandidaat binnen 1 km')}</td><td>${c.ndwUsed?sc67Format(c.q,0):'Niet overgenomen'}</td><td>${l.s?ndw69Date(l.s.time):'—'}</td><td>${c.ndwUsed?(l.confirmed?'Locatie bevestigd, tijdscenario':'Kandidaat, controle nodig'):l.s?.issues.length?esc(l.s.issues.join('; ')):'Handmatige invoer of geen passende meting'}</td><td><button onclick="kostenOpenWeg('${encodeURIComponent(w.key).replace(/'/g,'%27')}')">Bekijk / wijzig</button></td></tr>`).join('')}</tbody></table></div></details><p>Verkeersbron <a href="https://docs.ndw.nu/producten/snelhedenenintensiteiten/" target="_blank" rel="noopener">NDW, snelheden en intensiteiten</a>. Configuratie <a href="https://docs.ndw.nu/producten/meetlocatietabel/" target="_blank" rel="noopener">NDW meetlocatietabel</a>. Jouw aangeleverde XML-bestanden zijn in deze HTML verwerkt, er is geen internetverbinding nodig voor de metingen.</p></section>`;
}
function ndw69Editor(w){
 const l=ndw69Link(w),c=sc67Config(w),s=l.s,key=esc(w.key),used=!!c.ndwUsed;
 const options=l.candidates.map(x=>`<option value="${esc(x.s.id)}" ${s?.id===x.s.id?'selected':''}>${esc(x.s.id)} | hm ${sc67Format(x.s.hm,3)} | afstand ${sc67Format(x.distance,3)} km | ${x.s.q===null?'ongeldig':sc67Format(x.s.q,0)+' vtg/u'}</option>`).join('');
 return `<section style="background:#eef5fa;padding:14px;margin:12px 0"><h3>NDW meetlocatie en voertuigaantallen</h3>${s?`<label class="kosten-invoer">Meetlocatie bij representatieve storing hm ${sc67Format(l.found.targetHm,3)}<br><select style="max-width:100%;width:100%" data-weg="${key}" onchange="ndw69Choose(this)">${options}</select></label><p>${esc(s.name)}. ${esc(s.locationMethod)}. Verschil in hectometer ${sc67Format(l.found.distance,3)} km.</p><p>Gemeten intensiteit <b>${s.q===null?'Niet bruikbaar':sc67Format(s.q,0)+' voertuigen/uur'}</b>. Meetmoment ${ndw69Date(s.time)}. Meetperiode ${sc67Format(s.period,0)} seconden. ${s.speed==null?'Geen geldige snelheid voor alle rijstroken.':`Gemeten snelheid ${sc67Format(s.speed)} km/u. Deze wordt niet als snelheid zonder storing ingevuld.`}</p>${s.issues.length?`<p>${esc(s.issues.join('; '))}</p>`:''}<table class="tbl"><tr><th>Rijstrook</th><th>Totaalindex</th><th>Voertuigen/uur</th></tr>${s.lanes.map(x=>`<tr><td>${esc(x.lane)}</td><td>${esc(x.index)}</td><td>${x.q===null?'Ongeldig / ontbreekt':sc67Format(x.q,0)}</td></tr>`).join('')}</table><p>Alleen anyVehicle-totalen. Voertuigklassen worden niet nogmaals opgeteld. Onvolledige, dubbele of ongeldige rijstrooktotalen worden uitgesloten.</p><label class="kosten-invoer"><input type="checkbox" data-weg="${key}" ${used?'checked':''} ${s.q===null?'disabled':''} onchange="ndw69Use(this)"> Gebruik deze NDW-intensiteit voor het scenario</label><br><label class="kosten-invoer"><input type="checkbox" data-weg="${key}" ${l.confirmed?'checked':''} onchange="ndw69Confirm(this)"> Ik heb weg, richting en toepasbaarheid van dit meetpunt gecontroleerd</label>${s.lat!=null&&s.lon!=null?`<p><a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=17/${s.lat}/${s.lon}" target="_blank" rel="noopener">Meetpunt bekijken op kaart</a></p>`:''}`:'<p>Geen meetlocatie met een bruikbare weg- en richtingscode binnen 1 km van de representatieve storing. Er wordt geen voertuigaantal verzonnen. Je kunt hieronder een handmatige verkeersintensiteit met bron invoeren.</p>'}<p><b>${ndw69Mismatch()?'Meetdag wijkt af van de storingsdag.':'Meetdag komt overeen met de storingsdag, maar dit is slechts één minuutmeting.'}</b> Hinderuren en extra reistijd door assetuitval vul je zelf in. De extra reistijd is niet uit de gemeten snelheid afgeleid.</p></section>`;
}
function ndw69Memo(rows){
 const uses=rows.map(w=>({w,c:sc67Config(w)})).filter(x=>x.c.ndwUsed);
 if(!uses.length)return '';
 return `<h4>Herkomst NDW-intensiteiten</h4><p>NDW-publicatie ${ndw69Date(ndw69Data().publication)}, aangeleverde bestanden ${ndw69Data().files.map(esc).join(' en ')}. De intensiteiten zijn minuutmetingen, omgerekend naar voertuigen per uur. Het gebruik over de ingevoerde hinderuren is een scenario. Dit is geen gemeten dagtotaal of vastgestelde schade door de assetuitval.</p><table class="tbl"><tr><th>Wegdeel</th><th>Meetlocatie en tijd</th><th>Voertuigen/uur</th><th>Koppeling</th></tr>${uses.map(({w,c})=>`<tr><td>${esc(w.key)}</td><td>${esc(c.ndwUsed.id)}<br>${ndw69Date(c.ndwUsed.time)}</td><td>${sc67Format(c.q,0)}</td><td>${c.ndwUsed.confirmed?'Locatie bevestigd':'Onbevestigde kandidaat'}, verschil hm ${sc67Format(c.ndwUsed.distance,3)} km</td></tr>`).join('')}</table><p><a href="https://docs.ndw.nu/producten/snelhedenenintensiteiten/">NDW documentatie verkeersmetingen</a>. De meetwaarden en brongegevens gaan mee in de opgeslagen berekening.</p>`;
}

/* V67: deterministisch verkeersscenario. In versie 72 alleen actief na invoer. */
const SC67_DEFAULT={q:'',uren:'',km:2,snelheid:100,reductie:'',status:'scenario',bron:''};
let SC67_CACHE={fingerprint:'',routes:{},busy:false,error:''};
function sc67Config(w){return ndw69Enrich(w,{...SC67_DEFAULT,delayMode:'speed',minuten:'',...(kostenBasis().scenario67||{}),...((kostenBasis().scenarioWegen67||{})[w?.key]||{})});}
function sc67Num(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;}
function sc67Valid(c){
 const common=['q','uren'].every(k=>sc67Num(c[k])!==null)&&c.q>=0&&c.uren>=0&&c.uren<=24;
 if(c.delayMode==='direct')return common&&sc67Num(c.minuten)!==null&&c.minuten>=0;
 return common&&['km','snelheid','reductie'].every(k=>sc67Num(c[k])!==null)&&c.km>0&&c.snelheid>0&&c.reductie>=0&&c.reductie<=90;
}
function sc67Severity(w){return Math.min(1,Math.max(0,...(w.meldingen||[]).map(m=>Number(m.avail||0)/100)));}
function sc67Fingerprint(){return JSON.stringify([STATE?.peildatum,(kostenDagRows()).map(w=>[w.key,w.meldingen.map(m=>[m.assetKey,m.avail,m.googleLink]),sc67Config(w)])]);}
function sc67Route(w){if(!SC67_CACHE.fingerprint)return null;return SC67_CACHE.fingerprint===sc67Fingerprint()?(SC67_CACHE.routes[w.key]||null):null;}
function kostenDagResultaat(w){
 const c=sc67Config(w),severity=sc67Severity(w),direct=c.delayMode==='direct',route=direct?null:sc67Route(w),valid=sc67Valid(c),loss=Number(c.reductie)/100*severity;
 const basis=valid&&!direct?Number(c.km)/Number(c.snelheid)*60:null;
 const t0=route?.ok?route.t0:basis,t1=route?.ok?route.t1:(valid&&!direct?basis/(1-loss):null);
 const minuten=valid?(direct?Number(c.minuten):Math.max(0,t1-t0)):null;
 const vvu=valid?Number(c.q)*Number(c.uren)*minuten/60:null;
 const status=v68KostenStatus(c),tarief=kostenBereken(kostenBasis(),{vvu,periode:'dagscenario',bron:c.bron});
 return {wd:w,m:c,verlies:severity,vvu,kosten:status==='niet_berekenbaar'?null:tarief.kosten??null,tarief:tarief.tarief,t0,t1,minuten,voertuigen:valid?Number(c.q)*Number(c.uren):null,route:route?.ok?route:null,routeMelding:direct?'Extra vertraging rechtstreeks ingevoerd':route?.reason||'Vaste scenariolengte; OSM-route nog niet berekend',bron:c.bron,model:'scenario69',status};
}
function sc67Format(n,d=2){return n==null?'Niet berekenbaar':Number(n).toLocaleString('nl-NL',{maximumFractionDigits:d});}
function sc67Datum(){return STATE?.peildatum?new Date(STATE.peildatum).toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam'}):'onbekend';}
function sc67Uitleg(){return `<details class="kosten-uitleg" open><summary><b>Hoe worden de kosten berekend?</b></summary><p>Dit is een gevoeligheidsscenario, geen gemeten verkeersschade en geen gevalideerd verkeersmodel. De open storingen en hun impact komen uit jouw live rule engine. Voertuigaantallen worden waar beschikbaar vooraf ingevuld uit jouw NDW-minuutmeting. De toepassing over de hinderuren, de keuze van het meetpunt en het verkeerskundige effect blijven scenarioaannames. De gemeten snelheid is geen bewijs voor het effect van assetuitval.</p><p>Bij de methode extra vertraging rechtstreeks in minuten vul je de extra tijd per voertuig door de huidige uitval in. Dan geldt direct VVU = voertuigen/uur maal hinderuren maal extra minuten / 60. Voor het trajectmodel geldt onderstaande uitleg.</p><ol><li>Per wegdeel gebruiken we één representatief traject. De hoogste beschikbaarheidsimpact van een open storing bepaalt de ernst, van 0 tot 100%. Meerdere storingen worden niet opgeteld. Dit model beschrijft dus niet alle afzonderlijke locaties langs een lange weg.</li><li>Zonder storing: reistijd = trajectlengte / basissnelheid × 60 minuten.</li><li>Met storing: de snelheid daalt met de ingestelde reductie × storingsimpact. Voorbeeld: 20% reductie × 50% impact betekent 10% lagere snelheid. Dat is een expliciete aanname over verkeer, geen bewezen relatie met assetbeschikbaarheid.</li><li>Optioneel berekent het OSM-netwerk voor hetzelfde begin- en eindpunt een route zonder en met de snelheidsreductie. Alleen het representatieve referentietraject wordt vertraagd; een omleiding kan voordeliger worden. Eénrichtingswegen worden gerespecteerd volgens het aangeleverde bestand. Er worden geen verbindingen tussen nabijgelegen rijbanen verzonnen.</li><li>VVU = voertuigen per uur × hinderuren per brondag × extra reistijd in minuten / 60. De hinderuren zijn uren waarin verkeer last heeft van de assetuitval, niet de volledige reparatieduur.</li><li>Kosten = VVU × gewogen eurotarief. Autotarief = bestuurder + extra passagiers × passagierstarief. Het vrachtpercentage weegt het vracht- en autotarief. Prijspeil staat bij de uitkomst.</li></ol><p><b>Rekenvoorbeeld met fictieve verkeerswaarden.</b> 2 km bij 100 km/u duurt 1,2 minuten. Bij 100% storingsimpact en 20% snelheidsreductie duurt dit 1,5 minuten. 1.000 voertuigen/uur × 2 hinderuren × 0,3 minuut / 60 = 10 VVU. Bij de oorspronkelijke tariefinstellingen is dat €175,65 per dagscenario.</p><p><b>Beperkingen.</b> Geen wachtrijopbouw, terugslag of afwikkeling na afloop. Geen berekende rijstrookcapaciteit. Geen automatisch effect van U-routes of werkzaamheden; die informatie blijft in de bestaande analyses. Geen veiligheids- of onderhoudskosten. Een defecte DRIP of MSI betekent niet automatisch een afgesloten rijstrook. De sommatie is een som van onafhankelijke wegdeelscenario’s, niet een gevalideerde netwerkschade. Controleer overlap en herkomst/bestemming voordat je bedragen als besluitbasis gebruikt.</p><p>De 750 voertuigen per animatie-agent uit jouw voorbeeldbestand worden niet als verkeerstelling gebruikt. Dat is een visualisatiefactor zonder gemeten relatie met de verkeersstroom.</p><p>Weggeometrie is niet vooraf geladen in deze browserversie. Het trajectscenario werkt met de lokaal ingevoerde lengte. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap-bijdragers, ODbL</a>. De koppeling is een ruimtelijke kandidaat, geen bevestigde NWB- of hectometerkoppeling.</p>${kostenBronHtml()}</details>`;}
function sc67Fields(c){
 const input=(k,l,min,max)=>`<label style="display:inline-block;margin:8px;max-width:270px">${l}<br><input data-sc67="${k}" type="number" min="${min}" ${max==null?'':`max="${max}"`} step="any" value="${esc(c[k]??'')}"></label>`;
 return `<label style="display:block;margin:8px">Status berekening<br><select data-sc67="status"><option value="scenario" ${c.status!=='onderbouwd'?'selected':''}>Scenario, waarden zijn aannames</option><option value="onderbouwd" ${c.status==='onderbouwd'?'selected':''}>Onderbouwd, verkeerswaarden en effect hebben een bron</option></select></label>${c.ndwUsed?'<p>Met de NDW-minuutmeting blijft de status scenario, ook wanneer je onderbouwd selecteert.</p>':''}${input('q','Getroffen voertuigen per uur',0,100000)}${input('uren','Hinderuren per brondag',0,24)}<label style="display:block;margin:8px">Berekening extra reistijd<br><select data-sc67="delayMode" onchange="ndw69Mode(this)"><option value="speed" ${c.delayMode!=='direct'?'selected':''}>Trajectlengte en aangenomen snelheidsreductie</option><option value="direct" ${c.delayMode==='direct'?'selected':''}>Extra vertraging rechtstreeks in minuten</option></select></label><div data-delay-fields="direct" ${c.delayMode==='direct'?'':'hidden'}>${input('minuten','Extra minuten per voertuig door assetuitval',0,null)}<p>Voer de extra vertraging door de huidige uitval in. De storingsimpact wordt hier niet nogmaals vermenigvuldigd.</p></div><div data-delay-fields="speed" ${c.delayMode==='direct'?'hidden':''}>${input('km','Referentietraject in km',.01,100)}${input('snelheid','Snelheid zonder assetstoring, km/u',1,200)}${input('reductie','Snelheidsreductie bij volledige assetuitval, procent',0,90)}</div><label style="display:block;margin:8px">Bron en onderbouwing van hinderduur en verkeerskundig effect<br><input data-sc67="bron" type="text" style="width:95%" value="${esc(c.bron||'')}"></label><details><summary>Optionele OSM-locatie voor het trajectmodel</summary><p>Deze locatie is de locatie van de assetstoring. Een NDW-meetpunt is niet automatisch dezelfde locatie.</p>${input('lon','Lengtegraad',3,8)}${input('lat','Breedtegraad',50,54)}</details>`;
}
function sc67Instellingen(){return `<details class="kosten-invoer"><summary>Verkeerswaarden voor alle wegdelen instellen</summary><div data-sc67-key="">${sc67Fields(sc67Config(null))}<button onclick="sc67Bewaar(this)">Instellingen opslaan en herberekenen</button></div><p>Laat voertuigen/uur hier leeg om per wegdeel de voorgestelde NDW-intensiteit te gebruiken. Vul hinderuren, extra reistijd of het trajectmodel en de onderbouwing in. Je kunt onvolledige invoer opslaan. Per wegdeel kun je afwijken.</p>${v68KostenInstellingenExtra()}</details>`;}
function sc67Bewaar(el){
 const p=el.closest('[data-sc67-key]'),key=p.dataset.sc67Key,w=kostenDagRows().find(x=>x.key===key),before=sc67Config(w),c={};
 p.querySelectorAll('[data-sc67]').forEach(x=>c[x.dataset.sc67]=x.type==='number'?(x.value===''?'':Number(x.value)):x.value);
 const keepNdw=key&&before.ndwUsed&&Number(c.q)===Number(before.q)&&c.q!=='';
 c.ndwAuto=!!keepNdw;c.ndwUsed=keepNdw?before.ndwUsed:null;
 const filled=['q','uren','km','snelheid','reductie','minuten','lon','lat'].filter(k=>c[k]!==''&&c[k]!=null);
 if(filled.some(k=>!Number.isFinite(c[k]))||c.q!==''&&c.q<0||c.uren!==''&&(c.uren<0||c.uren>24)||c.reductie!==''&&(c.reductie<0||c.reductie>90)||c.minuten!==''&&c.minuten<0){alert('Controleer de invoer. Geen negatieve waarden, hinderuren maximaal 24 en snelheidsreductie maximaal 90 procent.');return;}
 const k=kostenBasis();if(key)k.scenarioWegen67={...(k.scenarioWegen67||{}),[key]:c};else k.scenario67=c;RULES.kosten=k;
 SC67_CACHE={fingerprint:'',routes:{},busy:false,error:''};kostenSchermVervers();const dialog=document.getElementById('kostenDialog');if(dialog?.open){dialog.close();kostenOpenWeg(encodeURIComponent(key));}
}
function kostenDagHtml(rows){
 const a=rows.map(kostenDagResultaat),ok=a.filter(z=>z.kosten!==null),scenario=ok.filter(z=>z.status==='scenario'),onderbouwd=ok.filter(z=>z.status==='onderbouwd'),sum=ok.reduce((s,z)=>s+z.kosten,0),vvu=ok.reduce((s,z)=>s+z.vvu,0),groepen={};
 ok.forEach(z=>{const k=z.wd.vc||'Onbekend',g=groepen[k]||(groepen[k]={kosten:0,vvu:0,scenario:0,onderbouwd:0});g.kosten+=z.kosten;g.vvu+=z.vvu;g[z.status]++;});
 const officieel=ok.length===a.length&&ok.length>0&&!scenario.length&&v68OverlapBevestigd();
 return `<section class="kosten-blok">${ndw69Summary(rows)}<h3>Vertragingskosten per brondag, open storingen</h3><p>Bronpeildatum ${esc(sc67Datum())}. Dit is geen berekening voor vandaag.</p><div style="display:flex;gap:24px;flex-wrap:wrap"><p><b style="font-size:25px">${ok.length?kostenEuro(sum):'Niet berekenbaar'}</b><br>${officieel?'Onderbouwd kostentotaal':ok.length?'Bekend scenario-subtotaal':'Hinderduur, verkeerskundig effect of bron ontbreekt'}</p><p><b style="font-size:25px">${ok.length?sc67Format(vvu):'Niet berekenbaar'}</b><br>VVU per brondag</p></div><p>${onderbouwd.length} onderbouwd, ${scenario.length} scenario en ${a.length-ok.length} niet berekenbaar van ${a.length} wegdelen. ${v68OverlapBevestigd()?'Overlapcontrole bevestigd.':'Overlapcontrole niet bevestigd.'} ${ok.filter(z=>z.route).length} berekeningen gebruiken een OSM-kandidaatroute. Prijspeil ${esc(kostenBasis().prijspeil)}.</p>${!officieel&&ok.length?'<p class="calc-warn"><b>Geen landelijk kostentotaal.</b> Het getoonde bedrag is een subtotaal van beschikbare wegdeelscenario’s. Gebruik het niet als gemeten maatschappelijke schade.</p>':''}<table class="tbl"><thead><tr><th>Verkeerscentrale</th><th>VVU</th><th>Kosten</th><th>Status regels</th></tr></thead><tbody>${Object.entries(groepen).map(([vc,g])=>`<tr><td>${esc(vc)}</td><td>${sc67Format(g.vvu)}</td><td>${kostenEuro(g.kosten)}</td><td>${g.onderbouwd} onderbouwd, ${g.scenario} scenario</td></tr>`).join('')||'<tr><td colspan="4">Geen complete verkeersinvoer.</td></tr>'}</tbody></table><details class="kosten-invoer"><summary>Berekening en aannames per wegdeel</summary><div style="overflow:auto"><table class="tbl"><thead><tr><th>Wegdeel</th><th>Status</th><th>Impact</th><th>Voertuigen</th><th>Extra minuten per voertuig</th><th>VVU</th><th>Kosten</th><th></th></tr></thead><tbody>${a.map(z=>`<tr><td>${esc(z.wd.key)}</td><td>${v68KostenStatusLabel(z.status)}</td><td>${sc67Format(z.verlies*100)}%</td><td>${sc67Format(z.voertuigen,0)}</td><td>${sc67Format(z.minuten)}</td><td>${sc67Format(z.vvu)}</td><td>${z.kosten===null?'Niet berekenbaar':kostenEuro(z.kosten)}</td><td><button onclick="kostenOpenWeg('${encodeURIComponent(z.wd.key).replace(/'/g,'%27')}')">Bekijk / wijzig</button></td></tr>`).join('')}</tbody></table></div></details><p>De zwaarste storing bepaalt het effect binnen één representatief wegdeeltraject. Storingen worden niet opgeteld. De regionale bedragen kunnen dezelfde doorgaande verkeersstroom raken.</p></section>`;
}
function kostenDagOverzicht(){const rows=kostenDagRows(),vcs=[...new Set(rows.map(w=>w.vc||'Onbekend'))].sort();return `<div class="card"><label>Verkeerscentrale voor kosten <select id="kostenDagVc" onchange="kostenDagVervers()"><option value="">Alle</option>${vcs.map(v=>`<option>${esc(v)}</option>`).join('')}</select></label><div id="kostenDagInhoud">${kostenDagHtml(rows)}</div>${sc67Instellingen()}<p><button onclick="sc67Run()" id="sc67RunButton">Bereken optionele OSM-routes</button> <span id="sc67Status">Zonder OSM-match wordt de ingevoerde trajectlengte gebruikt.</span></p><button onclick="tmc70Open(document.getElementById('kostenDagVc').value?'vc':'all',normAssetVc(document.getElementById('kostenDagVc').value))">Monte Carlo verkeerskosten</button> <button onclick="f71Open()">Toekomstprognose signaalgevers</button> <button onclick="kostenHistorieOpen()">Opgeslagen dagscenario’s</button> <button onclick="kostenDagOpslaan()">Dagscenario op bronpeildatum opslaan</button><p>Historie bevat alleen opgeslagen berekeningen. Ontbrekende dagen zijn geen nul. Vergelijk dagen alleen bij dezelfde aannames en dekking.</p>${sc67Uitleg()}</div>`;}
function kostenModelEditor(w){
 const z=kostenDagResultaat(w);
 return `<section class="kosten-blok"><h3>Verkeersberekening voor ${esc(w.key)}</h3><p><b>Status ${v68KostenStatusLabel(z.status)}</b>. ${z.kosten===null?'Vul de resterende verkeerswaarden en de onderbouwing in.':`${kostenEuro(z.kosten)} per brondag. ${sc67Format(z.vvu)} VVU maal ${kostenEuro(z.tarief)} per VVU.`}</p><p><button onclick="tmc70Open('weg',decodeURIComponent('${encodeURIComponent(w.key).replace(/'/g,'%27')}'))">Monte Carlo voor dit wegdeel</button></p>${ndw69Editor(w)}<p>${sc67Format(z.m.q,0)} voertuigen/uur maal ${sc67Format(sc67Num(z.m.uren))} hinderuren maal ${sc67Format(z.minuten)} extra minuten / 60. Bronpeildatum storingen ${esc(sc67Datum())}.</p><p>${esc(z.route?`OSM-kandidaatroute, ${sc67Format(z.route.km)} km. Afstand tot gekozen weg ${sc67Format(z.route.distance,0)} meter. Controleer locatie en rijrichting.`:z.routeMelding)}</p>${z.route?sc67Kaart(z.route):''}<div class="kosten-invoer" data-sc67-key="${esc(w.key)}">${sc67Fields(z.m)}<button onclick="sc67Bewaar(this)">Wegdeelinvoer opslaan en herberekenen</button><p>Je kunt onvolledige invoer opslaan. Het bedrag blijft onbekend totdat alle benodigde velden en de onderbouwing zijn ingevuld.</p></div>${sc67Uitleg()}</section>`;
}
function sc67Kaart(r){const points=[...r.base,...r.affected];if(!points.length)return '';let xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const width=Math.max((x1-x0)*.62,y1-y0,.001),cx=(x0+x1)/2,cy=(y0+y1)/2;const path=a=>a.map(p=>`${300+(p[0]-cx)*.62/width*500},${180-(p[1]-cy)/width*300}`).join(' ');return `<svg viewBox="0 0 600 360" role="img" aria-label="Referentieroute blauw en route met storing oranje" style="width:100%;max-height:360px;background:#f4f7fa"><polyline points="${path(r.base)}" fill="none" stroke="#003082" stroke-width="7"/><polyline points="${path(r.affected)}" fill="none" stroke="#e17000" stroke-width="3" stroke-dasharray="7 3"/></svg><p>Blauw is de route zonder assetstoring. Oranje is de route met de aangenomen snelheidsreductie. Dit is een routeschets zonder achtergrondkaart.</p>`;}
function sc67MemoAannames(rows){
 return `<h4>Onderbouwing dagscenario</h4><p>Per wegdeel wordt één representatief traject doorgerekend. VVU = voertuigen/uur maal hinderuren maal extra minuten / 60. Bij rechtstreekse invoer gebruik je de extra minuten door de huidige uitval. Bij het trajectmodel bepaalt de hoogste impact van een open storing de aangenomen snelheidsreductie. Er wordt geen wachtrij of causale verkeersschade uit de NDW-snelheid afgeleid. Controleer overlap tussen wegdelen.</p><table class="tbl"><tr><th>Wegdeel</th><th>Voertuigen/uur</th><th>Hinderuren</th><th>Extra minuten</th><th>Model</th><th>Tarief/VVU</th><th>Onderbouwing</th></tr>${rows.map(w=>{const z=kostenDagResultaat(w),c=z.m;return `<tr><td>${esc(w.key)}</td><td>${esc(c.q)}</td><td>${esc(c.uren)}</td><td>${sc67Format(z.minuten)}</td><td>${c.delayMode==='direct'?'Rechtstreekse vertraging':`${sc67Format(z.route?.km??c.km)} km; ${esc(c.snelheid)} km/u; ${esc(c.reductie)}% maximale reductie`}</td><td>${sc67Format(z.tarief,4)}</td><td>${esc(c.bron)}. ${c.ndwUsed?'Intensiteit uit NDW-momentopname.':''}</td></tr>`;}).join('')}</table>${ndw69Memo(rows)}`;
}
function sc67Position(m){
 const a=typeof ASSET_INDEX!=='undefined'?ASSET_INDEX?.byKey?.get(m.assetKey):null;
 if(a&&Number.isFinite(a.rdX)&&Number.isFinite(a.rdY)){
 const x=(a.rdX-155000)*1e-5,y=(a.rdY-463000)*1e-5;
 const lat=52.15517440+(3235.65389*y-32.58297*x*x-.2475*y*y-.84978*x*x*y-.0655*y*y*y-.01709*x*x*y*y-.00738*x+.0053*x*x*x*x-.00039*x*x*y*y*y+.00033*x*x*x*x*y-.00012*x*y)/3600;
 const lon=5.38720621+(5260.52916*x+105.94684*x*y+2.45656*x*y*y-.81885*x*x*x+.05594*x*y*y*y-.05607*x*x*x*y+.01199*y-.00256*x*x*x*y*y+.00128*x*y*y*y*y+.00022*y*y-.00022*x*x+.00026*x*x*x*x*x)/3600;
 return [lon,lat];}
 const match=String(m.googleLink||'').match(/(?:@|q=|query=)(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);return match?[Number(match[2]),Number(match[1])]:null;
}
async function sc67Run(){
 if(SC67_CACHE.busy)return;const rows=kostenDagRows();if(!rows.length){alert('Laad eerst een live storingslijst.');return;}
 const geldig=rows.filter(w=>sc67Config(w).delayMode!=='direct'&&sc67Valid(sc67Config(w)));if(!geldig.length){alert('Vul complete verkeerswaarden in voor het trajectmodel. Bij rechtstreekse extra minuten is geen OSM-route nodig.');return;}
 const status=document.getElementById('sc67Status'),button=document.getElementById('sc67RunButton'),fingerprint=sc67Fingerprint();SC67_CACHE.busy=true;if(button)button.disabled=true;if(status)status.textContent='Wegennet laden en gerichte routes vergelijken…';
 let worker,url;
 try{if(typeof DecompressionStream==='undefined')throw Error('Deze browser ondersteunt het ingepakte wegennet niet. Gebruik een recente Chrome of Edge.');
 const bytes=Uint8Array.from(atob(SC67_OSM_DATA),c=>c.charCodeAt(0)),str=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 const requests=geldig.map(w=>{const m=[...(w.meldingen||[])].sort((a,b)=>b.avail-a.avail).find(m=>sc67Position(m));const c=sc67Config(w),lon=sc67Num(c.lon),lat=sc67Num(c.lat),manual=lon!==null&&lat!==null&&lon>=3&&lon<=8&&lat>=50&&lat<=54;return {key:w.key,ref:w.weg,position:manual?[lon,lat]:(m?sc67Position(m):null),c,severity:sc67Severity(w)};});
 url=URL.createObjectURL(new Blob(['('+sc67Worker.toString()+')()'],{type:'text/javascript'}));worker=new Worker(url);
 const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Routeberekening duurt te lang. Vaste scenariolengtes blijven beschikbaar.')),120000);worker.onmessage=e=>{if(e.data.progress){if(status)status.textContent=e.data.progress;return;}clearTimeout(timeout);if(e.data.error)reject(Error(e.data.error));else resolve(e.data);};worker.onerror=e=>{clearTimeout(timeout);reject(Error(e.message));};worker.postMessage({ways:JSON.parse(str),requests});});
 if(fingerprint!==sc67Fingerprint())throw Error('Gegevens of aannames zijn gewijzigd tijdens de berekening. Start opnieuw.');SC67_CACHE={fingerprint,routes:result.routes,busy:false,error:''};kostenSchermVervers();if(status)status.textContent=`${Object.values(result.routes).filter(r=>r.ok).length} van ${geldig.length} berekenbare wegdelen met OSM-route. Overige gebruiken de vaste scenariolengte. Richting en kandidaatlocatie controleren.`;
 }catch(e){SC67_CACHE.busy=false;SC67_CACHE.error=e.message;if(status)status.textContent=e.message;}finally{worker?.terminate();if(url)URL.revokeObjectURL(url);if(button)button.disabled=false;}
}
function sc67Worker(){
 const dist=(a,b)=>Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),(a[1]-b[1]))*111195;
 const ref=s=>String(s||'').replace(/\s/g,'').toUpperCase();
 class Heap{constructor(){this.a=[];}push(x){let i=this.a.push(x)-1;while(i){const p=(i-1)>>1;if(this.a[p].f<=x.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=x;}pop(){const root=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=last.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return root;}}
 self.onmessage=e=>{try{
 const nodes=[],byCoord=new Map(),edges=[],byRef=new Map();
 const node=p=>{const k=p.join(',');if(byCoord.has(k))return byCoord.get(k);const id=nodes.length;nodes.push({p,out:[],in:[]});byCoord.set(k,id);return id;};
 const add=(a,b,w)=>{const km=dist(nodes[a].p,nodes[b].p)/1000;if(!km||km>8)return;const id=edges.length;edges.push({a,b,km,ref:ref(w.ref)});nodes[a].out.push(id);nodes[b].in.push(id);for(const r of ref(w.ref).split(';')){if(!byRef.has(r))byRef.set(r,[]);byRef.get(r).push(id);}};
 for(const w of e.data.ways){if(!w.pts?.length)continue;const ids=w.pts.map(node);for(let i=1;i<ids.length;i++){if(w.oneway===-1||w.oneway==='-1')add(ids[i],ids[i-1],w);else{add(ids[i-1],ids[i],w);if(!(w.oneway===true||w.oneway==='yes'||w.oneway==='1'))add(ids[i],ids[i-1],w);}}}
 const walk=(start,direction,road,target)=>{let current=start,length=0;const seen=new Set([start]),path=[];while(length<target&&path.length<3000){const candidates=nodes[current][direction].map(id=>[id,edges[id]]).filter(([id,x])=>x.ref.split(';').includes(road)&&!seen.has(direction==='out'?x.b:x.a));if(!candidates.length)break;const [id,x]=candidates.sort((a,b)=>a[1].km-b[1].km)[0];current=direction==='out'?x.b:x.a;seen.add(current);path.push(id);length+=x.km;}return {node:current,path,length};};
 const route=(s,t,speed,penalty,factor)=>{const heap=new Heap(),best=new Map([[s,0]]),prev=new Map();heap.push({id:s,g:0,f:0});let visit=0;while(heap.a.length&&visit++<150000){const u=heap.pop();if(u.g!==best.get(u.id))continue;if(u.id===t){const ids=[];let at=t;while(at!==s){const id=prev.get(at);if(id===undefined)return null;ids.push(id);at=edges[id].a;}ids.reverse();return {time:u.g,ids};}for(const id of nodes[u.id].out){const x=edges[id],g=u.g+x.km/speed*60*(penalty.has(id)?factor:1);if(g<(best.get(x.b)??Infinity)){best.set(x.b,g);prev.set(x.b,id);heap.push({id:x.b,g,f:g+dist(nodes[x.b].p,nodes[t].p)/1000/speed*60});}}}return null;};
 const routes={};let done=0;
 for(const req of e.data.requests){self.postMessage({progress:`OSM-route ${++done} van ${e.data.requests.length}`});const fail=reason=>routes[req.key]={ok:false,reason};if(!req.position){fail('Geen assetcoördinaten; vaste scenariolengte');continue;}let id=null,distance=Infinity;for(const ix of byRef.get(ref(req.ref))||[]){const x=edges[ix],a=nodes[x.a].p,b=nodes[x.b].p;const scale=Math.cos(req.position[1]*Math.PI/180),dx=(b[0]-a[0])*scale,dy=b[1]-a[1],px=(req.position[0]-a[0])*scale,py=req.position[1]-a[1],t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1))),d=dist(req.position,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);if(d<distance){distance=d;id=ix;}}
 if(id===null||distance>150){fail('Geen passende OSM-weg binnen 150 m; vaste scenariolengte');continue;}const x=edges[id],road=ref(req.ref),back=walk(x.a,'in',road,req.c.km/2),forward=walk(x.b,'out',road,req.c.km/2),base=route(back.node,forward.node,req.c.snelheid,new Set(),1);if(!base||!base.ids.length){fail('Geen gerichte OSM-route; vaste scenariolengte');continue;}
 const penalty=new Set(base.ids),changed=route(back.node,forward.node,req.c.snelheid,penalty,1/(1-req.c.reductie/100*req.severity));if(!changed){fail('Geen alternatieve berekening; vaste scenariolengte');continue;}
 const pts=r=>[nodes[edges[r.ids[0]].a].p,...r.ids.map(i=>nodes[edges[i].b].p)];routes[req.key]={ok:true,t0:base.time,t1:Math.max(base.time,changed.time),km:base.ids.reduce((s,id)=>s+edges[id].km,0),distance,base:pts(base),affected:pts(changed),wayDirection:'OSM geometry direction, candidate match'};
 }
 self.postMessage({routes,nodeCount:nodes.length,edgeCount:edges.length});
 }catch(error){self.postMessage({error:error.message});}};
}
const SC67_OSM_DATA="";

function memoDocument(bron, niveau, koppelBW, titel){
  const N=MEMO_NIVEAUS[niveau];
  const s=memoSecties(bron, niveau, koppelBW);
  // Zwaartepunt techniek ↔ dienst: verschuif het accent in de risicoparagraaf.
  const accent=memoZwaartepuntAccent();
  if(accent) s.risico = accent + s.risico;
  // Voor de MSI- en DRIP-prognoses: expliciet raakvlak met werkzaamheden en U-routes.
  // Deze memo's beschrijven de gevolgen voor de dienstverlening, dus de operationele
  // blootstelling (werkvakken, omleidingsroutes) hoort daar nadrukkelijk bij.
  if(bron.type==='montecarlo'||bron.type==='drip-montecarlo'){
    const ctx=bron.mc&&bron.mc.context?bron.mc.context:null;
    const raakvlak=memoOperationeelRaakvlak(ctx);
    if(raakvlak){
      s.risico += ' '+raakvlak;
      // In een dienstgerichte memo krijgt het raakvlak ook een plek in de conclusie.
      if(memoAccentDienst()&&ctx&&(ctx.routeMatches||ctx.werkenExact)){
        s.conclusie += ` Voor de dienstverlening is het samenvallen met ${ctx.werkenExact?`${ctx.werkenExact} werkvak(ken)`:'geplande werkzaamheden'}${ctx.routeMatches?` en ${ctx.routeMatches} U-route(s)`:''} het punt waar uitval het hardst doorwerkt op weggebruiker en omleiding.`;
      }
    }
  }
  const datum=new Date().toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});
  const jaar=new Date().getFullYear();
  const D=(STATE&&STATE.drips)||DRIP_STATE;
  const brondata=bron.type==='drip-montecarlo'
    ? `${D&&D.bestand?D.bestand:'DRIP-areaal'}${bron.mc.historieInfo&&bron.mc.historieInfo.bronnen&&bron.mc.historieInfo.bronnen.length?' + '+bron.mc.historieInfo.bronnen.join(', '):''}`
    : (STATE.bestand||'—');
  const bwRegel = koppelBW
    ? `<tr><td class="ml">Bedrijfswaarden</td><td>${MEMO_BEDRIJFSWAARDEN.join(' · ')}</td></tr>` : '';
  return `<div class="memo-doc" id="memoDocInhoud">
    <div class="memo-kop">
      <div>
        <div class="memo-org">Rijkswaterstaat — Wegverkeersmanagement (VWM)</div>
        <div class="memo-titel">${esc(titel)}</div>
        <div class="memo-meta"><strong>${N.aanhef}</strong> &nbsp;·&nbsp; Van: VWM bedienorganisatie &nbsp;·&nbsp; Scope: ${esc(memoScopeLabel(bron))} &nbsp;·&nbsp; ${datum}</div>
      </div>
      <div class="memo-stempel"><span class="memo-concept">Concept</span><br>Niet openbaar<br>VWM / ${jaar}</div>
    </div>
    <div class="memo-body">
      <table class="memo-samenvatting">
        <tr><td class="ml">Onderwerp</td><td>${esc(titel)}</td></tr>
        <tr><td class="ml">Ontvanger</td><td>${N.label}</td></tr>
        <tr><td class="ml">Brondata</td><td>${esc(brondata)}</td></tr>
        ${bwRegel}
      </table>

      <h3>1 &nbsp; Aanleiding</h3>
      <p>${s.aanleiding}</p>

      <h3>2 &nbsp; Beschrijving</h3>
      <p>${s.beschrijving}</p>

      <h3>3 &nbsp; Risico</h3>
      <p>${s.risico}</p>

      <h3>4 &nbsp; Conclusie</h3>
      <p>${s.conclusie}</p>

      <h3>5 &nbsp; Gevraagd besluit</h3>
      <ul>${s.besluit.map(b=>`<li>${b}</li>`).join('')}</ul>

      <h3>6 &nbsp; Verwachte uitkomst besluit</h3>
      <p>${s.uitkomst}</p>
      ${v68MemoKader(bron)}
      ${kostenMemoHtml(bron)}

      <p class="memo-onder">Opgesteld door: Wegverkeersmanagement (VWM) / Rijkswaterstaat<br>
      Datum: ${datum}<br><br>
      ______________________________<br>
      <span class="memo-paraaf">Paraaf VWM</span></p>
    </div>
    ${memoBijlage(bron, niveau, koppelBW)}
  </div>`;
}

/* Open de memo-modal voor een tabblad. bronMaker() levert het bron-object. */
let MEMO_BRON=null, MEMO_TITEL='';
let GEBIED_SCHERM=null, MC_SCHERM=null;  // exacte schermwaarden voor 1-op-1 memo
function vulMemoScope(type){
  const el=document.getElementById('memoScope');if(!el)return;
  const vcs=[...new Set((STATE&&STATE.wegdelen?STATE.wegdelen:[]).map(w=>normAssetVc(w.vc)).filter(Boolean))].sort();
  el.innerHTML=`<option value="landelijk">Landelijk VWM</option>`+vcs.map(vc=>`<option value="${esc(vc)}">Verkeerscentrale ${esc(vc)}</option>`).join('');
  el.value='landelijk';
}
function opentMemo(type){
  // bepaal bron-object en standaardtitel per tabblad
  if (type==='overzicht'){
    MEMO_BRON={type:'overzicht'};
    MEMO_TITEL='Gevolgen MSI-storingen voor de VWM-diensten';
  } else if (type==='gebied'){
    // gebruik EXACT dezelfde selectie als het scherm (renderGebied)
    if(!GEBIED_SCHERM || !GEBIED_SCHERM.zwaarste){ alert('Open eerst het tabblad Gebied & choke-points zodat de analyse is berekend.'); return; }
    const z=GEBIED_SCHERM.zwaarste;
    MEMO_BRON={type:'gebied', choke:z, wegKey:z.key, wdBesch:z.wd.besch,
      totaalClusters:GEBIED_SCHERM.totaalClusters, ernstig:GEBIED_SCHERM.ernstig, chokeVenster:GEBIED_SCHERM.chokeVenster,
      regio:GEBIED_SCHERM.regio||'',regioNaam:GEBIED_SCHERM.regioNaam||''};
    MEMO_TITEL='Choke-point in de MSI-signalering — '+z.key;
  } else if (type==='montecarlo'){
    if(!MC_RESULT){ alert('Draai eerst de Monte Carlo-simulatie.'); return; }
    if(!MC_SCHERM){ alert('Open eerst het tabblad Prognose zodat de resultaten op het scherm staan.'); return; }
    // gebruik EXACT de kansOnder en norm die op het scherm staan
    MEMO_BRON={type:'montecarlo', mc:MC_RESULT, kansOnder: MC_SCHERM.kansOnder, norm: MC_SCHERM.norm};
    MEMO_TITEL='Prognose beschikbaarheid MSI-signalering ('+(MC_RESULT.periodeLabel||MC_RESULT.horizon+' jaar')+')';
  } else if (type==='drip-montecarlo'){
    if(!DRIP_MC){ alert('Draai eerst de DRIP Monte Carlo-simulatie.'); return; }
    MEMO_BRON={type:'drip-montecarlo',mc:DRIP_MC};
    MEMO_TITEL='Prognose DRIP-storingen en dienstimpact ('+(DRIP_MC.periodeLabel||DRIP_MC.jaarVan+' tot en met '+DRIP_MC.jaarTot)+')';
  }
  vulMemoScope(type);
  document.getElementById('memoModalTitel').value=MEMO_TITEL;
  document.getElementById('memoModal').style.display='flex';
  memoVervers();
}
function sluitMemo(){ document.getElementById('memoModal').style.display='none'; }
function memoVervers(){
  if(!MEMO_BRON) return;
  const scopeEl=document.getElementById('memoScope');
  MEMO_BRON.scope=scopeEl?scopeEl.value:'landelijk';
  MEMO_BRON.kostenAan=!!document.getElementById('memoKosten')?.checked;
  const niveau=document.querySelector('input[name="memoNiveau"]:checked').value;
  const koppelBW=document.getElementById('memoKoppelBW').checked;
  const lieke=!!(document.getElementById('memoLieke')&&document.getElementById('memoLieke').checked);
  const zwEl=document.getElementById('memoZwaartepunt');
  MEMO_ZWAARTEPUNT = zwEl ? Number(zwEl.value) : 50;
  const titel=document.getElementById('memoModalTitel').value||MEMO_TITEL;
  const preview=document.getElementById('memoPreview');
  preview.innerHTML=lieke?memoLiekeDocument(MEMO_BRON, titel):memoDocument(MEMO_BRON, niveau, koppelBW, titel);
  nummerGrafiekenEnTabellen(preview);
}
function memoKopieer(){
  const el=document.getElementById('memoDocInhoud'); if(!el) return;
  const tekst=el.innerText;
  navigator.clipboard.writeText(tekst).then(()=>{
    const b=document.getElementById('memoKopieerBtn'); const t=b.textContent; b.textContent='✓ Gekopieerd'; setTimeout(()=>b.textContent=t,2000);
  });
}
function memoPrint(){
  const el=document.getElementById('memoDocInhoud'); if(!el) return;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>Memo VWM</title>
    <style>body{font-family:'Segoe UI',sans-serif;color:#1a2236;margin:40px auto;max-width:720px;line-height:1.5}
    .memo-doc::before{content:'';display:block;height:5px;background:linear-gradient(to right,#e17000 50%,#003082 50%);margin-bottom:20px}
    .memo-org{font-size:11px;color:#e17000;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    .memo-titel{font-size:19px;font-weight:700;color:#003082;margin:3px 0}
    .memo-meta{font-size:11px;color:#555;margin-bottom:8px}
    .memo-kop{display:flex;justify-content:space-between;border-bottom:2px solid #003082;padding-bottom:10px;margin-bottom:16px}
    .memo-stempel{text-align:right;font-size:9px;color:#888;text-transform:uppercase}
    .memo-concept{color:#e17000;font-weight:700;font-size:12px}
    h3{font-size:13px;color:#003082;margin:16px 0 5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
    p{font-size:12.5px;margin:0 0 9px}
    ul{margin:4px 0 9px 18px}li{font-size:12.5px;margin-bottom:4px}
    table.memo-samenvatting{width:100%;border-collapse:collapse;border:1px solid #d0d6de;margin-bottom:12px}
    table.memo-samenvatting td{padding:4px 8px;font-size:11px;border-bottom:1px solid #eef0f3}
    td.ml{color:#555;width:130px;font-weight:600}
    .lieke-chart{border:1px solid #d0d6de;border-radius:6px;background:#fff;margin:8px 0 10px;padding:8px;break-inside:avoid;page-break-inside:avoid}
    .lieke-chart svg{width:100%;height:220px;display:block}
    .lieke-chart .mc-svg{width:100%;height:220px;display:block}
    .lieke-legend{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:10.5px;color:#555;margin:4px 0 10px}
    .lieke-legend span{display:inline-flex;align-items:center;gap:5px}.lieke-legend i{width:10px;height:10px;border-radius:50%;display:inline-block}
    table.lieke-blokken{width:100%;border-collapse:collapse;border:1px solid #d0d6de;margin:8px 0 14px;font-size:10.2px}
    table.lieke-blokken th{background:#003082;color:#fff;text-align:left;padding:5px 6px;font-size:9.5px}
    table.lieke-blokken td{padding:5px 6px;border-bottom:1px solid #eef0f3;vertical-align:top}
    table.lieke-blokken td.num{text-align:right;white-space:nowrap}
    table.lieke-blokken tbody tr:nth-child(even){background:#f6f8fb}
    .lieke-drip-list{margin:0;padding-left:16px}.lieke-drip-list li{font-size:10.2px;margin:0 0 3px;line-height:1.35}
    .lieke-duiding{font-size:11px;line-height:1.45;margin:6px 0 10px;color:#1a2236}
    .lieke-drip-curve-card{border:1px solid #d0d6de;border-left:4px solid #003082;border-radius:6px;padding:8px 9px;margin:8px 0 11px;background:#fff;break-inside:avoid;page-break-inside:avoid}
    .lieke-drip-curve-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:4px;font-size:10.5px}
    .lieke-drip-curve-head .cat{white-space:nowrap;color:#555;font-size:9.5px}.lieke-drip-curve-card svg{width:100%;height:205px;display:block}
    .memo-onder{margin-top:24px;font-size:12px;color:#444;line-height:2}
    .memo-paraaf{font-size:10px;color:#888}
    h4{font-size:13px;color:#003082;margin:18px 0 5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
    .memo-bijlage{margin-top:26px;border-top:3px double #003082;padding-top:6px;page-break-before:always}
    .bjl-kop{background:#f2f5f9;border-left:4px solid #003082;padding:10px 14px;margin:14px 0 16px}
    .bjl-label{font-size:10px;font-weight:700;color:#e17000;text-transform:uppercase;letter-spacing:.05em}
    .bjl-titel{font-size:16px;font-weight:700;color:#003082;margin:2px 0}
    .bjl-sub{font-size:11px;color:#555;line-height:1.5}
    .bjl-p{font-size:11px;color:#1a2236;line-height:1.5;margin:0 0 7px}
    .bjl-note{font-size:10.5px;color:#666;font-style:italic;margin:5px 0 8px}
    .bjl-slot{font-size:10.5px;color:#555;margin-top:16px;padding-top:9px;border-top:1px solid #d0d6de}
    table.bjl-tbl{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:11px}
    table.bjl-tbl.klein{font-size:10px}
    table.bjl-tbl th{background:#003082;color:#fff;text-align:left;padding:5px 7px;font-size:10px}
    table.bjl-tbl th.num,table.bjl-tbl td.num{text-align:right}
    table.bjl-tbl td{padding:4px 7px;border-bottom:1px solid #eef0f3}
    table.bjl-tbl tbody tr:nth-child(even){background:#f6f8fb}
    .bjl-2kol{display:flex;gap:14px}.bjl-2kol>div{flex:1}
    .route-context-grid{display:grid;grid-template-columns:1fr;gap:8px;margin:7px 0 12px}
    .route-context-item{border:1px solid #d0d6de;border-left:3px solid #003082;border-radius:4px;padding:8px 10px;background:#fff}
    .route-context-item.werk{border-left-color:#e17000}.route-context-item.route{border-left-color:#1a8a4a}
    .route-context-title{font-size:11.5px;font-weight:800;color:#003082;margin-bottom:3px}
    .route-context-meta{font-size:10.8px;color:#1a2236;line-height:1.45}.route-context-meta b{color:#003082}
    .route-context-pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
    .route-context-pill{font-size:10px;background:#f2f5f9;border:1px solid #d0d6de;border-radius:10px;padding:2px 7px;color:#555}
    .route-context-img{margin:7px 0 0}.route-context-img img{max-width:100%;border:1px solid #d0d6de;border-radius:4px;display:block}.route-context-img figcaption{font-size:10px;color:#666;margin-top:3px}
    @media print{body{margin:0}table.bjl-tbl{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head><body>${el.outerHTML}</body></html>`);
  w.document.close(); setTimeout(()=>w.print(),300);
}
function memoWord(){
  const el=document.getElementById('memoDocInhoud'); if(!el)return;
  const titel=document.getElementById('memoModalTitel').value||MEMO_TITEL||'Monte Carlo memo';
  downloadWordDocument('memoDocInhoud',titel);
}

/* Automatisch begeleidend schrijven onder beide Monte Carlo-resultaten. De
   schermtekst gebruikt dezelfde bronobjecten als de formele memo. */
function monteCarloMemoBron(type){
  if(type==='montecarlo'){
    if(!MC_RESULT||!MC_SCHERM)return null;
    return {type:'montecarlo',mc:MC_RESULT,kansOnder:MC_SCHERM.kansOnder,norm:MC_SCHERM.norm};
  }
  if(type==='drip-montecarlo') return DRIP_MC?{type:'drip-montecarlo',mc:DRIP_MC}:null;
  return null;
}
function monteCarloMethodeUitleg(type,bron){
  if(type==='drip-montecarlo'){
    const HI=bron.mc.historieInfo||{aan:false};
    return `Het DRIP-model simuleert terugkerende storingen met een leeftijdsafhankelijk Weibull-NHPP-proces. Herstel maakt een DRIP weer beschikbaar, maar zet de leeftijd niet terug. ${HI.aan?'De gekoppelde historie kalibreert per asset de incidentfrequentie en betrouwbare hersteltijd.':'Historische kalibratie stond uit; bouwjaar, levensduur, β en groeps-MTTR bepalen de uitkomst.'} Per run worden storingsaantal, parameteronzekerheid en reparatieduur samen getrokken. De dienstpercentages volgen in dezelfde run uit de gewogen DRIP-stilstand.`;
  }
  return `Het algemene model gebruikt per wegdeel een Gamma-Poisson-verdeling. Daarmee varieert niet alleen het toekomstige aantal storingen, maar ook de onbekende onderliggende storingsintensiteit. Reparatieduren worden uit de waargenomen duurverdeling getrokken. Waar passende bouwjaren beschikbaar zijn, schaalt een Weibull-NHPP-laag de historische rate met de veroudering mee. Zonder leeftijdscohort blijft het betreffende wegdeel stationair.`;
}
function monteCarloBegeleidendSchrijvenKaart(type){
  const bron=monteCarloMemoBron(type); if(!bron)return '';
  bron.kostenAan=!!KOSTEN_BEGELEID[type];
  const s=memoSecties(bron,'tactisch',false);
  const isDrip=type==='drip-montecarlo';
  const id=isDrip?'mcBegeleidDrip':'mcBegeleidAlgemeen';
  const titel=isDrip?'Begeleidend schrijven bij de DRIP Monte Carlo-analyse':'Begeleidend schrijven bij de Monte Carlo-analyse';
  return `<div class="card mc-begeleid" id="${id}">
    <div class="mc-begeleid-kop">
      <div><h3>${titel}</h3><p class="mc-begeleid-inleiding">Automatisch opgesteld uit de zojuist gedraaide simulatie. Alle cijfers hieronder komen uit dezelfde runset als de tabellen en grafieken.</p></div>
      <div class="mc-begeleid-acties">
        <button class="tb-btn re-sec" onclick="kopieerBegeleidendSchrijven('${id}Inhoud',this)">📋 Tekst kopiëren</button>
        <button class="tb-btn re-sec" onclick="downloadWordDocument('${id}Inhoud','${isDrip?'DRIP Monte Carlo-analyse':'Monte Carlo-analyse'}')">📝 Word (.docx)</button>
        <button class="tb-btn re-sec" onclick="printBegeleidendSchrijven('${id}Inhoud','${isDrip?'DRIP Monte Carlo-analyse':'Monte Carlo-analyse'}')">🖨️ Afdrukken / PDF</button>
        <button class="memo-knop" onclick="opentMemo('${type}')">📄 Volledige memo met bijlage</button>
      </div>
    </div>
    <label class="memo-check"><input type="checkbox" ${bron.kostenAan?'checked':''} onchange="kostenBegeleidToggle('${type}',this.checked)"> Kosten meenemen, inclusief bronvermelding</label>
    <div id="${id}Inhoud">
      <div class="mc-begeleid-sectie"><h4>1. Aanleiding en doel</h4><p>${s.aanleiding}</p></div>
      <div class="mc-begeleid-sectie"><h4>2. Methode en betekenis van de bandbreedte</h4><p>${monteCarloMethodeUitleg(type,bron)} De p50 is de mediaan en geen garantie. In circa 90% van de gesimuleerde toekomsten valt de uitkomst tussen p5 en p95.</p></div>
      <div class="mc-begeleid-sectie"><h4>3. Resultaten</h4><p>${s.beschrijving}</p></div>
      <div class="mc-begeleid-sectie"><h4>4. Duiding en risico</h4><p>${s.risico}</p></div>
      <div class="mc-begeleid-sectie"><h4>5. Conclusie</h4><p>${s.conclusie}</p></div>
      <div class="mc-begeleid-sectie"><h4>6. Advies en vervolg</h4><ul>${s.besluit.map(x=>`<li>${x}</li>`).join('')}</ul></div>
      <div class="mc-begeleid-sectie"><h4>7. Verwacht effect van het advies</h4><p>${s.uitkomst}</p></div>
      ${kostenMemoHtml(bron)}
      <div class="mc-begeleid-leeswijzer"><b>Gebruik bij besluitvorming.</b> Lees de mediaan altijd samen met de p5-p95-band, de gebruikte databronnen en de datakwaliteit. Vergelijk alternatieven alleen met dezelfde periode, selectie, parameters en historische kalibratie.</div>
    </div>
  </div>`;
}
function schrijfNaarKlembord(tekst){
  if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(tekst);
  return new Promise((resolve,reject)=>{
    try{
      const t=document.createElement('textarea'); t.value=tekst; t.setAttribute('readonly','');
      t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select();
      const ok=document.execCommand('copy'); document.body.removeChild(t); ok?resolve():reject(new Error('kopiëren niet ondersteund'));
    }catch(err){reject(err);}
  });
}
function kopieerBegeleidendSchrijven(id,knop){
  const el=document.getElementById(id); if(!el)return;
  schrijfNaarKlembord(el.innerText).then(()=>{
    const oud=knop.textContent; knop.textContent='✓ Gekopieerd'; setTimeout(()=>knop.textContent=oud,2000);
  }).catch(()=>alert('Kopiëren is door de browser geblokkeerd. Selecteer de tekst handmatig.'));
}
function printBegeleidendSchrijven(id,titel){
  const el=document.getElementById(id); if(!el)return;
  const w=window.open('','_blank'); if(!w){alert('Sta pop-ups toe om het begeleidend schrijven af te drukken.');return;}
  w.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>${titel}</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1a2236;margin:32px auto;max-width:780px;line-height:1.55}
    body:before{content:'';display:block;height:5px;background:linear-gradient(to right,#e17000 50%,#003082 50%);margin-bottom:22px}
    h1{font-size:21px;color:#003082;border-bottom:2px solid #003082;padding-bottom:9px;margin:0 0 18px}
    h4{font-size:14px;color:#003082;margin:18px 0 5px;border-bottom:1px solid #d8dde5;padding-bottom:3px}
    p,li{font-size:12.5px}ul{margin:5px 0 12px 20px;padding:0}.mc-begeleid-leeswijzer{background:#fff7d6;border:1px solid #eedb9a;padding:10px 12px;margin-top:15px;font-size:11.5px}
    @media print{body{margin:0;max-width:none}h4{break-after:avoid}li{break-inside:avoid}}
  </style></head><body><h1>${titel}</h1>${kostenSchoneKopie(el).innerHTML}</body></html>`);
  w.document.close(); setTimeout(()=>w.print(),300);
}

/* Zelfstandige DOCX-export zonder externe bibliotheek. Het document wordt als
   geldige Open XML-container opgebouwd. Koppen, alinea's, lijsten en tabellen
   uit het begeleidend schrijven of de volledige memo blijven bewerkbaar. */
function wordXmlEsc(v){
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function wordBestandsnaam(titel){
  const s=String(titel||'monte-carlo-rapport').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  return (s||'monte-carlo-rapport')+'.docx';
}
function wordParagraafXml(tekst,stijl,vet){
  const pPr=stijl?`<w:pPr><w:pStyle w:val="${stijl}"/></w:pPr>`:'';
  const rPr=vet?'<w:rPr><w:b/></w:rPr>':'';
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${wordXmlEsc(tekst)}</w:t></w:r></w:p>`;
}
function wordTabelXml(table){
  const rijen=[];
  for(let ri=0;ri<table.rows.length;ri++){
    const row=table.rows[ri], kop=String(row.parentElement&&row.parentElement.tagName||'').toUpperCase()==='THEAD'||ri===0;
    const cellen=[];
    for(const cel of row.cells){
      const tekst=String(cel.innerText||cel.textContent||'').replace(/\s+/g,' ').trim();
      cellen.push(`<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${wordParagraafXml(tekst,'',kop)}</w:tc>`);
    }
    rijen.push(`<w:tr>${cellen.join('')}</w:tr>`);
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C2CE"/><w:left w:val="single" w:sz="4" w:color="B8C2CE"/><w:bottom w:val="single" w:sz="4" w:color="B8C2CE"/><w:right w:val="single" w:sz="4" w:color="B8C2CE"/><w:insideH w:val="single" w:sz="2" w:color="DDE3EA"/><w:insideV w:val="single" w:sz="2" w:color="DDE3EA"/></w:tblBorders></w:tblPr>${rijen.join('')}</w:tbl>${wordParagraafXml('')}`;
}
function wordInhoudVanElement(el,titel){
  const blokken=[wordParagraafXml(titel,'Heading1')];
  const voegTekst=(tekst,stijl,prefix)=>{
    String(tekst||'').split(/\r?\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)
      .forEach(x=>blokken.push(wordParagraafXml((prefix||'')+x,stijl||'')));
  };
  const loop=node=>{
    if(!node||node.nodeType!==1)return;
    const tag=String(node.tagName||'').toUpperCase();
    if(['BUTTON','SCRIPT','STYLE'].includes(tag))return;
    if(tag==='TABLE'){blokken.push(wordTabelXml(node));return;}
    if(tag==='H1'||tag==='H2'){voegTekst(node.innerText||node.textContent,'Heading1');return;}
    if(tag==='H3'){voegTekst(node.innerText||node.textContent,'Heading2');return;}
    if(tag==='H4'){voegTekst(node.innerText||node.textContent,'Heading3');return;}
    if(tag==='P'){voegTekst(node.innerText||node.textContent,'');return;}
    if(tag==='LI'){voegTekst(node.innerText||node.textContent,'','• ');return;}
    const kinderen=Array.from(node.children||[]);
    const heeftBlok=kinderen.some(x=>['DIV','SECTION','ARTICLE','H1','H2','H3','H4','P','UL','OL','LI','TABLE'].includes(String(x.tagName||'').toUpperCase()));
    if(!heeftBlok&&String(node.innerText||node.textContent||'').trim()){
      if(!/\bmemo-titel\b/.test(String(node.className||'')))voegTekst(node.innerText||node.textContent,'');
      return;
    }
    kinderen.forEach(loop);
  };
  Array.from(el.children||[]).forEach(loop);
  return blokken.join('');
}
function wordCrcTabel(){
  if(wordCrcTabel.cache)return wordCrcTabel.cache;
  const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}
  wordCrcTabel.cache=t; return t;
}
function wordCrc32(bytes){
  const t=wordCrcTabel(); let c=0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++)c=t[(c^bytes[i])&255]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function wordU16(n){return Uint8Array.of(n&255,(n>>>8)&255);}
function wordU32(n){return Uint8Array.of(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);}
function wordConcat(arrays){
  const n=arrays.reduce((s,a)=>s+a.length,0),uit=new Uint8Array(n); let p=0;
  arrays.forEach(a=>{uit.set(a,p);p+=a.length;}); return uit;
}
function wordZip(bestanden){
  const enc=new TextEncoder(), lokaal=[],centraal=[]; let offset=0;
  const nu=new Date(), tijd=(nu.getHours()<<11)|(nu.getMinutes()<<5)|Math.floor(nu.getSeconds()/2);
  const datum=((Math.max(1980,nu.getFullYear())-1980)<<9)|((nu.getMonth()+1)<<5)|nu.getDate();
  Object.entries(bestanden).forEach(([naam,inhoud])=>{
    const nb=enc.encode(naam),data=typeof inhoud==='string'?enc.encode(inhoud):inhoud,crc=wordCrc32(data);
    const lh=wordConcat([wordU32(0x04034b50),wordU16(20),wordU16(0x0800),wordU16(0),wordU16(tijd),wordU16(datum),wordU32(crc),wordU32(data.length),wordU32(data.length),wordU16(nb.length),wordU16(0),nb,data]);
    lokaal.push(lh);
    centraal.push(wordConcat([wordU32(0x02014b50),wordU16(20),wordU16(20),wordU16(0x0800),wordU16(0),wordU16(tijd),wordU16(datum),wordU32(crc),wordU32(data.length),wordU32(data.length),wordU16(nb.length),wordU16(0),wordU16(0),wordU16(0),wordU16(0),wordU32(0),wordU32(offset),nb]));
    offset+=lh.length;
  });
  const cd=wordConcat(centraal),einde=wordConcat([wordU32(0x06054b50),wordU16(0),wordU16(0),wordU16(centraal.length),wordU16(centraal.length),wordU32(cd.length),wordU32(offset),wordU16(0)]);
  return new Blob([...lokaal,cd,einde],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function downloadWordDocument(id,titel){
  const el=document.getElementById(id); if(!el)return;
  const inhoud=wordInhoudVanElement(kostenSchoneKopie(el),titel),gemaakt=new Date().toISOString();
  const bestanden={
    '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    '_rels/.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    'word/_rels/document.xml.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'word/styles.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr><w:rPr><w:b/><w:color w:val="003082"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="003082"/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="003082"/><w:sz w:val="23"/></w:rPr></w:style></w:styles>`,
    'word/document.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${inhoud}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    'docProps/core.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${wordXmlEsc(titel)}</dc:title><dc:creator>Rijkswaterstaat VWM</dc:creator><cp:lastModifiedBy>Rijkswaterstaat VWM</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${gemaakt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${gemaakt}</dcterms:modified></cp:coreProperties>`,
    'docProps/app.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Dienstimpact-analyse VWM</Application></Properties>`
  };
  const blob=wordZip(bestanden),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url; a.download=wordBestandsnaam(titel); a.click(); setTimeout(()=>{if(URL.revokeObjectURL)URL.revokeObjectURL(url);},1500);
}

function statusVan(besch,norm){
  if(besch>=norm) return {k:'groen',t:'Op norm'};
  if(besch>=norm-1) return {k:'geel',t:'Krap'};
  if(besch>=norm-3) return {k:'oranje',t:'Onder norm'};
  return {k:'rood',t:'Kritiek'};
}
function beschKleur(b,norm){
  if(b>=norm) return 'var(--groen)';
  if(b>=norm-1) return 'var(--rws-geel)';
  if(b>=norm-3) return 'var(--oranje)';
  return 'var(--rood)';
}
function fmt(v,d=2){return v==null?'–':(+v).toFixed(d);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
/* tooltip-icoon met uitlegbubbel; body mag HTML bevatten (b, .frm) */
function tip(body,left){return `<span class="tip${left?' tip-left':''}" tabindex="0">i<span class="tip-body">${body}</span></span>`;}
function tekstLabelVan(el){
  if(!el)return '';
  const c=el.cloneNode(true);
  c.querySelectorAll('.tip,.badge,.tag').forEach(x=>x.remove());
  return c.textContent.replace(/\s+/g,' ').trim();
}
function labelTitel(el){
  let p=el.previousElementSibling,stappen=0;
  while(p&&stappen<6){
    if(p.matches&&p.matches('h3,h4,.bjl-titel'))return tekstLabelVan(p)||'Onderdeel';
    p=p.previousElementSibling;stappen++;
  }
  const h=el.closest('.card,.mc-popup-inner,.memo-doc,.memo-bijlage')?.querySelector('h3,h4,.bjl-titel');
  return tekstLabelVan(h) || 'Onderdeel';
}
function vizTooltip(soort,titel){
  const t=esc(titel||'dit onderdeel');
  if(soort==='Figuur'){
    return `<b>${t}</b><br>Deze grafiek vertaalt de berekende gegevens naar een visueel patroon. Lees eerst de titel en legenda, daarna de assen: horizontaal staat meestal de tijd, categorie of verdeling; verticaal staat de score, kans, beschikbaarheid, prestatie of omvang. Let vooral op uitschieters, dalende lijnen, brede onzekerheidsbanden en waarden onder de norm. Gebruik de grafiek als snelle duiding; raadpleeg de bijbehorende tabel voor exacte waarden.`;
  }
  return `<b>${t}</b><br>Deze tabel toont de onderliggende waarden achter de analyse. Lees per rij het object, gebied, assettype of maatregel en vergelijk daarna de numerieke kolommen. Kolommen met percentages gaan meestal over beschikbaarheid, prestatie of impact; uren en aantallen tonen de omvang van de onderliggende oorzaak. Sorteer of scan vooral op lage prestaties, hoge verliesuren en grote aantallen meldingen.`;
}
function nummerGrafiekenEnTabellen(root){
  const scope=root||document;
  scope.querySelectorAll('.viz-label').forEach(el=>el.remove());
  let fig=1,tab=1;
  scope.querySelectorAll('.chart-wrap').forEach(wrap=>{
    const titel=labelTitel(wrap);
    const label=document.createElement('div');
    label.className='viz-label';
    label.innerHTML=`<span class="viz-kind">Figuur ${fig++}</span><span>${esc(titel)}</span>${tip(vizTooltip('Figuur',titel),true)}`;
    wrap.parentNode.insertBefore(label,wrap);
  });
  scope.querySelectorAll('.tbl-scroll').forEach(wrap=>{
    if(!wrap.querySelector('table'))return;
    const titel=labelTitel(wrap);
    const label=document.createElement('div');
    label.className='viz-label';
    label.innerHTML=`<span class="viz-kind">Tabel ${tab++}</span><span>${esc(titel)}</span>${tip(vizTooltip('Tabel',titel),true)}`;
    wrap.parentNode.insertBefore(label,wrap);
  });
  scope.querySelectorAll('table.tbl,table.mini-tbl,table.bjl-tbl').forEach(table=>{
    if(table.closest('.tbl-scroll'))return;
    const titel=labelTitel(table);
    const label=document.createElement('div');
    label.className='viz-label';
    label.innerHTML=`<span class="viz-kind">Tabel ${tab++}</span><span>${esc(titel)}</span>${tip(vizTooltip('Tabel',titel),true)}`;
    table.parentNode.insertBefore(label,table);
  });
}
let VIZ_NUMMERING_TIMER=null;
function nodeBevatGrafiekOfTabel(n){
  if(!n||n.nodeType!==1||n.classList.contains('viz-label'))return false;
  if(n.matches&&n.matches('.chart-wrap,.tbl-scroll,table.tbl,table.mini-tbl,table.bjl-tbl'))return true;
  return !!(n.querySelector&&n.querySelector('.chart-wrap,.tbl-scroll,table.tbl,table.mini-tbl,table.bjl-tbl'));
}
function planGrafiekTabelNummering(){
  if(VIZ_NUMMERING_TIMER)clearTimeout(VIZ_NUMMERING_TIMER);
  VIZ_NUMMERING_TIMER=setTimeout(()=>{VIZ_NUMMERING_TIMER=null;nummerGrafiekenEnTabellen(document);},0);
}
document.addEventListener('DOMContentLoaded',()=>{
  if(!document.body)return;
  new MutationObserver(muts=>{
    if(muts.some(m=>[...m.addedNodes].some(nodeBevatGrafiekOfTabel)))planGrafiekTabelNummering();
  }).observe(document.body,{childList:true,subtree:true});
});

/* ══════════════════════════════════════════════════════════════
   MONTE CARLO — prognose van toekomstige uitval o.b.v. historie
   Model: Gamma-Poisson per wegdeel, zodat de historische rate zelf ook
   onzeker is. Hersteltijden en zwaarte worden empirisch gebootstrapt.
   Een optionele Weibull/NHPP-factor schaalt de rate met assetleeftijd;
   zonder passend cohort blijft een expliciete stationaire fallback.
   ══════════════════════════════════════════════════════════════ */
function poissonSample(lambda){
  if(lambda<=0) return 0;
  if(lambda>30){ // normale benadering voor grote lambda
    const g=lambda + Math.sqrt(lambda)*gaussSample();
    return Math.max(0, Math.round(g));
  }
  const L=Math.exp(-lambda); let k=0,p=1;
  do{ k++; p*=Math.random(); }while(p>L);
  return k-1;
}
let _gaussSpare=null;
function gaussSample(){
  if(_gaussSpare!=null){ const s=_gaussSpare; _gaussSpare=null; return s; }
  let u=0,v=0,s=0;
  do{ u=Math.random()*2-1; v=Math.random()*2-1; s=u*u+v*v; }while(s>=1||s===0);
  const f=Math.sqrt(-2*Math.log(s)/s); _gaussSpare=v*f; return u*f;
}

function gammaSample(shape,rate){
  shape=Math.max(shape,1e-6); rate=Math.max(rate,1e-9);
  if(shape<1) return gammaSample(shape+1,rate)*Math.pow(Math.max(Math.random(),1e-12),1/shape);
  const d=shape-1/3, c=1/Math.sqrt(9*d);
  while(true){
    let x=gaussSample(), v=1+c*x; if(v<=0) continue; v=v*v*v;
    const u=Math.random();
    if(u<1-0.0331*x*x*x*x || Math.log(u)<0.5*x*x+d*(1-v+Math.log(v))) return d*v/rate;
  }
}
function lognormaalGemiddelde(mean,cv){
  if(!(mean>0)) return 0;
  const s2=Math.log(1+Math.max(0,cv||0)**2);
  return Math.exp(Math.log(mean)-s2/2+Math.sqrt(s2)*gaussSample());
}
function lognormaalFactor(cv){ return lognormaalGemiddelde(1,cv); }
function isoDatumLokaal(d){
  const z=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());
}
function datumMsLokaal(s){
  const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?new Date(+m[1],+m[2]-1,+m[3]).getTime():NaN;
}
function datumEindeExclusiefMs(s){ const t=datumMsLokaal(s); return isNaN(t)?NaN:t+24*3600e3; }
function jarenTussenMs(a,b){ return Math.max(0,(b-a)/(365.25*24*3600e3)); }
function decimaalJaar(ms){
  const d=new Date(ms), j=d.getFullYear();
  const a=new Date(j,0,1).getTime(), b=new Date(j+1,0,1).getTime();
  return j+(ms-a)/(b-a);
}

function mcCohortVoor(wd,typeId){
  if(!DVM_LEEFTIJD_STATE) return null;
  const vc=VC_MAP[String(wd.vc||'').toUpperCase()]||String(wd.vc||'').toUpperCase();
  return DVM_LEEFTIJD_STATE.exact[[vc,wd.weg,wd.richting||'',typeId].join('|')]
    || DVM_LEEFTIJD_STATE.weg[[vc,wd.weg,typeId].join('|')] || null;
}

/* Zet de gekozen kalenderperiode om naar equivalente blootstellingsjaren.
   De historische rate blijft de kalibratiebasis; alleen de relatieve
   leeftijdshazard wordt met het register vooruitgeschoven. */
function mcLeeftijdEquivalent(wd,vanMs,totMs,histPeriodeJr){
  const horizon=jarenTussenMs(vanMs,totMs);
  const vcLive=normAssetVc(wd.vc),richtingLive=normAssetRichting(wd.richting);
  let live=ASSET_INDEX?(ASSET_INDEX.byTypeRoad.get(['MSI',wd.weg].join('|'))||[]):[];
  live=live.filter(a=>a.prognoseActief&&(!vcLive||!a.vc||normAssetVc(a.vc)===vcLive)&&(!richtingLive||!a.richting||normAssetRichting(a.richting)===richtingLive));
  const liveMetJaar=live.filter(a=>a.bouwjaar);
  if(liveMetJaar.length&&horizon>0){
    const nu=Date.now(),histStart=nu-histPeriodeJr*365.25*24*3600e3;
    let hHist=0,hVoor=0;const levensduren=[];
    liveMetJaar.forEach(a=>{
      const rel=assetReliability({...a,assetType:'MSI',_assetKey:a.key,_eolLife:a.eolLevensduur,_eolLifeBron:a.eolLevensduurBron});
      levensduren.push(rel.L);
      hHist+=verwachteEventsInterval(rel,Math.max(0,decimaalJaar(histStart)-a.bouwjaar),Math.max(0,decimaalJaar(nu)-a.bouwjaar));
      hVoor+=verwachteEventsInterval(rel,Math.max(0,decimaalJaar(vanMs)-a.bouwjaar),Math.max(0,decimaalJaar(totMs)-a.bouwjaar));
    });
    const histPerJaar=hHist/Math.max(histPeriodeJr,1/365.25),voorPerJaar=hVoor/Math.max(horizon,1/365.25);
    const ratio=histPerJaar>0?voorPerJaar/histPerJaar:1,dekk=liveMetJaar.length/Math.max(live.length,1),maxF=RULES.cfg.maxLeeftijdFactor||5;
    const factor=Math.max(.2,Math.min(maxF,(1-dekk)+dekk*ratio));levensduren.sort((a,b)=>a-b);
    return {equivJr:horizon*factor,factor,dekking:dekk,bron:'assetleeftijd per individueel asset',levensduurBron:'All Assets + assetconfiguratie',
      levensduur:levensduren[Math.floor(levensduren.length/2)],cohortN:live.length,metJaar:liveMetJaar.length};
  }
  const cohort=mcCohortVoor(wd,'MSI');
  if(!cohort || !cohort.metJaar || horizon<=0) return {equivJr:horizon,factor:1,dekking:0,bron:'stationair'};
  herberekenRegisterDekking();
  const life=ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.reliabilityByType&&ASSET_REGISTER_STATE.reliabilityByType.MSI;
  const rel=assetReliability({assetType:'MSI',_eolLife:life&&life.lifeMedian,
    _betaOverride:life&&life.betaMedian,
    _eolLifeBron:life?'geladen assetregister/EOL (mediaan, n='+life.n+')':null});
  const nu=Date.now(), histStart=nu-histPeriodeJr*365.25*24*3600e3;
  let hHist=0,hVoor=0;
  Object.entries(cohort.jaren).forEach(([j,n])=>{
    const bouw=+j;
    hHist+=n*verwachteEventsInterval(rel,Math.max(0,decimaalJaar(histStart)-bouw),Math.max(0,decimaalJaar(nu)-bouw));
    hVoor+=n*verwachteEventsInterval(rel,Math.max(0,decimaalJaar(vanMs)-bouw),Math.max(0,decimaalJaar(totMs)-bouw));
  });
  const histPerJaar=hHist/Math.max(histPeriodeJr,1/365.25);
  const voorPerJaar=hVoor/Math.max(horizon,1/365.25);
  const ratio=histPerJaar>0?voorPerJaar/histPerJaar:1;
  const dekking=cohort.metJaar/Math.max(cohort.totaal,1);
  const maxF=RULES.cfg.maxLeeftijdFactor||5;
  const factor=Math.max(0.2,Math.min(maxF,(1-dekking)+dekking*ratio));
  return {equivJr:horizon*factor,factor,dekking,bron:'assetleeftijd',levensduurBron:rel.bron,
    levensduur:rel.L,cohortN:cohort.totaal,metJaar:cohort.metJaar};
}

function mcPriorContext(wegdelen,histPeriodeJr){
  const histBron=mcHistorieBron();
  let events=0, bloot=0;
  wegdelen.filter(w=>w.meldingen&&w.meldingen.length).forEach(w=>{
    const h=mcHistVoor(w.vc,w.weg,w.richting,w.N);
    const jr=h&&h.events>0?histBron.periodeJr:histPeriodeJr;
    const ev=h&&h.events>0?h.events:w.n;
    events+=ev; bloot+=(w.N||1)*jr;
  });
  return {ratePerAsset:bloot>0?events/bloot:0};
}

function mcRateInfo(wd,histPeriodeJr,prior){
  const histBron=mcHistorieBron();
  const hist=mcHistVoor(wd.vc,wd.weg,wd.richting,wd.N);
  const gebruikLogs=!!hist&&hist.events>0;
  const events=gebruikLogs?hist.events:wd.n;
  const obsJr=gebruikLogs?histBron.periodeJr:histPeriodeJr;
  const ruweRate=events/Math.max(obsJr,1/52);
  const priorJr=RULES.cfg.mcPriorJaren||0.5;
  const priorMean=Math.max(0.01,(prior&&prior.ratePerAsset>0)?prior.ratePerAsset*(wd.N||1):ruweRate);
  const shape=Math.max(0.01,events+priorMean*priorJr);
  const ratePar=Math.max(0.01,obsJr+priorJr);
  return {hist,gebruikLogs,events,obsJr,ruweRate,shape,ratePar,mean:shape/ratePar,
    bron:gebruikLogs?(hist.fallback?'logs-fallback':'logs'):'historie-rijen',laagN:events<20};
}

function mcWegConfig(wd,histPeriodeJr,vanMs,totMs,prior){
  const ri=mcRateInfo(wd,histPeriodeJr,prior);
  const age=mcLeeftijdEquivalent(wd,vanMs,totMs,mcHistorieBron().periodeJr);
  const c={wd,ri,age,N:wd.N||1,
    zPool:wd.meldingen.map(m=>({z:m.zwaarteA,zp:m.zwaarteP})),
    /* Een afgeleide duur telt hier als ontbrekend en valt terug op de MTTR,
       net als een melding zonder duur. Zo groeit de herstelduur in de simulatie
       niet mee met de afstand tussen twee momentopnamen. */
    durPool:ri.gebruikLogs?null:wd.meldingen.map(m=>Math.min((m.duurBetrouwbaar&&m.duurUren)||(+((assetOverrideVoor(m.assetKey)||{}).mttr)>0?+assetOverrideVoor(m.assetKey).mttr:RULES.cfg.hw_mttr),180*24))};
  c.lossMoment=mcLossMomenten(c,(totMs-vanMs)/3600e3);
  return c;
}

function momenten(vals){
  const n=Math.max(vals.length,1), gem=vals.reduce((s,x)=>s+x,0)/n;
  const e2=vals.reduce((s,x)=>s+x*x,0)/n;
  return {gem,var:Math.max(0,e2-gem*gem)};
}
function mcLossMomenten(c,horizonUren){
  if(!c.ri.gebruikLogs){
    return {
      a:momenten(c.zPool.map((z,i)=>z.z*Math.min(c.durPool[i],horizonUren))),
      p:momenten(c.zPool.map((z,i)=>z.zp*Math.min(c.durPool[i],horizonUren)))
    };
  }
  const zmA=momenten(c.zPool.map(z=>z.z)), zmP=momenten(c.zPool.map(z=>z.zp));
  let sd=0,sd2=0; const dp=c.ri.hist.durP, grens=Math.floor(dp.length*0.9);
  dp.forEach((dagen,i)=>{
    const d=Math.min(dagen*24,horizonUren);
    if(c.ri.hist.tailCensored && i>=grens){ sd+=Math.min(d*1.35,horizonUren); sd2+=Math.min(d*d*2,horizonUren*horizonUren); }
    else { sd+=d; sd2+=d*d; }
  });
  const md=sd/dp.length, ed2=sd2/dp.length;
  const product=(z)=>{ const ez2=z.var+z.gem*z.gem, gem=z.gem*md; return {gem,var:Math.max(0,ez2*ed2-gem*gem)}; };
  return {a:product(zmA),p:product(zmP)};
}
function mcCompoundVerlies(c,aantal,prestatie,horizonUren){
  if(aantal<=0) return 0;
  if(aantal<=25){
    let s=0;
    for(let i=0;i<aantal;i++){
      const idx=(Math.random()*c.zPool.length)|0, z=prestatie?c.zPool[idx].zp:c.zPool[idx].z;
      const d=Math.min(c.ri.gebruikLogs?bootDuurUren(c.ri.hist.durP,c.ri.hist.tailCensored):c.durPool[idx],horizonUren);
      s+=z*d;
    }
    return s;
  }
  const m=prestatie?c.lossMoment.p:c.lossMoment.a;
  return Math.max(0,aantal*m.gem+Math.sqrt(aantal*m.var)*gaussSample());
}
function mcForecastMoment(c,prestatie){
  const q=c.age.equivJr, meanRate=c.ri.shape/c.ri.ratePar;
  const varRate=c.ri.shape/(c.ri.ratePar*c.ri.ratePar);
  const meanN=meanRate*q, varN=meanN+varRate*q*q;
  const m=prestatie?c.lossMoment.p:c.lossMoment.a;
  return {gem:meanN*m.gem,var:Math.max(0,meanN*m.var+varN*m.gem*m.gem)};
}
function mcPositiefMomentSample(m){
  if(!(m.gem>0)||!(m.var>0)) return Math.max(0,m.gem||0);
  const shape=m.gem*m.gem/m.var;
  if(shape>1e5) return Math.max(0,m.gem+Math.sqrt(m.var)*gaussSample());
  return gammaSample(shape,m.gem/m.var);
}

/* Simuleer één wegdeel. Retourneert prognoseverdeling van de beschikbaarheid.
   Gebruikt de werkelijke historische frequentie én duurverdeling uit de logs.
   Als geen gecomprimeerde wegdeelreeks past, valt het model terug op de
   geladen historische incidentregels, nooit op de open-storingenlijst. */
function mcWegdeel(wd, histPeriodeJr, vanMs, totMs, runs, prior){
  if(!wd.meldingen.length) return null;
  const horizonJr=jarenTussenMs(vanMs,totMs);
  const horizonUren = (totMs-vanMs)/3600e3;
  const totBeschUren = wd.N*horizonUren;
  const c=mcWegConfig(wd,histPeriodeJr,vanMs,totMs,prior);
  const beschArr=new Float64Array(runs), prestArr=new Float64Array(runs);
  for(let r=0;r<runs;r++){
    const rate=gammaSample(c.ri.shape,c.ri.ratePar);
    const aantal=poissonSample(rate*c.age.equivJr);
    const vA=mcCompoundVerlies(c,aantal,false,horizonUren);
    const vP=mcCompoundVerlies(c,aantal,true,horizonUren);
    beschArr[r]=Math.max(0,Math.min(100,100-vA/totBeschUren*100));
    prestArr[r]=Math.max(0,Math.min(100,100-vP/totBeschUren*100));
  }
  return { besch:mcStats(beschArr), prestatie:mcStats(prestArr), rate:c.ri.mean, rateRuw:c.ri.ruweRate, runs,
    bron:c.ri.bron, events:c.ri.events, laagN:c.ri.laagN,
    leeftijdFactor:c.age.factor, leeftijdDekking:c.age.dekking, leeftijdBron:c.age.bron,
    tailCensored:!!(c.ri.hist&&c.ri.hist.tailCensored), parameterOnzekerheid:true };
}
function mcStats(arr){
  const a=Array.from(arr).sort((x,y)=>x-y);
  const q=p=>a[Math.min(a.length-1,Math.floor(p*a.length))];
  const gem=a.reduce((s,x)=>s+x,0)/a.length;
  return { p025:q(0.025),p5:q(0.05),p25:q(0.25),p50:q(0.5),p75:q(0.75),p95:q(0.95),p975:q(0.975),gem,min:a[0],max:a[a.length-1],_sorted:a,
           hist:histogram(a,14) };
}
function histogram(sorted,bins){
  const lo=sorted[0], hi=sorted[sorted.length-1];
  const span=Math.max(hi-lo,1e-6), w=span/bins;
  const h=new Array(bins).fill(0);
  sorted.forEach(v=>{ let b=Math.floor((v-lo)/w); if(b>=bins)b=bins-1; if(b<0)b=0; h[b]++; });
  return { lo,hi,w,counts:h,max:Math.max(...h) };
}

/* Netwerkbrede MC: som per run over alle wegdelen, areaalgewogen naar N. */
function mcNetwerk(wegdelen, histPeriodeJr, vanMs, totMs, runs, prior){
  const horizonUren=(totMs-vanMs)/3600e3;
  const beschArr=new Float64Array(runs);
  const wds=wegdelen.filter(w=>w.meldingen.length).map(w=>mcWegConfig(w,histPeriodeJr,vanMs,totMs,prior));
  const totN=wds.reduce((s,w)=>s+w.N,0)||1;
  let logsN=0,snapN=0,fallbackN=0,ageN=0,tailN=0,lowDataN=0,ageGew=0;
  wds.forEach(w=>{
    if(w.ri.gebruikLogs) logsN++; else snapN++;
    if(w.ri.bron==='logs-fallback') fallbackN++;
    if(w.age.bron==='assetleeftijd'){ ageN++; ageGew+=w.N*w.age.dekking; }
    if(w.ri.hist&&w.ri.hist.tailCensored) tailN++;
    if(w.ri.laagN) lowDataN++;
  });
  // De netwerkwaarde is algebraïsch de som van alle verliesuren gedeeld door
  // alle areaaluren. Voor snelheid en stabiliteit sommeren we daarom de exacte
  // eerste twee momenten van de Gamma-Poisson/compound-verliezen en trekken we
  // daaruit een positieve moment-equivalente verdeling.
  let verliesGem=0,verliesVar=0;
  wds.forEach(w=>{ const m=mcForecastMoment(w,false); verliesGem+=m.gem; verliesVar+=m.var; });
  for(let r=0;r<runs;r++){
    const verlies=mcPositiefMomentSample({gem:verliesGem,var:verliesVar});
    beschArr[r]=Math.max(0,Math.min(100,100-verlies/(totN*horizonUren)*100));
  }
  const st=mcStats(beschArr);
  Object.assign(st,{logsN,snapN,fallbackN,ageN,stationaryN:wds.length-ageN,tailN,lowDataN,
    leeftijdDekking:ageN?ageGew/totN:0,model:'Gamma-Poisson + compound-momenten + empirische duren + optionele leeftijdshazard'});
  return st;
}

/* ══════════════════════════════════════════════════════════════
   SVG-GRAFIEKEN (geen externe libs — werkt volledig offline)
   ══════════════════════════════════════════════════════════════ */
function svgBaseline(y){return `<line x1="0" y1="${y}" x2="100%" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;}

/* Horizontale staafgrafiek met normlijn per rij; waarden dicht bij 100%.
   items: [{label,val,norm,kleur}], schaal wordt uitgezoomd rond het bereik. */
function chartDienstNorm(items){
  const W=560,rowH=46,padL=150,padR=70,padT=10;
  const H=padT*2+items.length*rowH;
  const alle=items.flatMap(i=>[i.val,i.norm]);
  let min=Math.min(...alle), max=Math.max(...alle,100);
  min=Math.floor((min-0.3)*10)/10; if(min<0)min=0; max=100;
  const sx=v=>padL+((v-min)/(max-min))*(W-padL-padR);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  // gridlijnen
  const stap=(max-min)>3?1:0.5;
  for(let g=Math.ceil(min/stap)*stap; g<=max+1e-9; g+=stap){
    const x=sx(g);
    s+=`<line x1="${x}" y1="${padT}" x2="${x}" y2="${H-padT}" stroke="var(--panel)" stroke-width="1"/>`;
    s+=`<text x="${x}" y="${H-2}" text-anchor="middle" class="ax">${fmt(g,1)}</text>`;
  }
  items.forEach((it,i)=>{
    const y=padT+i*rowH+8, bh=17;
    const x0=sx(min), x1=sx(it.val);
    s+=`<text x="${padL-10}" y="${y+bh/2+4}" text-anchor="end" class="lbl">${esc(it.label)}</text>`;
    s+=`<rect x="${x0}" y="${y}" width="${Math.max(0,x1-x0)}" height="${bh}" rx="3" fill="${it.kleur}"/>`;
    s+=`<text x="${x1+6}" y="${y+bh/2+4}" class="val" fill="${it.kleur}">${fmt(it.val,2)}%</text>`;
    // normlijn
    const xn=sx(it.norm);
    s+=`<line x1="${xn}" y1="${y-3}" x2="${xn}" y2="${y+bh+3}" stroke="var(--rws-blauw-dark)" stroke-width="2" stroke-dasharray="3 2"/>`;
    s+=`<text x="${xn}" y="${y-5}" text-anchor="middle" class="norm">norm ${fmt(it.norm,0)}</text>`;
  });
  s+=`</svg>`;
  return s;
}

/* Gestapelde horizontale balk: statusverdeling wegdelen per dienst.
   rows:[{label, groen,geel,oranje,rood, totaal}] */
function chartStatusStack(rows){
  const W=560,rowH=34,padL=150,padR=10,padT=6;
  const H=padT*2+rows.length*rowH;
  const kleur={groen:'var(--groen)',geel:'var(--rws-geel)',oranje:'var(--oranje)',rood:'var(--rood)'};
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  rows.forEach((r,i)=>{
    const y=padT+i*rowH+6, bh=20, bw=W-padL-padR;
    s+=`<text x="${padL-10}" y="${y+bh/2+4}" text-anchor="end" class="lbl">${esc(r.label)}</text>`;
    let x=padL;
    ['groen','geel','oranje','rood'].forEach(k=>{
      const w=r.totaal? (r[k]/r.totaal)*bw : 0;
      if(w>0){
        s+=`<rect x="${x}" y="${y}" width="${w}" height="${bh}" fill="${kleur[k]}"><title>${k}: ${r[k]}</title></rect>`;
        if(w>22) s+=`<text x="${x+w/2}" y="${y+bh/2+4}" text-anchor="middle" class="onbar">${r[k]}</text>`;
        x+=w;
      }
    });
  });
  s+=`</svg>`;
  return s;
}

/* Pareto: horizontale balken verliesuren per foutcode + cumulatieve lijn.
   items:[{code,uren,label}] gesorteerd aflopend */
function chartPareto(items){
  const W=560,rowH=34,padL=90,padR=54,padT=10;
  const H=padT*2+items.length*rowH+16;
  const max=Math.max(...items.map(i=>i.uren),1);
  const totaal=items.reduce((a,b)=>a+b.uren,0);
  let cum=0;
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  const bw=W-padL-padR;
  const pts=[];
  items.forEach((it,i)=>{
    const y=padT+i*rowH+6, bh=20;
    const w=(it.uren/max)*bw;
    s+=`<text x="${padL-8}" y="${y+bh/2+4}" text-anchor="end" class="lbl mono">${esc(it.code)}</text>`;
    s+=`<rect x="${padL}" y="${y}" width="${w}" height="${bh}" rx="3" fill="var(--rws-blauw-mid)"><title>${esc(it.label)}: ${Math.round(it.uren).toLocaleString('nl-NL')} u</title></rect>`;
    s+=`<text x="${padL+w+6}" y="${y+bh/2+4}" class="val">${Math.round(it.uren/totaal*100)}%</text>`;
    cum+=it.uren;
    pts.push([padL+(cum/totaal)*bw, y+bh/2]);
  });
  // cumulatieve lijn
  s+=`<polyline points="${pts.map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="var(--rws-geel)" stroke-width="2"/>`;
  pts.forEach(p=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--rws-geel)" stroke="#fff" stroke-width="1"/>`);
  s+=`</svg>`;
  return s;
}

/* Gegroepeerde staven: per VC de beschikbaarheid van de 4 diensten. */
function chartVcGroepen(vcRows){
  const W=580,H=230,padL=44,padR=10,padT=14,padB=48;
  const alle=vcRows.flatMap(r=>DIENSTEN.map(d=>r.d[d.id]));
  let min=Math.min(...alle); min=Math.floor((min-0.2)*10)/10; if(min<0)min=0;
  const max=100;
  const sy=v=>padT+(1-(v-min)/(max-min))*(H-padT-padB);
  const groepW=(W-padL-padR)/vcRows.length;
  const barW=Math.min(14,(groepW-10)/DIENSTEN.length);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  // y-as
  const stap=(max-min)>2?0.5:0.25;
  for(let g=Math.ceil(min/stap)*stap; g<=max+1e-9; g+=stap){
    const y=sy(g);
    s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--panel)"/>`;
    s+=`<text x="${padL-5}" y="${y+3}" text-anchor="end" class="ax">${fmt(g,1)}</text>`;
  }
  vcRows.forEach((r,gi)=>{
    const gx=padL+gi*groepW+ (groepW-barW*DIENSTEN.length)/2;
    DIENSTEN.forEach((d,di)=>{
      const v=r.d[d.id], x=gx+di*barW, y=sy(v);
      s+=`<rect x="${x}" y="${y}" width="${barW-1.5}" height="${H-padB-y}" fill="${d.kleur}"><title>${d.naam}: ${fmt(v,2)}%</title></rect>`;
    });
    s+=`<text x="${padL+gi*groepW+groepW/2}" y="${H-padB+16}" text-anchor="middle" class="lbl">${esc(r.vc)}</text>`;
    s+=`<text x="${padL+gi*groepW+groepW/2}" y="${H-padB+30}" text-anchor="middle" class="ax">${r.n} stor.</text>`;
  });
  s+=`</svg>`;
  return s;
}
