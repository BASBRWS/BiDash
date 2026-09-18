/* Borgt de volledige naamketen van brondata naar dienstverlening:
   lus/detectie/detector/inductielus -> intern LUS -> Detectielus -> detectie. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dvm1=read('site/engines/dvm-1.js');
const dvm2=read('site/engines/dvm-2.js');
const dvm3=read('site/engines/dvm-3.js');
const openView=read('site/core/open-fault-view.js');

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

const ctx=vm.createContext({String,RegExp,isDripRij:()=>false});
vm.runInContext(haalFunctie(dvm2,'canoniekAssetType'),ctx);
vm.runInContext(haalFunctie(dvm3,'registerAssetType'),ctx);
vm.runInContext(haalFunctie(dvm3,'dienstSchakelsVoorAsset'),ctx);
const call=(naam,...args)=>vm.runInContext(naam,ctx)(...args);
const g=(row,keys)=>{for(const k of keys)if(row[k]!=null)return row[k];return '';};

test('bronvarianten worden één technisch type LUS',()=>{
  for(const waarde of ['LUS','lussen','detectie','detector','detectielus','meetlus','inductielus']){
    assert.equal(call('canoniekAssetType',waarde),'LUS',waarde);
  }
});

test('Inductielus in All Assets wordt als Detectielus herkend',()=>{
  const rij={'type':'Inductielus','ci-type':'VKS detectoren','nen-bouwdeel':'Detectielus','asset':'ZWN VKS lus A4R 27,000'};
  assert.equal(call('registerAssetType',rij,g),'LUS');
});

test('LUS voedt detectie binnen dienstverlening en heet zichtbaar Detectielus',()=>{
  assert.deepEqual(Array.from(call('dienstSchakelsVoorAsset',{tp:'LUS'})),['detectie']);
  assert.match(dvm1,/detectie:'LUS'/);
  assert.match(openView,/\['LUS','Detectielus'\]/);
  assert.match(dvm3,/m\.typeId==='LUS'\?'Detectielus':m\.typeId/);
});
