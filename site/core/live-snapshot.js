import './incident-lifecycle.js';
const norm=v=>String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ');

export function liveIncidentKey(parts={}){
  const eventId=norm(parts.eventId);
  if(eventId)return ['EVENT',norm(parts.vc),norm(parts.typeId),eventId,norm(parts.road),norm(parts.direction),parts.hm==null?'':Number(parts.hm).toFixed(3),norm(parts.lane),norm(parts.faultCode),String(parts.start||'')].join('|');
  return [
    'ROW',norm(parts.typeId),norm(parts.assetId),String(parts.start||''),
    norm(parts.road),norm(parts.direction),parts.hm==null?'':Number(parts.hm).toFixed(3),
    norm(parts.lane),norm(parts.faultCode),norm(parts.message),norm(parts.effect)
  ].join('|');
}

export function useTargetedLiveXlsx(name){
  return /\.xlsx$|\.xlsm$/i.test(String(name||''));
}

export function diffSnapshot(oldRows,newRows,keyFn){
  const remaining=new Map();
  for(const row of newRows||[]){
    const key=keyFn(row);remaining.set(key,(remaining.get(key)||0)+1);
  }
  const disappeared=[];
  for(const row of oldRows||[]){
    const key=keyFn(row),count=remaining.get(key)||0;
    if(count>0)remaining.set(key,count-1);else disappeared.push(row);
  }
  return disappeared;
}

function setColumn(row,names,fallback,value){
  const wanted=new Set(names.map(x=>String(x).toLowerCase().replace(/[\s_-]+/g,'')));
  let found=false;
  for(const key of Object.keys(row)){
    if(wanted.has(String(key).toLowerCase().replace(/[\s_-]+/g,''))){row[key]=value;found=true;}
  }
  if(!found)row[fallback]=value;
}

export function closeHistoryRow(raw,{closedAt,startAt,sourceFile,lastSeenAt}={}){
  const out={...(raw||{})},H=globalThis.DVM_INCIDENT_LIFECYCLE;
  const peil=H.iso(closedAt),last=H.iso(raw?.laatste_gezien||lastSeenAt||raw?.tot||raw?.Tot||raw?.einde);
  setColumn(out,['status'],'status','onbekend');setColumn(out,['open'],'open','onbekend');
  out._liveOpen=false;out._afgeslotenDoorNieuweMomentopname=true;out._afsluitPeildatum=peil;
  out._afsluitBronBestand=String(sourceFile||'');
  const start=Number(startAt),end=H.time(closedAt);if(start>0&&end>=start){out.storingsduur_uren=(end-start)/36e5;out.duur_is_bovengrens=true;}
  return H.stamp(out,{eerste_gezien:raw?.eerste_gezien||null,laatste_gezien:last,bron_peildatum:peil,hersteld_op:null,
    levenscyclus_status:'ONBEKEND_DOOR_BRONGAT',herstel_venster_van:last,herstel_venster_tot:null,duurBetrouwbaar:false});
}

const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_DVM_LIVE_PATCH_ACTIVE__)return;
  const H=globalThis.__BIDASH_LIVE_SNAPSHOT_HELPERS__;
  if(!H||typeof normRij!=='function'||typeof storingsBronUitBestand!=='function')return;

  function sleutel(raw){
    const m=normRij(raw),typeId=classificeer(m)||'';
    let faultCode='';
    try{const f=typeId&&foutregel(m,typeId);faultCode=f&&f.code!=null?String(f.code):'';}catch(e){}
    let assetId='';
    try{assetId=assetLogId(m,typeId)||'';}catch(e){assetId=m.osid||m.entityid||'';}
    return H.liveIncidentKey({
      eventId:m.eventId,vc:m.vc,typeId,assetId,start:m.tVan,road:m.weg,direction:m.richting,hm:m.hm,
      lane:m.strook,faultCode,message:m.melding,effect:m.gevolg
    });
  }

  async function leesOpenStoringenBron(file,voortgang){
    const vg=(f,fase)=>{if(voortgang)voortgang(f,fase);};
    if(!H.useTargetedLiveXlsx(file&&file.name))return storingsBronUitBestand(file,voortgang);
    if(typeof STORINGS_KOLOMMEN_LICHT==='undefined')return storingsBronUitBestand(file,voortgang);

    let rijen,workerErr=null;
    if(typeof sheetJsWorkerRijen==='function'){
      vg(.02,'Open-storingenwerkmap in achtergrond verwerken');
      try{
        const worker=sheetJsWorkerRijen(file,STORINGS_KOLOMMEN_LICHT,null,vg);
        const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('Excel-worker reageert niet binnen 90 seconden')),90000));
        rijen=await Promise.race([worker,timeout]);
      }catch(error){workerErr=error;}
    }

    if((!rijen||!rijen.length)&&typeof xlsxEersteBladLicht==='function'){
      vg(.06,workerErr?'Achtergrondworker niet gelukt; gerichte werkbladlezer proberen':'Geen Excel-worker beschikbaar; gerichte werkbladlezer proberen');
      try{rijen=await xlsxEersteBladLicht(file,STORINGS_KOLOMMEN_LICHT,null,vg);}
      catch(lichtErr){
        if(workerErr)throw new Error('open-storingenlezer: '+workerErr.message+'; fallback: '+lichtErr.message);
        throw lichtErr;
      }
    }

    if(!rijen||!rijen.length){
      if(workerErr)throw new Error('open-storingenlezer: '+workerErr.message);
      return storingsBronUitBestand(file,voortgang);
    }
    vg(.98,rijen.length.toLocaleString('nl-NL')+' open-storingsregels gereed voor controle');
    return {key:String(file.name||'').toLowerCase(),naam:file.name,rijen,size:file.size||0};
  }

  function archiveerVerdwenen(oudeRijen,nieuweRijen,peildatum,bronNaam){
    const verdwenen=H.diffSnapshot(oudeRijen,nieuweRijen,sleutel),historisch=new Map();
    for(const b of STORINGSBRONNEN)for(let i=0;i<(b.rijen||[]).length;i++)historisch.set(sleutel(b.rijen[i]),{b,i});
    // Een opnieuw waargenomen incident vervangt ook de onzekere historische versie.
    // Een importtijd of bestandsdatum geldt daarbij nooit als waarnemingsbewijs.
    for(const raw of nieuweRijen){
      const old=historisch.get(sleutel(raw));if(!old)continue;
      const life=globalThis.DVM_INCIDENT_LIFECYCLE.read(raw);
      old.b.rijen[old.i]=globalThis.DVM_INCIDENT_LIFECYCLE.stamp({...old.b.rijen[old.i],...raw},{...life,
        eerste_gezien:old.b.rijen[old.i].eerste_gezien||life.eerste_gezien});
    }
    const toevoegen=[],onzeker=[];
    for(const raw of verdwenen){
      const m=normRij(raw),typeId=classificeer(m);
      const row=H.closeHistoryRow({...raw,assetTypeHint:typeId||'ONBEKEND'},{closedAt:peildatum,startAt:m.tVan,sourceFile:bronNaam});onzeker.push(row);
      const old=historisch.get(sleutel(raw));if(old)old.b.rijen[old.i]={...old.b.rijen[old.i],...row};else toevoegen.push(row);
    }
    globalThis.__BIDASH_ONZEKERE_LIVE__=onzeker;
    if(toevoegen.length){
      const datum=new Date(peildatum).toISOString().slice(0,10),key='auto-live-afgesloten-'+datum;
      let bron=STORINGSBRONNEN.find(b=>b.key===key);
      if(!bron){bron={key,naam:'Verdwenen meldingen, herstel onbevestigd '+datum,rijen:[],size:0,doel:'historie-auto'};STORINGSBRONNEN.push(bron);}
      bron.rijen.push(...toevoegen);
    }
    return onzeker.length;
  }

  function vervangLiveBronnen(bronnen){
    if(!bronnen.length)return {liveCount:0,archivedCount:0};
    const keys=new Set(bronnen.map(b=>b.key));
    bronnen=[...bronnen,...LIVE_STORINGSBRONNEN.filter(b=>b.virtueel&&b.afgeleidVan==='dripHistorie'&&!keys.has(b.key))];
    const oudeRijen=gecombineerdeLiveStoringsRijen().slice();
    globalThis.__BIDASH_ONZEKERE_LIVE__=[];
    bronnen.forEach(b=>{
      b.peildatum=bronPeildatum(b)||Number(b._fileLastModified)||Date.now();
      b.doel='live-open';
      b.rijen=(b.rijen||[]).map(r=>({...r,_liveOpen:!['ONBEKEND_DOOR_BRONGAT','VERDWENEN_UIT_SNAPSHOT','HERSTELD_BEVESTIGD','HERSTELD_AFGELEID'].includes(r.levenscyclus_status),_bronBestand:b.naam}));
    });
    const nieuweRijen=bronnen.flatMap(b=>b.rijen||[]);
    const nieuwPeil=Math.max(0,...bronnen.map(b=>b.peildatum||0))||Date.now();
    const bronNaam=bronnen.map(b=>b.naam).join(' + ');
    const archivedCount=archiveerVerdwenen(oudeRijen,nieuweRijen,nieuwPeil,bronNaam);
    const onzeker=globalThis.__BIDASH_ONZEKERE_LIVE__||[];
    if(onzeker.length)bronnen.push({key:'__onzekere_snapshot__',naam:'Meldingen zonder bewezen vervolg',rijen:onzeker,peildatum:nieuwPeil,virtueel:true,afgeleidVan:'onzekereMomentopname'});
    nieuweRijen.push(...onzeker);
    LIVE_STORINGSBRONNEN=bronnen;
    LIVE_PEILDATUM=nieuwPeil;
    LIVE_STORINGS_INSPECTIE=inspecteerStoringsRijen(nieuweRijen);
    ANALYSE_SIGNATURE='';
    return {liveCount:nieuweRijen.length,archivedCount};
  }

  voegLiveBronnenToe=function(bronnen){return vervangLiveBronnen(bronnen);};

  leesLiveStoringsBestanden=async function(fileList){
    const files=[...fileList];if(!files.length)return;
    if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De open storingen worden rechtstreeks aan dat stamregister gekoppeld.');return;}
    const nieuw=[],fouten=[];
    for(const file of files){
      zetImportVoortgang(file.name,0,'Open-storingenbestand voorbereiden',{direct:true});await uiPauze();
      try{
        const bron=await leesOpenStoringenBron(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*82,fa));
        if(!inspecteerStoringsRijen(bron.rijen).herkenbaar)throw new Error('geen herkenbare DVM-storingen gevonden in dit bestand');
        bron._fileLastModified=Number(file.lastModified)||0;
        nieuw.push(bron);
        zetImportVoortgang(file.name,86,'Open meldingen activeren',{direct:true});await uiPauze();
      }catch(err){fouten.push(file.name+': '+err.message);importMislukt(file.name,err.message);}
    }
    if(fouten.length){alert('Import afgebroken; vorige stand behouden. Niet alle bronbestanden zijn gelezen:\n'+fouten.join('\n'));return;}
    if(nieuw.length){
      const resultaat=vervangLiveBronnen(nieuw);
      zetImportVoortgang(nieuw[nieuw.length-1].naam,94,'Actueel dienstimpactbeeld berekenen',{direct:true});await uiPauze();
      probeerAnalyseActiveren('overzicht',{inspectieAlGereed:true,matchAlGereed:false});
      const tekst=resultaat.archivedCount
        ? resultaat.liveCount.toLocaleString('nl-NL')+' technische meldingen geladen. '+resultaat.archivedCount.toLocaleString('nl-NL')+' verdwenen melding(en) hebben geen bewezen vervolg; ze blijven zichtbaar als onbekend en zijn aan de historie toegevoegd.'
        : resultaat.liveCount.toLocaleString('nl-NL')+' technische meldingen geladen. Geen verdwenen meldingen gevonden.';
      zetStoringsImportStatus(tekst);importKlaar(nieuw[nieuw.length-1].naam,tekst);
    }else renderDataGereedheid();
    if(fouten.length)alert('Niet alle open-storingenbestanden konden worden geladen:\n'+fouten.join('\n'));
  };

  globalThis.__BIDASH_DVM_LIVE_PATCH_ACTIVE__=true;
})();`;

export function installDvmLiveSnapshotPatch(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_DVM_LIVE_PATCH_ACTIVE__)return true;
  scope.__BIDASH_LIVE_SNAPSHOT_HELPERS__={liveIncidentKey,diffSnapshot,closeHistoryRow,useTargetedLiveXlsx};
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_DVM_LIVE_PATCH_ACTIVE__;
  }catch(error){
    console.error('BiDash live-storingenpatch kon niet worden gestart.',error);
    return false;
  }
}
