import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const dvm2=readFileSync(new URL('../site/engines/dvm-2.js',import.meta.url),'utf8');
const dvm3=readFileSync(new URL('../site/engines/dvm-3.js',import.meta.url),'utf8');

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

test('DVM bevat geen call-stackgevoelige Math spread of push spread meer',()=>{
  const risk=/Math\.(?:min|max)\s*\([^\n)]*\.\.\.|\.push\s*\(\s*\.\.\./g;
  assert.deepEqual(dvm2.match(risk)||[],[]);
  assert.deepEqual(dvm3.match(risk)||[],[]);
});

test('stackveilige helpers verwerken 300.000 waarden',()=>{
  const scope={Number,Infinity};
  vm.createContext(scope);
  for(const naam of ['minGetal','maxGetal','voegArrayToe'])vm.runInContext(haalFunctie(dvm2,naam),scope);
  const waarden=Array.from({length:300000},(_,i)=>i-150000);
  assert.equal(scope.minGetal(waarden),-150000);
  assert.equal(scope.maxGetal(waarden),149999);
  const doel=[];scope.voegArrayToe(doel,waarden);
  assert.equal(doel.length,300000);
  assert.equal(doel[0],-150000);
  assert.equal(doel.at(-1),149999);
});
