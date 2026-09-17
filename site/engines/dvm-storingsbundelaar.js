/* Signaalgeverbundelaar: leest de ruwe MTM-storinglijsten
   (X:/mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>) rechtstreeks in BiDash en bouwt
   daaruit de open storingen en de historie, zonder tussen-JSON. Alleen wat BiDash
   gebruikt wordt bewaard: de open alarmen (eindstatus open_aan_einde) en de
   geclassificeerde storingen. De ruwe alarmruns en episodes blijven in het geheugen
   en worden niet opgeslagen, zodat de werkruimte klein blijft.

   De parsinglogica is een BiDash-poort van de lokale bundelaar-HTML (v2.5). De pure
   functies (sb*) hebben geen DOM-afhankelijkheid, zodat een test ze los kan draaien.
   De handler leesSignaalgeverMap() koppelt het geheel aan Datasetbeheer. */
(() => {
  'use strict';
  const MSI_DEGRADATIE=new Set(['1001','1002','1061','6002']);
  const DETECTOR_CODES=new Set(['1005','1006','1007','1008','4017','4019','5004']);
  const SYSTEEM_CODES=new Set(['1011','2001','4006','4014','4015','4020','4021','4023','4027','6005']);

  function sbGroupBy(arr,fn){const uit={};for(const x of arr){const k=fn(x);(uit[k]||(uit[k]=[])).push(x);}return uit;}
  function sbVcAlias(x){const k=String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');return ({mn:'mn',non:'non',nonzwn:'non',nwn:'nwn',wnn:'nwn',zwn:'zwn',wnz:'zwn',zn:'zn'})[k]||null;}
  function sbGeldigeDatum(y,m,d){const x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null;}
  function sbParseDT(s){const m=String(s).match(/(\d{2})[-/.](\d{2})[-/.](\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);if(!m)return null;let y=+m[3];if(y<100)y+=2000;return sbGeldigeDatum(y,+m[2],+m[1])?new Date(y,+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0)):null;}
  function sbMediaan(a){a=[...a].sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:30;}
  function sbLocatie(s){s=String(s||'').trim().replace(/\s+/g,' ');const p=s.split(' '),k=s.match(/(-?\d+[,.]\d+)\s*$/);return {locatie:s,weg:p[0]||'',richting_kenmerk:p.slice(1,k?-1:undefined).join(' '),km:k?+k[1].replace(',','.'):null};}
  function sbMtmCategorie(code,desc){
    const d=String(desc||'').toLowerCase();
    /* Detector- en lusalarmen zijn een eigen DVM-bron voor de detectieschakel.
       Bewaar ze daarom in de open momentopname en historie. Een onbekende
       detectorcode blijft zichtbaar zonder impact totdat een passende LUS-regel
       is vastgelegd; uitsluiten bij de bron zou de storing volledig verbergen. */
    if(DETECTOR_CODES.has(code)||/detectorstation|\bdet\.?\s*\d+|beide lussen|een lus goed/i.test(d))return ['DETECTOR',true,'DETECTOR'];
    if(/\bmsi\s*\d+/i.test(d))return ['MSI',true,code==='1003'||d.includes('fatale fout')?'UITVAL':MSI_DEGRADATIE.has(code)?'DEGRADATIE':'MSI_FOUT'];
    if(SYSTEEM_CODES.has(code)||/wisselbord|hoofdvoeding|noodvoeding|communicatie met os|os zelfstandig/i.test(d))return ['SYSTEEM',true,/uitgevallen|uitgeschakeld/.test(d)?'SYSTEEM_UITVAL':'SYSTEEM_FOUT'];
    return ['OVERIG',false,'OVERIG'];
  }
  function sbSnapshotDatum(text,naam){
    for(const l of String(text).split(/\r?\n/).slice(0,100)){if(l.trim().startsWith('|'))continue;const d=sbParseDT(l);if(d)return d;}
    const m=String(naam||'').match(/(?:^|[^\d])(\d{2})(\d{2})(\d{2})(?:_|\b)/);
    return m?new Date(2000+ +m[3],+m[2]-1,+m[1],0,30):null;
  }
  /* Eén MTM-storinglijstbestand → alarmregels. */
  function sbMtmRijenUitTekst(text,vc){
    const rows=[];
    for(const regel of String(text).split(/\r?\n/)){
      if(!regel.startsWith('|'))continue;
      const p=regel.replace(/^\||\|$/g,'').split('|');
      if(p.length<5)continue;
      const id=p[0].trim(),code=p[1].trim(),start=sbParseDT(p.at(-1)),loc=sbLocatie(p.at(-2));
      const desc=p.slice(2,-2).join('|').replace(new RegExp('^\\s*'+code+'\\s+'),'').trim();
      const cat=sbMtmCategorie(code,desc);
      const m=desc.match(/\bMSI\s*(\d+)/i),unit=m?'MSI '+(+m[1]):cat[0]==='SYSTEEM'?'SYSTEEM':cat[0]==='DETECTOR'?'DETECTOR':'OVERIG';
      rows.push({event_key:vc+'|'+id,event_id:id,code,start:start?start.toISOString():null,description:desc,locatie:loc.locatie,weg:loc.weg,richting_kenmerk:loc.richting_kenmerk,km:loc.km,categorie:cat[0],meenemen:cat[1],impact:cat[2],unit,asset_key:vc+'|'+loc.locatie+'|'+unit});
    }
    return rows;
  }
  /* Episodeclustering: langdurig (≥ uren) en intermitterend (≥ min episodes binnen
     venster). Identiek aan de bundelaar-HTML. */
  function sbClassificeer(eps,opties){
    const uren=opties.langUur,min=opties.minEpisodes,win=opties.vensterMin,out=[];
    const groepen=sbGroupBy(eps,x=>x.asset_key);
    for(const g of Object.values(groepen)){
      g.sort((a,b)=>String(a.start).localeCompare(String(b.start)));
      const gebruikt=new Set();
      for(let i=0;i<=g.length-min;i++){
        const c=g.slice(i,i+min);
        if((new Date(c.at(-1).start)-new Date(c[0].start))/60000<=win){
          c.forEach(x=>gebruikt.add(x));
          out.push({...c[0],classificatie:c.some(x=>x.duur_min_uur>=uren)?'LANGDURIG + INTERMITTEREND':'INTERMITTEREND',einde_bewezen:c.at(-1).einde_bewezen,aantal_cycli:c.length,totale_storingsduur_uur:+c.reduce((s,x)=>s+x.duur_min_uur,0).toFixed(6)});
        }
      }
      for(const x of g)if(x.duur_min_uur>=uren&&!gebruikt.has(x))out.push({...x,classificatie:'LANGDURIG',aantal_cycli:1,totale_storingsduur_uur:x.duur_min_uur});
    }
    return out;
  }
  /* Snapshots (per bestand) → open alarmen + geclassificeerde storingen. Bepaalt per
     verkeerscentrale de betrouwbare snapshot-afstand en reconstrueert alarmruns. */
  function sbBouwBundel(snapshots,opties){
    opties=Object.assign({langUur:4,minEpisodes:3,vensterMin:60},opties||{});
    const lijst=[...snapshots].sort((a,b)=>String(a.snapshot).localeCompare(String(b.snapshot)));
    const alarmRuns=[],perVC=sbGroupBy(lijst,x=>x.vc);
    for(const [vc,ss] of Object.entries(perVC)){
      const tijden=[...new Set(ss.map(x=>+new Date(x.snapshot)))].sort((a,b)=>a-b);
      const verschillen=tijden.slice(1).map((x,i)=>(x-tijden[i])/60000).filter(x=>x<=360);
      const limiet=Math.min(360,Math.max(90,sbMediaan(verschillen)*3));
      const actief=new Map();let vorige=null;
      for(const s of ss){
        const nu=new Date(s.snapshot),betrouwbaar=vorige!==null&&(nu-vorige)/60000<=limiet,huidig=new Map(s.rows.map(r=>[r.event_key,r]));
        for(const [k,r] of [...actief])if(!huidig.has(k)){alarmRuns.push({...r,einde_bovengrens:betrouwbaar?s.snapshot:null,eindstatus:betrouwbaar?'gesloten':'einde_onzeker_datagat'});actief.delete(k);}
        if(vorige&&!betrouwbaar)for(const [k,r] of [...actief]){alarmRuns.push({...r,einde_bovengrens:null,eindstatus:'gesplitst_door_datagat'});actief.delete(k);}
        for(const [k,r] of huidig){if(!actief.has(k))actief.set(k,{...r,verkeerscentrale:vc,eerste_snapshot:s.snapshot,laatste_snapshot:s.snapshot,snapshots_gezien:1});else{const a=actief.get(k);a.laatste_snapshot=s.snapshot;a.snapshots_gezien++;}}
        vorige=nu;
      }
      for(const r of actief.values())alarmRuns.push({...r,einde_bovengrens:null,eindstatus:'open_aan_einde'});
    }
    const episodes=alarmRuns.filter(r=>r.meenemen).map(r=>{
      const start=r.start||r.eerste_snapshot,duur=Math.max(0,(new Date(r.laatste_snapshot)-new Date(start))/3600000);
      return {systeem:'mtm',verkeerscentrale:r.verkeerscentrale,locatie:r.locatie,weg:r.weg,richting_kenmerk:r.richting_kenmerk,km:r.km,asset:r.unit,asset_key:r.asset_key,start,einde_bewezen:r.laatste_snapshot,einde_bovengrens:r.einde_bovengrens,duur_min_uur:+duur.toFixed(6),foutcode:r.code,impactklasse:r.impact,omschrijving:r.description,kwaliteitsstatus:r.eindstatus};
    });
    const storingen=sbClassificeer(episodes,opties);
    const open=alarmRuns.filter(r=>r.eindstatus==='open_aan_einde'&&r.meenemen);
    return {open,storingen};
  }
  /* Bestandspad → MTM-context (vc, datum). Geen match = geen MTM-storinglijst. */
  function sbPadInfoMtm(pad){
    const a=String(pad).replace(/\\/g,'/').toLowerCase().split('/').filter(Boolean);
    let root=-1;for(let i=0;i<a.length;i++)if(a[i]==='mtm')root=i;
    if(root<0)return null;
    const vc=sbVcAlias(a[root+1]);if(!vc)return null;
    if(a[root+2]!=='storinglijst')return null;
    if(!/^20\d{2}$/.test(a[root+3]||''))return null;
    const jaar=+a[root+3],maand=+(a[root+4]||'');if(!(maand>=1&&maand<=12))return null;
    const d=sbGeldigeDatum(jaar,maand,+(a[root+5]||''));if(!d)return null;
    if(a.length<root+7)return null; // er moet nog een bestandsnaam achter de dag staan
    return {vc,jaar,maand,datum:d};
  }
  function sbPad(f){return String(f.webkitRelativePath||f._pad||f.name||'').replace(/\\/g,'/');}
  function sbBestandGeschikt(f){
    const naam=String(f.name||'').toLowerCase();
    if(!/\.(txt|log|dat|csv)$/.test(naam)&&/\.[a-z0-9]+$/.test(naam))return false; // met extensie: alleen tekstachtig
    return !!sbPadInfoMtm(sbPad(f));
  }
  function sbDecode(buffer){
    try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
    catch(err){try{return new TextDecoder('windows-1252').decode(buffer);}catch(e){return new TextDecoder('utf-8').decode(buffer);}}
  }
  async function sbLeesTekst(file){
    const bron=file&&file._handle?await file._handle.getFile():file;
    if(typeof leesBlobAlsArrayBuffer==='function')return sbDecode(await leesBlobAlsArrayBuffer(bron,20000,'een storingsbestand kon niet op tijd worden gelezen'));
    return sbDecode(await bron.arrayBuffer());
  }
  /* ── Mapkeuze via de File System Access API (showDirectoryPicker) ──────────────
     Loopt alleen mtm/<gekozen vc>/storinglijst/<gekozen periode> af en snoeit de rest
     (cdms, andere systemen, jaren/maanden buiten de periode) tijdens het aflopen, zodat
     de enorme X-schijf niet volledig wordt gelezen. Levert bestand-achtige objecten met
     een _handle en een _pad, zodat de bestaande filter- en leesroute werkt. */
  function sgHeeftDirPicker(){try{return typeof window.showDirectoryPicker==='function';}catch(e){return false;}}
  function sgBuitenPeriode(jaar,maand,dag,config){
    const vanaf=config.vanaf?new Date(config.vanaf+'T00:00:00'):null,tot=config.tot?new Date(config.tot+'T23:59:59'):null;
    let a,b;
    if(dag!=null){a=new Date(jaar,maand-1,dag);b=new Date(jaar,maand-1,dag,23,59,59);}
    else if(maand!=null){a=new Date(jaar,maand-1,1);b=new Date(jaar,maand,0,23,59,59);}
    else{a=new Date(jaar,0,1);b=new Date(jaar,11,31,23,59,59);}
    return (tot&&a>tot)||(vanaf&&b<vanaf);
  }
  function sgVolgendeCtx(ctx,laag,config){
    const vcs=config.vcs;
    switch(ctx.fase){
      case 'root': return laag==='mtm'?{fase:'mtm',vc:''}:null;
      case 'mtm': {const v=sbVcAlias(laag);return v&&(!vcs||!vcs.size||vcs.has(v))?{fase:'vc',vc:v}:null;}
      case 'vc': return laag==='storinglijst'?{fase:'storinglijst',vc:ctx.vc}:null;
      case 'storinglijst': return /^20\d{2}$/.test(laag)&&!sgBuitenPeriode(+laag,null,null,config)?{fase:'jaar',vc:ctx.vc,jaar:+laag}:null;
      case 'jaar': {const m=+laag;return /^\d{1,2}$/.test(laag)&&m>=1&&m<=12&&!sgBuitenPeriode(ctx.jaar,m,null,config)?{fase:'maand',vc:ctx.vc,jaar:ctx.jaar,maand:m}:null;}
      case 'maand': {const d=+laag;return /^\d{1,2}$/.test(laag)&&sbGeldigeDatum(ctx.jaar,ctx.maand,d)&&!sgBuitenPeriode(ctx.jaar,ctx.maand,d,config)?{fase:'dag',vc:ctx.vc,jaar:ctx.jaar,maand:ctx.maand,dag:d}:null;}
      case 'dag': return {fase:'dag',vc:ctx.vc,jaar:ctx.jaar,maand:ctx.maand,dag:ctx.dag};
      default: return null;
    }
  }
  async function sgVerzamelViaHandle(dirHandle,config,onVoortgang){
    const startNaam=String(dirHandle.name||'').toLowerCase();
    let startFase='root';
    if(startNaam==='mtm')startFase='mtm';
    else if(sbVcAlias(startNaam))startFase='vc';
    else if(startNaam==='storinglijst')startFase='storinglijst';
    const files=[],stack=[{h:dirHandle,ctx:{fase:startFase,vc:sbVcAlias(startNaam)||''}}];
    let mappen=0;
    while(stack.length){
      const {h,ctx}=stack.pop();mappen++;
      for await(const [naam,kind] of h.entries()){
        if(kind.kind==='directory'){
          const volgende=sgVolgendeCtx(ctx,String(naam).toLowerCase(),config);
          if(volgende)stack.push({h:kind,ctx:volgende});
        }else if(ctx.fase==='dag'){
          files.push({name:naam,_handle:kind,_pad:'mtm/'+ctx.vc+'/storinglijst/'+ctx.jaar+'/'+ctx.maand+'/'+ctx.dag+'/'+naam});
        }
      }
      if(mappen%15===0){if(onVoortgang)onVoortgang(mappen,files.length);await new Promise(r=>setTimeout(r));}
    }
    if(onVoortgang)onVoortgang(mappen,files.length);
    return files;
  }
  /* Selecteer alleen de bestanden voor de gekozen regio's en periode. Zo wordt niet
     in één keer de hele X-schijf gelezen. vcs is een Set met vc-codes (leeg = alle). */
  function sbFilterBestanden(files,opties){
    opties=opties||{};
    const vcs=opties.vcs,vanaf=opties.vanaf?new Date(opties.vanaf+'T00:00:00'):null,tot=opties.tot?new Date(opties.tot+'T23:59:59'):null;
    const uit=[];
    for(const f of files){
      if(!sbBestandGeschikt(f))continue;
      const info=sbPadInfoMtm(sbPad(f));
      if(vcs&&vcs.size&&!vcs.has(info.vc))continue;
      if(vanaf&&info.datum<vanaf)continue;
      if(tot&&info.datum>tot)continue;
      uit.push(f);
    }
    return uit;
  }
  /* Combineer met een eerder totaal-JSON: vervang in de basis de gekozen regio's door
     de nieuw gelezen gegevens en houd de overige regio's ongewijzigd. */
  function sbCombineerMetBasis(basisMtm,nieuwOpen,nieuwStoringen,vcs){
    basisMtm=basisMtm||{};
    const vervang=r=>{const v=sbVcAlias(r&&r.verkeerscentrale);return vcs&&vcs.size?vcs.has(v):true;};
    const basisOpen=(Array.isArray(basisMtm.alarm_episodes)?basisMtm.alarm_episodes:[]).filter(r=>!vervang(r));
    const basisStoringen=(Array.isArray(basisMtm.storingen)?basisMtm.storingen:[]).filter(r=>!vervang(r));
    return {alarm_episodes:[...basisOpen,...nieuwOpen],storingen:[...basisStoringen,...nieuwStoringen]};
  }
  /* Laatste datum per verkeerscentrale uit een datasets.mtm-blok (storingen +
     alarm_episodes). Zo ziet de gebruiker tot wanneer een basisbestand geladen is. */
  function sbWatermerken(mtm){
    mtm=mtm||{};const uit={};
    const bekijk=(arr,velden)=>{for(const r of (Array.isArray(arr)?arr:[])){const v=sbVcAlias(r&&r.verkeerscentrale);if(!v)continue;let d='';for(const veld of velden){const w=String(r[veld]||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(w)&&w>d)d=w;}if(d&&(!uit[v]||d>uit[v]))uit[v]=d;}};
    bekijk(mtm.storingen,['start','einde_bewezen','laatste_bewezen_aanwezig']);
    bekijk(mtm.alarm_episodes,['laatste_snapshot','start','eerste_snapshot']);
    return uit;
  }
  function sbWatermerkTekst(wm){
    const rijen=Object.entries(wm||{}).sort();
    return rijen.length?rijen.map(([v,d])=>v.toUpperCase()+' '+d).join(', '):'geen datum herkend';
  }
  const SG_VCS=[['mn','MN'],['non','NON'],['nwn','NWN / WNN'],['zwn','ZWN / WNZ'],['zn','ZN']];
  /* Configuratiedialoog: kies regio('s), optioneel een periode en optioneel een
     basisbestand, zodat niet in één keer te veel wordt gelezen. */
  function openSignaalgeverMapDialog(){
    if(typeof ASSET_REGISTER_STATE==='undefined'||!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De storingsmap wordt rechtstreeks aan dat stamregister gekoppeld.');return;}
    let dlg=document.getElementById('sgMapDialog');
    if(!dlg){
      dlg=document.createElement('dialog');dlg.id='sgMapDialog';
      dlg.style.cssText='max-width:520px;border:1px solid #d4dbe2;border-radius:10px;padding:0';
      dlg.innerHTML=`<form method="dialog" style="padding:18px 20px;font:13px/1.5 inherit">
        <h3 style="margin:0 0 4px">Signaalgevers uit map lezen (MTM)</h3>
        <p style="margin:0 0 10px;color:#566574">Beperk wat er in één keer wordt gelezen. Kies eerst regio('s) en eventueel een periode; kies daarna de map. In Edge/Chrome mag je gewoon de X-schijf kiezen — BiDash daalt zelf alleen af in <code>mtm</code> en de gekozen regio/periode. Lukt de moderne mapkiezer niet, kies dan <b>X:\\mtm</b> (niet heel X:), anders leest de browser de hele schijf in.</p>
        <div id="sgHuidig" style="margin:0 0 10px;padding:8px 10px;background:#f0f6fb;border:1px solid #cfe0ee;border-radius:6px;font-size:12px"></div>
        <fieldset style="border:1px solid #d4dbe2;border-radius:6px;margin:0 0 10px;padding:8px 10px"><legend style="font-weight:700">Verkeerscentrales</legend>
          ${SG_VCS.map(([v,l])=>`<label style="display:inline-block;margin:3px 14px 3px 0"><input type="checkbox" class="sgVc" value="${v}"> ${l}</label>`).join('')}
        </fieldset>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">
          <label>Vanaf<br><input type="date" id="sgVanaf" style="padding:6px;border:1px solid #9ca8b4;border-radius:5px"></label>
          <label>Tot en met<br><input type="date" id="sgTot" style="padding:6px;border:1px solid #9ca8b4;border-radius:5px"></label>
        </div>
        <label style="display:block;margin-bottom:6px">Optioneel basisbestand (eerder totaal-JSON, alleen de gekozen regio's worden bijgewerkt)<br><input type="file" id="sgBasis" accept=".json"></label>
        <p id="sgBasisInfo" style="margin:0 0 10px;font-size:12px;color:#107c10;min-height:15px"></p>
        <p id="sgMapMelding" style="color:#a4262c;min-height:16px;margin:0 0 10px"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" id="sgMapAnnuleer" class="tb-btn" style="background:#e5e9ed;color:#1f2933;border-color:#cfd6dd">Annuleren</button>
          <button type="button" id="sgMapVerder" class="tb-btn primary">Map kiezen en verwerken</button>
        </div></form>`;
      document.body.appendChild(dlg);
      dlg.querySelector('#sgMapAnnuleer').addEventListener('click',()=>dlg.close());
      dlg.querySelector('#sgBasis').addEventListener('change',async e=>{
        const info=dlg.querySelector('#sgBasisInfo'),f=e.target.files[0];
        if(!f){info.textContent='';return;}
        info.style.color='#566574';info.textContent='Basisbestand lezen…';
        try{const j=JSON.parse(await f.text());const wm=sbWatermerken((j&&j.datasets&&j.datasets.mtm)||{});info.style.color='#107c10';info.textContent='Basis geladen. Laatste datum per regio: '+sbWatermerkTekst(wm)+'.';}
        catch(err){info.style.color='#a4262c';info.textContent='Het basisbestand is geen geldige JSON.';}
      });
      dlg.querySelector('#sgMapVerder').addEventListener('click',async()=>{
        const vcs=new Set([...dlg.querySelectorAll('.sgVc:checked')].map(x=>x.value));
        const melding=dlg.querySelector('#sgMapMelding');
        if(!vcs.size){melding.textContent='Kies minstens één verkeerscentrale.';return;}
        const vanaf=dlg.querySelector('#sgVanaf').value||null,tot=dlg.querySelector('#sgTot').value||null;
        if(vanaf&&tot&&vanaf>tot){melding.textContent='De begindatum ligt na de einddatum.';return;}
        const config={vcs,vanaf,tot};
        const basisFile=dlg.querySelector('#sgBasis').files[0];
        if(basisFile){
          try{const j=JSON.parse(await basisFile.text());config.basisMtm=(j&&j.datasets&&j.datasets.mtm)||{};}
          catch(err){melding.textContent='Het basisbestand is geen geldige JSON.';return;}
        }
        window.__BIDASH_SG_MAP_CONFIG__=config;
        /* Voorkeur: showDirectoryPicker, die alleen mtm/<vc>/<periode> afloopt en de
           rest van X: overslaat. Terugval: de webkitdirectory-invoer (leest de hele
           gekozen map; kies dan X:\\mtm en niet heel X:). */
        if(sgHeeftDirPicker()){
          let dir=null;
          try{dir=await window.showDirectoryPicker({mode:'read',id:'bidash-mtm'});}
          catch(err){if(err&&err.name==='AbortError'){return;}dir=null;}
          if(dir){
            dlg.close();
            try{
              sgMapVoortgang(1,'Map doorzoeken (alleen mtm en de gekozen regio/periode)…');
              const files=await sgVerzamelViaHandle(dir,config,(m,f)=>sgMapVoortgang(Math.min(30,1+m/40),`Map doorzoeken: ${m.toLocaleString('nl-NL')} mappen bekeken, ${f.toLocaleString('nl-NL')} bestanden gevonden`));
              await leesSignaalgeverMap(files,config);
            }catch(err){/* leesSignaalgeverMap toont de fout al in het venster */if(!document.getElementById('sgMapProgress'))alert('Mislukt: '+(err&&err.message||err));}
            return;
          }
          // dir null (geblokkeerd in deze context): val terug op de mapinvoer.
        }
        dlg.close();
        const input=document.getElementById('signaalgeverMapInput');
        if(input)input.click();else alert('De mapkeuze is niet beschikbaar.');
      });
    }else{dlg.querySelector('#sgMapMelding').textContent='';dlg.querySelector('#sgBasisInfo').textContent='';}
    /* Toon wat er nu geladen is en tot welke datum, zodat de gebruiker weet wat de
       volgende te lezen regio/periode zou zijn. */
    const huidig=dlg.querySelector('#sgHuidig');
    const s=window.__BIDASH_SIGNAALGEVER_TOTAAL__;
    if(s&&(s.open||s.historie)){
      const dat=t=>t?new Date(t).toLocaleDateString('nl-NL'):'onbekend';
      const perVc=s.laatstePerVc&&Object.keys(s.laatstePerVc).length?Object.entries(s.laatstePerVc).sort().map(([v,t])=>v.toUpperCase()+' '+dat(t)).join(', '):'—';
      huidig.style.display='';
      huidig.innerHTML=`<b>Nu geladen:</b> ${s.bestand||'signaalgeverbron'} · laatste entry ${dat(s.laatsteEntry)}.<br>Per regio: ${perVc}.`;
    }else{huidig.style.display='none';huidig.textContent='';}
    dlg.showModal();
  }

  /* Zichtbaar voortgangsvenster tijdens het maplezen. Het data-gereedheidspaneel staat
     bovenaan de pagina en valt tijdens Datasetbeheer buiten beeld; dit venster staat
     vóór de gebruiker en toont fase, percentage en de uitkomst of fout. */
  function sgMapVenster(){
    let dlg=document.getElementById('sgMapProgress');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='sgMapProgress';
    dlg.style.cssText='max-width:460px;border:1px solid #d4dbe2;border-radius:10px;padding:0';
    dlg.innerHTML=`<div style="padding:18px 20px;font:13px/1.5 inherit">
      <h3 style="margin:0 0 8px">Signaalgevers uit map lezen</h3>
      <div id="sgPBalk" style="height:16px;border:1px solid #cfd6dd;border-radius:8px;background:#eef2f5;overflow:hidden"><div id="sgPVul" style="height:100%;width:0;background:#0078d4;transition:width .2s"></div></div>
      <p id="sgPFase" style="margin:8px 0 0;color:#1f2933" role="status" aria-live="polite">Voorbereiden…</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" id="sgPDownload" class="tb-btn primary" hidden>⭳ Download bijgewerkte JSON</button><button type="button" id="sgPSluit" class="tb-btn" style="background:#e5e9ed;color:#1f2933;border-color:#cfd6dd" hidden>Sluiten</button></div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#sgPSluit').addEventListener('click',()=>dlg.close());
    dlg.querySelector('#sgPDownload').addEventListener('click',()=>sgDownloadExport());
    return dlg;
  }
  function sgMapVoortgang(pct,fase){
    const dlg=sgMapVenster();if(!dlg.open)dlg.showModal();
    const vul=dlg.querySelector('#sgPVul'),f=dlg.querySelector('#sgPFase'),sluit=dlg.querySelector('#sgPSluit'),dl=dlg.querySelector('#sgPDownload');
    sluit.hidden=true;dl.hidden=true;vul.style.background='#0078d4';
    if(pct!=null)vul.style.width=Math.max(0,Math.min(100,pct))+'%';
    if(fase!=null)f.textContent=fase;
  }
  function sgMapVoltooid(tekst,fout){
    const dlg=sgMapVenster();if(!dlg.open)dlg.showModal();
    const vul=dlg.querySelector('#sgPVul'),f=dlg.querySelector('#sgPFase'),sluit=dlg.querySelector('#sgPSluit'),dl=dlg.querySelector('#sgPDownload');
    vul.style.width='100%';vul.style.background=fout?'#a4262c':'#107c10';
    f.style.color=fout?'#a4262c':'#1f2933';f.textContent=tekst;sluit.hidden=false;
    dl.hidden=!(sgLaatsteExport&&!fout);
  }
  /* Laatst gelezen mapresultaat als downloadbaar totaal-JSON (BiDash-lean: alleen open
     alarmen + storingen). Bruikbaar als basisbestand bij een volgende maplezing. */
  let sgLaatsteExport=null;
  function sgDownloadExport(){
    if(!sgLaatsteExport)return;
    try{
      const blob=new Blob([JSON.stringify(sgLaatsteExport.data)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=sgLaatsteExport.naam;document.body.appendChild(a);a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},3000);
    }catch(err){alert('Downloaden mislukt: '+(err&&err.message||err));}
  }

  /* Handler voor Datasetbeheer: een gekozen map (webkitdirectory) met MTM-
     storinglijsten → open storingen + historie, via dezelfde koppeling en
     doorrekening als de JSON-bron. De config (regio/periode/basis) komt uit de
     dialoog. */
  async function leesSignaalgeverMap(fileList,config){
    try{return await leesSignaalgeverMapKern(fileList,config);}
    catch(err){sgMapVoltooid('Mislukt: '+(err&&err.message||err),true);throw err;}
  }
  async function leesSignaalgeverMapKern(fileList,config){
    config=config||window.__BIDASH_SG_MAP_CONFIG__||{};
    if(typeof ASSET_REGISTER_STATE==='undefined'||!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De storingsmap wordt rechtstreeks aan dat stamregister gekoppeld.');if(typeof renderDataGereedheid==='function')renderDataGereedheid();return;}
    const alle=[...(fileList||[])];
    const bestanden=sbFilterBestanden(alle,config);
    const regios=config.vcs&&config.vcs.size?[...config.vcs].map(v=>v.toUpperCase()).join(', '):'alle';
    const periode=config.vanaf||config.tot?` (${config.vanaf||'begin'} t/m ${config.tot||'nu'})`:'';
    if(!bestanden.length)throw new Error(`geen MTM-storinglijsten gevonden voor regio ${regios}${periode}. Van de ${alle.length.toLocaleString('nl-NL')} gekozen bestanden viel er geen onder mtm/<vc>/storinglijst/<jaar>/<maand>/<dag> met de gekozen regio en periode. Controleer de map (kies de X-hoofdmap of de mtm-map), de regiokeuze en de periode.`);
    const label='Signaalgevers uit map ('+bestanden.length.toLocaleString('nl-NL')+' bestanden)';
    const startFase=`${bestanden.length.toLocaleString('nl-NL')} van ${alle.length.toLocaleString('nl-NL')} bestanden geselecteerd voor ${regios}${periode}; storinglijsten lezen`;
    sgMapVoortgang(2,startFase);
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,2,startFase,{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const snapshots=[];
    for(let n=0;n<bestanden.length;n++){
      const f=bestanden[n],info=sbPadInfoMtm(sbPad(f));
      let text;
      try{text=await sbLeesTekst(f);}catch(err){continue;}
      const snap=sbSnapshotDatum(text,f.name)||info.datum;
      const rows=sbMtmRijenUitTekst(text,info.vc);
      if(rows.length)snapshots.push({vc:info.vc,snapshot:new Date(snap).toISOString(),bestand:sbPad(f),rows});
      if(n%25===0){
        const pct=2+68*(n+1)/bestanden.length,fase=`Storinglijsten lezen: ${(n+1).toLocaleString('nl-NL')} / ${bestanden.length.toLocaleString('nl-NL')}`;
        sgMapVoortgang(pct,fase);
        if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,pct,fase,{direct:true});
        if(typeof uiPauze==='function')await uiPauze();
      }
    }
    if(!snapshots.length)throw new Error('de gevonden bestanden bevatten geen herkenbare storingsregels (regels beginnend met "|"). Controleer of dit MTM-storinglijsten zijn.');
    sgMapVoortgang(74,'Alarmruns en storingen reconstrueren…');
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,74,'Alarmruns en storingen reconstrueren',{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const bundel=sbBouwBundel(snapshots,{});
    /* Optioneel: combineer met een eerder totaal-JSON; alleen de gekozen regio's
       worden vervangen, de overige regio's blijven ongewijzigd. */
    const gecombineerd=config.basisMtm?sbCombineerMetBasis(config.basisMtm,bundel.open,bundel.storingen,config.vcs):{alarm_episodes:bundel.open,storingen:bundel.storingen};
    /* Downloadbaar totaal-JSON (BiDash-lean: alleen open alarmen + storingen), bruikbaar
       als basisbestand bij een volgende maplezing. */
    const tijdstip=new Date(),z=n=>String(n).padStart(2,'0');
    const stempel=`${tijdstip.getFullYear()}${z(tijdstip.getMonth()+1)}${z(tijdstip.getDate())}_${z(tijdstip.getHours())}${z(tijdstip.getMinutes())}`;
    sgLaatsteExport={data:{metadata:{versie:'2.5',herkomst:'bidash-maplezer',aangemaakt:tijdstip.toISOString(),watermarks:{mtm:sbWatermerken(gecombineerd)}},datasets:{mtm:gecombineerd}},naam:`MTM_totaal_bidash_${stempel}.json`};
    const pseudo={datasets:{mtm:gecombineerd},metadata:{versie:'maplezen'}};
    const {open,historie,versie}=signaalgeverTotaalBronnen(pseudo);
    sgMapVoortgang(88,'Open meldingen aan All Assets koppelen en doorrekenen…');
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,86,'Open meldingen aan All Assets koppelen',{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const naam='Signaalgevers uit map ('+regios+')';
    const {herkendOpen,herkendHist,laatsteEntry}=await pasSignaalgeverBundelToe(naam,open,historie,versie);
    window.__BIDASH_SG_MAP_CONFIG__=null;
    const laatste=laatsteEntry?new Date(laatsteEntry).toLocaleDateString('nl-NL'):'onbekend';
    const klaarTekst=`Klaar (${regios}): ${bestanden.length.toLocaleString('nl-NL')} bestanden → ${open.length.toLocaleString('nl-NL')} open (${herkendOpen.toLocaleString('nl-NL')} herkend), ${historie.length.toLocaleString('nl-NL')} historisch (${herkendHist.toLocaleString('nl-NL')} herkend). Laatste entry ${laatste}.`;
    sgMapVoltooid(open.length&&!herkendOpen?klaarTekst+' Let op: geen enkele open melding werd als MSI herkend, dus het actuele dashboard blijft leeg.':klaarTekst,open.length&&!herkendOpen);
    if(typeof importKlaar==='function')importKlaar(label,'Signaalgevers uit map gelezen. '+klaarTekst+' Vervangt de losse Open storingen- en Storingshistorie-bronnen.');
    /* Ook bij de showDirectoryPicker-route (die niet via de bron-inputhandler loopt)
       Datasetbeheer verversen en de schil op de hoogte brengen, zodat de kaart
       Signaalgevers totaal en het overzicht meteen bijwerken. */
    try{if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();}catch(err){}
    try{if(parent!==window)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:'signaalgeverMap'},location.origin);}catch(err){}
    return {bestanden:bestanden.length,open:open.length,historie:historie.length,herkendOpen,herkendHist};
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DRIP / CDMS
     Ruwe DRIP-logbestanden (X:/cdms/<vc>/log/<jaar>/<maand>/<dag>) zijn tab-
     gescheiden gebeurtenisregels. Poort van verwerkDRIP uit de bundelaar-HTML
     (v2.5). De episodeclassificatie deelt sbClassificeer met MTM. Het resultaat
     (datasets.drip: episodes + storingen) loopt via dezelfde koppeling en
     doorrekening als het DRIP-totaal JSON-bestand (pasDripBundelToe).
     ══════════════════════════════════════════════════════════════════════════ */
  function sbPadInfoDrip(pad){
    const a=String(pad).replace(/\\/g,'/').toLowerCase().split('/').filter(Boolean);
    let root=-1;for(let i=0;i<a.length;i++)if(a[i]==='cdms')root=i;
    if(root<0)return null;
    const vc=sbVcAlias(a[root+1]);if(!vc)return null;
    if(a[root+2]!=='log')return null;
    if(!/^20\d{2}$/.test(a[root+3]||''))return null;
    const jaar=+a[root+3],maand=+(a[root+4]||'');if(!(maand>=1&&maand<=12))return null;
    const d=sbGeldigeDatum(jaar,maand,+(a[root+5]||''));if(!d)return null;
    if(a.length<root+7)return null; // er moet nog een bestandsnaam achter de dag staan
    return {vc,jaar,maand,datum:d};
  }
  function sbDripBestandGeschikt(f){
    const naam=String(f.name||'').toLowerCase();
    if(!/\.(txt|log|dat|csv)$/.test(naam)&&/\.[a-z0-9]+$/.test(naam))return false;
    return !!sbPadInfoDrip(sbPad(f));
  }
  /* Eén DRIP-logbestand → gebeurtenissen. status (2|1): toestand+waarde
     URGENT/OK; power (2|6): waarde UIT/AAN. De kalenderdag komt uit het pad. */
  function sbDripEventsUitTekst(text,vc,datum,padnaam){
    const events=[],y=datum.getFullYear(),mo=datum.getMonth(),da=datum.getDate();
    for(const regel of String(text).split(/\r?\n/)){
      const p=regel.split('\t'),t=(p[0]||'').match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
      if(p.length<4||!t)continue;
      const ts=new Date(y,mo,da,+t[1],+t[2],+t[3]),asset=String(p[3]||'').trim(),loc=String(p[4]||'').trim();
      if(p[1]==='2'&&p[2]==='1'&&p.length>=8)events.push({vc,ts,asset,loc,type:'status',toestand:String(p[5]||'').trim().toUpperCase(),waarde:String(p[6]||'').trim().toUpperCase(),file:padnaam});
      else if(p[1]==='2'&&p[2]==='6'&&p.length>=6)events.push({vc,ts,asset,loc,type:'power',toestand:'',waarde:String(p[5]||'').trim().toUpperCase(),file:padnaam});
    }
    return events;
  }
  /* Gebeurtenissen (alle bestanden) → episodes (open/dicht) + geclassificeerde
     storingen. Wat aan het einde open blijft, krijgt kwaliteitsstatus 'open'. */
  function sbBouwDripBundel(events,opties){
    opties=Object.assign({langUur:4,minEpisodes:3,vensterMin:60},opties||{});
    const lijst=[...events].sort((a,b)=>a.ts-b.ts);
    const actief=new Map(),episodes=[];
    for(const e of lijst){
      const key=e.vc+'|'+e.asset+'|'+e.type+'|'+e.toestand;
      const open=e.type==='status'?e.waarde==='URGENT':e.waarde==='UIT';
      const dicht=e.type==='status'?e.waarde==='OK':e.waarde==='AAN';
      if(open&&!actief.has(key))actief.set(key,e);
      else if(dicht&&actief.has(key)){
        const s=actief.get(key);actief.delete(key);
        episodes.push({systeem:'drip',verkeerscentrale:e.vc,locatie:s.loc,asset:s.asset,asset_key:e.vc+'|'+s.asset,start:s.ts.toISOString(),einde_bewezen:e.ts.toISOString(),duur_min_uur:+((e.ts-s.ts)/3600000).toFixed(6),bron:e.type==='status'?'URGENT/OK':'UIT/AAN',bestanden:s.file+' | '+e.file});
      }
    }
    for(const s of actief.values())episodes.push({systeem:'drip',verkeerscentrale:s.vc,locatie:s.loc,asset:s.asset,asset_key:s.vc+'|'+s.asset,start:s.ts.toISOString(),einde_bewezen:null,duur_min_uur:0,bron:s.type==='status'?'URGENT/OK':'UIT/AAN',kwaliteitsstatus:'open'});
    const storingen=sbClassificeer(episodes,opties);
    const open=episodes.filter(e=>e.kwaliteitsstatus==='open');
    return {episodes,storingen,open};
  }
  function sbFilterDripBestanden(files,opties){
    opties=opties||{};
    const vcs=opties.vcs,vanaf=opties.vanaf?new Date(opties.vanaf+'T00:00:00'):null,tot=opties.tot?new Date(opties.tot+'T23:59:59'):null;
    const uit=[];
    for(const f of files){
      if(!sbDripBestandGeschikt(f))continue;
      const info=sbPadInfoDrip(sbPad(f));
      if(vcs&&vcs.size&&!vcs.has(info.vc))continue;
      if(vanaf&&info.datum<vanaf)continue;
      if(tot&&info.datum>tot)continue;
      uit.push(f);
    }
    return uit;
  }
  function sbCombineerMetDripBasis(basisDrip,nieuwEpisodes,nieuwStoringen,vcs){
    basisDrip=basisDrip||{};
    const vervang=r=>{const v=sbVcAlias(r&&r.verkeerscentrale);return vcs&&vcs.size?vcs.has(v):true;};
    const basisEp=(Array.isArray(basisDrip.episodes)?basisDrip.episodes:[]).filter(r=>!vervang(r));
    const basisSt=(Array.isArray(basisDrip.storingen)?basisDrip.storingen:[]).filter(r=>!vervang(r));
    return {episodes:[...basisEp,...nieuwEpisodes],storingen:[...basisSt,...nieuwStoringen]};
  }
  function sbDripWatermerken(drip){
    drip=drip||{};const uit={};
    const bekijk=arr=>{for(const r of (Array.isArray(arr)?arr:[])){const v=sbVcAlias(r&&r.verkeerscentrale);if(!v)continue;let d='';for(const veld of ['einde_bewezen','start']){const w=String(r[veld]||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(w)&&w>d)d=w;}if(d&&(!uit[v]||d>uit[v]))uit[v]=d;}};
    bekijk(drip.storingen);bekijk(drip.episodes);
    return uit;
  }
  /* Maptraversal voor DRIP: root → cdms → vc → log → jaar → maand → dag. */
  function sgVolgendeCtxDrip(ctx,laag,config){
    const vcs=config.vcs;
    switch(ctx.fase){
      case 'root': return laag==='cdms'?{fase:'cdms',vc:''}:null;
      case 'cdms': {const v=sbVcAlias(laag);return v&&(!vcs||!vcs.size||vcs.has(v))?{fase:'vc',vc:v}:null;}
      case 'vc': return laag==='log'?{fase:'log',vc:ctx.vc}:null;
      case 'log': return /^20\d{2}$/.test(laag)&&!sgBuitenPeriode(+laag,null,null,config)?{fase:'jaar',vc:ctx.vc,jaar:+laag}:null;
      case 'jaar': {const m=+laag;return /^\d{1,2}$/.test(laag)&&m>=1&&m<=12&&!sgBuitenPeriode(ctx.jaar,m,null,config)?{fase:'maand',vc:ctx.vc,jaar:ctx.jaar,maand:m}:null;}
      case 'maand': {const d=+laag;return /^\d{1,2}$/.test(laag)&&sbGeldigeDatum(ctx.jaar,ctx.maand,d)&&!sgBuitenPeriode(ctx.jaar,ctx.maand,d,config)?{fase:'dag',vc:ctx.vc,jaar:ctx.jaar,maand:ctx.maand,dag:d}:null;}
      case 'dag': return {fase:'dag',vc:ctx.vc,jaar:ctx.jaar,maand:ctx.maand,dag:ctx.dag};
      default: return null;
    }
  }
  async function sgVerzamelViaHandleDrip(dirHandle,config,onVoortgang){
    const startNaam=String(dirHandle.name||'').toLowerCase();
    let startFase='root';
    if(startNaam==='cdms')startFase='cdms';
    else if(sbVcAlias(startNaam))startFase='vc';
    else if(startNaam==='log')startFase='log';
    const files=[],stack=[{h:dirHandle,ctx:{fase:startFase,vc:sbVcAlias(startNaam)||''}}];
    let mappen=0;
    while(stack.length){
      const {h,ctx}=stack.pop();mappen++;
      for await(const [naam,kind] of h.entries()){
        if(kind.kind==='directory'){
          const volgende=sgVolgendeCtxDrip(ctx,String(naam).toLowerCase(),config);
          if(volgende)stack.push({h:kind,ctx:volgende});
        }else if(ctx.fase==='dag'){
          files.push({name:naam,_handle:kind,_pad:'cdms/'+ctx.vc+'/log/'+ctx.jaar+'/'+ctx.maand+'/'+ctx.dag+'/'+naam});
        }
      }
      if(mappen%15===0){if(onVoortgang)onVoortgang(mappen,files.length);await new Promise(r=>setTimeout(r));}
    }
    if(onVoortgang)onVoortgang(mappen,files.length);
    return files;
  }

  /* Configuratiedialoog voor DRIP (regio/periode/basis), parallel aan MTM. */
  function openDripMapDialog(){
    if(typeof ASSET_REGISTER_STATE==='undefined'||!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De DRIP-map wordt rechtstreeks aan dat stamregister gekoppeld.');return;}
    let dlg=document.getElementById('dgMapDialog');
    if(!dlg){
      dlg=document.createElement('dialog');dlg.id='dgMapDialog';
      dlg.style.cssText='max-width:520px;border:1px solid #d4dbe2;border-radius:10px;padding:0';
      dlg.innerHTML=`<form method="dialog" style="padding:18px 20px;font:13px/1.5 inherit">
        <h3 style="margin:0 0 4px">DRIP-storingen uit map lezen (CDMS)</h3>
        <p style="margin:0 0 10px;color:#566574">Beperk wat er in één keer wordt gelezen. Kies eerst regio('s) en eventueel een periode; kies daarna de map. In Edge/Chrome mag je gewoon de X-schijf kiezen — BiDash daalt zelf alleen af in <code>cdms</code> en de gekozen regio/periode. Lukt de moderne mapkiezer niet, kies dan <b>X:\\cdms</b> (niet heel X:), anders leest de browser de hele schijf in.</p>
        <div id="dgHuidig" style="margin:0 0 10px;padding:8px 10px;background:#f0f6fb;border:1px solid #cfe0ee;border-radius:6px;font-size:12px"></div>
        <fieldset style="border:1px solid #d4dbe2;border-radius:6px;margin:0 0 10px;padding:8px 10px"><legend style="font-weight:700">Verkeerscentrales</legend>
          ${SG_VCS.map(([v,l])=>`<label style="display:inline-block;margin:3px 14px 3px 0"><input type="checkbox" class="dgVc" value="${v}"> ${l}</label>`).join('')}
        </fieldset>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">
          <label>Vanaf<br><input type="date" id="dgVanaf" style="padding:6px;border:1px solid #9ca8b4;border-radius:5px"></label>
          <label>Tot en met<br><input type="date" id="dgTot" style="padding:6px;border:1px solid #9ca8b4;border-radius:5px"></label>
        </div>
        <label style="display:block;margin-bottom:6px">Optioneel basisbestand (eerder DRIP-totaal JSON, alleen de gekozen regio's worden bijgewerkt)<br><input type="file" id="dgBasis" accept=".json"></label>
        <p id="dgBasisInfo" style="margin:0 0 10px;font-size:12px;color:#107c10;min-height:15px"></p>
        <p id="dgMapMelding" style="color:#a4262c;min-height:16px;margin:0 0 10px"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" id="dgMapAnnuleer" class="tb-btn" style="background:#e5e9ed;color:#1f2933;border-color:#cfd6dd">Annuleren</button>
          <button type="button" id="dgMapVerder" class="tb-btn primary">Map kiezen en verwerken</button>
        </div></form>`;
      document.body.appendChild(dlg);
      dlg.querySelector('#dgMapAnnuleer').addEventListener('click',()=>dlg.close());
      dlg.querySelector('#dgBasis').addEventListener('change',async e=>{
        const info=dlg.querySelector('#dgBasisInfo'),f=e.target.files[0];
        if(!f){info.textContent='';return;}
        info.style.color='#566574';info.textContent='Basisbestand lezen…';
        try{const j=JSON.parse(await f.text());const wm=sbDripWatermerken((j&&j.datasets&&j.datasets.drip)||{});info.style.color='#107c10';info.textContent='Basis geladen. Laatste datum per regio: '+sbWatermerkTekst(wm)+'.';}
        catch(err){info.style.color='#a4262c';info.textContent='Het basisbestand is geen geldige JSON.';}
      });
      dlg.querySelector('#dgMapVerder').addEventListener('click',async()=>{
        const vcs=new Set([...dlg.querySelectorAll('.dgVc:checked')].map(x=>x.value));
        const melding=dlg.querySelector('#dgMapMelding');
        if(!vcs.size){melding.textContent='Kies minstens één verkeerscentrale.';return;}
        const vanaf=dlg.querySelector('#dgVanaf').value||null,tot=dlg.querySelector('#dgTot').value||null;
        if(vanaf&&tot&&vanaf>tot){melding.textContent='De begindatum ligt na de einddatum.';return;}
        const config={vcs,vanaf,tot};
        const basisFile=dlg.querySelector('#dgBasis').files[0];
        if(basisFile){
          try{const j=JSON.parse(await basisFile.text());config.basisDrip=(j&&j.datasets&&j.datasets.drip)||{};}
          catch(err){melding.textContent='Het basisbestand is geen geldige JSON.';return;}
        }
        window.__BIDASH_DG_MAP_CONFIG__=config;
        if(sgHeeftDirPicker()){
          let dir=null;
          try{dir=await window.showDirectoryPicker({mode:'read',id:'bidash-cdms'});}
          catch(err){if(err&&err.name==='AbortError'){return;}dir=null;}
          if(dir){
            dlg.close();
            try{
              dgMapVoortgang(1,'Map doorzoeken (alleen cdms en de gekozen regio/periode)…');
              const files=await sgVerzamelViaHandleDrip(dir,config,(m,f)=>dgMapVoortgang(Math.min(30,1+m/40),`Map doorzoeken: ${m.toLocaleString('nl-NL')} mappen bekeken, ${f.toLocaleString('nl-NL')} bestanden gevonden`));
              await leesDripMap(files,config);
            }catch(err){if(!document.getElementById('dgMapProgress'))alert('Mislukt: '+(err&&err.message||err));}
            return;
          }
        }
        dlg.close();
        const input=document.getElementById('dripMapInput');
        if(input)input.click();else alert('De mapkeuze is niet beschikbaar.');
      });
    }else{dlg.querySelector('#dgMapMelding').textContent='';dlg.querySelector('#dgBasisInfo').textContent='';}
    const huidig=dlg.querySelector('#dgHuidig');
    const s=window.__BIDASH_DRIP_TOTAAL__;
    if(s&&s.incidenten){
      const dat=t=>t?new Date(t).toLocaleDateString('nl-NL'):'onbekend';
      const perVc=s.laatstePerVc&&Object.keys(s.laatstePerVc).length?Object.entries(s.laatstePerVc).sort().map(([v,t])=>v.toUpperCase()+' '+dat(t)).join(', '):'—';
      huidig.style.display='';
      huidig.innerHTML=`<b>Nu geladen:</b> ${s.bestand||'DRIP-bron'} · ${Number(s.incidenten).toLocaleString('nl-NL')} incidenten · laatste entry ${dat(s.laatsteEntry)}.<br>Per regio: ${perVc}.`;
    }else{huidig.style.display='none';huidig.textContent='';}
    dlg.showModal();
  }
  function dgMapVenster(){
    let dlg=document.getElementById('dgMapProgress');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='dgMapProgress';
    dlg.style.cssText='max-width:460px;border:1px solid #d4dbe2;border-radius:10px;padding:0';
    dlg.innerHTML=`<div style="padding:18px 20px;font:13px/1.5 inherit">
      <h3 style="margin:0 0 8px">DRIP-storingen uit map lezen</h3>
      <div id="dgPBalk" style="height:16px;border:1px solid #cfd6dd;border-radius:8px;background:#eef2f5;overflow:hidden"><div id="dgPVul" style="height:100%;width:0;background:#0078d4;transition:width .2s"></div></div>
      <p id="dgPFase" style="margin:8px 0 0;color:#1f2933" role="status" aria-live="polite">Voorbereiden…</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" id="dgPDownload" class="tb-btn primary" hidden>⭳ Download bijgewerkte JSON</button><button type="button" id="dgPSluit" class="tb-btn" style="background:#e5e9ed;color:#1f2933;border-color:#cfd6dd" hidden>Sluiten</button></div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#dgPSluit').addEventListener('click',()=>dlg.close());
    dlg.querySelector('#dgPDownload').addEventListener('click',()=>dgDownloadExport());
    return dlg;
  }
  function dgMapVoortgang(pct,fase){
    const dlg=dgMapVenster();if(!dlg.open)dlg.showModal();
    const vul=dlg.querySelector('#dgPVul'),f=dlg.querySelector('#dgPFase'),sluit=dlg.querySelector('#dgPSluit'),dl=dlg.querySelector('#dgPDownload');
    sluit.hidden=true;dl.hidden=true;vul.style.background='#0078d4';
    if(pct!=null)vul.style.width=Math.max(0,Math.min(100,pct))+'%';
    if(fase!=null)f.textContent=fase;
  }
  function dgMapVoltooid(tekst,fout){
    const dlg=dgMapVenster();if(!dlg.open)dlg.showModal();
    const vul=dlg.querySelector('#dgPVul'),f=dlg.querySelector('#dgPFase'),sluit=dlg.querySelector('#dgPSluit'),dl=dlg.querySelector('#dgPDownload');
    vul.style.width='100%';vul.style.background=fout?'#a4262c':'#107c10';
    f.style.color=fout?'#a4262c':'#1f2933';f.textContent=tekst;sluit.hidden=false;
    dl.hidden=!(dgLaatsteExport&&!fout);
  }
  let dgLaatsteExport=null;
  function dgDownloadExport(){
    if(!dgLaatsteExport)return;
    try{
      const blob=new Blob([JSON.stringify(dgLaatsteExport.data)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=dgLaatsteExport.naam;document.body.appendChild(a);a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},3000);
    }catch(err){alert('Downloaden mislukt: '+(err&&err.message||err));}
  }
  async function leesDripMap(fileList,config){
    try{return await leesDripMapKern(fileList,config);}
    catch(err){dgMapVoltooid('Mislukt: '+(err&&err.message||err),true);throw err;}
  }
  async function leesDripMapKern(fileList,config){
    config=config||window.__BIDASH_DG_MAP_CONFIG__||{};
    if(typeof ASSET_REGISTER_STATE==='undefined'||!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De DRIP-map wordt rechtstreeks aan dat stamregister gekoppeld.');if(typeof renderDataGereedheid==='function')renderDataGereedheid();return;}
    const alle=[...(fileList||[])];
    const bestanden=sbFilterDripBestanden(alle,config);
    const regios=config.vcs&&config.vcs.size?[...config.vcs].map(v=>v.toUpperCase()).join(', '):'alle';
    const periode=config.vanaf||config.tot?` (${config.vanaf||'begin'} t/m ${config.tot||'nu'})`:'';
    if(!bestanden.length)throw new Error(`geen DRIP-logbestanden gevonden voor regio ${regios}${periode}. Van de ${alle.length.toLocaleString('nl-NL')} gekozen bestanden viel er geen onder cdms/<vc>/log/<jaar>/<maand>/<dag> met de gekozen regio en periode. Controleer de map (kies de X-hoofdmap of de cdms-map), de regiokeuze en de periode.`);
    const label='DRIP uit map ('+bestanden.length.toLocaleString('nl-NL')+' bestanden)';
    const startFase=`${bestanden.length.toLocaleString('nl-NL')} van ${alle.length.toLocaleString('nl-NL')} bestanden geselecteerd voor ${regios}${periode}; DRIP-logs lezen`;
    dgMapVoortgang(2,startFase);
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,2,startFase,{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const events=[];
    for(let n=0;n<bestanden.length;n++){
      const f=bestanden[n],info=sbPadInfoDrip(sbPad(f));
      let text;
      try{text=await sbLeesTekst(f);}catch(err){continue;}
      const eigen=sbDripEventsUitTekst(text,info.vc,info.datum,sbPad(f));
      for(const e of eigen)events.push(e);
      if(n%25===0){
        const pct=2+68*(n+1)/bestanden.length,fase=`DRIP-logs lezen: ${(n+1).toLocaleString('nl-NL')} / ${bestanden.length.toLocaleString('nl-NL')}`;
        dgMapVoortgang(pct,fase);
        if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,pct,fase,{direct:true});
        if(typeof uiPauze==='function')await uiPauze();
      }
    }
    if(!events.length)throw new Error('de gevonden bestanden bevatten geen herkenbare DRIP-gebeurtenissen (tab-gescheiden statusregels). Controleer of dit CDMS-logbestanden zijn.');
    dgMapVoortgang(74,'DRIP-episodes en storingen reconstrueren…');
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,74,'DRIP-episodes en storingen reconstrueren',{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const bundel=sbBouwDripBundel(events,{});
    const gecombineerd=config.basisDrip
      ?sbCombineerMetDripBasis(config.basisDrip,bundel.episodes,bundel.storingen,config.vcs)
      :{episodes:bundel.episodes,storingen:bundel.storingen};
    const tijdstip=new Date(),z=n=>String(n).padStart(2,'0');
    const stempel=`${tijdstip.getFullYear()}${z(tijdstip.getMonth()+1)}${z(tijdstip.getDate())}_${z(tijdstip.getHours())}${z(tijdstip.getMinutes())}`;
    dgLaatsteExport={data:{metadata:{versie:'2.5',herkomst:'bidash-maplezer',aangemaakt:tijdstip.toISOString(),watermarks:{drip:sbDripWatermerken(gecombineerd)}},datasets:{drip:gecombineerd}},naam:`DRIP_totaal_bidash_${stempel}.json`};
    dgMapVoortgang(88,'DRIP-incidenten aan All Assets koppelen en doorrekenen…');
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,86,'DRIP-incidenten aan All Assets koppelen',{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const naam='DRIP uit map ('+regios+')';
    const {incidenten,gekoppeldeIncidenten,laatsteEntry}=await pasDripBundelToe(naam,gecombineerd,'maplezen');
    window.__BIDASH_DG_MAP_CONFIG__=null;
    const laatste=laatsteEntry?new Date(laatsteEntry).toLocaleDateString('nl-NL'):'onbekend';
    const klaarTekst=`Klaar (${regios}): ${bestanden.length.toLocaleString('nl-NL')} bestanden → ${Number(incidenten).toLocaleString('nl-NL')} incidenten (${Number(gekoppeldeIncidenten).toLocaleString('nl-NL')} gekoppeld). Laatste entry ${laatste}.`;
    dgMapVoltooid(incidenten&&!gekoppeldeIncidenten?klaarTekst+' Let op: geen enkel incident kon aan een DRIP-asset worden gekoppeld.':klaarTekst,incidenten&&!gekoppeldeIncidenten);
    if(typeof importKlaar==='function')importKlaar(label,'DRIP uit map gelezen. '+klaarTekst+' Vervangt de losse DRIP-storingshistorie.');
    try{if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();}catch(err){}
    try{if(parent!==window)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:'dripMap'},location.origin);}catch(err){}
    return {bestanden:bestanden.length,incidenten,gekoppeldeIncidenten};
  }

  // Globaal beschikbaar voor de source-manager en de test.
  window.leesSignaalgeverMap=leesSignaalgeverMap;
  window.openSignaalgeverMapDialog=openSignaalgeverMapDialog;
  window.leesDripMap=leesDripMap;
  window.openDripMapDialog=openDripMapDialog;
  window.__BIDASH_STORINGSBUNDELAAR__={sbVcAlias,sbParseDT,sbLocatie,sbMtmCategorie,sbSnapshotDatum,sbMtmRijenUitTekst,sbClassificeer,sbBouwBundel,sbPadInfoMtm,sbBestandGeschikt,sbFilterBestanden,sbCombineerMetBasis,
    sbPadInfoDrip,sbDripBestandGeschikt,sbDripEventsUitTekst,sbBouwDripBundel,sbFilterDripBestanden,sbCombineerMetDripBasis,sbDripWatermerken,sgVolgendeCtxDrip};
})();
