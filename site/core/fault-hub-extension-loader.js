export function installFaultHubExtensionLoader(scope=globalThis){
  if(!scope||!scope.document)return false;
  if(scope.__BIDASH_FAULT_HUB_EXTENSION_LOADER__)return true;
  const run=()=>{
    if(scope.document.getElementById('bidashFaultsExtensionScript'))return;
    const s=scope.document.createElement('script');
    s.id='bidashFaultsExtensionScript';s.src='dvm-faults-extension.js';s.defer=true;
    s.onload=()=>scope.dispatchEvent(new CustomEvent('bidash:faults-extension-ready'));
    scope.document.head.appendChild(s);
  };
  if(scope.document.readyState==='complete')run();else scope.addEventListener('load',run,{once:true});
  scope.__BIDASH_FAULT_HUB_EXTENSION_LOADER__=true;
  return true;
}
