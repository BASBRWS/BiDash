import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import '../site/engines/dvm-memo-besluit.js';
const H=globalThis.DVM_MEMO_BESLUIT;
const afspraak={basis:'Herstel de storingslevenscyclus.',actie:'Voer een herstelopdracht van drie maanden uit voor de storingslevenscyclus.',eigenaar:'Eigenaar storingsketen',einddatum:'2027-01-14',resultaat:'een getoetste incidentidentificatie, sluitregels en broncontroles',terugDatum:'2027-01-21',besluitvormer:'DT'};

test('een beslispunt bevat opdracht, eigenaar, einddatum, toetsbaar resultaat en vervolg besluit',()=>{
 assert.equal(H.controle(afspraak).length,0);const s=H.zin(afspraak);
 for(const text of ['Instemmen','drie maanden','Eigenaar storingsketen','14 januari 2027','incidentidentificatie','sluitregels','broncontroles','21 januari 2027','DT','ter vaststelling'])assert.ok(s.includes(text),text);
 assert.equal(H.html([afspraak]).includes('Conceptbeslispunten'),false);
});
test('ontbrekende afspraken worden expliciet concept, zonder eigenaar of termijn te verzinnen',()=>{
 const [r]=H.rijen(['Verbeter de datakwaliteit.']);assert.equal(H.controle(r).length,5);
 assert.equal(r.eigenaar,'');assert.equal(r.einddatum,'');assert.equal(r.resultaat,'');assert.equal(r.terugDatum,'');assert.equal(r.besluitvormer,'');
 assert.match(H.html([r]),/Conceptbeslispunten/);assert.match(H.html([r]),/Verantwoordelijke eigenaar ontbreekt/);assert.match(H.html([r]),/Datum vervolgbesluit ontbreekt/);
});
test('beslispunten houden afzonderlijke eigenaren en resultaten, ook bij een extra optie',()=>{
 const acties=['Herstel de bron.','Herijk de prognose.'];const saved=H.rijen(acties);saved[0].eigenaar='Bronhouder';saved[1].eigenaar='Modelbeheerder';saved[0].actie='Maak de broncontrole sluitend.';
 const next=H.rijen([...acties,'Weeg de bedrijfswaarden.'],saved);assert.equal(next[0].eigenaar,'Bronhouder');assert.equal(next[1].eigenaar,'Modelbeheerder');assert.equal(next[0].actie,'Maak de broncontrole sluitend.');assert.equal(next[2].eigenaar,'');
 next[2].eigenaar='Risico-eigenaar';const hidden=H.rijen(acties,next);hidden[0].eigenaar='Nieuwe bronhouder';const combined=H.samenvoegen(next,hidden);assert.equal(H.rijen([...acties,'Weeg de bedrijfswaarden.'],combined)[2].eigenaar,'Risico-eigenaar');
 const changed=H.rijen(['Herstel een andere bron.'],saved);assert.equal(changed[0].eigenaar,'');
});
test('ongeldige datums en een vervolg besluit vóór oplevering worden zichtbaar',()=>{
 assert.equal(H.datum('2027-02-29'),null);assert.equal(H.datum('2028-02-29'),'2028-02-29');assert.equal(H.datum('2026-13-01'),null);
 assert.ok(H.controle({...afspraak,einddatum:'2027-02-30'}).some(x=>x.includes('ongeldig')));
 assert.ok(H.controle({...afspraak,terugDatum:'2027-01-01'}).some(x=>x.includes('vóór')));
});
test('vrije invoer wordt uitsluitend als tekst in memo en export opgenomen',()=>{
 const html=H.html([{...afspraak,eigenaar:'<img src=x onerror=alert(1)>',resultaat:'<script>alert(1)</script>'}]);
 assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img'),false);assert.match(html,/&lt;img/);
});
test('memoafspraken zijn per bronstand en scope gescheiden en gaan met Parameters mee',()=>{
 const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);r.eval('STATE={bestand:"synthetic",peildatum:123};RULES.cfg.memoBesluiten={}');
 const a=r.memoBesluitModel({type:'overzicht',scope:'ZWN'},['Herstel de bron.']),b=r.memoBesluitModel({type:'overzicht',scope:'NWN'},['Herstel de bron.']);
 assert.notEqual(a.key,b.key);a.rijen[0].eigenaar='Bronhouder';r.saved=a;r.eval('RULES.cfg.memoBesluiten[saved.key]=saved.rijen');
 assert.equal(r.memoBesluitModel({type:'overzicht',scope:'ZWN'},['Herstel de bron.']).rijen[0].eigenaar,'Bronhouder');assert.equal(r.memoBesluitModel({type:'overzicht',scope:'NWN'},['Herstel de bron.']).rijen[0].eigenaar,'');
 const out=r.totaalExportBundle();assert.equal(out.parameters.cfg.memoBesluiten[a.key][0].eigenaar,'Bronhouder');
 r.eval('STATE.peildatum=124');assert.equal(r.memoBesluitModel({type:'overzicht',scope:'ZWN'},['Herstel de bron.']).rijen[0].eigenaar,'');
});

test('begeleidende MSI- en DRIP-brieven gebruiken dezelfde vastgelegde uitvoeringsafspraken',()=>{
 const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);r.eval('STATE={bestand:"synthetic",peildatum:123}');
 r.memoSecties=()=>({aanleiding:'synthetic',beschrijving:'synthetic',risico:'synthetic',conclusie:'synthetic',besluit:[afspraak.basis],uitkomst:'synthetic'});
 r.monteCarloMethodeUitleg=()=>'';r.kostenMemoHtml=()=>'';
 for(const type of ['montecarlo','drip-montecarlo']){
  const bron={type,mc:{runs:10,horizon:1}};r.monteCarloMemoBron=()=>bron;
  const model=r.memoBesluitModel(bron,[afspraak.basis]);r.saved={key:model.key,rijen:[afspraak]};r.eval('RULES.cfg.memoBesluiten={[saved.key]:saved.rijen}');
  const html=r.monteCarloBegeleidendSchrijvenKaart(type);assert.match(html,/Eigenaar storingsketen/);assert.match(html,/14 januari 2027/);assert.match(html,/21 januari 2027/);assert.match(html,/DT/);assert.equal(html.includes('Conceptbeslispunten'),false);
 }
});
