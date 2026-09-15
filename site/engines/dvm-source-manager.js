/* DVM-bronbeheer: bron-specifieke uploadknoppen.
   Doel: losse DVM-bronnen rechtstreeks naar hun eigen parser sturen en daarmee
   de generieke BiDash-/DVM-herkenningsroute omzeilen. */
(() => {
  const BIDASH_VERSION='2.4';
  const DVM_VERSION='73';
  const SOURCE_CONFIG = Object.freeze({
    assetregister:{input:'dripInput',label:'Assetregister laden',multiple:false,requiresAsset:false,handler:'leesDripBestand'},
    eol:{input:'eolInputTop',label:'EOL-referentie laden',multiple:false,requiresAsset:true,handler:'leesEolReferentie'},
    storingshistorie:{input:'autoLogInput',label:'Storingshistorie toevoegen',multiple:true,requiresAsset:true,handler:'leesStoringsBestanden'},
    dripHistorie:{input:'dripHistInput',label:'DRIP-historie toevoegen',multiple:true,requiresAsset:true,handler:'leesDripHistorieBestanden'},
    uRoutes:{input:'uRouteInput',label:'U-routes laden',multiple:false,requiresAsset:true,handler:'leesURouteBestand'},
    werkzaamheden:{input:'werkInput',label:'Werkzaamheden laden',multiple:false,requiresAsset:true,handler:'leesWerkBestand'},
    liveStoringen:{input:'liveLogInput',label:'Open storingen laden',multiple:true,requiresAsset:true,handler:'leesLiveStoringsBestanden'}
  });
  const SOURCE_ORDER=['assetregister','eol','storingshistorie','dripHistorie','uRoutes','werkzaamheden','liveStoringen'];
  const PLACEHOLDERS={
    assetregister:{titel:'Assetregister / All Assets',meta:'Nog niet geladen. Laad dit stamregister als eerste.'},
    eol:{titel:'EOL-referentie',meta:'Niet geladen; generieke levensduur blijft mogelijk.'},
    storingshistorie:{titel:'Storingshistorie',meta:'Nog geen historische DVM-storingsbron geladen. Deze bron voedt alleen prognoses.'},
    dripHistorie:{titel:'DRIP-storingshistorie',meta:'Nog geen DRIP-storingshistorie geladen. Deze bron voedt alleen DRIP Monte Carlo.'},
    uRoutes:{titel:'U-routes',meta:'Niet geladen. U-routes zijn operationele routecontext.'},
    werkzaamheden:{titel:'Werkzaamheden',meta:'Niet geladen. Werkzaamheden zijn operationele context.'},
    liveStoringen:{titel:'Open storingen',meta:'Nog geen actuele momentopname geladen. Deze bron voedt alleen het actuele dashboard.'}
  };

  function werkVersieBij(){
    document.title=document.title.replace(/versie\s+\d+/i,'versie '+DVM_VERSION);
    document.querySelectorAll('#dataStatusPanel h3').forEach(el=>{el.textContent=el.textContent.replace(/versie\s+\d+/i,'versie '+DVM_VERSION);});
    const topbar=document.querySelector('.topbar');
    if(topbar&&!document.getElementById('dvmVersionBadge')){
      const badge=document.createElement('span');badge.id='dvmVersionBadge';badge.textContent='DVM v'+DVM_VERSION;
      badge.style.cssText='font-size:11px;font-weight:800;white-space:nowrap;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);padding:5px 8px;border-radius:4px';
      topbar.appendChild(badge);
    }
    try{
      if(parent===window)return;
      const actions=parent.document.querySelector('.head-actions');
      if(actions&&!parent.document.getElementById('bidashVersionBadge')){
        const badge=parent.document.createElement('span');badge.id='bidashVersionBadge';badge.className='source-badge';badge.textContent='v'+BIDASH_VERSION;badge.title='BiDash integratie '+BIDASH_VERSION;
        actions.prepend(badge);
      }
      const sidebar=parent.document.querySelector('.sidebar-foot .version');if(sidebar)sidebar.textContent='Integratie '+BIDASH_VERSION;
    }catch(error){}
  }

  function meldWijzigingAanSchil(type,files){
    try{
      if(parent!==window)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:type,bestand:files?.[0]?.name||''},location.origin);
    }catch(error){}
  }

  function assetAanwezig(){
    try{return !!ASSET_REGISTER_STATE;}catch(error){return false;}
  }
  function config(type){return SOURCE_CONFIG[type]||null;}
  function bronGeblokkeerd(type){const c=config(type);return !!(c&&c.requiresAsset&&!assetAanwezig());}
  function knopTekst(item){
    const c=config(item.type);if(!c)return '';
    if(!item.aanwezig)return c.label;
    return c.multiple?'Nog een bron toevoegen':'Bron vervangen';
  }

  window.DVM_SOURCE_UPLOADS=SOURCE_CONFIG;
  window.openDatasetUpload=function(type){
    const c=config(type);if(!c)return false;
    if(bronGeblokkeerd(type)){
      alert('Laad eerst Assetregister / All Assets. Daarna kan deze bron rechtstreeks worden verwerkt.');
      return false;
    }
    const input=document.getElementById(c.input);
    if(!input){console.error('DVM-broninput ontbreekt:',c.input);return false;}
    input.click();return true;
  };

  if(typeof datasetItems==='function'){
    const originalDatasetItems=datasetItems;
    datasetItems=function(){
      const current=originalDatasetItems();
      const out=[];
      SOURCE_ORDER.forEach(type=>{
        const matches=current.filter(item=>item.type===type);
        if(matches.length)out.push(...matches);
        else out.push({type,key:'',titel:PLACEHOLDERS[type].titel,aanwezig:false,meta:PLACEHOLDERS[type].meta});
      });
      current.filter(item=>!SOURCE_ORDER.includes(item.type)).forEach(item=>out.push(item));
      return out;
    };
  }

  if(typeof datasetItemCard==='function'){
    const originalDatasetItemCard=datasetItemCard;
    datasetItemCard=function(item){
      let html=originalDatasetItemCard(item);
      const c=config(item.type);if(!c)return html;
      const disabled=bronGeblokkeerd(item.type);
      const title=disabled?'Laad eerst Assetregister / All Assets.':'Deze knop gebruikt rechtstreeks de bron-specifieke DVM-parser.';
      const upload=`<button class="tb-btn primary dataset-upload" onclick="openDatasetUpload('${item.type}')" ${disabled?'disabled':''} title="${title}">⭱ ${knopTekst(item)}</button>`;
      html=html.replace('<div class="dataset-actions">','<div class="dataset-actions">'+upload);
      return html;
    };
  }

  if(typeof renderDatasetBeheer==='function'){
    const originalRenderDatasetBeheer=renderDatasetBeheer;
    renderDatasetBeheer=function(){
      const result=originalRenderDatasetBeheer.apply(this,arguments);
      const host=document.getElementById('tab-datasets');
      if(!host)return result;
      const actions=host.querySelector('.card .load-actions');
      if(actions){
        [...actions.querySelectorAll('button')].forEach(button=>{
          if((button.getAttribute('onclick')||'').includes('totaalImportInput'))button.remove();
        });
        if(!host.querySelector('.bron-specifiek-uitleg')){
          const uitleg=document.createElement('p');
          uitleg.className='dataset-note bron-specifiek-uitleg';
          uitleg.innerHTML='<b>Bron-specifiek laden:</b> gebruik hieronder per onderdeel de eigen uploadknop. Deze route slaat de generieke importherkenning over en stuurt het bestand rechtstreeks naar de parser voor Assetregister, EOL, DVM-historie, DRIP-historie, U-routes, werkzaamheden of open storingen.';
          actions.insertAdjacentElement('afterend',uitleg);
        }
      }
      werkVersieBij();
      return result;
    };
  }

  if(typeof tabToegestaan==='function'){
    const originalTabToegestaan=tabToegestaan;
    tabToegestaan=function(tab){return tab==='datasets'?true:originalTabToegestaan.apply(this,arguments);};
  }
  if(typeof renderDataGereedheid==='function'){
    const originalRenderDataGereedheid=renderDataGereedheid;
    renderDataGereedheid=function(){
      const result=originalRenderDataGereedheid.apply(this,arguments);
      const beheer=document.getElementById('btnDatasetBeheer');if(beheer)beheer.disabled=false;
      werkVersieBij();
      return result;
    };
  }

  function directeHandler(c,files){
    if(!files.length)return null;
    switch(c.handler){
      case 'leesDripBestand': return leesDripBestand(files[0]);
      case 'leesEolReferentie': return leesEolReferentie(files[0]);
      case 'leesStoringsBestanden': return leesStoringsBestanden(files);
      case 'leesDripHistorieBestanden': return leesDripHistorieBestanden(files);
      case 'leesURouteBestand': return leesURouteBestand(files[0]);
      case 'leesWerkBestand': return leesWerkBestand(files[0]);
      case 'leesLiveStoringsBestanden': return leesLiveStoringsBestanden(files);
      default: throw new Error('Onbekende DVM-bronparser: '+c.handler);
    }
  }

  function vervangInputDoorDirecteParser(type,c){
    const current=document.getElementById(c.input);if(!current)return;
    const fresh=current.cloneNode(true);
    current.replaceWith(fresh);
    fresh.addEventListener('change',async event=>{
      const input=event.currentTarget,files=[...(input.files||[])];if(!files.length)return;
      input.disabled=true;
      try{
        await directeHandler(c,files);
        meldWijzigingAanSchil(type,files);
      }
      catch(error){console.error(error);if(typeof importMislukt==='function')importMislukt(files[0]?.name||'DVM-bron',error.message||String(error));}
      finally{input.value='';input.disabled=false;if(typeof renderDatasetBeheer==='function'&&document.getElementById('tab-datasets')&&!document.getElementById('tab-datasets').classList.contains('hidden'))renderDatasetBeheer();}
    });
  }

  function installeerDirecteBronInputs(){
    Object.entries(SOURCE_CONFIG).forEach(([type,c])=>vervangInputDoorDirecteParser(type,c));
    const beheer=document.getElementById('btnDatasetBeheer');if(beheer)beheer.disabled=false;
    if(typeof updateTabSloten==='function')updateTabSloten();
    werkVersieBij();
    if(typeof renderDatasetBeheer==='function'&&document.getElementById('tab-datasets')&&!document.getElementById('tab-datasets').classList.contains('hidden'))renderDatasetBeheer();
    window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__=true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installeerDirecteBronInputs,{once:true});
  else installeerDirecteBronInputs();
})();
