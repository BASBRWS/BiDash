/* De geladen P6-XML is het sjabloon. Geen nieuwe projectvelden of objecten:
   namespace, schema, veldvolgorde en niet-bewerkte brongegevens blijven staan. */
const SCHEDULE_DATES=new Set([
  'StartDate','FinishDate','PlannedStartDate','PlannedFinishDate',
  'EarlyStartDate','EarlyFinishDate','LateStartDate','LateFinishDate',
  'RemainingEarlyStartDate','RemainingEarlyFinishDate',
  'RemainingLateStartDate','RemainingLateFinishDate','ExpectedFinishDate'
]);
const XSI='http://www.w3.org/2001/XMLSchema-instance';
const children=el=>Array.from(el.childNodes).filter(node=>node.nodeType===1&&node.namespaceURI===el.namespaceURI);
const field=(el,name)=>children(el).find(node=>node.localName===name);
const value=(el,name)=>field(el,name)?.textContent.trim()||'';

export function addPrimaveraMonths(iso,months){
  if(!Number.isInteger(months))throw Error('Een planningsverschuiving moet uit hele kalendermaanden bestaan.');
  const match=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if(!match)throw Error('Ongeldige datum in de Primavera-bron.');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const leap=y=>y%4===0&&(y%100!==0||y%400===0);
  const days=(y,m)=>[31,leap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
  if(month<1||month>12||day<1||day>days(year,month))throw Error('Ongeldige kalenderdatum in de Primavera-bron.');
  if(match[4]&&(!Number.isFinite(Date.parse(iso))||/T(?:24|[3-9]\d):/.test(iso)))throw Error('Ongeldig tijdstip in de Primavera-bron.');
  const total=year*12+month-1+months,targetYear=Math.floor(total/12),targetMonth=total-targetYear*12+1;
  if(targetYear<1||targetYear>9999)throw Error('De verschoven datum valt buiten het Primavera-datumbereik.');
  return String(targetYear).padStart(4,'0')+'-'+String(targetMonth).padStart(2,'0')+'-'+String(Math.min(day,days(targetYear,targetMonth))).padStart(2,'0')+(match[4]||'');
}

export function primaveraExportFilename(filename,date=new Date()){
  const base=String(filename||'planning.xml').replace(/\.xml$/i,'').replace(/[\\/\x00-\x1f]/g,'_');
  return base+'-scenario-'+date.toISOString().slice(0,10)+'.xml';
}

export function createPrimaveraExport({xml,filename,regels=[],cascade={},Parser=globalThis.DOMParser,Serializer=globalThis.XMLSerializer}){
  if(!xml||!regels.length)throw Error('Laad eerst een Primavera P6-planning.');
  const doc=new Parser().parseFromString(xml,'application/xml');
  const root=doc.documentElement;
  if(doc.getElementsByTagNameNS('*','parsererror').length)throw Error('De planning bevat ongeldige XML.');
  if(root?.localName!=='APIBusinessObjects'||(root.namespaceURI&&!/^http:\/\/xmlns\.oracle\.com\/Primavera\/P6\/[^/]+\/API\/BusinessObjects$/.test(root.namespaceURI))){
    throw Error('Deze export vereist een geladen Primavera P6-XML. Voor MS Project kun je de oorspronkelijke planning-XML exporteren.');
  }
  const projects=children(root).filter(node=>node.localName==='Project'&&children(node).some(child=>child.localName==='Activity'));
  const project=projects.at(-1);
  if(!project)throw Error('Geen Primavera-project met activiteiten gevonden.');
  const activities=children(project).filter(node=>node.localName==='Activity');
  const byId=new Map();
  for(const activity of activities){
    const id=value(activity,'ObjectId');
    if(!id||byId.has(id))throw Error('Ontbrekende of dubbele activiteit-ID in de Primavera-bron.');
    byId.set(id,activity);
  }
  const shifts=new Map();
  for(const regel of regels){
    const id=String(regel.id),shift=Number(cascade[id]??0)*12,months=Math.round(shift);
    if(!Number.isFinite(shift)||Math.abs(shift-months)>1e-7)throw Error('Ongeldige scenarioverschuiving.');
    if(!byId.has(id))throw Error('De planning en oorspronkelijke XML hebben verschillende activiteit-ID’s. Laad de planning opnieuw.');
    if(shifts.has(id))throw Error('Dubbele activiteit-ID in het planningmodel.');
    shifts.set(id,months);
  }
  let changedActivities=0,changedDates=0;
  function shiftDates(el,months){
    let count=0;
    for(const node of children(el)){
      if(!SCHEDULE_DATES.has(node.localName)||node.getAttributeNS(XSI,'nil')==='true'||node.getAttributeNS(XSI,'nil')==='1')continue;
      const original=node.textContent.trim();
      if(!original)continue;
      node.textContent=addPrimaveraMonths(original,months);
      count++;
    }
    return count;
  }
  for(const [id,months] of shifts){
    if(!months)continue;
    const activity=byId.get(id);
    if(!value(activity,'StartDate')&&!value(activity,'PlannedStartDate'))throw Error('Een verschoven activiteit mist een begindatum in de bron.');
    if(!value(activity,'FinishDate')&&!value(activity,'PlannedFinishDate'))throw Error('Een verschoven activiteit mist een einddatum in de bron.');
    changedDates+=shiftDates(activity,months);
    changedActivities++;
  }
  // Een eventuele P6-resourcetoewijzing volgt haar activiteit, met behoud van
  // werkelijk geboekte uren, kosten, actuals en oorspronkelijke objectrelaties.
  for(const assignment of children(project).filter(node=>node.localName==='ResourceAssignment')){
    const months=shifts.get(value(assignment,'ActivityObjectId'));
    if(months)changedDates+=shiftDates(assignment,months);
  }
  let text=changedActivities?new Serializer().serializeToString(doc):xml;
  if(!/^\s*<\?xml\b/.test(text))text='<?xml version="1.0" encoding="UTF-8"?>\n'+text;
  // Het gedownloade bestand is UTF-8, ook bij een anders gedeclareerde bron.
  text=text.replace(/(<\?xml\b[^?]*encoding\s*=\s*["'])[^"']+(["'])/i,'$1UTF-8$2');
  return {text,name:primaveraExportFilename(filename),type:'application/xml',changedActivities,changedDates};
}
