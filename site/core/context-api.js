const upper=v=>String(v??'').trim().toUpperCase();
const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const num=v=>Number.isFinite(Number(v))?Number(v):null;

export function corridorTokens(value){
  const out=new Set(),text=String(value??'');
  for(const match of text.toUpperCase().matchAll(/\b[AN]\s*0*(\d{1,3})([A-Z]?)\b/g))out.add(match[0].replace(/\s+/g,'').replace(/^([AN])0+/,'$1'));
  for(const match of fold(text).matchAll(/\b[a-z]+tunnel\b/g))out.add(match[0]);
  return [...out];
}

export function planningPeriodLabel(value){
  const n=num(value);if(n==null)return '';
  const year=Math.floor(n),month=Math.max(0,Math.min(11,Math.floor((n-year)*12)));
  return ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][month]+' '+year;
}

function compactActivity(row={}){
  const wbsPath=[...(row.wbsPath||[])].map(String),wbs=String(row.wbs??'');
  const roads=corridorTokens([row.naam,row.code,row.blok,wbs,...wbsPath].filter(Boolean).join(' ')).filter(x=>/^[AN]\d/.test(x));
  const searchText=fold([row.naam,row.code,row.blok,row.dienst,row.kind,wbs,...wbsPath].filter(Boolean).join(' '));
  return {
    id:String(row.id??''),naam:String(row.naam??''),code:String(row.code??''),kind:String(row.kind??''),
    blok:String(row.blok??''),dienst:String(row.dienst??''),wbs,wbsPath,t0:num(row.t0),t1:num(row.t1),roads,searchText,
    periode:[planningPeriodLabel(row.t0),planningPeriodLabel(row.t1)].filter(Boolean).join(' – ')
  };
}

function compactPlanning(planning){
  if(!planning)return null;
  return {
    bestand:planning.bestand||planning.naam||'geladen planning',
    t0:num(planning.t0),t1:num(planning.t1),shift:num(planning.shift)||0,
    nRel:Number(planning.nRel||0),nCross:Number(planning.nCross||0),
    activities:(planning.regels||[]).map(compactActivity),
    relations:(planning.relaties||[]).map(r=>({from:String(r.from??''),to:String(r.to??''),type:String(r.type??r.rel??'')}))
  };
}

function compactCapacity(capacity){
  if(!capacity)return null;
  return {
    geconfig:capacity.geconfig===true,nTaken:Number(capacity.nTaken||0),nMetFte:Number(capacity.nMetFte||0),totFte:num(capacity.totFte),
    quarters:(capacity.kwartalen||[]).map(q=>({label:q.label,jaar:q.jaar,q:q.q,tot:num(q.tot)||0,per:{...(q.per||{})}})),
    perDienst:Object.fromEntries(Object.entries(capacity.perDienst||{}).map(([k,v])=>[k,{piek:num(v.piek)||0,piekKw:v.piekKw||'',grens:num(v.grens)||0,overKw:Number(v.overKw||0)}]))
  };
}

function compactWork(row={}){
  return {
    id:String(row.id??''),weg:upper(row.weg),richting:String(row.richting??''),startMs:num(row.startMs),eindMs:num(row.eindMs),
    periode:row.periode||[row.startMs?new Date(row.startMs).toLocaleDateString('nl-NL'):'',row.eindMs?new Date(row.eindMs).toLocaleDateString('nl-NL'):''].filter(Boolean).join(' – '),
    hinder:String(row.hinder??''),afsluiting:String(row.afsluiting??''),extraMin:num(row.extraMin),omschrijving:String(row.omschrijving??row.werkzaamheden??''),
    status:String(row.status??''),vanHm:num(row.vanHm),totHm:num(row.totHm),assetKeys:[...(row.assetKeys||[])].map(String),
    routeRefs:[...(row.routeRefs||row.uRoutes||[])].map(String),routeMatches:[...(row.routeMatches||[])].map(String)
  };
}

function compactRoute(row={}){
  return {
    id:String(row.id??row.relationId??''),ref:String(row.ref??row.uRoute??row.relationId??''),naam:String(row.naam??row.routeNaam??''),
    weg:upper(row.weg??row.hoofdweg),richting:String(row.richting??''),vanHm:num(row.vanHm),totHm:num(row.totHm),
    statusPct:num(row.statusPct),volledig:String(row.volledig??''),relationUrl:String(row.relationUrl??''),
    assetKeys:[...(row.assetKeys||[])].map(String),werkRefs:[...(row.werkRefs||[])].map(String)
  };
}

function flattenSubprocesses(services=[]){
  const rows=[];
  for(const service of services){
    for(const sp of service.subprocessen||service.detail||[]){
      rows.push({
        serviceId:String(service.id),serviceName:String(service.naam||service.id),naam:String(sp.naam||''),
        aandeelDienst:num(sp.aandeelDienst??sp.w??sp.gewicht)||0,exact:sp.exact===true,
        beschikbaarheid:sp.besch??sp.loB??null,lo:sp.loB??null,hi:sp.hiB??null,
        bronnen:(sp.bronnen||[]).map(b=>({obj:String(b.obj||''),typeId:String(b.typeId||b.tp||''),gewicht:num(b.gewicht??b.w)||0,status:String(b.status||'')}))
      });
    }
  }
  return rows;
}

function serviceTypeLinks(subprocesses=[]){
  const grouped=new Map();
  for(const sp of subprocesses){
    for(const bron of sp.bronnen||[]){
      if(!bron.typeId)continue;
      const key=[sp.serviceId,bron.typeId].join('|');
      let item=grouped.get(key);
      if(!item){item={serviceId:sp.serviceId,serviceName:sp.serviceName,typeId:bron.typeId,gewicht:0,subprocesses:[]};grouped.set(key,item);}
      item.gewicht+=Math.max(0,Number(sp.aandeelDienst||0))*Math.max(0,Number(bron.gewicht||0));
      item.subprocesses.push({naam:sp.naam,aandeelDienst:sp.aandeelDienst,bronGewicht:bron.gewicht,status:bron.status});
    }
  }
  return [...grouped.values()].map(x=>({...x,gewicht:Math.round(x.gewicht*100000)/100000}));
}

function enrichFaults(faults=[],links=[]){
  const byType=new Map();
  for(const link of links){
    if(!byType.has(link.typeId))byType.set(link.typeId,[]);
    byType.get(link.typeId).push(link);
  }
  return faults.map(fault=>{
    const serviceLinks=(byType.get(String(fault.typeId||''))||[]).map(link=>({
      ...link,
      gewogenVerlies:Number.isFinite(Number(fault.bijdrageAvail))?Number(fault.bijdrageAvail)*Number(link.gewicht||0):null
    }));
    return {...fault,serviceLinks};
  });
}

function linkFunctions(services=[],functions=[],links=[]){
  const sBy=new Map(services.map(x=>[String(x.id),x])),fBy=new Map(functions.map(x=>[String(x.id),x]));
  return (links||[]).map((l,index)=>({
    id:String(l.id??index),serviceId:String(l.dienst??''),serviceName:String(sBy.get(String(l.dienst))?.naam||l.dienst||''),
    functionId:String(l.functie??''),functionName:String(fBy.get(String(l.functie))?.naam||l.functie||''),eigenaar:String(l.eigenaar??'')
  }));
}

function sourceInventory({dvm={},bi={},state={}}){
  return [
    ['assetregister',!!state.dvm?.assetregister,Number(state.dvm?.assetregister?.rijen?.length||0)],
    ['openStoringen',Array.isArray(state.dvm?.liveStoringen)&&state.dvm.liveStoringen.length>0,(state.dvm?.liveStoringen||[]).reduce((s,b)=>s+Number(b.rijen?.length||0),0)],
    ['storingshistorie',Array.isArray(state.dvm?.storingshistorie)&&state.dvm.storingshistorie.length>0,(state.dvm?.storingshistorie||[]).reduce((s,b)=>s+Number(b.rijen?.length||0),0)],
    ['dripHistorie',!!state.dvm?.dripHistorie,(state.dvm?.dripHistorie?.sources||[]).reduce((s,b)=>s+Number(b.incidenten?.length||0),0)],
    ['uRoutes',!!state.dvm?.uRoutes,Number(state.dvm?.uRoutes?.rijen?.length||dvm.uroutes?.length||0)],
    ['werkzaamheden',!!state.dvm?.werkzaamheden,Number(state.dvm?.werkzaamheden?.rijen?.length||dvm.works?.length||0)],
    ['planning',!!state.planning,Number(bi.planning?.activities?.length||0)],
    ['biData',!!state.bi,Number(functionsLength(bi.functions))]
  ].map(([id,loaded,count])=>({id,loaded,count}));
}
function functionsLength(v){return Array.isArray(v)?v.length:0;}

export function buildBiDashContext({faults=[],assets=[],roads=[],services=[],functions=[],dvm={},bi={},links=[],state={}}={}){
  const richServices=(dvm.services?.length?dvm.services:services)||[];
  const subprocesses=flattenSubprocesses(richServices);
  const typeLinks=serviceTypeLinks(subprocesses);
  const planning=compactPlanning(bi.planning||null);
  const capacity=compactCapacity(bi.capacity||null);
  const works=(dvm.works||[]).map(compactWork);
  const uroutes=(dvm.uroutes||[]).map(compactRoute);
  const enrichedFaults=enrichFaults(faults,typeLinks);
  const serviceFunctionLinks=linkFunctions(richServices,functions,links);
  return {
    faults:enrichedFaults,assets:[...assets],roads:[...roads],services:richServices,functions:[...functions],
    subprocesses,serviceTypeLinks:typeLinks,serviceFunctionLinks,
    planning,capacity,works,uroutes,
    eol:dvm.eol||{source:'assetregister',loaded:!!state.dvm?.assetregister,count:0},historySources:dvm.historySources||[],dripHistory:dvm.dripHistory||null,
    dvmTypes:dvm.types||{},signals:[...(bi.triggers||[]),...(dvm.triggers||[])],
    peildatum:dvm.peildatum||null,biPeildatum:bi.peildatum||null,
    sources:sourceInventory({dvm,bi:{...bi,planning,functions},state}),
    stateHistory:Array.isArray(state.history)?state.history:[],
    quality:state.qualityAudit||null
  };
}

export function faultsForService(context,serviceId){
  const id=String(serviceId??'');
  return (context?.faults||[]).map(fault=>{
    const links=(fault.serviceLinks||[]).filter(l=>String(l.serviceId)===id);
    if(!links.length)return null;
    return {...fault,serviceLinks:links,serviceGewicht:links.reduce((s,l)=>s+Number(l.gewicht||0),0),
      gewogenVerlies:links.reduce((s,l)=>s+(Number(l.gewogenVerlies)||0),0)};
  }).filter(Boolean);
}

export function planningForRoad(context,road){
  const key=upper(road);if(!key)return context?.planning?.activities||[];
  return (context?.planning?.activities||[]).filter(a=>a.roads.includes(key)||upper(a.naam).includes(key)||upper(a.code).includes(key));
}

export function worksForFaults(context,faults=[]){
  const keys=new Set(faults.map(f=>String(f.assetKey||'')).filter(Boolean)),roads=new Set(faults.map(f=>upper(f.weg)).filter(Boolean));
  return (context?.works||[]).filter(w=>(w.assetKeys||[]).some(k=>keys.has(String(k)))||(w.weg&&roads.has(upper(w.weg))));
}

export function planningForFaults(context,faults=[]){
  const roads=new Set(faults.map(f=>upper(f.weg)).filter(Boolean));
  return (context?.planning?.activities||[]).filter(a=>(a.roads||[]).some(r=>roads.has(upper(r))));
}
