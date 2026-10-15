/* Overdracht en bewaartermijn van de losse MTM-importer. Geen impactberekening. */
(function(scope){
  const vcs=['mn','non','nwn','zwn','zn'];
  const vc=value=>({mn:'mn',ut:'mn',non:'non',on:'non',nwn:'nwn',wnn:'nwn',zwn:'zwn',wnz:'zwn',zh:'zwn',zn:'zn'})[String(value||'').trim().toLowerCase().replace(/^vc[\s_-]*/,'')]||'';
  const rowVc=r=>vc(r.vc||r.verkeerscentrale||r.regio);
  function time(value){if(value==null||value==='')return null;const t=typeof value==='number'?value:Date.parse(value);return Number.isFinite(t)?t:null;}
  const closed=r=>['HERSTELD_BEVESTIGD','HERSTELD_AFGELEID'].includes(r.levenscyclus_status);
  function cutoff(now=Date.now()){
    const d=new Date(now);if(!Number.isFinite(+d))throw Error('Ongeldige peildatum voor bewaring.');
    const month=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()-1);if(d.getUTCMonth()!==month)d.setUTCDate(0);return +d;
  }
  function retain(stand,now=Date.now()){
    const grens=cutoff(now),protectedIds=new Set((stand.open||[]).flatMap(r=>[r._mtmSleutel,r.incident_id]).filter(Boolean));let verwijderd=0;
    const historie=(stand.historie||[]).filter(r=>{
      const einde=time(r.hersteld_op)??time(r.herstel_venster_tot)??time(r._mtmEindeBovengrens);
      const weg=closed(r)&&einde!=null&&einde<grens&&!protectedIds.has(r._mtmSleutel)&&!protectedIds.has(r.incident_id);if(weg)verwijderd++;return !weg;
    });
    return {...stand,historie,bewaring:{jaren:1,grens:new Date(grens).toISOString(),toegepastOp:new Date(now).toISOString(),verwijderd,openEnOnzekerOnbeperkt:true}};
  }
  const isMtm=(b,r)=>!!(b._signaalgeverTotaal||String(b.key||'').startsWith('signaalgever-totaal-')||r._mtmSleutel||/^(MSI|LUS|DETECTIELUS)$/i.test(r.assetTypeHint||'')||r.MSI&&!/^(CAM|DRIP)$/i.test(r.assetTypeHint||''));
  function selection(bundle){
    const m=bundle?.signaalgeverImport;if(!m)return null;
    if(m.versie!==1||!Array.isArray(m.vcs)||!m.vcs.length||m.vcs.some(v=>!vcs.includes(v))||new Set(m.vcs).size!==m.vcs.length)throw Error('Ongeldige verkeerscentrales in signaalgeverimport.');
    if(!Array.isArray(bundle.storingshistorie)||!Array.isArray(bundle.liveStoringen)||bundle.exportSelectie?.storingshistorie===false||bundle.exportSelectie?.liveStoringen===false)throw Error('Signaalgeverimport vereist historie en actuele meldingen samen.');
    const chosen=new Set(m.vcs),status=bundle.bronbeheer?.signaalgeverTotaal;
    for(const v of chosen)if(time(status?.laatstePerVc?.[v])==null)throw Error('Bronpeildatum ontbreekt voor '+v.toUpperCase()+'.');
    for(const part of ['storingshistorie','liveStoringen'])for(const b of bundle[part]){
      if(!Array.isArray(b.rijen))throw Error('Ongeldige bronrijen in signaalgeverimport.');
      for(const r of b.rijen)if(!chosen.has(rowVc(r))||!isMtm(b,r))throw Error('Bronrij valt buiten de gekozen signaalgeverimport.');
    }
    return chosen;
  }
  function merge(current={},incoming){
    const chosen=selection(incoming);if(!chosen)throw Error('Geen losse signaalgeverimport.');
    const old=current.bronbeheer?.signaalgeverTotaal||{},fresh=incoming.bronbeheer.signaalgeverTotaal;
    for(const v of chosen)if((time(old.laatstePerVc?.[v])||0)>(time(fresh.laatstePerVc[v])||0))throw Error('De import voor '+v.toUpperCase()+' is ouder dan de geladen stand.');
    const out={formaat:'DVM-dienstimpact-totaal',versie:140,...current};
    for(const part of ['storingshistorie','liveStoringen']){
      const rest=(current[part]||[]).map(b=>({...b,rijen:(b.rijen||[]).filter(r=>!chosen.has(rowVc(r))||!isMtm(b,r))})).filter(b=>b.rijen.length);
      const mtm=rest.filter(b=>b._signaalgeverTotaal||String(b.key||'').startsWith('signaalgever-totaal-')).flatMap(b=>b.rijen);
      const other=rest.filter(b=>!b._signaalgeverTotaal&&!String(b.key||'').startsWith('signaalgever-totaal-'));
      const rows=[...mtm,...incoming[part].flatMap(b=>b.rijen)];
      out[part]=[...other,{key:'signaalgever-totaal-'+(part==='liveStoringen'?'open':'historie'),naam:'Signaalgevers per verkeerscentrale',_signaalgeverTotaal:true,rijen:rows}];
    }
    const pick=field=>({...old[field],...Object.fromEntries([...chosen].map(v=>[v,fresh[field]?.[v]??null]))});
    const open=out.liveStoringen.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen),hist=out.storingshistorie.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen);
    out.bronbeheer={...current.bronbeheer,levenscyclus:incoming.bronbeheer.levenscyclus||current.bronbeheer?.levenscyclus,signaalgeverTotaal:{...old,...fresh,open:open.length,historie:hist.length,laatstePerVc:pick('laatstePerVc'),snapshotDekking:pick('snapshotDekking'),bssBronnen:pick('bssBronnen'),bewaringPerVc:pick('bewaringPerVc'),levenscyclusAudit:null}};
    delete out.signaalgeverImport;return out;
  }
  function bundle(stands,{now=Date.now()}={}){
    const entries=Object.entries(stands).filter(([v])=>vcs.includes(v));if(!entries.length)throw Error('Verwerk eerst een verkeerscentrale.');
    const open=entries.flatMap(([,s])=>s.open),historie=entries.flatMap(([,s])=>s.historie);
    const laatst=Object.fromEntries(entries.map(([v,s])=>[v,s.laatstePerVc[v]]));
    const bron=(key,rijen)=>({key:'signaalgever-totaal-'+key,naam:'Losse signaalgeverimporter',_signaalgeverTotaal:true,rijen});
    const result={formaat:'DVM-dienstimpact-totaal',versie:140,opgeslagen:new Date(now).toISOString(),signaalgeverImport:{versie:1,vcs:entries.map(([v])=>v)},exportSelectie:{storingshistorie:true,liveStoringen:true},storingshistorie:[bron('historie',historie)],liveStoringen:[bron('open',open)],bronbeheer:{levenscyclus:{versie:1,historieOmvatOokActieveIncidenten:true,totIsGeenBewezenHerstelZonderHersteldOp:true},signaalgeverTotaal:{bestand:'signaalgevers-per-vc.json',importerBewaren:true,versie:'losse-importer-1',open:open.length,historie:historie.length,laatstePerVc:laatst,snapshotDekking:Object.fromEntries(entries.map(([v,s])=>[v,s.snapshotDekking?.[v]||null])),bssBronnen:Object.fromEntries(entries.map(([v,s])=>[v,s.bssBronnen?.[v]||null])),bewaringPerVc:Object.fromEntries(entries.map(([v,s])=>[v,s.bewaring||null]))}}};
    selection(result);return result;
  }
  scope.BIDASH_SIGNAALGEVER_IMPORT=Object.freeze({vcs,vc,rowVc,closed,cutoff,retain,selection,merge,bundle});
})(globalThis);
