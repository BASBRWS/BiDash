import {faultsForService,planningForRoad,worksForFaults,planningForFaults,planningPeriodLabel} from './context-api.js';
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const upper=value=>String(value??'').trim().toUpperCase();
const textValue=(row,keys)=>keys.map(key=>row?.[key]).filter(v=>v!==undefined&&v!==null).join(' ');
const fmt=(n,d=0)=>Number.isFinite(Number(n))?Number(n).toLocaleString('nl-NL',{maximumFractionDigits:d}):'onbekend';
const euro=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}):'onbekend';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const TYPE_SYNONYMS=[
  {type:'LUS',terms:['detectielus','detectielussen','detectie','detector','detectoren','lus','lussen','meetlus','inductielus']},
  {type:'MSI',terms:['msi','signaalgever','signaalgevers','kruislamp','kruislampen']},
  {type:'DRIP',terms:['drip','drips']},
  {type:'CAM',terms:['camera','cameras','camera\'s','cam']},
  {type:'WISSELBORD',terms:['wisselbord','wisselborden']},
  {type:'COMM',terms:['communicatie','comm']}
];

const FOLLOW_WORDS=['daarvan','daarin','die','deze','zelfde','zelfde selectie','en hoeveel','en welke','en wat','hoe zit het met'];

export function normalizeQuestion(value){return fold(value).replace(/\s+/g,' ');}

function containsTerm(text,term){
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,'i').test(text);
}

function detectType(text){
  for(const item of TYPE_SYNONYMS)if(item.terms.some(term=>containsTerm(text,fold(term))))return item.type;
  return null;
}

function detectRoad(raw){
  const match=String(raw||'').toUpperCase().match(/\b([AN]\s?\d{1,3})\b/);
  return match?match[1].replace(/\s+/g,''):null;
}

function detectCode(raw){
  const text=String(raw||'');
  const match=text.match(/(?:foutcode|code)\b\s*[:#]?\s*([A-Za-z0-9._-]+)/i);
  return match?String(match[1]).trim():null;
}

function detectVc(text,data){
  const candidates=new Set();
  for(const row of [...(data?.faults||[]),...(data?.assets||[]),...(data?.roads||[])])if(row?.vc)candidates.add(upper(row.vc));
  const raw=upper(text).replace(/^VC\s+/,'');
  const words=raw.split(/[^A-Z0-9]+/).filter(Boolean);
  const aliases={WNZ:'ZWN',WNN:'NWN'};
  for(const word of words){const canonical=aliases[word]||word;if(candidates.has(canonical))return canonical;}
  for(const candidate of candidates){if(new RegExp(`(^|[^A-Z0-9])${candidate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^A-Z0-9]|$)`).test(raw))return candidate;}
  return null;
}

function detectService(text,data){
  const services=data?.services||[];
  let best=null;
  for(const service of services){
    const label=fold(service.naam||service.label||service.id);
    if(label&&text.includes(label)&&(best==null||label.length>best.label.length))best={service,label};
  }
  return best?.service||null;
}

function explicitDataset(text){
  const fault=/\b(storing|storingen|melding|meldingen|foutcode|foutcodes|impact|msi|drip|drips|detectie|detectielus|detectielussen|lus|lussen|camera|cameras)\b/.test(text);
  const service=/\b(dienstverlening|dienst|diensten|beschikbaarheid|subproces|subprocessen)\b/.test(text);
  const planning=/\b(planning|planningactiviteit|planningactiviteiten|activiteit|activiteiten|mijlpaal|mijlpalen|projectplanning|gepland|plannen|planwerk|afhankelijkheid|afhankelijkheden)\b/.test(text);
  const work=/\b(werkzaamheid|werkzaamheden|werkvak|werkvakken|afsluiting|hinder)\b/.test(text);
  const capacity=/\b(formatie|capaciteit|fte|bezetting|personeel|capaciteitstekort|capaciteitsoverschrijding)\b/.test(text);
  const relation=/\b(verband|samenhang|oorzaak|verklaar|waarom|raakt|raken|beinvloed|beinvloeden|drukt|effect op|gekoppeld|horen bij|valt samen|vallen samen)\b/.test(text);
  if((fault&&(service||planning||work))||(service&&capacity)||relation&&(fault||service||planning||work||capacity))return 'relations';
  if(planning)return 'planning';
  if(capacity)return 'capacity';
  if(work)return 'works';
  if(/\b(u[- ]?route|u[- ]?routes|omleidingsroute|omleidingsroutes)\b/.test(text))return 'uroutes';
  if(/\b(historie|historisch|historische|storingshistorie|verleden)\b/.test(text))return 'history';
  if(/\b(eol|end of life|einde levensduur|levensduur|veroudering|verouderd)\b/.test(text))return 'eol';
  if(/\b(kosten|verkeerskosten|vvu|voertuigverlies|voertuigverliesuren|wegdeel|wegdelen)\b/.test(text))return 'roads';
  if(service)return 'services';
  if(/\b(asset|assets|areaal|register)\b/.test(text)&&!fault)return 'assets';
  if(fault)return 'faults';
  return null;
}

function inferDataset(text,previous={},screen={}){return explicitDataset(text)||previous.dataset||screen.dataset||'overview';}

function inferIntent(text,dataset){
  if(/\b(meest voorkomende|vaakst|top\s*\d*\s*fout|welke foutcodes|foutcodes komen)\b/.test(text))return 'groupCodes';
  if(/\b(meeste impact|hoogste impact|grootste impact|grootste bijdrage|zwaarst)\b/.test(text))return 'topImpact';
  if(/\b(waarom|verklaar|oorzaak|waardoor)\b/.test(text))return 'explain';
  if(/\b(overlap|samen|tegelijk|samenvallen|raakt|raken|verband|samenhang)\b/.test(text))return 'relate';
  if(/\b(hoeveel|hoe veel|aantal)\b/.test(text))return 'count';
  if(/\b(vergelijk|verschil tussen)\b/.test(text))return 'compare';
  if(/\b(toon|laat zien|welke|lijst|overzicht|wat staat|wat loopt)\b/.test(text))return 'list';
  if(dataset==='services'&&/\b(hoe|wat|beschikbaarheid|dienstverlening)\b/.test(text))return 'list';
  if(dataset==='roads'&&/\b(kosten|vvu|voertuigverlies)\b/.test(text))return 'sum';
  return 'summary';
}

function detectPeriod(text){
  const yearMatch=text.match(/\b(20\d{2})\b/);
  let year=yearMatch?Number(yearMatch[1]):null,quarter=null;
  const qMatch=text.match(/\bq([1-4])\b|\b([1-4])e\s+kwartaal\b/);
  if(qMatch)quarter=Number(qMatch[1]||qMatch[2]);
  if(/\bdit jaar\b/.test(text))year=new Date().getFullYear();
  if(/\bvolgend jaar\b/.test(text))year=new Date().getFullYear()+1;
  if(/\bdit kwartaal\b/.test(text)){const d=new Date();year=d.getFullYear();quarter=Math.floor(d.getMonth()/3)+1;}
  return {year,quarter};
}
function detectPlanningDienst(text,data){
  const candidates=new Set([
    ...Object.keys(data?.capacity?.perDienst||{}),
    ...(data?.planning?.activities||[]).map(a=>a.dienst).filter(Boolean)
  ]);
  const raw=upper(text);
  return [...candidates].sort((a,b)=>String(b).length-String(a).length).find(x=>containsTerm(raw,upper(x)))||null;
}
function cleanContext(previous={}){
  return {
    dataset:previous.dataset||null,
    filters:{...(previous.filters||{})},
    serviceId:previous.serviceId||null,
    planningDienst:previous.planningDienst||null
  };
}
export function parseQuestion(question,{previousContext={},screenContext={},data={},mode='all'}={}){
  const raw=String(question||'').trim();
  const text=normalizeQuestion(raw);
  const follow=FOLLOW_WORDS.some(word=>text.includes(word));
  const explicit=explicitDataset(text);
  const previous=cleanContext(previousContext),screen=cleanContext(mode==='screen'?screenContext:{});
  const inheritPrevious=!!previous.dataset&&(!explicit||explicit===previous.dataset||follow);
  const base=inheritPrevious?previous:screen;
  const dataset=explicit||base.dataset||'overview';
  const filters={...(base.filters||{})};
  if(/\b(landelijk|heel nederland|alle centrales)\b/.test(text)){delete filters.vc;delete filters.road;}
  if(/\b(alle wegen|alle wegdelen)\b/.test(text))delete filters.road;
  if(/\b(alle types|alle assettypes)\b/.test(text))delete filters.typeId;
  const typeId=detectType(text);if(typeId)filters.typeId=typeId;
  const road=detectRoad(raw);if(road)filters.road=road;
  const vc=detectVc(raw,data);if(vc)filters.vc=vc;
  const code=detectCode(raw);if(code)filters.code=code;
  if(/\b(niet doorgerekend|zonder impact|onbekende impact)\b/.test(text))filters.rekenStatus='niet doorgerekend';
  if(/\b(doorgerekend|met impact)\b/.test(text)&&!/niet doorgerekend/.test(text))filters.rekenStatus='doorgerekend';
  const period=detectPeriod(text);if(period.year)filters.year=period.year;if(period.quarter)filters.quarter=period.quarter;
  const service=detectService(text,data);
  let finalDataset=dataset;
  if(service&&/\b(waarom|oorzaak|storing|storingen|impact|drukt|beinvloed|verband|samenhang|formatie|capaciteit|fte|personeel|gekoppeld)\b/.test(text))finalDataset='relations';
  const planningDienst=detectPlanningDienst(text,data)||base.planningDienst||null;
  const context={dataset:finalDataset,filters,serviceId:service?.id||base.serviceId||null,planningDienst};
  return {raw,text,dataset:finalDataset,intent:inferIntent(text,finalDataset),context,follow};
}

function sameText(a,b){return fold(a)===fold(b);}
function includesText(value,needle){return fold(value).includes(fold(needle));}

export function filterFaults(rows=[],filters={}){
  return rows.filter(row=>{
    if(filters.typeId&&upper(row.typeId)!==upper(filters.typeId))return false;
    if(filters.road&&upper(row.weg)!==upper(filters.road))return false;
    if(filters.vc&&upper(row.vc)!==upper(filters.vc))return false;
    if(filters.code&&!sameText(row.code,filters.code))return false;
    if(filters.rekenStatus==='niet doorgerekend'&&row.impact!=null)return false;
    if(filters.rekenStatus==='doorgerekend'&&row.impact==null)return false;
    if(filters.search&&!includesText(textValue(row,['naam','assetKey','omschrijving','code','weg','richting','vc']),filters.search))return false;
    return true;
  });
}

export function filterAssets(rows=[],filters={}){
  return rows.filter(row=>{
    if(filters.typeId&&upper(row.tp||row.assetType)!==upper(filters.typeId))return false;
    if(filters.road&&![row.weg,row.raw?.weg].some(v=>upper(v).includes(upper(filters.road))))return false;
    if(filters.vc&&upper(row.vc)!==upper(filters.vc))return false;
    if(filters.source&&upper(row.source)!==upper(filters.source))return false;
    if(filters.search&&!includesText(textValue(row,['naam','key','tp','assetType','vc','weg','status']),filters.search))return false;
    return true;
  });
}

export function filterRoads(rows=[],filters={}){
  return rows.filter(row=>{
    const hay=upper(textValue(row,['naam','weg','id']));
    if(filters.road&&!hay.includes(upper(filters.road)))return false;
    if(filters.vc&&upper(row.vc)!==upper(filters.vc))return false;
    return true;
  });
}

function contextLabels(context={}){
  const f=context.filters||{},out=[];
  if(f.vc)out.push(`VC ${f.vc}`);
  if(f.road)out.push(f.road);
  if(f.typeId)out.push(f.typeId==='LUS'?'Detectielus':f.typeId);
  if(f.code)out.push(`foutcode ${f.code}`);
  if(f.rekenStatus)out.push(f.rekenStatus);
  if(f.year)out.push(String(f.year));
  if(f.quarter)out.push('Q'+f.quarter);
  if(context.planningDienst)out.push(String(context.planningDienst));
  return out;
}

function suggestionsFor(context){
  if(context.dataset==='faults')return ['Welke foutcodes komen het meest voor?','Welke hebben de hoogste impact?','Welke dienstverlening raakt dit?'];
  if(context.dataset==='assets')return ['Toon de assets','En alleen MSI?','Welke open storingen horen hierbij?'];
  if(context.dataset==='roads')return ['Wat zijn de kosten?','Welke wegdelen hebben de hoogste kosten?','Welke werkzaamheden lopen hier?'];
  if(context.dataset==='services')return ['Waarom is deze dienst lager?','Welke subprocessen bepalen dit?','Welke storingen raken deze dienst?'];
  if(context.dataset==='planning')return ['Welke activiteiten lopen op A15?','Waar piekt de capaciteit?','Welke planning valt samen met storingen?'];
  if(context.dataset==='capacity')return ['Waar wordt de capaciteitsgrens overschreden?','In welk kwartaal is de piek?','Welke planning veroorzaakt die piek?'];
  if(context.dataset==='works')return ['Welke open storingen liggen bij deze werkzaamheden?','Welke U-routes zijn gekoppeld?','Toon werkzaamheden op A15'];
  if(context.dataset==='uroutes')return ['Welke werkzaamheden gebruiken deze U-routes?','Welke assets liggen op deze routes?','Toon U-routes op A15'];
  if(context.dataset==='history')return ['Welke historiebronnen zijn geladen?','Hoeveel historische regels zijn er?','Is DRIP-historie geladen?'];
  if(context.dataset==='relations')return ['Welke storingen dragen het meest bij?','Welke subprocessen leggen dit verband?','Welke planning valt hiermee samen?'];
  return ['Welke storingen drukken op de dienstverlening?','Wat staat er gepland op de A15?','Waar zijn capaciteitstekorten?','Welke werkzaamheden vallen samen met storingen?'];
}

function result(text,context,extra={}){return {text,context,labels:contextLabels(context),suggestions:suggestionsFor(context),...extra};}

function faultResult(parsed,data){
  const rows=filterFaults(data.faults||[],parsed.context.filters),labels=contextLabels(parsed.context),scope=labels.length?' binnen '+labels.join(' · '):'';
  if(parsed.intent==='groupCodes'){
    const counts=new Map();for(const row of rows){const code=String(row.code||'Onbekend');counts.set(code,(counts.get(code)||0)+1);}
    const grouped=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([code,aantal])=>({code,aantal}));
    return result(rows.length?`Binnen deze selectie komen ${grouped.length} foutcodes het meest voor. De lijst hieronder is gesorteerd op aantal.`:`Ik vind geen open storingen${scope}.`,parsed.context,{title:'Foutcodes',columns:[['code','Foutcode'],['aantal','Aantal']],rows:grouped,metrics:[{label:'Open storingen',value:fmt(rows.length)}]});
  }
  if(parsed.intent==='topImpact'){
    const sorted=rows.filter(r=>Number.isFinite(Number(r.impact))).sort((a,b)=>Number(b.impact)-Number(a.impact)).slice(0,15);
    const unknown=rows.filter(r=>r.impact==null).length;
    return result(sorted.length?`De hoogste berekende impact${scope} is ${fmt(sorted[0].impact,1)}%. Impactpercentages worden niet bij elkaar opgeteld.`:`Ik vind geen doorgerekende storingen${scope}.`,parsed.context,{title:'Hoogste impact',columns:[['naam','Asset / melding'],['code','Foutcode'],['weg','Weg'],['vc','VC'],['impact','Impact %']],rows:sorted,metrics:[{label:'Selectie',value:fmt(rows.length)},{label:'Niet doorgerekend',value:fmt(rows.filter(r=>r.impact==null).length)}],note:unknown?'Niet-doorgerekende meldingen blijven buiten de impactrangschikking.':''});
  }
  if(parsed.intent==='list'){
    return result(rows.length?`Ik heb ${fmt(rows.length)} open storingen gevonden${scope}. Ik toon maximaal 25 regels; de selectie zelf blijft volledig.`:`Ik vind geen open storingen${scope}.`,parsed.context,{title:'Open storingen',columns:[['naam','Asset / melding'],['typeId','Type'],['weg','Weg'],['richting','Richting'],['vc','VC'],['code','Foutcode'],['impact','Impact %']],rows:rows.slice(0,25),metrics:[{label:'Aantal',value:fmt(rows.length)}]});
  }
  const typeCounts=new Map();for(const row of rows){const key=row.typeId||'Onbekend';typeCounts.set(key,(typeCounts.get(key)||0)+1);}
  const breakdown=[...typeCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([type,aantal])=>({type:type==='LUS'?'Detectielus':type,aantal}));
  return result(`Er ${rows.length===1?'is':'zijn'} ${fmt(rows.length)} open ${rows.length===1?'storing':'storingen'}${scope}.`,parsed.context,{title:'Open storingen',metrics:[{label:'Aantal',value:fmt(rows.length)},{label:'Niet doorgerekend',value:fmt(rows.filter(r=>r.impact==null).length)}],columns:breakdown.length?[['type','Type'],['aantal','Aantal']]:[],rows:breakdown});
}

function assetResult(parsed,data){
  const rows=filterAssets(data.assets||[],parsed.context.filters),labels=contextLabels(parsed.context),scope=labels.length?' binnen '+labels.join(' · '):'';
  if(parsed.intent==='list')return result(rows.length?`Ik heb ${fmt(rows.length)} assets gevonden${scope}.`:`Ik vind geen assets${scope}.`,parsed.context,{title:'Assets',metrics:[{label:'Aantal',value:fmt(rows.length)}],columns:[['naam','Asset'],['tp','Type'],['vc','VC'],['weg','Locatie'],['status','Status']],rows:rows.slice(0,25)});
  return result(`Er ${rows.length===1?'is':'zijn'} ${fmt(rows.length)} ${rows.length===1?'asset':'assets'}${scope}.`,parsed.context,{title:'Assets',metrics:[{label:'Aantal',value:fmt(rows.length)}]});
}

function roadResult(parsed,data){
  const rows=filterRoads(data.roads||[],parsed.context.filters),known=rows.filter(r=>Number.isFinite(Number(r.kosten))),knownVvu=rows.filter(r=>Number.isFinite(Number(r.vvu))),cost=known.reduce((s,r)=>s+Number(r.kosten),0),vvu=knownVvu.reduce((s,r)=>s+Number(r.vvu),0);
  const ordered=rows.slice().sort((a,b)=>(Number(b.kosten)||-Infinity)-(Number(a.kosten)||-Infinity));
  return result(rows.length?`Voor ${fmt(known.length)} van ${fmt(rows.length)} geselecteerde wegdelen zijn verkeerskosten berekenbaar. De som is een bekend subtotaal; controleer overlap tussen verkeersstromen.`:'Ik vind geen wegdelen voor deze selectie.',parsed.context,{title:'Verkeerskosten',metrics:[{label:'Bekend subtotaal',value:known.length?euro(cost):'Onbekend'},{label:'VVU / brondag',value:knownVvu.length?fmt(vvu,1):'Onbekend'},{label:'Berekenbaar',value:`${known.length} / ${rows.length}`}],columns:[['naam','Wegdeel'],['vc','VC'],['vvu','VVU'],['kosten','Kosten']],rows:ordered.slice(0,20).map(r=>({...r,kosten:Number.isFinite(Number(r.kosten))?euro(Number(r.kosten)):'Onbekend',vvu:Number.isFinite(Number(r.vvu))?fmt(Number(r.vvu),1):'Onbekend'})),note:'Assetverliesuren zijn niet hetzelfde als voertuigverliesuren.'});
}

function serviceResult(parsed,data){
  let rows=(data.services||[]).slice();
  if(parsed.context.serviceId)rows=rows.filter(row=>String(row.id)===String(parsed.context.serviceId));
  if(/subproces|subprocessen/.test(parsed.text)){
    const subs=(data.subprocesses||[]).filter(sp=>!parsed.context.serviceId||String(sp.serviceId)===String(parsed.context.serviceId));
    return result(subs.length?`Ik vind ${fmt(subs.length)} subprocessen binnen deze dienstverleningselectie. Per subproces toon ik op welke assettypen de ingestelde afhankelijkheid rust.`:'Ik vind geen subprocessen binnen deze selectie.',parsed.context,{title:'Subprocessen',metrics:[{label:'Subprocessen',value:fmt(subs.length)}],columns:[['serviceName','Dienst'],['naam','Subproces'],['aandeelLabel','Aandeel dienst'],['bronnenLabel','Assetafhankelijkheden'],['dekkingLabel','Dekking']],rows:subs.map(sp=>({...sp,aandeelLabel:fmt(Number(sp.aandeelDienst||0)*100,1)+'%',bronnenLabel:(sp.bronnen||[]).map(b=>`${b.typeId} ${fmt(Number(b.gewicht||0)*100,1)}%`).join(' · '),dekkingLabel:sp.exact?'volledig':'onvolledig'}))});
  }
  rows.sort((a,b)=>(Number(a.besch??a.lo)||Infinity)-(Number(b.besch??b.lo)||Infinity));
  if(/onder de norm/.test(parsed.text))rows=rows.filter(r=>Number.isFinite(Number(r.besch))&&Number.isFinite(Number(r.norm))&&Number(r.besch)<Number(r.norm));
  const under=rows.filter(r=>Number.isFinite(Number(r.besch))&&Number.isFinite(Number(r.norm))&&Number(r.besch)<Number(r.norm));
  return result(rows.length?`${rows.length===1?'De geselecteerde dienst heeft':'Er zijn '+fmt(rows.length)+' diensten met'} actuele dienstverleningsinformatie. ${under.length?fmt(under.length)+' dienst(en) zitten onder de ingestelde norm.':'Geen doorgerekende dienst zit in deze selectie onder de norm.'}`:'Ik vind geen dienstverlening voor deze selectie.',parsed.context,{title:'Dienstverlening',metrics:[{label:'Diensten',value:fmt(rows.length)},{label:'Onder norm',value:fmt(under.length)}],columns:[['naam','Dienst'],['beschikbaar','Beschikbaarheid'],['normLabel','Norm']],rows:rows.slice(0,20).map(r=>({...r,beschikbaar:r.besch==null?`${fmt(r.lo,2)}–${fmt(r.hi,2)}%`:`${fmt(r.besch,2)}%`,normLabel:`${fmt(r.norm,2)}%`}))});
}


function planningBounds(filters={}){
  const year=Number(filters.year),quarter=Number(filters.quarter);
  if(!Number.isFinite(year))return null;
  if(Number.isFinite(quarter)&&quarter>=1&&quarter<=4)return [year+(quarter-1)/4,year+quarter/4];
  return [year,year+1];
}
function planningRows(data,context={}){
  let rows=(data.planning?.activities||[]).slice(),f=context.filters||{};
  if(f.road)rows=planningForRoad(data,f.road);
  if(context.planningDienst)rows=rows.filter(r=>upper(r.dienst)===upper(context.planningDienst));
  const bounds=planningBounds(f);
  if(bounds)rows=rows.filter(r=>Number(r.t0)<bounds[1]&&Number(r.t1)>=bounds[0]);
  return rows;
}
function planningResult(parsed,data){
  const planning=data.planning;
  if(!planning)return result('Er is geen planningmodel geladen in BiDash.',parsed.context,{title:'Planning',metrics:[{label:'Planning',value:'Niet geladen'}]});
  const selected=planningRows(data,parsed.context).sort((a,b)=>(Number(a.t0)||0)-(Number(b.t0)||0));
  if(/afhankelijk|relatie/.test(parsed.text)){
    const ids=new Set(selected.map(r=>String(r.id))),byId=new Map((planning.activities||[]).map(r=>[String(r.id),r]));
    let rels=(planning.relations||[]).filter(r=>!ids.size||ids.has(String(r.from))||ids.has(String(r.to)));
    const rows=rels.map(r=>({from:byId.get(String(r.from))?.naam||r.from,to:byId.get(String(r.to))?.naam||r.to,type:r.type||'–'}));
    return result(rows.length?`Ik vind ${fmt(rows.length)} planningafhankelijkheden die de huidige selectie raken. De namen en relatietypen komen uit het geladen planningmodel.`:'Ik vind geen planningafhankelijkheden binnen deze selectie.',parsed.context,{title:'Planningafhankelijkheden',metrics:[{label:'Relaties',value:fmt(rows.length)},{label:'Cross-dienst',value:fmt(planning.nCross||0)}],columns:[['from','Van'],['to','Naar'],['type','Relatie']],rows:rows.slice(0,40)});
  }
  const rows=selected;
  const milestones=rows.filter(r=>r.kind==='mile').length,bars=rows.length-milestones;
  const text=rows.length
    ? `Ik vind ${fmt(rows.length)} planningactiviteiten binnen deze selectie. Daarvan zijn ${fmt(bars)} activiteiten en ${fmt(milestones)} mijlpalen. De effectieve datums uit het huidige planningmodel worden gebruikt.`
    : 'Ik vind geen planningactiviteiten binnen deze selectie.';
  return result(text,parsed.context,{
    title:'Planning',
    metrics:[
      {label:'Activiteiten',value:fmt(rows.length)},
      {label:'Relaties',value:fmt(planning.nRel||planning.relations?.length||0)},
      {label:'Cross-dienst',value:fmt(planning.nCross||0)},
      {label:'Shift',value:(Number(planning.shift)||0)+' mnd'}
    ],
    columns:[['naam','Activiteit'],['dienst','Dienst'],['blok','WBS'],['periode','Periode'],['roads','Corridor']],
    rows:rows.slice(0,30).map(r=>({...r,roads:(r.roads||[]).join(', ')})),
    note:rows.length>30?'Eerste 30 activiteiten getoond; de telling gebruikt de volledige selectie.':''
  });
}
function capacityResult(parsed,data){
  const cap=data.capacity;
  if(!cap||!cap.geconfig)return result('Er is geen bruikbare capaciteitsvraag uit de planning beschikbaar. Laad een planning met FTE-configuratie of P6-capaciteit.',parsed.context,{title:'Planning & capaciteit',metrics:[{label:'Capaciteit',value:'Niet beschikbaar'}]});
  const f=parsed.context.filters||{},bounds=planningBounds(f);
  let quarters=(cap.quarters||[]).slice();
  if(bounds)quarters=quarters.filter(q=>q.jaar>bounds[0]&&q.jaar<bounds[1]||q.jaar===Math.floor(bounds[0])&&(!f.quarter||q.q===Number(f.quarter)));
  if(f.year)quarters=quarters.filter(q=>Number(q.jaar)===Number(f.year));
  if(f.quarter)quarters=quarters.filter(q=>Number(q.q)===Number(f.quarter));
  const services=Object.entries(cap.perDienst||{}).filter(([name])=>!parsed.context.planningDienst||upper(name)===upper(parsed.context.planningDienst));
  const overs=services.filter(([,i])=>Number(i.grens)>0&&Number(i.piek)>Number(i.grens));
  if(/overschrijd|overschreden|overschrijding|tekort|boven.*grens/.test(parsed.text)){
    const rows=overs.map(([dienst,i])=>({dienst,piek:fmt(i.piek,2),grens:fmt(i.grens,2),kwartaal:i.piekKw,over:i.overKw}));
    return result(rows.length?`Er zijn ${fmt(rows.length)} planningsdiensten waarvan de piekvraag boven de ingestelde capaciteitsgrens komt.`:'Geen planningsdienst overschrijdt de ingestelde capaciteitsgrens.',parsed.context,{title:'Capaciteitsoverschrijdingen',metrics:[{label:'Overschrijdingen',value:fmt(rows.length)},{label:'Taken met FTE',value:fmt(cap.nMetFte)}],columns:[['dienst','Dienst'],['piek','Piek FTE'],['grens','Grens FTE'],['kwartaal','Piek'],['over','Kwartalen boven grens']],rows});
  }
  const qRows=quarters.map(q=>{
    const selected=parsed.context.planningDienst?Number(q.per?.[parsed.context.planningDienst]||0):Number(q.tot||0);
    return {kwartaal:q.label,fte:fmt(selected,2),detail:parsed.context.planningDienst?parsed.context.planningDienst:Object.entries(q.per||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+' '+fmt(v,1)).join(' · ')};
  });
  const peak=qRows.reduce((best,r)=>Number(String(r.fte).replace(',','.'))>Number(String(best?.fte||0).replace(',','.'))?r:best,null);
  return result(`De planning bevat FTE-vraag voor ${fmt(cap.nMetFte)} van ${fmt(cap.nTaken)} taken. ${overs.length?fmt(overs.length)+' planningsdienst(en) overschrijden ergens de ingestelde grens.':'De ingestelde capaciteitsgrenzen worden niet overschreden.'}`,parsed.context,{title:'Planning & capaciteit',metrics:[{label:'Taken met FTE',value:fmt(cap.nMetFte)},{label:'Totale taak-FTE',value:fmt(cap.totFte,2)},{label:'Diensten boven grens',value:fmt(overs.length)},{label:'Piek selectie',value:peak?peak.fte+' FTE':'–'}],columns:[['kwartaal','Kwartaal'],['fte','FTE-vraag'],['detail','Verdeling']],rows:qRows.slice(0,24)});
}
function workDateBounds(filters={}){
  const y=Number(filters.year),q=Number(filters.quarter);if(!Number.isFinite(y))return null;
  const startMonth=Number.isFinite(q)&&q>=1&&q<=4?(q-1)*3:0,endMonth=Number.isFinite(q)&&q>=1&&q<=4?q*3:12;
  return [new Date(y,startMonth,1).getTime(),new Date(y,endMonth,1).getTime()];
}
function workRows(data,context={}){
  let rows=(data.works||[]).slice(),f=context.filters||{};
  if(f.road)rows=rows.filter(w=>upper(w.weg)===upper(f.road));
  const bounds=workDateBounds(f);if(bounds)rows=rows.filter(w=>(w.startMs??-Infinity)<bounds[1]&&(w.eindMs??Infinity)>=bounds[0]);
  return rows;
}
function worksResult(parsed,data){
  const rows=workRows(data,parsed.context).sort((a,b)=>(Number(a.startMs)||0)-(Number(b.startMs)||0));
  if(!data.sources?.find(s=>s.id==='werkzaamheden')?.loaded&&!rows.length)return result('De bron Werkzaamheden is niet geladen.',parsed.context,{title:'Werkzaamheden',metrics:[{label:'Bron',value:'Niet geladen'}]});
  return result(rows.length?`Ik vind ${fmt(rows.length)} werkzaamheden binnen deze selectie. Koppelingen naar assets en U-routes komen uit de bestaande DVM-context.`:'Ik vind geen werkzaamheden binnen deze selectie.',parsed.context,{title:'Werkzaamheden',metrics:[{label:'Werkvakken',value:fmt(rows.length)},{label:'Met assets',value:fmt(rows.filter(w=>w.assetKeys?.length).length)},{label:'Met U-route',value:fmt(rows.filter(w=>w.routeRefs?.length||w.routeMatches?.length).length)}],columns:[['id','Werk'],['weg','Weg'],['periode','Periode'],['hinder','Hinder'],['omschrijving','Werkzaamheden'],['routeLabel','U-route']],rows:rows.slice(0,30).map(w=>({...w,routeLabel:[...(w.routeRefs||[]),...(w.routeMatches||[])].filter(Boolean).join(', ')}))});
}
function urouteResult(parsed,data){
  let rows=(data.uroutes||[]).slice(),f=parsed.context.filters||{};
  if(f.road)rows=rows.filter(r=>upper(r.weg)===upper(f.road));
  if(!data.sources?.find(s=>s.id==='uRoutes')?.loaded&&!rows.length)return result('De bron U-routes is niet geladen.',parsed.context,{title:'U-routes',metrics:[{label:'Bron',value:'Niet geladen'}]});
  return result(rows.length?`Ik vind ${fmt(rows.length)} U-routes binnen deze selectie.`:'Ik vind geen U-routes binnen deze selectie.',parsed.context,{title:'U-routes',metrics:[{label:'Routes',value:fmt(rows.length)},{label:'Met assets',value:fmt(rows.filter(r=>r.assetKeys?.length).length)}],columns:[['ref','U-route'],['naam','Naam'],['weg','Hoofdweg'],['statusPct','Status %'],['assetsLabel','Assets'],['worksLabel','Werkzaamheden']],rows:rows.slice(0,30).map(r=>({...r,assetsLabel:fmt(r.assetKeys?.length||0),worksLabel:(r.werkRefs||[]).join(', ')}))});
}
function historyResult(parsed,data){
  const sources=[...(data.historySources||[])],drip=(data.dripHistory?.sources||[]).map(s=>({...s,doel:'DRIP Monte Carlo'}));
  const rows=[...sources,...drip].map(s=>({naam:s.naam||s.key,count:fmt(s.count||0),doel:s.doel||'prognose',peildatum:s.peildatum?new Date(s.peildatum).toLocaleDateString('nl-NL'):'–'}));
  const total=[...sources,...drip].reduce((sum,s)=>sum+Number(s.count||0),0);
  return result(rows.length?`Er zijn ${fmt(rows.length)} historische bronstromen geladen met samen ${fmt(total)} bronrecords/incidenten. Historie voedt in DVM de prognoseketen en wordt niet als actuele storing geteld.`:'Er is geen storingshistorie geladen.',parsed.context,{title:'Storingshistorie',metrics:[{label:'Bronstromen',value:fmt(rows.length)},{label:'Records',value:fmt(total)}],columns:[['naam','Bron'],['count','Records'],['doel','Gebruik'],['peildatum','Peildatum']],rows});
}
function assetEolValue(a){
  for(const v of [a.eol,a.eolJaar,a.eolYear,a.endOfLife,a.raw?.eol,a.raw?.eol_jaar,a.raw?.['eol jaar']]){const n=Number(v);if(Number.isFinite(n)&&n>1900)return n;}
  return null;
}
function eolResult(parsed,data){
  const source=data.eol||{},current=new Date().getFullYear(),f=parsed.context.filters||{};
  let assets=(data.assets||[]).map(a=>({...a,_eol:assetEolValue(a)})).filter(a=>a._eol!=null);
  if(f.road)assets=assets.filter(a=>upper(a.weg).includes(upper(f.road)));
  if(f.typeId)assets=assets.filter(a=>upper(a.tp||a.assetType)===upper(f.typeId));
  if(/verouder|einde levensduur|over eol|voorbij/.test(parsed.text))assets=assets.filter(a=>a._eol<=current);
  assets.sort((a,b)=>a._eol-b._eol);
  const text=source.loaded
    ? `De EOL-referentie is geladen met ${fmt(source.count||0)} levensduurregels. Voor ${fmt(assets.length)} assets in de huidige context is ook een concreet EOL-jaar beschikbaar in de ontsloten assetdata.`
    : 'Er is geen aparte EOL-referentie geladen; generieke levensduurregels kunnen nog steeds door DVM worden gebruikt.';
  return result(text,parsed.context,{title:'EOL / levensduur',metrics:[{label:'EOL-regels',value:fmt(source.count||0)},{label:'Assets met EOL-jaar',value:fmt(assets.length)},{label:'Reeds bereikt',value:fmt(assets.filter(a=>a._eol<=current).length)}],columns:[['naam','Asset'],['tp','Type'],['weg','Locatie'],['_eol','EOL-jaar']],rows:assets.slice(0,30)});
}
function serviceFaultRelation(parsed,data){
  const service=(data.services||[]).find(s=>String(s.id)===String(parsed.context.serviceId));
  if(!service)return result('Noem een concrete dienstverlening om het verband met storingen te verklaren.',parsed.context,{title:'Samenhang dienstverlening'});
  let faults=faultsForService(data,service.id);faults=filterFaults(faults,parsed.context.filters);
  faults.sort((a,b)=>(Number(b.gewogenVerlies)||0)-(Number(a.gewogenVerlies)||0)||Number(b.impact||0)-Number(a.impact||0));
  const subs=(data.subprocesses||[]).filter(sp=>String(sp.serviceId)===String(service.id));
  const typeLinks=(data.serviceTypeLinks||[]).filter(l=>String(l.serviceId)===String(service.id));
  const rows=faults.slice(0,25).map(f=>{
    const paths=(f.serviceLinks||[]).flatMap(l=>l.subprocesses||[]).map(x=>x.naam);
    return {...f,pad:[...new Set(paths)].join(' · '),gewogen:fmt(f.gewogenVerlies,2)};
  });
  const availability=service.besch==null?`${fmt(service.lo,2)}–${fmt(service.hi,2)}%`:`${fmt(service.besch,2)}%`;
  const below=service.besch!=null&&Number(service.besch)<Number(service.norm);
  return result(`${service.naam} staat op ${availability} bij een norm van ${fmt(service.norm,2)}%. BiDash koppelt ${fmt(faults.length)} open meldingen via ${fmt(subs.length)} subprocessen en ${fmt(typeLinks.length)} assettype-afhankelijkheden aan deze dienst. ${below?'De dienst ligt onder de ingestelde norm.':'De dienst ligt niet onder de ingestelde norm of de dekking is niet exact.'}`,parsed.context,{title:'Storing → subprocess → dienstverlening',metrics:[{label:'Open gekoppelde meldingen',value:fmt(faults.length)},{label:'Subprocessen',value:fmt(subs.length)},{label:'Beschikbaarheid',value:availability},{label:'Norm',value:fmt(service.norm,2)+'%'}],columns:[['naam','Storing / asset'],['typeId','Type'],['code','Foutcode'],['weg','Weg'],['impact','Assetimpact %'],['pad','Via subprocess'],['gewogen','Gewogen verlies']],rows,note:'De relatie volgt de ingestelde subprocess- en assettype-afhankelijkheden. De gewogen verliesbijdrage is geschikt voor rangschikking, maar is geen zelfstandig optelbaar dienstpercentage.'});
}
function planningFaultRelation(parsed,data){
  const selected=filterFaults(data.faults||[],parsed.context.filters),activities=planningForFaults(data,selected);
  const byRoad=new Map();for(const f of selected){const k=upper(f.weg);if(k)byRoad.set(k,(byRoad.get(k)||0)+1);}
  const rows=activities.map(a=>({...a,roadsLabel:(a.roads||[]).join(', '),faults:(a.roads||[]).reduce((s,r)=>s+(byRoad.get(upper(r))||0),0)})).sort((a,b)=>b.faults-a.faults);
  return result(rows.length?`Ik vind ${fmt(rows.length)} planningactiviteiten op corridors waar binnen de huidige selectie open storingen staan. Dit verband is corridor-gebaseerd; een planningactiviteit is daarmee niet automatisch de oorzaak van een storing.`:'Ik vind geen planningactiviteiten die via een herkenbare corridor samenvallen met de geselecteerde open storingen.',parsed.context,{title:'Planning ↔ open storingen',metrics:[{label:'Open storingen',value:fmt(selected.length)},{label:'Raakvlakken planning',value:fmt(rows.length)},{label:'Corridors met storing',value:fmt(byRoad.size)}],columns:[['naam','Planningactiviteit'],['dienst','Planningsdienst'],['periode','Periode'],['roadsLabel','Corridor'],['faults','Open storingen corridor']],rows:rows.slice(0,30),note:'Koppeling op corridor-token (bijv. A15/N57) uit de planningnaam/code en de weg van de storing.'});
}
function workFaultRelation(parsed,data){
  const selected=filterFaults(data.faults||[],parsed.context.filters),works=worksForFaults(data,selected);
  const keys=new Set(selected.map(f=>String(f.assetKey||'')).filter(Boolean)),roads=new Set(selected.map(f=>upper(f.weg)).filter(Boolean));
  const rows=works.map(w=>({...w,matchAssets:(w.assetKeys||[]).filter(k=>keys.has(String(k))).length,matchRoad:roads.has(upper(w.weg))?'ja':'nee'})).sort((a,b)=>b.matchAssets-a.matchAssets);
  return result(rows.length?`Ik vind ${fmt(rows.length)} werkzaamheden die via gekoppelde assets of dezelfde weg samenhangen met de geselecteerde open storingen.`:'Ik vind geen werkzaamheden die aan de geselecteerde open storingen gekoppeld zijn.',parsed.context,{title:'Werkzaamheden ↔ open storingen',metrics:[{label:'Open storingen',value:fmt(selected.length)},{label:'Werkzaamheden',value:fmt(rows.length)},{label:'Exacte assetmatches',value:fmt(rows.reduce((s,r)=>s+r.matchAssets,0))}],columns:[['id','Werk'],['weg','Weg'],['periode','Periode'],['matchAssets','Geraakte storingsassets'],['hinder','Hinder'],['omschrijving','Werkzaamheden']],rows:rows.slice(0,30)});
}
function serviceCapacityRelation(parsed,data){
  const service=(data.services||[]).find(s=>String(s.id)===String(parsed.context.serviceId));
  if(!service)return result('Noem een concrete dienstverlening om de koppeling met formatie te tonen.',parsed.context,{title:'Dienstverlening ↔ formatie'});
  const links=(data.serviceFunctionLinks||[]).filter(l=>String(l.serviceId)===String(service.id));
  const functions=links.map(l=>{const f=(data.functions||[]).find(x=>String(x.id)===String(l.functionId));return f?{...f,eigenaar:l.eigenaar}:null;}).filter(Boolean);
  const rows=functions.map(f=>({...f,tekort:fmt(Math.max(0,Number(f.benodigd||0)-Number(f.actueel||0)),2),actueelLabel:fmt(f.actueel,2),benodigdLabel:fmt(f.benodigd,2)}));
  return result(rows.length?`${service.naam} heeft ${fmt(rows.length)} expliciete koppeling(en) met bedrijfsfuncties. De tabel gebruikt de bestaande BI-formatiegetallen; er wordt geen FTE-effect uit storingen verzonnen.`:`Voor ${service.naam} zijn geen expliciete dienst↔bedrijfsfunctiekoppelingen vastgelegd.`,parsed.context,{title:'Dienstverlening ↔ formatie',metrics:[{label:'Gekoppelde functies',value:fmt(rows.length)},{label:'Functies met tekort',value:fmt(rows.filter(r=>Number(r.actueel)<Number(r.benodigd)).length)}],columns:[['naam','Bedrijfsfunctie'],['actueelLabel','Actueel FTE'],['benodigdLabel','Benodigd FTE'],['tekort','Tekort FTE'],['eigenaar','Eigenaar']],rows});
}
function serviceOperationalRelation(parsed,data,kind){
  const service=(data.services||[]).find(s=>String(s.id)===String(parsed.context.serviceId));
  if(!service)return result('Noem een concrete dienstverlening om de operationele samenhang te tonen.',parsed.context,{title:'Operationele samenhang'});
  let faults=faultsForService(data,service.id);faults=filterFaults(faults,parsed.context.filters);
  if(kind==='planning'){
    const activities=planningForFaults(data,faults);
    const byRoad=new Map();for(const fault of faults){const key=upper(fault.weg);if(key)byRoad.set(key,(byRoad.get(key)||0)+1);}
    const rows=activities.map(a=>({...a,roadsLabel:(a.roads||[]).join(', '),faults:(a.roads||[]).reduce((sum,r)=>sum+(byRoad.get(upper(r))||0),0)})).sort((a,b)=>b.faults-a.faults);
    return result(rows.length?`Voor ${service.naam} vind ik ${fmt(rows.length)} planningactiviteiten op corridors met open meldingen die via de ingestelde subprocess-afhankelijkheden aan deze dienst zijn gekoppeld.`:`Ik vind geen planningactiviteiten op corridors met open meldingen die aan ${service.naam} zijn gekoppeld.`,parsed.context,{title:'Dienstverlening ↔ storingen ↔ planning',metrics:[{label:'Dienstgekoppelde storingen',value:fmt(faults.length)},{label:'Planningraakvlakken',value:fmt(rows.length)}],columns:[['naam','Planningactiviteit'],['dienst','Planningsdienst'],['periode','Periode'],['roadsLabel','Corridor'],['faults','Dienstgekoppelde storingen']],rows:rows.slice(0,30),note:'Planning en storing zijn hier op corridor gekoppeld. Dit toont samenloop, niet automatisch causaliteit.'});
  }
  const works=worksForFaults(data,faults);
  const faultKeys=new Set(faults.map(f=>String(f.assetKey||'')).filter(Boolean));
  const rows=works.map(w=>({...w,matchAssets:(w.assetKeys||[]).filter(k=>faultKeys.has(String(k))).length,routeLabel:[...(w.routeRefs||[]),...(w.routeMatches||[])].filter(Boolean).join(', ')})).sort((a,b)=>b.matchAssets-a.matchAssets);
  return result(rows.length?`Voor ${service.naam} vind ik ${fmt(rows.length)} werkzaamheden die via dezelfde weg of gekoppelde assets samenlopen met open meldingen die deze dienst raken.`:`Ik vind geen werkzaamheden die samenlopen met de open meldingen die ${service.naam} raken.`,parsed.context,{title:'Dienstverlening ↔ storingen ↔ werkzaamheden',metrics:[{label:'Dienstgekoppelde storingen',value:fmt(faults.length)},{label:'Werkzaamheden',value:fmt(rows.length)},{label:'Exacte assetmatches',value:fmt(rows.reduce((sum,r)=>sum+r.matchAssets,0))}],columns:[['id','Werk'],['weg','Weg'],['periode','Periode'],['matchAssets','Dienststoringsassets'],['hinder','Hinder'],['routeLabel','U-route']],rows:rows.slice(0,30)});
}

function relationResult(parsed,data){
  const t=parsed.text;
  if(parsed.context.serviceId&&/\b(formatie|capaciteit|fte|personeel)\b/.test(t))return serviceCapacityRelation(parsed,data);
  if(parsed.context.serviceId&&/\b(planning|gepland|activiteit|activiteiten|mijlpaal|projectplanning)\b/.test(t))return serviceOperationalRelation(parsed,data,'planning');
  if(parsed.context.serviceId&&/\b(werkzaamheid|werkzaamheden|werkvak|werkvakken|hinder|afsluiting|u[- ]?route|u[- ]?routes)\b/.test(t))return serviceOperationalRelation(parsed,data,'works');
  if(parsed.context.serviceId)return serviceFaultRelation(parsed,data);
  if(/\b(planning|gepland|activiteit|activiteiten|mijlpaal|projectplanning)\b/.test(t)&&/\b(storing|storingen|melding|meldingen|impact)\b/.test(t))return planningFaultRelation(parsed,data);
  if(/\b(werkzaamheid|werkzaamheden|werkvak|werkvakken|hinder|afsluiting)\b/.test(t)&&/\b(storing|storingen|melding|meldingen|impact)\b/.test(t))return workFaultRelation(parsed,data);
  const under=(data.services||[]).filter(s=>s.besch!=null&&Number(s.besch)<Number(s.norm)).sort((a,b)=>Number(a.besch)-Number(b.besch));
  if(under.length){const next={...parsed,context:{...parsed.context,serviceId:under[0].id}};return serviceFaultRelation(next,data);}
  return result('Ik kan samenhang leggen via storing → assettype → subprocess → dienstverlening, via expliciete dienst↔bedrijfsfunctiekoppelingen, en via corridor/assetkoppelingen naar planning en werkzaamheden. Noem een dienst, weg of planningonderwerp om de relatie te beperken.',parsed.context,{title:'Samenhang in BiDash',metrics:[{label:'Dienst↔type relaties',value:fmt(data.serviceTypeLinks?.length||0)},{label:'Dienst↔functie links',value:fmt(data.serviceFunctionLinks?.length||0)},{label:'Planningactiviteiten',value:fmt(data.planning?.activities?.length||0)},{label:'Werkzaamheden',value:fmt(data.works?.length||0)}]});
}

export function answerQuestion(question,{data={},previousContext={},screenContext={},mode='all'}={}){
  const parsed=parseQuestion(question,{data,previousContext,screenContext,mode});
  if(parsed.dataset==='relations')return relationResult(parsed,data);
  if(parsed.dataset==='planning')return planningResult(parsed,data);
  if(parsed.dataset==='capacity')return capacityResult(parsed,data);
  if(parsed.dataset==='works')return worksResult(parsed,data);
  if(parsed.dataset==='uroutes')return urouteResult(parsed,data);
  if(parsed.dataset==='history')return historyResult(parsed,data);
  if(parsed.dataset==='eol')return eolResult(parsed,data);
  if(parsed.dataset==='faults')return faultResult(parsed,data);
  if(parsed.dataset==='assets')return assetResult(parsed,data);
  if(parsed.dataset==='roads')return roadResult(parsed,data);
  if(parsed.dataset==='services')return serviceResult(parsed,data);
  const faults=data.faults||[],assets=data.assets||[],services=data.services||[],sources=data.sources||[];
  if(/\b(bron|bronnen|databron|databronnen|welke data|geladen data)\b/.test(parsed.text)){
    return result('Dit zijn de domeinbronnen die de huidige BiDash-werkruimte aan de Context API meldt.',parsed.context,{title:'Beschikbare databronnen',metrics:[{label:'Geladen',value:fmt(sources.filter(x=>x.loaded).length)},{label:'Niet geladen',value:fmt(sources.filter(x=>!x.loaded).length)}],columns:[['id','Bron'],['statusLabel','Status'],['count','Records / items']],rows:sources.map(x=>({...x,statusLabel:x.loaded?'geladen':'niet geladen',count:fmt(x.count||0)}))});
  }
  return result(`De geladen BiDash-context bevat ${fmt(assets.length)} assets, ${fmt(faults.length)} open storingen, ${fmt(services.length)} diensten, ${fmt(data.planning?.activities?.length||0)} planningactiviteiten en ${fmt(data.works?.length||0)} werkzaamheden. Je kunt ook vragen naar verbanden tussen deze domeinen.`,parsed.context,{title:'BiDash-context',metrics:[{label:'Assets',value:fmt(assets.length)},{label:'Open storingen',value:fmt(faults.length)},{label:'Diensten',value:fmt(services.length)},{label:'Planning',value:fmt(data.planning?.activities?.length||0)},{label:'Werkzaamheden',value:fmt(data.works?.length||0)}]});
}

function buildTable(result){
  if(!result.columns?.length||!result.rows?.length)return '';
  const cols=result.columns;
  const body=result.rows.map(row=>'<tr>'+cols.map(([key])=>`<td>${escapeHtml(row?.[key]??'')}</td>`).join('')+'</tr>').join('');
  return `<div class="qa-table-scroll"><table><thead><tr>${cols.map(([,label])=>`<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function buildAssistantMessage(result){
  const metrics=result.metrics?.length?`<div class="qa-metrics">${result.metrics.map(m=>`<div><span>${escapeHtml(m.label)}</span><strong>${escapeHtml(m.value)}</strong></div>`).join('')}</div>`:'';
  const labels=result.labels?.length?`<div class="qa-context-tags">${result.labels.map(label=>`<span>${escapeHtml(label)}</span>`).join('')}</div>`:'';
  const note=result.note?`<p class="qa-note">${escapeHtml(result.note)}</p>`:'';
  return `<article class="qa-message qa-assistant-message"><div class="qa-avatar" aria-hidden="true">B</div><div class="qa-bubble"><strong>${escapeHtml(result.title||'Antwoord')}</strong><p>${escapeHtml(result.text)}</p>${metrics}${buildTable(result)}${note}${labels}</div></article>`;
}

function buildUserMessage(text){return `<article class="qa-message qa-user-message"><div class="qa-bubble"><p>${escapeHtml(text)}</p></div></article>`;}

export function installQueryAssistant({document:doc=globalThis.document,getData=()=>({}),getScreenContext=()=>({}),onApplyContext=()=>{},onOpenRoute=()=>{}}={}){
  if(!doc)return null;
  const dialog=doc.getElementById('queryAssistantDialog'),open=doc.getElementById('queryAssistantOpen'),close=doc.getElementById('queryAssistantClose'),clear=doc.getElementById('queryAssistantClear'),messages=doc.getElementById('queryAssistantMessages'),form=doc.getElementById('queryAssistantForm'),input=doc.getElementById('queryAssistantInput'),modeInputs=[...doc.querySelectorAll('[name="queryAssistantMode"]')],suggestions=doc.getElementById('queryAssistantSuggestions');
  if(!dialog||!open||!messages||!form||!input)return null;
  let previousContext={},lastResult=null;
  const mode=()=>modeInputs.find(el=>el.checked)?.value||'screen';
  const scroll=()=>{messages.scrollTop=messages.scrollHeight;};
  function renderSuggestions(items){suggestions.innerHTML=(items||[]).slice(0,4).map((item,index)=>`<button type="button" data-qa-suggestion="${index}">${escapeHtml(item)}</button>`).join('');suggestions.dataset.items=JSON.stringify((items||[]).slice(0,4));}
  function welcome(){messages.innerHTML='<article class="qa-message qa-assistant-message"><div class="qa-avatar" aria-hidden="true">B</div><div class="qa-bubble"><strong>Vraag BiDash</strong><p>Stel een vraag over storingen, dienstverlening, planning, werkzaamheden, U-routes, EOL of formatie. Ik gebruik geen AI: antwoorden komen uit vaste queryregels en de bestaande BiDash-context. Je kunt doorvragen en verbanden laten tonen.</p></div></article>';previousContext={};lastResult=null;renderSuggestions(['Welke storingen drukken op de dienstverlening?','Wat staat er gepland op de A15?','Waar zijn capaciteitstekorten?','Welke werkzaamheden vallen samen met storingen?']);}
  function ask(text){
    const question=String(text||'').trim();if(!question)return;
    messages.insertAdjacentHTML('beforeend',buildUserMessage(question));
    const currentMode=mode(),data=getData(currentMode)||{},screenContext=currentMode==='screen'?(getScreenContext()||{}):{};
    const answer=answerQuestion(question,{data,previousContext,screenContext,mode:currentMode});
    previousContext=answer.context||previousContext;lastResult=answer;
    messages.insertAdjacentHTML('beforeend',buildAssistantMessage(answer));
    renderSuggestions(answer.suggestions);input.value='';scroll();
  }
  open.addEventListener('click',()=>{if(!messages.children.length)welcome();dialog.showModal();setTimeout(()=>input.focus(),0);});
  close?.addEventListener('click',()=>dialog.close());
  clear?.addEventListener('click',welcome);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
  suggestions?.addEventListener('click',event=>{const b=event.target.closest('[data-qa-suggestion]');if(!b)return;let items=[];try{items=JSON.parse(suggestions.dataset.items||'[]');}catch{}ask(items[Number(b.dataset.qaSuggestion)]||b.textContent);});
  doc.getElementById('queryAssistantApply')?.addEventListener('click',()=>{if(lastResult?.context){dialog.close();onApplyContext(lastResult.context);}});
  doc.getElementById('queryAssistantOpenData')?.addEventListener('click',()=>{dialog.close();const d=lastResult?.context?.dataset;onOpenRoute(d==='roads'?'costs':d==='assets'?'assets':d==='planning'?'planning':d==='capacity'?'organisation':d==='services'||d==='relations'?'services':d==='works'||d==='uroutes'||d==='history'||d==='eol'?'data':'faults');});
  modeInputs.forEach(el=>el.addEventListener('change',()=>{previousContext={};renderSuggestions(mode()==='screen'?['Wat zie ik hier?','Hoeveel resultaten zijn er?','Welke foutcodes komen het meest voor?']:['Hoeveel open storingen zijn er?','Welke foutcodes komen het meest voor?','Wat is de huidige dienstverlening?']);}));
  welcome();
  return {ask,clear:welcome,open:()=>open.click(),get context(){return previousContext;}};
}
