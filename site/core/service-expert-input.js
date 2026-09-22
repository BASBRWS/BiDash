export const EXPERT_REVIEW_VERSION=1;

export const EXPERT_REQUIRED_FIELDS=[
  ['expert.naam','Naam van de expert'],
  ['expert.rol','Rol en verantwoordelijkheid'],
  ['expert.organisatie','Organisatieonderdeel'],
  ['context.doel','Doel van de dienstverlening'],
  ['context.resultaat','Gewenst resultaat voor weggebruiker en operatie'],
  ['context.gebruikers','Gebruikers en belanghebbenden'],
  ['context.scope','Afbakening en scope'],
  ['context.buitenScope','Wat buiten de scope valt'],
  ['proces.start','Startgebeurtenis'],
  ['proces.stappen','Processtappen in volgorde'],
  ['proces.beslismomenten','Beslismomenten en criteria'],
  ['proces.overdrachten','Overdrachten tussen rollen of systemen'],
  ['proces.einde','Eindtoestand'],
  ['afhankelijkheden.assets','Benodigde assets en systemen'],
  ['afhankelijkheden.informatie','Benodigde informatie'],
  ['afhankelijkheden.functies','Benodigde rollen en capaciteit'],
  ['afhankelijkheden.extern','Externe partijen en afspraken'],
  ['afhankelijkheden.bovenstrooms','Bovenstroomse processen'],
  ['afhankelijkheden.benedenstrooms','Benedenstroomse processen'],
  ['impact.faalwijzen','Belangrijkste faalwijzen'],
  ['impact.veiligheid','Gevolg voor veiligheid en doorstroming'],
  ['impact.informatie','Gevolg voor informatie en besluitvorming'],
  ['impact.alternatief','Alternatieve werkwijze of compensatie'],
  ['impact.herstel','Herstel en normalisatie'],
  ['impact.escalatie','Escalatiecriterium'],
  ['meting.normDuiding','Duiding van de dienstnorm'],
  ['meting.meetwijze','Meetwijze'],
  ['meting.meetvenster','Tijdvenster en gebied'],
  ['meting.bron','Bewijs- of gegevensbron'],
  ['meting.onzekerheid','Onzekerheid en ontbrekende dekking'],
  ['validatie.bewijs','Onderbouwing'],
  ['validatie.aannames','Aannames'],
  ['validatie.openVragen','Open vragen'],
  ['validatie.vertrouwen','Vertrouwensniveau']
];

const txt=value=>String(value??'').trim();
const section=(value,keys)=>Object.fromEntries(keys.map(key=>[key,txt(value?.[key])]));
const rowId=(prefix,index,value)=>txt(value?.id)||`${prefix}-${index+1}`;

export function createServiceExpertReview(service={},now=Date.now()){
  return {
    schema:EXPERT_REVIEW_VERSION,
    dienstId:txt(service.id),
    dienstNaam:txt(service.naam||service.id),
    status:'concept',
    expert:{naam:'',rol:'',organisatie:''},
    context:{doel:'',resultaat:'',gebruikers:'',scope:'',buitenScope:''},
    proces:{start:'',stappen:'',beslismomenten:'',overdrachten:'',einde:''},
    afhankelijkheden:{assets:'',informatie:'',functies:'',extern:'',bovenstrooms:'',benedenstrooms:''},
    impact:{faalwijzen:'',veiligheid:'',informatie:'',alternatief:'',herstel:'',escalatie:''},
    meting:{normDuiding:'',meetwijze:'',meetvenster:'',bron:'',onzekerheid:''},
    validatie:{bewijs:'',aannames:'',openVragen:'',vertrouwen:'',akkoordNaam:'',akkoordDatum:''},
    relaties:[],
    regelVoorstellen:[],
    signaalVoorstellen:[],
    bijgewerktOp:new Date(now).toISOString()
  };
}

export function normalizeServiceExpertReview(value={},service={},now=Date.now()){
  const base=createServiceExpertReview(service,now);
  const relaties=(Array.isArray(value.relaties)?value.relaties:[]).map((row,index)=>({
    id:rowId('relatie',index,row),
    bron:txt(row.bron),relatie:txt(row.relatie),doel:txt(row.doel),kritiek:txt(row.kritiek),
    duiding:txt(row.duiding),bewijs:txt(row.bewijs)
  }));
  const regelVoorstellen=(Array.isArray(value.regelVoorstellen)?value.regelVoorstellen:[]).map((row,index)=>({
    id:rowId('regel',index,row),
    als:txt(row.als),dan:txt(row.dan),maatstaf:txt(row.maatstaf),gewicht:txt(row.gewicht),
    uitzondering:txt(row.uitzondering),eigenaar:txt(row.eigenaar),bewijs:txt(row.bewijs)
  }));
  const signaalVoorstellen=(Array.isArray(value.signaalVoorstellen)?value.signaalVoorstellen:[]).map((row,index)=>({
    id:rowId('signaal',index,row),
    voorwaarde:txt(row.voorwaarde),ernst:txt(row.ernst),actie:txt(row.actie),eigenaar:txt(row.eigenaar),
    responstijd:txt(row.responstijd),escalatie:txt(row.escalatie)
  }));
  return {
    ...base,
    schema:EXPERT_REVIEW_VERSION,
    dienstId:txt(value.dienstId||service.id),
    dienstNaam:txt(value.dienstNaam||service.naam||service.id),
    status:['concept','ter_beoordeling','vastgesteld'].includes(value.status)?value.status:'concept',
    expert:section(value.expert,['naam','rol','organisatie']),
    context:section(value.context,['doel','resultaat','gebruikers','scope','buitenScope']),
    proces:section(value.proces,['start','stappen','beslismomenten','overdrachten','einde']),
    afhankelijkheden:section(value.afhankelijkheden,['assets','informatie','functies','extern','bovenstrooms','benedenstrooms']),
    impact:section(value.impact,['faalwijzen','veiligheid','informatie','alternatief','herstel','escalatie']),
    meting:section(value.meting,['normDuiding','meetwijze','meetvenster','bron','onzekerheid']),
    validatie:section(value.validatie,['bewijs','aannames','openVragen','vertrouwen','akkoordNaam','akkoordDatum']),
    relaties,regelVoorstellen,signaalVoorstellen,
    bijgewerktOp:txt(value.bijgewerktOp)||base.bijgewerktOp
  };
}

function pathValue(value,path){return path.split('.').reduce((current,key)=>current?.[key],value);}

export function expertReviewCompletion(value){
  const review=normalizeServiceExpertReview(value,{id:value?.dienstId,naam:value?.dienstNaam});
  const ingevuld=EXPERT_REQUIRED_FIELDS.filter(([path])=>txt(pathValue(review,path))).length;
  const totaal=EXPERT_REQUIRED_FIELDS.length;
  return {ingevuld,totaal,percentage:Math.round(ingevuld/totaal*100),ontbrekend:EXPERT_REQUIRED_FIELDS.filter(([path])=>!txt(pathValue(review,path))).map(([,label])=>label)};
}

export function validateServiceExpertReview(value,{voorStatus=true}={}){
  const review=normalizeServiceExpertReview(value,{id:value?.dienstId,naam:value?.dienstNaam});
  const fouten=[];
  if(!review.dienstId)fouten.push('Kies een dienstverlening.');
  if(voorStatus&&review.status!=='concept'){
    fouten.push(...expertReviewCompletion(review).ontbrekend.map(label=>`${label} ontbreekt.`));
    const completeRegel=row=>row.als&&row.dan&&row.maatstaf&&row.eigenaar&&row.bewijs;
    const completeSignaal=row=>row.voorwaarde&&row.ernst&&row.actie&&row.eigenaar&&row.responstijd&&row.escalatie;
    const completeRelatie=row=>row.bron&&row.relatie&&row.doel&&row.kritiek&&row.duiding&&row.bewijs;
    if(!review.regelVoorstellen.some(completeRegel))fouten.push('Leg minstens één compleet regelvoorstel vast.');
    if(!review.signaalVoorstellen.some(completeSignaal))fouten.push('Leg minstens één compleet signaalvoorstel vast.');
    review.relaties.forEach((row,index)=>{if(Object.values(row).some(txt)&&!completeRelatie(row))fouten.push(`Relatie ${index+1} is niet compleet.`);});
    review.regelVoorstellen.forEach((row,index)=>{if(Object.values(row).some(txt)&&!completeRegel(row))fouten.push(`Regelvoorstel ${index+1} is niet compleet.`);});
    review.signaalVoorstellen.forEach((row,index)=>{if(Object.values(row).some(txt)&&!completeSignaal(row))fouten.push(`Signaalvoorstel ${index+1} is niet compleet.`);});
  }
  if(voorStatus&&review.status==='vastgesteld'){
    if(!review.validatie.akkoordNaam)fouten.push('Naam van de akkoordgever ontbreekt.');
    if(!review.validatie.akkoordDatum)fouten.push('Datum van akkoord ontbreekt.');
  }
  return fouten;
}

export function upsertServiceExpertReview(reviews,value){
  const review=normalizeServiceExpertReview(value,{id:value?.dienstId,naam:value?.dienstNaam});
  return [...(Array.isArray(reviews)?reviews:[]).filter(item=>String(item?.dienstId)!==review.dienstId),review];
}
