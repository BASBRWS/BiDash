export function clampProgress(value){
  if(value==null||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;
}

export function overallReadPercent(totalBytes,offsetBytes,loadedBytes){
  const total=Math.max(0,Number(totalBytes)||0);
  if(!total)return null;
  const done=Math.max(0,Number(offsetBytes)||0)+Math.max(0,Number(loadedBytes)||0);
  return Math.max(0,Math.min(100,done/total*100));
}

export function progressBarPercent(readPct){
  const p=clampProgress(readPct);
  return p==null?null:5+p*.73;
}

function install(scope){
  if(!scope?.document||scope.__BIDASH_LOAD_PROGRESS_ACTIVE__)return false;
  const doc=scope.document;
  const status=doc.getElementById('status');
  if(!status)return false;

  const style=doc.createElement('style');
  style.id='bidash-load-progress-style';
  style.textContent=`
    .load-progress{margin:0 32px 10px;padding:10px 12px;border:1px solid #bfd0df;border-radius:8px;background:#f4f8fc;color:#24445f;box-shadow:0 2px 10px #173b5710}
    .load-progress.error{border-color:#efbdc2;background:#fff2f3}.load-progress.done{border-color:#add6bd;background:#f2fbf5}
    .load-progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;font-weight:700}.load-progress-title{overflow-wrap:anywhere}.load-progress-pct{font-variant-numeric:tabular-nums;white-space:nowrap;color:#496478}
    .load-progress-track{height:9px;margin:7px 0;background:#dce5ed;border-radius:999px;overflow:hidden;position:relative}.load-progress-track>span{display:block;height:100%;width:0;background:#2d6e9d;border-radius:999px;transition:width .18s ease}
    .load-progress.indeterminate .load-progress-track>span{width:38%;animation:bidashLoadSlide 1.15s ease-in-out infinite}.load-progress.done .load-progress-track>span{background:#4b9b70}.load-progress.error .load-progress-track>span{background:#bd3b47}
    .load-progress-phase{font-size:11px;color:#62798c;line-height:1.4}.load-progress-detail{font-size:10px;color:#8796a3;margin-top:3px}
    @keyframes bidashLoadSlide{0%{transform:translateX(-110%)}50%{transform:translateX(95%)}100%{transform:translateX(260%)}}
    @media(max-width:720px){.load-progress{margin:0 14px 10px}}
    @media print{.load-progress{display:none!important}}
  `;
  doc.head.append(style);

  const box=doc.createElement('div');
  box.id='globalLoadProgress';box.className='load-progress';box.hidden=true;box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  box.innerHTML='<div class="load-progress-head"><span class="load-progress-title">Gegevens verwerken</span><span class="load-progress-pct"></span></div><div class="load-progress-track"><span></span></div><div class="load-progress-phase"></div><div class="load-progress-detail"></div>';
  status.insertAdjacentElement('afterend',box);
  const title=box.querySelector('.load-progress-title'),pctEl=box.querySelector('.load-progress-pct'),bar=box.querySelector('.load-progress-track>span'),phase=box.querySelector('.load-progress-phase'),detail=box.querySelector('.load-progress-detail');
  let hideTimer=null,session=null,applyActive=false;
  const fmtBytes=n=>{const v=Math.max(0,Number(n)||0);if(v<1024)return v+' B';if(v<1024*1024)return (v/1024).toLocaleString('nl-NL',{maximumFractionDigits:1})+' kB';return (v/(1024*1024)).toLocaleString('nl-NL',{maximumFractionDigits:1})+' MB';};
  const nextPaint=cb=>{const raf=scope.requestAnimationFrame||((fn)=>setTimeout(fn,0));raf(()=>setTimeout(cb,0));};

  function show({name='Gegevens verwerken',pct=null,fase='',detailText='',active=true,error=false,done=false,autoHide=false}={}){
    clearTimeout(hideTimer);box.hidden=false;box.className='load-progress'+(error?' error':done?' done':'')+(pct==null&&active?' indeterminate':'');
    title.textContent=name;pct=clampProgress(pct);pctEl.textContent=pct==null?(active?'bezig':''):Math.round(pct)+'%';bar.style.width=pct==null?'':pct+'%';phase.textContent=fase||'Bestand verwerken';detail.textContent=detailText||'';
    if(autoHide&&(done||error))hideTimer=setTimeout(()=>{if(!applyActive)box.hidden=true;},5500);
  }

  function startFiles(files){
    const list=[...(files||[])];if(!list.length)return;
    const total=list.reduce((s,f)=>s+(Number(f.size)||0),0);let offset=0;const meta=new WeakMap();
    list.forEach((f,i)=>{meta.set(f,{index:i,offset,size:Number(f.size)||0});offset+=Number(f.size)||0;});
    session={files:list,total,meta};
    show({name:list.length===1?list[0].name:list.length+' bestanden',pct:0,fase:'Bestanden voorbereiden',detailText:fmtBytes(total)});
  }

  const input=doc.getElementById('files');
  input?.addEventListener('change',event=>startFiles(event.target.files),true);

  const nativeText=scope.File?.prototype?.text;
  if(nativeText&&!scope.__BIDASH_FILE_TEXT_PROGRESS_PATCHED__){
    try{
      scope.File.prototype.text=function(){
        const active=session&&session.meta.get(this);
        if(!active||typeof scope.FileReader!=='function')return nativeText.call(this);
        const file=this;
        return new Promise((resolve,reject)=>{
          const reader=new scope.FileReader();
          reader.onprogress=e=>{
            const read=overallReadPercent(session.total,active.offset,e.loaded);
            show({name:file.name,pct:progressBarPercent(read),fase:'Bestand lezen',detailText:`Bestand ${active.index+1} van ${session.files.length} · ${fmtBytes(e.loaded)} van ${fmtBytes(file.size)}`});
          };
          reader.onerror=()=>{show({name:file.name,pct:null,fase:'Bestand lezen mislukt',detailText:reader.error?.message||'',active:false,error:true,autoHide:true});reject(reader.error||new Error('Bestand lezen mislukt.'));};
          reader.onload=()=>{
            const read=overallReadPercent(session.total,active.offset,active.size);
            show({name:file.name,pct:Math.min(82,progressBarPercent(read)??78),fase:'Bestand gelezen · inhoud controleren',detailText:`Bestand ${active.index+1} van ${session.files.length} · ${fmtBytes(file.size)}`});
            nextPaint(()=>resolve(String(reader.result??'')));
          };
          reader.readAsText(file);
        });
      };
      scope.__BIDASH_FILE_TEXT_PROGRESS_PATCHED__=true;
    }catch(e){console.info('Bestandsvoortgang kon File.text niet uitbreiden:',e.message);}
  }

  doc.addEventListener('click',event=>{
    const button=event.target.closest?.('button');if(!button)return;
    if(button.id==='applyImport'){
      applyActive=true;show({name:'Import uitvoeren',pct:null,fase:'Gegevens naar de rekenmodules overbrengen',detailText:'De voortgang kan tijdens een zware parse kort stilstaan.'});
    }else if(button.id==='cancelImport'){
      session=null;applyActive=false;box.hidden=true;
    }
  },true);

  const preview=doc.getElementById('preview');
  if(preview){
    new MutationObserver(()=>{
      if(preview.querySelector('#applyImport')){
        show({name:'Voorvertoning gereed',pct:100,fase:'Controle afgerond · kies Import uitvoeren om de wijziging toe te passen',done:true});
        session=null;
      }
    }).observe(preview,{childList:true,subtree:true});
  }

  const statusObserver=new MutationObserver(()=>{
    const text=status.textContent||'';
    if(/Import voltooid|lokaal opgeslagen/i.test(text)&&applyActive){applyActive=false;show({name:'Import voltooid',pct:100,fase:text,done:true,autoHide:true});}
    else if(/Import niet opgeslagen|ongeldig|mislukt/i.test(text)&&applyActive){applyActive=false;show({name:'Import mislukt',pct:null,fase:text,active:false,error:true,autoHide:true});}
    else if(/Bronnen lokaal verwerken/i.test(text)&&applyActive){show({name:'Import uitvoeren',pct:null,fase:text});}
  });
  statusObserver.observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});

  scope.addEventListener('message',event=>{
    const p=event.data;if(event.origin!==scope.location.origin||!p||p.type!=='hub:import-progress')return;
    const active=p.active!==false,error=!!p.error,done=!active&&!error;
    if(applyActive&&done){show({name:p.bestand||'DVM-bron',pct:92,fase:(p.fase||'DVM gereed')+' · werkruimte afronden',detailText:'Lokale opslag en gezamenlijke uitkomsten worden nog bijgewerkt.'});return;}
    show({name:p.bestand||((p.engine||'').toUpperCase()+' gegevens'),pct:p.pct,fase:p.fase||'Bron verwerken',detailText:p.engine?('Module: '+String(p.engine).toUpperCase()):'',active,error,done,autoHide:done||error});
  });

  scope.BIDASH_LOAD_PROGRESS={show,startFiles,hide:()=>{box.hidden=true;},element:box};
  scope.__BIDASH_LOAD_PROGRESS_ACTIVE__=true;
  return true;
}

export function installLoadProgress(scope=globalThis){return install(scope);}
if(typeof window!=='undefined'&&typeof document!=='undefined')install(window);
