export const EXPERT_REVIEW_VERSION=2;

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
    modelWijziging:{norm:'',subprocessen:[],test:null,toepassing:null},
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
  const subprocessen=(Array.isArray(value.modelWijziging?.subprocessen)?value.modelWijziging.subprocessen:[]).map((row,index)=>({
    id:rowId('subproces',index,row),naam:txt(row.naam),aandeel:txt(row.aandeel),
    afhankelijkheden:Object.fromEntries(Object.entries(row.afhankelijkheden||{}).map(([key,gewicht])=>[txt(key),txt(gewicht)]).filter(([key])=>key)),
    onderbouwing:txt(row.onderbouwing)
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
    modelWijziging:{
      norm:txt(value.modelWijziging?.norm),subprocessen,
      test:value.modelWijziging?.test&&typeof value.modelWijziging.test==='object'?structuredClone(value.modelWijziging.test):null,
      toepassing:value.modelWijziging?.toepassing&&typeof value.modelWijziging.toepassing==='object'?structuredClone(value.modelWijziging.toepassing):null
    },
    relaties,regelVoorstellen,signaalVoorstellen,
    bijgewerktOp:txt(value.bijgewerktOp)||base.bijgewerktOp
  };
}

export function modelProposalFromService(service={}){
  const typeNaarObject={MSI:'signalering',CAM:'camera',LUS:'detectie',DRIP:'drip',WISSELBORD:'wisselbord'};
  return {
    dienstId:txt(service.id),norm:service.norm==null?'':txt(service.norm),
    subprocessen:(service.subprocessen||[]).map((sp,index)=>({
      id:rowId('subproces',index,sp),naam:txt(sp.naam),aandeel:txt(Math.round(Number(sp.aandeelDienst??sp.gewicht??0)*100000)/1000),
      afhankelijkheden:Object.fromEntries((sp.bronnen||[]).map(bron=>[
        txt(bron.obj)||typeNaarObject[txt(bron.typeId||bron.tp).toUpperCase()]||txt(bron.typeId||bron.tp).toLowerCase(),
        txt(Math.round(Number(bron.gewicht??bron.w??0)*100000)/1000)
      ]).filter(([key])=>key)),
      onderbouwing:txt(sp.onderbouwing||sp.tekst)
    }))
  };
}

export function expertModelProposal(value,currentService={}){
  const review=normalizeServiceExpertReview(value,{id:value?.dienstId,naam:value?.dienstNaam});
  const fallback=modelProposalFromService(currentService);
  const rows=review.modelWijziging.subprocessen.length?review.modelWijziging.subprocessen:fallback.subprocessen;
  return {
    dienstId:review.dienstId,
    norm:Number(review.modelWijziging.norm===''?fallback.norm:review.modelWijziging.norm),
    subprocessen:rows.map(row=>({
      id:txt(row.id),naam:txt(row.naam),gewicht:Number(row.aandeel)/100,
      afh:Object.fromEntries(Object.entries(row.afhankelijkheden||{}).map(([key,gewicht])=>[txt(key),Number(gewicht)/100]).filter(([key,gewicht])=>key&&Number.isFinite(gewicht)&&gewicht>0)),
      tekst:txt(row.onderbouwing)
    }))
  };
}

export function validateExpertModelProposal(proposal={}){
  const fouten=[];
  if(!txt(proposal.dienstId))fouten.push('Kies een dienstverlening.');
  if(!Number.isFinite(Number(proposal.norm))||Number(proposal.norm)<0||Number(proposal.norm)>100)fouten.push('De voorgestelde dienstnorm moet tussen 0 en 100 procent liggen.');
  const rows=Array.isArray(proposal.subprocessen)?proposal.subprocessen:[];
  if(!rows.length)fouten.push('Leg minstens één subproces vast.');
  const namen=new Set();
  rows.forEach((row,index)=>{
    const nr=index+1,naam=txt(row.naam),gewicht=Number(row.gewicht),afh=Object.entries(row.afh||{}).filter(([,value])=>Number(value)>0);
    if(!naam)fouten.push(`Subproces ${nr} heeft geen naam.`);
    else if(namen.has(naam.toLowerCase()))fouten.push(`Subproces ${nr} heeft een dubbele naam.`);
    else namen.add(naam.toLowerCase());
    if(!Number.isFinite(gewicht)||gewicht<0)fouten.push(`Subproces ${nr} heeft geen geldig aandeel.`);
    if(!afh.length)fouten.push(`Subproces ${nr} heeft geen afhankelijkheid.`);
    const somAfh=afh.reduce((sum,[,value])=>sum+Number(value),0);
    if(afh.length&&Math.abs(somAfh-1)>0.0005)fouten.push(`De afhankelijkheden van subproces ${nr} moeten samen 100 procent zijn.`);
  });
  const som=rows.reduce((sum,row)=>sum+(Number(row.gewicht)||0),0);
  if(rows.length&&Math.abs(som-1)>0.0005)fouten.push('De aandelen van de subprocessen moeten samen 100 procent zijn.');
  return fouten;
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
