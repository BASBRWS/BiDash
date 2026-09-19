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
  const planning=/\b(planning|planningactiviteit|planningactiviteiten|activiteit|activiteiten|mijlpaal|mijlpalen|projectplanning)\b/.test(text);
  const work=/\b(werkzaamheid|werkzaamheden|werkvak|werkvakken|afsluiting|hinder)\b/.test(text);
  const capacity=/\b(formatie|capaciteit|fte|bezetting|personeel|capaciteitstekort|capaciteitsoverschrijding)\b/.test(text);
  const relation=/\b(verband|samenhang|oorzaak|verklaar|waarom|raakt|raken|beinvloed|beinvloeden|drukt|effect op)\b/.test(text);
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
  if(service&&/\b(waarom|oorzaak|storing|storingen|impact|drukt|beinvloed|verband|samenhang)\b/.test(text))finalDataset='relations';
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
  rows.sort((a,b)=>(Number(a.besch??a.lo)||Infinity)-(Number(b.besch??b.lo)||Infinity));
  if(/onder de norm/.test(parsed.text))rows=rows.filter(r=>Number.isFinite(Number(r.besch))&&Number.isFinite(Number(r.norm))&&Number(r.besch)<Number(r.norm));
  const under=rows.filter(r=>Number.isFinite(Number(r.besch))&&Number.isFinite(Number(r.norm))&&Number(r.besch)<Number(r.norm));
  return result(rows.length?`${rows.length===1?'De geselecteerde dienst heeft':'Er zijn '+fmt(rows.length)+' diensten met'} actuele dienstverleningsinformatie. ${under.length?fmt(under.length)+' dienst(en) zitten onder de ingestelde norm.':'Geen doorgerekende dienst zit in deze selectie onder de norm.'}`:'Ik vind geen dienstverlening voor deze selectie.',parsed.context,{title:'Dienstverlening',metrics:[{label:'Diensten',value:fmt(rows.length)},{label:'Onder norm',value:fmt(under.length)}],columns:[['naam','Dienst'],['beschikbaar','Beschikbaarheid'],['normLabel','Norm']],rows:rows.slice(0,20).map(r=>({...r,beschikbaar:r.besch==null?`${fmt(r.lo,2)}–${fmt(r.hi,2)}%`:`${fmt(r.besch,2)}%`,normLabel:`${fmt(r.norm,2)}%`}))});
}

export function answerQuestion(question,{data={},previousContext={},screenContext={},mode='all'}={}){
  const parsed=parseQuestion(question,{data,previousContext,screenContext,mode});
  if(parsed.dataset==='faults')return faultResult(parsed,data);
  if(parsed.dataset==='assets')return assetResult(parsed,data);
  if(parsed.dataset==='roads')return roadResult(parsed,data);
  if(parsed.dataset==='services')return serviceResult(parsed,data);
  const faults=data.faults||[],assets=data.assets||[],services=data.services||[];
  return result(`De geladen BiDash-context bevat ${fmt(assets.length)} assets, ${fmt(faults.length)} open storingen en ${fmt(services.length)} diensten. Stel een vervolgvraag over storingen, assets, foutcodes, dienstverlening of verkeerskosten.`,parsed.context,{title:'BiDash-context',metrics:[{label:'Assets',value:fmt(assets.length)},{label:'Open storingen',value:fmt(faults.length)},{label:'Diensten',value:fmt(services.length)}]});
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
  function welcome(){messages.innerHTML='<article class="qa-message qa-assistant-message"><div class="qa-avatar" aria-hidden="true">B</div><div class="qa-bubble"><strong>Vraag BiDash</strong><p>Stel een vraag over de geladen gegevens. Ik gebruik geen AI: antwoorden komen uit vaste queryregels en de bestaande BiDash-data. Je kunt doorvragen op dezelfde selectie.</p></div></article>';previousContext={};lastResult=null;renderSuggestions(['Hoeveel open storingen zijn er?','Welke foutcodes komen het meest voor?','Wat is de huidige dienstverlening?','Wat zijn de verkeerskosten?']);}
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
  doc.getElementById('queryAssistantOpenData')?.addEventListener('click',()=>{dialog.close();onOpenRoute(lastResult?.context?.dataset==='roads'?'costs':lastResult?.context?.dataset==='assets'?'assets':lastResult?.context?.dataset==='services'?'services':'faults');});
  modeInputs.forEach(el=>el.addEventListener('change',()=>{previousContext={};renderSuggestions(mode()==='screen'?['Wat zie ik hier?','Hoeveel resultaten zijn er?','Welke foutcodes komen het meest voor?']:['Hoeveel open storingen zijn er?','Welke foutcodes komen het meest voor?','Wat is de huidige dienstverlening?']);}));
  welcome();
  return {ask,clear:welcome,open:()=>open.click(),get context(){return previousContext;}};
}
