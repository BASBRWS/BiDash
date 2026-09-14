const norm=v=>String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ');

export function liveIncidentKey(parts={}){
  const eventId=norm(parts.eventId);
  if(eventId)return `EVENT|${eventId}`;
  return [
    'ROW',norm(parts.typeId),norm(parts.assetId),String(parts.start||''),
    norm(parts.road),norm(parts.direction),parts.hm==null?'':Number(parts.hm).toFixed(3),
    norm(parts.lane),norm(parts.faultCode),norm(parts.message),norm(parts.effect)
  ].join('|');
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

export function closeHistoryRow(raw,{closedAt,startAt,sourceFile}={}){
  const out={...(raw||{})};
  const time=Number(closedAt)||Date.now();
  const iso=new Date(time).toISOString();
  setColumn(out,['tot','einde','end'],'tot',iso);
  setColumn(out,['status'],'status','gesloten');
  setColumn(out,['open'],'open','nee');
  const start=Number(startAt);
  if(Number.isFinite(start)&&start>0&&time>=start){
    const hours=(time-start)/3600000,days=hours/24;
    setColumn(out,['storingsduur_uren','duur_uur','duration_hours'],'storingsduur_uren',hours);
    setColumn(out,['storingsduur_peildatum','aantal_dagen'],'storingsduur_peildatum',days);
  }
  out._liveOpen=false;
  out._afgeslotenDoorNieuweMomentopname=true;
  out._afsluitPeildatum=iso;
  out._afsluitBronBestand=String(sourceFile||'');
  return out;
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
      eventId:m.eventId,typeId,assetId,start:m.tVan,road:m.weg,direction:m.richting,hm:m.hm,
      lane:m.strook,faultCode,message:m.melding,effect:m.gevolg
    });
  }

  function archiveerVerdwenen(oudeRijen,nieuweRijen,peildatum,bronNaam){
    const verdwenen=H.diffSnapshot(oudeRijen,nieuweRijen,sleutel);
    if(!verdwenen.length)return 0;
    const historisch=new Set(gecombineerdeStoringsRijen().map(sleutel));
    const toevoegen=[];
    for(const raw of verdwenen){
      const m=normRij(raw),typeId=classificeer(m);
      if(typeId!=='MSI')continue;
      const key=sleutel(raw);if(historisch.has(key))continue;historisch.add(key);
      toevoegen.push(H.closeHistoryRow(raw,{closedAt:peildatum,startAt:m.tVan,sourceFile:bronNaam}));
    }
    if(!toevoegen.length)return 0;
    const datum=new Date(peildatum).toISOString().slice(0,10),key='auto-live-afgesloten-'+datum;
    let bron=STORINGSBRONNEN.find(b=>b.key===key);
    if(!bron){bron={key,naam:'Automatisch afgesloten signaalgeverstoringen '+datum,rijen:[],size:0,doel:'historie-auto'};STORINGSBRONNEN.push(bron);}
    bron.rijen.push(...toevoegen);
    return toevoegen.length;
  }

  function vervangLiveBronnen(bronnen){
    if(!bronnen.length)return {liveCount:0,archivedCount:0};
    const oudeRijen=gecombineerdeLiveStoringsRijen().slice();
    bronnen.forEach(b=>{
      b.peildatum=bronPeildatum(b)||Number(b._fileLastModified)||Date.now();
      b.doel='live-open';
      b.rijen=(b.rijen||[]).map(r=>({...r,_liveOpen:true,_bronBestand:b.naam}));
    });
    const nieuweRijen=bronnen.flatMap(b=>b.rijen||[]);
    const nieuwPeil=Math.max(0,...bronnen.map(b=>b.peildatum||0))||Date.now();
    const bronNaam=bronnen.map(b=>b.naam).join(' + ');
    const archivedCount=archiveerVerdwenen(oudeRijen,nieuweRijen,nieuwPeil,bronNaam);
    LIVE_STORINGSBRONNEN=bronnen;
    LIVE_PEILDATUM=nieuwPeil;
    STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
    LIVE_STORINGS_INSPECTIE=inspecteerStoringsRijen(nieuweRijen);
    ANALYSE_SIGNATURE='';
    herbouwAssetMatchBeeld();
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
        const bron=await storingsBronUitBestand(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*82,fa));
        if(!inspecteerStoringsRijen(bron.rijen).herkenbaar)throw new Error('geen herkenbare DVM-storingen gevonden in dit bestand');
        bron._fileLastModified=Number(file.lastModified)||0;
        nieuw.push(bron);
        zetImportVoortgang(file.name,86,'Open meldingen vergelijken met vorige momentopname',{direct:true});
      }catch(err){fouten.push(file.name+': '+err.message);importMislukt(file.name,err.message);}
    }
    if(nieuw.length){
      const resultaat=vervangLiveBronnen(nieuw);
      zetImportVoortgang(nieuw[nieuw.length-1].naam,96,'Actueel dienstimpactbeeld en historie bijwerken',{direct:true});await uiPauze();
      probeerAnalyseActiveren('overzicht',{inspectieAlGereed:true,matchAlGereed:true});
      const tekst=resultaat.archivedCount
        ? resultaat.liveCount.toLocaleString('nl-NL')+' open meldingen geladen. '+resultaat.archivedCount.toLocaleString('nl-NL')+' verdwenen signaalgeverstoring(en) zijn afgesloten en aan de storingshistorie toegevoegd.'
        : resultaat.liveCount.toLocaleString('nl-NL')+' open meldingen geladen. Geen verdwenen signaalgeverstoringen gevonden.';
      zetStoringsImportStatus(tekst);importKlaar(nieuw[nieuw.length-1].naam,tekst);
    }else renderDataGereedheid();
    if(fouten.length)alert('Niet alle open-storingenbestanden konden worden geladen:\n'+fouten.join('\n'));
  };

  globalThis.__BIDASH_DVM_LIVE_PATCH_ACTIVE__=true;
})();`;

export function installDvmLiveSnapshotPatch(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_DVM_LIVE_PATCH_ACTIVE__)return true;
  scope.__BIDASH_LIVE_SNAPSHOT_HELPERS__={liveIncidentKey,diffSnapshot,closeHistoryRow};
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_DVM_LIVE_PATCH_ACTIVE__;
  }catch(error){
    console.error('BiDash live-storingenpatch kon niet worden gestart.',error);
    return false;
  }
}
