/* De kolom Beheerder in Open storingen toonde wat er toevallig in het veld `rd`
   stond. Bij DRIP-bronnen was dat een getal — in de praktijk de hectometrering —
   in plaats van de beherende regiodienst. Rapportages gebruikten hiervoor al
   rapportRdWaarde(): alleen een herkende regiodienst telt, anders wordt hij uit de
   verkeerscentrale afgeleid. De storingslijst volgt nu dezelfde regel.

   De test voert de verzonden implementaties uit: normRd(), rdBekend(), rdUitVc()
   en rapportRdWaarde() uit dvm-1.js, en regioDienst() letterlijk uit
   dvm-faults-extension.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const regels=read('site/engines/dvm-1.js');
const extensie=read('site/engines/dvm-faults-extension.js');

function haalFunctie(tekst,naam){
  const start=tekst.indexOf('function '+naam+'(');
  assert.notEqual(start,-1,naam+' niet gevonden');
  let diepte=0;
  for(let j=tekst.indexOf('{',start);j<tekst.length;j++){
    if(tekst[j]==='{')diepte++;
    else if(tekst[j]==='}'&&--diepte===0)return tekst.slice(start,j+1);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}
/* regioDienst is een const-pijlfunctie in een IIFE; haal hem op tot het
   afsluitende accolade-puntkomma. */
function haalPijlFunctie(tekst,naam){
  const start=tekst.indexOf('const '+naam+'=');
  assert.notEqual(start,-1,naam+' niet gevonden');
  let diepte=0;
  for(let j=tekst.indexOf('{',start);j<tekst.length;j++){
    if(tekst[j]==='{')diepte++;
    else if(tekst[j]==='}'&&--diepte===0)return tekst.slice(start,j+2);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}

const engine=read('site/engines/dvm-2.js');
function haalDeclaratie(tekst,naam){
  const m=tekst.match(new RegExp('^const '+naam+'\\s*=.*$','m'));
  assert.ok(m,naam+' niet gevonden');
  return m[0];
}
function context(){
  const ctx=vm.createContext({String,Number,Object,Array,console,RegExp});
  for(const naam of ['ONBEKEND_RD','RD_NAMEN','VC_RD_FALLBACK','VC_MAP'])
    vm.runInContext(haalDeclaratie(regels,naam),ctx);
  vm.runInContext('function netteWaarde(v){return String(v==null?"":v).trim();}',ctx);
  // De echte normAssetVc staat in dvm-2.js en hoort in dezelfde scope te draaien.
  vm.runInContext(haalFunctie(engine,'normAssetVc'),ctx,{filename:'normAssetVc'});
  for(const naam of ['normRd','rdBekend','rdUitVc','rapportRdWaarde'])
    vm.runInContext(haalFunctie(regels,naam),ctx,{filename:naam});
  vm.runInContext(haalPijlFunctie(extensie,'regioDienst'),ctx,{filename:'regioDienst'});
  return ctx;
}
const beheerder=(...bronnen)=>vm.runInContext(`regioDienst(${bronnen.map(b=>JSON.stringify(b)).join(',')})`,context());

test('een getal in het rd-veld verschijnt nooit als beheerder',()=>{
  // Precies wat de storingslijst toonde: de hectometrering in plaats van de dienst.
  for(const rd of ['1,5','22,3','55,0','70,1','59,6','1.55',' 12 ']){
    const uit=beheerder({rd,vc:'NWN'});
    assert.doesNotMatch(uit,/^[\d.,\s]+$/,`"${rd}" leverde "${uit}"`);
  }
});

test('zonder herkende regiodienst wordt hij uit de verkeerscentrale afgeleid',()=>{
  assert.equal(beheerder({rd:'1,5',vc:'NWN'}),'West-Nederland Noord');
  assert.equal(beheerder({rd:'22,3',vc:'ZN'}),'Zuid-Nederland');
  assert.equal(beheerder({rd:'',vc:'ZWN'}),'West-Nederland Zuid');
});

test('een herkende regiodienst uit de bron blijft staan',()=>{
  assert.equal(beheerder({rd:'WNZ',vc:'NWN'}),'West-Nederland Zuid');
  assert.equal(beheerder({rd:'Oost-Nederland',vc:'NWN'}),'Oost-Nederland');
  assert.equal(beheerder({rd:'WNN',vc:''}),'West-Nederland Noord');
});

test('de eerste bruikbare bron wint, in de volgorde die is meegegeven',()=>{
  assert.equal(beheerder({rd:'',vc:''},{rd:'ZN',vc:''},{rd:'MN',vc:''}),'Zuid-Nederland');
});

test('zonder enige aanwijzing blijft de waarde leeg, niet een verzonnen dienst',()=>{
  assert.equal(beheerder({rd:'',vc:''}),'');
  assert.equal(beheerder({rd:'99',vc:'XX'}),'');
});

test('beide storingsroutes gebruiken dezelfde afleiding',()=>{
  // De actuele momentopname en de uit historie afgeleide DRIP-storingen.
  const treffers=extensie.match(/rd:regioDienst\(/g)||[];
  assert.equal(treffers.length,2,'beide routes moeten regioDienst gebruiken');
  assert.doesNotMatch(extensie,/rd:row\.rd\|\|/);
  assert.doesNotMatch(extensie,/rd:asset\?\.rd\|\|d\?\.rd\|\|''/);
});
