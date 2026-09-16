export const OPEN_FAULT_TYPES=Object.freeze([
  ['', 'Alle assettypen'],
  ['MSI','Signaalgevers / MSI'],
  ['DRIP','DRIP'],
  ['CAM','Camera'],
  ['LUS','Detectielus'],
  ['WISSELBORD','Wisselbord']
]);

export const OPEN_OPERATIONAL_STATUSES=Object.freeze([
  ['', 'Alle statussen'],
  ['Operationeel','Operationeel'],
  ['Niet operationeel door storing','Niet operationeel door storing'],
  ['Niet operationeel','Niet operationeel']
]);

function norm(v){return String(v==null?'':v).trim();}
function low(v){return norm(v).toLowerCase();}

export function faultCategory(f){
  const cats=[];
  if(f?.wind===true||f?.windwaarschuwing===true)cats.push('wind');
  if(f?.ria4===true)cats.push('ria4');
  return cats;
}

export function filterOpenFaults(rows,filters={}){
  const q=low(filters.query),vc=norm(filters.vc),type=norm(filters.type).toUpperCase(),status=norm(filters.status);
  const specials=[];if(filters.wind)specials.push('wind');if(filters.ria4)specials.push('ria4');
  return (Array.isArray(rows)?rows:[]).filter(f=>{
    if(vc&&norm(f.vc)!==vc)return false;
    if(type&&norm(f.typeId).toUpperCase()!==type)return false;
    if(status&&norm(f.operationeleStatus)!==status)return false;
    if(specials.length&&!specials.some(x=>faultCategory(f).includes(x)))return false;
    if(!q)return true;
    return [f.naam,f.assetKey,f.weg,f.richting,f.hm,f.code,f.omschrijving,f.vc,f.rd,f.typeId,f.bron,f.operationeleStatus].some(v=>low(v).includes(q));
  });
}

export function formatFaultDuration(hours){
  if(hours==null||hours==='')return 'Onbekend';
  const h=Number(hours);if(!Number.isFinite(h)||h<0)return 'Onbekend';
  if(h===0)return '0 min';
  if(h<1){const min=Math.max(1,Math.round(h*60));return `${min} min`;}
  if(h<24)return `${h<10?h.toFixed(1):Math.round(h)} uur`.replace('.',',');
  const d=Math.floor(h/24),rest=Math.round(h-d*24);
  return rest?`${d} d ${rest} u`:`${d} d`;
}

function countBy(rows,key){
  const m=new Map();for(const r of rows){const v=norm(r?.[key])||'Onbekend';m.set(v,(m.get(v)||0)+1);}return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
}

export function buildOpenFaultMemo(rows,context={}){
  const list=Array.isArray(rows)?rows:[];
  const durations=list.filter(r=>r.duurUren!=null&&r.duurUren!==''&&r.duurBetrouwbaar!==false).map(r=>Number(r.duurUren)).filter(v=>Number.isFinite(v)&&v>=0);
  const avg=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null;
  const oldest=durations.length?Math.max(...durations):null;
  return {
    created:new Date().toISOString(),
    peildatum:context.peildatum||null,
    total:list.length,
    byType:countBy(list,'typeId'),
    byStatus:countBy(list,'operationeleStatus'),
    byVc:countBy(list,'vc'),
    byRd:countBy(list,'rd'),
    wind:list.filter(x=>x.wind===true||x.windwaarschuwing===true).length,
    ria4:list.filter(x=>x.ria4===true).length,
    averageDurationHours:avg,
    oldestDurationHours:oldest,
    rows:list.slice().sort((a,b)=>(Number(b.duurUren)||-1)-(Number(a.duurUren)||-1))
  };
}
