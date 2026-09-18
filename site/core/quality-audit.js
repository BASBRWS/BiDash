export const QUALITY_AUDIT_VERSION=2;

export const QUALITY_CATEGORIES={
  sources:{label:'Bronnen',weight:25,description:'Aanwezigheid, actualiteit en scope van de geladen gegevens.'},
  integrity:{label:'Datakwaliteit',weight:25,description:'Uniciteit, volledigheid en bruikbaarheid van assets en meldingen.'},
  linkage:{label:'Koppelingen',weight:20,description:'Koppeling van storingen, assets, diensten en bedrijfsfuncties.'},
  calculation:{label:'Doorrekening',weight:20,description:'Rekenregels, niet-doorgerekende meldingen en betrouwbaarheid van uitkomsten.'},
  continuity:{label:'Beheerbaarheid',weight:10,description:'Back-up, herleidbaarheid en reproduceerbaarheid van de werkruimte.'}
};

const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v:[];
const pct=(n,total)=>total?Math.round(n/total*1000)/10:0;

function rowsIn(part){
  if(!part)return 0;
  if(Array.isArray(part)){
    if(part.some(x=>x&&typeof x==='object'&&(Array.isArray(x.rijen)||Array.isArray(x.incidenten)))){
      return part.reduce((sum,x)=>sum+rowsIn(x),0);
    }
    return part.length;
  }
  if(typeof part!=='object')return 0;
  if(Array.isArray(part.rijen))return part.rijen.length;
  if(Array.isArray(part.incidenten))return part.incidenten.length;
  if(Array.isArray(part.sources))return part.sources.reduce((sum,x)=>sum+rowsIn(x),0);
  return 0;
}

function sourceDates(part,out=[]){
  if(!part)return out;
  if(Array.isArray(part)){for(const x of part)sourceDates(x,out);return out;}
  if(typeof part!=='object')return out;
  for(const key of ['peildatum','bronPeildatum','opgeslagen'])if(part[key]!=null)out.push(part[key]);
  if(Array.isArray(part.sources))for(const x of part.sources)sourceDates(x,out);
  return out;
}

function timeValue(value){
  if(value==null||value==='')return null;
  const n=Number(value);
  const d=new Date(Number.isFinite(n)?n:value);
  return Number.isFinite(d.getTime())?d.getTime():null;
}

function newestDate(part){
  const values=sourceDates(part).map(timeValue).filter(Number.isFinite);
  return values.length?Math.max(...values):null;
}

function duplicateCount(values){
  const seen=new Set();let duplicates=0;
  for(const raw of values){const value=text(raw);if(!value)continue;if(seen.has(value))duplicates++;else seen.add(value);}
  return duplicates;
}

/* Twee meldingen zijn pas een bronduplicaat als ze op meer dan alleen locatie en
   foutcode overeenkomen. We nemen ook het event-ID en het bronbestand mee: dezelfde
   foutcode op dezelfde plek uit twee verschillende bronbestanden, of met een eigen
   event-ID, is een aparte melding en geen duplicaat. Ontbreekt het event-ID, dan
   valt de vergelijking terug op assetcode, starttijd, foutcode en locatie. */
function duplicateGroups(items,keyOf){
  const groups=new Map();
  for(const item of items){const key=text(keyOf(item));if(!key)continue;const group=groups.get(key)||[];group.push(item);groups.set(key,group);}
  return [...groups.values()].filter(group=>group.length>1);
}

function faultEvidence(f){
  return {
    id:text(f.id||f.eventId),naam:text(f.naam||f.assetNaam||f.osid||f.asset),type:text(f.typeId),
    code:text(f.code||f.foutcode),bron:text(f.bron||f.bronBestand),reden:text(f.rekenStatus),
    assetKey:text(f.assetKey),locatie:[text(f.weg),text(f.richting),finite(f.hm)?`hm ${Number(f.hm).toLocaleString('nl-NL')}`:''].filter(Boolean).join(' ')
  };
}
function faultFingerprint(f){
  const eventId=text(f.eventId||f.event_id);
  const bron=text(f.bron||f.bronBestand||f.source_name);
  const kern=[f.assetKey||f.naam,f.typeId,f.code,f.start,f.weg,f.richting,f.hm].map(text);
  if(kern.filter(Boolean).length<3)return '';
  return [eventId,bron,...kern].join('|');
}

function statusFor(score,blockers){
  if(blockers||score<70)return {id:'off-track',label:'Niet op koers',tone:'red'};
  if(score<85)return {id:'attention',label:'Aandacht nodig',tone:'amber'};
  return {id:'on-track',label:'Op koers',tone:'green'};
}

export function runQualityAudit(input={}){
  const state=input.state||{},dvm=state.dvm||null,bi=state.bi||null;
  const summaries=input.summaries||{},dvmSummary=summaries.dvm||{};
  const assets=list(input.dvmAssets),biAssets=list(input.biAssets),faults=list(input.faults);
  const now=timeValue(input.now)||Date.now(),findings=[];
  const add=(category,severity,title,detail,action='',metric=null,items=[])=>findings.push({category,severity,title,detail,action,metric,items:list(items).slice(0,100)});

  const rawAssetCount=rowsIn(dvm?.assetregister),liveRows=rowsIn(dvm?.liveStoringen);
  const historyRows=rowsIn(dvm?.storingshistorie),dripHistoryRows=rowsIn(dvm?.dripHistorie);
  const routeRows=rowsIn(dvm?.uRoutes),workRows=rowsIn(dvm?.werkzaamheden);

  if(!dvm)add('sources','critical','DVM-werkruimte ontbreekt','Er is geen DVM-dataset geladen. De actuele asset- en dienstketen kan niet worden beoordeeld.','Laad via DVM-bronbeheer minimaal het assetregister, de regels en de actuele storingslijst.');
  else add('sources','good','DVM-werkruimte aanwezig','De DVM-werkruimte is beschikbaar voor de audit.','',1);

  if(rawAssetCount)add('sources','good','Assetregister geladen',`${rawAssetCount.toLocaleString('nl-NL')} bronregels zijn aanwezig in het assetregister.`,'',rawAssetCount);
  else add('sources','critical','Assetregister ontbreekt','Zonder assetregister zijn storingskoppeling, areaalbasis en dienstimpact niet controleerbaar.','Laad All Assets opnieuw via DVM-bronbeheer.');

  if(liveRows)add('sources','good','Actuele storingsbron geladen',`${liveRows.toLocaleString('nl-NL')} regels staan in de actuele storingsbron.`,'',liveRows);
  else add('sources','warning','Geen actuele storingsbron','Het live dashboard kan zonder actuele momentopname geen huidige situatie aantonen.','Laad als laatste stap een recente lijst met open storingen.');

  const liveDate=newestDate(dvm?.liveStoringen)||timeValue(dvmSummary.peildatum);
  if(liveRows&&liveDate){
    const ageDays=Math.max(0,(now-liveDate)/864e5);
    if(ageDays>45)add('sources','critical','Actuele bron is sterk verouderd',`De nieuwste peildatum ligt ${Math.floor(ageDays)} dagen voor het auditmoment.`,'Laad een nieuwe volledige momentopname van de open storingen.',Math.floor(ageDays));
    else if(ageDays>14)add('sources','warning','Actualiteit storingsbeeld controleren',`De nieuwste peildatum ligt ${Math.floor(ageDays)} dagen voor het auditmoment.`,'Controleer of dit nog de bedoelde brondag is. Laad anders een nieuwe momentopname.',Math.floor(ageDays));
    else add('sources','good','Storingsbeeld is recent',`De nieuwste peildatum ligt ${Math.floor(ageDays)} dagen voor het auditmoment.`,'',Math.floor(ageDays));
  }else if(liveRows)add('sources','warning','Peildatum actuele bron ontbreekt','Er zijn actuele storingsregels, maar hun peildatum is niet herleidbaar.','Neem een peildatum op in de bron of laad een export waarin die datum is bewaard.');

  if(historyRows||dripHistoryRows)add('sources','good','Historische prognosebronnen aanwezig',`${(historyRows+dripHistoryRows).toLocaleString('nl-NL')} historische regels of incidenten zijn beschikbaar.`,'',historyRows+dripHistoryRows);
  else add('sources','info','Geen storingshistorie','Live beoordeling blijft mogelijk, maar prognoses kunnen niet uit storingshistorie worden gekalibreerd.','Laad historie voordat je een prognose gebruikt.');
  if(routeRows||workRows)add('sources','good','Operationele context aanwezig',`${routeRows.toLocaleString('nl-NL')} U-routes en ${workRows.toLocaleString('nl-NL')} werkzaamheden zijn geladen.`,'',routeRows+workRows);
  else add('sources','info','Operationele context ontbreekt','U-routes en werkzaamheden zijn niet geladen. Dit blokkeert de technische storingsanalyse niet.','Laad deze bronnen wanneer je gevolgen en samenloop wilt beoordelen.');

  if(rawAssetCount&&assets.length===0)add('integrity','critical','Assetregister niet verwerkt','De bron bevat assets, maar de publieke DVM-analyse levert geen verwerkt asset op.','Open DVM-bronbeheer en verwerk het assetregister opnieuw.');
  else if(assets.length)add('integrity','good','Assetregister verwerkt',`${assets.length.toLocaleString('nl-NL')} assets zijn beschikbaar in het analysemodel.`,'',assets.length);
  /* Het verschil tussen bronregels en verwerkte assets moet verklaarbaar zijn.
     Een klein verschil (kopregels, dubbele sleutels, niet-DVM-regels) is normaal;
     een groot verschil verdient controle. */
  if(rawAssetCount&&assets.length){
    const nietVerwerkt=rawAssetCount-assets.length;
    if(nietVerwerkt>0){
      const dropPct=pct(nietVerwerkt,rawAssetCount);
      add('integrity',dropPct>5?'warning':'info','Bronregels en verwerkte assets verschillen',`${rawAssetCount.toLocaleString('nl-NL')} bronregels leverden ${assets.length.toLocaleString('nl-NL')} verwerkte assets; ${nietVerwerkt.toLocaleString('nl-NL')} (${dropPct.toLocaleString('nl-NL')}%) vielen af.`,dropPct>5?'Controleer of het verschil verklaarbaar is: kopregels, dubbele sleutels of niet-DVM-assets.':'',nietVerwerkt);
    }
  }

  const missingKeys=assets.filter(a=>!text(a.key)).length,duplicateKeys=duplicateCount(assets.map(a=>a.key));
  if(missingKeys)add('integrity','critical','Assets zonder stabiele sleutel',`${missingKeys.toLocaleString('nl-NL')} assets missen een sleutel en zijn niet betrouwbaar herleidbaar.`,'Herstel de unieke asset-ID in de bron.',missingKeys);
  if(duplicateKeys)add('integrity',duplicateKeys/Math.max(1,assets.length)>.01?'critical':'warning','Dubbele assetsleutels',`${duplicateKeys.toLocaleString('nl-NL')} assets gebruiken een sleutel die al eerder voorkomt.`,'Controleer duplicaten in All Assets en laad het opgeschoonde register.',duplicateKeys);
  if(assets.length&&!missingKeys&&!duplicateKeys)add('integrity','good','Assetsleutels zijn uniek','Alle verwerkte assets hebben een unieke sleutel.','',assets.length);

  if(assets.length){
    const typeKnown=assets.filter(a=>text(a.tp)).length,roadKnown=assets.filter(a=>text(a.weg)).length;
    const typePct=pct(typeKnown,assets.length),roadPct=pct(roadKnown,assets.length);
    add('integrity',typePct<98?'warning':'good','Assettype-dekking',`${typePct.toLocaleString('nl-NL')}% van de assets heeft een herkend assettype.`,typePct<98?'Controleer lege of onbekende typewaarden in All Assets.':'',typePct);
    add('integrity',roadPct<85?'warning':'good','Locatiedekking assets',`${roadPct.toLocaleString('nl-NL')}% van de assets heeft een herkend wegnummer.`,roadPct<85?'Controleer de weg- en locatievelden in het assetregister.':'',roadPct);
    const lifeKnown=assets.filter(a=>finite(a.bouwjaar)||finite(a.startJaar)||finite(a.eol)||finite(a.eolYear)||finite(a.lifeMedianYears)||finite(a.life_median_years)).length;
    const lifePct=pct(lifeKnown,assets.length);
    add('integrity',lifePct<50?'warning':'good','Levensduurdekking assets',`${lifePct.toLocaleString('nl-NL')}% van de assets heeft een bouwjaar, EOL of bruikbaar levensduuranker.`,lifePct<50?'Vul EOL of bouwjaar aan voordat je leeftijdsprognoses gebruikt.':'',lifePct);
  }

  const duplicateFaultGroups=duplicateGroups(faults,faultFingerprint),duplicateFaults=duplicateFaultGroups.reduce((sum,group)=>sum+group.length-1,0);
  if(duplicateFaults)add('integrity','warning','Mogelijke dubbele open storingen',`${duplicateFaults.toLocaleString('nl-NL')} meldingen hebben dezelfde asset-, code-, tijd- en locatiekenmerken.`,'Controleer of dezelfde bronregel meer dan één keer in de gezamenlijke storingsset staat.',duplicateFaults,duplicateFaultGroups.flatMap(group=>group.map(faultEvidence)));
  else if(faults.length)add('integrity','good','Geen exacte storingsduplicaten gevonden','De audit vond geen dubbele combinatie van asset, foutcode, starttijd en locatie.','',faults.length);
  const durations=faults.filter(f=>finite(f.duurUren)).length;
  if(faults.length){
    const durationPct=pct(durations,faults.length);
    add('integrity',durationPct<80?'warning':'good','Duurdekking open storingen',`${durationPct.toLocaleString('nl-NL')}% van de open storingen heeft een bruikbare duur.`,durationPct<80?'Controleer starttijd, peildatum en expliciete duur in de storingsbron.':'',durationPct);
  }

  if(liveRows&&faults.length===0)add('linkage','critical','Storingsbron bereikt het dashboard niet',`De bron bevat ${liveRows.toLocaleString('nl-NL')} regels, maar de gezamenlijke storingsweergave is leeg.`,'Verwerk de actuele bron opnieuw en controleer het ingestelde storingsfilter.');
  else if(faults.length){
    const outputPct=pct(faults.length,liveRows||faults.length),difference=Math.max(0,liveRows-faults.length);
    add('linkage',outputPct<50?'warning':'good','Storingsketen levert meldingen',`${faults.length.toLocaleString('nl-NL')} van ${liveRows.toLocaleString('nl-NL')} bronregels (${outputPct.toLocaleString('nl-NL')}%) staan in de gezamenlijke weergave.${difference?` ${difference.toLocaleString('nl-NL')} regels zijn uitgefilterd, gede-dupliceerd of niet geclassificeerd.`:''}`,outputPct<50?'Controleer bronfilters, classificatie en de-duplicatie van de ontbrekende regels.':'',outputPct);
  }

  /* Het verschil tussen bronregels en getoonde meldingen mag geen zwart gat zijn.
     De engine houdt zelf bij waarom een regel afvalt; die uitsplitsing tonen we,
     zodat een gebruiker ziet dat het verschil verklaard is en niet stil verdwijnt. */
  const stats=dvmSummary.stats;
  if(stats&&finite(stats.totaal)){
    const delen=[];
    const noem=(waarde,label)=>{if(finite(waarde)&&Number(waarde)>0)delen.push(`${Number(waarde).toLocaleString('nl-NL')} ${label}`);};
    noem(stats.toegepast,'doorgerekend');
    noem(stats.dubbel,'ontdubbeld');
    noem(stats.nietGecl,'niet geclassificeerd');
    noem(stats.zonderFoutregel,'zonder passende foutregel');
    noem(stats.zonderLocatie,'zonder locatie');
    noem(dvmSummary.nietDoorgerekend,'zichtbaar maar niet doorgerekend');
    add('linkage','info','Verwerking van de actuele bronregels',`${Number(stats.totaal).toLocaleString('nl-NL')} bronregels: ${delen.length?delen.join(', '):'geen uitsplitsing beschikbaar'}.`,'',Number(stats.totaal));
  }

  if(faults.length){
    const linked=faults.filter(f=>text(f.assetKey)).length,linkedPct=pct(linked,faults.length);
    add('linkage',linkedPct<50?'critical':linkedPct<90?'warning':'good','Assetkoppeling open storingen',`${linkedPct.toLocaleString('nl-NL')}% van de open storingen is aan een specifiek asset gekoppeld.`,linkedPct<90?'Controleer assetcode, VC, weg, richting en hectometer van de niet-gekoppelde meldingen.':'',linkedPct);
    /* Een locatieconflict — identiteit wijst naar het ene asset, locatie naar het
       andere — is de beveiliging die wérkt: BiDash weigert de verdachte koppeling.
       Dat is geen systeemblokkade, dus het telt als aandachtspunt, niet als
       blokker. Blokkerend is het pas wanneer zo'n conflict tóch een koppeling of
       impact heeft gekregen; dan heeft de beveiliging gefaald. */
    const conflictFaults=faults.filter(f=>f.assetMatchStatus==='locatieconflict');
    const gelektConflict=conflictFaults.filter(f=>text(f.assetKey)||finite(f.impact)).length;
    const gelekteConflicten=conflictFaults.filter(f=>text(f.assetKey)||finite(f.impact));
    if(gelektConflict)add('linkage','critical','Locatieconflict toch doorgerekend',`${gelektConflict.toLocaleString('nl-NL')} meldingen met een tegenstrijdige locatie kregen tóch een koppeling of impact.`,'Onderzoek waarom de blokkade hier niet greep en herstel de bron voordat je hierop stuurt.',gelektConflict,gelekteConflicten.map(faultEvidence));
    if(conflictFaults.length)add('linkage','warning','Locatieconflicten veilig geblokkeerd',`${conflictFaults.length.toLocaleString('nl-NL')} meldingen verwijzen qua identiteit en locatie naar verschillende assets. BiDash weigert de koppeling en rekent geen impact; ze staan als niet gekoppeld.`,'Los per geval de bronidentiteit of locatie op. Forceer de koppeling niet.',conflictFaults.length,conflictFaults.map(faultEvidence));
    else add('linkage','good','Geen locatieconflicten','De audit vond geen geblokkeerde koppeling met tegenstrijdige locatie.','',0);
    const dripFaults=faults.filter(f=>text(f.typeId).toUpperCase()==='DRIP'),wind=dripFaults.filter(f=>f.wind).length,ria4=dripFaults.filter(f=>f.ria4).length;
    if(dripFaults.length)add('linkage','info','Speciale DRIP-classificatie',`${wind.toLocaleString('nl-NL')} open DRIP-meldingen zijn als Windwaarschuwing gemarkeerd en ${ria4.toLocaleString('nl-NL')} als RIA4. Overige DRIP-meldingen blijven regulier.`,'Controleer de bronherkomst wanneer deze aantallen onverwacht zijn.',wind+ria4);
  }

  const serviceIds=new Set(list(dvmSummary.diensten).map(x=>text(x.id)).filter(Boolean));
  const functionIds=new Set(list(summaries.bi?.functies).map(x=>text(x.id)).filter(Boolean));
  const invalidLinks=list(state.links).filter(x=>!serviceIds.has(text(x.dienst))||!functionIds.has(text(x.functie))).length;
  if(invalidLinks)add('linkage','warning','Verouderde dienstkoppelingen',`${invalidLinks.toLocaleString('nl-NL')} expliciete koppelingen verwijzen niet meer naar een geladen dienst of bedrijfsfunctie.`,'Werk de koppelingen onder Regels en signalen bij.',invalidLinks);
  else if(state.links?.length)add('linkage','good','Dienstkoppelingen zijn geldig',`Alle ${state.links.length.toLocaleString('nl-NL')} expliciete koppelingen verwijzen naar geladen onderdelen.`,'',state.links.length);
  else add('linkage','info','Geen dienstkoppelingen ingesteld','DVM en BI kunnen los werken, maar gezamenlijke dienst- en capaciteitssignalen blijven uit.','Leg alleen de koppelingen vast die inhoudelijk zijn vastgesteld.');

  const rules=dvm?.parameters,services=list(rules?.diensten);
  if(!rules)add('calculation','critical','DVM-rekenregels ontbreken','De bron bevat geen parameter- en regelset voor een reproduceerbare doorrekening.','Laad of herstel de DVM-parameters.');
  else add('calculation','good','DVM-rekenregels aanwezig',`${services.length.toLocaleString('nl-NL')} dienstdefinities zijn geladen.`,'',services.length);
  const invalidShares=services.filter(service=>{
    const values=Object.values(service?.afh||{}).map(Number).filter(Number.isFinite);
    return !values.length||Math.abs(values.reduce((a,b)=>a+b,0)-1)>.01;
  }).length;
  if(invalidShares)add('calculation','critical','Dienstaandelen tellen niet op tot 100%',`${invalidShares.toLocaleString('nl-NL')} diensten hebben een lege of ongenormaliseerde afhankelijkheidsverdeling.`,'Open Impactregels en corrigeer de aandelen per dienst.',invalidShares);
  else if(services.length)add('calculation','good','Dienstaandelen zijn genormaliseerd','Alle dienstdefinities tellen binnen de tolerantie op tot 100%.','',services.length);

  if(rules&&list(dvmSummary.diensten).length===0)add('calculation','critical','Geen dienstuitkomsten','Er zijn regels geladen, maar het publieke analysemodel levert geen dienstuitkomsten.','Vernieuw de uitkomsten of verwerk de DVM-bronnen opnieuw.');
  const uncalculatedRows=faults.filter(f=>(text(f.rekenStatus)&&!/^doorgerekend$/i.test(text(f.rekenStatus)))||(!text(f.rekenStatus)&&!finite(f.impact))),uncalculated=uncalculatedRows.length;
  if(uncalculated)add('calculation','warning','Open meldingen niet doorgerekend',`${uncalculated.toLocaleString('nl-NL')} open meldingen blijven zichtbaar, maar hebben geen bewezen impactuitkomst.`,'Maak of wijs alleen een passende foutcode toe als de impact inhoudelijk kan worden onderbouwd. Los locatieconflicten via Assetconfiguratie op.',uncalculated,uncalculatedRows.map(faultEvidence));
  else if(faults.length)add('calculation','good','Alle open meldingen doorgerekend','Iedere open melding heeft een door de engine geaccepteerde rekenstatus.','',faults.length);
  const exactServices=list(dvmSummary.diensten).filter(s=>finite(s.besch)).length;
  if(uncalculated&&exactServices)add('calculation','critical','Exact percentage ondanks onbekende impact',`${exactServices.toLocaleString('nl-NL')} diensten tonen een exact beschikbaarheidspercentage terwijl open meldingen niet zijn doorgerekend.`,'Toon voor deze diensten een databand of onbekende uitkomst totdat de impact is onderbouwd.',exactServices);
  else if(uncalculated&&list(dvmSummary.diensten).length)add('calculation','good','Onzekerheid blijft zichtbaar','Niet-doorgerekende meldingen worden niet stilzwijgend als nul impact verwerkt.','',uncalculated);

  const roads=list(dvmSummary.roads),knownCosts=roads.filter(r=>finite(r.kosten)).length;
  if(roads.length){
    const costPct=pct(knownCosts,roads.length);
    add('calculation',costPct<80?'warning':'good','Dekking verkeerskosten',`${costPct.toLocaleString('nl-NL')}% van de geraakte wegdelen heeft een berekenbaar kostenscenario.`,costPct<80?'Vul NDW-verkeer, hinderuren, snelheidsreductie en routecontrole aan.':'',costPct);
  }

  const backupReady=!!(dvm?.assetregister&&dvm?.parameters&&dvm?.liveStoringen);
  add('continuity',backupReady?'good':'warning','Herberekenbare DVM-back-up',backupReady?'Assetregister, actuele storingen en parameters zijn samen beschikbaar.':'Minstens één kernonderdeel voor herberekening ontbreekt.',backupReady?'':'Neem assetregister, actuele storingen en parameters samen op in je volgende export.',backupReady?1:0);
  const biFuncties=list(summaries.bi?.functies).length;
  if(bi&&!biAssets.length&&!biFuncties)add('continuity','warning','BI-werkruimte geladen maar leeg','Er is een BI-dataset, maar zonder assets en zonder bedrijfsfuncties. Formatie, capaciteit en gezamenlijke signalen zijn niet te beoordelen.','Laad een BI-dataset met assets en functies, of verwijder de lege BI-set.',0);
  else if(bi)add('continuity','good','BI-werkruimte aanwezig',`${biAssets.length.toLocaleString('nl-NL')} BI-assets en ${biFuncties.toLocaleString('nl-NL')} functies zijn in de werkruimte zichtbaar.`,'',biAssets.length);
  else add('continuity','info','BI-werkruimte niet geladen','De DVM-audit blijft bruikbaar. Formatie, contracten en gezamenlijke signalen worden niet beoordeeld.','Laad BI-gegevens wanneer je de integrale werking wilt auditen.');
  if(state.planning)add('continuity','good','Oorspronkelijke planning bewaard','De planning-XML is beschikbaar voor export en herverwerking.','',1);
  else add('continuity','info','Planning niet geladen','Planning en capaciteit vallen buiten deze auditrun.','Laad de planning-XML wanneer je ook uitvoerbaarheid wilt beoordelen.');

  const penalty={critical:35,warning:12,info:0,good:0};
  const categories=Object.entries(QUALITY_CATEGORIES).map(([id,meta])=>{
    const own=findings.filter(f=>f.category===id),raw=100-own.reduce((sum,f)=>sum+(penalty[f.severity]||0),0);
    return {id,...meta,score:Math.max(0,Math.min(100,raw)),critical:own.filter(f=>f.severity==='critical').length,warnings:own.filter(f=>f.severity==='warning').length,findings:own.length};
  });
  let score=Math.round(categories.reduce((sum,c)=>sum+c.score*c.weight,0)/categories.reduce((sum,c)=>sum+c.weight,0));
  const blockers=findings.filter(f=>f.severity==='critical').length,warnings=findings.filter(f=>f.severity==='warning').length;
  if(blockers)score=Math.min(score,blockers>1?49:69);
  const verdict=statusFor(score,blockers);
  const priority={critical:0,warning:1,info:2,good:3};
  findings.sort((a,b)=>priority[a.severity]-priority[b.severity]||a.category.localeCompare(b.category)||a.title.localeCompare(b.title));
  return {
    format:'BiDash-kwaliteitsaudit',version:QUALITY_AUDIT_VERSION,generatedAt:new Date(now).toISOString(),
    score,verdict,blockers,warnings,categories,findings,
    scope:{dvm:!!dvm,bi:!!bi,planning:!!state.planning,rawAssets:rawAssetCount,processedAssets:assets.length,openSourceRows:liveRows,openFaults:faults.length,historicalRows:historyRows+dripHistoryRows},
    method:'Vaste lokale controles op bronaanwezigheid, actualiteit, uniciteit, koppelingen, rekenstatus en exporteerbaarheid. Probleemgevallen bevatten alleen minimale identifiers voor herstelacties, geen volledige bronregels. De audit bewijst niet dat verkeerskundige of statistische aannames inhoudelijk juist zijn.'
  };
}
