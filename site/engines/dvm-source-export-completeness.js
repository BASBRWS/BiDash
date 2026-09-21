/* Houdt de handmatige DVM-totaalexport gelijk aan wat Bronbeheer toont. */
(() => {
  const isTotaal=b=>b&&String(b.key||'').indexOf('signaalgever-totaal-')===0;
  const clone=x=>x==null?null:structuredClone(x);

  if(typeof totaalExportBundle==='function'){
    const originalExport=totaalExportBundle;
    totaalExportBundle=function(selectie,opties){
      const bundle=originalExport.apply(this,arguments),lean=!!opties?.autosaveLean;
      const status=window.__BIDASH_SIGNAALGEVER_TOTAAL__||null;
      for(const part of ['storingshistorie','liveStoringen'])for(const bron of bundle[part]||[]){
        if(!isTotaal(bron))continue;
        bron._signaalgeverTotaal=true;
        bron._signaalgeverBestand=status?.bestand||null;
      }
      bundle.bronbeheer={
        signaalgeverTotaal:lean?null:clone(status),
        dripTotaal:clone(window.__BIDASH_DRIP_TOTAAL__||null)
      };
      return bundle;
    };
  }

  if(typeof totaalImportJson==='function'){
    const originalImport=totaalImportJson;
    totaalImportJson=async function(file){
      let bundle=null;try{bundle=JSON.parse(await file.text());}catch(error){}
      const result=await originalImport.apply(this,arguments);
      if(!bundle||bundle.formaat!=='DVM-dienstimpact-totaal')return result;
      const beheer=bundle.bronbeheer||{},hist=(STORINGSBRONNEN||[]).find(isTotaal),live=(LIVE_STORINGSBRONNEN||[]).find(isTotaal);
      if(hist||live){
        [hist,live].filter(Boolean).forEach(b=>{b._signaalgeverTotaal=true;b._signaalgeverBestand=b._signaalgeverBestand||beheer.signaalgeverTotaal?.bestand||file.name;});
        window.__BIDASH_SIGNAALGEVER_TOTAAL__={bestand:file.name,open:live?.rijen?.length||0,historie:hist?.rijen?.length||0,peildatum:LIVE_PEILDATUM||null,...(beheer.signaalgeverTotaal||{})};
      }
      if(beheer.dripTotaal)window.__BIDASH_DRIP_TOTAAL__=clone(beheer.dripTotaal);
      if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();
      return result;
    };
  }
  window.__BIDASH_DVM_SOURCE_EXPORT_COMPLETE__=true;
})();
