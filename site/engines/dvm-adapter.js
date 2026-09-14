/* DVM-adapter startguard voor grote integrale imports.
   De oorspronkelijke adapter blijft ongewijzigd in dvm-adapter-original.js.
   Deze wrapper zorgt dat de performancepatches echt actief zijn voordat HUB.import start
   en voorkomt een volledige structuredClone van het DVM-deel van de werkruimte. */
(() => {
  const wacht = ms => new Promise(resolve => setTimeout(resolve, ms));
  const optimalisatiesGereed = () =>
    window.__BIDASH_DVM_COMBI_PERF_ACTIVE__ === true &&
    window.__BIDASH_ANALYSIS_REBUILD_PERF__ === true;

  function installeerImportGuard(){
    const hub=window.HUB;
    if(!hub||typeof hub.import!=='function'||hub.__bidashImportGuard)return false;
    const oorspronkelijkeImport=hub.import;

    hub.import=async function(bundle,...args){
      const gestart=performance.now();
      for(let poging=0;poging<1500&&!optimalisatiesGereed();poging++)await wacht(10);
      if(!optimalisatiesGereed()){
        throw new Error('DVM-importoptimalisaties zijn niet gereed. Herlaad de pagina en probeer opnieuw.');
      }

      const nativeClone=window.structuredClone;
      if(typeof nativeClone!=='function')return oorspronkelijkeImport.call(this,bundle,...args);

      // De adapter gebruikte structuredClone(bundle) direct voor JSON.stringify.
      // totaalImportJson leest daarna toch een nieuw JSON-object in. Voor exact dit
      // bronobject is die extra kopie dus overbodig en zeer duur bij 40+ MB DVM-data.
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
})();
