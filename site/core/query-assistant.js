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
