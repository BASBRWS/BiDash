import './import-known-json-fastpath.js';
import './universal-importer.js';
import './asset-register-special-filter.js';

export const DVM_PARTS=['assetregister','storingshistorie','liveStoringen','dripHistorie','uRoutes','werkzaamheden','parameters','dripSelectie'];
export const BI_RULE_KEYS=['config','configBron','richtlijnen','amRegels','impact','capgrens'];
export const LABELS={dvm:'DVM volledig',assetregister:'Assetregister',storingshistorie:'Storingshistorie',liveStoringen:'Open storingen',dripHistorie:'DRIP-historie',uRoutes:'U-routes',werkzaamheden:'Werkzaamheden',parameters:'DVM-regels, verkeersmodel en simulaties',dripSelectie:'DRIP-selectie',biData:'BI-data: formatie, contracten en assets',biRules:'BI-rekenregels en normen',planning:'Planning: originele XML en instellingen',links:'Dienstkoppelingen',history:'Gezamenlijke dagstanden',quality:'Kwaliteitsaudit en scorehistorie'};
export const DEFAULT_STATE=()=>({schema:1,dvm:null,bi:null,planning:null,links:[],history:[],qualityAudit:null,qualityHistory:[]});
const VALIDATED_ROOTS=new WeakSet();
export function validate(value,depth=0){
 if(depth===0&&value&&typeof value==='object'&&VALIDATED_ROOTS.has(value))return value;
 if(depth>120)throw Error('Bestand is te diep genest.');
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Onveilige objectsleutel: '+k);validate(v,depth+1);}
 if(depth===0&&value&&typeof value==='object')VALIDATED_ROOTS.add(value);
 return value;
}
export function makeExport(state,selection){
 const parts={};
 const dvmKeys=DVM_PARTS.filter(k=>selection.has(k));
 if(state.dvm&&dvmKeys.length)parts.dvm={formaat:'DVM-dienstimpact-totaal',versie:55,exportSelectie:Object.fromEntries(DVM_PARTS.map(k=>[k,selection.has(k)])),...Object.fromEntries(dvmKeys.map(k=>[k,state.dvm[k]]))};
 if(state.bi&&(selection.has('biData')||selection.has('biRules'))){parts.bi={};for(const [k,v] of Object.entries(state.bi))if(selection.has(BI_RULE_KEYS.includes(k)?'biRules':'biData'))parts.bi[k]=v;}
 for(const k of ['planning','links','history'])if(selection.has(k))parts[k]=state[k];
 if(selection.has('quality')){parts.qualityAudit=state.qualityAudit||null;parts.qualityHistory=Array.isArray(state.qualityHistory)?state.qualityHistory:[];}
 return {formaat:'BiDash-integraal',versie:1,opgeslagen:new Date().toISOString(),selectie:[...selection],regelsEigenaar:{impact:'DVM',kosten:'DVM',formatie:'BI',contract:'BI'},delen:parts,afhankelijkheden:dvmKeys.some(k=>k!=='assetregister')&&!selection.has('assetregister')?['Voor DVM-herberekening is een lokaal assetregister nodig.']:[]};
}
export function mergeImport(current,bundle){
 validate(bundle);
 const next={...current};
 if(Array.isArray(current?.links))next.links=current.links.slice();
 if(Array.isArray(current?.history))next.history=current.history.slice();
 if(bundle.formaat==='DVM-dienstimpact-totaal')bundle={formaat:'BiDash-integraal',versie:1,delen:{dvm:bundle}};
 if(bundle.formaat!=='BiDash-integraal'||bundle.versie!==1||!bundle.delen)throw Error('Onbekend formaat of versie.');
 const p=bundle.delen;
 if(p.dvm){
  next.dvm={...(current?.dvm||{formaat:'DVM-dienstimpact-totaal',versie:54})};
  for(const k of DVM_PARTS)if(Object.hasOwn(p.dvm,k)&&p.dvm.exportSelectie?.[k]!==false)next.dvm[k]=p.dvm[k];
  next.dvm.exportSelectie=Object.fromEntries(DVM_PARTS.map(k=>[k,true]));
 }
 if(p.bi)next.bi={...(current?.bi||{}),...p.bi};
 for(const k of ['planning','links','history','qualityAudit','qualityHistory'])if(Object.hasOwn(p,k))next[k]=p[k];
 if(!Array.isArray(next.links)||!Array.isArray(next.history)||next.qualityHistory!=null&&!Array.isArray(next.qualityHistory))throw Error('Koppelingen, dagstanden en kwaliteitshistorie moeten lijsten zijn.');
 if(next.planning&&typeof next.planning.xml!=='string')throw Error('Planning bevat geen originele XML.');
 return next;
}
export function combine(dvm,bi,links){
 const out=[];const seen=new Set();const add=t=>{if(!seen.has(t.id)){seen.add(t.id);out.push(t);}};
 for(const [i,t] of (bi?.triggers||[]).entries())add({...t,id:'bi:'+JSON.stringify([t.dom,t.aid,t.fid,t.titel,t.val]),eigenaar:'BI',regel:'BI / '+(t.titel||t.dom||i)});
 for(const [i,t] of (dvm?.triggers||[]).entries())add({...t,id:'dvm-prognose:'+(t.id||i),eigenaar:'DVM',regel:t.regel||('DVM prognose / '+(t.titel||i))});
 for(const d of dvm?.diensten||[]){
  const low=d.besch!=null&&d.besch<d.norm;
  if(low)add({id:'dvm:'+d.id,sev:'rood',titel:d.naam+' onder dienstnorm',msg:`${d.besch.toFixed(2)}% beschikbaar; norm ${d.norm}%.`,eigenaar:'DVM',regel:'DVM.diensten.'+d.id+'.norm',resp:'Dienstverantwoordelijke'});
  for(const l of links.filter(l=>l.dienst===d.id)){
   const f=bi?.functies.find(f=>f.id===l.functie);if(!f)continue;
   if(low&&f.actueel<f.benodigd)add({id:'samen:'+d.id+':'+f.id,sev:'rood',titel:'Dienstimpact én capaciteitstekort',msg:`${d.naam} onder norm en ${f.naam} mist ${(f.benodigd-f.actueel).toFixed(1)} FTE. Beoordeel prioriteit en inzet samen. Geen automatische vermenigvuldiging van kosten.`,eigenaar:'Samenhang',regel:'DVM-dienstnorm AND BI-formatieregel; expliciete koppeling',resp:l.eigenaar||'Dienstverantwoordelijke'});
  }
 }
 return out;
}
