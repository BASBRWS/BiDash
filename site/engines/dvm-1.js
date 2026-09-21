
/* ══════════════════════════════════════════════════════════════
   TOEGANGSDREMPEL — eenvoudige login vóór de tool laadt.
   LET OP: dit is geen sterke beveiliging. De gegevens staan in de
   broncode en kunnen door een technische gebruiker worden ingezien.
   Bedoeld om meekijken tegen te houden en de tool professioneel te
   presenteren. Pas de inloggegevens hieronder aan.
   ══════════════════════════════════════════════════════════════ */
const LOGIN_ACCOUNTS=[];
function probeerLogin(){
  const g=document.getElementById('loginGebruiker').value.trim().toLowerCase();
  const w=document.getElementById('loginWachtwoord').value;
  const ok=LOGIN_ACCOUNTS.some(a=>a.gebruiker===g && a.wachtwoord===w);
  const fout=document.getElementById('loginFout');
  if(ok){
    document.getElementById('loginScherm').style.display='none';
    document.getElementById('appRoot').style.display='';
    try{ sessionStorage.setItem('dvm_ingelogd','1'); }catch(e){}
  } else {
    fout.textContent='Onjuiste gebruikersnaam of wachtwoord.';
    document.getElementById('loginWachtwoord').value='';
    document.getElementById('loginWachtwoord').focus();
  }
}
/* Blijf ingelogd binnen dezelfde browsersessie (tot tab sluit). */
(function(){
  try{ laadDripSelectie(); }catch(e){}
  try{
    if(true){
      var ls=document.getElementById('loginScherm'); if(ls) ls.style.display='none';
      var ar=document.getElementById('appRoot'); if(ar) ar.style.display='';
    } else {
      var gi=document.getElementById('loginGebruiker'); if(gi) gi.focus();
    }
  }catch(e){}
})();

/* ══════════════════════════════════════════════════════════════
   RULE ENGINE — overgenomen uit demo5.html (§ 4.7 storingsregels)
   ══════════════════════════════════════════════════════════════ */
const MSI_ERNST_FACTOR_DEFAULT=Object.freeze({1:1.00,2:0.75,3:0.50,4:0.25});
const MSI_ERNST_REGELS_DEFAULT=[
  {id:'MSI_ERNST_01',actief:true,assetType:'MSI',context:'rijbaanbreed',label:'Rijbaanbreed',ernst:1,fAvail:1,fPerf:1,prioriteit:10},
  {id:'MSI_ERNST_02',actief:true,assetType:'MSI',context:'weefvak',label:'Weefvak',ernst:1,fAvail:1,fPerf:1,prioriteit:20},
  {id:'MSI_ERNST_03',actief:true,assetType:'MSI',context:'opvolgend',label:'Opvolgend',ernst:1,fAvail:1,fPerf:1,prioriteit:30},
  {id:'MSI_ERNST_04',actief:true,assetType:'MSI',context:'laatste_portaal_voor_splitsing',label:'Laatste portaal voor splitsing',ernst:2,fAvail:.75,fPerf:.75,prioriteit:40},
  {id:'MSI_ERNST_05',actief:true,assetType:'MSI',context:'voor_afrit',label:'Voor afrit',ernst:3,fAvail:.50,fPerf:.50,prioriteit:50},
  {id:'MSI_ERNST_06',actief:true,assetType:'MSI',context:'voor_toerit',label:'Voor toerit',ernst:4,fAvail:.25,fPerf:.25,prioriteit:60}
];
const RULES = {
  assetTypen:[
    {id:'MSI',actief:true,functie:'signaalgever / matrixsignaalgever',wAvail:1,wPerf:1,levensduur:20,beta:3.0,mttr:6},
    {id:'CAM',actief:true,functie:'camera',wAvail:0.35,wPerf:0.6,levensduur:12,beta:2.5,mttr:8},
    {id:'LUS',actief:true,functie:'meetlus / detectielus',wAvail:0.2,wPerf:0.5,levensduur:15,beta:2.5,mttr:8},
    {id:'WISSELBORD',actief:true,functie:'wisselbord',wAvail:0.6,wPerf:0.9,levensduur:20,beta:3.0,mttr:6},
    {id:'DRIP',actief:true,functie:'dynamisch route-informatiepaneel (DRIP)',wAvail:0.5,wPerf:0.7,levensduur:15,beta:3.0,mttr:8,areaal:true}
  ],
  foutcodes:[
    {code:'1003',actief:true,patroon:'Fatale fout',assetType:'MSI',severity:'kritiek',availPct:100,perfPct:100,oms:'Volledige uitval van MSI'},
    {code:'1001',actief:true,patroon:'lampcircuit',assetType:'MSI',severity:'middel',availPct:15,perfPct:30,oms:'Niet altijd volledige uitval, wel prestatieverlies'},
    {code:'1002',actief:true,patroon:'aanstuurcirc',assetType:'MSI',severity:'middel',availPct:15,perfPct:30,oms:'Fout in aanstuurcircuit lamp — prestatieverlies'},
    {code:'1061',actief:true,patroon:'Beeld',assetType:'MSI',severity:'laag',availPct:5,perfPct:15,oms:'Beeld gedegradeerd'},
    {code:'1005',actief:true,patroon:'Communicatie met OS',assetType:'MSI',severity:'hoog',availPct:60,perfPct:70,oms:'Geen aansturing mogelijk (OS-communicatie uit)'},
    {code:'1004',actief:true,patroon:'zelfstandig',assetType:'MSI',severity:'hoog',availPct:70,perfPct:75,oms:'OS zelfstandig/idle — bediening verstoord'},
    {code:'2001',actief:true,patroon:'geen beeld',assetType:'CAM',severity:'hoog',availPct:80,perfPct:95,oms:'Geen camerabeeld beschikbaar'},
    {code:'2002',actief:true,patroon:'camera',assetType:'CAM',severity:'middel',availPct:45,perfPct:70,oms:'Camerastoring of gedegradeerd camerabeeld'},
    {code:'2003',actief:true,patroon:'cctv',assetType:'CAM',severity:'middel',availPct:45,perfPct:70,oms:'CCTV-storing of gedegradeerd camerabeeld'},
    {code:'1006',actief:true,patroon:'Beide lussen fout',assetType:'LUS',severity:'hoog',availPct:25,perfPct:60,oms:'Sterke impact op detectiekwaliteit'},
    {code:'1007',actief:true,patroon:'Een lus goed, een lus fout',assetType:'LUS',severity:'middel',availPct:10,perfPct:25,oms:'Gedeeltelijke detectie'},
    {code:'5004',actief:true,patroon:'uitgeschakeld voor OS',assetType:'LUS',severity:'hoog',availPct:15,perfPct:40,oms:'Bewust uitgeschakeld, wel impact'},
    {code:'6005',actief:true,patroon:'Wisselbord heeft verkeerde stand',assetType:'WISSELBORD',severity:'hoog',availPct:40,perfPct:80,oms:'Verkeerde stand raakt bediening/veiligheid'},
    {code:'4021',actief:true,patroon:'Noodvoeding uitgevallen',assetType:'MSI',severity:'hoog',availPct:20,perfPct:35,oms:'Onderliggende storing, combineerbaar'},
    /* DRIP/BermDRIP-alarmen. De impact volgt de betekenis van het alarm; de
       functionele toestand (GESTOPT/IN-BEDRIJF, LANGDURIG/INTERMITTEREND) is in
       foutregel() leidend en kan deze waarden verhogen of begrenzen. Deze
       percentages zijn een model, geen vastgesteld RWS-getal; ze zijn instelbaar. */
    {code:'DBD-DISPLAY',actief:true,patroon:'contact met display verloren',assetType:'DRIP',severity:'kritiek',availPct:100,perfPct:100,oms:'Controller heeft displaycontact verloren — paneel toont niets'},
    {code:'DBD-KRIT',actief:true,patroon:'kritische',assetType:'DRIP',severity:'hoog',availPct:80,perfPct:95,oms:'Kritieke storing (bijv. kritische LED-fout) — beeld onbetrouwbaar'},
    {code:'DBD-TEMP',actief:true,patroon:'temperatuur boven het maximum',assetType:'DRIP',severity:'middel',availPct:25,perfPct:40,oms:'Oververhitting — risico op uitschakeling'},
    {code:'DBD-LED',actief:true,patroon:'led status fout',assetType:'DRIP',severity:'laag',availPct:10,perfPct:30,oms:'LED-statusstoring — beeld licht gedegradeerd'},
    {code:'DBD-RESET',actief:true,patroon:'gereset',assetType:'DRIP',severity:'laag',availPct:5,perfPct:10,oms:'DRIP is gereset — doorgaans transiënt herstel'},
    {code:'DBD-DEUR',actief:true,patroon:'deuren staan',assetType:'DRIP',severity:'geen',availPct:0,perfPct:0,oms:'Kastdeur open — geen displaystoring, geen dienstimpact'}
  ],
  locatieRegels:[
    ...MSI_ERNST_REGELS_DEFAULT.map(r=>({...r})),
    {id:'LOC_004',actief:true,assetType:'CAM',context:'incidentzicht',fAvail:1.2,fPerf:1.4,prioriteit:60},
    {id:'LOC_005',actief:true,assetType:'LUS',context:'weefvak',fAvail:1.3,fPerf:1.5,prioriteit:90},
    {id:'LOC_006',actief:true,assetType:'LUS',context:'hoofdrijbaan_standaard',fAvail:1,fPerf:1,prioriteit:50}
  ],
  combiRegels:[
    {id:'COMBO_001',actief:true,oms:'MSI + lussen zelfde HM-band',type1:'MSI',code1:'1003',type2:'LUS',code2:'1006',maxKm:0.3,venMin:1440,extraAvail:15,extraPerf:25,capAvail:100,capPerf:100},
    {id:'COMBO_002',actief:true,oms:'Twee of meer MSI-fatale fouten in korte band',type1:'MSI',code1:'1003',type2:'MSI',code2:'1003',maxKm:0.8,venMin:1440,extraAvail:20,extraPerf:20,capAvail:100,capPerf:100},
    {id:'COMBO_003',actief:true,oms:'Camera + lussen zelfde wegvak',type1:'CAM',code1:'',type2:'LUS',code2:'1006',maxKm:0.5,venMin:1440,extraAvail:5,extraPerf:15,capAvail:100,capPerf:100},
    {id:'COMBO_004',actief:true,oms:'Noodvoeding samen met MSI-fout',type1:'MSI',code1:'4021',type2:'MSI',code2:'1003',maxKm:0.2,venMin:1440,extraAvail:10,extraPerf:15,capAvail:100,capPerf:100}
  ],
  cfg:{
    hw_mttr:6, kpi_msi:99.5, impactModel:'cap', chokeVenster:2,
    // Prognoseparameters. Deze waarden modelleren onzekerheid en worden niet
    // als gemeten assetdata gepresenteerd.
    mcPriorJaren:0.5, reliabilityLifeCv:0.18, reliabilityBetaCv:0.10,
    mttrCv:0.75, maxLeeftijdFactor:5
  },

  /* ── DRIP-specifieke classificatie. DRIP is een volwaardig assettype
     (zie assetTypen); hier alleen de functie-indeling die het ketengewicht
     bepaalt. Levensduur/β staan per assettype in assetTypen; expliciete
     levensduur/EOL komt rechtstreeks uit All Assets. ── */
  drip:{
    functies:[
      {code:'6', label:'sturen', gewicht:1.0, dienst:'vm'},
      {code:'5', label:'informeren', gewicht:0.6, dienst:'rri'},
      {code:'0', label:'vervalt / geen functie', gewicht:0.0, dienst:''}
    ],
    // instelbare levensduur (jaren, B50) per fabrikant×type-combinatie.
    // sleutel = "fabrikant|type" (kleine letters). Leeg = gebruik factsheet
    // of de standaard-terugval.
    levensduurOverride:{},
    // terugval-levensduur als er geen factsheet en geen override is
    standaardLevensduur:15
  },
  /* Individuele assetconfiguratie. Automatische koppelingen blijven
     herleidbaar; alleen aliases en expliciete uitzonderingen zijn handmatig. */
  assetConfig:{
    hmTolerantieKm:0.35,
    aliases:{},
    aliasLabels:{},
    uitgeslotenLogIds:{},
    uitgeslotenLabels:{},
    overrides:{}
  }
};

/* ── DIENSTEN (ketens) uit de rule engine + taakanalyse IV WVL ──
   Elke dienst is een keten van objecttypen (schakelTypes). De weging
   'sig' bepaalt hoe sterk de dienst leunt op signalering/MSI — afgeleid
   uit de beslisladders (IM & sturen leunen zwaar op verkeerssignalering
   en camerabeeld; reis-/route-info vooral op detectie+DRIP; WIU op
   signalering+camera voor het veilig plaatsen van maatregelen). */
const DIENSTEN = [
  { id:'im',  naam:'Incidentmanagement',            doel:'Vlot en veilig verkeer', norm:99.0, kleur:'#c0121f',
    schakels:['camera','detectie','signalering','communicatie','drip'],
    afh:{ signalering:0.42, camera:0.28, detectie:0.15, drip:0.08, communicatie:0.07 },
    tekst:'Incidentafhandeling met verkeerssignalering: kruisen plaatsen (alleen bij cameradekking), snelheidsbeperking, veilig­stellen. Beslisladder leunt zwaar op signalering en camerabeeld; DRIP ondersteunt de informatievoorziening naar weggebruikers.' },
  { id:'vm',  naam:'Verkeersmanagement (sturen &amp; geleiden)', doel:'Vlot en veilig verkeer', norm:99.0, kleur:'#003082',
    schakels:['detectie','signalering','dynamische_strook','drip'],
    afh:{ signalering:0.50, detectie:0.28, dynamische_strook:0.12, drip:0.10 },
    tekst:'Sturen en geleiden van verkeer: openen/sluiten stroken, snelheids­beelden, doseren. Direct afhankelijk van de matrixsignaal­gevers; DRIP draagt bij aan het sturen en geleiden (route-advies).' },
  { id:'rri', naam:'Reis- &amp; route-informatie',        doel:'Betrouwbare reistijd', norm:98.0, kleur:'#1a8a4a',
    schakels:['detectie','drip'],
    afh:{ detectie:0.55, drip:0.30, signalering:0.15 },
    tekst:'Beschikbaar stellen van reis- en route-informatie via DRIP\u2019s op basis van detectie. Signalering draagt beperkt bij (bevestiging maatregelbeeld).' },
  { id:'wiu', naam:'Werk in Uitvoering',              doel:'Veilig werken', norm:98.0, kleur:'#e06b00',
    schakels:['camera','signalering','drip'],
    afh:{ signalering:0.45, camera:0.35, drip:0.20 },
    tekst:'Ondersteunen bij werk in uitvoering: maatregelen plaatsen/monitoren, veiligstellen werkvak. Vereist signalering én camera­zicht op het werkvak.' }
];

/* objecttype → welke asset-fout-categorie het \u201cvoedt\u201d (voor propagatie) */
const OBJ_BRON = { signalering:'MSI', camera:'CAM', detectie:'LUS', drip:'DRIP', dynamische_strook:'MSI', communicatie:null };
const AREAAL_TYPE_KEY={MSI:'sig',CAM:'cam',LUS:'lus',DRIP:'drip',WISSELBORD:'wisselbord'};

/* ── DRIP-beschikbaarheid per wegvak ──
   Leidt uit het geladen DRIP-areaal (STATE.drips) een beschikbaarheids-/
   prestatiewaarde af voor de DRIP-schakel op een wegvak. DRIP telt zo op
   dezelfde manier mee in de dienstverlening als MSI/CAM/LUS. Zonder geladen
   DRIP-areaal is er geen bron → schakel 100%.

   Verliesbron = de faalkans van elke DRIP op basis van leeftijd t.o.v. EOL
   (zie dripFaalkans). Een oudere DRIP dichter bij of voorbij EOL draagt meer
   bij aan de onbeschikbaarheid. Functiegewicht bepaalt hoe zwaar de DRIP weegt.
   Beschikbaarheid = 100 − (gewogen faalkans / gewogen areaal)·100. */
function dripBeschikbaarheid(weg, richting){
  const D = (typeof STATE!=='undefined' && STATE && STATE.drips) ? STATE.drips : (DRIP_STATE||null);
  if(!D || !D.drips || !D.drips.length) return null;
  const dr = RULES.drip;
  const opWegvak = D.drips.filter(d=> d.weg===weg && (!richting || !d.richting || d.richting===richting));
  if(!opWegvak.length) return null;

  let areaal=0, bekendAreaal=0, onbekendAreaal=0, verliesB=0, verliesP=0, metLeeftijd=0;
  opWegvak.forEach(d=>{
    const fr = dr.functies.find(f=>f.code===d.functie);
    const gw = fr ? fr.gewicht : 0.5;
    if(gw<=0) return;
    areaal += gw;
    if(!d.bouwjaar){ onbekendAreaal+=gw; return; } // onbekend is geen gemeten nul
    metLeeftijd++;
    bekendAreaal+=gw;
    // Verwachte onbeschikbaarheid in de komende 12 maanden: jaarlijkse
    // storingsintensiteit maal MTTR. Dit voorkomt de oude horizon-0-uitkomst
    // die per definitie altijd 100% beschikbaarheid gaf.
    const rel=d._rel||(d._rel=assetReliability(d));
    const leeftijd=Math.max(0,new Date().getFullYear()-d.bouwjaar);
    const events=verwachteEventsInterval(rel,leeftijd,leeftijd+1);
    const at=assetTypeRec('DRIP')||{};
    const aov=assetOverrideVoor(d._assetKey||d.assetKey)||{};
    const down=Math.min(1,events*(+aov.mttr>0?+aov.mttr:(at.mttr||RULES.cfg.hw_mttr||6))/8760);
    verliesB += gw*down;
    verliesP += gw*down*0.85;
  });
  if(areaal<=0) return {besch:100, perf:100};
  // Voor het actuele overzicht krijgt ontbrekende leeftijd dezelfde gemiddelde
  // modelbelasting als het bekende cohort op dit wegvak. Zo wordt onbekend niet
  // als foutloos behandeld; de Monte Carlo trekt hiervoor een volledig cohortjaar.
  if(onbekendAreaal>0 && bekendAreaal>0){
    verliesB+=onbekendAreaal*(verliesB/bekendAreaal);
    verliesP+=onbekendAreaal*(verliesP/bekendAreaal);
  }
  const besch = Math.max(0, Math.min(100, 100 - verliesB/areaal*100));
  const perf  = Math.max(0, Math.min(100, 100 - verliesP/areaal*100));
  return { besch, perf, aantal:opWegvak.length, metLeeftijd, dekking:opWegvak.length?metLeeftijd/opWegvak.length:0 };
}

/* ══════════════════════════════════════════════════════════════
   BETROUWBAARHEIDSMODEL — marktconform (Weibull), volgens gangbare
   asset-management-praktijk (o.a. cohort-Weibull survival, renewal).
   • Weibull-CDF:            F(t) = 1 − exp(−(t/η)^β)
   • η uit mediane levensduur (B50):  η = L / (ln2)^(1/β)
   • Conditionele faalkans over [t0,t1] gegeven overleving tot t0:
       F(t1 | t0) = 1 − exp(−[(t1/η)^β − (t0/η)^β])
   • Verwachte cumulatieve storingen (cohort/renewal): som van
       jaarincrementen van de conditionele faalkans.
   • Geprogrammeerde vervanging = "as good as new": leeftijd → 0 op
     het vervangingsjaar (renewal-reward).
   Parameters: L (mediane levensduur, jaren) en β per assettype
   (RULES.assetTypen), met expliciete assetwaarden uit All Assets.
   ══════════════════════════════════════════════════════════════ */

/* Assettype-record voor een asset-id (MSI/CAM/LUS/DRIP…). */
function assetTypeRec(id){ return RULES.assetTypen.find(a=>a.id===id) || null; }

/* Sleutel voor een fabrikant×type-override. */
function dripComboKey(fabrikant, type){ return (String(fabrikant||'').trim().toLowerCase())+'|'+(String(type||'').trim().toLowerCase()); }

/* Bepaal β en mediane levensduur L voor een asset.
   Bron-volgorde voor L:
     1. individuele assetconfiguratie
     2. handmatige override per fabrikant×type (rule engine)
     3. expliciete levensduur/EOL uit All Assets
     4. assettype-levensduur en standaard-terugval  */
function assetReliability(asset){
  const at = assetTypeRec(asset.assetType||'DRIP') || {beta:3.0, levensduur:15};
  const individueel=assetOverrideVoor(asset._assetKey||asset.assetKey||asset.key);
  let beta = individueel&&+individueel.beta>0?+individueel.beta:(asset._betaOverride&&+asset._betaOverride>0?+asset._betaOverride:(at.beta||3.0));
  let L, bron;
  if(individueel&&+individueel.levensduur>0){L=+individueel.levensduur;bron='assetconfiguratie';}
  const ov = asset.assetType==='DRIP' ? RULES.drip.levensduurOverride[dripComboKey(asset.fabrikant, asset.type)] : null;
  if(L==null&&ov!=null && !isNaN(ov)){ L=ov; bron='handmatig (fabrikant×type)'; }
  const registerLife=asset._eolLife!=null?asset._eolLife:asset.eolLevensduur;
  const registerLifeBron=asset._eolLifeBron||asset.eolLevensduurBron;
  const registerEolJaar=asset._eolYear||(asset.eol&&asset.eol.jaar);
  if(L==null && registerLife!=null && !isNaN(registerLife) && +registerLife>0){
    L=+registerLife; bron=registerLifeBron||'All Assets (levensduur/EOL)';
  }
  if(L==null && registerEolJaar && asset.bouwjaar && registerEolJaar>asset.bouwjaar){
    L=registerEolJaar-asset.bouwjaar; bron='All Assets (EOL-jaar minus installatiedatum)';
  }
  if(L==null && at.levensduur!=null && +at.levensduur>0){ L=+at.levensduur; bron='assettype'; }
  if(L==null && asset.assetType==='DRIP' && RULES.drip.standaardLevensduur!=null && +RULES.drip.standaardLevensduur>0){ L=+RULES.drip.standaardLevensduur; bron='standaard-terugval'; }
  if(L==null){ L=RULES.drip.standaardLevensduur||15; bron='standaard'; }
  const eta = L / Math.pow(Math.log(2), 1/beta);
  return { beta, L, eta, bron, ref:null };
}

/* Weibull-CDF. */
function weibullF(t, eta, beta){ if(t<=0) return 0; return 1 - Math.exp(-Math.pow(t/eta, beta)); }

/* Conditionele faalkans over interval [t0,t1] (jaren leeftijd), gegeven
   dat de asset t0 heeft overleefd. Marktconform survival-conditionering. */
function faalkansInterval(rel, t0, t1){
  if(t1<=t0) return 0;
  const a=Math.pow(Math.max(0,t0)/rel.eta, rel.beta);
  const b=Math.pow(Math.max(0,t1)/rel.eta, rel.beta);
  return Math.max(0, Math.min(1, 1 - Math.exp(-(b-a))));
}

/* Verwacht aantal storingen in een minimal-repair/NHPP-interval. In
   tegenstelling tot een eenmalige Bernoulli-uitval kan dit ook >1 zijn. */
function verwachteEventsInterval(rel,t0,t1){
  if(t1<=t0) return 0;
  const a=Math.pow(Math.max(0,t0)/rel.eta,rel.beta);
  const b=Math.pow(Math.max(0,t1)/rel.eta,rel.beta);
  return Math.max(0,b-a);
}

/* Faalkans van een asset over een horizon (jaren vanaf nu), rekening
   houdend met huidige leeftijd en eventuele geprogrammeerde vervanging
   (as-good-as-new reset in vervangingsjaar). */
function assetFaalkans(asset, horizonJr, nu){
  nu = nu || new Date().getFullYear();
  if(!asset.bouwjaar) return 0;
  const rel = asset._rel || (asset._rel = assetReliability(asset));
  const leeftijdNu = nu - asset.bouwjaar;
  const eind = leeftijdNu + horizonJr;
  // geprogrammeerde vervanging?
  if(asset.vervangJaar && asset.vervangJaar>nu && asset.vervangJaar<=nu+horizonJr){
    const tV = asset.vervangJaar - asset.bouwjaar;       // leeftijd bij vervanging
    const voor = faalkansInterval(rel, leeftijdNu, tV);  // kans vóór vervanging
    const na   = weibullF(nu+horizonJr - asset.vervangJaar, rel.eta, rel.beta); // nieuw, vanaf 0
    // kans op minstens één uitval = 1 − (overleven vóór)·(overleven na)
    return Math.max(0, Math.min(1, 1 - (1-voor)*(1-na)));
  }
  return faalkansInterval(rel, leeftijdNu, eind);
}

/* Verwachte cumulatieve storingen per jaar over een periode (array).
   Cohort/renewal: per jaar het increment van de conditionele faalkans;
   bij geprogrammeerde vervanging reset de leeftijd naar 0. */
function cumulatieveStoringen(assets, jaarVan, jaarTot, nu){
  nu = nu || new Date().getFullYear();
  const jaren=[]; for(let j=jaarVan;j<=jaarTot;j++) jaren.push(j);
  const perJaar = jaren.map(()=>0);
  assets.forEach(asset=>{
    if(!asset.bouwjaar) return;
    const rel = asset._rel || (asset._rel = assetReliability(asset));
    jaren.forEach((j,idx)=>{
      let t0, t1;
      if(asset.vervangJaar && j>=asset.vervangJaar){ t0=j-asset.vervangJaar; t1=t0+1; }
      else { t0=j-asset.bouwjaar; t1=t0+1; }
      if(t0<0) return;
      perJaar[idx]+=faalkansInterval(rel, t0, t1);
    });
  });
  // cumulatief
  const cum=[]; let s=0; perJaar.forEach(v=>{ s+=v; cum.push(s); });
  return { jaren, perJaar, cum };
}

/* Verwachte resterende levensduur (RUL) in jaren, conditioneel op leeftijd.
   Benaderd numeriek: ∫ R(t0+u)/R(t0) du. Marktconform (conditionele MTTF−t0). */
function restlevensduur(rel, leeftijd){
  const R=t=>Math.exp(-Math.pow(Math.max(0,t)/rel.eta, rel.beta));
  const Rt0=R(leeftijd)||1e-9;
  let som=0; const stap=0.25, max=rel.eta*3;
  for(let u=0; u<max; u+=stap){ som += (R(leeftijd+u)/Rt0)*stap; }
  return som;
}

/* ── Compat: oude DRIP-helpers, nu bovenop het assettype-model ── */
function dripLevensduur(d){ return assetReliability({...d, assetType:'DRIP'}).L; }
function dripEolJaar(d){ if(!d.bouwjaar) return null; return d.bouwjaar + Math.round(dripLevensduur(d)); }
function dripFaalkans(d, horizonJr){ return assetFaalkans({...d, assetType:'DRIP', _rel:assetReliability({...d,assetType:'DRIP'})}, horizonJr||0); }
function levensduurBronTag(bron){
  const b=String(bron||'').toLowerCase();
  if(b.includes('assetregister'))return '<span class="tag g">assetregister</span>';
  if(b.includes('eol-factsheet')||b.includes('referentie'))return '<span class="tag g">levensduurref.</span>';
  if(b.includes('handmatig')||b.includes('assetconfiguratie'))return '<span class="tag g">handmatig</span>';
  return '<span class="tag gy">assettype</span>';
}

/* ── SUBPROCESSEN per dienst (afgeleid uit de beslisladders taakanalyse IV WVL) ──
   Elk subproces leunt op één of meer objecttypen. 'afh' geeft het relatieve
   gewicht van elk objecttype binnen het subproces; de subprocesbeschikbaarheid
   wordt op dezelfde ketenwijze berekend als de dienst zelf. Zo krijgt de
   gebruiker per subproces een concrete duiding van het storingsgevolg. */
const SUBPROCESSEN = {
  im:[
    {naam:'Incident detecteren & lokaliseren', afh:{detectie:0.5,camera:0.4,signalering:0.1},
     tekst:'Vaststellen incidentlocatie en aard via detectielussen (snelheids-/intensiteitsval) en camerabeeld. Zonder detectie/beeld wordt een incident later of niet opgemerkt.'},
    {naam:'Verkeersmaatregel plaatsen (signalering)', afh:{signalering:0.8,camera:0.2},
     tekst:'Kruisen en snelheidsbeperkingen plaatsen boven de incidentstrook — kern van IM met verkeerssignalering. Valt de MSI uit, dan kan de rijstrook niet veilig worden afgekruist.'},
    {naam:'Veiligstellen & cameraverificatie', afh:{camera:0.7,signalering:0.3},
     tekst:'Kruisen mogen alleen worden geplaatst bij cameradekking (beslisladder). Geen beeld = geen geverifieerde maatregel, langere onveilige situatie.'},
    {naam:'Weggebruikers informeren (DRIP)', afh:{drip:0.6,detectie:0.4},
     tekst:'Informeren via DRIP\u2019s over incident/vertraging. Minder afhankelijk van MSI; blijft grotendeels overeind bij signaleringsuitval.'},
    {naam:'Opschalen / afschalen & logging', afh:{communicatie:0.6,camera:0.4},
     tekst:'Coördineren met VCNL/meldkamer, op-/afschalen en logging. Leunt op communicatiesystemen en beeld, nauwelijks op signalering.'}
  ],
  vm:[
    {naam:'Verkeersbeeld opbouwen', afh:{detectie:0.7,camera:0.3},
     tekst:'Gedeeld verkeersbeeld uit detectielussen en camera. De basis onder alle stuurbeslissingen; zwakke detectie maakt sturen \u201cblind\u201d.'},
    {naam:'Stroken openen/sluiten (signalering)', afh:{signalering:0.9,detectie:0.1},
     tekst:'Openen, sluiten en bewaken van plus-/spits-/dynamische stroken via MSI. Direct en zwaar afhankelijk van de matrixsignaalgevers.'},
    {naam:'Snelheidsbeelden & filestaartbeveiliging', afh:{signalering:0.7,detectie:0.3},
     tekst:'Automatische snelheidsafbouw en filestaartdetectie. Vereist zowel detectie (staart herkennen) als werkende signalering (beeld tonen).'},
    {naam:'Doseren & geleiden', afh:{signalering:0.6,detectie:0.4},
     tekst:'Toeritdoseren en verkeer geleiden op basis van meetdata en signalering. Deels te compenseren, maar minder effectief bij uitval.'}
  ],
  rri:[
    {naam:'Reistijd meten', afh:{detectie:0.9,camera:0.1},
     tekst:'Reistijden en intensiteiten bepalen uit detectielussen/meetvakken. De harde basis voor route-informatie; zonder detectie geen betrouwbaar cijfer.'},
    {naam:'Route-informatie tonen (DRIP)', afh:{drip:0.7,detectie:0.3},
     tekst:'Reis- en route-informatie tonen via DRIP\u2019s. Onafhankelijk van MSI; blijft overeind bij signaleringsuitval, maar niet zonder detectie-invoer.'},
    {naam:'Maatregelbeeld bevestigen', afh:{signalering:0.5,camera:0.5},
     tekst:'Bevestigen dat het getoonde beeld klopt met de werkelijke maatregel. Beperkte, aanvullende afhankelijkheid van signalering en camera.'}
  ],
  wiu:[
    {naam:'Werkvak & maatregelen plaatsen', afh:{signalering:0.7,camera:0.3},
     tekst:'Verkeersmaatregelen rond het werkvak plaatsen via signalering. Zonder MSI kan het werkvak niet veilig worden afgeschermd.'},
    {naam:'Werkvak monitoren (camera)', afh:{camera:0.8,signalering:0.2},
     tekst:'Visueel bewaken van veilig werken op het werkvak. Geen camerabeeld = geen zicht op de veiligheid van de wegwerkers.'},
    {naam:'Weggebruikers informeren (DRIP)', afh:{drip:0.7,detectie:0.3},
     tekst:'Informeren over wegwerkzaamheden en hinder via DRIP\u2019s. Grotendeels onafhankelijk van signalering.'},
    {naam:'Maatregelen verifiëren & normaliseren', afh:{signalering:0.5,camera:0.5},
     tekst:'Controleren, verifiëren en na afloop weghalen van maatregelen. Vereist zowel beeld als signalering voor een sluitende afronding.'}
  ]
};
const SUBPROCESSEN_DEFAULT=JSON.parse(JSON.stringify(SUBPROCESSEN));

/* De aandelen van de subprocessen vormen per dienstverlening altijd samen 100%.
   Oude configuraties gebruikten relatieve gewichten. Deze functie zet ook die
   waarden om naar een zichtbare, gesloten verdeling. */
function normaliseerSubprocesAandelen(dienstId){
  const subs=SUBPROCESSEN[dienstId]||[];
  if(!subs.length)return;
  const waarden=subs.map(sp=>Math.max(0,Number(sp.gewicht==null?1:sp.gewicht)||0));
  const som=waarden.reduce((a,b)=>a+b,0);
  subs.forEach((sp,i)=>sp.gewicht=som?waarden[i]/som:1/subs.length);
}
function normaliseerAlleSubprocesAandelen(){
  DIENSTEN.forEach(d=>normaliseerSubprocesAandelen(d.id));
}
/* De aandelen moeten gesloten zijn vóórdat er iets wordt doorgerekend, niet pas
   wanneer het regelscherm is geopend. v68Dienst weegt namelijk met deze aandelen;
   zonder normalisatie is elk gewicht leeg en levert de dienstverlening een
   betekenisloze band 0,00–0,00% op het overzicht en in de hub-samenvatting. */
normaliseerAlleSubprocesAandelen();

/* De gewijzigde invoer blijft staan. Het resterende percentage wordt naar
   verhouding over de andere subprocessen verdeeld. */
function verdeelSubprocesAandeel(gewijzigd){
  const di=+gewijzigd.dataset.di,si=+gewijzigd.dataset.si;
  const dienst=DIENSTEN[di],subs=dienst?(SUBPROCESSEN[dienst.id]||[]):[];
  if(!subs.length||!subs[si])return;
  const invoeren=[...document.querySelectorAll(`#tab-regels [data-p="subprocesGewicht"][data-di="${di}"]`)];
  const gekozen=Math.max(0,Math.min(100,parseFloat(gewijzigd.value)||0));
  const overig=invoeren.filter(el=>+el.dataset.si!==si),rest=Math.max(0,100-gekozen);
  const oudeSom=overig.reduce((s,el)=>s+Math.max(0,parseFloat(el.value)||0),0);
  let gebruikt=0;
  gewijzigd.value=Number(gekozen.toFixed(2));
  subs[si].gewicht=gekozen/100;
  overig.forEach((el,index)=>{
    let waarde;
    if(index===overig.length-1)waarde=rest-gebruikt;
    else {
      waarde=oudeSom?rest*(Math.max(0,parseFloat(el.value)||0)/oudeSom):rest/overig.length;
      waarde=Math.round(waarde*100)/100;gebruikt+=waarde;
    }
    waarde=Math.max(0,waarde);
    el.value=Number(waarde.toFixed(2));
    subs[+el.dataset.si].gewicht=waarde/100;
  });
  const totaal=document.querySelector(`#tab-regels [data-aandeel-totaal="${di}"]`);
  if(totaal)totaal.textContent='Totaal 100%';
}

function dienstWaardeUitSubprocessen(dienst,bron){
  const subs=SUBPROCESSEN[dienst.id]||[];
  if(!subs.length)return subprocesWaarde(dienst.afh||{},bron);
  let besch=0,prestatie=0,gewicht=0;
  const detail=subs.map(sp=>{
    const v=subprocesWaarde(sp.afh||{},bron),w=Number(sp.gewicht==null?1:sp.gewicht)||0;
    besch+=v.besch*w;prestatie+=v.prestatie*w;gewicht+=w;
    return {naam:sp.naam,gewicht:w,besch:v.besch,prestatie:v.prestatie,afh:sp.afh};
  });
  return {besch:gewicht?besch/gewicht:100,prestatie:gewicht?prestatie/gewicht:100,detail,gewicht};
}

function dienstAssetAfhankelijkheid(dienst){
  const uit={},subs=SUBPROCESSEN[dienst.id]||[];
  subs.forEach(sp=>{
    const sw=Number(sp.gewicht==null?1:sp.gewicht)||0;
    const som=Object.values(sp.afh||{}).reduce((s,w)=>s+(Number(w)||0),0);
    if(!som)return;
    Object.entries(sp.afh).forEach(([k,w])=>uit[k]=(uit[k]||0)+sw*(Number(w)||0)/som);
  });
  const totaal=Object.values(uit).reduce((s,w)=>s+w,0);
  if(totaal)Object.keys(uit).forEach(k=>uit[k]/=totaal);
  return totaal?uit:{...(dienst.afh||{})};
}
function subprocessenConfig(){
  return Object.fromEntries(Object.entries(SUBPROCESSEN).map(([id,subs])=>[id,subs.map(sp=>({naam:sp.naam,gewicht:sp.gewicht==null?1:sp.gewicht,afh:{...(sp.afh||{})}}))]));
}
function laadSubprocessenConfig(cfg){
  if(!cfg)return;
  Object.entries(cfg).forEach(([id,regels])=>{
    const doel=SUBPROCESSEN[id]||[];
    (regels||[]).forEach((bron,i)=>{
      const sp=doel.find(x=>x.naam===bron.naam)||doel[i];if(!sp)return;
      if(bron.afh)sp.afh={...sp.afh,...bron.afh};
      if(bron.gewicht!=null)sp.gewicht=Number(bron.gewicht)||0;
    });
    normaliseerSubprocesAandelen(id);
  });
}

/* ── AREAALTOTALEN uit de RWS asset-registers (qry_all_assets per VC, peildatum 2024-06-17) ──
   Werkelijk aantal signaalgevers (sig), camera's (cam), detectielussen (lus) en DRIP's (drip)
   per wegdeel (weg + richting), per verkeerscentrale. Vervangt de eerdere schatting. */
const AREAAL={};
/* De storingslijst gebruikt regio-afkortingen; deze mappen op de VC-bestandsnamen. */
const VC_MAP = { NWN:'NWN', WNN:'NWN', WNZ:'ZWN', ZN:'ZN', UT:'MN', ZH:'ZWN', ON:'NON', MN:'MN', ZWN:'ZWN', NON:'NON' };
const ONBEKEND_RD='RD onbekend';
const ONBEKEND_DISTRICT='District onbekend';
const RD_KEYS=['rd','regiodienst','regio dienst','regionale dienst','regionale dienst naam','rws regio','beheerregio','beheer regio','organisatie regio','organisatieonderdeel regio'];
const DISTRICT_KEYS=['district','districtnaam','district naam','rws district','beheergebied','beheergebiednaam','beheergebied naam','beheer district','beheer-district','districtcode','district code','onderhoudsdistrict','onderhoud district','netwerkdistrict','netwerk district','areaal district','asset district','regiodistrict','regio district'];
const VC_KEYS=['vc','verkeerscentrale','verkeerscentralegebied','verkeerscentrale gebied','bediencentrale','centrale','regio'];
const RD_NAMEN=['Noord-Nederland','West-Nederland Noord','West-Nederland Zuid','Midden-Nederland','Oost-Nederland','Zuid-Nederland','Zee en Delta','Centrale Informatievoorziening','Grote Projecten en Onderhoud'];
const VC_RD_FALLBACK={NWN:'West-Nederland Noord',ZWN:'West-Nederland Zuid',MN:'Midden-Nederland',NON:'Oost-Nederland',ON:'Oost-Nederland',ZN:'Zuid-Nederland'};
function netteWaarde(v){return String(v==null?'':v).trim();}
function normRd(v){
  const s=netteWaarde(v); if(!s)return '';
  const u=s.toUpperCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ').trim();
  const map={
    WNN:'West-Nederland Noord',WNZ:'West-Nederland Zuid',NWN:'West-Nederland Noord',ZWN:'West-Nederland Zuid',
    MN:'Midden-Nederland',ON:'Oost-Nederland',NON:'Oost-Nederland',ZN:'Zuid-Nederland',NN:'Noord-Nederland',ZD:'Zee en Delta',
    CIV:'Centrale Informatievoorziening',GPO:'Grote Projecten en Onderhoud',
    'WEST NEDERLAND NOORD':'West-Nederland Noord','WEST-NEDERLAND NOORD':'West-Nederland Noord',
    'WEST NEDERLAND ZUID':'West-Nederland Zuid','WEST-NEDERLAND ZUID':'West-Nederland Zuid',
    'MIDDEN NEDERLAND':'Midden-Nederland','MIDDEN-NEDERLAND':'Midden-Nederland',
    'OOST NEDERLAND':'Oost-Nederland','OOST-NEDERLAND':'Oost-Nederland',
    'ZUID NEDERLAND':'Zuid-Nederland','ZUID-NEDERLAND':'Zuid-Nederland',
    'NOORD NEDERLAND':'Noord-Nederland','NOORD-NEDERLAND':'Noord-Nederland',
    'ZEE EN DELTA':'Zee en Delta','ZEE-EN-DELTA':'Zee en Delta',
    'CENTRALE INFORMATIEVOORZIENING':'Centrale Informatievoorziening',
    'GROTE PROJECTEN EN ONDERHOUD':'Grote Projecten en Onderhoud'
  };
  if(map[u])return map[u];
  const compact=u.replace(/RIJKSWATERSTAAT|REGIONALE DIENST|DIRECTIE|RWS|\bREGIO\b/g,'').replace(/[-]+/g,' ').replace(/\s+/g,' ').trim();
  if(map[compact])return map[compact];
  if(/WEST\s*NEDERLAND\s*NOORD|\bWNN\b|\bNWN\b/.test(compact))return 'West-Nederland Noord';
  if(/WEST\s*NEDERLAND\s*ZUID|\bWNZ\b|\bZWN\b/.test(compact))return 'West-Nederland Zuid';
  if(/MIDDEN\s*NEDERLAND|\bMN\b/.test(compact))return 'Midden-Nederland';
  if(/OOST\s*NEDERLAND|\bON\b|\bNON\b/.test(compact))return 'Oost-Nederland';
  if(/ZUID\s*NEDERLAND|\bZN\b/.test(compact))return 'Zuid-Nederland';
  if(/NOORD\s*NEDERLAND|\bNN\b/.test(compact))return 'Noord-Nederland';
  if(/ZEE\s*EN\s*DELTA|\bZD\b/.test(compact))return 'Zee en Delta';
  if(/CENTRALE\s*INFORMATIEVOORZIENING|\bCIV\b/.test(compact))return 'Centrale Informatievoorziening';
  if(/GROTE\s*PROJECTEN\s*EN\s*ONDERHOUD|\bGPO\b/.test(compact))return 'Grote Projecten en Onderhoud';
  return s;
}
function rdBekend(v){return RD_NAMEN.includes(normRd(v));}
function rdUitVc(vc){return VC_RD_FALLBACK[normAssetVc(vc)]||'';}
function rapportRdWaarde(bron){
  const rd=normRd(bron&&bron.rd);
  if(rdBekend(rd))return rd;
  return rdUitVc(bron&&bron.vc)||ONBEKEND_RD;
}
function normDistrict(v){
  const s=netteWaarde(v).replace(/^district\s+/i,'').trim();
  if(!s||/^(onbekend|unknown|nvt|n\/a|geen|-|\?)$/i.test(s))return '';
  return s;
}
function districtBekend(v){return !!normDistrict(v)&&normDistrict(v)!==ONBEKEND_DISTRICT;}
function eersteWaarde(row,g,keys){return netteWaarde(g(row,keys));}
function bestuurlijkeContextUitRow(row,g){
  const rd=normRd(eersteWaarde(row,g,RD_KEYS));
  const district=normDistrict(eersteWaarde(row,g,DISTRICT_KEYS));
  const vc=normAssetVc(eersteWaarde(row,g,VC_KEYS));
  return {rd,district,vc,districtBron:district?'bron':'ontbreekt'};
}
function contractContextUitRow(row,g){
  return {
    aannemer:eersteWaarde(row,g,['aannemer','onderhoudsaannemer','contractaannemer','opdrachtnemer','main contractor']),
    contract:eersteWaarde(row,g,['contract','contractnaam','contractnummer','zaaknummer','areaalcontract','prestatiecontract']),
    leverancier:eersteWaarde(row,g,['leverancier','fabrikant','vendor','supplier','manufacturer'])
  };
}
function voegSet(set,v){v=netteWaarde(v);if(v)set.add(v);}
function setLabel(set,max){
  const a=[...(set||new Set())].filter(Boolean).sort((x,y)=>x.localeCompare(y,'nl'));
  if(!a.length)return '';
  const lim=max||3;
  return a.slice(0,lim).join(', ')+(a.length>lim?` +${a.length-lim}`:'');
}

/* ── HISTORISCHE STORINGSDATA uit de dagelijkse logs 2024-01-01 .. 2026-08-17 ──
   Per wegdeel de werkelijke storingsfrequentie (events/jaar) en een
   gecomprimeerde duurverdeling (21 percentiel-ankers in dagen), gebruikt door
   de Monte Carlo voor realistische rates en hersteltijden i.p.v. schatting
   uit één momentopname. Bron: 4.800 dagelijkse 'openstaande storingen'-logs. */
const MC_HISTORIE={"periodeJr": 0, "wegdelen": {}};
function mcHistVoor(vcRaw, weg, richting, doelN){
  // Zodra de laadstraat voldoende historie heeft vastgesteld, is uitsluitend
  // die geladen historie de empirische bron. Zo kan een oude ingebedde
  // referentieset niet ongemerkt de nieuwe bron overschrijven.
  const HIST=MC_HISTORIE_LIVE||MC_HISTORIE;
  const fvc=VC_MAP[String(vcRaw||'').toUpperCase()]||vcRaw;
  const key=fvc+'|'+weg+(richting?(' '+richting):'');
  if(HIST.wegdelen[key]){
    const v=HIST.wegdelen[key];
    return {...v,fallback:false,tailCensored:v.durP[v.durP.length-1]>=HIST.periodeJr*365.25*0.9};
  }
  // Logextracten coderen verbindingsbogen vaak compact (A15M) terwijl de
  // storingslijst weg=A15, richting=M levert.
  const compactKey=fvc+'|'+weg+(richting||'');
  if(richting && !/^(LI|RE)$/.test(richting) && HIST.wegdelen[compactKey]){
    const v=HIST.wegdelen[compactKey];
    return {...v,fallback:false,compactMatch:true,tailCensored:v.durP[v.durP.length-1]>=HIST.periodeJr*365.25*0.9};
  }
  // Een niet-gematchte boog krijgt niet kunstmatig een deel van de hoofdrijbaan.
  // Daarvoor zijn de geladen historieregels plus hiërarchische prior de veiligere fallback.
  if(richting && !/^(LI|RE)$/.test(richting)) return null;
  // Geen exacte logreeks: combineer de wegverdeling, maar ken nooit het hele
  // wegtotaal aan één ontbrekende richting toe. Verdeel naar geregistreerd
  // areaal en anders gelijkmatig over de beschikbare logreeksen.
  let ev=0, kandidaten=[];
  Object.entries(HIST.wegdelen).forEach(([k,v])=>{
    const p=k.split('|');
    if(p[1] && p[1].split(' ')[0]===weg && p[0]===fvc){ ev+=v.events; kandidaten.push(v); }
  });
  if(!kandidaten.length) return null;
  // duurpercentielen wegen naar het aantal waargenomen events
  const durP=kandidaten[0].durP.map((_,i)=>Math.round(kandidaten.reduce((s,p)=>s+p.durP[i]*p.events,0)/Math.max(ev,1)));
  let aandeel=1/kandidaten.length, allocBron='gelijk verdeeld';
  const live=(window.DVM_ASSET_REGISTER&&window.DVM_ASSET_REGISTER.areaal)||null;
  const reg=live?(live[fvc]||null):(AREAAL[fvc]||null);
  if(reg && richting){
    const exact=reg[weg+' '+richting];
    const richtingTotaal=Object.entries(reg).reduce((s,[k,v])=>{
      return s+(k.split(' ')[0]===weg && / (LI|RE)$/.test(k) ? (v.sig||0) : 0);
    },0);
    const n=(exact&&exact.sig>0?exact.sig:(doelN>0?doelN:0));
    if(n>0 && richtingTotaal>0){ aandeel=Math.min(1,n/richtingTotaal); allocBron='areaalverdeling'; }
  }
  const events=ev*aandeel;
  return { events, eventsWegtotaal:ev, rate:events/HIST.periodeJr, durP,
    fallback:true, allocatieAandeel:aandeel, allocatieBron:allocBron,
    tailCensored:durP[durP.length-1]>=HIST.periodeJr*365.25*0.9 };
}
/* Trek een duur (uren) uit de percentiel-ankers via lineaire interpolatie. */
function bootDuurUren(durP,tailCensored){
  const u=Math.random()*(durP.length-1);
  const i=Math.floor(u), fr=u-i;
  let dagen = durP[i] + (durP[Math.min(i+1,durP.length-1)]-durP[i])*fr;
  dagen = Math.min(dagen, 180);
  // Een maximum dicht bij de observatieperiode is rechtsgecensureerd. Alleen
  // in de uiterste staart voegen we daarom expliciete (zichtbare) modelmarge toe.
  if(tailCensored && u>0.9*(durP.length-1)) dagen*=Math.exp(Math.abs(gaussSample())*0.35);
  return Math.max(1/6,Math.min(dagen,180))*24;
}

/* Zoek de areaalgegevens voor een wegdeel op. Valt terug op de gecombineerde
   L+R-telling van dezelfde weg als de richting een op-/afrit-code is (G/M/X/S). */
function areaalVoor(vcRaw, weg, richting){
  const fvc = VC_MAP[String(vcRaw||'').toUpperCase()] || null;
  if(!fvc) return null;
  // Een door de gebruiker geladen register is leidend. Alleen vóór de nieuwe
  // laadstraat blijft het ingebedde peilregister als technische terugval
  // beschikbaar; de gegevenspoort laat analyses zonder geladen register niet toe.
  const live=(window.DVM_ASSET_REGISTER&&window.DVM_ASSET_REGISTER.areaal)||null;
  const reg=live?live[fvc]:AREAAL[fvc];
  if(!reg) return null;
  const key = weg + (richting?(' '+richting):'');
  if(reg[key]) return {...reg[key], bron:live&&live[fvc]?'geladen-register':'direct', vc:fvc, key};
  // richting onbekend of ramp → sommeer alle richtingen van deze weg
  let s={sig:0,cam:0,lus:0,drip:0}, gevonden=false;
  Object.entries(reg).forEach(([k,v])=>{
    if(k.split(' ')[0]===weg){ s.sig+=v.sig;s.cam+=v.cam;s.lus+=v.lus;s.drip+=v.drip; gevonden=true; }
  });
  return gevonden ? {...s, bron:live&&live[fvc]?'geladen-register-weg':'weg-totaal', vc:fvc, key:weg} : null;
}
function areaalAantalVoorType(ar,typeId,geschat){
  const key=AREAAL_TYPE_KEY[typeId]||'sig';
  const n=ar&&Number(ar[key]);
  if(isFinite(n)&&n>0)return n;
  return Math.max(geschat||1,1);
}
function wegdeelBasisKey(m){
  return (m&&m.weg?m.weg:'')+(m&&m.richting?(' '+m.richting):'');
}
function wegdeelBestuurKey(m){
  const basis=wegdeelBasisKey(m);
  const vc=normAssetVc(m&&m.vc)||'geen VC';
  /* Binnen het live dashboard is VC + weg + richting de unieke sleutel.
     RD en district zijn kenmerken en mogen hetzelfde wegdeel niet opsplitsen. */
  return `${basis}|vc:${vc}`;
}
function wegdeelBestuurLabel(agg){
  const basis=wegdeelBasisKey(agg);
  const vc=normAssetVc(agg&&agg.vc);
  const rd=normRd(agg&&agg.rd);
  if(vc)return `${basis} · VC ${vc}`;
  if(rd&&rd!==ONBEKEND_RD)return `${basis} · ${rd}`;
  return basis;
}

function msiErnstWaarde(regel){
  const v=Number(regel&&regel.ernst);return isFinite(v)?Math.max(1,Math.min(4,Math.round(v))):1;
}
function msiErnstFactorStandaard(regel){return MSI_ERNST_FACTOR_DEFAULT[msiErnstWaarde(regel)]||1;}
function locatieRegelFactor(regel,soort){
  if(regel&&regel.assetType==='MSI'){
    const v=Number(regel[soort==='prest'?'fPerf':'fAvail']);return isFinite(v)&&v>=0?v:msiErnstFactorStandaard(regel);
  }
  const v=Number(regel&&regel[soort==='prest'?'fPerf':'fAvail']);return isFinite(v)&&v>=0?v:1;
}
function normaliseerMsiErnstRegels(regels,behoudFactoren){
  const bron=Array.isArray(regels)?regels:[],alias={tussen_portalen_zonder_ramp:'opvolgend'};
  const perContext=new Map();
  bron.filter(r=>r&&r.assetType==='MSI').forEach(r=>perContext.set(alias[r.context]||r.context,r));
  const msi=MSI_ERNST_REGELS_DEFAULT.map(d=>{
    const oud=perContext.get(d.context),ernst=oud&&oud.ernst!=null?msiErnstWaarde(oud):d.ernst;
    const standaard=MSI_ERNST_FACTOR_DEFAULT[ernst]||1;
    const fAvail=behoudFactoren&&oud&&isFinite(Number(oud.fAvail))?Math.max(0,Number(oud.fAvail)):standaard;
    const fPerf=behoudFactoren&&oud&&isFinite(Number(oud.fPerf))?Math.max(0,Number(oud.fPerf)):standaard;
    return {...d,actief:oud&&oud.actief===false?false:true,ernst,fAvail,fPerf};
  });
  return [...msi,...bron.filter(r=>r&&r.assetType!=='MSI')];
}

/* Diepe kopie van de fabrieksinstellingen, zodat "herstel standaard" altijd werkt. */
const RULES_DEFAULT = JSON.parse(JSON.stringify(RULES));
const DIENSTEN_AFH_DEFAULT = JSON.parse(JSON.stringify(DIENSTEN.map(d=>({id:d.id,afh:d.afh,norm:d.norm}))));

