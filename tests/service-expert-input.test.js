import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServiceExpertReview,expertReviewCompletion,normalizeServiceExpertReview,upsertServiceExpertReview,validateServiceExpertReview} from '../site/core/service-expert-input.js';

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
});

test('ter beoordeling vereist context, regelvoorstel en signaalvoorstel',()=>{
  const leeg=createServiceExpertReview({id:'im',naam:'Incidentmanagement'},0);leeg.status='ter_beoordeling';
  assert.ok(validateServiceExpertReview(leeg).length>10);
  const review=completeReview();
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
  assert.match(html,/id="expertInput"/);
});
