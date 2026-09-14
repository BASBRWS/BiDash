function lowerBound(arr,value,getter){
  let lo=0,hi=arr.length;
  while(lo<hi){
    const mid=(lo+hi)>>1;
    if(getter(arr[mid])<value)lo=mid+1;else hi=mid;
  }
  return lo;
}

function upperBound(arr,value,getter){
  let lo=0,hi=arr.length;
  while(lo<hi){
    const mid=(lo+hi)>>1;
    if(getter(arr[mid])<=value)lo=mid+1;else hi=mid;
  }
  return lo;
}

function ruleCodeMatch(message,typeId,code){
  return message&&message.typeId===typeId&&(!code||message.code===String(code));
}

function groupKey(message){
  return String(message&&message.weg)+'\u001f'+String(message&&message.richting);
}

/**
 * Zelfde rekenregels als stap 5 van doorrekenen(), maar zonder de N x N-scan.
 * Kandidaten worden eerst beperkt op weg/richting, type/code, hectometrering
 * en tijdvenster. De overblijvende kandidaten worden op oorspronkelijke
 * indexvolgorde verwerkt, zodat ook de trace-opbouw gelijk blijft.
 */
export function applyCombiRulesIndexed(messages,rules,cfg={}){
  const M=Array.isArray(messages)?messages:[];
  const active=(Array.isArray(rules)?rules:[]).filter(c=>c&&c.actief);
  let hits=0,pairChecks=0,candidateChecks=0;
  const started=Date.now();

  for(const c of active){
    const zelfde=c.type1===c.type2&&String(c.code1)===String(c.code2);
    const maxKm=Number(c.maxKm);
    const useHm=Number.isFinite(maxKm)&&maxKm>0;
    const venRaw=c.venMin==null?null:Number(c.venMin);
    const venMs=venRaw==null?null:venRaw*60000;

    // De bestaande vergelijking verwerpt bij een negatief tijdvenster ieder
    // geldig tijdpaar. Er kunnen dan geen combinaties ontstaan.
    if(Number.isFinite(venMs)&&venMs<0)continue;

    const groups=new Map();
    for(let j=0;j<M.length;j++){
      const b=M[j];
      if(!ruleCodeMatch(b,c.type2,c.code2))continue;
      if(useHm&&b.hm==null)continue;

      const key=groupKey(b);
      let g=groups.get(key);
      if(!g){
        g={all:[],byHm:[],hmUnknown:[],byTime:[],timeUnknown:[]};
        groups.set(key,g);
      }

      const hm=b.hm==null?null:Number(b.hm);
      const t=b.t?Number(b.t):null;
      const entry={i:j,m:b,hm,t};
      g.all.push(entry);

      if(useHm){
        if(Number.isFinite(hm))g.byHm.push(entry);else g.hmUnknown.push(entry);
      }
      if(c.venMin!=null){
        if(Number.isFinite(t))g.byTime.push(entry);else g.timeUnknown.push(entry);
      }
    }

    for(const g of groups.values()){
      if(useHm)g.byHm.sort((a,b)=>a.hm-b.hm||a.i-b.i);
      if(c.venMin!=null)g.byTime.sort((a,b)=>a.t-b.t||a.i-b.i);
    }

    for(let i=0;i<M.length;i++){
      const a=M[i];
      if(!ruleCodeMatch(a,c.type1,c.code1))continue;

      const g=groups.get(groupKey(a));
      if(!g)continue;
      if(useHm&&a.hm==null)continue;

      const aHm=a.hm==null?null:Number(a.hm);
      const aTime=a.t?Number(a.t):null;
      const spatialUsable=useHm&&Number.isFinite(aHm);
      const timeUsable=c.venMin!=null&&Number.isFinite(venMs)&&Number.isFinite(aTime);
      let spatial=null,time=null;

      if(spatialUsable){
        const lo=lowerBound(g.byHm,aHm-maxKm,e=>e.hm);
        const hi=upperBound(g.byHm,aHm+maxKm,e=>e.hm);
        spatial=g.byHm.slice(lo,hi).concat(g.hmUnknown);
      }else if(useHm){
        // Niet-numerieke, maar wel aanwezige hm-waarden gedragen zich in de
        // oude Math.abs-vergelijking als NaN en worden daardoor niet afgekeurd.
        spatial=g.all;
      }

      if(timeUsable){
        const lo=lowerBound(g.byTime,aTime-venMs,e=>e.t);
        const hi=upperBound(g.byTime,aTime+venMs,e=>e.t);
        time=g.byTime.slice(lo,hi).concat(g.timeUnknown);
      }

      let candidates;
      if(spatial&&time){
        if(spatial.length<=time.length){
          candidates=spatial.filter(e=>!Number.isFinite(e.t)||Math.abs(aTime-e.t)<=venMs);
        }else{
          candidates=time.filter(e=>!Number.isFinite(e.hm)||Math.abs(aHm-e.hm)<=maxKm);
        }
      }else{
        candidates=spatial||time||g.all;
      }

      if(candidates.length>1)candidates=candidates.slice().sort((x,y)=>x.i-y.i);

      for(const entry of candidates){
        const j=entry.i,b=entry.m;
        candidateChecks++;
        if(i===j||(zelfde&&i>=j))continue;
        if(a.weg!==b.weg||a.richting!==b.richting)continue;
        if(!ruleCodeMatch(a,c.type1,c.code1))continue;
        if(!ruleCodeMatch(b,c.type2,c.code2))continue;
        if(+c.maxKm>0&&(a.hm==null||b.hm==null||Math.abs(a.hm-b.hm)>+c.maxKm))continue;
        if(c.venMin!=null&&a.t&&b.t&&Math.abs(a.t-b.t)>c.venMin*60000)continue;

        pairChecks++;
        const vA=a.avail,vP=a.perf;
        a.avail=Math.min(+c.capAvail,a.avail+ +c.extraAvail);
        a.perf=Math.min(+c.capPerf,a.perf+ +c.extraPerf);
        const model=(cfg&&cfg.impactModel)||'cap';
        a.zwaarteA=model==='stapel'?a.zwaarteA+(+c.extraAvail)/100:Math.min(1,a.avail/100);
        a.zwaarteP=model==='stapel'?a.zwaarteP+(+c.extraPerf)/100:Math.min(1,a.perf/100);
        a.trace.zwaarteA=a.zwaarteA;
        a.trace.zwaarteP=a.zwaarteP;
        a.combi=(a.combi||[]).concat(c.id);
        a.trace.combi.push({
          id:c.id,oms:c.oms,
          partner:b.weg+' '+b.richting+(b.hm!=null?(' hm '+b.hm):''),
          partnerCode:b.code,
          extraAvail:+c.extraAvail,extraPerf:+c.extraPerf,
          vaVoor:vA,vaNa:a.avail,vpVoor:vP,vpNa:a.perf
        });
        hits++;
      }
    }
  }

  const result={
    hits,pairChecks,candidateChecks,
    durationMs:Date.now()-started,
    messages:M.length,rules:active.length
  };
  try{globalThis.__BIDASH_LAST_COMBI_PERF__=result;}catch(error){}
  return result;
}

export function patchDoorrekenenSource(source){
  const text=String(source||'');
  const startMarker='// stap 5: combiregels';
  const endMarker='// rapportageperiode uit de van/tot data';
  const start=text.indexOf(startMarker);
  const end=text.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<0)return null;

  const lineStart=Math.max(0,text.lastIndexOf('\n',start)+1);
  const replacement=[
    '  // stap 5: combiregels, geïndexeerd om N x N-scans bij grote historie te voorkomen',
    '  const __bidashCombiPerf=globalThis.__BIDASH_DVM_COMBI_PERF_HELPERS__.applyCombiRulesIndexed(M,RULES.combiRegels,RULES.cfg);',
    '  let combiHits=__bidashCombiPerf.hits;',
    ''
  ].join('\n');
  return text.slice(0,lineStart)+replacement+text.slice(end);
}

export function installDvmCombiPerformance(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_DVM_COMBI_PERF_ACTIVE__)return true;

  let source='';
  try{source=scope.eval('typeof doorrekenen==="function"?doorrekenen.toString():""');}catch(error){return false;}
  const patched=patchDoorrekenenSource(source);
  if(!patched){
    console.error('BiDash combiregel-optimalisatie kon doorrekenen() niet herkennen.');
    return false;
  }

  scope.__BIDASH_DVM_COMBI_PERF_HELPERS__={applyCombiRulesIndexed};
  scope.__BIDASH_DVM_COMBI_PATCH_SOURCE__=patched;
  try{
    scope.eval("doorrekenen=eval('('+globalThis.__BIDASH_DVM_COMBI_PATCH_SOURCE__+')');globalThis.__BIDASH_DVM_COMBI_PERF_ACTIVE__=true;");
    delete scope.__BIDASH_DVM_COMBI_PATCH_SOURCE__;
    return !!scope.__BIDASH_DVM_COMBI_PERF_ACTIVE__;
  }catch(error){
    delete scope.__BIDASH_DVM_COMBI_PATCH_SOURCE__;
    console.error('BiDash combiregel-optimalisatie kon niet worden gestart.',error);
    return false;
  }
}
