/* Aparte referentielijsten voor speciale DRIP-groepen.
   Deze lijsten zijn classificatiebronnen, geen storingshistorie. Ze koppelen
   uitsluitend kenmerken aan bestaande DRIP-assets zodat actuele open storingen
   gericht op Windwaarschuwing en RIA4 gefilterd kunnen worden. */
(() => {
  const EMPTY=()=>({bestand:'',geladenOp:'',rijen:0,identifiers:[],matchedAssets:0,matchedDrips:0,unmatched:[],unmatchedCount:0});
  const SPECIAL=window.DVM_SPECIAL_DRIP_LISTS||{wind:EMPTY(),ria4:EMPTY()};
  window.DVM_SPECIAL_DRIP_LISTS=SPECIAL;

  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  const normHeader=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const HEADER_ALIASES=new Set([
    'entityid','entity id','asset id','assetid','object id','objectid','id','asset','assetnaam','asset naam','naam','name','object','objectnaam','object naam',
    'drip','drip id','drip code','dripcode','dynac','drip dynac','drip dynac id','cdms','drip cdms','drip cdms id','id cdms','id dynac','code','os id','osid'
  ].map(normHeader));
  const tokenOk=t=>t&&t.length>=3&&!/^\d{1,2}$/.test(t);

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
  function objectTokens(x){
    const vals=[x?.entityid,x?.id,x?.key,x?.naam,x?.asset,x?.code,x?.idCdms,x?.histCode,x?.uid,x?.osid,x?.logId,x?.dynac,x?.cdms];
    const out=new Set();
    for(const v of vals){const t=norm(v);if(tokenOk(t))out.add(t);}
    return out;
  }
  function hasToken(x,set){for(const t of objectTokens(x))if(set.has(t))return true;return false;}

  function currentAssets(){try{return ASSET_REGISTER_STATE?.assets||[];}catch(e){return [];}}
  function currentDrips(){try{return DRIP_STATE?.drips||[];}catch(e){return [];}}

  function applyOne(kind){
    const data=SPECIAL[kind]||EMPTY(),set=new Set((data.identifiers||[]).map(x=>norm(x.token||x.raw||x)).filter(tokenOk));
    const prop=kind==='wind'?'specialWind':'specialRia4';
    const assets=currentAssets(),drips=currentDrips();
    let ma=0,md=0;
    for(const a of assets){a[prop]=set.size?hasToken(a,set):false;if(a[prop])ma++;}
    for(const d of drips){d[prop]=set.size?hasToken(d,set):false;if(d[prop])md++;}
    data.matchedAssets=ma;data.matchedDrips=md;
    const matchedTokens=new Set();
    for(const x of [...assets,...drips])if(x[prop])for(const t of objectTokens(x))if(set.has(t))matchedTokens.add(t);
    const unmatched=(data.identifiers||[]).filter(x=>!matchedTokens.has(norm(x.token||x.raw||x)));
    data.unmatchedCount=unmatched.length;data.unmatched=unmatched.slice(0,250).map(x=>x.raw||x.token||String(x));
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
      const ids=uniqIds(rows);
      if(!ids.length)throw new Error('Geen herkenbare DRIP-code, asset-id, Dynac- of CDMS-kolom gevonden.');
      SPECIAL[kind]={bestand:file.name,geladenOp:new Date().toISOString(),rijen:rows.length,identifiers:ids,matchedAssets:0,matchedDrips:0,unmatched:[],unmatchedCount:0};
      progress(file,84,`${label}-DRIP’s koppelen aan All Assets`);
      const result=applyOne(kind);
      try{ANALYSE_SIGNATURE='';}catch(e){}
      try{if(typeof probeerAnalyseActiveren==='function')probeerAnalyseActiveren('drips');}catch(e){}
      try{if(typeof renderDataGereedheid==='function')renderDataGereedheid();}catch(e){}
      klaar(file,`${label}: ${ids.length} referenties, ${result.matchedAssets} assets gekoppeld.`);
      return {...SPECIAL[kind]};
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
    const clean=k=>{const x=SPECIAL[k]||EMPTY();return {bestand:x.bestand||'',geladenOp:x.geladenOp||'',rijen:Number(x.rijen)||0,identifiers:(x.identifiers||[]).map(i=>({raw:i.raw||String(i),token:norm(i.token||i.raw||i),kolom:i.kolom||''})).filter(i=>tokenOk(i.token))};};
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
