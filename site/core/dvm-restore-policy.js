export const DVM_AUTO_RESTORE_LIMITS=Object.freeze({
  assetRows:20000,
  historyRows:20000,
  totalRows:30000
});

function rows(value){return Array.isArray(value)?value.length:0;}
function sourceRows(list){
  if(!Array.isArray(list))return 0;
  return list.reduce((n,source)=>n+rows(source?.rijen||source?.rows||source?.records||source?.data||source?.incidenten),0);
}

export function dvmRestoreProfile(dvm){
  const assetRows=rows(dvm?.assetregister?.rijen);
  const historyRows=sourceRows(dvm?.storingshistorie);
  const liveRows=sourceRows(dvm?.liveStoringen);
  const dripHistoryRows=sourceRows(dvm?.dripHistorie?.sources);
  const uRouteRows=rows(dvm?.uRoutes?.rijen);
  const workRows=rows(dvm?.werkzaamheden?.rijen);
  const totalRows=assetRows+historyRows+liveRows+dripHistoryRows+uRouteRows+workRows;
  return {assetRows,historyRows,liveRows,dripHistoryRows,uRouteRows,workRows,totalRows};
}

export function shouldDeferDvmRestore(dvm,limits=DVM_AUTO_RESTORE_LIMITS){
  if(!dvm?.assetregister?.rijen?.length)return false;
  const p=dvmRestoreProfile(dvm);
  return p.assetRows>limits.assetRows||p.historyRows>limits.historyRows||p.totalRows>limits.totalRows;
}
