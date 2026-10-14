import {applyQuery} from './query-filter.js';
import {operationalStatusForAsset} from './asset-operational-status.js?v=20261014-1551';
const yes=v=>v===true||v===1||/^(1|ja|yes|true|x)$/i.test(String(v??'').trim());

const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const CHUNK_SIZE=512;
const hmFormat=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:3});

// Alleen presentatie. Bronassets en DVM-uitkomsten blijven bij hun adapters.
export function createAssetRegisterView({yieldControl=pause}={}){
 let revision=0,snapshot=null,pending=null,selection=null;
 function invalidate(){revision++;snapshot=null;pending=null;selection=null;}
 async function build(dvm,bi,version){
  const faults=(dvm?.faultsAsync?await dvm.faultsAsync({isCurrent:()=>version===revision}):dvm?.faults?.())||[],counts=new Map(),codes=new Map(),linked=new Map();
  if(version!==revision)return null;
  for(let i=0;i<faults.length;i++){
   const fault=faults[i];
   if(fault.assetKey){
    counts.set(fault.assetKey,(counts.get(fault.assetKey)||0)+1);
    if(!linked.has(fault.assetKey))linked.set(fault.assetKey,[]);linked.get(fault.assetKey).push(fault);
    if(fault.code){if(!codes.has(fault.assetKey))codes.set(fault.assetKey,new Set());codes.get(fault.assetKey).add(String(fault.code));}
   }
   if((i+1)%CHUNK_SIZE===0){await yieldControl();if(version!==revision)return null;}
  }
  const rows=[],vcs=new Set();
  for(const [source,assets] of [['DVM',dvm?.assets?.()||[]],['BI',bi?.assets?.()||[]]]){
   for(let i=0;i<assets.length;i++){
    const raw=assets[i],key=raw.key;
    const weg=source==='DVM'?[raw.weg,raw.richting,raw.hm!=null?'hm '+(Number.isFinite(raw.hm)?hmFormat.format(raw.hm):'Onbekend'):''].filter(Boolean).join(' '):raw.weg;
    const row={source,key,naam:raw.naam,tp:source==='DVM'?raw.tp:raw.assetType,vc:raw.vc,weg,
     status:operationalStatusForAsset(raw,source==='DVM'?linked.get(key)||[]:[]),
     wind:source==='DVM'&&(yes(raw.specialWind)||yes(raw.wind)||yes(raw.windwaarschuwing)),
     ria4:source==='DVM'&&(yes(raw.specialRia4)||yes(raw.ria4)||yes(raw.ria_4)||yes(raw['ria-4'])),
     raw,contract:raw.contract,aannemer:raw.aannemer,leverancier:raw.leverancier,
     ingebruikname:raw.ingebruikname??raw.ingebruikDatum??null,bouwjaar:raw.bouwjaar??null,bouwjaarBron:raw.bouwjaarBron||'',
     eolJaar:raw.eol?.jaar??raw._eolYear??null,eolLevensduur:raw.eol?.levensduur??raw._eolLife??null,
     openFaults:source==='DVM'?counts.get(key)||0:0,assetFaultCodes:source==='DVM'?[...(codes.get(key)||[])]:[]};
    row.searchText=[row.naam,row.weg,row.tp,row.contract,row.aannemer,row.leverancier].join(' ').toLowerCase();
    rows.push(row);if(row.vc)vcs.add(row.vc);
    if((i+1)%CHUNK_SIZE===0){await yieldControl();if(version!==revision)return null;}
   }
  }
  if(version!==revision)return null;
  snapshot={rows,faultCount:faults.length,vcs:[...vcs].sort(),revision:version};
  return snapshot;
 }
 function ensure(dvm,bi){
  if(snapshot)return Promise.resolve(snapshot);
  if(!pending){const version=revision;pending=build(dvm,bi,version).finally(()=>{if(version===revision)pending=null;});}
  return pending;
 }
 async function select(data,filters,query,fields,{isCurrent=()=>true}={}){
  if(!data||data.revision!==revision||!isCurrent())return null;
  const key=JSON.stringify([filters,query]);
  if(selection?.data===data&&selection.key===key)return selection.rows;
  const {search='',vc='',source='',onlyFaults=false,wind=false,ria4=false,status=''}=filters,q=search.toLowerCase();
  const activeQuery=(query?.rules||[]).some(rule=>rule.field&&(['empty','notEmpty'].includes(rule.operator)||String(rule.value??'').trim()!==''));
  let rows;
  if(!q&&!vc&&!source&&!onlyFaults&&!wind&&!ria4&&!status&&!activeQuery)rows=data.rows;
  else{
   rows=[];
   for(let i=0;i<data.rows.length;i+=CHUNK_SIZE){
    const part=data.rows.slice(i,i+CHUNK_SIZE).filter(row=>(!source||row.source===source)&&(!vc||row.vc===vc)&&(!onlyFaults||row.source==='DVM'&&row.openFaults>0)&&(!q||row.searchText.includes(q))&&(!status||row.status===status)&&(!(wind||ria4)||(wind&&row.wind)||(ria4&&row.ria4)));
    for(const row of activeQuery?applyQuery(part,query,fields):part)rows.push(row);
    await yieldControl();
    if(data.revision!==revision||!isCurrent())return null;
   }
  }
  selection={data,key,rows};return rows;
 }
 return {invalidate,ensure,select};
}
