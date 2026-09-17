/* DVM-bronbeheer: bron-specifieke uploadknoppen.
   Doel: losse DVM-bronnen rechtstreeks naar hun eigen parser sturen en daarmee
   de generieke BiDash-/DVM-herkenningsroute omzeilen. */
(() => {
  /* De versie van de schil hoort bij de schil; die staat in site/core/versie.js.
     Deze module kent alleen haar eigen engineversie en meldt die aan de schil. */
  const DVM_VERSION='90';
  const SPECIAL_ACCEPT='.xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.txt';
  const SOURCE_CONFIG = Object.freeze({
    assetregister:{input:'dripInput',label:'Assetregister laden',multiple:false,requiresAsset:false,handler:'leesDripBestand'},
    windDrips:{input:'windDripListInput',label:'Windwaarschuwing DRIP’s laden',multiple:false,requiresAsset:true,handler:'special:wind',accept:SPECIAL_ACCEPT},
    ria4Drips:{input:'ria4DripListInput',label:'RIA4 DRIP’s laden',multiple:false,requiresAsset:true,handler:'special:ria4',accept:SPECIAL_ACCEPT},
    eol:{input:'eolInputTop',label:'EOL-referentie laden',multiple:false,requiresAsset:true,handler:'leesEolReferentie'},
    storingshistorie:{input:'autoLogInput',label:'Storingshistorie toevoegen',multiple:true,requiresAsset:true,handler:'leesStoringsBestanden'},
    dripHistorie:{input:'dripHistInput',label:'DRIP-historie toevoegen',multiple:true,requiresAsset:true,handler:'leesDripHistorieBestanden'},
    uRoutes:{input:'uRouteInput',label:'U-routes laden',multiple:false,requiresAsset:true,handler:'leesURouteBestand'},
    werkzaamheden:{input:'werkInput',label:'Werkzaamheden laden',multiple:false,requiresAsset:true,handler:'leesWerkBestand'},
    liveStoringen:{input:'liveLogInput',label:'Open storingen laden',multiple:true,requiresAsset:true,handler:'leesLiveStoringsBestanden'},
    signaalgeverTotaal:{input:'signaalgeverTotaalInput',label:'Signaalgevers totaal (JSON) laden',multiple:false,requiresAsset:true,handler:'leesSignaalgeverTotaal',accept:'.json'},
    signaalgeverMap:{input:'signaalgeverMapInput',label:'Signaalgevers uit map lezen (MTM)',multiple:true,directory:true,requiresAsset:true,handler:'leesSignaalgeverMap'}
  });
  const SOURCE_ORDER=['assetregister','windDrips','ria4Drips','eol','storingshistorie','dripHistorie','uRoutes','werkzaamheden','liveStoringen','signaalgeverTotaal','signaalgeverMap'];
  const PLACEHOLDERS={
    assetregister:{titel:'Assetregister / All Assets',meta:'Nog niet geladen. Laad dit stamregister als eerste.'},
    windDrips:{titel:'Windwaarschuwing DRIP’s',meta:'Nog geen referentielijst geladen. Deze bron markeert welke DRIP-assets bij windwaarschuwing horen.'},
    ria4Drips:{titel:'RIA4 DRIP’s',meta:'Nog geen referentielijst geladen. Deze bron markeert welke DRIP-assets bij RIA4 horen.'},
    eol:{titel:'EOL-referentie',meta:'Niet geladen; generieke levensduur blijft mogelijk.'},
    storingshistorie:{titel:'Storingshistorie',meta:'Nog geen historische DVM-storingsbron geladen. Deze bron voedt alleen prognoses.'},
    dripHistorie:{titel:'DRIP-storingshistorie',meta:'Nog geen DRIP-storingshistorie geladen. Historie voedt DRIP Monte Carlo; expliciet openstaande incidenten worden ook aan het actuele storingsbeeld toegevoegd.'},
    uRoutes:{titel:'U-routes',meta:'Niet geladen. U-routes zijn operationele routecontext.'},
    werkzaamheden:{titel:'Werkzaamheden',meta:'Niet geladen. Werkzaamheden zijn operationele context.'},
    liveStoringen:{titel:'Open storingen',meta:'Nog geen actuele signaalgever-momentopname geladen. Open DRIP-incidenten kunnen daarnaast uit de DRIP-historie worden afgeleid.'},
    signaalgeverTotaal:{titel:'Signaalgevers totaal (JSON)',meta:'Nog niet geladen. Eén gecombineerd JSON-bestand (datasets.mtm) met open alarmen én historische storingen. Alternatief voor de losse Open storingen- en Storingshistorie-uploads; bij het laden vervangt het die twee bronnen zodat oud en nieuw niet mengen.'},
    signaalgeverMap:{titel:'Signaalgevers uit map (MTM)',meta:'Nog niet geladen. Kies de X-hoofdmap of de mtm-map; BiDash leest de ruwe storinglijsten onder mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>, bouwt daaruit de open storingen en historie en bewaart alleen wat nodig is. Vult dezelfde bron als Signaalgevers totaal en vervangt de losse Open storingen en Storingshistorie. Werkt in Edge en Chrome.'}
  };

  function werkVersieBij(){
    document.title=document.title.replace(/versie\s+\d+/i,'versie '+DVM_VERSION);
    document.querySelectorAll('#dataStatusPanel h3').forEach(el=>{el.textContent=el.textContent.replace(/versie\s+\d+/i,'versie '+DVM_VERSION);});
    const topbar=document.querySelector('.topbar');
    if(topbar&&!document.getElementById('dvmVersionBadge')){
      const badge=document.createElement('span');badge.id='dvmVersionBadge';badge.textContent='DVM v'+DVM_VERSION;
      badge.style.cssText='font-size:11px;font-weight:800;white-space:nowrap;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);padding:5px 8px;border-radius:4px';
      topbar.appendChild(badge);
    }else if(document.getElementById('dvmVersionBadge'))document.getElementById('dvmVersionBadge').textContent='DVM v'+DVM_VERSION;
    /* De schil zet zelf wat er in de balk komt te staan; wij melden alleen onze
       eigen engineversie. Zo staat er ook een versie in de balk voordat deze
       module is geladen, en blijft er één plek waar de schilversie vandaan komt. */
    try{
      if(parent===window)return;
      parent.postMessage({type:'hub:version',engine:'dvm',versie:DVM_VERSION},location.origin);
    }catch(error){}
  }

  function meldWijzigingAanSchil(type,files){
    try{if(parent!==window)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:type,bestand:files?.[0]?.name||''},location.origin);}catch(error){}
  }
  function assetAanwezig(){try{return !!ASSET_REGISTER_STATE;}catch(error){return false;}}
  function config(type){return SOURCE_CONFIG[type]||null;}
  function bronGeblokkeerd(type){const c=config(type);return !!(c&&c.requiresAsset&&!assetAanwezig());}
  function isSpecial(type){return type==='windDrips'||type==='ria4Drips';}
  function specialKind(type){return type==='windDrips'?'wind':type==='ria4Drips'?'ria4':'';}
  function specialState(type){const k=specialKind(type);return k?(window.DVM_SPECIAL_DRIP_LISTS?.[k]||null):null;}
  function knopTekst(item){const c=config(item.type);if(!c)return '';if(!item.aanwezig)return c.label;return c.multiple?'Nog een bron toevoegen':'Bron vervangen';}
  /* Een referentielijst zonder herkende markerkolom krijgt de soort die met de knop
     is gekozen. Dat is een aanname over de hele lijst, dus die staat in de brondekking
     naast de bestandsnaam en niet alleen in de melding tijdens het laden. */
  function specialHerkomst(type,s){
    const soort=type==='windDrips'?'Windwaarschuwing':'RIA4';
    const kolommen=Array.isArray(s.markerKolommen)?s.markerKolommen.filter(Boolean):[];
    if(s.herkomst==='markering'&&kolommen.length)return `soort uit kolom ${kolommen.join(', ')}`;
    if(s.herkomst==='aanname'){
      const n=Number(s.rijenBron)||Number(s.rijen)||0;
      return `geen markerkolom herkend, ${n?`alle ${n} regels`:'de hele lijst'} als ${soort} aangenomen`;
    }
    return 'herkomst onbekend, geladen voor deze controle';
  }
  function specialMeta(type){
    const s=specialState(type);if(!s||!s.bestand)return PLACEHOLDERS[type].meta;
    const ids=s.identifiers?.length||0,un=Number.isFinite(Number(s.unmatchedCount))?Number(s.unmatchedCount):(s.unmatched?.length||0);
    return `${s.bestand} · ${ids} referenties · ${s.matchedAssets||0} assets gekoppeld${un?` · ${un} niet gekoppeld`:''} · ${specialHerkomst(type,s)}`;
  }

  function ensureInput(type,c){
    let input=document.getElementById(c.input);if(input)return input;
    input=document.createElement('input');input.type='file';input.id=c.input;input.hidden=true;input.multiple=!!c.multiple;
    /* Een directory-bron (maplezen) kiest een hele map in plaats van losse bestanden. */
    if(c.directory){try{input.webkitdirectory=true;}catch(error){}input.setAttribute('webkitdirectory','');}
    else input.accept=c.accept||'.xlsx,.xls,.xlsm,.csv,.json';
    input.dataset.bidashSource=type;document.body.appendChild(input);return input;
  }

  window.DVM_SOURCE_UPLOADS=SOURCE_CONFIG;
  window.openDatasetUpload=function(type){
    const c=config(type);if(!c)return false;
    if(bronGeblokkeerd(type)){alert('Laad eerst Assetregister / All Assets. Daarna kan deze bron rechtstreeks worden verwerkt.');return false;}
    /* De maplezer opent eerst een configuratiedialoog (regio/periode/basis) en klikt
       daarna zelf de directory-invoer aan, zodat niet in één keer te veel wordt gelezen. */
    if(type==='signaalgeverMap'&&typeof openSignaalgeverMapDialog==='function'){openSignaalgeverMapDialog();return true;}
    const input=ensureInput(type,c);input.click();return true;
  };
  window.clearSpecialDripSource=function(type){
    const k=specialKind(type);if(!k||typeof window.clearDripSpecialList!=='function')return false;
    if(!confirm(`Classificatiebron ${k==='wind'?'Windwaarschuwing':'RIA4'} wissen?`))return false;
    window.clearDripSpecialList(k);meldWijzigingAanSchil(type,[]);if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();return true;
  };

  function signaalgeverTotaalState(){try{return window.__BIDASH_SIGNAALGEVER_TOTAAL__||null;}catch(error){return null;}}
  /* De signaalgever-totaalbron leeft in dezelfde stores als Open storingen en
     Storingshistorie (anders zou de doorrekening haar niet zien), maar hoort in
     Datasetbeheer onder de eigen kaart. Deze rijen horen niet onder de losse kaarten. */
  function isSignaalgeverTotaalItem(item){
    return (item.type==='liveStoringen'||item.type==='storingshistorie')&&String(item.key||'').indexOf('signaalgever-totaal-')===0;
  }
  function signaalgeverTotaalMeta(s){
    const esctekst=typeof esc==='function'?esc:(v=>String(v==null?'':v));
    const dat=t=>t?new Date(t).toLocaleDateString('nl-NL'):'';
    const d=dat(s.peildatum),laatste=dat(s.laatsteEntry);
    const perVc=s.laatstePerVc&&Object.keys(s.laatstePerVc).length
      ? '<br>Laatste entry per regio: '+Object.entries(s.laatstePerVc).sort().map(([v,t])=>v.toUpperCase()+' '+dat(t)).join(', ')
      : '';
    return `${esctekst(s.bestand)}<br>${(s.open||0).toLocaleString('nl-NL')} open (${(s.herkendOpen||0).toLocaleString('nl-NL')} herkend), ${(s.historie||0).toLocaleString('nl-NL')} historisch (${(s.herkendHist||0).toLocaleString('nl-NL')} herkend).${laatste?'<br>Laatste entry '+laatste:''}${d?' · peildatum open '+d:''}${perVc}<br>Voedt zowel het actuele dashboard als de prognose; vervangt de losse Open storingen en Storingshistorie.`;
  }

  if(typeof datasetItems==='function'){
    const originalDatasetItems=datasetItems;
    datasetItems=function(){
      const sgt=signaalgeverTotaalState();
      const current=originalDatasetItems().filter(item=>!isSignaalgeverTotaalItem(item)),out=[];
      SOURCE_ORDER.forEach(type=>{
        if(type==='signaalgeverTotaal'){
          out.push({type,key:'',titel:PLACEHOLDERS[type].titel,aanwezig:!!sgt,meta:sgt?signaalgeverTotaalMeta(sgt):PLACEHOLDERS[type].meta});
          return;
        }
        const matches=current.filter(item=>item.type===type);
        if(matches.length){out.push(...matches);return;}
        const s=isSpecial(type)?specialState(type):null;
        out.push({type,key:'',titel:PLACEHOLDERS[type].titel,aanwezig:!!s?.bestand,meta:isSpecial(type)?specialMeta(type):PLACEHOLDERS[type].meta});
      });
      current.filter(item=>!SOURCE_ORDER.includes(item.type)).forEach(item=>out.push(item));return out;
    };
  }

  /* Verwijderen op de signaalgever-totaalkaart wist beide stores (open + historie)
     die uit dit ene bestand komen, en herstelt daarna de doorrekening. */
  if(typeof verwijderDataset==='function'){
    const originalVerwijderDataset=verwijderDataset;
    verwijderDataset=async function(type,keyEnc){
      if(type==='signaalgeverTotaal'){
        if(!confirm('Signaalgevers totaal (JSON) verwijderen? De open storingen en historie uit dit bestand worden gewist.'))return;
        try{
          STORINGSBRONNEN=STORINGSBRONNEN.filter(b=>!b._signaalgeverTotaal);
          LIVE_STORINGSBRONNEN=LIVE_STORINGSBRONNEN.filter(b=>!b._signaalgeverTotaal);
          LIVE_PEILDATUM=Math.max(0,...LIVE_STORINGSBRONNEN.map(b=>b.peildatum||0))||null;
        }catch(error){console.error(error);}
        try{window.__BIDASH_SIGNAALGEVER_TOTAAL__=null;}catch(error){}
        if(typeof datasetNaMutatie==='function')await datasetNaMutatie('Signaalgevers totaal (JSON) verwijderd; afhankelijke berekeningen zijn opnieuw beoordeeld.');
        if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();
        return;
      }
      return originalVerwijderDataset.apply(this,arguments);
    };
  }

  if(typeof datasetItemCard==='function'){
    const originalDatasetItemCard=datasetItemCard;
    datasetItemCard=function(item){
      let html=originalDatasetItemCard(item);const c=config(item.type);if(!c)return html;
      const disabled=bronGeblokkeerd(item.type),title=disabled?'Laad eerst Assetregister / All Assets.':'Deze knop gebruikt rechtstreeks de bron-specifieke DVM-parser.';
      let upload=`<button class="tb-btn primary dataset-upload" onclick="openDatasetUpload('${item.type}')" ${disabled?'disabled':''} title="${title}">⭱ ${knopTekst(item)}</button>`;
      if(isSpecial(item.type)&&item.aanwezig)upload+=`<button class="tb-btn" onclick="clearSpecialDripSource('${item.type}')">Wissen</button>`;
      html=html.replace('<div class="dataset-actions">','<div class="dataset-actions">'+upload);return html;
    };
  }

  if(typeof renderDatasetBeheer==='function'){
    const originalRenderDatasetBeheer=renderDatasetBeheer;
    renderDatasetBeheer=function(){
      const result=originalRenderDatasetBeheer.apply(this,arguments),host=document.getElementById('tab-datasets');if(!host)return result;
      const actions=host.querySelector('.card .load-actions');
      if(actions){
        [...actions.querySelectorAll('button')].forEach(button=>{if((button.getAttribute('onclick')||'').includes('totaalImportInput'))button.remove();});
        if(!host.querySelector('.bron-specifiek-uitleg')){
          const uitleg=document.createElement('p');uitleg.className='dataset-note bron-specifiek-uitleg';
          uitleg.innerHTML='<b>Bron-specifiek laden:</b> gebruik hieronder per onderdeel de eigen uploadknop. Een gecombineerd DRIP-bestand met aparte kolommen RIA4 en Windwaarschuwing wordt automatisch per gemarkeerde regel gesplitst. Losse referentielijsten blijven via hun eigen knop bruikbaar. De koppeling gebruikt eerst de identifier en controleert VC, weg, richting en hectometer.';
          actions.insertAdjacentElement('afterend',uitleg);
        }
      }
      werkVersieBij();return result;
    };
  }

  if(typeof tabToegestaan==='function'){
    const originalTabToegestaan=tabToegestaan;tabToegestaan=function(tab){return tab==='datasets'?true:originalTabToegestaan.apply(this,arguments);};
  }
  if(typeof renderDataGereedheid==='function'){
    const originalRenderDataGereedheid=renderDataGereedheid;
    renderDataGereedheid=function(){const result=originalRenderDataGereedheid.apply(this,arguments);const beheer=document.getElementById('btnDatasetBeheer');if(beheer)beheer.disabled=false;werkVersieBij();return result;};
  }

  async function directeHandler(type,c,files){
    if(!files.length)return null;
    let result;
    switch(c.handler){
      case 'leesDripBestand': result=await leesDripBestand(files[0]);break;
      case 'leesEolReferentie': result=await leesEolReferentie(files[0]);break;
      case 'leesStoringsBestanden': result=await leesStoringsBestanden(files);break;
      case 'leesDripHistorieBestanden': result=await leesDripHistorieBestanden(files);break;
      case 'leesURouteBestand': result=await leesURouteBestand(files[0]);break;
      case 'leesWerkBestand': result=await leesWerkBestand(files[0]);break;
      case 'leesLiveStoringsBestanden': result=await leesLiveStoringsBestanden(files);break;
      case 'leesSignaalgeverTotaal': result=await leesSignaalgeverTotaalBestand(files[0]);break;
      case 'leesSignaalgeverMap': result=await leesSignaalgeverMap(files);break;
      case 'special:wind': result=await window.loadDripSpecialList('wind',files[0]);break;
      case 'special:ria4': result=await window.loadDripSpecialList('ria4',files[0]);break;
      default: throw new Error('Onbekende DVM-bronparser: '+c.handler);
    }
    if(['assetregister','dripHistorie'].includes(type)&&typeof window.applyDripSpecialLists==='function')window.applyDripSpecialLists();
    return result;
  }

  function vervangInputDoorDirecteParser(type,c){
    const current=ensureInput(type,c),fresh=current.cloneNode(true);current.replaceWith(fresh);
    fresh.addEventListener('change',async event=>{
      const input=event.currentTarget,files=[...(input.files||[])];if(!files.length)return;input.disabled=true;
      try{await directeHandler(type,c,files);meldWijzigingAanSchil(type,files);}
      catch(error){console.error(error);if(typeof importMislukt==='function')importMislukt(files[0]?.name||'DVM-bron',error.message||String(error));}
      finally{input.value='';input.disabled=false;if(typeof renderDatasetBeheer==='function'&&document.getElementById('tab-datasets')&&!document.getElementById('tab-datasets').classList.contains('hidden'))renderDatasetBeheer();}
    });
  }

  function installeerDirecteBronInputs(){
    Object.entries(SOURCE_CONFIG).forEach(([type,c])=>vervangInputDoorDirecteParser(type,c));
    const beheer=document.getElementById('btnDatasetBeheer');if(beheer)beheer.disabled=false;
    if(typeof updateTabSloten==='function')updateTabSloten();werkVersieBij();
    if(typeof renderDatasetBeheer==='function'&&document.getElementById('tab-datasets')&&!document.getElementById('tab-datasets').classList.contains('hidden'))renderDatasetBeheer();
    window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__=true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installeerDirecteBronInputs,{once:true});else installeerDirecteBronInputs();
})();
