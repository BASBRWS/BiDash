export function installFaultHubExtensionLoader(scope=globalThis){
  if(!scope||!scope.document)return false;
  if(scope.__BIDASH_FAULT_HUB_EXTENSION_LOADER__)return true;
  const run=async()=>{
    if(scope.document.getElementById('bidashFaultsExtensionScript'))return;
    try{
      const [match,status]=await Promise.all([import('./drip-fault-match.js'),import('./asset-operational-status.js')]);
      scope.__BIDASH_DRIP_FAULT_MATCH__=match;
      scope.__BIDASH_ASSET_OPERATIONAL_STATUS__=status;
    }catch(error){
      console.error('BiDash kon DRIP-koppeling/statusregels niet laden.',error);
      return;
    }
    const s=scope.document.createElement('script');
    s.id='bidashFaultsExtensionScript';s.src='dvm-faults-extension.js';s.defer=true;
    s.onload=()=>scope.dispatchEvent(new CustomEvent('bidash:faults-extension-ready'));
    scope.document.head.appendChild(s);
  };
  if(scope.document.readyState==='complete')run();else scope.addEventListener('load',run,{once:true});
  scope.__BIDASH_FAULT_HUB_EXTENSION_LOADER__=true;
  return true;
}
