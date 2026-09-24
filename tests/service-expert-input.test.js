import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServiceExpertReview,expertReviewCompletion,normalizeServiceExpertReview,upsertServiceExpertReview,validateServiceExpertReview,modelProposalFromService,expertModelProposal,validateExpertModelProposal,EXPERT_GUIDED_SECTIONS,rebalanceExpertShares} from '../site/core/service-expert-input.js';

function completeReview(){
  const review=createServiceExpertReview({id:'im',naam:'Incidentmanagement'},0);
  review.status='ter_beoordeling';
  review.expert={naam:'Expert A',rol:'Proceseigenaar',organisatie:'VWM'};
  review.context={doel:'Incidenten veilig afhandelen',resultaat:'Veilige en vlotte weg',gebruikers:'Weggebruikers',scope:'Landelijk hoofdwegennet',buitenScope:'Hulpverlening op locatie'};
  review.proces={start:'Incidentmelding',stappen:'1. Detecteren\n2. Beoordelen\n3. Maatregel nemen',beslismomenten:'Wel of niet afkruisen',overdrachten:'Meldkamer naar verkeersleider',einde:'Maatregel opgeheven en gelogd'};
  review.afhankelijkheden={assets:'MSI, camera en detectie',informatie:'Actueel verkeersbeeld',functies:'Wegverkeersleider',extern:'Hulpdiensten',bovenstrooms:'Detectie',benedenstrooms:'Reisinformatie'};
  review.impact={faalwijzen:'Incident niet gedetecteerd',veiligheid:'Onveilige rijstrook en vertraging',informatie:'Onvolledig verkeersbeeld',alternatief:'Handmatige melding',herstel:'Beeld controleren',escalatie:'Na 10 minuten'};
  review.meting={normDuiding:'Norm geldt op de brondag',meetwijze:'Afgeronde incidenten gedeeld door incidenten',meetvenster:'Per maand',bron:'Incidentregistratie',onzekerheid:'Niet gemelde incidenten'};
  review.validatie={bewijs:'Werkinstructie en incidentanalyse',aannames:'Volledige registratie',openVragen:'Geen',vertrouwen:'4',akkoordNaam:'',akkoordDatum:''};
  review.modelWijziging={norm:'99',subprocessen:[{id:'sp1',naam:'Detecteren',aandeel:'60',afhankelijkheden:{detectie:'70',camera:'30'},onderbouwing:''},{id:'sp2',naam:'Maatregel uitvoeren',aandeel:'40',afhankelijkheden:{signalering:'100'},onderbouwing:''}],test:null,toepassing:null};
  review.relaties=[{id:'r1',bron:'Detectie',relatie:'levert_aan',doel:'Incident detecteren',kritiek:'essentieel',duiding:'Start het proces',bewijs:'Werkinstructie'}];
  review.regelVoorstellen=[{id:'r2',als:'Detectie ontbreekt',dan:'Detectievermogen onbekend',maatstaf:'Langer dan 5 minuten',gewicht:'Hoog',uitzondering:'Handmatige melding',eigenaar:'Proceseigenaar',bewijs:'Analyse'}];
  review.signaalVoorstellen=[{id:'s1',voorwaarde:'Detectie langer dan 5 minuten onbekend',ernst:'kritiek',actie:'Controleer alternatieve bronnen',eigenaar:'Wegverkeersleider',responstijd:'Direct',escalatie:'Na 10 minuten'}];
  return review;
}

test('expertformulier bevat de vaste kernvragen en is generiek per dienst',()=>{
  const review=createServiceExpertReview({id:'im',naam:'Incidentmanagement'},0);
  assert.equal(review.dienstId,'im');
  assert.equal(review.status,'concept');
  assert.equal(expertReviewCompletion(review).percentage,0);
  const normalized=normalizeServiceExpertReview({...review,dienstId:'vm',dienstNaam:'Verkeersmanagement'},{id:'vm',naam:'Verkeersmanagement'},0);
  assert.equal(normalized.dienstId,'vm');
  assert.ok(Object.hasOwn(normalized.proces,'beslismomenten'));
  assert.ok(Object.hasOwn(normalized.afhankelijkheden,'bovenstrooms'));
  assert.ok(Object.hasOwn(normalized,'modelWijziging'));
  assert.ok(Object.hasOwn(normalized,'toelichtingen'));
  assert.equal(EXPERT_GUIDED_SECTIONS.length,4);
});

test('ter beoordeling vereist de begeleide kernkeuzes maar geen regel- of signaalvoorstel',()=>{
  const leeg=createServiceExpertReview({id:'im',naam:'Incidentmanagement'},0);leeg.status='ter_beoordeling';
  assert.ok(validateServiceExpertReview(leeg).length>10);
  const review=completeReview();
  review.regelVoorstellen=[];review.signaalVoorstellen=[];
  assert.deepEqual(validateServiceExpertReview(review),[]);
  assert.equal(expertReviewCompletion(review).percentage,100);
});

test('ter beoordeling weigert gedeeltelijk ingevulde voorstellen en relaties',()=>{
  const review=completeReview();
  review.relaties.push({id:'r2',bron:'Meldkamer'});
  review.regelVoorstellen.push({id:'r3',als:'Camera valt uit'});
  review.signaalVoorstellen.push({id:'s2',voorwaarde:'Proces ligt stil'});
  const fouten=validateServiceExpertReview(review);
  assert.ok(fouten.includes('Relatie 2 is niet compleet.'));
  assert.ok(fouten.includes('Regelvoorstel 2 is niet compleet.'));
  assert.ok(fouten.includes('Signaalvoorstel 2 is niet compleet.'));
});

test('vastgesteld vereist een akkoordgever en datum',()=>{
  const review=completeReview();review.status='vastgesteld';
  assert.deepEqual(validateServiceExpertReview(review),['Naam van de akkoordgever ontbreekt.','Datum van akkoord ontbreekt.']);
  review.validatie.akkoordNaam='Dienstmanager';review.validatie.akkoordDatum='2026-09-22';
  assert.deepEqual(validateServiceExpertReview(review),[]);
});

test('opslaan vervangt alleen de duiding van dezelfde dienstverlening',()=>{
  const im=completeReview(),vm=createServiceExpertReview({id:'vm',naam:'Verkeersmanagement'},0);
  const first=upsertServiceExpertReview([],im),second=upsertServiceExpertReview(first,vm),third=upsertServiceExpertReview(second,{...im,status:'vastgesteld',validatie:{...im.validatie,akkoordNaam:'A',akkoordDatum:'2026-09-22'}});
  assert.equal(second.length,2);assert.equal(third.length,2);
  assert.equal(third.find(item=>item.dienstId==='im').status,'vastgesteld');
  assert.equal(third.find(item=>item.dienstId==='vm').status,'concept');
});

test('de hoofdschil heeft een route en knop voor expertinvoer per dienstverlening',()=>{
  const routes=fs.readFileSync(new URL('../site/ui/routes.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.match(routes,/\['expertInput','Expertinvoer','native','expertInput'\]/);
  assert.match(app,/data-expert-service/);
  assert.match(app,/data-expert-test-model/);
  assert.match(app,/data-expert-apply-model/);
  assert.match(app,/data-expert-undo-model/);
  assert.match(app,/data-expert-add="subprocess"/);
  assert.match(html,/id="expertInput"/);
});

test('huidige subprocessen worden een bewerkbaar modelvoorstel',()=>{
  const service={id:'im',norm:99,subprocessen:[
    {naam:'Detecteren',aandeelDienst:.6,bronnen:[{obj:'detectie',gewicht:.7},{obj:'camera',gewicht:.3}]},
    {naam:'Maatregel',aandeelDienst:.4,bronnen:[{obj:'signalering',gewicht:1}]}
  ]};
  const basis=modelProposalFromService(service);
  assert.equal(basis.subprocessen.length,2);
  assert.equal(basis.subprocessen[0].afhankelijkheden.detectie,'70');
  const review=createServiceExpertReview({id:'im',naam:'Incidentmanagement'},0);
  review.modelWijziging={norm:'98.5',subprocessen:[...basis.subprocessen,{id:'nieuw',naam:'Evalueren',aandeel:'0',afhankelijkheden:{communicatie:'100'},onderbouwing:'Nieuw proces'}],test:null,toepassing:null};
  const proposal=expertModelProposal(review,service);
  assert.equal(proposal.norm,98.5);
  assert.equal(proposal.subprocessen[2].afh.communicatie,1);
});

test('modelvalidatie bewaakt alleen de gesloten subprocessaandelen',()=>{
  const geldig={dienstId:'im',norm:99,subprocessen:[
    {naam:'Detecteren',gewicht:.6,afh:{detectie:.7,camera:.3}},
    {naam:'Maatregel',gewicht:.4,afh:{signalering:1}}
  ]};
  assert.deepEqual(validateExpertModelProposal(geldig),[]);
  const ongeldig=structuredClone(geldig);ongeldig.subprocessen[0].gewicht=.5;ongeldig.subprocessen[0].afh.detectie=.6;
  const fouten=validateExpertModelProposal(ongeldig);
  assert.ok(fouten.includes('De aandelen van de subprocessen moeten samen 100 procent zijn.'));
  assert.ok(!fouten.some(fout=>fout.includes('afhankelijkheden')&&fout.includes('100 procent')));
});

test('aanpassen van één aandeel verdeelt de rest automatisch tot 100 procent',()=>{
  assert.deepEqual(rebalanceExpertShares([60,30,10],0,50),[50,37.5,12.5]);
  assert.deepEqual(rebalanceExpertShares([0,0],0,25),[25,75]);
  assert.deepEqual(rebalanceExpertShares([20],0,10),[100]);
  assert.equal(rebalanceExpertShares([33.33,33.33,33.34]).reduce((sum,value)=>sum+value,0),100);
});

test('begeleide invoer gebruikt keuzes, optionele uitleg, vinkjes en tooltips',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../site/style.css',import.meta.url),'utf8');
  assert.match(app,/EXPERT_GUIDED_SECTIONS/);
  assert.match(app,/Extra uitleg, niet verplicht/);
  assert.match(app,/name="subprocess-afh"/);
  assert.match(app,/data-expert-share-total/);
  assert.match(app,/expert-tooltip/);
  assert.match(css,/\.expert-tooltip/);
});

test('DVM-adapter ondersteunt proefberekenen, toepassen en terugzetten',()=>{
  const adapter=fs.readFileSync(new URL('../site/engines/dvm-adapter-original.js',import.meta.url),'utf8');
  const engine=fs.readFileSync(new URL('../site/engines/dvm-1.js',import.meta.url),'utf8');
  assert.match(adapter,/testServiceModel\(model\)/);
  assert.match(adapter,/applyServiceModel\(model\)/);
  assert.match(adapter,/restoreServiceModel\(snapshot\)/);
  assert.match(adapter,/\[key,value\/som\]/);
  assert.match(engine,/SUBPROCESSEN\[id\]=regels\.map/);
});
