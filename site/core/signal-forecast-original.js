export const DEFAULT_SIGNAL_FORECAST_RULES=Object.freeze({
  referenceYear:2026,
  startYear:2026,
  endYear:2036,
  baseFte:300,
  ftePerReferenceKm:12,
  referenceKm:95,
  fallbackKmPerLocation:1,
  fteCostYear:95000,
  mcRuns:1000,
  degradeStartPct:20,
  permanentChancePct:75,
  seed:7102026,
  defaultLifeYears:20,
  triggerExtraFtePct:5,
  triggerAnnualCost:1000000,
  triggerPermanentPct:10
});

const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function normalizeForecastRules(input={}){
  const d=DEFAULT_SIGNAL_FORECAST_RULES;
  const referenceYear=Math.round(finite(input.referenceYear,d.referenceYear));
  let startYear=Math.round(finite(input.startYear,d.startYear));
  let endYear=Math.round(finite(input.endYear,d.endYear));
  if(startYear>referenceYear)startYear=referenceYear;
  if(endYear<referenceYear)endYear=referenceYear;
  if(endYear<startYear)[startYear,endYear]=[endYear,startYear];
  return {
    referenceYear,startYear,endYear,
    baseFte:Math.max(0,finite(input.baseFte,d.baseFte)),
    ftePerReferenceKm:Math.max(0,finite(input.ftePerReferenceKm,d.ftePerReferenceKm)),
    referenceKm:Math.max(.01,finite(input.referenceKm,d.referenceKm)),
    fallbackKmPerLocation:Math.max(.01,finite(input.fallbackKmPerLocation,d.fallbackKmPerLocation)),
    fteCostYear:Math.max(0,finite(input.fteCostYear,d.fteCostYear)),
    mcRuns:Math.round(clamp(finite(input.mcRuns,d.mcRuns),250,10000)),
    degradeStartPct:clamp(finite(input.degradeStartPct,d.degradeStartPct),1,80),
    permanentChancePct:clamp(finite(input.permanentChancePct,d.permanentChancePct),0,100),
    seed:Math.trunc(finite(input.seed,d.seed)),
    defaultLifeYears:Math.max(1,finite(input.defaultLifeYears,d.defaultLifeYears)),
    triggerExtraFtePct:Math.max(0,finite(input.triggerExtraFtePct,d.triggerExtraFtePct)),
    triggerAnnualCost:Math.max(0,finite(input.triggerAnnualCost,d.triggerAnnualCost)),
    triggerPermanentPct:clamp(finite(input.triggerPermanentPct,d.triggerPermanentPct),0,100)
  };
}

function assetLife(asset,rules){
  return finite(asset?.modelLevensduur,
    finite(asset?.eolLevensduur,
      finite(asset?.eol?.levensduur,rules.defaultLifeYears)));
}

export function localEolModel(asset,startPct,allAssets,referenceYear,defaultLifeYears=20){
  const rules={defaultLifeYears};
  const life=assetLife(asset,rules);
  const explicit=finite(asset?.eol?.jaar,finite(asset?._eolYear,0));
  let eol=explicit||null,bron=explicit?'Expliciete EoL':'';
  if(!eol&&finite(asset?.bouwjaar,0)>0){eol=finite(asset.bouwjaar,0)+life;bron='Bouwjaar + levensduur';}
  if(!eol){
    const same=(allAssets||[]).filter(x=>finite(x?.bouwjaar,0)>0&&x.weg===asset.weg&&x.richting===asset.richting).map(x=>finite(x.bouwjaar,0)).sort((a,b)=>a-b);
    const all=(allAssets||[]).filter(x=>finite(x?.bouwjaar,0)>0).map(x=>finite(x.bouwjaar,0)).sort((a,b)=>a-b);
    const values=same.length?same:all;
    const proxy=values.length?values[Math.floor(values.length/2)]:referenceYear-life*.8;
    eol=proxy+life;
    bron=values.length?'Mediaan bouwjaar + levensduur':'Generieke terugval';
  }
  return {life,eol,onset:eol-life*startPct/100,bron};
}

export function seededRandom(seed){
  let x=seed>>>0;
  return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};
}

async function simulateRoad(assets,allAssets,rules,seedOffset,onBatch,isCancelled){
  const models=assets.map(a=>localEolModel(a,rules.degradeStartPct,allAssets,rules.referenceYear,rules.defaultLifeYears));
  const sums=Array.from({length:rules.endYear-rules.startYear+1},()=>({affected:0,permanent:0}));
  const perm=rules.permanentChancePct/100,batchSize=25;
  for(let batch=0;batch<rules.mcRuns;batch+=batchSize){
    if(isCancelled?.())throw new Error('BEREKENING_GESTOPT');
    const until=Math.min(rules.mcRuns,batch+batchSize);
    for(let r=batch;r<until;r++){
      const rnd=seededRandom((rules.seed+seedOffset+r*2654435761)>>>0),dead=new Uint8Array(assets.length);
      for(let year=rules.startYear,yi=0;year<=rules.endYear;year++,yi++){
        let affected=0,permanent=0;
        for(let i=0;i<assets.length;i++){
          const m=models[i];
          if(dead[i]){affected++;permanent++;continue;}
          if(year>m.eol&&rnd()<perm){dead[i]=1;affected++;permanent++;continue;}
          let p=0;
          if(year>=m.onset){
            const progress=clamp((year+1-m.onset)/Math.max(.01,m.eol-m.onset),0,1);
            p=year<=m.eol?perm*progress:perm;
          }
          if(rnd()<p)affected++;
        }
        sums[yi].affected+=affected;
        sums[yi].permanent+=permanent;
      }
    }
    onBatch?.(until);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return sums.map((v,i)=>({year:rules.startYear+i,modelAffected:v.affected/rules.mcRuns,permanent:v.permanent/rules.mcRuns}));
}

function routeLengthKm(assets,fallbackKm){
  const hms=assets.map(a=>Number(a.hm)).filter(Number.isFinite).sort((a,b)=>a-b);
  const unique=[...new Set(hms.map(x=>x.toFixed(3)))].map(Number);
  return unique.length>=2?Math.max(fallbackKm,unique.at(-1)-unique[0]):Math.max(fallbackKm,unique.length*fallbackKm);
}

function normalizeAsset(a){
  return {
    ...a,
    weg:a?.weg||'Onbekend',richting:a?.richting||'',vc:a?.vc||'Onbekend'
  };
}

export async function simulateSignalForecast(inputAssets,rulesInput={},options={}){
  const rules=normalizeForecastRules(rulesInput);
  const assets=(inputAssets||[]).filter(a=>(a?.tp||a?.assetType)==='MSI'&&a?.prognoseActief!==false).map(normalizeAsset);
  if(!assets.length)throw new Error('Geen signaalgevers beschikbaar.');
  const groups=new Map();
  for(const a of assets){const key=[a.weg,a.richting,a.vc].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
  const roads=[],entries=[...groups.entries()],totalWork=entries.length*rules.mcRuns;
  let completed=0;
  for(let gi=0;gi<entries.length;gi++){
    if(options.isCancelled?.())throw new Error('BEREKENING_GESTOPT');
    const [key,roadAssets]=entries[gi],[weg,richting,vc]=key.split('|'),routeKm=routeLengthKm(roadAssets,rules.fallbackKmPerLocation),before=completed;
    const years=await simulateRoad(roadAssets,assets,rules,gi*7919,done=>{
      completed=before+done;
      options.onProgress?.({completed,totalWork,pct:100*completed/Math.max(1,totalWork),roadIndex:gi+1,roadCount:entries.length,weg,richting});
    },options.isCancelled);
    for(const v of years){
      v.modelPct=100*v.modelAffected/roadAssets.length;
      v.routeKm=routeKm;
      v.modelAffectedKm=routeKm*v.modelAffected/roadAssets.length;
      v.modelFte=rules.ftePerReferenceKm*v.modelAffectedKm/rules.referenceKm;
      v.permanentPct=100*v.permanent/roadAssets.length;
    }
    const base=years.find(v=>v.year===rules.referenceYear)||years[0];
    for(const v of years){
      v.affected=Math.max(0,v.modelAffected-base.modelAffected);
      v.pct=100*v.affected/roadAssets.length;
      v.affectedKm=Math.max(0,v.modelAffectedKm-base.modelAffectedKm);
      v.fte=Math.max(0,v.modelFte-base.modelFte);
      v.cost=v.fte*rules.fteCostYear;
    }
    roads.push({weg,richting,vc,n:roadAssets.length,routeKm,years});
  }
  const annual=[];let previousTotal=rules.baseFte;
  for(let year=rules.startYear;year<=rules.endYear;year++){
    const values=roads.map(r=>r.years.find(v=>v.year===year)).filter(Boolean);
    const extraFte=year===rules.referenceYear?0:values.reduce((s,v)=>s+v.fte,0);
    const totalFte=rules.baseFte+extraFte;
    annual.push({
      year,
      modelAffected:values.reduce((s,v)=>s+v.modelAffected,0),
      permanent:values.reduce((s,v)=>s+v.permanent,0),
      permanentPct:100*values.reduce((s,v)=>s+v.permanent,0)/assets.length,
      affectedKm:values.reduce((s,v)=>s+v.affectedKm,0),
      extraFte,totalFte,
      growthFte:year===rules.referenceYear?0:totalFte-previousTotal,
      growthPct:year===rules.referenceYear||previousTotal===0?0:(totalFte-previousTotal)/previousTotal*100,
      annualCost:extraFte*rules.fteCostYear
    });
    previousTotal=totalFte;
  }
  const assetForecast=buildAssetForecast(assets,roads,rules);
  return {created:new Date().toISOString(),rules,assetCount:assets.length,roads,annual,assets:assetForecast};
}

function severityWeight(asset){
  const text=[asset?.context,asset?.locatieContext,asset?.naam,asset?.asset,asset?.type].filter(Boolean).join(' ').toLowerCase();
  if(/rijbaanbreed|weefvak|opvolgend/.test(text))return 1;
  if(/splitsing|laatste.?portaal/.test(text))return .75;
  if(/afrit/.test(text))return .5;
  if(/toerit/.test(text))return .25;
  return .5;
}

export function buildAssetForecast(assets,roads,rulesInput={}){
  const rules=normalizeForecastRules(rulesInput),counts={};
  for(const a of assets){const key=[a.weg,a.richting].join('|');counts[key]=(counts[key]||0)+1;}
  const endYear=rules.endYear;
  return assets.map(a=>{
    const eol=localEolModel(a,rules.degradeStartPct,assets,rules.referenceYear,rules.defaultLifeYears);
    const road=roads.find(r=>r.weg===a.weg&&r.richting===a.richting&&r.vc===a.vc),end=road?.years?.find(v=>v.year===endYear);
    const prob=end?end.modelAffected/Math.max(1,road.n):0,permProb=end?end.permanent/Math.max(1,road.n):0;
    const urgency=eol.eol<=rules.referenceYear?1:clamp(1-(eol.eol-rules.referenceYear)/Math.max(1,rules.endYear-rules.referenceYear+1),0,1);
    const share=1/Math.max(1,counts[[a.weg,a.richting].join('|')]);
    const severity=severityWeight(a),score=100*(.4*urgency+.3*prob+.2*severity+.1*Math.min(1,share*20));
    return {key:a.key||a._assetKey||'',naam:a.naam||a.asset||a.code||'Signaalgever',weg:a.weg,richting:a.richting,vc:a.vc,hm:a.hm,bouwjaar:a.bouwjaar||null,eolYear:eol.eol,onsetYear:eol.onset,eolSource:eol.bron,lifeYears:eol.life,probability:prob,permanentProbability:permProb,severity,share,score};
  }).sort((a,b)=>b.score-a.score);
}

export function summarizeSignalForecast(result){
  if(!result?.annual?.length)return null;
  const end=result.annual.at(-1),peakFte=result.annual.reduce((a,b)=>a.totalFte>b.totalFte?a:b),peakGrowth=result.annual.reduce((a,b)=>a.growthFte>b.growthFte?a:b),peakPermanent=result.annual.reduce((a,b)=>a.permanentPct>b.permanentPct?a:b);
  return {
    created:result.created,startYear:result.rules.startYear,endYear:result.rules.endYear,referenceYear:result.rules.referenceYear,
    assetCount:result.assetCount,baseFte:result.rules.baseFte,endExtraFte:end.extraFte,endTotalFte:end.totalFte,endAnnualCost:end.annualCost,endPermanent:end.permanent,endPermanentPct:end.permanentPct,
    peakFteYear:peakFte.year,peakTotalFte:peakFte.totalFte,peakGrowthYear:peakGrowth.year,peakGrowthFte:peakGrowth.growthFte,peakPermanentYear:peakPermanent.year,
    roadCount:result.roads.length
  };
}

export function buildForecastTriggers(result,rulesInput={}){
  const rules=normalizeForecastRules({...result?.rules,...rulesInput}),s=summarizeSignalForecast(result);if(!s)return[];
  const out=[],extraPct=rules.baseFte?s.endExtraFte/rules.baseFte*100:0;
  if(extraPct>=rules.triggerExtraFtePct){
    const sev=extraPct>=rules.triggerExtraFtePct*2?'rood':'oranje';
    out.push({id:'forecast-wis-fte',sev,titel:'Toekomstige WIS-capaciteitsvraag boven grens',msg:`In ${s.endYear} vraagt signaalgeveruitval ${s.endExtraFte.toFixed(1)} extra WIS-FTE boven de basis van ${rules.baseFte.toFixed(0)} FTE, ${extraPct.toFixed(1)}%.`,resp:'VWM / WIS-capaciteitsmanagement',regel:`WIS extra FTE ≥ ${rules.triggerExtraFtePct}% van basisformatie`,val:`${s.endExtraFte.toFixed(1)} FTE`});
  }
  if(s.endAnnualCost>=rules.triggerAnnualCost){
    const sev=s.endAnnualCost>=rules.triggerAnnualCost*2?'rood':'oranje';
    out.push({id:'forecast-wis-cost',sev,titel:'Jaarlijkse WIS-meerkosten boven grens',msg:`Het geprognosticeerde jaarlijkse kostenniveau in ${s.endYear} is € ${Math.round(s.endAnnualCost).toLocaleString('nl-NL')} door extra WIS-capaciteit.`,resp:'VWM / financieel management',regel:`WIS jaarlijkse meerkosten ≥ € ${Math.round(rules.triggerAnnualCost).toLocaleString('nl-NL')}`,val:`€ ${Math.round(s.endAnnualCost).toLocaleString('nl-NL')}`});
  }
  if(s.endPermanentPct>=rules.triggerPermanentPct){
    const sev=s.endPermanentPct>=Math.min(100,rules.triggerPermanentPct*2)?'rood':'oranje';
    out.push({id:'forecast-msi-permanent',sev,titel:'Permanente signaalgeveruitval boven grens',msg:`Aan het einde van ${s.endYear} is de verwachte cumulatieve permanente uitval ${s.endPermanentPct.toFixed(1)}% van het MSI-areaal.`,resp:'Assetmanagement DVM',regel:`Cumulatieve permanente MSI-uitval ≥ ${rules.triggerPermanentPct}%`,val:`${s.endPermanentPct.toFixed(1)}%`});
  }
  return out;
}
