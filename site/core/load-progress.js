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

  const shell=doc.createElement('div');
  shell.id='globalLoadProgressShell';shell.className='page-content';shell.hidden=true;
  const box=doc.createElement('section');
  box.id='globalLoadProgress';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  box.innerHTML='<div class="section-heading"><h2 class="load-progress-title">Gegevens verwerken</h2><span class="load-progress-pct muted"></span></div><progress class="load-progress-native" max="100"></progress><p class="load-progress-phase muted"></p><small class="load-progress-detail muted"></small>';
  shell.append(box);status.insertAdjacentElement('afterend',shell);
  const title=box.querySelector('.load-progress-title'),pctEl=box.querySelector('.load-progress-pct'),progressEl=box.querySelector('.load-progress-native'),phase=box.querySelector('.load-progress-phase'),detail=box.querySelector('.load-progress-detail');
  let hideTimer=null,session=null,applyActive=false;
  const fmtBytes=n=>{const v=Math.max(0,Number(n)||0);if(v<1024)return v+' B';if(v<1024*1024)return (v/1024).toLocaleString('nl-NL',{maximumFractionDigits:1})+' kB';return (v/(1024*1024)).toLocaleString('nl-NL',{maximumFractionDigits:1})+' MB';};
  const nextPaint=cb=>{const raf=scope.requestAnimationFrame||((fn)=>setTimeout(fn,0));raf(()=>setTimeout(cb,0));};

  function show({name='Gegevens verwerken',pct=null,fase='',detailText='',active=true,error=false,done=false,autoHide=false}={}){
    clearTimeout(hideTimer);shell.hidden=false;
    title.textContent=(error?'⚠ ':done?'✓ ':'')+name;
    pct=clampProgress(pct);pctEl.textContent=pct==null?(active?'bezig':''):Math.round(pct)+'%';
    if(pct==null)progressEl.removeAttribute('value');else progressEl.value=pct;
    phase.textContent=fase||'Bestand verwerken';detail.textContent=detailText||'';
    if(autoHide&&(done||error))hideTimer=setTimeout(()=>{if(!applyActive)shell.hidden=true;},5500);
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
      session=null;applyActive=false;shell.hidden=true;
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
    if(applyActive&&done){show({name:p.bestand||'DVM-bron',pct:null,fase:(p.fase||'DVM gereed')+' · werkruimte opslaan',detailText:'De DVM-import is klaar. BiDash verwerkt nu alleen nog de gezamenlijke werkruimte.'});return;}
    show({name:p.bestand||((p.engine||'').toUpperCase()+' gegevens'),pct:p.pct,fase:p.fase||'Bron verwerken',detailText:p.engine?('Module: '+String(p.engine).toUpperCase()):'',active,error,done,autoHide:done||error});
  });

  scope.BIDASH_LOAD_PROGRESS={show,startFiles,hide:()=>{shell.hidden=true;},element:box};
  scope.__BIDASH_LOAD_PROGRESS_ACTIVE__=true;
  return true;
}

export function installLoadProgress(scope=globalThis){return install(scope);}
if(typeof window!=='undefined'&&typeof document!=='undefined')install(window);
