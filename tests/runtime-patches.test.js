/* BiDash draait drie legacy-engines ongewijzigd in een iframe en hangt zijn
   verbeteringen er als runtime-patch omheen. Elke patch zet een eigen vlag in de
   scope waarin hij installeert. Installeert hij niet, dan valt de applicatie stil
   terug op het oude gedrag: geen foutmelding, geen zichtbaar verschil, wel andere
   uitkomsten.

   Deze test bewaakt dát elke patch installeert. Per patch wordt de vlag in een
   eigen scope gecontroleerd, en de lijst hieronder wordt tegen de broncode
   gespiegeld: een nieuwe patch zonder regel in dit bestand laat de suite falen, en
   een patch die bewust niet gekoppeld is moet dat ook bewust blijven. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const forecast=read('site/core/signal-forecast.js');
const CORE=new URL('../site/core/',import.meta.url);

/* Sommige patches gebruiken MutationObserver als kale global. Die staat in de
   realm van de module zelf, niet in de meegegeven scope, dus stubben we hem hier. */
const OBSERVER=globalThis.MutationObserver;
globalThis.MutationObserver=class{observe(){}disconnect(){}takeRecords(){return [];}};
test.after(()=>{if(OBSERVER)globalThis.MutationObserver=OBSERVER;else delete globalThis.MutationObserver;});

const fn=()=>function(){};
const tik=()=>new Promise(r=>setTimeout(r,30));
function element(){
  return {style:{},dataset:{},classList:{add(){},remove(){},contains:()=>false},innerHTML:'',textContent:'',
    appendChild(){},append(){},prepend(){},insertAdjacentElement(){},addEventListener(){},setAttribute(){},remove(){},
    closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
}
function documentStub(ids={}){
  return {readyState:'complete',getElementById:id=>ids[id]||null,querySelector:()=>null,querySelectorAll:()=>[],
    createElement:()=>element(),head:element(),body:element(),addEventListener(){}};
}
/* Een aparte realm per patch, zodat een eval-patch echt in die scope landt en de
   ene test de andere niet kan vervuilen. */
function scope(globals={},ids){
  const basis={console,setTimeout,clearTimeout,queueMicrotask,Promise,JSON,Math,Date,Object,Array,String,Number,Boolean,
    Set,Map,RegExp,Error,isFinite,isNaN,parseFloat,parseInt,structuredClone,
    MutationObserver:globalThis.MutationObserver,document:documentStub(ids),location:{origin:'http://localhost'},
    addEventListener(){},postMessage(){},...globals};
  const g=vm.runInContext('globalThis',vm.createContext(basis));
  g.window=g;if(!('parent' in globals))g.parent=g;
  return g;
}

const DVM_GLOBALS=()=>({normRij:fn(),classificeer:fn(),doorrekenen:fn(),probeerAnalyseActiveren:fn(),
  RULES:{},LIVE_STORINGSBRONNEN:[],STORINGSBRONNEN:[],ANALYSE_SIGNATURE:''});

/* De broncode van doorrekenen() die de combi-optimalisatie herkent; dezelfde vorm
   die tests/dvm-combi-performance.test.js gebruikt. */
const DOORREKENEN_BRON=[
  'function doorrekenen(rijenRaw,opties){','  const M=[];','  // stap 5: combiregels','  let combiHits=0;',
  '  RULES.combiRegels.filter(c=>c.actief).forEach(c=>{for(let i=0;i<M.length;i++)for(let j=0;j<M.length;j++){};});','',
  '  // rapportageperiode uit de van/tot data','  const periodeJr=1;','  return {M,combiHits,periodeJr};','}'
].join('\n');

const PATCHES=[
  {naam:'live-storingenpatch',bestand:'live-snapshot.js',exportNaam:'installDvmLiveSnapshotPatch',herhaalRetour:true,
   vlag:'__BIDASH_DVM_LIVE_PATCH_ACTIVE__',koppeling:'signal-forecast',
   scope:()=>scope({...DVM_GLOBALS(),storingsBronUitBestand:fn()})},

  {naam:'importvoortgangbrug',bestand:'import-progress-bridge.js',exportNaam:'installDvmImportProgressBridge',herhaalRetour:true,
   vlag:'__BIDASH_DVM_PROGRESS_BRIDGE__',koppeling:'signal-forecast',
   scope:()=>scope({zetImportVoortgang:fn(),parent:{postMessage(){}}})},

  {naam:'analysebeeld-performance',bestand:'dvm-analysis-rebuild-performance.js',exportNaam:'installDvmAnalysisRebuildPerformance',herhaalRetour:false,
   vlag:'__BIDASH_ANALYSIS_REBUILD_PERF__',koppeling:'signal-forecast',
   scope:()=>scope({koppelMeldingAanAsset:fn(),totaalImportJson:fn(),zetImportVoortgang:fn(),koppelDripHistorieAanAreaal:fn(),
     herberekenRegisterDekking:fn(),inspecteerStoringsRijen:fn(),herbouwAssetMatchBeeld:fn(),probeerAnalyseActiveren:fn(),
     gecombineerdeStoringsRijen:fn()})},

  {naam:'combiregel-performance',bestand:'dvm-combi-performance.js',exportNaam:'installDvmCombiPerformance',herhaalRetour:true,
   vlag:'__BIDASH_DVM_COMBI_PERF_ACTIVE__',koppeling:'signal-forecast',
   scope:()=>{const g=scope();g.eval(DOORREKENEN_BRON);return g;}},

  {naam:'verkeersscenario-defaults',bestand:'traffic-scenario-defaults.js',exportNaam:'installTrafficScenarioDefaults',herhaalRetour:true,
   vlag:'__BIDASH_TRAFFIC_SCENARIO_DEFAULTS_ACTIVE__',koppeling:'signal-forecast',
   scope:()=>scope({sc67Config:fn()})},

  {naam:'NDW-laadknop',bestand:'ndw-loader.js',exportNaam:'installNdwLoader',herhaalRetour:true,
   vlag:'__BIDASH_NDW_LOADER_ACTIVE__',koppeling:'signal-forecast',
   scope:()=>scope({ndw69Summary:fn(),kostenDagRows:fn()})},

  {naam:'open DRIP uit historie',bestand:'drip-open-from-history.js',exportNaam:'installDripOpenFromHistory',herhaalRetour:true,
   vlag:'__BIDASH_DRIP_OPEN_FROM_HISTORY_ACTIVE__',koppeling:'signal-forecast',
   scope:()=>scope({...DVM_GLOBALS(),herbouwDripHistorie:fn(),analyseSignatuur:fn()})},

  {naam:'storingsuitbreidingen laden',bestand:'fault-hub-extension-loader.js',exportNaam:'installFaultHubExtensionLoader',herhaalRetour:true,
   vlag:'__BIDASH_FAULT_HUB_EXTENSION_LOADER__',koppeling:'signal-forecast',
   scope:()=>scope()},

  {naam:'open storingen in de schil',bestand:'open-fault-parent-ui.js',exportNaam:'installOpenFaultParentUi',herhaalRetour:true,
   /* Deze patch werkt in het document van de schil, dus daar staat ook de vlag. */
   vlag:g=>g.parent.document.__bidashOpenFaultUiInstalled,koppeling:'signal-forecast',
   scope:()=>scope({parent:{document:documentStub(),addEventListener(){},setInterval(){},clearInterval(){}}})},

  {naam:'laadvoortgang in de schil',bestand:'load-progress.js',exportNaam:'installLoadProgress',herhaalRetour:false,
   vlag:'__BIDASH_LOAD_PROGRESS_ACTIVE__',koppeling:'module',
   scope:()=>scope({},{status:element()})},

  /* Deze patch wikkelt zich pas om het bestandsveld heen nádat de universele
     importer dat heeft gedaan, en probeert dat met een timer. De voorbereiding
     bootst die volgorde na: eerst de kale handler, dan de markering van de
     universele importer. */
  {naam:'snelle bekende JSON-import',bestand:'import-known-json-fastpath.js',exportNaam:'installKnownJsonFastPath',herhaalRetour:true,
   vlag:'__BIDASH_KNOWN_JSON_FASTPATH__',koppeling:'module',
   scope:()=>scope({},{files:{...element(),onchange:function(){}}}),
   async naInstallatie(g){
     const input=g.document.getElementById('files');
     await tik();input.dataset.bidashUniversalImporter='1';await tik();await tik();
   }},

  /* Bewust niet gekoppeld. signal-forecast.js legt uit waarom; zie ook de
     tussenstand in het auditrapport. De patch moet wel installeerbaar blijven,
     anders roest hij ongemerkt vast terwijl hij geparkeerd staat. */
  {naam:'storingsfilter / telregels',bestand:'live-filter.js',exportNaam:'installDvmLiveFilterPatch',herhaalRetour:true,
   vlag:'__BIDASH_DVM_LIVE_FILTER_ACTIVE__',koppeling:'niet gekoppeld',
   scope:()=>scope(DVM_GLOBALS())},

  {naam:'live-overzichtsfilter',bestand:'live-overview-filter.js',exportNaam:'installDvmLiveOverviewFilterPatch',herhaalRetour:true,
   vlag:'__BIDASH_LIVE_OVERVIEW_FILTER_ACTIVE__',koppeling:'niet gekoppeld',
   scope:()=>scope({...DVM_GLOBALS(),gecombineerdeLiveStoringsRijen:fn()})},

  {naam:'filter-dashboardsynchronisatie',bestand:'live-overview-filter-sync.js',exportNaam:'installLiveOverviewFilterSync',herhaalRetour:true,
   vlag:'__BIDASH_LIVE_FILTER_SYNC_ACTIVE__',koppeling:'niet gekoppeld',
   scope:()=>scope({DVM_LIVE_OVERVIEW_FILTER:{get:()=>({}),set(){},preview:()=>({})}})},

  /* Installeert op het bestandsveld van de schil in plaats van op een scope en
     heeft geen scope-argument. tests/universal-importer.test.js dekt het gedrag. */
  {naam:'universele importer',bestand:'universal-importer.js',exportNaam:'installUniversalImporter',
   vlag:null,koppeling:'module',scope:null}
];

const vlagWaarde=(p,g)=>typeof p.vlag==='function'?p.vlag(g):g[p.vlag];
const teTesten=PATCHES.filter(p=>p.scope);

for(const p of teTesten){
  test(`runtime-patch installeert en zet zijn vlag: ${p.naam}`,async()=>{
    const mod=await import(new URL(p.bestand,CORE));
    const install=mod[p.exportNaam];
    assert.equal(typeof install,'function',`${p.exportNaam} is geen export van ${p.bestand}`);
    const g=p.scope();
    assert.ok(!vlagWaarde(p,g),'vlag mag vooraf niet staan');
    assert.equal(install(g),true,`${p.exportNaam} installeerde niet`);
    if(p.naInstallatie)await p.naInstallatie(g);
    assert.ok(vlagWaarde(p,g),`${p.exportNaam} zette zijn vlag niet in de scope`);
    /* Een tweede installatie mag niet nog een laag om dezelfde functies leggen.
       De retourwaarde verschilt per patch: sommige melden `true` omdat er al iets
       staat, andere `false` omdat er niets meer te doen was. Die keuze wordt hier
       vastgelegd zoals de patch hem maakt, zodat een stille wijziging opvalt. */
    assert.equal(install(g),p.herhaalRetour,`${p.exportNaam} antwoordt anders op een herhaalde installatie`);
    assert.ok(vlagWaarde(p,g),`${p.exportNaam} verloor zijn vlag bij een herhaalde installatie`);
  });
}

test('een patch installeert niet in een scope zonder browsercontext',async()=>{
  /* Dit is het gedrag dat de Node-suite altijd zag. Het hoort een uitzondering te
     zijn, niet de enige gecontroleerde uitkomst. */
  const mod=await import(new URL('live-filter.js',CORE));
  assert.equal(mod.installDvmLiveFilterPatch(globalThis),false);
});

test('de koppeling in signal-forecast.js klopt met deze registratie',()=>{
  for(const p of PATCHES){
    const aanroep=new RegExp(`\\n${p.exportNaam}\\(globalThis\\);`);
    if(p.koppeling==='signal-forecast')assert.match(forecast,aanroep,`${p.exportNaam} hoort in signal-forecast.js te staan`);
    else assert.doesNotMatch(forecast,aanroep,`${p.exportNaam} staat onverwacht in signal-forecast.js`);
  }
});

test('een geparkeerde patch blijft als keuze vastgelegd, niet als vergeten regel',()=>{
  const geparkeerd=PATCHES.filter(p=>p.koppeling==='niet gekoppeld');
  assert.ok(geparkeerd.length,'registratie mist de geparkeerde patches');
  /* signal-forecast.js moet de reden van die tussenstand blijven benoemen. */
  assert.match(forecast,/tijdelijk niet actief/);
  assert.match(forecast,/filtermodules blijven in de repository/);
});

test('elke runtime-patch in site/core staat in deze registratie',()=>{
  const bekend=new Set(PATCHES.map(p=>p.exportNaam));
  const gevonden=[];
  for(const naam of readdirSync(CORE).filter(f=>f.endsWith('.js'))){
    const bron=readFileSync(new URL(naam,CORE),'utf8');
    for(const m of bron.matchAll(/export function (install[A-Za-z0-9]*)\(/g))gevonden.push([m[1],naam]);
  }
  assert.ok(gevonden.length>=PATCHES.length,'minder patches gevonden dan geregistreerd');
  for(const [exportNaam,bestand] of gevonden){
    assert.ok(bekend.has(exportNaam),`${exportNaam} in ${bestand} heeft geen regel in tests/runtime-patches.test.js`);
  }
});
