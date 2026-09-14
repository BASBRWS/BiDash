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
    if([originalMatch,originalTotalImport,originalProgress,originalDripLink].some(f=>typeof f!=='function')){
      if(attempts++<200)setTimeout(install,10);
      return false;
    }

    let totalImportActive=false,rebuildPhase=false;
    const cache=new Map();
    let hits=0,misses=0;
    const resetCache=()=>{cache.clear();hits=0;misses=0;};

    scope.koppelMeldingAanAsset=function(m,typeId){
      if(!totalImportActive||!rebuildPhase)return originalMatch.call(this,m,typeId);
      const key=dvmAssetMatchMemoKey(m,typeId);
      if(cache.has(key)){hits++;return cache.get(key);}
      misses++;
      const result=originalMatch.call(this,m,typeId);
      cache.set(key,result);
      return result;
    };

    scope.zetImportVoortgang=function(bestand,pct,fase,opties){
      if(totalImportActive&&/analysebeeld\s+herbouwen/i.test(String(fase||''))){
        rebuildPhase=true;
        resetCache();
      }
      return originalProgress.call(this,bestand,pct,fase,opties);
    };

    scope.koppelDripHistorieAanAreaal=function(opties){
      if(totalImportActive&&rebuildPhase){
        // totaalImportJson bouwt ASSET_MATCH_STATE direct hierna zelf opnieuw op.
        // Zonder deze vlag gebeurt dezelfde kostbare volledige matchpass tweemaal.
        return originalDripLink.call(this,{...(opties||{}),slaMatchBeeldOver:true});
      }
      return originalDripLink.call(this,opties);
    };

    scope.totaalImportJson=async function(...args){
      totalImportActive=true;rebuildPhase=false;resetCache();
      try{return await originalTotalImport.apply(this,args);}
      finally{
        scope.__BIDASH_LAST_REBUILD_PERF__={hits,misses,cacheEntries:cache.size};
        totalImportActive=false;rebuildPhase=false;cache.clear();
      }
    };

    scope.__BIDASH_ANALYSIS_REBUILD_PERF__=true;
    return true;
  };
  return install();
}

if(typeof window!=='undefined')installDvmAnalysisRebuildPerformance(window);
