export function installDvmImportFastCapture(scope=globalThis){
  if(!scope||scope.__BIDASH_DVM_IMPORT_FAST_CAPTURE__)return false;
  let attempts=0;
  const patch=()=>{
    const hub=scope.HUB;
    if(!hub||typeof hub.import!=='function'||typeof hub.export!=='function'){
      if(attempts++<100)setTimeout(patch,0);
      return;
    }
    if(hub.__bidashFastCapture)return;
    const originalImport=hub.import.bind(hub);
    const originalExport=hub.export.bind(hub);
    let firstCapture=null;
    hub.import=async function(bundle){
      firstCapture=null;
      const result=await originalImport(bundle);
      firstCapture=bundle;
      return result;
    };
    hub.export=function(){
      if(firstCapture){const value=firstCapture;firstCapture=null;return value;}
      return originalExport();
    };
    hub.__bidashFastCapture=true;
    scope.__BIDASH_DVM_IMPORT_FAST_CAPTURE__=true;
  };
  patch();
  return true;
}

if(typeof window!=='undefined')installDvmImportFastCapture(window);
