/* Gedeelde invoer van MTM-tabellen en BSS-gebeurtenissen. Geen impactmodel. */
(() => {
  'use strict';
  const helpers=()=>window.__BIDASH_STORINGSBUNDELAAR__;
  const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase();
  const time=s=>s==null||s===''?null:typeof s==='number'?s:Date.parse(s);
  const vcOf=r=>helpers().sbVcAlias(r.vc||r.verkeerscentrale);
  const payload=r=>[String(r.foutcode||r.code||''),norm(r.locatie),norm(r.MSI||r.unit),norm(String(r.description||r.melding||'').match(/\b(?:DET\.?\s*\d+|LUS\s*\d+|LAMP\s+\S+)/i)?.[0]||'')].join('|');
  const seriesKey=r=>[vcOf(r),String(r.bss_id||r.event_id||''),payload(r)].join('|');
  const rowKey=r=>r._mtmSleutel||r.incident_id||helpers().sbSignaalgeverSleutel(r);
  const closed=r=>['HERSTELD_BEVESTIGD','HERSTELD_AFGELEID'].includes(r.levenscyclus_status);
  const pauseDefault=()=>new Promise(resolve=>setTimeout(resolve,0));

  async function read(text,file,info,options={}){
    const H=helpers(),lines=String(text).replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);
    if(!lines.some(l=>/^\s*(?:Registreer|Hef\s+op)\s+BSS\b/i.test(l)))return {kind:'snapshot',snapshot:H.sbSignaalgeverSnapshot(text,file,info)};
    const events=[],cache=new Map();let registrations=0,repairs=0;
    for(let n=0;n<lines.length;n++){
      const line=lines[n];if(!line.trim())continue;
      const match=line.match(/^\s*(Registreer\s+BSS|Hef\s+op\s+BSS)\s*:\s*BSS_ID\s*=\s*(\d+)\s*,\s*(\d+)\s+([^\t]+)\t([^\t]+)\t\s*(\d{2}[-/.]\d{2}[-/.]\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)\s*$/i);
      const fail=reason=>Error(reason+' in '+(file.webkitRelativePath||file._pad||file.name)+', regel '+(n+1)+'. Vorige stand behouden.');
      if(!match)throw fail('Onvolledige of onbekende BSS-gebeurtenis');
      const [,action,id,code,description,location,sourceTime]=match,dt=H.sbParseDT(sourceTime);
      const clock=sourceTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if(!dt||Number(clock[1])>23||Number(clock[2])>59||Number(clock[3]||0)>59)throw fail('Ongeldige BSS-datum');
      const cacheKey=[code,description,location].join('\t');let data=cache.get(cacheKey);
      if(!data){
        const loc=H.sbLocatie(location),cat=H.sbMtmCategorie(code,description),unit=description.match(/\bMSI\s*(\d+)/i);
        if(!loc.locatie)throw fail('Ontbrekende BSS-locatie');
        data={code,description:description.trim(),...loc,categorie:cat[0],meenemen:cat[1],impact:cat[2],unit:unit?'MSI '+Number(unit[1]):cat[0]==='SYSTEEM'?'SYSTEEM':cat[0]==='DETECTIELUS'?'DETECTIELUS':'OVERIG'};cache.set(cacheKey,data);
      }
      const kind=/^Hef/i.test(action)?'repair':'register';if(kind==='register')registrations++;else repairs++;
      events.push({data,vc:info.vc,id,kind,t:+dt,file:file.webkitRelativePath||file._pad||file.name,line:n+1,precision:clock[3]?'seconde':'minuut'});
      if(n%2000===1999){options.checkCancel?.();options.onProgress?.(n+1,lines.length);await (options.pause||pauseDefault)();}
    }
    return {kind:'bss',vc:info.vc,file:file.webkitRelativePath||file._pad||file.name,events,registrations,repairs,rows:registrations+repairs};
  }

  async function process(basis,inputs,options={}){
    const H=helpers(),life=globalThis.DVM_INCIDENT_LIFECYCLE,pause=options.pause||pauseDefault;
    if(!inputs.some(x=>x.kind==='bss'))return {...basis,...H.sbSignaalgeverSynchroniseer(basis,inputs.map(x=>x.snapshot)),bssVerwijderd:0};
    const cutoff=options.historyCutoff??-Infinity;
    let state={...basis},records=new Map(),baseHistory=[],baseOpen=[],changes=new Map(),updated=new Set(),watermarks={...basis.laatstePerVc},coverage={...basis.snapshotDekking},removed=0;
    const protectedIds=new Set((basis.open||[]).flatMap(r=>[rowKey(r),r.incident_id]).filter(Boolean));
    state.historie=(basis.historie||[]).filter(r=>{
      const end=time(r.hersteld_op)??time(r.herstel_venster_tot)??time(r._mtmEindeBovengrens);
      const drop=closed(r)&&end!=null&&end<cutoff&&!protectedIds.has(rowKey(r))&&!protectedIds.has(r.incident_id);if(drop)removed++;return !drop;
    });
    const stats={};
    const ensureStats=vc=>stats[vc]||(stats[vc]={bestanden:new Set(),gelezenRijen:0,registraties:0,herstelmeldingen:0,eerste:null,laatste:null,zonderBegin:0,vorig:basis.laatstePerVc?.[vc]||null,bronGap:false});
    for(const input of inputs)if(input.kind==='bss'){
      const s=ensureStats(input.vc);s.bestanden.add(input.file);s.gelezenRijen+=input.rows;s.registraties+=input.registrations;s.herstelmeldingen+=input.repairs;
    }
    function index(){
      records=new Map();changes=new Map();updated=new Set();baseHistory=state.historie||[];baseOpen=state.open||[];
      const rows=new Map();for(const row of [...baseHistory,...baseOpen])if(row.event_id||row.bss_id)rows.set(rowKey(row),row);
      const liveKeys=new Set(baseOpen.map(rowKey));
      for(const [key,row] of rows){
        const signature=seriesKey(row);if(!records.has(signature))records.set(signature,[]);
        records.get(signature).push({key,row,start:time(row.bron_start||row.van),end:time(row.hersteld_op)??(closed(row)?time(row.herstel_venster_tot):null),current:liveKeys.has(key),touched:false});
      }
    }
    index();
    function materialize(rec){
      const event=rec.startEvent||rec.endEvent;
      let row=rec.row;
      if(!row){row=signaalgeverOpenRij({...event.data,verkeerscentrale:event.vc,event_id:event.id,start:rec.start==null?null:new Date(rec.start).toISOString(),_syncKey:rec.key,bronbestanden:[event.file]});}
      const repair=rec.endEvent?new Date(rec.end).toISOString():row.hersteld_op;
      const start=rec.start==null?null:new Date(rec.start).toISOString(),seen=rec.startEvent?new Date(rec.startEvent.t).toISOString():row.laatste_gezien;
      const isClosed=rec.end!=null,sourcePeil=Math.max(time(row.bron_peildatum)||0,rec.end||0,rec.startEvent?.t||0);
      const retainUncertain=!isClosed&&rec.current&&['VERDWENEN_UIT_SNAPSHOT','ONBEKEND_DOOR_BRONGAT'].includes(row.levenscyclus_status)&&(!rec.startEvent||rec.startEvent.t<(time(row.bron_peildatum)||0));
      const out=life.stamp(row,{_mtmSleutel:rec.key,incident_id:row.incident_id||'MTM|'+rec.key,bss_id:event?.id||row.bss_id,
        van:start||'',bron_start:start,eerste_gezien:row.eerste_gezien||seen||null,laatste_gezien:row.laatste_gezien&&time(row.laatste_gezien)>time(seen)?row.laatste_gezien:seen||null,
        bron_peildatum:sourcePeil?new Date(sourcePeil).toISOString():null,hersteld_op:repair||null,
        levenscyclus_status:isClosed?(rec.endEvent?'HERSTELD_BEVESTIGD':row.levenscyclus_status):retainUncertain?row.levenscyclus_status:rec.current?'OPEN_BEVESTIGD':'ONBEKEND_DOOR_BRONGAT',
        herstel_venster_van:rec.endEvent?null:row.herstel_venster_van||null,herstel_venster_tot:rec.endEvent?null:row.herstel_venster_tot||null,
        status:isClosed?'gesloten':rec.current&&!retainUncertain?'open':'onbekend',_liveOpen:!isClosed&&rec.current&&!retainUncertain,
        bron_formaat:'MTM-BSS-gebeurtenissen',tijdprecisie:event?.precision||row.tijdprecisie||'minuut',start_onbekend:rec.start==null,
        duur_uur:isClosed&&rec.start!=null?Math.max(0,(rec.end-rec.start)/36e5):null,duurBetrouwbaar:false,
        _mtmKwaliteit:isClosed?'gesloten':retainUncertain?row._mtmKwaliteit||'einde_onzeker_datagat':rec.current?'open_aan_einde':'einde_onzeker_datagat'});
      if(rec.endEvent)out.tot=repair;
      const files=new Set([...(row.bronbestanden||[]),rec.startEvent?.file,rec.endEvent?.file].filter(Boolean));if(files.size)out.bronbestanden=[...files];
      return out;
    }
    function flush(){
      const live=new Map(baseOpen.map(r=>[rowKey(r),r]));
      for(const list of records.values())for(const rec of list)if(rec.touched){
        updated.add(rec.key);live.delete(rec.key);
        if(rec.expired)continue;
        const row=materialize(rec);changes.set(rec.key,row);if(rec.end==null&&rec.current)live.set(rec.key,row);
      }
      state={...state,open:[...live.values()],historie:[...baseHistory.filter(r=>!updated.has(rowKey(r))),...changes.values()],laatstePerVc:{...watermarks},snapshotDekking:{...coverage}};
    }
    const operations=[];
    for(const input of inputs){if(input.kind==='bss')input.events.forEach(e=>operations.push({t:e.t,event:e}));else operations.push({t:Date.parse(input.snapshot.snapshot),snapshot:input.snapshot});}
    operations.sort((a,b)=>a.t-b.t||(a.snapshot?0:1)-(b.snapshot?0:1));
    for(let i=0;i<operations.length;i++){
      const op=operations[i];
      if(op.snapshot){
        flush();const snapshots=[op.snapshot];while(operations[i+1]?.snapshot&&operations[i+1].t===op.t)snapshots.push(operations[++i].snapshot);
        // BSS_ID en dezelfde bronstart verbinden een actuele tabel aan de logepisode.
        const mapped=snapshots.map(s=>({...s,rows:s.rows.map(r=>{const sig=seriesKey({...r,vc:s.vc,MSI:r.unit,foutcode:r.code});const candidates=(records.get(sig)||[]).filter(x=>x.current&&x.end==null&&x.start===time(r.start));return candidates.length===1?{...r,_syncKey:candidates[0].key}:r;})}));
        state={...state,...H.sbSignaalgeverSynchroniseer(state,mapped)};watermarks={...state.laatstePerVc};coverage={...state.snapshotDekking};index();continue;
      }
      const e=op.event,s=ensureStats(e.vc),signature=[e.vc,e.id,payload(e.data)].join('|');
      s.eerste=s.eerste==null?e.t:Math.min(s.eerste,e.t);if(s.laatste==null||e.t>=s.laatste)s.laatsteBestand=e.file;s.laatste=Math.max(s.laatste||0,e.t);
      const gapHours=typeof RULES!=='undefined'?Number(RULES.cfg?.storingsBewaking?.maxSnapshotGapUren)||6:6;
      if(s.vorig!=null&&e.t-s.vorig>gapHours*36e5)s.bronGap=true;s.vorig=Math.max(s.vorig||0,e.t);
      const list=records.get(signature)||[];records.set(signature,list);
      if(e.kind==='register'){
        let rec=list.find(r=>r.start===e.t)||list.filter(r=>r.start==null&&r.end>=e.t).sort((a,b)=>a.end-b.end)[0];
        if(!rec){const key='BSS|'+JSON.stringify([e.vc,e.id,e.t,payload(e.data)]);rec={key,start:e.t,end:null,current:e.t>=(basis.laatstePerVc?.[e.vc]||0),touched:true};list.push(rec);}
        if(rec.start==null)rec.start=e.t;
        rec.startEvent=e;rec.touched=true;
      }else{
        let rec=list.filter(r=>r.start!=null&&r.start<=e.t&&(r.end==null||r.row?.levenscyclus_status==='HERSTELD_AFGELEID'&&!r.endEvent)).sort((a,b)=>b.start-a.start)[0]||list.find(r=>r.end===e.t);
        if(rec?.row?.laatste_gezien&&time(rec.row.laatste_gezien)>=e.t+(e.precision==='minuut'?60000:1000))throw Error('BSS-herstel spreekt een latere open waarneming tegen in '+e.file+', regel '+e.line+'. Vorige stand behouden.');
        if(!rec){rec={key:'BSS|'+JSON.stringify([e.vc,e.id,null,e.t,payload(e.data)]),start:null,current:false};list.push(rec);s.zonderBegin++;}
        rec.end=e.t;rec.endEvent=e;rec.current=false;rec.touched=true;
        if(e.t<cutoff&&!rec.expired){rec.expired=true;removed++;}
      }
      watermarks[e.vc]=Math.max(watermarks[e.vc]||0,e.t);
      if(i%2000===1999){options.checkCancel?.();options.onProgress?.(i+1,operations.length);await pause();}
    }
    flush();
    for(const [vc,s] of Object.entries(stats)){
      const previous=state.snapshotDekking[vc];
      const latest=watermarks[vc]||s.laatste;
      // Een log wordt nooit als een lege actuele lijst gebruikt. Afwezigheid sluit niet.
      if(s.laatste>=(Date.parse(previous?.snapshot)||0)){
        const n=state.open.filter(r=>vcOf(r)===vc).length;
        const snapshotBasis=previous?.snapshotBasis||(previous?.bronType!=='BSS-gebeurtenissen'&&previous?.volledig?previous.snapshot:null);
        state.snapshotDekking[vc]={vc,snapshot:new Date(latest).toISOString(),bestand:s.laatsteBestand,bronType:'BSS-gebeurtenissen',snapshotBasis,structuurVolledig:true,volledig:!!snapshotBasis&&!s.bronGap,aantal:n,uniekeMeldingen:n,dubbeleBronrijen:0,verantwoordeRijen:n,bronGap:s.bronGap,volumeVerdacht:false,sluitenToegestaan:false,reden:'BSS-log, herstel uitsluitend uit Hef op BSS',periodeVan:new Date(s.eerste).toISOString(),periodeTot:new Date(s.laatste).toISOString()};
      }
      const peil=new Date(latest).toISOString();
      state.open=state.open.map(r=>vcOf(r)===vc?{...r,bron_peildatum:peil}:r);
      const changed=new Map(state.open.map(r=>[rowKey(r),r]));state.historie=state.historie.map(r=>changed.get(rowKey(r))||r);
      const prior=state.bssBronnen?.[vc]||{};
      const perBestand={...prior.perBestand};for(const input of inputs.filter(x=>x.kind==='bss'&&x.vc===vc))perBestand[input.file]={gelezenRijen:input.rows,registraties:input.registrations,herstelmeldingen:input.repairs,verantwoordeRijen:input.registrations+input.repairs};
      state.bssBronnen={...state.bssBronnen,[vc]:{bronType:'BSS-gebeurtenissen',perBestand,bestanden:[...new Set([...(prior.bestanden||[]),...s.bestanden])],gelezenRijen:s.gelezenRijen,registraties:s.registraties,herstelmeldingen:s.herstelmeldingen,verantwoordeRijen:s.registraties+s.herstelmeldingen,bronBalans:s.gelezenRijen===s.registraties+s.herstelmeldingen,herstelZonderBegin:s.zonderBegin,periodeVan:new Date(s.eerste).toISOString(),periodeTot:new Date(s.laatste).toISOString()}};
    }
    const inputLatest={};for(const op of operations){const vc=op.event?.vc||op.snapshot.vc;inputLatest[vc]=Math.max(inputLatest[vc]||0,op.t);}
    const updates={};for(const vc of new Set(inputs.map(x=>x.vc||x.snapshot.vc)))updates[vc]={van:basis.laatstePerVc?.[vc]||null,tot:state.laatstePerVc[vc],ouder:(inputLatest[vc]||0)<(basis.laatstePerVc?.[vc]||0),dekking:state.snapshotDekking[vc]};
    state.updates=updates;state.bssVerwijderd=removed;state.dubbel=0;
    const historyKeys=new Set(state.historie.map(rowKey)),missing=state.open.filter(r=>!historyKeys.has(rowKey(r))).length;
    state.levenscyclusAudit={actueleZonderHistorie:missing,historischeIncidenten:state.historie.length,actueleMeldingen:state.open.length,bssBronBalans:Object.values(state.bssBronnen||{}).every(s=>s.bronBalans),bronDekkingVolledig:Object.values(state.snapshotDekking).every(d=>d.volledig&&!d.bronGap&&!d.volumeVerdacht),administratiefSluitend:missing===0&&state.historie.every(r=>!!r._mtmSleutel&&!!r.incident_id)};
    return state;
  }
  window.DVM_MTM_BSS={read,process};
})();
