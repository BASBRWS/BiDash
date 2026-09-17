/* Het DVM-overzicht mag dezelfde verkeerscentrale niet opsplitsen op schrijfwijze.
   Deze test voert de verzonden normalisatie en overzichtsgroepering letterlijk uit. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dvm2=read('site/engines/dvm-2.js');
const dvm3=read('site/engines/dvm-3.js');

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

const ctx=vm.createContext({String,Array,Map,VC_MAP:{NWN:'NWN',WNN:'NWN',WNZ:'ZWN',ZWN:'ZWN',MN:'MN',NON:'NON',ZN:'ZN'}});
vm.runInContext(haalFunctie(dvm2,'normAssetVc'),ctx,{filename:'normAssetVc'});
vm.runInContext(haalFunctie(dvm3,'groepeerWegdelenPerVc'),ctx,{filename:'groepeerWegdelenPerVc'});
const groepeer=rows=>vm.runInContext('groepeerWegdelenPerVc',ctx)(rows);

test('ZWN, zwn, VC ZWN en WNZ worden één verkeerscentrale',()=>{
  const rows=[
    {id:1,vc:'ZWN'},
    {id:2,vc:'zwn'},
    {id:3,vc:' VC ZWN '},
    {id:4,vc:'WNZ'},
    {id:5,vc:'NWN'}
  ];
  const groepen=groepeer(rows);
  assert.deepEqual(JSON.parse(JSON.stringify(groepen.map(g=>[g.vc,g.wds.map(w=>w.id)]))),[
    ['ZWN',[1,2,3,4]],
    ['NWN',[5]]
  ]);
});

test('de overzichtsgrafiek en het wegdelenfilter gebruiken de canonieke groepering',()=>{
  assert.match(dvm3,/const vcRows=groepeerWegdelenPerVc\(STATE\.wegdelen\)/);
  assert.match(dvm3,/normAssetVc\(w\.vc\)===fVc/);
  assert.doesNotMatch(dvm3,/new Set\(STATE\.wegdelen\.map\(w=>w\.vc\)\)/);
});
