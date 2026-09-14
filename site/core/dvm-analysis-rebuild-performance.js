export function dvmAssetMatchMemoKey(m,typeId){
  const norm=v=>String(v==null?'':v).trim().toUpperCase();
  const hm=m&&m.hm!=null&&Number.isFinite(Number(m.hm))?Number(m.hm).toFixed(3):'';
  return [
    norm(typeId),norm(m&&m.logId),norm(m&&m.code),norm(m&&m.osid),
    norm(m&&m.asset),norm(m&&m.idCdms),norm(m&&m.entityid),
    norm(m&&m.weg),norm(m&&m.richting),hm,norm(m&&m.strook),norm(m&&m.vc)
  ].join('\u001f');
}

export function installDvmAnalysisRebuildPerformance(scope=globalThis){
  if(!scope||scope.__BIDASH_ANALYSIS_REBUILD_PERF__)return false;
  let attempts=0;
  const install=()=>{
    if(scope.__BIDASH_ANALYSIS_REBUILD_PERF__)return true;
    const originalMatch=scope.koppelMeldingAanAsset;
    const originalTotalImport=scope.totaalImportJson;
    const originalProgress=scope.zetImportVoortgang;
    const originalDripLink=scope.koppelDripHistorieAanAreaal;
    const originalCoverage=scope.herberekenRegisterDekking;
    const originalInspect=scope.inspecteerStoringsRijen;
    const originalRebuild=scope.herbouwAssetMatchBeeld;
    const originalActivate=scope.probeerAnalyseActiveren;
    const originalCombinedHistory=scope.gecombineerdeStoringsRijen;
    if([originalMatch,originalTotalImport,originalProgress,originalDripLink,originalCoverage,originalInspect,originalRebuild,originalActivate].some(f=>typeof f!=='function')){
      if(attempts++<200)setTimeout(install,10);
      return false;
    }

    let totalImportActive=false,rebuildPhase=false,assetRegisterBuilt=false,currentFile='DVM-totaalbestand';
    let inspectCall=0,historyRecognizable=null,historyPassSkipped=false,coverageSkips=0;
    let historyDeferred=false,deferredHistoryRows=0,deferredAnalyseActive=false;
    const LARGE_HISTORY_THRESHOLD=20000;
    const cache=new Map();
    let hits=0,misses=0;
    const timings={};
    const now=()=>scope.performance&&typeof scope.performance.now==='function'?scope.performance.now():Date.now();
    const resetCache=()=>{cache.clear();hits=0;misses=0;};
    const timeCall=(naam,fn)=>{
      const t=now();
      try{return fn();}
      finally{timings[naam]=(timings[naam]||0)+(now()-t);}
    };
    const phase=(pct,label)=>{
      if(!totalImportActive||!rebuildPhase)return;
      originalProgress.call(scope,currentFile,pct,label,{direct:true});
    };
    const markCoverageCurrent=()=>{
      if(typeof scope.eval!=='function')return false;
      try{
        scope.eval('if(typeof ASSET_REGISTER_STATE!=="undefined"&&ASSET_REGISTER_STATE&&typeof ASSET_CONFIG_VERSIE!=="undefined"){ASSET_REGISTER_STATE._assetConfigVersie=ASSET_CONFIG_VERSIE;}');
        return true;
      }catch(e){return false;}
    };
    const inspectWithoutAssetLinks=rows=>{
      if(typeof scope.eval!=='function')return null;
      const hold='__BIDASH_IMPORT_ASSET_INDEX_HOLD__';
      try{
        scope[hold]=scope.eval('typeof ASSET_INDEX!=="undefined"?ASSET_INDEX:null');
        scope.eval('ASSET_INDEX=null');
        const result=timeCall('historieLichteInspectieMs',()=>originalInspect.call(scope,rows));
        if(result&&result.typen){
          Object.values(result.typen).forEach(g=>{
            g.genoeg=false;g.frequentieGenoeg=false;g.koppelingUitgesteld=true;
          });
          result.koppelingUitgesteld=true;
        }
        return result;
      }catch(e){return null;}
      finally{
        try{scope.eval('ASSET_INDEX=globalThis.__BIDASH_IMPORT_ASSET_INDEX_HOLD__');}catch(e){}
        try{delete scope[hold];}catch(e){}
      }
    };
    const setHistoryInspection=result=>{
      if(typeof scope.eval!=='function')return false;
      try{
        scope.__BIDASH_DEFERRED_HISTORY_INSPECTION__=result;
        scope.eval('STORINGS_INSPECTIE=globalThis.__BIDASH_DEFERRED_HISTORY_INSPECTION__');
        delete scope.__BIDASH_DEFERRED_HISTORY_INSPECTION__;
        return true;
      }catch(e){
        try{delete scope.__BIDASH_DEFERRED_HISTORY_INSPECTION__;}catch(ignore){}
        return false;
      }
    };
    const analyseDeferredHistory=()=>{
      if(!historyDeferred||typeof originalCombinedHistory!=='function')return false;
      const rows=originalCombinedHistory();
      deferredAnalyseActive=true;resetCache();
      try{
        const result=timeCall('historieUitgesteldeInspectieMs',()=>originalInspect.call(scope,rows));
        setHistoryInspection(result);
        historyRecognizable=result&&Number.isFinite(Number(result.herkenbaar))?Number(result.herkenbaar):null;
        historyDeferred=false;
        deferredHistoryRows=0;
        return true;
      }finally{
        deferredAnalyseActive=false;
      }
    };

    scope.koppelMeldingAanAsset=function(m,typeId){
      if(!((totalImportActive&&rebuildPhase)||deferredAnalyseActive))return originalMatch.call(this,m,typeId);
      const key=dvmAssetMatchMemoKey(m,typeId);
      if(cache.has(key)){hits++;return cache.get(key);}
      misses++;
      const result=originalMatch.call(this,m,typeId);
      cache.set(key,result);
      return result;
    };

    scope.zetImportVoortgang=function(bestand,pct,fase,opties){
      const tekst=String(fase||'');
      if(totalImportActive&&/assetregister\s+opbouwen/i.test(tekst))assetRegisterBuilt=true;
      if(totalImportActive&&!rebuildPhase&&/analysebeeld\s+herbouwen/i.test(tekst)){
        rebuildPhase=true;
        inspectCall=0;historyRecognizable=null;historyPassSkipped=false;
        resetCache();
      }
      return originalProgress.call(this,bestand,pct,fase,opties);
    };

    scope.herberekenRegisterDekking=function(...args){
      if(totalImportActive&&rebuildPhase&&assetRegisterBuilt&&markCoverageCurrent()){
        coverageSkips++;
        phase(93,'Assetregisterdekking hergebruiken');
        return;
      }
      if(totalImportActive&&rebuildPhase)phase(93,'Assetregisterdekking bijwerken');
      return timeCall('registerDekkingMs',()=>originalCoverage.apply(this,args));
    };

    scope.inspecteerStoringsRijen=function(...args){
      if(!totalImportActive||!rebuildPhase)return originalInspect.apply(this,args);
      inspectCall++;
      const eerste=inspectCall===1,rows=Array.isArray(args[0])?args[0]:[];
      if(eerste&&rows.length>=LARGE_HISTORY_THRESHOLD){
        historyDeferred=true;deferredHistoryRows=rows.length;
        phase(94,`${rows.length.toLocaleString('nl-NL')} historische regels registreren, assetkoppeling uitgesteld`);
        const light=inspectWithoutAssetLinks(rows)||{totaalRijen:rows.length,herkenbaar:0,typen:{},typenGeladen:[],koppelingUitgesteld:true};
        if(light&&Number.isFinite(Number(light.herkenbaar)))historyRecognizable=Number(light.herkenbaar);
        return light;
      }
      phase(eerste?94:95,eerste?'Storingshistorie inspecteren':'Open storingen inspecteren');
      const result=timeCall(eerste?'historieInspectieMs':'liveInspectieMs',()=>originalInspect.apply(this,args));
      if(eerste&&result&&Number.isFinite(Number(result.herkenbaar)))historyRecognizable=Number(result.herkenbaar);
      return result;
    };

    scope.koppelDripHistorieAanAreaal=function(opties){
      if(totalImportActive&&rebuildPhase){
        phase(96,'DRIP-historie koppelen');
        return timeCall('dripKoppelingMs',()=>originalDripLink.call(this,{...(opties||{}),slaMatchBeeldOver:true}));
      }
      return originalDripLink.call(this,opties);
    };

    scope.herbouwAssetMatchBeeld=function(...args){
      if(!totalImportActive||!rebuildPhase)return originalRebuild.apply(this,args);
      phase(97,historyDeferred?'Actuele assetkoppelingen en restlijst opbouwen':'Assetkoppelingen en restlijst opbouwen');
      if((historyDeferred||historyRecognizable===0)&&typeof originalCombinedHistory==='function'){
        const saved=scope.gecombineerdeStoringsRijen;
        scope.gecombineerdeStoringsRijen=()=>[];
        historyPassSkipped=true;
        try{return timeCall('matchBeeldMs',()=>originalRebuild.apply(this,args));}
        finally{scope.gecombineerdeStoringsRijen=saved;}
      }
      return timeCall('matchBeeldMs',()=>originalRebuild.apply(this,args));
    };

    scope.probeerAnalyseActiveren=function(...args){
      const doel=String(args[0]||'').toLowerCase();
      if(!totalImportActive&&historyDeferred&&doel==='prognose')analyseDeferredHistory();
      if(totalImportActive&&rebuildPhase)phase(98,historyDeferred?'Live analysebeeld opbouwen, historie later koppelen':'Analysebeeld en scherm opbouwen');
      return timeCall(totalImportActive&&rebuildPhase?'analyseActiverenMs':'analyseBuitenImportMs',()=>originalActivate.apply(this,args));
    };

    scope.totaalImportJson=async function(...args){
      totalImportActive=true;rebuildPhase=false;assetRegisterBuilt=false;inspectCall=0;historyRecognizable=null;historyPassSkipped=false;coverageSkips=0;
      historyDeferred=false;deferredHistoryRows=0;deferredAnalyseActive=false;
      currentFile=args[0]&&args[0].name?String(args[0].name):'DVM-totaalbestand';
      Object.keys(timings).forEach(k=>delete timings[k]);resetCache();
      try{return await originalTotalImport.apply(this,args);}
      finally{
        scope.__BIDASH_LAST_REBUILD_PERF__={
          hits,misses,cacheEntries:cache.size,coverageSkips,historyRecognizable,historyPassSkipped,
          historyDeferred,deferredHistoryRows,
          timings:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,Math.round(v)]))
        };
        scope.__BIDASH_HISTORY_DEFERRED__=historyDeferred?{rows:deferredHistoryRows,reason:'grote historische set, wordt gekoppeld bij prognose'}:null;
        totalImportActive=false;rebuildPhase=false;assetRegisterBuilt=false;cache.clear();
      }
    };

    scope.__BIDASH_ANALYSEER_HISTORIE__=()=>analyseDeferredHistory();
    scope.__BIDASH_ANALYSIS_REBUILD_PERF__=true;
    return true;
  };
  return install();
}

if(typeof window!=='undefined')installDvmAnalysisRebuildPerformance(window);
