/* DVM-adapter startguard voor grote integrale imports.
   De oorspronkelijke adapter blijft ongewijzigd in dvm-adapter-original.js.
   Deze wrapper zorgt dat de performancepatches echt actief zijn voordat HUB.import start,
   voorkomt een volledige structuredClone van het DVM-deel van de werkruimte en laat
   grote opgeslagen DVM-werkruimtes niet opnieuw via de totaalimport lopen tijdens opstart. */
(() => {
  const wacht = ms => new Promise(resolve => setTimeout(resolve, ms));
  const restorePolicy = import('../core/dvm-restore-policy.js');
  const optimalisatiesGereed = () =>
    window.__BIDASH_DVM_COMBI_PERF_ACTIVE__ === true &&
    window.__BIDASH_ANALYSIS_REBUILD_PERF__ === true;

  function ouderStartNog(){
    try{
      if(parent===window)return false;
      const tekst=String(parent.document?.getElementById('status')?.textContent||'');
      return /Werkruimte starten/i.test(tekst);
    }catch(error){return false;}
  }
  function bronbeheerActief(){
    try{return parent!==window&&String(parent.location.hash||'')==='#sources';}
    catch(error){return false;}
  }
  function legeSamenvatting(){
    return {peildatum:null,assets:[],roads:[],diensten:[],liveBronnen:0,forecast:null,triggers:[],restoreDeferred:true};
  }
  function herstelVerkeerscontext(bundle){
    try{
      const kosten=bundle?.parameters?.kosten;
      if(!kosten||typeof kosten!=='object'||typeof RULES==='undefined'||!RULES)return null;
      // Alleen de lichte parameter-/verkeerscontext herstellen. Geen assets,
      // historie of totaalimport uitvoeren. Hierdoor blijven eerder aangeleverde
      // NDW-meetlocaties beschikbaar terwijl zware operationele data uitgesteld blijft.
      RULES.kosten={...(RULES.kosten||{}),...kosten};
      const snapshot=kosten.ndw69Snapshot;
      const info={
        sites:Array.isArray(snapshot?.sites)?snapshot.sites.length:0,
        validSites:Number(snapshot?.stats?.validSites)||0,
        publication:snapshot?.publication||null,
        files:Array.isArray(snapshot?.files)?snapshot.files.slice():[]
      };
      window.__BIDASH_DVM_TRAFFIC_RESTORED__=info;
      return info;
    }catch(error){
      console.warn('BiDash: verkeerscontext uit uitgestelde werkruimte kon niet worden hersteld.',error);
      return null;
    }
  }

  function installeerImportGuard(){
    const hub=window.HUB;
    if(!hub||typeof hub.import!=='function'||hub.__bidashImportGuard)return false;
    const oorspronkelijkeImport=hub.import;

    hub.import=async function(bundle,...args){
      const gestart=performance.now();
      const policy=await restorePolicy;
      const zwaar=policy.shouldDeferDvmRestore(bundle);

      // Belangrijk: een grote eerder opgeslagen DVM-werkruimte werd bij iedere
      // pagina-start opnieuw door totaalImportJson gehaald. Daardoor verscheen
      // dvm-lokaal.json / "Koppelingen en analysebeeld herbouwen" nog vóór de
      // bron-specifieke upload. Voor een zware werkruimte slaan we die automatische
      // totaalherbouw nu over. De gebruiker kan DVM-bronnen daarna één voor één laden.
      // De verkeers-/kostenparameters herstellen we wél selectief, zodat de eerder
      // aangeleverde NDW-meetdata niet verloren gaat door deze performanceguard.
      if(zwaar&&(ouderStartNog()||bronbeheerActief())){
        const profiel=policy.dvmRestoreProfile(bundle);
        const verkeer=herstelVerkeerscontext(bundle);
        window.__BIDASH_DVM_RESTORE_DEFERRED__={...profiel,reden:bronbeheerActief()?'bronbeheer':'opstart',tijd:new Date().toISOString(),verkeer};
        console.info('BiDash: zware DVM-werkruimte niet automatisch herbouwd.',window.__BIDASH_DVM_RESTORE_DEFERRED__);
        try{
          if(parent!==window)parent.postMessage({type:'hub:dvm-restore-deferred',engine:'dvm',profile:profiel,verkeer},location.origin);
        }catch(error){}
        return legeSamenvatting();
      }

      for(let poging=0;poging<1500&&!optimalisatiesGereed();poging++)await wacht(10);
      if(!optimalisatiesGereed()){
        throw new Error('DVM-importoptimalisaties zijn niet gereed. Herlaad de pagina en probeer opnieuw.');
      }

      const nativeClone=window.structuredClone;
      if(typeof nativeClone!=='function')return oorspronkelijkeImport.call(this,bundle,...args);

      // De adapter gebruikte structuredClone(bundle) direct voor JSON.stringify.
      // totaalImportJson leest daarna toch een nieuw JSON-object in. Voor exact dit
      // bronobject is die extra kopie dus overbodig en zeer duur bij grote DVM-data.
      window.structuredClone=function(value,options){
        if(value===bundle)return value;
        return nativeClone.call(window,value,options);
      };

      try{
        const resultaat=await oorspronkelijkeImport.call(this,bundle,...args);
        window.__BIDASH_LAST_HUB_IMPORT_PERF__={
          duurMs:Math.round(performance.now()-gestart),
          combiPatch:window.__BIDASH_DVM_COMBI_PERF_ACTIVE__===true,
          rebuildPatch:window.__BIDASH_ANALYSIS_REBUILD_PERF__===true,
          cloneDvmBundleOvergeslagen:true
        };
        return resultaat;
      }finally{
        window.structuredClone=nativeClone;
      }
    };
    hub.__bidashImportGuard=true;
    window.__BIDASH_DVM_HUB_IMPORT_GUARD__=true;
    return true;
  }

  // Deze listener wordt vóór de listener van de oorspronkelijke adapter
  // geregistreerd. Daardoor is HUB.import al bewaakt voordat het iframe-load
  // event in de bovenliggende BiDash-app wordt afgehandeld.
  window.addEventListener('load',installeerImportGuard,{once:true});

  // Hergebruik exact de bestaande adaptercode als afzonderlijke bron.
  // document.write is hier bewust parser-synchroon, zodat HUB vóór window.load bestaat.
  document.write('<script src="dvm-adapter-original.js"></script>');
  // DVM-bronbeheer krijgt daarnaast een eigen bron-specifieke uploadlaag.
  // Deze wordt na dvm-1/2/3 geladen en kan daardoor de bestaande bronparsers
  // rechtstreeks gebruiken zonder de generieke totaal-/autodetectieroute.
  document.write('<script src="dvm-source-manager.js"></script>');
})();
