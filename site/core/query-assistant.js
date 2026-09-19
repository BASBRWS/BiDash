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
  if(/\b(kosten|verkeerskosten|vvu|voertuigverlies|voertuigverliesuren|wegdeel|wegdelen)\b/.test(text))return 'roads';
  if(/\b(dienstverlening|dienst|diensten|beschikbaarheid|subproces|subprocessen)\b/.test(text))return 'services';
  if(/\b(asset|assets|areaal|register)\b/.test(text)&&!/storing|storingen|melding|meldingen|foutcode|foutcodes/.test(text))return 'assets';
  if(/\b(storing|storingen|melding|meldingen|foutcode|foutcodes|impact|msi|drip|drips|detectie|detectielus|detectielussen|lus|lussen|camera|cameras)\b/.test(text))return 'faults';
  return null;
}

function inferDataset(text,previous={},screen={}){return explicitDataset(text)||previous.dataset||screen.dataset||'overview';}

function inferIntent(text,dataset){
  if(/\b(meest voorkomende|vaakst|top\s*\d*\s*fout|welke foutcodes|foutcodes komen)\b/.test(text))return 'groupCodes';
  if(/\b(meeste impact|hoogste impact|grootste impact)\b/.test(text))return 'topImpact';
  if(/\b(hoeveel|hoe veel|aantal)\b/.test(text))return 'count';
  if(/\b(vergelijk|verschil tussen)\b/.test(text))return 'compare';
  if(/\b(toon|laat zien|welke|lijst|overzicht)\b/.test(text))return 'list';
  if(dataset==='services'&&/\b(hoe|wat|beschikbaarheid|dienstverlening)\b/.test(text))return 'list';
  if(dataset==='roads'&&/\b(kosten|vvu|voertuigverlies)\b/.test(text))return 'sum';
  return 'summary';
}

function cleanContext(previous={}){
  return {
    dataset:previous.dataset||null,
    filters:{...(previous.filters||{})},
    serviceId:previous.serviceId||null
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
  const service=detectService(text,data);
  const context={dataset,filters,serviceId:service?.id||base.serviceId||null};
  return {raw,text,dataset,intent:inferIntent(text,dataset),context,follow};
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
  return out;
}

function suggestionsFor(context){
  if(context.dataset==='faults')return ['Welke foutcodes komen het meest voor?','Welke hebben de hoogste impact?','Toon deze storingen'];
  if(context.dataset==='assets')return ['Hoeveel hebben een open storing?','Toon de assets','En alleen MSI?'];
  if(context.dataset==='roads')return ['Wat zijn de kosten?','Welke wegdelen hebben de hoogste kosten?','En alleen in deze VC?'];
  if(context.dataset==='services')return ['Welke dienst zit onder de norm?','Toon alle diensten','Wat is de huidige beschikbaarheid?'];
  return ['Hoeveel open storingen zijn er?','Welke foutcodes komen het meest voor?','Wat is de huidige dienstverlening?'];
}

function result(text,context,extra={}){return {text,context,labels:contextLabels(context),suggestions:suggestionsFor(context),...extra};}

function faultResult(parsed,data){
