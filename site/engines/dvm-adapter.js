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
  function herstelSpecialeDrips(bundle){
    try{
      const data=bundle?.parameters?.dripSpecialLists;
      if(!data||typeof window.restoreDripSpecialLists!=='function')return null;
      window.restoreDripSpecialLists(data);
      return {
        wind:Array.isArray(data.wind?.identifiers)?data.wind.identifiers.length:0,
        ria4:Array.isArray(data.ria4?.identifiers)?data.ria4.identifiers.length:0
      };
    }catch(error){
      console.warn('BiDash: speciale DRIP-referentielijsten konden niet worden hersteld.',error);return null;
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
      const specialeDrips=herstelSpecialeDrips(bundle);

      if(zwaar&&(ouderStartNog()||bronbeheerActief())){
        const profiel=policy.dvmRestoreProfile(bundle);
        const verkeer=herstelVerkeerscontext(bundle);
        window.__BIDASH_DVM_RESTORE_DEFERRED__={...profiel,reden:bronbeheerActief()?'bronbeheer':'opstart',tijd:new Date().toISOString(),verkeer,specialeDrips};
        console.info('BiDash: zware DVM-werkruimte niet automatisch herbouwd.',window.__BIDASH_DVM_RESTORE_DEFERRED__);
        try{
          if(parent!==window)parent.postMessage({type:'hub:dvm-restore-deferred',engine:'dvm',profile:profiel,verkeer,specialeDrips},location.origin);
        }catch(error){}
        return legeSamenvatting();
      }

      for(let poging=0;poging<1500&&!optimalisatiesGereed();poging++)await wacht(10);
      if(!optimalisatiesGereed()){
        throw new Error('DVM-importoptimalisaties zijn niet gereed. Herlaad de pagina en probeer opnieuw.');
      }

      const nativeClone=window.structuredClone;
      if(typeof nativeClone!=='function')return oorspronkelijkeImport.call(this,bundle,...args);

      window.structuredClone=function(value,options){
        if(value===bundle)return value;
        return nativeClone.call(window,value,options);
      };

      try{
        const resultaat=await oorspronkelijkeImport.call(this,bundle,...args);
        try{if(typeof window.applyDripSpecialLists==='function')window.applyDripSpecialLists();}catch(error){}
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

  window.addEventListener('load',installeerImportGuard,{once:true});

  document.write('<script src="dvm-adapter-original.js"></script>');
  // Classificatielijsten zijn aparte lichte bronnen en worden vóór bronbeheer geladen.
  document.write('<script src="dvm-special-drip-lists.js"></script>');
  document.write('<script src="dvm-source-manager.js"></script>');
})();
