/* Gedeeld gegevenscontract voor de DVM-levenscyclus. Geen impactformules. */
(function(scope){
  const norm=v=>String(v??'').trim().toUpperCase();
  function time(v){if(v==null||v==='')return null;const t=typeof v==='number'?v:Date.parse(v);return Number.isFinite(t)?t:null;}
  function iso(v){const t=time(v);return t==null?null:new Date(t).toISOString();}
  const labels={OPEN_BEVESTIGD:'Aanwezig in bronsnapshot',OPEN_VEROUDERD:'Open, bevestiging verouderd',HERSTELD_BEVESTIGD:'Hersteld, expliciete bronmelding',HERSTELD_AFGELEID:'Herstel afgeleid uit twee snapshots',VERDWENEN_UIT_SNAPSHOT:'Eenmaal afwezig, herstel onbevestigd',ONBEKEND_DOOR_BRONGAT:'Onbekend door brongat of onvolledige bron'};
  function fingerprint(row={}){return JSON.stringify([norm(row.vc||row.verkeerscentrale).replace(/^VC[\s_-]*/,''),norm(row.typeId||row.assetTypeHint||row.assettype),norm(row.weg),norm(row.zijdeBron||row.richting),row.hm==null||row.hm===''?'':Number(row.hm).toFixed(3),norm(row.hectoletter),norm(row.strook||row.MSI),norm(row.foutcode||row.code)]);}
  function read(row={},options={}){
    const open=row._liveOpen===true||row.liveOpen===true||/^(open|openstaand|actief)$/i.test(String(row.status||row.technischeToestand||''));
    const last=iso(row.laatste_gezien||row.laatste_snapshot||(open?(row.tot||row.einde||row.tTot):null));
    const first=iso(row.eerste_gezien||row.eerste_snapshot);
    const peil=iso(row.bron_peildatum||row.bronPeildatum||options.peildatum);
    const repair=iso(row.hersteld_op);
    let status=norm(row.levenscyclus_status);
    if(!labels[status])status=repair?'HERSTELD_BEVESTIGD':row._afgeslotenDoorNieuweMomentopname||row._mtmKwaliteit==='gesloten'?'HERSTELD_AFGELEID':open&&last?'OPEN_BEVESTIGD':'ONBEKEND_DOOR_BRONGAT';
    const cfg=typeof RULES!=='undefined'?RULES.cfg?.storingsBewaking||{}:{};
    const now=time(options.now)??Date.now(),hours=Number(options.verouderingUren)||Number(cfg.verouderingUren)||Number(row.veroudering_na_uren)||48;
    const confirmation=time(row.bevestigd_tot)||time(last);
    if(status==='OPEN_BEVESTIGD'&&(confirmation==null||now-confirmation>hours*36e5))status='OPEN_VEROUDERD';
    return {incident_id:String(row.incident_id||row._mtmSleutel||('DVM|'+fingerprint(row)+'|'+String(row.van||row.start||'')+'|'+String(row.eventId||row.event_id||''))),incident_fingerprint:String(row.incident_fingerprint||fingerprint(row)),
      eerste_gezien:first,laatste_gezien:last,bron_peildatum:peil,hersteld_op:repair,veroudering_na_uren:hours,levenscyclus_status:status,levenscyclus_label:labels[status],
      herstel_venster_van:iso(row.herstel_venster_van),herstel_venster_tot:iso(row.herstel_venster_tot),
      bron_start:iso(row.bron_start||row.van||row.start),technische_categorie:String(row.technische_categorie||row.categorie||row.typeId||''),
      identiteit_volledig:typeof row.identiteit_volledig==='boolean'?row.identiteit_volledig:!!(assetKey(row)&&(row.code||row.foutcode)&&(row.bron_start||row.van||row.start))};
  }
  function stamp(row={},values={}){
    const out={...row,...values};
    for(const k of ['eerste_gezien','laatste_gezien','bron_peildatum','hersteld_op','herstel_venster_van','herstel_venster_tot','bevestigd_tot'])out[k]=iso(out[k]);
    if(out.levenscyclus_status!=='HERSTELD_BEVESTIGD')out.hersteld_op=null;
    out.tot_betekenis=out.hersteld_op?'HERSTELD_OP':'LAATSTE_WAARNEMING';
    return out;
  }
  const uncertain=status=>['VERDWENEN_UIT_SNAPSHOT','ONBEKEND_DOOR_BRONGAT','OPEN_VEROUDERD'].includes(status);
  function assetKey(row={}){
    if(row.assetKey)return 'ID|'+row.assetKey;
    const type=norm(row.typeId||row.assetTypeHint||row.assettype),vc=norm(row.vc).replace(/^VC[\s_-]*/,''),road=norm(row.weg),side=norm(row.zijdeBron||row.richting),laneText=norm(row.strook||row.MSI),lane=/^(?:MSI\s*)?0*(\d{1,2})$/.exec(laneText)?.[1]||/\b(?:DET\.?|DETECTOR|LUS)\s*0*(\d{1,2})\b/.exec(laneText)?.[1]||'';
    if(!type||['SYSTEEM','ONBEKEND'].includes(type)||!vc||!road||!side||row.hm==null||row.hm===''||!Number.isFinite(Number(row.hm)))return '';
    if(['MSI','LUS'].includes(type)&&!lane)return '';
    return ['LOC',vc,type,road,side,Number(row.hm).toFixed(3),norm(row.hectoletter),lane,type==='DRIP'?norm(row.drip_code||row.naam):''].join('|');
  }
  function summary(rows=[],options={}){
    const byState={},byCategory={},assets=new Set();let unlinked=0,unclear=0;
    for(const row of rows){const x=read(row,options);byState[x.levenscyclus_status]=(byState[x.levenscyclus_status]||0)+1;const cat=x.technische_categorie||'Onbekend';byCategory[cat]=(byCategory[cat]||0)+1;
      const k=assetKey(row);if(k)assets.add(k);else unlinked++;if(uncertain(x.levenscyclus_status))unclear++;}
    return {meldingen:rows.length,geraakteAssets:assets.size,meldingenZonderUniekAsset:unlinked,onzeker:unclear,perToestand:byState,perCategorie:byCategory};
  }
  scope.DVM_INCIDENT_LIFECYCLE=Object.freeze({time,iso,fingerprint,read,stamp,uncertain,assetKey,summary,labels:Object.freeze(labels)});
})(globalThis);
