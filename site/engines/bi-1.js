
/* ═══════════════════════════════════════════════════════════
   CONFIGURATIE — dezelfde regels als config.html (VWL Configuratie)
   Standaardwaarden zijn 1-op-1 overgenomen uit config.html;
   een geëxporteerd scenario (vwl_scenario_config.json) of de
   browseropslag van config.html overschrijft ze.
   ═══════════════════════════════════════════════════════════ */
const CFG_DEFAULTS={"org.naam":"Rijkswaterstaat VWM","org.regio":"West-Nederland","org.dienst":"Verkeersmanagement","contract.vorm":"prestatiecontract","contract.beschikbaarheidseis":99.5,"contract.boete_actief":true,"contract.boete_per_uur":500,"contract.looptijd":5,"escalatie.niveau1":90,"escalatie.niveau2":75,"escalatie.niveau3":60,"dienst.uren":"24/7","juridisch.max_snelheid_dag":100,"juridisch.max_snelheid_nacht":130,"kpi.beschikbaarheid.groen":98,"kpi.beschikbaarheid.geel":95,"kpi.beschikbaarheid.oranje":90,"kpi.responstijd.tunnel":5,"kpi.responstijd.calamiteit":3,"kpi.asset_beschikbaarheid.tunnel":99.9,"kpi.asset_beschikbaarheid.msi":99.5,"kpi.asset_beschikbaarheid.drip":98,"kpi.asset_beschikbaarheid.werkplek":99.5,"kpi.planningshorizon_maanden":2,"kpi.files_werk_uitvoering":5,"vc.aantal_regionaal":5,"hinder.max_files_werk":10,"hinder.onderhoudsvenster":"nacht","atw.rust_dagelijks":11,"atw.rust_na_nacht":14,"atw.max_uren_week":60,"atw.max_nachten_14d":5,"atw.max_nachten_consecutief":7,"atw.rust_na_nachtreeks":46,"atw.max_werkdagen_consecutief":6,"atw.maandcap_factor":4.5,"personeel.werkdagen_jaar":225,"personeel.vakantiedagen":25,"personeel.ziekteverzuim":5,"personeel.opleidingsuren":40,"personeel.min_bezetting":80,"werklast.grens_hoog":25,"werklast.grens_kritisch":26,"busrules.max_l3_per_desk":4,"busrules.max_tunnels_per_desk":3,"busrules.max_fte_per_desk":1.2,"busrules.enabled":true,"operator.max_events_uur":15,"assets.hw_mtbf":30000,"assets.hw_mttr":6,"assets.sw_mtbf":8760,"assets.sw_mttr":2,"assets.max_beschikbaarheid":99.4,"assets.waarschuwing_pct":20,"scenario.naam":"Standaard","scenario.auteur":"","sim.personeel_factor":1,"sim.budget_factor":1,"sim.asset_factor":1,"sim.incident_multiplier":1};

const DB_KEY='bidash_integratie_v1';
const DEFAULT_DB={
  meta:{versie:'3.0',peildatum:'2026-07-14'},
  params:{kostenIndex:1.00},
  config:{...CFG_DEFAULTS},
  configBron:'standaard (ingebouwd, gelijk aan config.html)',
  richtlijnen:[
    {id:'atw',naam:'ATW',oms:'Arbeidstijdenwet — diensturen en rusttijden wegverkeersleiders (parameters uit config.html)'},
    {id:'warvw',naam:'Warvw/Rarvw',oms:'Tunnelwetgeving — verplichte bediening en beschikbaarheid TTI'},
    {id:'babw',naam:'BABW',oms:'Besluit administratieve bepalingen wegverkeer — maatregelen op de weg'}
  ],
  /* Bedrijfsfuncties (P×Q) — leeg: voeg toe via de Databronnen-/JSON-import.
     {id, naam, doel, systemen[], benodigdFte, actueelFte, assets[], onderhoudEur, richtlijnen[]} */
  functies:[],
  /* Assetregister — leeg. Assets komen via NDW-import (pagina Assetmanagement) of
     JSON-import. ISO 55001-velden per asset: type, functionele waarde (FW 1–5),
     conditiescore (NEN 2767, 1–6), maanden uitgesteld onderhoud en redundantie (n+1). */
  assets:[],
  /* BEDIENKETENS (ISO 55001) — generiek, afgeleid van de TNO-taakanalyse
     (abstractiehiërarchie regionaal wegverkeersmanagement, 2021). Elke keten is
     een purpose-related function (bedrijfsfunctie) met een functional purpose
     (doel) en een reeks generieke objecttypen (schakelTypes) uit de "physical
     objects"-laag. Technologie- en locatie-onafhankelijk (‘toekomstbestendig’):
     de ketenbeschikbaarheid wordt berekend over wélke assets van die typen ook
     geladen zijn (bv. via NDW-import). Optioneel locatie (wegnummer) als scope.
     {id, naam, bedrijfsfunctie, doel, norm, locatie, schakelTypes[]} */
  ketens:[
    {id:'bk_sturen',naam:'Sturen en geleiden van verkeer',bedrijfsfunctie:'Sturen en geleiden van verkeer',doel:'Zorgen voor vlot en veilig verkeer',norm:99.0,locatie:'',schakelTypes:['detectie','bediensysteem','signalering','dynamische_strook']},
    {id:'bk_info',naam:'Beschikbaar stellen van reis- en route-informatie',bedrijfsfunctie:'Beschikbaar stellen van reis- en route-informatie',doel:'Betrouwbare reistijd',norm:98.0,locatie:'',schakelTypes:['detectie','bediensysteem','drip']},
    {id:'bk_wiu',naam:'Ondersteunen bij werk in uitvoering',bedrijfsfunctie:'Ondersteunen bij werk in uitvoering',doel:'Veilig',norm:98.0,locatie:'',schakelTypes:['camera','signalering','drip','tekstwagen']},
    {id:'bk_im',naam:'Incidentmanagement',bedrijfsfunctie:'Incidentmanagement',doel:'Zorgen voor vlot en veilig verkeer',norm:99.0,locatie:'',schakelTypes:['camera','detectie','bediensysteem','signalering','drip','communicatie']},
    {id:'bk_objecten',naam:'Bewaken en bedienen van objecten',bedrijfsfunctie:'Bewaken en bedienen van objecten',doel:'Veilig',norm:99.5,locatie:'',schakelTypes:['camera','bediensysteem','tunnelbuis','slagboom','communicatie','calamiteitenknop']},
    {id:'bk_gladheid',naam:'Gladheidbestrijding',bedrijfsfunctie:'Gladheidbestrijding',doel:'Zorgen voor vlot en veilig verkeer',norm:97.0,locatie:'',schakelTypes:['gladheidsysteem','bediensysteem','drip','communicatie']},
    {id:'bk_handhaven',naam:'Handhaven',bedrijfsfunctie:'Handhaven',doel:'Veilig',norm:97.0,locatie:'',schakelTypes:['camera','detectie','communicatie']}
  ],
  /* AM-REGELS (ISO 55001) — rule engine-voorwaarden voor assetmanagement:
     max. uitstel per FW-klasse, degradatie per 6 mnd uitstel, NEN 2767-conditie-
     drempel voor versnelde degradatie en de FW-klasse waarvandaan n+1 vereist is */
  amRegels:{
    maxUitstel:{FW1:24,FW2:18,FW3:12,FW4:6,FW5:3},
    degrPer6Mnd:18,
    conditieDrempel:4,
    spofFw:4
  },
  /* STORINGSREGELS BUITENASSETS — rule engine-voorwaarden die storingsmeldingen
     van buitenassets (MSI, camera, meetlus, wisselbord) vertalen naar
     beschikbaarheids- én prestatie-impact op het areaal, met gradatie op
     locatiecontext en combinatiestoringen (bron: Regels_MSI-template).
     Toegepast bij de meldingen-import op de pagina Assetmanagement. */
  storingsRegels:{
    assetTypen:[
      {id:'MSI',actief:true,matchVeld:'asset',matchOp:'contains',matchWaarde:'MSI',functie:'signaalgever / matrixsignaalgever',wAvail:1,wPerf:1},
      {id:'CAM',actief:true,matchVeld:'type',matchOp:'equals',matchWaarde:'Camera',functie:'camera',wAvail:0.35,wPerf:0.6},
      {id:'LUS',actief:true,matchVeld:'type',matchOp:'contains',matchWaarde:'lus',functie:'meetlus / detectielus',wAvail:0.2,wPerf:0.5},
      {id:'WISSELBORD',actief:true,matchVeld:'storingsomschrijving',matchOp:'contains',matchWaarde:'Wisselbord',functie:'wisselbord',wAvail:0.6,wPerf:0.9}
    ],
    foutcodes:[
      {code:'1003',actief:true,patroon:'Fatale fout',assetType:'MSI',severity:'kritiek',availPct:100,perfPct:100,oms:'Volledige uitval van MSI'},
      {code:'1001',actief:true,patroon:'lampcircuit',assetType:'MSI',severity:'middel',availPct:15,perfPct:30,oms:'Niet altijd volledige uitval, wel prestatieverlies'},
      {code:'1061',actief:true,patroon:'Beeld',assetType:'MSI',severity:'laag',availPct:5,perfPct:15,oms:'Beeld gedegradeerd'},
      {code:'1006',actief:true,patroon:'Beide lussen fout',assetType:'LUS',severity:'hoog',availPct:25,perfPct:60,oms:'Sterke impact op detectiekwaliteit'},
      {code:'1007',actief:true,patroon:'Een lus goed, een lus fout',assetType:'LUS',severity:'middel',availPct:10,perfPct:25,oms:'Gedeeltelijke detectie'},
      {code:'5004',actief:true,patroon:'uitgeschakeld voor OS',assetType:'LUS',severity:'hoog',availPct:15,perfPct:40,oms:'Bewust uitgeschakeld, wel impact'},
      {code:'6005',actief:true,patroon:'Wisselbord heeft verkeerde stand',assetType:'WISSELBORD',severity:'hoog',availPct:40,perfPct:80,oms:'Verkeerde stand raakt bediening/veiligheid'},
      {code:'4021',actief:true,patroon:'Noodvoeding uitgevallen',assetType:'MSI',severity:'hoog',availPct:20,perfPct:35,oms:'Onderliggende storing, combineerbaar'}
    ],
    locatieRegels:[
      {id:'LOC_001',actief:true,assetType:'MSI',context:'voor_afrit',fAvail:1.6,fPerf:1.4,prioriteit:100,oms:'MSI voor afrit of toerit weegt zwaarder'},
      {id:'LOC_002',actief:true,assetType:'MSI',context:'tussen_portalen_zonder_ramp',fAvail:0.8,fPerf:0.85,prioriteit:80,oms:'MSI midden in homogeen traject weegt lichter'},
      {id:'LOC_003',actief:true,assetType:'MSI',context:'portaal_voor_en_na_werken',fAvail:0.7,fPerf:0.8,prioriteit:70,oms:'Werkende portalen voor en na verlagen impact'},
      {id:'LOC_004',actief:true,assetType:'CAM',context:'incidentzicht',fAvail:1.2,fPerf:1.4,prioriteit:60,oms:'Camera met zichtfunctie rond incidentlocatie'},
      {id:'LOC_005',actief:true,assetType:'LUS',context:'weefvak',fAvail:1.3,fPerf:1.5,prioriteit:90,oms:'Meetlus in weefvak of invoegstrook weegt zwaarder'},
      {id:'LOC_006',actief:true,assetType:'LUS',context:'hoofdrijbaan_standaard',fAvail:1,fPerf:1,prioriteit:50,oms:'Standaard basis'}
    ],
    combiRegels:[
      {id:'COMBO_001',actief:true,oms:'MSI plus lussen zelfde HM-band',type1:'MSI',code1:'1003',type2:'LUS',code2:'1006',maxKm:0.3,venMin:1440,extraAvail:15,extraPerf:25,capAvail:100,capPerf:100,prioriteit:100},
      {id:'COMBO_002',actief:true,oms:'Twee of meer MSI-fatale fouten in korte band',type1:'MSI',code1:'1003',type2:'MSI',code2:'1003',maxKm:0.8,venMin:1440,extraAvail:20,extraPerf:20,capAvail:100,capPerf:100,prioriteit:95},
      {id:'COMBO_003',actief:true,oms:'Camera plus lussen op zelfde wegvak',type1:'CAM',code1:'',type2:'LUS',code2:'1006',maxKm:0.5,venMin:1440,extraAvail:5,extraPerf:15,capAvail:100,capPerf:100,prioriteit:70},
      {id:'COMBO_004',actief:true,oms:'Noodvoeding samen met MSI-fout',type1:'MSI',code1:'4021',type2:'MSI',code2:'1003',maxKm:0.2,venMin:1440,extraAvail:10,extraPerf:15,capAvail:100,capPerf:100,prioriteit:90}
    ]
  },
  financien:{budgetJr:0},
  /* IMPACTREGELS — voorwaarden van de rule engine: hoe vertaalt de trigger engine
     een planningsafwijking (per meldingstype) naar brede impact op alle datasets */
  impact:{
    fteOpslagConflict:10,   // % extra inzet op gekoppelde functies tijdens een corridorconflict
    storingsOpslag:1.5,     // × storingsrisico op gekoppelde assets tijdens werkzaamheden
    fteKostenJr:95000,      // € loonkosten per fte per jaar (voor meerkosten-berekening)
    piekOpslagPct:4,        // % extra regie-inzet per werk boven de hinderdrempel
    shiftKostenPctMnd:0.35  // % kostenindexatie op P×Q-onderhoud per maand verschuiving
  },
  /* capaciteitsgrenzen per dienst (max beschikbare FTE voor dit programma) —
     de trigger engine toetst de FTE-vraag uit de planningstool hieraan */
  capgrens:{GPO:12,CIV:10,VWM:14,PPO:6,Regio:4}
};
let DB=JSON.parse(JSON.stringify(DEFAULT_DB));
/* migratie: oudere localStorage-staten en imports krijgen ontbrekende blokken
   (config/impact/capgrens/amRegels/ketens) en ISO 55001-assetvelden aangevuld */
function migreerDB(d){
  d.config={...CFG_DEFAULTS,...(d.config||{})};
  d.impact={...DEFAULT_DB.impact,...(d.impact||{})};
  d.capgrens={...DEFAULT_DB.capgrens,...(d.capgrens||{})};
  const am=d.amRegels||{};
  d.amRegels={...DEFAULT_DB.amRegels,...am,maxUitstel:{...DEFAULT_DB.amRegels.maxUitstel,...(am.maxUitstel||{})}};
  if(!Array.isArray(d.ketens)||!d.ketens.length)d.ketens=JSON.parse(JSON.stringify(DEFAULT_DB.ketens));
  if(!d.storingsRegels)d.storingsRegels=JSON.parse(JSON.stringify(DEFAULT_DB.storingsRegels));
  (d.assets||[]).forEach(a=>{const def=DEFAULT_DB.assets.find(x=>x.id===a.id)||{};
    if(a.type===undefined)a.type=def.type!==undefined?def.type:'overig';
    if(a.fw===undefined)a.fw=def.fw!==undefined?def.fw:3;
    if(a.conditie===undefined)a.conditie=def.conditie!==undefined?def.conditie:2;
    if(a.uitstelMnd===undefined)a.uitstelMnd=def.uitstelMnd!==undefined?def.uitstelMnd:0;
    if(a.redundant===undefined)a.redundant=def.redundant!==undefined?def.redundant:false});
  return d;
}
function loadDB(){try{const s=localStorage.getItem(DB_KEY);if(s)return migreerDB(JSON.parse(s))}catch(e){}return JSON.parse(JSON.stringify(DEFAULT_DB))}
function saveDB(){try{localStorage.setItem(DB_KEY,JSON.stringify(DB))}catch(e){console.warn('Opslag vol — model blijft alleen in geheugen',e)}refresh()}

/* ── cfg helper: één bron voor alle regels ── */
function cfg(key,fb){const v=DB.config?DB.config[key]:undefined;return v===undefined||v===null||v===''?fb:v}
/* asset-normen komen per CMDB-categorie uit de config (kpi.asset_beschikbaarheid.*) */
const CAT_NORM={'DVM':'kpi.asset_beschikbaarheid.msi','Productieplatform':'kpi.asset_beschikbaarheid.werkplek','Tunnel/TTI':'kpi.asset_beschikbaarheid.tunnel','Facilitair':'kpi.asset_beschikbaarheid.drip'};
function normVoor(a){return +cfg(CAT_NORM[a.cmdb],98)}
function mttrVoor(a){return a.cmdb==='Productieplatform'?+cfg('assets.sw_mttr',2):+cfg('assets.hw_mttr',6)}

/* ═══════════════════════════════════════════════════════════
   ASSETMANAGEMENT (ISO 55001) — rekenkern
   Line of sight: bedrijfsdoel → bedrijfsfunctie → bedienketen → asset.
   Ketenbeschikbaarheid = serieel product van schakelbeschikbaarheden;
   redundante schakels (n+1) tellen kwadratisch; uitgesteld onderhoud
   degradeert via degrPer6Mnd en de NEN 2767-conditiedrempel (§ 6.5).
   ═══════════════════════════════════════════════════════════ */
function amRegel(k,fb){const r=DB.amRegels||{};const v=/^FW\d$/.test(k)?(r.maxUitstel||{})[k]:r[k];return v===undefined||v===null||v===''?fb:+v}
/* degradatiefactor op de storingskans: 1 + (uitstel/6) × degrPer6Mnd%, ×1,5 vanaf de conditiedrempel */
function degrFactor(a,extraUitstel){
  const uitstel=(+a.uitstelMnd||0)+(extraUitstel||0);
  if(uitstel<=0)return 1;
  const versneld=(+a.conditie||1)>=amRegel('conditieDrempel',4)?1.5:1;
  return 1+(uitstel/6)*(amRegel('degrPer6Mnd',18)/100)*versneld;
}
/* effectieve schakelbeschikbaarheid: actueel, gecorrigeerd voor storingsfactor én
   degradatie door uitstel; n+1-redundantie telt kwadratisch (beide paden moeten falen).
   w = optionele what-if: {assetId, extraUitstel (mnd), extraVerlies (%-punt)} */
function schakelBesch(a,p,w){
  const eigen=w&&w.assetId===a.id;
  const basis=(+a.besch||100)-(eigen?(w.extraVerlies||0):0);
  let b=100-(100-basis)*p.storingsFactor*degrFactor(a,eigen?(w.extraUitstel||0):0);
  b=Math.max(0,Math.min(100,b));
  if(a.redundant)b=100-(100-b)*(100-b)/100;
  return b;
}
/* ── OBJECTTYPEN — de "physical objects" uit de TNO-abstractiehiërarchie
   (taakanalyse wegverkeersleiders). Generieke, technologie-onafhankelijke
   objecttypen waaruit bedienketens zijn opgebouwd; een asset krijgt via zijn
   type-veld een van deze typen (NDW-import zet MSI→signalering, DRIP→drip). ── */
const OBJECTTYPEN={
  detectie:{label:'Detectie (lussen, NDW-voertuigen)',fw:3},
  camera:{label:'Camera’s (CCTV/DYNAC)',fw:4},
  signalering:{label:'Verkeerssignalering (MSI)',fw:4},
  drip:{label:'DRIP’s (route-informatie)',fw:2},
  tekstwagen:{label:'Tekstwagens',fw:1},
  vri:{label:'VRI’s (kruispuntregeling)',fw:3},
  dynamische_strook:{label:'Dynamische banen/stroken',fw:4},
  slagboom:{label:'Slagbomen',fw:4},
  brug:{label:'Bruggen',fw:4},
  tunnelbuis:{label:'Tunnelinstallatie (TTI)',fw:5},
  toeritdosering:{label:'Toeritdoseerinstallatie',fw:2},
  calamiteitenknop:{label:'Calamiteitenknop',fw:5},
  gladheidsysteem:{label:'Gladheidsmeldsysteem',fw:2},
  communicatie:{label:'Communicatiesystemen',fw:4},
  bediensysteem:{label:'Bediensysteem (DYNAC/centrale)',fw:5},
  transmissie:{label:'Transmissie/koppelvlak',fw:4}
};
function objLabel(type){return (OBJECTTYPEN[type]||{}).label||type}
/* de assets die een generieke schakel (objecttype) invullen, binnen de optionele
   locatiescope van de keten (leeg = heel areaal; anders match op wegnummer/locatie) */
function schakelAssets(type,locatie){
  return DB.assets.filter(a=>a.type===type&&(!locatie||String(a.locatie).toUpperCase()===String(locatie).toUpperCase()));
}
/* ketenbeschikbaarheid = serieel product van de schakels. Generiek (schakelTypes:
   objecttypen uit de taakanalyse) of legacy (schakels: expliciete asset-id’s).
   Per objecttype geldt de gemiddelde effectieve beschikbaarheid van de aanwezige
   assets; ontbreekt een type in het (gescopte) areaal, dan telt de schakel als
   ‘niet geladen’ en blijft de keten ‘onvolledig’ tot er assets van dat type zijn. */
function ketenBesch(k,p,w){
  const schakels=[];let prod=1,aanwezigN=0,ontbrekend=0;
  if(Array.isArray(k.schakelTypes)&&k.schakelTypes.length){
    k.schakelTypes.forEach(type=>{
      const info=OBJECTTYPEN[type]||{label:type,fw:3};
      const assets=schakelAssets(type,k.locatie);
      if(!assets.length){schakels.push({type,label:info.label,aanwezig:false,n:0,b:null,fw:info.fw,redundant:false});ontbrekend++;return}
      const bs=assets.map(a=>schakelBesch(a,p,w));
      const b=bs.reduce((s,x)=>s+x,0)/bs.length;
      prod*=b/100;aanwezigN++;
      schakels.push({type,label:info.label,aanwezig:true,n:assets.length,b,fw:Math.min(...assets.map(a=>+a.fw||info.fw)),redundant:assets.some(a=>a.redundant),assets});
    });
  }else{ // legacy: expliciete asset-id’s
    (k.schakels||[]).forEach(id=>{const a=DB.assets.find(x=>x.id===id);if(!a)return;
      const b=schakelBesch(a,p,w);prod*=b/100;aanwezigN++;
      schakels.push({type:a.type,label:a.naam,aanwezig:true,n:1,b,fw:+a.fw||3,redundant:!!a.redundant,assets:[a]});});
  }
  return {besch:aanwezigN?prod*100:null,schakels,aanwezigN,ontbrekend,volledig:ontbrekend===0&&aanwezigN>0};
}
/* wordt een keten door een what-if op één asset geraakt? (legacy id of generiek type
   binnen de locatiescope) */
function ketenGeraakt(k,a){
  if(!a)return false;
  if(Array.isArray(k.schakelTypes)&&k.schakelTypes.length)
    return k.schakelTypes.includes(a.type)&&(!k.locatie||String(k.locatie).toUpperCase()===String(a.locatie).toUpperCase());
  return (k.schakels||[]).includes(a.id);
}
/* line of sight: keten → bedrijfsfunctie → bedrijfsdoel (generiek uit de taakanalyse,
   of via gekoppelde functie-id’s met FTE) */
function lineOfSight(k){
  const functies=(k.functieIds||[]).map(id=>DB.functies.find(f=>f.id===id)).filter(Boolean);
  const functieNamen=functies.length?functies.map(f=>f.naam):(k.bedrijfsfunctie?[k.bedrijfsfunctie]:[]);
  const doelen=k.doel?[k.doel]:[...new Set(functies.map(f=>f.doel))];
  return {functies,functieNamen,doelen};
}

/* ═══════════════════════════════════════════════════════════
   CMDB-KOPPELING NDW — import van areaalgegevens (hoofdstuk 14.2)
   Twee NDW open data-formaten, XML of gezipte XML (native
   DecompressionStream, geen externe dependency):
   · MSI  — TMIS VMS-snapshot (variable_message_sign_events):
            unieke signaalgevers per wegnummer
   · DRIP — DATEX II v3 VmsTablePublication: panelen per wegnummer
            uit de paneelnaam; zonder wegnummer → “stedelijk/regionaal”
   Per weg ontstaat één asset in het register; de weg (locatie) is
   tevens het corridor-token voor de impact engine. Beheervelden
   (FW, conditie, uitstel, n+1, beschikbaarheid, weging) blijven
   bij herimport behouden.
   ═══════════════════════════════════════════════════════════ */
async function ndwLeesBestand(file){
  const buf=await file.arrayBuffer(),b=new Uint8Array(buf);
  if(b[0]===0x1f&&b[1]===0x8b){ // gzip-magic → native decompressie
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return new TextDecoder('utf-8').decode(buf);
}
function ndwParseMsi(xml){
  const sign={};let laatst='';
  const re=/<event>([\s\S]*?)<\/event>/g;let m;
  while((m=re.exec(xml))){
    const u=/<uuid>([^<]+)<\/uuid>/.exec(m[1]);
    const r=/<road>([^<]+)<\/road>/.exec(m[1]);
    const t=/<ts_state>([^<]+)<\/ts_state>/.exec(m[1]);
    if(t&&t[1]>laatst)laatst=t[1];
    if(u&&r)sign[u[1]]=r[1].trim().toUpperCase();
  }
  const perWeg={};Object.values(sign).forEach(w=>perWeg[w]=(perWeg[w]||0)+1);
  return {signs:Object.keys(sign).length,perWeg,peilmoment:laatst.slice(0,10)};
}
function ndwParseDrip(xml){
  const namen=[...xml.matchAll(/<com:value lang="nl">([^<]*)<\/com:value>/g)].map(x=>x[1]);
  const pub=/<com:publicationTime>([^<]+)</.exec(xml);
  const perWeg={};let overig=0;
  namen.forEach(n=>{const t=/\b([ANan]\d{1,3})\b/.exec(n);
    if(t)perWeg[t[1].toUpperCase()]=(perWeg[t[1].toUpperCase()]||0)+1;else overig++});
  return {totaal:namen.length,perWeg,overig,peilmoment:pub?pub[1].slice(0,10):''};
}
function ndwUpsertAsset(id,def){
  const a=DB.assets.find(x=>x.id===id);
  if(a){a.naam=def.naam;a.locatie=def.locatie;a.cmdb=def.cmdb;a.type=def.type;if(def.aantal!==undefined)a.aantal=def.aantal;return 0}
  DB.assets.push({id,...def});return 1;
}

/* ═══════════════════════════════════════════════════════════
   P6 FTE-CAPACITEIT — capaciteit aanhouden uit een Primavera-export
   De embedded planningstool leest zelf géén resource-units (P2), maar een
   P6 APIBusinessObjects-export met resource-toewijzingen bevat de FTE per
   activiteit (PlannedUnitsPerTime per ResourceAssignment). Dit dashboard
   leest die FTE per activiteit (ObjectId) uit de export en houdt ze aan als
   capaciteitsbron: de capaciteitsbrug koppelt ze read-only aan de regels van
   het tool-model (regel.id = activity-ObjectId) en aggregeert per kwartaal/
   dienst. Zo werkt de FTE-formatie uit dit bestand door in de kaart,
   triggers en Monte Carlo, zonder de planningstool te wijzigen.
   ═══════════════════════════════════════════════════════════ */
function p6ParseCapaciteit(xmlText,bestand){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw new Error('XML kon niet worden gelezen (parsererror).');
  const T=(el,tag)=>{for(let i=0;i<el.children.length;i++)if(el.children[i].tagName===tag)return (el.children[i].textContent||'').trim();return ''};
  const dToF=s=>{if(!s)return null;const d=new Date(s.replace(' ','T'));if(isNaN(d))return null;const y=d.getFullYear();const j0=new Date(y,0,1),j1=new Date(y+1,0,1);return y+(d-j0)/(j1-j0);};
  const resNaam={};
  [...xml.getElementsByTagName('Resource')].forEach(r=>{const o=T(r,'ObjectId');if(o)resNaam[o]=T(r,'Name')||T(r,'Id')||'Resource'});
  const perAct={};let nAssign=0,totFte=0;
  [...xml.getElementsByTagName('ResourceAssignment')].forEach(ra=>{
    const aoid=T(ra,'ActivityObjectId');if(!aoid)return;
    let fte=parseFloat(T(ra,'PlannedUnitsPerTime'));
    if(!(fte>0))fte=parseFloat(T(ra,'RemainingUnitsPerTime'))||parseFloat(T(ra,'ActualUnitsPerTime'))||0;
    if(!(fte>0))return;
    const rol=resNaam[T(ra,'ResourceObjectId')]||'Rol';
    fte=Math.round(fte*100)/100;
    (perAct[aoid]=perAct[aoid]||[]).push({rol,fte});
    nAssign++;totFte+=fte;
  });
  // WBS-boom: koppelt elke activiteit aan haar project (bv. "Leidsche Rijntunnel"),
  // verkeerscentrale (VCxxx) en top-WBS (voor de dienst) — zodat de FTE aan het
  // juiste project gekoppeld wordt getoond, niet alleen per dienst.
  const wbs={};
  [...xml.getElementsByTagName('WBS')].forEach(w=>{const o=T(w,'ObjectId');if(o)wbs[o]={naam:T(w,'Name'),parent:T(w,'ParentObjectId')};});
  const wbsPad=woid=>{const pad=[],seen={};while(woid&&wbs[woid]&&!seen[woid]){seen[woid]=1;pad.unshift(wbs[woid].naam);woid=wbs[woid].parent;}return pad;};
  // activiteit-metadata (naam + datums + WBS-pad/project) — ook nodig om de capaciteit
  // zonder de tool over de tijd én per project te tonen ("capaciteit uit het bestand")
  const actMeta={};
  [...xml.getElementsByTagName('Activity')].forEach(a=>{const o=T(a,'ObjectId');if(!o)return;
    const pad=wbsPad(T(a,'WBSObjectId'));
    actMeta[o]={naam:T(a,'Name'),t0:dToF(T(a,'StartDate')||T(a,'PlannedStartDate')),t1:dToF(T(a,'FinishDate')||T(a,'PlannedFinishDate')),
      pad,project:pad.length?pad[pad.length-1]:'(geen WBS)',vc:pad.find(n=>/^VC/i.test(n))||'',top:pad[0]||''};});
  const activiteiten=Object.keys(perAct).map(id=>{const m=actMeta[id]||{};
    return {id,naam:m.naam||id,t0:m.t0,t1:m.t1,project:m.project||'(geen WBS)',vc:m.vc||'',top:m.top||'',pad:m.pad||[],
      fte:Math.round(perAct[id].reduce((s,x)=>s+x.fte,0)*100)/100};});
  // FTE per project (bv. Leidsche Rijntunnel), met VC en top-WBS
  const perProject={};
  activiteiten.forEach(a=>{const p=perProject[a.project]=perProject[a.project]||{fte:0,vc:a.vc,top:a.top,pad:a.pad,nAct:0};p.fte+=a.fte;p.nAct++;});
  Object.values(perProject).forEach(p=>p.fte=Math.round(p.fte*100)/100);
  // FTE per rol (voor de standalone weergave)
  const perRol={};Object.values(perAct).forEach(rs=>rs.forEach(x=>{perRol[x.rol]=(perRol[x.rol]||0)+x.fte}));
  return {bestand,datum:new Date().toISOString().slice(0,10),perActiviteit:perAct,activiteiten,
    nActiviteiten:activiteiten.length,nAssign,totFte:Math.round(totFte*10)/10,
    rollen:Object.values(resNaam),perRol,perProject};
}
/* standalone kwartaalreeks (som FTE actieve activiteiten) uit de P6-export zelf,
   zodat de capaciteit ook zichtbaar is zonder dat de planning in de tool staat */
function p6StandaloneKwartalen(cap){
  const acts=(cap.activiteiten||[]).filter(a=>a.t0!=null&&a.t1!=null&&a.fte>0);
  if(!acts.length)return [];
  const t0=Math.floor(Math.min(...acts.map(a=>a.t0))),t1=Math.ceil(Math.max(...acts.map(a=>a.t1)));
  const kws=[];
  for(let y=t0;y<t1;y++)for(let q=0;q<4;q++){
    const tm=y+q/4+1/8;let som=0;
    acts.forEach(a=>{if(tm>=a.t0&&tm<a.t1)som+=a.fte});
    kws.push({label:'Q'+(q+1)+' '+String(y).slice(2),jaar:y,q:q+1,tot:Math.round(som*100)/100});
  }
  while(kws.length&&kws[0].tot===0)kws.shift();
  while(kws.length&&kws[kws.length-1].tot===0)kws.pop();
  return kws;
}
function p6HandleFile(ev){
  const f=ev.target.files[0];ev.target.value='';if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{
    const cap=p6ParseCapaciteit(r.result,f.name);
    if(!cap.nActiviteiten){alert('Geen resource-toewijzingen (FTE) gevonden in deze P6-export. Bevat het bestand ResourceAssignments met PlannedUnitsPerTime?');return}
    const m=bridgeModel();
    if(m){const ids=new Set(m.regels.map(x=>String(x.id)));cap.overlap=cap.activiteiten.filter(a=>ids.has(String(a.id))).length}
    DB.p6Capaciteit=cap;saveDB();
    if(!m)alert('FTE-capaciteit uit de export geladen ('+cap.nActiviteiten+' activiteiten, '+fmtF(cap.totFte)+' fte). De totale capaciteit staat nu op de capaciteitskaart. Laad dezelfde Primavera-export ook in de planningstool hierboven (knop “Planning importeren”) voor de uitsplitsing per dienst en de toetsing aan de capaciteitsgrenzen.');
    else if(cap.overlap===0)alert('FTE geïmporteerd, maar geen enkele activiteit komt overeen met de planning die nu in de tool staat (ObjectId’s matchen niet). Laad in de planningstool dezelfde P6-export zodat de capaciteit per dienst koppelt.');
  }catch(e){alert('Kon P6-export niet lezen: '+e.message)}};
  r.readAsText(f);
}
function p6VerwijderCap(){if(!confirm('De uit de P6-export aangehouden FTE-capaciteit verwijderen? De capaciteitsbrug valt dan terug op de FTE-config van de planningstool.'))return;delete DB.p6Capaciteit;saveDB();}
async function ndwHandleFiles(ev){
  const files=[...ev.target.files];ev.target.value='';
  if(!files.length)return;
  let msi=null,drip=null;const onbekend=[];
  for(const f of files){
    try{
      const xml=await ndwLeesBestand(f);
      if(xml.includes('variable_message_sign_events'))msi={...ndwParseMsi(xml),bestand:f.name};
      else if(xml.includes('VmsTablePublication')||xml.includes('vmsController'))drip={...ndwParseDrip(xml),bestand:f.name};
      else onbekend.push(f.name);
    }catch(e){alert('Kon '+f.name+' niet lezen: '+e.message)}
  }
  const vandaag=new Date().toISOString().slice(0,10);
  DB.ndwImport=DB.ndwImport||{};
  if(msi){
    const norm=+cfg('kpi.asset_beschikbaarheid.msi',99.5);let nieuw=0;
    Object.entries(msi.perWeg).forEach(([weg,n])=>{
      nieuw+=ndwUpsertAsset('ndw_msi_'+weg.toLowerCase(),{naam:'MSI '+weg+' · '+n+' signaalgevers (NDW)',cmdb:'DVM',type:'signalering',locatie:weg,aantal:n,besch:norm,storingenJr:0,weging:1,fw:4,conditie:2,uitstelMnd:0,redundant:false});
    });
    DB.ndwImport.msi={bestand:msi.bestand,datum:vandaag,peilmoment:msi.peilmoment,signs:msi.signs,wegen:Object.keys(msi.perWeg).length,nieuw};
  }
  if(drip){
    const norm=+cfg('kpi.asset_beschikbaarheid.drip',98);let nieuw=0;
    Object.entries(drip.perWeg).forEach(([weg,n])=>{
      nieuw+=ndwUpsertAsset('ndw_drip_'+weg.toLowerCase(),{naam:'DRIP '+weg+' · '+n+' panelen (NDW)',cmdb:'Facilitair',type:'drip',locatie:weg,aantal:n,besch:norm,storingenJr:0,weging:1,fw:2,conditie:2,uitstelMnd:0,redundant:false});
    });
    if(drip.overig>0)nieuw+=ndwUpsertAsset('ndw_drip_overig',{naam:'DRIP’s stedelijk/regionaal · '+drip.overig+' panelen (NDW)',cmdb:'Facilitair',type:'drip',locatie:'stedelijk/regionaal',aantal:drip.overig,besch:norm,storingenJr:0,weging:1,fw:2,conditie:2,uitstelMnd:0,redundant:false});
    DB.ndwImport.drip={bestand:drip.bestand,datum:vandaag,peilmoment:drip.peilmoment,totaal:drip.totaal,wegen:Object.keys(drip.perWeg).length,overig:drip.overig,nieuw};
  }
  if(onbekend.length)alert('Niet herkend als NDW MSI- of DRIP-bestand: '+onbekend.join(', '));
  if(msi||drip)saveDB();
}
function ndwVerwijder(){
  if(!confirm('Alle via NDW geïmporteerde assets (MSI/DRIP per weg) uit het register verwijderen?'))return;
  DB.assets=DB.assets.filter(a=>!String(a.id).startsWith('ndw_'));
  (DB.ketens||[]).forEach(k=>{k.schakels=(k.schakels||[]).filter(id=>!String(id).startsWith('ndw_'))});
  delete DB.ndwImport;
  saveDB();
}

/* ═══════════════════════════════════════════════════════════
   STORINGSMELDINGEN — doorrekening volgens de storingsregels (§ 4.7)
   CSV-import (kolommen zoals de storingsbron: asset, type,
   storingsomschrijving, foutcode, wegnummer, wegdeelletter, hm-bord,
   strooknummer, datum; optioneel context en duur in uren).
   Zes stappen: 1 classificeren (assetTypen) · 2 locatiecontext
   (locatieRegels) · 3 foutcode mappen (foutcodes) · 4 basisimpact ·
   5 combi-regels · 6 aggregatie per wegnummer op de geladen
   NDW-MSI-assets: beschikbaarheid én prestatie apart, plus
   storingen/jr (telt door in triggers en Monte Carlo, P4).
   ═══════════════════════════════════════════════════════════ */
function parseCsvTekst(text){
  const lines=String(text).split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2)return [];
  const sep=['\t',';',','].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
  const kop=lines[0].split(sep).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(l=>{const p=l.split(sep);const o={};kop.forEach((h,i)=>o[h]=(p[i]||'').trim());return o});
}
function srKolom(m,aliassen){for(const a of aliassen){if(m[a]!==undefined&&m[a]!=='')return m[a]}return ''}
function srNum(v){const x=parseFloat(String(v).replace(',','.'));return isNaN(x)?null:x}
function srOms(m){return String(srKolom(m,['storingsomschrijving','omschrijving','melding']))}
function srClassificeer(m){ // stap 1: assettype via de match-regels
  for(const r of DB.storingsRegels.assetTypen){
    if(!r.actief)continue;
    const veld=r.matchVeld==='asset'?srKolom(m,['asset','assetnaam']):r.matchVeld==='type'?srKolom(m,['type']):srOms(m);
    const v=String(veld).toLowerCase(),w=String(r.matchWaarde).toLowerCase();
    if(r.matchOp==='equals'?v===w:v.includes(w))return r.id;
  }
  return null;
}
function srFoutregel(m,typeId){ // stap 3: foutcode (of patroon in de omschrijving)
  const code=String(srKolom(m,['foutcode','code','storingscode'])).trim();
  const oms=srOms(m).toLowerCase();
  let best=null;
  for(const f of DB.storingsRegels.foutcodes){
    if(!f.actief||f.assetType!==typeId)continue;
    if(code&&String(f.code)===code)return f;
    if(!code&&f.patroon&&oms.includes(String(f.patroon).toLowerCase()))best=best||f;
  }
  return best;
}
function srLocatieFactor(m,typeId){ // stap 2: contextfactor (hoogste prioriteit wint)
  const ctx=String(srKolom(m,['context','locatiecontext','ramp_context'])).trim().toLowerCase();
  if(!ctx)return {fA:1,fP:1};
  let best=null;
  for(const l of DB.storingsRegels.locatieRegels){
    if(!l.actief||l.assetType!==typeId||String(l.context).toLowerCase()!==ctx)continue;
    if(!best||l.prioriteit>best.prioriteit)best=l;
  }
  return best?{fA:+best.fAvail,fP:+best.fPerf}:{fA:1,fP:1};
}
function ongebruikteLegacyVerwerkMeldingen(text,bestand){
  const R=DB.storingsRegels;
  const rijen=parseCsvTekst(text);
  if(!rijen.length){alert('Geen meldingen gevonden in het bestand (verwacht: CSV met kopregel).');return}
  const M=[];const gezien=new Set();let dubbel=0,nietGecl=0,zonderFoutregel=0;
  rijen.forEach(m=>{
    const typeId=srClassificeer(m);
    if(!typeId){nietGecl++;return}
    const f=srFoutregel(m,typeId);
    if(!f){zonderFoutregel++;return}
    let weg=String(srKolom(m,['wegnummer','weg'])).trim().toUpperCase();
    if(/^\d+$/.test(weg))weg='A'+weg;
    const richting=String(srKolom(m,['wegdeelletter','richting'])).trim().toUpperCase();
    const hm=srNum(srKolom(m,['hm-bord','hm','hectometer']));
    const t=Date.parse(srKolom(m,['datum','tijdstip','ts','date']))||null;
    const sleutel=[weg,richting,hm,f.code,srKolom(m,['strooknummer','strook'])].join('|'); // dedupe: road+dir+hm+strook+code
    if(gezien.has(sleutel)){dubbel++;return}
    gezien.add(sleutel);
    const at=R.assetTypen.find(x=>x.id===typeId);
    const loc=srLocatieFactor(m,typeId);
    M.push({typeId,code:String(f.code),weg,richting,hm,t,
      duur:srNum(srKolom(m,['duur','duur_uren','hersteltijd'])),
      avail:Math.min(100,f.availPct*at.wAvail*loc.fA),   // stap 4: basisimpact × gewicht × locatiefactor, cap 100
      perf:Math.min(100,f.perfPct*at.wPerf*loc.fP)});
  });
  // stap 5: combi-regels — zelfde weg+richting, binnen hm-afstand en tijdvenster
  let combiHits=0;
  R.combiRegels.filter(c=>c.actief).forEach(c=>{
    const zelfde=c.type1===c.type2&&String(c.code1)===String(c.code2);
    for(let i=0;i<M.length;i++)for(let j=0;j<M.length;j++){
      if(i===j||(zelfde&&i>=j))continue;
      const a=M[i],b=M[j];
      if(a.weg!==b.weg||a.richting!==b.richting)continue;
      if(!(a.typeId===c.type1&&(!c.code1||a.code===String(c.code1))))continue;
      if(!(b.typeId===c.type2&&(!c.code2||b.code===String(c.code2))))continue;
      if(a.hm!==null&&b.hm!==null&&Math.abs(a.hm-b.hm)>+c.maxKm)continue;
      if(a.t&&b.t&&Math.abs(a.t-b.t)>c.venMin*60000)continue;
      a.avail=Math.min(+c.capAvail,a.avail+ +c.extraAvail);
      a.perf=Math.min(+c.capPerf,a.perf+ +c.extraPerf);
      combiHits++;
    }
  });
  // stap 6: aggregatie per wegnummer op de geladen NDW-MSI-assets
  const ts=M.map(m=>m.t).filter(Boolean);
  const periodeJr=ts.length>=2?Math.max((Math.max(...ts)-Math.min(...ts))/(365.25*24*3600e3),1/52):1;
  const periodeUren=periodeJr*8760;
  const perWeg={};
  M.filter(m=>m.typeId==='MSI').forEach(m=>{
    const agg=perWeg[m.weg]=perWeg[m.weg]||{n:0,availUren:0,perfUren:0};
    agg.n++;
    const duur=m.duur||+cfg('assets.hw_mttr',6); // hersteltijd uit de melding, anders config-MTTR
    agg.availUren+=m.avail/100*duur;
    agg.perfUren+=m.perf/100*duur;
  });
  const resultaat=[],zonderAreaal=[];
  Object.entries(perWeg).forEach(([weg,agg])=>{
    const a=DB.assets.find(x=>x.id==='ndw_msi_'+weg.toLowerCase());
    const N=a?(a.aantal||+((String(a.naam).match(/(\d+) signaalgevers/)||[])[1])||0):0;
    if(!a||!N){zonderAreaal.push(weg+' ('+agg.n+' meldingen)');return}
    // areaalbeschikbaarheid = 100 − Σ(impact × duur) / (aantal signaalgevers × periode)
    a.besch=Math.round(Math.max(0,Math.min(100,100-agg.availUren/(N*periodeUren)*100))*1000)/1000;
    a.prestatie=Math.round(Math.max(0,Math.min(100,100-agg.perfUren/(N*periodeUren)*100))*1000)/1000;
    a.storingenJr=Math.round(agg.n/periodeJr*10)/10;
    resultaat.push({weg,n:agg.n,besch:a.besch,prestatie:a.prestatie,stJr:a.storingenJr});
  });
  resultaat.sort((x,y)=>y.n-x.n);
  DB.storingsImport={bestand,datum:new Date().toISOString().slice(0,10),
    meldingen:rijen.length,toegepast:M.length,dubbel,nietGeclassificeerd:nietGecl,zonderFoutregel,
    nietMsi:M.filter(m=>m.typeId!=='MSI').length,combiHits,
    periodeJr:Math.round(periodeJr*100)/100,resultaat,zonderAreaal};
  saveDB();
}
function srHandleFile(ev){
  const f=ev.target.files[0];ev.target.value='';if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{verwerkMeldingen(r.result,f.name)}catch(e){alert('Kon meldingen niet verwerken: '+e.message)}};
  r.readAsText(f);
}

/* ── config.html scenario importeren ── */
function flattenCfg(obj,prefix,out){out=out||{};for(const k in obj){if(k.startsWith('_'))continue;const v=obj[k],key=prefix?prefix+'.'+k:k;
  if(v&&typeof v==='object'&&!Array.isArray(v))flattenCfg(v,key,out);else out[key]=v}return out}
function applyScenario(json,bron){
  let c=json;
  if(json&&json._type==='vwl-scenario')c=json.config;         // exportForFramework-formaat
  const flat=flattenCfg(c,'');
  DB.config={...CFG_DEFAULTS,...flat};
  DB.configBron=bron+(flat['scenario.naam']?' \u00b7 scenario \u201c'+flat['scenario.naam']+'\u201d':'');
  saveDB();
}
function cfgHandleFile(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{applyScenario(JSON.parse(r.result),f.name)}catch(e){alert('Kon JSON niet lezen: '+e.message)}};
  r.readAsText(f);ev.target.value='';
}
function cfgFromStorage(){
  try{
    const sc=JSON.parse(localStorage.getItem('vwl-scenarios')||'null');
    const act=localStorage.getItem('vwl-active-scenario');
    if(sc&&act&&sc[act]){applyScenario(sc[act],'browseropslag config.html');return}
    if(sc){const k=Object.keys(sc)[0];if(k){applyScenario(sc[k],'browseropslag config.html');return}}
    alert('Geen opgeslagen scenario\u2019s van config.html gevonden in deze browser.\nGebruik in config.html \u201cExport voor Framework\u201d en importeer de JSON hier.');
  }catch(e){alert('Browseropslag onleesbaar: '+e.message)}
}
function cfgReset(){DB.config={...CFG_DEFAULTS};DB.configBron='standaard (ingebouwd, gelijk aan config.html)';saveDB()}

/* ═══════════════════════════════════════════════════════════
   INTEGRALE PLANNING — de originele tool, integraal embedded
   De volledige integrale-planning-rws.html draait ongewijzigd
   in een iframe (zelfde origin via blob-URL); alle functies —
   XML-import, gelaagde Gantt, cascade-shifts, FTE-capaciteit,
   dashboards, autosave — blijven 1-op-1 behouden. De trigger
   engine leest het model uitsluitend read-only uit via de brug.
   ═══════════════════════════════════════════════════════════ */
const DIENST_KLEUR={GPO:'#003082',CIV:'#5a2d82',VWM:'#00823c',PPO:'#00698a',Regio:'#c05000'};
let IPL_FRAME=null,IPL_LASTSIG='';
function iplWin(){try{if(!IPL_FRAME||!IPL_FRAME.contentWindow||!IPL_FRAME.contentWindow.document)return null;var w=IPL_FRAME.contentWindow;return w.IPL_MODEL!==undefined?w:null}catch(e){return null}}
/* read-only brug: effectieve datums via ipl_eff (dus inclusief cascade-/maand-/projectshifts) */
function bridgeModel(){
  const W=iplWin();if(!W||!W.IPL_MODEL)return null;
  try{
    const M=W.IPL_MODEL;
    const eff=r=>{try{return W.ipl_eff?W.ipl_eff(r):{t0:r.t0,t1:r.t1}}catch(e){return {t0:r.t0,t1:r.t1}}};
    const topOf=r=>(r.wbsPath&&r.wbsPath.length?r.wbsPath[0]:'')||r.wbs||'';
    const dnst=blokId=>{const map=W.IPL_WBS_DIENST||{};return map[blokId]||'GPO'};
    const regels=(M.regels||[]).map(r=>{const e=eff(r);const blok=topOf(r);
      return {id:r.id,naam:r.naam,code:r.code,t0:e.t0,t1:e.t1,kind:r.kind,blok,dienst:dnst(blok)}});
    const byId={};(M.regels||[]).forEach(r=>byId[r.id]=r);
    let nRel=0,nCross=0;
    (M.relaties||[]).forEach(rl=>{const a=byId[rl.from],b=byId[rl.to];if(!a||!b)return;nRel++;
      if(topOf(a)!==topOf(b))nCross++});
    const ts=[];regels.forEach(r=>{ts.push(r.t0,r.t1)});
    const relaties=(M.relaties||[]).map(rl=>({from:rl.from,to:rl.to,type:rl.type||rl.rel||''}));
    return {bestand:W.IPL_RAW_FILENAME||'geladen planning',regels,relaties,nRel,nCross,
      t0:ts.length?Math.floor(Math.min(...ts)):0,t1:ts.length?Math.ceil(Math.max(...ts)):0,
      shift:W.IPL_SHIFT||0};
  }catch(e){return null}
}
/* capaciteitsvraag uit de planningstool: FTE-rollen per taak (IPL_CONFIG.fte),
   gevuld via de eigen config/templates van de tool ([VWM] Fase). Read-only:
   we roepen alleen de tool z'n eigen ensure- en leesfuncties aan. */
function bridgeCapaciteit(){
  const W=iplWin();if(!W||!W.IPL_MODEL)return null;
  try{
    const M=W.IPL_MODEL;
    try{if(W.ipl_dashEnsureFte)W.ipl_dashEnsureFte(M.regels)}catch(e){}
    /* FTE-rollen per taak: bij een geladen P6-FTE-export (DB.p6Capaciteit) houdt het
       dashboard de capaciteit uit dát bestand aan (match op activity-ObjectId = regel.id);
       anders de eigen FTE-config van de planningstool. */
    const p6=DB.p6Capaciteit&&DB.p6Capaciteit.perActiviteit;
    const rollen=r=>{
      if(p6&&p6[r.id])return p6[r.id];
      try{return (W.ipl_dashTaakFteRollen?W.ipl_dashTaakFteRollen(r):[])||[]}catch(e){return []}
    };
    const eff=r=>{try{return W.ipl_eff?W.ipl_eff(r):{t0:r.t0,t1:r.t1}}catch(e){return {t0:r.t0,t1:r.t1}}};
    const topOf=r=>(r.wbsPath&&r.wbsPath.length?r.wbsPath[0]:'')||r.wbs||'';
    const dnst=b=>((W.IPL_WBS_DIENST||{})[b])||'GPO';
    const taken=(M.regels||[]).filter(r=>r.kind!=='mile');
    let nMetFte=0,totFte=0;
    const items=taken.map(r=>{
      const f=rollen(r).reduce((s,a)=>s+(parseFloat(a.fte)||0),0);
      if(f>0){nMetFte++;totFte+=f}
      const e=eff(r);
      return {t0:e.t0,t1:e.t1,fte:f,dienst:dnst(topOf(r)),naam:r.naam};
    }).filter(x=>x.fte>0);
    if(!items.length)return {geconfig:false,nTaken:taken.length,kwartalen:[],perDienst:{},diensten:[]};
    const t0=Math.floor(Math.min(...items.map(x=>x.t0))),t1=Math.ceil(Math.max(...items.map(x=>x.t1)));
    const kwartalen=[];const perDienst={};
    for(let y=t0;y<t1;y++)for(let q=0;q<4;q++){
      const tm=y+q/4+1/8;const kw={label:'Q'+(q+1)+' '+String(y).slice(2),jaar:y,q:q+1,per:{},tot:0};
      items.forEach(it=>{if(tm>=it.t0&&tm<it.t1){kw.per[it.dienst]=(kw.per[it.dienst]||0)+it.fte;kw.tot+=it.fte}});
      Object.entries(kw.per).forEach(([d,v])=>{if(!perDienst[d])perDienst[d]={piek:0,piekKw:'',overKw:0};
        if(v>perDienst[d].piek){perDienst[d].piek=v;perDienst[d].piekKw=kw.label}});
      kwartalen.push(kw);
    }
    Object.keys(perDienst).forEach(d=>{const g=+((DB.capgrens||{})[d]||0);
      perDienst[d].grens=g;
      perDienst[d].overKw=g>0?kwartalen.filter(k=>(k.per[d]||0)>g).length:0});
    while(kwartalen.length&&kwartalen[0].tot===0)kwartalen.shift();
    while(kwartalen.length&&kwartalen[kwartalen.length-1].tot===0)kwartalen.pop();
    return {geconfig:true,nMetFte,nTaken:taken.length,totFte,kwartalen,perDienst,diensten:Object.keys(perDienst)};
  }catch(e){return null}
}

/* wijzigingen in het iframe (import, shifts) automatisch doorzetten naar de driehoek */
setInterval(()=>{
  const m=bridgeModel();
  const c=bridgeCapaciteit();
  const sig=(m?m.bestand+'|'+m.regels.length+'|'+m.shift+'|'+m.t0+'|'+m.t1:'')+(c&&c.geconfig?('|cap'+c.totFte.toFixed(1)+'-'+c.nMetFte):'');
  if(sig!==IPL_LASTSIG){IPL_LASTSIG=sig;
    const act=document.querySelector('.page.active');
    if(act&&act.id!=='page-sim'&&act.id!=='page-planning')refresh();
    else{const T=evalTriggers(activeParams());['dot-dash','dot-trig'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.background=ragColor(ragOf(T))})}
  }
},2000);

/* corridor-tokens (A15, N57, …tunnel) uit activiteitnamen */
function corridors(naam){
  const out=new Set();const n=naam||'';
  (n.match(/\b[ANan]\d{1,3}\b/g)||[]).forEach(t=>out.add(t.toUpperCase()));
  (n.toLowerCase().match(/[a-z\u00e0-\u00fc]+tunnel/g)||[]).forEach(t=>out.add(t));
  return out;
}
function fToDatum(f){const y=Math.floor(f),m=Math.floor((f-y)*12);
  return ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][Math.max(0,Math.min(11,m))]+' '+y}
/* planningstriggers op het live model van de embedded tool */
function planningTriggers(){
  const T=[];const m=bridgeModel();if(!m)return T;
  const werken=m.regels.filter(r=>r.kind==='bar');
  for(let i=0;i<werken.length;i++)for(let j=i+1;j<werken.length;j++){
    const A=werken[i],B=werken[j];
    const overlap=Math.min(A.t1,B.t1)-Math.max(A.t0,B.t0);
    if(overlap<=0.01)continue;
    if(A.blok===B.blok)continue;
    const cA=corridors(A.naam),cB=corridors(B.naam);
    const shared=[...cA].filter(x=>cB.has(x));
    if(shared.length){
      T.push({sev:overlap>0.08?'r':'o',dom:'planning',resp:RESP.planning,titel:'Corridorconflict \u00b7 '+shared.join(', '),
        msg:`${A.dienst}: \u201c${A.naam}\u201d overlapt ${fmtF(overlap*12,1)} mnd met ${B.dienst}: \u201c${B.naam}\u201d (${fToDatum(Math.max(A.t0,B.t0))} \u2013 ${fToDatum(Math.min(A.t1,B.t1))}).`,
        val:shared.join(' + '),type:'conflict',meta:{tokens:shared,duur:overlap,tA:Math.max(A.t0,B.t0)}});
    }
  }
  const drempel=+cfg('hinder.max_files_werk',10);
  let piek=0,piekT=m.t0;
  werken.forEach(w=>{const t=w.t0+0.001;
    const n=werken.filter(r=>r.t0<=t&&r.t1>=t).length;
    if(n>piek){piek=n;piekT=t}});
  if(piek>drempel){
    T.push({sev:'r',dom:'planning',resp:RESP.planning,titel:'Gelijktijdigheidspiek boven hinderdrempel',
      msg:`Rond ${fToDatum(piekT)} lopen ${piek} werken tegelijk; de config-regel hinder.max_files_werk staat op ${drempel}.`,val:piek+' > '+drempel+' werken',type:'piek',meta:{piek,drempel,piekT}});
  }
  if(m.nCross>0){
    T.push({sev:'o',dom:'planning',resp:RESP.planning,titel:'Cross-dienst afhankelijkheden in de keten',
      msg:`De planning bevat ${m.nCross} relaties tussen verschillende WBS-hoofdgroepen; vertraging werkt door over dienstgrenzen heen.`,val:m.nCross+' van '+m.nRel+' relaties',type:'cross',meta:{}});
  }
  // capaciteitsvraag uit de planningstool vs capaciteitsgrenzen (rule engine-voorwaarde)
  const cap=bridgeCapaciteit();
  if(cap&&cap.geconfig){
    Object.entries(cap.perDienst).forEach(([d,info])=>{
      if(info.grens>0&&info.piek>info.grens){
        T.push({sev:(info.piek-info.grens)>=2?'r':'o',dom:'formatie',resp:RESP.formatie,
          titel:'Capaciteitsoverschrijding '+d+' \u00b7 planningsvraag boven grens',
          msg:'De FTE-vraag uit de geladen planning piekt op '+fmtF(info.piek)+' fte in '+info.piekKw+' tegen een capaciteitsgrens van '+fmtF(info.grens,0)+' fte ('+info.overKw+' kwartaal/kwartalen boven de grens). De grens is instelbaar in de rule engine.',
          val:fmtF(info.piek)+' > '+fmtF(info.grens,0)+' fte',type:'capaciteit',
          meta:{dienst:d,piek:info.piek,grens:info.grens,overKw:info.overKw}});
      }
    });
  }
  if(m.shift){
    T.push({sev:Math.abs(m.shift)>=9?'r':'o',dom:'planning',resp:RESP.planning,titel:'Actieve planningsverschuiving',
      msg:`In de planningstool staat een globale shift van ${m.shift>0?'+':''}${m.shift} maanden; alle triggers rekenen met de verschoven (effectieve) datums.`,val:(m.shift>0?'+':'')+m.shift+' mnd',type:'shift',meta:{mnd:m.shift}});
  }
  return T;
}

/* ═══════════════════════════════════════════════════════════
   IMPACT ENGINE — de trigger engine duidt per meldingstype de
   brede impact: een planningsafwijking wordt via de koppel-
   voorwaarden van de rule engine (locatie \u2192 asset \u2192 functie \u2192
   fte/\u20ac/richtlijn) vertaald naar afgeleide triggers in ALLE
   datasets: formatie, assets, financi\u00ebn en wettelijke richtlijnen.
   ═══════════════════════════════════════════════════════════ */
const DOMNAAM={formatie:'Formatie',financien:'Financi\u00ebn',asset:'Assets',richtlijn:'Richtlijn',planning:'Planning',model:'Model'};
function tokenMatch(tokens,tekst){const t=(tekst||'').toLowerCase();return tokens.some(x=>t.includes(String(x).toLowerCase()))}
/* koppelvoorwaarde: corridor-token \u2192 assets (locatie) \u2192 functies (naam of gekoppelde assets) */
function gekoppeld(tokens){
  const assets=DB.assets.filter(a=>tokenMatch(tokens,a.locatie)||tokenMatch(tokens,a.naam));
  const aIds=new Set(assets.map(a=>a.id));
  const functies=DB.functies.filter(f=>tokenMatch(tokens,f.naam)||f.assets.some(id=>aIds.has(id)));
  return {assets,functies};
}
function berekenImpact(t,p){
  const R=DB.impact,chips=[],derived=[];
  const bron='\u26d3 afgeleid \u00b7 '+t.titel;
  if(t.type==='conflict'){
    const {assets,functies}=gekoppeld(t.meta.tokens);
    const duur=t.meta.duur;
    // \u2192 FORMATIE: piekinzet op gekoppelde functies tijdens het conflictvenster
    let extraFte=0;
    functies.forEach(f=>{extraFte+=f.benodigdFte*R.fteOpslagConflict/100});
    if(extraFte>=0.1){
      chips.push({dom:'formatie',txt:'+'+fmtF(extraFte)+' fte piek ('+functies.length+' functies)'});
      derived.push({sev:extraFte>=1?'r':'o',dom:'formatie',resp:RESP.formatie,afgeleid:bron,
        titel:'Piekinzet door corridorconflict \u00b7 '+t.meta.tokens.join(', '),
        msg:'Rule engine-voorwaarde: +'+fmtF(R.fteOpslagConflict,0)+'% inzet op gekoppelde functies ('+functies.map(f=>f.naam).join('; ')+') gedurende '+fmtF(duur*12,1)+' maanden rond '+fToDatum(t.meta.tA)+'.',
        val:'+'+fmtF(extraFte)+' fte tijdens venster'});
    }
    // \u2192 RICHTLIJN: ATW-druk op gekoppelde functies met ATW-regime
    const atwF=functies.filter(f=>f.richtlijnen.includes('atw'));
    if(atwF.length&&extraFte>=0.1){
      chips.push({dom:'richtlijn',txt:'ATW-druk op '+atwF.length+' functie(s)'});
      derived.push({sev:extraFte>=1?'r':'o',dom:'richtlijn',resp:RESP.richtlijn,afgeleid:bron,
        titel:'ATW-druk door piekinzet \u00b7 '+t.meta.tokens.join(', '),
        msg:'Extra diensten tijdens het conflictvenster verhogen het risico op overschrijding van max '+cfg('atw.max_uren_week',60)+' uur/week en '+cfg('atw.rust_dagelijks',11)+' uur rust (config.html) voor: '+atwF.map(f=>f.naam).join('; ')+'.',
        val:'wettelijke richtlijn'});
    }
    // \u2192 ASSETS: verhoogd storingsrisico op gekoppelde assets tijdens werkzaamheden
    assets.forEach(a=>{
      const norm=normVoor(a);
      const beschProj=100-(100-a.besch)*R.storingsOpslag*p.storingsFactor;
      if(beschProj<norm){
        chips.push({dom:'asset',txt:a.naam+' \u2192 '+fmtF(beschProj,2)+'% (< norm)'});
        derived.push({sev:(norm-beschProj)*a.weging>=0.8?'r':'o',dom:'asset',resp:RESP.asset,afgeleid:bron,
          titel:'Verhoogd uitvalrisico tijdens werkzaamheden \u00b7 '+a.naam,
          msg:'Rule engine-voorwaarde: storingsrisico \u00d7'+fmtF(R.storingsOpslag)+' tijdens werkzaamheden. Prognose beschikbaarheid '+fmtF(beschProj,2)+'% tegen norm '+fmtF(norm)+'% ('+CAT_NORM[a.cmdb]+').',
          val:'prognose '+fmtF(beschProj,2)+'%'});
      }
    });
    // \u2192 FINANCI\u00cbN: meerkosten piekinzet + boeterisico tijdens venster
    let meer=extraFte*duur*R.fteKostenJr,boete=0;
    const eis=+cfg('contract.beschikbaarheidseis',99.5),perUur=+cfg('contract.boete_per_uur',500);
    const boeteAan=cfg('contract.boete_actief',true)===true||cfg('contract.boete_actief','true')==='true';
    if(boeteAan)assets.forEach(a=>{
      const beschProj=100-(100-a.besch)*R.storingsOpslag*p.storingsFactor;
      if(beschProj<eis)boete+=(eis-beschProj)/100*8760*duur*perUur;
    });
    if(meer+boete>1000){
      chips.push({dom:'financien',txt:fmtE(meer+boete)+' meerkosten'});
      derived.push({sev:(meer+boete)>DB.financien.budgetJr*0.05?'r':'o',dom:'financien',resp:RESP.financien,afgeleid:bron,
        titel:'Meerkosten corridorconflict \u00b7 '+t.meta.tokens.join(', '),
        msg:'Piekinzet '+fmtF(extraFte)+' fte \u00d7 '+fmtF(duur*12,1)+' mnd \u00d7 '+fmtE(R.fteKostenJr)+'/fte-jaar = '+fmtE(meer)+(boete>0?'; boeterisico prestatiecontract tijdens venster '+fmtE(boete):'')+'.',
        val:fmtE(meer+boete),gapEur:meer+boete});
    }
  }
  else if(t.type==='piek'){
    const over=t.meta.piek-t.meta.drempel;
    const totBen=DB.functies.reduce((s,f)=>s+f.benodigdFte,0);
    const extraFte=totBen*over*R.piekOpslagPct/100;
    if(extraFte>=0.1){
      chips.push({dom:'formatie',txt:'+'+fmtF(extraFte)+' fte regie'});
      derived.push({sev:extraFte>=1.5?'r':'o',dom:'formatie',resp:RESP.formatie,afgeleid:bron,
        titel:'Regie-inzet door gelijktijdigheidspiek',
        msg:'Rule engine-voorwaarde: +'+fmtF(R.piekOpslagPct,0)+'% inzet per werk boven de hinderdrempel ('+over+' werken boven '+t.meta.drempel+') rond '+fToDatum(t.meta.piekT)+'.',
        val:'+'+fmtF(extraFte)+' fte'});
      const meer=extraFte*(1/12)*R.fteKostenJr*over>0?extraFte*(2/12)*R.fteKostenJr:0;
      if(meer>1000){chips.push({dom:'financien',txt:fmtE(meer)+' regiekosten'});}
    }
  }
  else if(t.type==='shift'){
    const mnd=Math.abs(t.meta.mnd);
    const totOnd=DB.functies.reduce((s,f)=>s+f.onderhoudEur,0);
    const meer=totOnd*(R.shiftKostenPctMnd/100)*mnd;
    if(meer>1000){
      chips.push({dom:'financien',txt:fmtE(meer)+' indexatie'});
      derived.push({sev:meer>DB.financien.budgetJr*0.05?'r':'o',dom:'financien',resp:RESP.financien,afgeleid:bron,
        titel:'Kosteneffect planningsverschuiving',
        msg:'Rule engine-voorwaarde: '+fmtF(R.shiftKostenPctMnd,2)+'% indexatie op het P\u00d7Q-onderhoud per maand verschuiving \u00d7 '+mnd+' mnd.',
        val:fmtE(meer)+'/jr',gapEur:meer});
    }
  }
  else if(t.type==='capaciteit'){
    const tekort=t.meta.piek-t.meta.grens;
    const inhuur=tekort*(t.meta.overKw/4)*R.fteKostenJr*1.3; // inhuurfactor 1,3 op loonkosten
    if(inhuur>1000){
      chips.push({dom:'financien',txt:fmtE(inhuur)+' inhuurrisico'});
      derived.push({sev:inhuur>DB.financien.budgetJr*0.05?'r':'o',dom:'financien',resp:RESP.financien,afgeleid:bron,
        titel:'Inhuurrisico capaciteitsoverschrijding '+t.meta.dienst,
        msg:'Rule engine-voorwaarde: tekort '+fmtF(tekort)+' fte over '+t.meta.overKw+' kwartaal/kwartalen tegen '+fmtE(R.fteKostenJr)+'/fte-jaar met inhuurfactor 1,3.',
        val:fmtE(inhuur),gapEur:inhuur});
    }
    chips.push({dom:'formatie',txt:'piek '+fmtF(t.meta.piek)+' fte ('+t.meta.dienst+')'});
  }
  else if(t.type==='cross'){
    chips.push({dom:'planning',txt:'ketenrisico: vertraging werkt dienst-overstijgend door'});
  }
  return {chips,derived};
}
/* totalen voor de Monte Carlo: planningsimpact telt door in de prognose */
function planningImpactTotals(p){
  const out={extraFteJr:0,extraKostenJr:0,storingsOpslagAssets:{}};
  planningTriggers().forEach(t=>{
    const im=berekenImpact(t,p);
    im.derived.forEach(d=>{
      if(d.dom==='formatie'&&t.type==='conflict')out.extraFteJr+=parseFloat((d.val.match(/[\d,.]+/)||['0'])[0].replace(',','.'))*t.meta.duur;
      if(d.dom==='financien')out.extraKostenJr+=d.gapEur||0;
    });
    if(t.type==='conflict')gekoppeld(t.meta.tokens).assets.forEach(a=>{out.storingsOpslagAssets[a.id]=Math.max(out.storingsOpslagAssets[a.id]||1,DB.impact.storingsOpslag)});
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════
   SIMULATIE-STATE
   ═══════════════════════════════════════════════════════════ */
let SIM=null;
function basisParams(){return {verzuim:+cfg('personeel.ziekteverzuim',5),kostenIndex:DB.params.kostenIndex,storingsFactor:1,budgetPct:0,ftePct:0}}
function activeParams(){return SIM||basisParams()}
function simActive(){return SIM!==null}
function resetSim(){SIM=null;refresh()}
function simUitConfig(){ // sim.*-factoren uit config.html overnemen
  const pf=+cfg('sim.personeel_factor',1),bf=+cfg('sim.budget_factor',1),af=+cfg('sim.asset_factor',1),im=+cfg('sim.incident_multiplier',1);
  SIM={...basisParams(),ftePct:Math.round((pf-1)*100),budgetPct:Math.round((bf-1)*100),storingsFactor:+( (af>0?1/af:1)*im ).toFixed(2)};
  refresh();
}

/* ═══════════════════════════════════════════════════════════
   TRIGGER ENGINE — toetst actuele data aan de config-regels
   ═══════════════════════════════════════════════════════════ */
const RESP={formatie:'Afdelingshoofd VWM',financien:'Businesscontroller WVM',asset:'Assetmanager CIV/PPO',planning:'Planningsco\u00f6rdinator WVM',richtlijn:'Afdelingshoofd VWM',model:'Adviseur bedrijfsvoering'};
const DOMEINEN=[
  {id:'planning',naam:'Integrale planning',src:['Primavera P6 XML','GPO \u00b7 VWM \u00b7 CIV']},
  {id:'asset',naam:'Asset prestaties / LCM',src:['CMDB DVM','CMDB Productieplatform','CMDB Tunnel/TTI','CMDB Facilitair']},
  {id:'model',naam:'Bedrijfskundig model',src:['Bedrijfsdoelen','Bedrijfsfuncties','Bedrijfssystemen']},
  {id:'formatie',naam:'Formatie',src:['Benodigde FTE','Actuele FTE']},
  {id:'financien',naam:'Financi\u00ebn',src:['Benodigde middelen','Budget','Contractboete']}
];
function fmtE(v){return '\u20ac '+Math.round(v).toLocaleString('nl-NL')}
function fmtF(v,d=1){return v.toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d})}

function evalTriggers(p){
  const T=[];
  const min_bez=+cfg('personeel.min_bezetting',80),niv1=+cfg('escalatie.niveau1',90),niv2=+cfg('escalatie.niveau2',75);
  // 1. FORMATIE — bezettingsgraad vs escalatieniveaus uit config.html
  DB.functies.forEach(f=>{
    const benodigdEff=f.benodigdFte*(1+p.verzuim/100);
    const actueelEff=f.actueelFte*(1+p.ftePct/100);
    const gap=benodigdEff-actueelEff;
    const bez=benodigdEff>0?actueelEff/benodigdEff*100:100;
    if(gap>0.05){
      const sev=(bez<min_bez||bez<niv2)?'r':(bez<niv1?'o':'g');
      T.push({sev,dom:'formatie',resp:RESP.formatie,titel:'FTE-tekort \u00b7 '+f.naam,
        msg:`Bezettingsgraad ${fmtF(bez)}% (regels: min. ${min_bez}%, escalatie <${niv1}%/<${niv2}%). Benodigd ${fmtF(f.benodigdFte)} fte + ${fmtF(p.verzuim)}% verzuim (personeel.ziekteverzuim) = ${fmtF(benodigdEff)} fte; actueel ${fmtF(actueelEff)} fte.`,
        val:'\u0394 '+fmtF(gap)+' fte \u00b7 '+fmtF(bez,0)+'%',fid:f.id,gap});
      if(sev!=='g'&&f.richtlijnen.includes('atw')){
        T.push({sev,dom:'richtlijn',resp:RESP.richtlijn,titel:'ATW-risico \u00b7 '+f.naam,
          msg:`Onderbezetting vergroot de kans op overschrijding van de ATW-regels uit config.html: max ${cfg('atw.max_uren_week',60)} uur/week, ${cfg('atw.rust_dagelijks',11)} uur dagelijkse rust, max ${cfg('atw.max_nachten_14d',5)} nachten per 14 dagen.`,
          val:'wettelijke richtlijn',fid:f.id});
      }
    }
  });
  // 2. FINANCIËN — P×Q benodigde middelen vs budget
  const benodigd=DB.functies.reduce((s,f)=>s+f.onderhoudEur,0)*p.kostenIndex;
  const budget=DB.financien.budgetJr*(1+p.budgetPct/100);
  const fgap=benodigd-budget;
  if(fgap>0){
    T.push({sev:fgap>budget*0.05?'r':'o',dom:'financien',resp:RESP.financien,titel:'Budgettekort dienstverlening',
      msg:`Benodigde middelen volgens rule engine: ${fmtE(benodigd)} (kostenindex ${fmtF(p.kostenIndex,2)}). Beschikbaar budget: ${fmtE(budget)}.`,
      val:'\u0394 '+fmtE(fgap),gap:fgap});
  }
  // 2b. CONTRACTBOETE — contract.beschikbaarheidseis + boete_per_uur uit config.html
  if(cfg('contract.boete_actief',true)===true||cfg('contract.boete_actief','true')==='true'){
    const eis=+cfg('contract.beschikbaarheidseis',99.5),perUur=+cfg('contract.boete_per_uur',500);
    let boete=0,geraakt=[];
    DB.assets.forEach(a=>{
      const beschEff=100-(100-a.besch)*p.storingsFactor;
      if(beschEff<eis){const uren=(eis-beschEff)/100*8760;boete+=uren*perUur;geraakt.push(a.naam)}
    });
    if(boete>0){
      T.push({sev:boete>50000?'r':'o',dom:'financien',resp:RESP.financien,titel:'Boeterisico prestatiecontract',
        msg:`Beschikbaarheidseis ${fmtF(eis)}% (contract.beschikbaarheidseis) wordt niet gehaald door: ${geraakt.join(', ')}. Boete ${fmtE(perUur)}/uur onder de eis.`,
        val:fmtE(boete)+'/jr',gap:boete});
    }
  }
  // 3. ASSETS — beschikbaarheid vs categorienorm uit config.html, gewogen naar locatie
  DB.assets.forEach(a=>{
    const norm=normVoor(a);
    const beschEff=100-(100-a.besch)*p.storingsFactor;
    const tekort=norm-beschEff;
    if(tekort>0.001){
      const impact=tekort*a.weging;
      T.push({sev:impact>=0.8?'r':'o',dom:'asset',resp:RESP.asset,titel:'Beschikbaarheid onder norm \u00b7 '+a.naam,
        msg:`Norm ${fmtF(norm)}% (${CAT_NORM[a.cmdb]}) \u00b7 actueel ${fmtF(beschEff,2)}% \u00b7 locatie ${a.locatie} (weging \u00d7${fmtF(a.weging)}) \u00b7 CMDB ${a.cmdb}.`,
        val:'impact '+fmtF(impact,2),aid:a.id});
    }
  });
  // 4. ASSETMANAGEMENT (ISO 55001) — bedienketens, uitgesteld onderhoud, SPOF (§ 6.5)
  (DB.ketens||[]).forEach(k=>{
    const r=ketenBesch(k,p);
    const los=lineOfSight(k);
    const losTekst=`Line of sight: raakt ${los.functieNamen.join('; ')||'—'} en daarmee ${los.doelen.map(d=>'“'+d+'”').join(', ')||'—'}.`;
    if(r.besch!==null&&r.besch<k.norm-0.001){
      const aanwezig=r.schakels.filter(s=>s.aanwezig);
      const zwak=[...aanwezig].sort((x,y)=>x.b-y.b).slice(0,2);
      T.push({sev:(k.norm-r.besch)>=1?'r':'o',dom:'asset',resp:RESP.asset,titel:'Bedienketen onder norm · '+k.naam,
        msg:`Ketenbeschikbaarheid ${fmtF(r.besch,2)}% (serieel product van ${aanwezig.length} geladen schakels${r.ontbrekend?', '+r.ontbrekend+' objecttype(n) nog niet in areaal':''}, incl. degradatie door uitgesteld onderhoud) tegen ketennorm ${fmtF(k.norm)}%. Zwakste schakels: ${zwak.map(s=>s.label+' ('+fmtF(s.b,2)+'%, FW'+s.fw+(s.n>1?', '+s.n+' assets':'')+')').join('; ')}. ${losTekst}`,
        val:fmtF(r.besch,2)+'% < '+fmtF(k.norm)+'%',kid:k.id});
    }else if(r.ontbrekend>0&&r.aanwezigN>0){
      T.push({sev:'o',dom:'asset',resp:RESP.asset,titel:'Bedienketen onvolledig in areaal · '+k.naam,
        msg:`${r.ontbrekend} van ${r.schakels.length} objecttypen uit de taakanalyse zijn nog niet als asset geladen: ${r.schakels.filter(s=>!s.aanwezig).map(s=>s.label).join('; ')}. De ketenbeschikbaarheid (${fmtF(r.besch,2)}%) is daardoor indicatief. ${losTekst}`,
        val:r.ontbrekend+' objecttype(n) ontbreekt',kid:k.id});
    }
  });
  DB.assets.forEach(a=>{
    const grens=amRegel('FW'+(+a.fw||3),12);
    if((+a.uitstelMnd||0)>grens){
      T.push({sev:(a.uitstelMnd-grens)>=6?'r':'o',dom:'asset',resp:RESP.asset,titel:'Uitgesteld onderhoud boven ISO 55001-grens · '+a.naam,
        msg:`Onderhoud ${a.uitstelMnd} maanden uitgesteld; de AM-regel voor functionele waarde FW${a.fw} staat maximaal ${grens} maanden toe. Degradatie-effect: +${fmtF((degrFactor(a)-1)*100,0)}% storingskans${(+a.conditie||1)>=amRegel('conditieDrempel',4)?' (versneld: conditiescore '+a.conditie+' ≥ NEN 2767-drempel '+amRegel('conditieDrempel',4)+')':''} — telt door in ketenberekening én Monte Carlo.`,
        val:a.uitstelMnd+' > '+grens+' mnd',aid:a.id});
    }
    if((+a.fw||0)>=amRegel('spofFw',4)&&!a.redundant&&(+a.conditie||1)>=amRegel('conditieDrempel',4)){
      T.push({sev:'r',dom:'asset',resp:RESP.asset,titel:'Single point of failure · '+a.naam,
        msg:`Kritieke schakel (FW${a.fw} ≥ spofFw ${amRegel('spofFw',4)}) is enkelvoudig uitgevoerd met conditiescore ${a.conditie} (NEN 2767, drempel ${amRegel('conditieDrempel',4)}). De AM-regel vereist redundantie (n+1) vanaf deze functionele waarde.`,
        val:'FW'+a.fw+' · conditie '+a.conditie+' · enkelvoudig',aid:a.id});
    }
  });
  // 5. PLANNING — signalen uit de planningstool, per meldingstype geduid naar brede impact
  planningTriggers().forEach(t=>{
    const im=berekenImpact(t,p);
    t.impact=im.chips;
    T.push(t);
    im.derived.forEach(d=>T.push(d));
  });
  T.sort((a,b)=>({r:0,o:1,g:2}[a.sev]-{r:0,o:1,g:2}[b.sev]));
  return T;
}

/* ═══════════════════════════════════════════════════════════
   MONTE CARLO — prognose op basis van config-parameters
   ═══════════════════════════════════════════════════════════ */
function randn(){let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function poisson(l){let L=Math.exp(-l),k=0,pp=1;do{k++;pp*=Math.random()}while(pp>L);return k-1}

function runMC(n,p){
  const totBen=DB.functies.reduce((s,f)=>s+f.benodigdFte,0);
  const totAct=DB.functies.reduce((s,f)=>s+f.actueelFte,0)*(1+p.ftePct/100);
  const totOnd=DB.functies.reduce((s,f)=>s+f.onderhoudEur,0);
  const budget=DB.financien.budgetJr*(1+p.budgetPct/100);
  const eis=+cfg('contract.beschikbaarheidseis',99.5),perUur=+cfg('contract.boete_per_uur',500);
  const boeteAan=cfg('contract.boete_actief',true)===true||cfg('contract.boete_actief','true')==='true';
  const PI=planningImpactTotals(p); // planningsimpact (rule engine-voorwaarden) telt door in de prognose
  const out={fteGaps:[],budGaps:[],boetes:[],pFte:0,pBud:0,pAsset:0,scores:[],planningImpact:PI};
  for(let i=0;i<n;i++){
    const verzuim=Math.max(0,p.verzuim+randn()*1.6);
    const fteGap=totBen*(1+verzuim/100)-totAct+PI.extraFteJr*(0.7+Math.random()*0.6);
    const kosten=totOnd*p.kostenIndex*(1+randn()*0.04)+PI.extraKostenJr*(0.7+Math.random()*0.6);
    let boete=0,assetHits=0,assetImpact=0;
    DB.assets.forEach(a=>{
      const norm=normVoor(a);
      const structureel=a.besch<norm;
      const st=poisson(a.storingenJr*p.storingsFactor*(PI.storingsOpslagAssets[a.id]||1)*degrFactor(a)); // storingen ~ Poisson, incl. werkzaamhedenopslag en degradatie door uitgesteld onderhoud (ISO 55001)
      const mttr=mttrVoor(a);                                    // hersteltijd uit assets.hw_mttr / sw_mttr
      const downPct=st*mttr*(0.6+Math.random()*0.8)/87.6;
      const eff=a.besch-downPct+randn()*0.05;
      if(eff<norm){if(!structureel)assetHits++;assetImpact+=(norm-eff)*a.weging}
      if(boeteAan&&eff<eis)boete+=(eis-eff)/100*8760*perUur;
    });
    const budGap=kosten+boete-budget;
    if(fteGap>0)out.pFte++;
    if(budGap>0)out.pBud++;
    if(assetHits>0)out.pAsset++;
    out.fteGaps.push(fteGap);out.budGaps.push(budGap);out.boetes.push(boete);
    out.scores.push(Math.max(0,fteGap)*2+Math.max(0,budGap)/25000+assetImpact);
  }
  out.pFte/=n;out.pBud/=n;out.pAsset/=n;
  out.fteGaps.sort((a,b)=>a-b);out.budGaps.sort((a,b)=>a-b);out.boetes.sort((a,b)=>a-b);out.scores.sort((a,b)=>a-b);
  out.q=(arr,q)=>arr[Math.min(arr.length-1,Math.floor(q*arr.length))];
  return out;
}
