import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const dvm2=readFileSync(new URL('../site/engines/dvm-2.js',import.meta.url),'utf8');

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

test('grote tijdreeksen bepalen bereik zonder spread naar Math.min/max',()=>{
  const scope={Number};
  vm.createContext(scope);
  vm.runInContext(haalFunctie(dvm2,'numeriekBereik'),scope);
  const waarden=Array.from({length:200000},(_,i)=>1700000000000+i*1000);
  const bereik=scope.numeriekBereik(waarden);
  assert.equal(bereik.min,waarden[0]);
  assert.equal(bereik.max,waarden.at(-1));
});

test('historie-inspectie en doorrekening bevatten geen grote tijdspread meer',()=>{
  const inspectie=dvm2.slice(dvm2.indexOf('function inspecteerStoringsRijen'),dvm2.indexOf('function gecombineerdeStoringsRijen'));
  const doorrekening=dvm2.slice(dvm2.indexOf('function doorrekenen'),dvm2.indexOf('function wegdeelBestuurKey'));
  assert.doesNotMatch(inspectie,/Math\.(?:min|max)\s*\(\s*\.\.\.g\.tijden/);
  assert.doesNotMatch(inspectie,/Math\.(?:min|max)\s*\(\s*\.\.\.a\.tijden/);
  assert.doesNotMatch(doorrekening,/Math\.(?:min|max)\s*\(\s*\.\.\.ts/);
  assert.match(inspectie,/numeriekBereik\(g\.tijden\)/);
  assert.match(doorrekening,/meldingTijdBereik\(M\)/);
});
