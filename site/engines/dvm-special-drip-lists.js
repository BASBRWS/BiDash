/* Aparte referentielijsten voor speciale DRIP-groepen.
   Deze lijsten zijn classificatiebronnen, geen storingshistorie. Ze koppelen
   uitsluitend kenmerken aan bestaande DRIP-assets zodat actuele open storingen
   gericht op Windwaarschuwing en RIA4 gefilterd kunnen worden. */
(() => {
  const EMPTY=()=>({bestand:'',geladenOp:'',rijen:0,identifiers:[],records:[],matchedAssets:0,matchedDrips:0,unmatched:[],unmatchedCount:0});
  const SPECIAL=window.DVM_SPECIAL_DRIP_LISTS||{wind:EMPTY(),ria4:EMPTY()};
  window.DVM_SPECIAL_DRIP_LISTS=SPECIAL;

  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  const normHeader=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const HEADER_ALIASES=new Set([
    'entityid','entity id','asset id','assetid','object id','objectid','id','asset','assetnaam','asset naam','naam','name','object','objectnaam','object naam',
    'drip','drip id','drip code','dripcode','dynac','drip dynac','drip dynac id','cdms','drip cdms','drip cdms id','id cdms','id dynac','code','os id','osid'
  ].map(normHeader));
  const tokenOk=t=>t&&t.length>=3&&!/^\d{1,2}$/.test(t);
  const yes=v=>v===true||v===1||/^(1|ja|yes|true|x|aan|actief)$/i.test(String(v??'').trim());
  const WIND_HEADERS=new Set(['wind','windwaarschuwing','wind waarschuwing','winddrip','wind drip'].map(normHeader));
  const RIA4_HEADERS=new Set(['ria4','ria 4','ria-4','ria_4'].map(normHeader));
  const CATEGORY_HEADERS=new Set(['categorie','category','classificatie','classification','groep','group','functie','function'].map(normHeader));

  function progress(file,pct,fase,opties={}){
    try{if(typeof zetImportVoortgang==='function')zetImportVoortgang(file?.name||'DRIP-referentielijst',pct,fase,{actief:opties.actief!==false,fout:!!opties.fout,direct:true});}catch(e){}
  }
  function klaar(file,fase){try{if(typeof importKlaar==='function')importKlaar(file?.name||'DRIP-referentielijst',fase);}catch(e){progress(file,100,fase,{actief:false});}}

  function rowIds(row){
    const ids=[];
    for(const [k,v] of Object.entries(row||{})){
      const h=normHeader(k);if(!HEADER_ALIASES.has(h))continue;
      const vals=Array.isArray(v)?v:String(v??'').split(/[;,|]/);
      for(const raw of vals){const s=String(raw??'').trim(),t=norm(s);if(s&&tokenOk(t))ids.push({raw:s,token:t,kolom:k});}
    }
    return ids;
  }
  function uniqIds(rows){
    const map=new Map();
    for(const row of rows)for(const id of rowIds(row))if(!map.has(id.token))map.set(id.token,id);
    return [...map.values()];
  }
  function firstValue(row,aliases){for(const [k,v] of Object.entries(row||{}))if(aliases.has(normHeader(k)))return v;return '';}
  function markerInfo(row){
    let hasWind=false,hasRia4=false,wind=false,ria4=false;
    for(const [k,v] of Object.entries(row||{})){
      const h=normHeader(k);
      if(WIND_HEADERS.has(h)){hasWind=true;wind=wind||yes(v);}
      if(RIA4_HEADERS.has(h)){hasRia4=true;ria4=ria4||yes(v);}
      if(CATEGORY_HEADERS.has(h)){
        const s=String(v??'');
        if(/wind\s*waarschuw/i.test(s)){hasWind=true;wind=true;}
        if(/\bria\s*[-_ ]?4\b/i.test(s)){hasRia4=true;ria4=true;}
      }
    }
    return {hasWind,hasRia4,wind,ria4};
  }
  function direction(v){const s=norm(v);if(['L','LI','LINKS'].includes(s))return 'L';if(['R','RE','RECHTS'].includes(s))return 'R';return s;}
  function vcCode(v){const s=norm(v).replace(/^VC/,'');return s==='WNN'?'NWN':s==='WNZ'?'ZWN':s;}
  function number(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null;}
  function rowLocation(row){
    const text=Object.values(row||{}).map(v=>String(v??'')).join(' ');
    const roadRaw=firstValue(row,new Set(['weg','wegnummer','road'].map(normHeader)));
    const dirRaw=firstValue(row,new Set(['richting','ri','direction'].map(normHeader)));
    const hmRaw=firstValue(row,new Set(['hm','hectometer','hectometrering','km'].map(normHeader)));
    const vc=String(firstValue(row,new Set(['vc','verkeerscentrale','regio'].map(normHeader)))||'').trim();
    const m=text.toUpperCase().match(/\b([AN]\s*\d{1,3})\s*([LR]|LI|RE)?\s*(\d{1,3}[,.]\d{1,3})\b/);
    return {vc:vcCode(vc),weg:norm(roadRaw||(m&&m[1])||'').replace(/^RW0*/,''),richting:direction(dirRaw||(m&&m[2])||''),hm:number(hmRaw||(m&&m[3]))};
  }
  function recordForRow(row){return {ids:rowIds(row),locatie:rowLocation(row),sheet:row?.__sheet||''};}
  function locationCompatible(a,b){
    if(a.weg&&b.weg&&a.weg!==b.weg)return false;
    if(a.richting&&b.richting&&direction(a.richting)!==direction(b.richting))return false;
    if(a.vc&&b.vc&&vcCode(a.vc)!==vcCode(b.vc))return false;
    if(a.hm!=null&&b.hm!=null&&Math.abs(a.hm-b.hm)>.5)return false;
    return true;
  }
  function matchesRecord(obj,record){
    const ids=new Set((record.ids||[]).map(x=>norm(x.token||x.raw||x)).filter(tokenOk));
    const tokens=objectTokens(obj),idMatch=[...tokens].some(t=>ids.has(t));
    const a=rowLocation(obj),b=record.locatie||{};
    if(idMatch)return locationCompatible(a,b);
    return !!(a.weg&&b.weg&&a.weg===b.weg&&a.richting&&b.richting&&direction(a.richting)===direction(b.richting)&&a.hm!=null&&b.hm!=null&&Math.abs(a.hm-b.hm)<=.35&&locationCompatible(a,b));
  }
  function recordIndex(records){
    const byId=new Map(),byLocation=new Map();
    const add=(map,key,r)=>{if(!key)return;const a=map.get(key)||[];a.push(r);map.set(key,a);};
    for(const r of records){
      for(const id of r.ids||[])add(byId,norm(id.token||id.raw||id),r);
      const l=r.locatie||{};if(l.weg&&l.richting)add(byLocation,l.weg+'|'+direction(l.richting),r);
    }
    return {byId,byLocation};
  }
  function candidateRecords(obj,index){
    const out=new Set();
    for(const t of objectTokens(obj))for(const r of index.byId.get(t)||[])out.add(r);
    const l=rowLocation(obj);if(l.weg&&l.richting)for(const r of index.byLocation.get(l.weg+'|'+direction(l.richting))||[])out.add(r);
    return [...out];
  }
  function classifiedRows(rows,requestedKind){
    const info=(rows||[]).map(row=>({row,marker:markerInfo(row)}));
    const hasWind=info.some(x=>x.marker.hasWind),hasRia4=info.some(x=>x.marker.hasRia4),explicit=hasWind||hasRia4;
    if(!explicit)return {explicit:false,hasWind:false,hasRia4:false,wind:requestedKind==='wind'?rows:[],ria4:requestedKind==='ria4'?rows:[]};
    return {explicit:true,hasWind,hasRia4,wind:info.filter(x=>x.marker.wind).map(x=>x.row),ria4:info.filter(x=>x.marker.ria4).map(x=>x.row)};
  }
  window.__BIDASH_SPECIAL_DRIP_CLASSIFICATION__={markerInfo,rowLocation,classifiedRows,recordForRow,matchesRecord,recordIndex,candidateRecords};
  function objectTokens(x){
    const vals=[x?.entityid,x?.id,x?.key,x?.naam,x?.asset,x?.code,x?.idCdms,x?.histCode,x?.uid,x?.osid,x?.logId,x?.dynac,x?.cdms];
    const out=new Set();
    for(const v of vals){const t=norm(v);if(tokenOk(t))out.add(t);}
    return out;
  }
  function currentAssets(){try{return ASSET_REGISTER_STATE?.assets||[];}catch(e){return [];}}
  function currentDrips(){try{return DRIP_STATE?.drips||[];}catch(e){return [];}}

  function applyOne(kind){
    const data=SPECIAL[kind]||EMPTY();
    const records=(data.records||[]).length?data.records:(data.identifiers||[]).map(id=>({ids:[id],locatie:{}}));
    const index=recordIndex(records),match=x=>candidateRecords(x,index).some(r=>matchesRecord(x,r));
    const prop=kind==='wind'?'specialWind':'specialRia4';
    const assets=currentAssets(),drips=currentDrips();
    let ma=0,md=0;
    const intrinsic=x=>kind==='wind'?yes(x?.sourceWind)||yes(x?.wind)||yes(x?.windwaarschuwing):yes(x?.sourceRia4)||yes(x?.ria4);
    for(const a of assets){a[prop]=intrinsic(a)||match(a);if(a[prop])ma++;}
    for(const d of drips){d[prop]=intrinsic(d)||match(d);if(d[prop])md++;}
    data.matchedAssets=ma;data.matchedDrips=md;
    const matchedRecords=new Set();for(const x of [...assets,...drips])for(const r of candidateRecords(x,index))if(matchesRecord(x,r))matchedRecords.add(r);
    const unmatched=records.filter(r=>!matchedRecords.has(r));
    data.unmatchedCount=unmatched.length;data.unmatched=unmatched.slice(0,250).map(r=>r.ids?.[0]?.raw||[r.locatie?.weg,r.locatie?.richting,r.locatie?.hm].filter(v=>v!==''&&v!=null).join(' ')||'onbekende regel');
    return {matchedAssets:ma,matchedDrips:md,unmatched:unmatched.length};
  }
  function applyAll(){const wind=applyOne('wind'),ria4=applyOne('ria4');window.__BIDASH_SPECIAL_DRIP_LINK__={wind,ria4,bijgewerkt:new Date().toISOString()};return window.__BIDASH_SPECIAL_DRIP_LINK__;}
  window.applyDripSpecialLists=applyAll;

  async function workbookRows(file){
    if(!window.XLSX)throw new Error('Excel-lezer is niet beschikbaar. Herlaad de pagina en probeer opnieuw.');
    progress(file,8,'Referentielijst lezen');
    let wb;
    if(/\.(csv|tsv|txt)$/i.test(file.name||'')){
      const text=await file.text();wb=XLSX.read(text,{type:'string',cellDates:true,raw:false});
    }else{
      const buf=await file.arrayBuffer();progress(file,28,'Werkmap openen');wb=XLSX.read(buf,{type:'array',cellDates:true,raw:false});
    }
    const rows=[],names=wb.SheetNames||[];
    for(let i=0;i<names.length;i++){
      const name=names[i],sheet=wb.Sheets[name],part=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
      part.forEach(r=>rows.push({...r,__sheet:name}));
      // Veel referentielijsten zijn bewust heel simpel: één kolom met DRIP-codes.
      // In dat geval lezen we ook zonder vaste kolomnaam, inclusief de eerste cel.
      const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
      const breedte=Math.max(0,...matrix.map(r=>Array.isArray(r)?r.filter(v=>String(v??'').trim()!=='').length:0));
      if(breedte===1){
        for(const r of matrix){const v=(r||[]).find(x=>String(x??'').trim()!=='');if(v==null)continue;const h=normHeader(v);if(HEADER_ALIASES.has(h))continue;rows.push({DRIP:v,__sheet:name,__singleColumn:true});}
      }
      progress(file,30+Math.round(((i+1)/Math.max(1,names.length))*35),`Werkblad ${i+1} van ${names.length} lezen`);
      await new Promise(r=>setTimeout(r,0));
    }
    return rows;
  }

  window.loadDripSpecialList=async function(kind,file){
    if(!['wind','ria4'].includes(kind))throw new Error('Onbekende DRIP-classificatiebron.');
    if(!file)throw new Error('Geen bestand gekozen.');
    const label=kind==='wind'?'Windwaarschuwing':'RIA4';
    try{
      const rows=await workbookRows(file);progress(file,72,`${label}-DRIP’s herkennen`);
      const split=classifiedRows(rows,kind),kinds=split.explicit?['wind','ria4'].filter(k=>k==='wind'?split.hasWind:split.hasRia4):[kind],results={};
      for(const k of kinds){
        const selected=split[k],records=selected.map(recordForRow).filter(r=>r.ids.length||(r.locatie.weg&&r.locatie.hm!=null)),ids=uniqIds(selected);
        if(!records.length&&k===kind)throw new Error(`Geen herkenbare ${k==='wind'?'windwaarschuwing':'RIA4'}-DRIP-regels gevonden.`);
        SPECIAL[k]={bestand:file.name,geladenOp:new Date().toISOString(),rijen:selected.length,identifiers:ids,records,matchedAssets:0,matchedDrips:0,unmatched:[],unmatchedCount:0};
        results[k]=applyOne(k);
      }
      progress(file,84,`${split.explicit?'RIA4 en windwaarschuwing':'De gekozen DRIP-groep'} koppelen aan All Assets`);
      try{ANALYSE_SIGNATURE='';}catch(e){}
      try{if(typeof probeerAnalyseActiveren==='function')probeerAnalyseActiveren('drips');}catch(e){}
      try{if(typeof renderDataGereedheid==='function')renderDataGereedheid();}catch(e){}
      const tekst=kinds.map(k=>`${k==='wind'?'Windwaarschuwing':'RIA4'}: ${SPECIAL[k].identifiers.length} referenties, ${results[k].matchedAssets} assets`).join(' · ');
      klaar(file,tekst+' gekoppeld.');
      return {...SPECIAL[kind],beideClassificaties:split.explicit};
    }catch(error){progress(file,null,error.message||String(error),{actief:false,fout:true});throw error;}
  };

  window.clearDripSpecialList=function(kind){
    if(!['wind','ria4'].includes(kind))return false;
    SPECIAL[kind]=EMPTY();applyOne(kind);
    try{ANALYSE_SIGNATURE='';}catch(e){}
    try{if(typeof probeerAnalyseActiveren==='function')probeerAnalyseActiveren('drips');}catch(e){}
    try{if(typeof renderDataGereedheid==='function')renderDataGereedheid();}catch(e){}
    return true;
  };

  function exportState(){
    const clean=k=>{const x=SPECIAL[k]||EMPTY();return {bestand:x.bestand||'',geladenOp:x.geladenOp||'',rijen:Number(x.rijen)||0,identifiers:(x.identifiers||[]).map(i=>({raw:i.raw||String(i),token:norm(i.token||i.raw||i),kolom:i.kolom||''})).filter(i=>tokenOk(i.token)),records:(x.records||[]).map(r=>({ids:(r.ids||[]).map(i=>({raw:i.raw||String(i),token:norm(i.token||i.raw||i),kolom:i.kolom||''})).filter(i=>tokenOk(i.token)),locatie:r.locatie||{},sheet:r.sheet||''}))};};
    return {wind:clean('wind'),ria4:clean('ria4')};
  }
  window.getDripSpecialListsExport=exportState;
  window.restoreDripSpecialLists=function(data){
    if(!data||typeof data!=='object')return false;
    for(const k of ['wind','ria4'])if(data[k])SPECIAL[k]={...EMPTY(),...data[k],identifiers:Array.isArray(data[k].identifiers)?data[k].identifiers:[]};
    applyAll();return true;
  };

  if(typeof totaalExportBundle==='function'){
    const originalExport=totaalExportBundle;
    totaalExportBundle=function(){
      const bundle=originalExport.apply(this,arguments);bundle.parameters=bundle.parameters||{};bundle.parameters.dripSpecialLists=exportState();return bundle;
    };
  }

  applyAll();
})();
