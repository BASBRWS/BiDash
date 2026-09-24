export const EXPERT_REVIEW_VERSION=3;

const options=(...labels)=>labels.map(label=>[label,label]);
export const EXPERT_GUIDED_SECTIONS=[
  {id:'doel',titel:'Doel en bereik',uitleg:'Deze antwoorden bepalen hoe BiDash de expertduiding beschrijft. Ze veranderen nog geen berekening.',vragen:[
    {path:'context.doel',name:'contextDoel',label:'Wat is het belangrijkste doel?',uitleg:'Hiermee wordt duidelijk welk dienstresultaat centraal staat. Het antwoord komt in de procescontext en niet rechtstreeks in de formule.',opties:options('Veiligheid bewaken','Doorstroming herstellen','Weggebruiker informeren','Operationele uitvoering ondersteunen','Combinatie van deze doelen','Onbekend')},
    {path:'context.resultaat',name:'contextResultaat',label:'Welk resultaat moet zichtbaar zijn?',uitleg:'Dit helpt later controleren of het model een technisch middel of het echte dienstresultaat meet.',opties:options('Veilige situatie','Verkeer kan doorrijden','Maatregel correct uitgevoerd','Juiste informatie beschikbaar','Incident of verstoring afgehandeld','Combinatie van deze resultaten','Onbekend')},
    {path:'context.gebruikers',name:'contextGebruikers',label:'Voor wie is deze dienstverlening vooral bedoeld?',uitleg:'BiDash gebruikt dit om de uitkomst begrijpelijk te beschrijven en om ontbrekende belanghebbenden te signaleren.',opties:options('Weggebruiker','Wegverkeersleider','Weginspecteur','Hulpdienst','Ketenpartner','Meerdere groepen','Onbekend')},
    {path:'context.scope',name:'contextScope',label:'Op welk niveau geldt de dienstverlening?',uitleg:'Dit voorkomt dat een lokale duiding stilzwijgend als landelijke regel wordt toegepast.',opties:options('Landelijk','Regio of verkeerscentrale','Corridor of weg','Locatie of asset','Wisselt per situatie','Onbekend')}
  ]},
  {id:'proces',titel:'Hoe werkt het proces?',uitleg:'Deze vragen leggen de eenvoudige proceslijn vast. Alleen afwijkingen hoef je bij Extra uitleg toe te lichten.',vragen:[
    {path:'proces.start',name:'procesStart',label:'Wat start het proces meestal?',uitleg:'Het startmoment helpt bepalen wanneer afhankelijkheden en signalen relevant worden.',opties:options('Automatische melding','Melding door een persoon','Waarneming vanuit de verkeerscentrale','Geplande activiteit','Besluit of opdracht','Meerdere soorten startmomenten','Onbekend')},
    {path:'proces.stappen',name:'procesStappen',label:'Zijn de getoonde subprocessen compleet?',uitleg:'Bij Nee hoort de expert een subproces toe te voegen. Dit antwoord verandert zelf nog niets aan de procesketen.',opties:options('Ja, de lijst is compleet','Nee, er ontbreekt één subproces','Nee, er ontbreken meerdere subprocessen','Onbekend')},
    {path:'proces.beslismomenten',name:'procesBeslismomenten',label:'Hoe wordt het vervolg bepaald?',uitleg:'Dit maakt zichtbaar of een vaste regel volstaat of dat menselijke beoordeling nodig blijft.',opties:options('Met een vaste beslisregel','Door beoordeling van een medewerker','Door een combinatie van regel en beoordeling','Er is geen beslismoment','Onbekend')},
    {path:'proces.overdrachten',name:'procesOverdrachten',label:'Zijn overdrachten nodig?',uitleg:'Overdrachten kunnen een extra afhankelijkheid of signaal vereisen. Het antwoord wordt als procescontext opgeslagen.',opties:options('Geen overdracht','Overdracht binnen RWS','Overdracht naar een externe partij','Zowel intern als extern','Onbekend')},
    {path:'proces.einde',name:'procesEinde',label:'Wanneer is het proces klaar?',uitleg:'De eindtoestand helpt later beoordelen of een signaal echt is afgehandeld.',opties:options('Situatie is weer veilig','Verkeer stroomt weer normaal','Maatregel is beëindigd en vastgelegd','Informatie is bijgewerkt','Werk is overgedragen aan een andere partij','Wisselt per situatie','Onbekend')}
  ]},
  {id:'uitval',titel:'Uitval en herstel',uitleg:'Deze antwoorden helpen de gevolgen van een subproces te duiden. Ze worden niet automatisch een impactpercentage.',vragen:[
    {path:'impact.faalwijzen',name:'impactFaalwijzen',label:'Waardoor kan de dienstverlening vooral tekortschieten?',uitleg:'BiDash gebruikt dit om ontbrekende relaties en bronnen te signaleren. Het antwoord wijzigt geen foutregel.',opties:options('Techniek of asset valt uit','Informatie ontbreekt of is onbetrouwbaar','Menselijke capaciteit ontbreekt','Externe partij levert niet','Meerdere oorzaken','Onbekend')},
    {path:'impact.veiligheid',name:'impactVeiligheid',label:'Wat is meestal het gevolg?',uitleg:'Dit antwoord geeft een kwalitatieve duiding. Een percentage ontstaat pas uit de actieve DVM-regels en subprocessaandelen.',opties:options('Geen merkbaar effect','Dienst wordt trager','Kwaliteit wordt lager','Dienst is deels niet beschikbaar','Dienst is volledig niet beschikbaar','Wisselt per situatie','Onbekend')},
    {path:'impact.alternatief',name:'impactAlternatief',label:'Is er een alternatieve werkwijze?',uitleg:'Een alternatief kan de praktische impact beperken. BiDash past zonder apart regelvoorstel geen compensatiefactor toe.',opties:options('Ja, volledig gelijkwaardig','Ja, maar met beperkingen','Nee','Wisselt per situatie','Onbekend')},
    {path:'impact.herstel',name:'impactHerstel',label:'Hoe wordt de dienst hersteld?',uitleg:'Dit helpt bepalen welke rol of partij bij herstel en signalering hoort.',opties:options('Automatisch','Door handmatige actie','Door een externe partij','Door een combinatie','Onbekend')},
    {path:'impact.escalatie',name:'impactEscalatie',label:'Wanneer moet worden opgeschaald?',uitleg:'Het antwoord kan later worden gebruikt voor een signaalvoorstel. Er wordt niet direct een actief signaal aangemaakt.',opties:options('Direct bij uitval','Na een vaste tijd','Vanaf een bepaalde impact','Bij een combinatie van tijd en impact','Per situatie beoordeeld','Niet nodig','Onbekend')}
  ]},
  {id:'meting',titel:'Norm en bewijs',uitleg:'Deze vragen tonen of de dienstnorm en de beschikbare data voldoende zijn om de uitkomst te gebruiken.',vragen:[
    {path:'meting.normDuiding',name:'metingNormDuiding',label:'Past de huidige dienstnorm bij de praktijk?',uitleg:'Bij Deels of Nee blijft de norm ongewijzigd totdat een vastgesteld modelvoorstel wordt toegepast.',opties:options('Ja','Deels','Nee','Onbekend')},
    {path:'meting.meetwijze',name:'metingMeetwijze',label:'Wat moet vooral worden gemeten?',uitleg:'Dit legt vast welk type prestatie de expert bedoelt. De huidige DVM-berekening blijft eigenaar van het berekende percentage.',opties:options('Beschikbaarheid','Reactietijd','Tijdige afronding','Kwaliteit van het resultaat','Combinatie van metingen','Onbekend')},
    {path:'meting.meetvenster',name:'metingMeetvenster',label:'Over welke periode hoort de prestatie te worden beoordeeld?',uitleg:'Dit voorkomt dat een momentopname en een periodeprestatie door elkaar worden gebruikt.',opties:options('Actueel moment','Per dag','Per week','Per maand','Per kwartaal','Wisselt per situatie','Onbekend')},
    {path:'meting.bron',name:'metingBron',label:'Waarop is deze duiding vooral gebaseerd?',uitleg:'BiDash gebruikt dit voor herkomst en audit. Expertkennis blijft herkenbaar als expertkennis.',opties:options('Systeemmeting','Procesregistratie','Werkinstructie of normdocument','Incidentanalyse of evaluatie','Expertkennis','Combinatie van bronnen','Geen vastgelegde bron','Onbekend')},
    {path:'meting.onzekerheid',name:'metingOnzekerheid',label:'Hoe compleet is de beschikbare informatie?',uitleg:'Dit antwoord maakt onzekerheid zichtbaar. Het verandert de bestaande DVM-brondekkingsberekening niet.',opties:options('Voldoende compleet','Deels compleet','Onvoldoende compleet','Onbekend')}
  ]}
];

export const EXPERT_REQUIRED_FIELDS=[
  ['expert.naam','Naam van de expert'],
  ['expert.rol','Rol en verantwoordelijkheid'],
  ['expert.organisatie','Organisatieonderdeel'],
  ...EXPERT_GUIDED_SECTIONS.flatMap(section=>section.vragen.map(question=>[question.path,question.label])),
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
    toelichtingen:{},
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
    toelichtingen:Object.fromEntries(Object.entries(value.toelichtingen||{}).map(([path,toelichting])=>[txt(path),txt(toelichting)]).filter(([path,toelichting])=>path&&toelichting)),
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

export function rebalanceExpertShares(values=[],changedIndex=-1,changedValue=null){
  const current=values.map(value=>Math.max(0,Number(value)||0));
  if(!current.length)return [];
  if(current.length===1)return [100];
  if(changedIndex>=0&&changedIndex<current.length)current[changedIndex]=Math.min(100,Math.max(0,Number(changedValue)||0));
  const fixed=changedIndex>=0&&changedIndex<current.length?current[changedIndex]:null;
  const indices=current.map((_,index)=>index).filter(index=>index!==changedIndex);
  const doel=fixed==null?100:100-fixed;
  const basis=indices.reduce((sum,index)=>sum+current[index],0);
  const result=current.slice();
  if(fixed==null){
    const totaal=current.reduce((sum,value)=>sum+value,0);
    if(totaal>0)for(const index of indices)result[index]=current[index]/totaal*100;
    else result.fill(100/current.length);
  }else if(basis>0){
    for(const index of indices)result[index]=current[index]/basis*doel;
  }else{
    for(const index of indices)result[index]=doel/indices.length;
  }
  const rounded=result.map(value=>Math.round(value*100)/100);
  const correction=Math.round((100-rounded.reduce((sum,value)=>sum+value,0))*100)/100;
  const correctionIndex=indices.at(-1)??changedIndex??0;
  rounded[correctionIndex]=Math.round((rounded[correctionIndex]+correction)*100)/100;
  return rounded;
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
    fouten.push(...validateExpertModelProposal(expertModelProposal(review)));
    const completeRegel=row=>row.als&&row.dan&&row.maatstaf&&row.eigenaar&&row.bewijs;
    const completeSignaal=row=>row.voorwaarde&&row.ernst&&row.actie&&row.eigenaar&&row.responstijd&&row.escalatie;
    const completeRelatie=row=>row.bron&&row.relatie&&row.doel&&row.kritiek&&row.duiding&&row.bewijs;
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
