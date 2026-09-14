export function installDvmImportProgressBridge(scope=globalThis){
  if(!scope||scope.__BIDASH_DVM_PROGRESS_BRIDGE__)return !!scope?.__BIDASH_DVM_PROGRESS_BRIDGE__;
  const original=scope.zetImportVoortgang;
  if(typeof original!=='function'||!scope.parent||scope.parent===scope)return false;
  scope.zetImportVoortgang=function(bestand,pct,fase,opties){
    const out=original.apply(this,arguments);
    try{
      const o=opties||{};
      scope.parent.postMessage({
        type:'hub:import-progress',engine:'dvm',bestand:String(bestand||''),
        pct:pct==null?null:Math.max(0,Math.min(100,Number(pct)||0)),
        fase:String(fase||'Bron verwerken'),active:o.actief!==false,error:!!o.fout
      },scope.location.origin);
    }catch(e){}
    return out;
  };
  scope.__BIDASH_DVM_PROGRESS_BRIDGE__=true;
  return true;
}
