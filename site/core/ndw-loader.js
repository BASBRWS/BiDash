const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_NDW_LOADER_ACTIVE__)return;
  if(typeof ndw69Summary!=='function'||typeof kostenDagRows!=='function')return;

  const originalSummary=ndw69Summary;
  const DEFAULT_BRON='NDW verkeersintensiteit; hinderuren: spits 07:00–10:00 en 16:00–19:00; generieke snelheidsreductie 30%';

  function loaderHtml(){
    return '<div class="bidash-ndw-loader" style="margin:12px 0;padding:12px;background:#fff;border:1px solid #b7c9d8;border-radius:6px">'
      +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="tb-btn primary" id="bidashNdwLoadButton" onclick="bidashLaadNdw()">Laad NDW</button><span class="muted">Laadt verkeersintensiteiten en vult automatisch 6 spitsuren en 30% snelheidsreductie.</span></div>'
      +'<input id="bidashNdwSourceFile" type="file" accept=".json,.html,.htm" style="display:none" onchange="bidashNdwBestand(this)">'
      +'<div id="bidashNdwProgress" style="margin-top:8px;display:none"><div style="height:8px;background:#dbe5ec;border-radius:6px;overflow:hidden"><span id="bidashNdwProgressBar" style="display:block;height:100%;width:0;background:#007bc7;transition:width .15s"></span></div><div id="bidashNdwProgressLabel" style="font-size:12px;margin-top:5px">Nog niet gestart</div></div>'
      +'</div>';
  }

  function inject(html){
    const block=loaderHtml();
    const m=String(html||'').match(/<h3>NDW[^<]*<\/h3>/i);
    return m?html.replace(m[0],m[0]+block):block+html;
  }
  ndw69Summary=function(rows){return inject(originalSummary(rows));};

  function setProgress(pct,label,error){
    const root=document.getElementById('bidashNdwProgress'),bar=document.getElementById('bidashNdwProgressBar'),text=document.getElementById('bidashNdwProgressLabel');
    if(root)root.style.display='block';
    if(bar){bar.style.width=Math.max(0,Math.min(100,Number(pct)||0))+'%';bar.style.background=error?'#d52b1e':'#007bc7';}
    if(text)text.textContent=label||'';
  }
  function buttonBusy(busy){const b=document.getElementById('bidashNdwLoadButton');if(b)b.disabled=!!busy;}
  function hasValue(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));}
  function pause(){return new Promise(resolve=>setTimeout(resolve,0));}

  function readStoredWorkspace(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('bidash-integraal',1);
      req.onerror=()=>reject(req.error||new Error('Lokale werkruimte kon niet worden geopend.'));
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('workspace'))req.result.createObjectStore('workspace');};
      req.onsuccess=()=>{
        const db=req.result;let tx;
        try{tx=db.transaction('workspace');}catch(error){db.close();reject(error);return;}
        const get=tx.objectStore('workspace').get('current');
        get.onsuccess=()=>{const value=get.result;db.close();resolve(value);};
        get.onerror=()=>{const error=get.error;db.close();reject(error);};
      };
    });
  }
  function snapshotFromWorkspace(state){
    return state?.dvm?.parameters?.kosten?.ndw69Snapshot||state?.delen?.dvm?.parameters?.kosten?.ndw69Snapshot||state?.parameters?.kosten?.ndw69Snapshot||state?.kosten?.ndw69Snapshot||state?.ndw69Snapshot||null;
  }

  function parseJsonWorker(text){
    return new Promise((resolve,reject)=>{
      if(typeof Worker==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined'){
        try{resolve(JSON.parse(text));}catch(error){reject(error);}return;
      }
      const src='onmessage=function(e){try{postMessage({ok:true,value:JSON.parse(e.data)})}catch(err){postMessage({ok:false,error:err&&err.message||String(err)})}}';
      const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
      const worker=new Worker(url);
      worker.onmessage=e=>{worker.terminate();URL.revokeObjectURL(url);e.data&&e.data.ok?resolve(e.data.value):reject(new Error(e.data?.error||'NDW JSON kon niet worden gelezen.'));};
      worker.onerror=e=>{worker.terminate();URL.revokeObjectURL(url);reject(new Error(e.message||'NDW JSON worker is gestopt.'));};
      worker.postMessage(text);
    });
  }

  async function snapshotFromFile(file){
    const chunkSize=1024*1024;let offset=0,carry='',found=false,depth=0,inString=false,escaped=false,done=false,parts=[];
    function startIndex(text){
      const markers=['"ndw69Snapshot"','const NDW69_DATA'];let best=-1;
      markers.forEach(marker=>{const p=text.indexOf(marker);if(p>=0&&(best<0||p<best))best=p;});
      return best;
    }
    function feed(text){
      let last=0;
      for(let i=0;i<text.length;i++){
        const ch=text[i];
        if(inString){
          if(escaped){escaped=false;continue;}
          if(ch==='\\'){escaped=true;continue;}
          if(ch==='"')inString=false;
          continue;
        }
        if(ch==='"'){inString=true;continue;}
        if(ch==='{')depth++;
        else if(ch==='}'){
          depth--;
          if(depth===0){parts.push(text.slice(last,i+1));done=true;return;}
        }
      }
      parts.push(text.slice(last));
    }

    while(offset<file.size&&!done){
      const end=Math.min(file.size,offset+chunkSize),text=await file.slice(offset,end).text();offset=end;
      if(!found){
        const joined=carry+text,p=startIndex(joined);
        if(p>=0){
          const objectStart=joined.indexOf('{',p);
          if(objectStart>=0){found=true;feed(joined.slice(objectStart));}
          else carry=joined.slice(Math.max(0,p));
        }else carry=joined.slice(-512);
      }else feed(text);
      const pct=Math.min(65,5+Math.round((offset/Math.max(1,file.size))*55));
      setProgress(pct,'NDW bronbestand lezen: '+Math.round(offset/1024/1024)+' van '+Math.round(file.size/1024/1024)+' MB');
      await pause();
    }
    if(!found||!done)throw new Error('In dit bestand is geen complete NDW-meetdataset gevonden. Kies een BiDash/DVM-export waarin NDW-verkeersdata zit.');
    setProgress(68,'NDW-meetdataset in achtergrond controleren…');
    const snapshot=await parseJsonWorker(parts.join(''));
    if(!snapshot||!Array.isArray(snapshot.sites)||!snapshot.sites.length)throw new Error('De gevonden NDW-meetdataset bevat geen meetlocaties.');
    return snapshot;
  }

  async function applySnapshot(snapshot,bronNaam){
    if(typeof ndw69ValidateData==='function')ndw69ValidateData(snapshot);
    const c=kostenBasis();c.ndw69Snapshot=snapshot;c.scenario67={...(c.scenario67||{})};
    if(!hasValue(c.scenario67.uren))c.scenario67.uren=6;
    if(!hasValue(c.scenario67.reductie))c.scenario67.reductie=30;
    if(!String(c.scenario67.bron||'').trim())c.scenario67.bron=DEFAULT_BRON;
    c.scenario67.status='scenario';RULES.kosten=c;

    const rows=kostenDagRows();
    setProgress(70,snapshot.sites.length.toLocaleString('nl-NL')+' NDW-meetlocaties gevonden. '+rows.length.toLocaleString('nl-NL')+' wegdelen koppelen…');
    const perRoad={...(c.scenarioWegen67||{})},choices={...(c.ndw69||{})};let matched=0,unmatched=0;
    for(let i=0;i<rows.length;i++){
      const w=rows[i],link=ndw69Link(w),local={...(perRoad[w.key]||{})};
      if(!hasValue(local.uren))local.uren=6;
      if(!hasValue(local.reductie))local.reductie=30;
      if(!String(local.bron||'').trim())local.bron=DEFAULT_BRON;
      local.status='scenario';
      if(link?.s&&link.s.q!==null&&link.s.q!==undefined&&Number.isFinite(Number(link.s.q))){
        local.q='';local.ndwAuto=true;
        choices[w.key]={...(choices[w.key]||{}),siteId:link.s.id,disabled:false,confirmed:false,confirmationKey:''};matched++;
      }else unmatched++;
      perRoad[w.key]=local;
      if(i%8===0||i===rows.length-1){
        const pct=70+Math.round(((i+1)/Math.max(1,rows.length))*28);
        setProgress(pct,'Wegdelen koppelen: '+(i+1)+' van '+rows.length+'. '+matched+' met NDW-meting.');await pause();
      }
    }
    c.scenarioWegen67=perRoad;c.ndw69=choices;RULES.kosten=c;
    if(typeof SC67_CACHE!=='undefined')SC67_CACHE={fingerprint:'',routes:{},busy:false,error:''};
    globalThis.__BIDASH_LAST_NDW_LOAD__={tijd:new Date().toISOString(),bron:bronNaam||'lokaal',sites:snapshot.sites.length,wegdelen:rows.length,gekoppeld:matched,nietGekoppeld:unmatched,hinderuren:6,snelheidsreductie:30};
    setProgress(100,'Gereed. '+matched+' van '+rows.length+' wegdelen hebben een NDW-intensiteit. Hinderuren 6, snelheidsreductie 30%.');
    if(typeof kostenDagVervers==='function')kostenDagVervers();
    try{if(parent!==globalThis)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:'ndw'},location.origin);}catch(error){}
  }

  globalThis.bidashLaadNdw=async function(){
    buttonBusy(true);
    try{
      setProgress(2,'NDW-verkeersdata zoeken in de huidige en lokaal opgeslagen werkruimte…');
      let snapshot=(typeof ndw69Data==='function'&&ndw69Data()?.sites?.length)?ndw69Data():null;
      if(!snapshot){try{snapshot=snapshotFromWorkspace(await readStoredWorkspace());}catch(error){console.warn(error);}}
      if(snapshot&&Array.isArray(snapshot.sites)&&snapshot.sites.length){await applySnapshot(snapshot,'lokale werkruimte');return;}
      setProgress(4,'Geen lokale NDW-set gevonden. Kies een eerdere BiDash/DVM-export met NDW-data.');
      const input=document.getElementById('bidashNdwSourceFile');if(input){input.value='';input.click();}
    }catch(error){console.error(error);setProgress(100,error.message||String(error),true);alert(error.message||String(error));}
    finally{buttonBusy(false);}
  };

  globalThis.bidashNdwBestand=async function(input){
    const file=input?.files?.[0];if(!file)return;
    buttonBusy(true);
    try{setProgress(5,'NDW-data uit '+file.name+' halen…');const snapshot=await snapshotFromFile(file);await applySnapshot(snapshot,file.name);}
    catch(error){console.error(error);setProgress(100,error.message||String(error),true);alert(error.message||String(error));}
    finally{if(input)input.value='';buttonBusy(false);}
  };

  globalThis.__BIDASH_NDW_LOADER_ACTIVE__=true;
})();`;

export function installNdwLoader(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_NDW_LOADER_ACTIVE__)return true;
  try{scope.eval(PATCH_SOURCE);return !!scope.__BIDASH_NDW_LOADER_ACTIVE__;}
  catch(error){console.error('BiDash NDW-laadknop kon niet worden gestart.',error);return false;}
}
