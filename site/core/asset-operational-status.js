export const OPERATIONAL_STATUS=Object.freeze({
  OPERATIONAL:'Operationeel',
  FAULT_OUTAGE:'Niet operationeel door storing',
  NOT_OPERATIONAL:'Niet operationeel'
});

const txt=v=>String(v??'').trim();
const upper=v=>txt(v).toUpperCase();
const yes=v=>v===true||v===1||/^(1|ja|yes|true|x)$/i.test(txt(v));

export function isStaticNotOperational(asset){
  if(!asset||typeof asset!=='object')return false;
  if(asset.prognoseActief===false)return true;
  const s=upper(asset.status);
  return s.includes('NIET OPERATIONEEL')&&!s.includes('DOOR STORING');
}

export function faultCausesOperationalLoss(asset,fault){
  const type=upper(fault?.typeId||asset?.tp||asset?.assetType||asset?.type);
  const code=upper(fault?.code||fault?.foutcode);
  if(type==='MSI'&&code==='1003')return true;
  if(type==='DRIP'){
    const special=yes(fault?.wind)||yes(fault?.windwaarschuwing)||yes(fault?.ria4)||yes(fault?.specialWind)||yes(fault?.specialRia4)||yes(asset?.specialWind)||yes(asset?.specialRia4)||yes(asset?.wind)||yes(asset?.windwaarschuwing)||yes(asset?.ria4);
    if(special)return true;
  }
  return false;
}

export function operationalStatusForFault(asset,fault){
  if(isStaticNotOperational(asset))return OPERATIONAL_STATUS.NOT_OPERATIONAL;
  if(faultCausesOperationalLoss(asset,fault))return OPERATIONAL_STATUS.FAULT_OUTAGE;
  const existing=upper(fault?.operationeleStatus||fault?.status);
  if(existing.includes('NIET OPERATIONEEL DOOR STORING'))return OPERATIONAL_STATUS.FAULT_OUTAGE;
  if(existing.includes('NIET OPERATIONEEL'))return OPERATIONAL_STATUS.NOT_OPERATIONAL;
  return OPERATIONAL_STATUS.OPERATIONAL;
}

export function operationalStatusForAsset(asset,faults=[]){
  if(isStaticNotOperational(asset))return OPERATIONAL_STATUS.NOT_OPERATIONAL;
  const key=txt(asset?.key||asset?.id);
  const linked=(Array.isArray(faults)?faults:[]).filter(f=>key&&txt(f?.assetKey)===key);
  if(linked.some(f=>faultCausesOperationalLoss(asset,f)))return OPERATIONAL_STATUS.FAULT_OUTAGE;
  const existing=upper(asset?.status);
  if(existing.includes('NIET OPERATIONEEL DOOR STORING'))return OPERATIONAL_STATUS.FAULT_OUTAGE;
  if(existing.includes('NIET OPERATIONEEL'))return OPERATIONAL_STATUS.NOT_OPERATIONAL;
  return OPERATIONAL_STATUS.OPERATIONAL;
}
