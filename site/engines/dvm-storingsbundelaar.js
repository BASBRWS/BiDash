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
    if(DETECTOR_CODES.has(code)||/detectorstation|\bdet\.?\s*\d+|beide lussen|een lus goed/i.test(d))return ['DETECTOR',false,'DETECTOR'];
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
    if(typeof leesBlobAlsArrayBuffer==='function')return sbDecode(await leesBlobAlsArrayBuffer(file,20000,'een storingsbestand kon niet op tijd worden gelezen'));
    return sbDecode(await file.arrayBuffer());
  }

  /* Handler voor Datasetbeheer: een gekozen map (webkitdirectory) met MTM-
     storinglijsten → open storingen + historie, via dezelfde koppeling en
     doorrekening als de JSON-bron. */
  async function leesSignaalgeverMap(fileList){
    if(typeof ASSET_REGISTER_STATE==='undefined'||!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De storingsmap wordt rechtstreeks aan dat stamregister gekoppeld.');if(typeof renderDataGereedheid==='function')renderDataGereedheid();return;}
    const bestanden=[...(fileList||[])].filter(sbBestandGeschikt);
    if(!bestanden.length)throw new Error('geen MTM-storinglijsten gevonden onder <map>/mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>. Kies de X:-hoofdmap of de mtm-map.');
    const label='Signaalgevers uit map ('+bestanden.length.toLocaleString('nl-NL')+' bestanden)';
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,2,'Storinglijsten lezen',{direct:true});
    const snapshots=[];
    for(let n=0;n<bestanden.length;n++){
      const f=bestanden[n],info=sbPadInfoMtm(sbPad(f));
      let text;
      try{text=await sbLeesTekst(f);}catch(err){continue;}
      const snap=sbSnapshotDatum(text,f.name)||info.datum;
      const rows=sbMtmRijenUitTekst(text,info.vc);
      if(rows.length)snapshots.push({vc:info.vc,snapshot:new Date(snap).toISOString(),bestand:sbPad(f),rows});
      if(n%25===0){
        if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,2+68*(n+1)/bestanden.length,`Storinglijsten lezen: ${(n+1).toLocaleString('nl-NL')}/${bestanden.length.toLocaleString('nl-NL')}`,{direct:true});
        if(typeof uiPauze==='function')await uiPauze();
      }
    }
    if(!snapshots.length)throw new Error('de gevonden bestanden bevatten geen herkenbare storingsregels');
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,74,'Alarmruns en storingen reconstrueren',{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const bundel=sbBouwBundel(snapshots,{});
    const pseudo={datasets:{mtm:{alarm_episodes:bundel.open,storingen:bundel.storingen}},metadata:{versie:'maplezen'}};
    const {open,historie,versie}=signaalgeverTotaalBronnen(pseudo);
    if(typeof zetImportVoortgang==='function')zetImportVoortgang(label,86,'Open meldingen aan All Assets koppelen',{direct:true});
    if(typeof uiPauze==='function')await uiPauze();
    const naam='Signaalgevers uit map';
    const {herkendOpen,herkendHist}=pasSignaalgeverBundelToe(naam,open,historie,versie);
    if(typeof importKlaar==='function')importKlaar(label,`Signaalgevers uit map gelezen: ${bestanden.length.toLocaleString('nl-NL')} bestanden → ${open.length.toLocaleString('nl-NL')} open (${herkendOpen.toLocaleString('nl-NL')} herkend), ${historie.length.toLocaleString('nl-NL')} historisch (${herkendHist.toLocaleString('nl-NL')} herkend). Vervangt de losse Open storingen- en Storingshistorie-bronnen.`);
    if(open.length&&!herkendOpen)alert('De open meldingen zijn gelezen maar geen enkele werd als een bekend assettype (bv. MSI) herkend, dus het actuele dashboard blijft leeg.');
    return {bestanden:bestanden.length,open:open.length,historie:historie.length,herkendOpen,herkendHist};
  }

  // Globaal beschikbaar voor de source-manager en de test.
  window.leesSignaalgeverMap=leesSignaalgeverMap;
  window.__BIDASH_STORINGSBUNDELAAR__={sbVcAlias,sbParseDT,sbLocatie,sbMtmCategorie,sbSnapshotDatum,sbMtmRijenUitTekst,sbClassificeer,sbBouwBundel,sbPadInfoMtm,sbBestandGeschikt};
})();
