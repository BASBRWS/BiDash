/* Presentatiefilter voor Assetmanagement > Gezamenlijk assetregister.
   Windwaarschuwing en RIA4 gebruiken dezelfde classificatie als Open storingen.
   De onderliggende DVM/BI-data en rekenlogica blijven ongewijzigd. */
(() => {
  const IDS={wind:'assetWind',ria4:'assetRia4'};
  const patched=new WeakMap();
  const yes=v=>v===true||v===1||/^(1|ja|yes|true|x)$/i.test(String(v??'').trim());
  const selected=()=>({wind:!!document.getElementById(IDS.wind)?.checked,ria4:!!document.getElementById(IDS.ria4)?.checked});
  const active=()=>{const s=selected();return s.wind||s.ria4;};
  const match=(asset,sel)=>{
    if(!sel.wind&&!sel.ria4)return true;
    const wind=yes(asset?.specialWind)||yes(asset?.wind)||yes(asset?.windwaarschuwing);
    const ria4=yes(asset?.specialRia4)||yes(asset?.ria4)||yes(asset?.ria_4)||yes(asset?.['ria-4']);
    return (sel.wind&&wind)||(sel.ria4&&ria4);
  };

  function hub(name){
    try{return document.querySelector(`#engine-${name} iframe`)?.contentWindow?.HUB||null;}catch(error){return null;}
  }
  function patch(name){
    const api=hub(name);if(!api||typeof api.assets!=='function'||patched.has(api))return false;
    const original=api.assets.bind(api);patched.set(api,original);
    if(name==='dvm')api.assets=function(){const rows=original();const sel=selected();return Array.isArray(rows)?rows.filter(a=>match(a,sel)):rows;};
    else api.assets=function(){const rows=original();return active()?[]:rows;};
    return true;
  }
  function patchAll(){patch('dvm');patch('bi');}

  function fullAssetCount(){
    let n=0;
    for(const name of ['dvm','bi']){
      const api=hub(name),original=api&&patched.get(api);
      try{const rows=original?original():api?.assets?.();if(Array.isArray(rows))n+=rows.length;}catch(error){}
    }
    return n;
  }
  function correctKpi(){
    if(!active())return;
    const strong=document.querySelector('#assetKpis .card strong');if(!strong)return;
    const text=fullAssetCount().toLocaleString('nl-NL');if(strong.textContent!==text)strong.textContent=text;
  }
  function rerender(){
    patchAll();
    const source=document.getElementById('assetSource');
    if(source)source.dispatchEvent(new Event('change',{bubbles:true}));
    requestAnimationFrame(correctKpi);
  }

  function control(id,label,title){
    const wrap=document.createElement('label');wrap.className='check';wrap.title=title;
    const input=document.createElement('input');input.type='checkbox';input.id=id;
    input.addEventListener('change',rerender);
    wrap.append(input,document.createTextNode(' '+label));return wrap;
  }
  function ensureControls(){
    const fault=document.getElementById('assetFaultOnly');if(!fault)return false;
    const row=fault.closest('.filter-row');if(!row)return false;
    if(!document.getElementById(IDS.wind))row.append(control(IDS.wind,'Windwaarschuwing','Toon alleen assets uit de geladen Windwaarschuwing-DRIP referentielijst.'));
    if(!document.getElementById(IDS.ria4))row.append(control(IDS.ria4,'RIA4','Toon alleen assets uit de geladen RIA4-DRIP referentielijst.'));
    return true;
  }

  function install(){ensureControls();patchAll();correctKpi();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);

  for(const id of ['engine-dvm','engine-bi']){
    const host=document.getElementById(id);if(host)new MutationObserver(()=>setTimeout(install,0)).observe(host,{childList:true,subtree:false});
  }
  const kpis=document.getElementById('assetKpis');if(kpis)new MutationObserver(()=>requestAnimationFrame(correctKpi)).observe(kpis,{childList:true,subtree:true,characterData:true});
  window.addEventListener('message',ev=>{if(ev.origin!==location.origin)return;if(/^hub:(ready|changed)$/.test(String(ev.data?.type||'')))setTimeout(install,0);});
})();
