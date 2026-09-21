/* De balk toonde pas een versie nadat de DVM-module was geladen, en de zijbalk
   toonde intussen een verouderd nummer uit de opmaak. Deze test legt vast dat de
   schil haar eigen versie kent en meteen toont, dat modules alleen hun eigen
   versie melden, en dat het nummer op één plek staat. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BIDASH_VERSIE,versieTekst,versieTitel,toonVersies} from '../site/core/versie.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function element(id){
  const kind={id,className:'',textContent:'',title:'',children:[],
    prepend(el){kind.children.unshift(el);},append(el){kind.children.push(el);}};
  return kind;
}
/* Minimaal documentmodel: genoeg om te zien wát er in de balk en de zijbalk komt
   te staan, zonder een browser te vragen. */
function documentStub({metBadge=false}={}){
  const acties=element('head-actions'),voet=element('version');
  const badge=metBadge?element('bidashVersionBadge'):null;
  if(badge)acties.prepend(badge);
  return {acties,voet,
    getElementById:id=>id==='bidashVersionBadge'?(acties.children.find(c=>c.id===id)||null):null,
    querySelector:sel=>sel==='.head-actions'?acties:sel==='.sidebar-foot .version'?voet:null,
    createElement:()=>element('bidashVersionBadge')};
}

test('de schil toont haar eigen versie ook zonder geladen module',()=>{
  assert.equal(versieTekst(),'BiDash '+BIDASH_VERSIE);
  assert.match(versieTitel(),/modules melden hun versie zodra ze geladen zijn/);
  const doc=documentStub({metBadge:true});
  assert.equal(toonVersies(doc),'BiDash '+BIDASH_VERSIE);
  assert.equal(doc.getElementById('bidashVersionBadge').textContent,'BiDash '+BIDASH_VERSIE);
  assert.equal(doc.voet.textContent,'Integratie '+BIDASH_VERSIE);
});

test('een gemelde engineversie komt erbij, een lege melding niet',()=>{
  assert.equal(versieTekst({dvm:'99'}),'BiDash '+BIDASH_VERSIE+' · DVM 99');
  assert.equal(versieTekst({dvm:'99',bi:'',planning:null}),'BiDash '+BIDASH_VERSIE+' · DVM 99');
  assert.equal(versieTekst({dvm:'99',planning:'23'}),'BiDash '+BIDASH_VERSIE+' · DVM 99 · Planning 23');
  assert.match(versieTitel({dvm:'99'}),/de geladen modules/);
});

test('de badge wordt aangemaakt wanneer de opmaak hem niet meelevert',()=>{
  const doc=documentStub({metBadge:false});
  toonVersies(doc,{dvm:'99'});
  const badge=doc.acties.children[0];
  assert.equal(badge.id,'bidashVersionBadge');
  assert.equal(badge.textContent,'BiDash '+BIDASH_VERSIE+' · DVM 99');
});

test('de schil rendert de balk bij het starten en verwerkt versiemeldingen',()=>{
  const app=read('site/app.js');
  assert.match(app,/import \{toonVersies\} from '\.\/core\/versie\.js'/);
  assert.match(app,/toonVersies\(document,engineVersies\)/);
  assert.match(app,/hub:version/);
  const index=read('site/index.html');
  assert.match(index,/id="bidashVersionBadge"/);
  // Geen tweede, verouderd versienummer meer in de opmaak.
  assert.doesNotMatch(index,/Integratie 2\.3/);
});

test('de DVM-module meldt alleen haar eigen versie aan de schil',()=>{
  const manager=read('site/engines/dvm-source-manager.js');
  assert.match(manager,/postMessage\(\{type:'hub:version',engine:'dvm',versie:DVM_VERSION\}/);
  assert.doesNotMatch(manager,/BIDASH_VERSION/);
  // De module schrijft niet langer rechtstreeks in het document van de schil.
  assert.doesNotMatch(manager,/parent\.document\.getElementById\('bidashVersionBadge'\)/);
});

test('het versienummer van de schil staat op precies één plek',()=>{
  const bestanden=['site/app.js','site/index.html','site/engines/dvm-source-manager.js','site/engines/dvm-adapter.js'];
  for(const bestand of bestanden)assert.doesNotMatch(read(bestand),/2\.14/,bestand+' bevat een tweede versienummer');
  assert.match(read('site/core/versie.js'),/BIDASH_VERSIE='2\.20'/);
});
