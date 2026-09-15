const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_NDW_LOADER_ACTIVE__)return;
  if(typeof ndw69Summary!=='function'||typeof kostenDagRows!=='function')return;

  const originalSummary=ndw69Summary;
  const DEFAULT_BRON='NDW verkeersintensiteit; hinderuren: spits 07:00–10:00 en 16:00–19:00; generieke snelheidsreductie 30%';

  function loaderHtml(){
    return '<div class="bidash-ndw-loader" style="margin:12px 0;padding:12px;background:#fff;border:1px solid #b7c9d8;border-radius:6px">'
      +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="tb-btn primary" id="bidashNdwLoadButton" onclick="bidashLaadNdw()">Laad NDW</button><span id="bidashNdwLoadText" class="muted">Koppel opgeslagen NDW-metingen aan alle huidige wegdelen.</span></div>'
      +'<div id="bidashNdwProgress" style="margin-top:8px;display:none">'
      +'<div style="height:8px;background:#dbe5ec;border-radius:6px;overflow:hidden"><span id="bidashNdwProgressBar" style="display:block;height:100%;width:0;background:#007bc7;transition:width .15s"></span></div>'
      +'<div id="bidashNdwProgressLabel" style="font-size:12px;margin-top:5px">Nog niet gestart</div></div>'
      +'</div>';
  }

  function inject(html){
    const block=loaderHtml();
    const m=String(html||'').match(/<h3>NDW[^<]*<\/h3>/i);
    if(!m)return block+html;
    return html.replace(m[0],m[0]+block);
  }

  ndw69Summary=function(rows){return inject(originalSummary(rows));};

  function setProgress(pct,label,error){
    const root=document.getElementById('bidashNdwProgress');
    const bar=document.getElementById('bidashNdwProgressBar');
    const text=document.getElementById('bidashNdwProgressLabel');
    if(root)root.style.display='block';
    if(bar){bar.style.width=Math.max(0,Math.min(100,Number(pct)||0))+'%';bar.style.background=error?'#d52b1e':'#007bc7';}
    if(text)text.textContent=label||'';
  }

  function readStoredWorkspace(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('bidash-integraal',1);
      req.onerror=()=>reject(req.error||new Error('Lokale werkruimte kon niet worden geopend.'));
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('workspace'))req.result.createObjectStore('workspace');};
      req.onsuccess=()=>{
        const db=req.result;
        let tx;
        try{tx=db.transaction('workspace');}
        catch(error){db.close();reject(error);return;}
        const get=tx.objectStore('workspace').get('current');
        get.onsuccess=()=>{const value=get.result;db.close();resolve(value);};
        get.onerror=()=>{const error=get.error;db.close();reject(error);};
      };
    });
  }

  function snapshotFromWorkspace(state){
    return state?.dvm?.parameters?.kosten?.ndw69Snapshot
      ||state?.delen?.dvm?.parameters?.kosten?.ndw69Snapshot
      ||state?.parameters?.kosten?.ndw69Snapshot
      ||state?.kosten?.ndw69Snapshot
      ||state?.ndw69Snapshot
      ||null;
  }

  function hasValue(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));}
  function pause(){return new Promise(resolve=>setTimeout(resolve,0));}

  globalThis.bidashLaadNdw=async function(){
    const button=document.getElementById('bidashNdwLoadButton');
    if(button)button.disabled=true;
    try{
      setProgress(2,'NDW-verkeersdata zoeken in de lokale werkruimte…');
      let snapshot=(typeof ndw69Data==='function'&&ndw69Data()?.sites?.length)?ndw69Data():null;
      if(!snapshot){
        const workspace=await readStoredWorkspace();
        snapshot=snapshotFromWorkspace(workspace);
      }
      if(!snapshot||!Array.isArray(snapshot.sites)||!snapshot.sites.length){
        throw new Error('Geen opgeslagen NDW-meetdataset gevonden. De oude verkeersdataset moet één keer opnieuw als NDW-bron beschikbaar worden gemaakt.');
      }

      if(typeof ndw69ValidateData==='function')ndw69ValidateData(snapshot);
      const c=kostenBasis();
      c.ndw69Snapshot=snapshot;
      c.scenario67={...(c.scenario67||{})};
      if(!hasValue(c.scenario67.uren))c.scenario67.uren=6;
      if(!hasValue(c.scenario67.reductie))c.scenario67.reductie=30;
      if(!String(c.scenario67.bron||'').trim())c.scenario67.bron=DEFAULT_BRON;
      c.scenario67.status='scenario';
      RULES.kosten=c;

      const rows=kostenDagRows();
      setProgress(8,`${snapshot.sites.length.toLocaleString('nl-NL')} NDW-meetlocaties gevonden. ${rows.length.toLocaleString('nl-NL')} wegdelen koppelen…`);
      const perRoad={...(c.scenarioWegen67||{})};
      const choices={...(c.ndw69||{})};
      let matched=0,unmatched=0;

      for(let i=0;i<rows.length;i++){
        const w=rows[i],link=ndw69Link(w),local={...(perRoad[w.key]||{})};
        if(!hasValue(local.uren))local.uren=6;
        if(!hasValue(local.reductie))local.reductie=30;
        if(!String(local.bron||'').trim())local.bron=DEFAULT_BRON;
        local.status='scenario';
        if(link?.s&&link.s.q!==null&&link.s.q!==undefined&&Number.isFinite(Number(link.s.q))){
          local.q='';
          local.ndwAuto=true;
          choices[w.key]={...(choices[w.key]||{}),siteId:link.s.id,disabled:false,confirmed:false,confirmationKey:''};
          matched++;
        }else{
          unmatched++;
        }
        perRoad[w.key]=local;
        if(i%8===0||i===rows.length-1){
          const pct=8+Math.round(((i+1)/Math.max(1,rows.length))*86);
          setProgress(pct,`Wegdelen koppelen: ${i+1} van ${rows.length}. ${matched} met NDW-meting.`);
          await pause();
        }
      }

      c.scenarioWegen67=perRoad;
      c.ndw69=choices;
      RULES.kosten=c;
      if(typeof SC67_CACHE!=='undefined')SC67_CACHE={fingerprint:'',routes:{},busy:false,error:''};
      globalThis.__BIDASH_LAST_NDW_LOAD__={
        tijd:new Date().toISOString(),
        sites:snapshot.sites.length,
        wegdelen:rows.length,
        gekoppeld:matched,
        nietGekoppeld:unmatched,
        hinderuren:6,
        snelheidsreductie:30
      };
      setProgress(100,`Gereed. ${matched} van ${rows.length} wegdelen hebben een NDW-intensiteit. Hinderuren 6, snelheidsreductie 30%.`);
      if(typeof kostenDagVervers==='function')kostenDagVervers();
      try{if(parent!==globalThis)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:'ndw'},location.origin);}catch(error){}
    }catch(error){
      console.error(error);
      setProgress(100,error.message||String(error),true);
      alert(error.message||String(error));
    }finally{
      if(button)button.disabled=false;
    }
  };

  globalThis.__BIDASH_NDW_LOADER_ACTIVE__=true;
})();`;

export function installNdwLoader(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_NDW_LOADER_ACTIVE__)return true;
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_NDW_LOADER_ACTIVE__;
  }catch(error){
    console.error('BiDash NDW-laadknop kon niet worden gestart.',error);
    return false;
  }
}
