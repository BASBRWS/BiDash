import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyQuery,matchesRule} from '../site/core/query-filter.js';

const fields=[{key:'naam'},{key:'assetFaultCodes'},{key:'impact',type:'number'}];
const rows=[
  {naam:'Portaal A',assetFaultCodes:['1001','1003'],impact:60},
  {naam:'Portaal B',assetFaultCodes:['1001'],impact:20},
  {naam:'DRIP C',assetFaultCodes:['D9'],impact:null}
];

test('EN-query vindt een asset waarop foutcode 1001 en 1003 samen voorkomen',()=>{
  const query={mode:'all',rules:[
    {field:'assetFaultCodes',operator:'equals',value:'1001'},
    {field:'assetFaultCodes',operator:'equals',value:'1003'}
  ]};
  assert.deepEqual(applyQuery(rows,query,fields).map(row=>row.naam),['Portaal A']);
});

test('OF-query accepteert minstens één foutcode',()=>{
  const query={mode:'any',rules:[
    {field:'assetFaultCodes',operator:'contains',value:'1003'},
    {field:'assetFaultCodes',operator:'contains',value:'D9'}
  ]};
  assert.deepEqual(applyQuery(rows,query,fields).map(row=>row.naam),['Portaal A','DRIP C']);
});

test('tekstvergelijking is hoofdletter en accent ongevoelig',()=>{
  assert.equal(matchesRule({naam:'Cámera Noord'},{field:'naam',operator:'contains',value:'camera'},fields),true);
});

test('numerieke operatoren vergelijken als getallen',()=>{
  assert.deepEqual(applyQuery(rows,{mode:'all',rules:[{field:'impact',operator:'greaterEqual',value:'50'}]},fields).map(row=>row.naam),['Portaal A']);
});

test('SQL-achtige query combineert meerdere kolommen en geeft EN voorrang op OF',()=>{
  const query={rules:[
    {field:'naam',operator:'contains',value:'portaal'},
    {join:'and',field:'impact',operator:'greaterEqual',value:'50'},
    {join:'or',field:'naam',operator:'equals',value:'DRIP C'}
  ]};
  assert.deepEqual(applyQuery(rows,query,fields).map(row=>row.naam),['Portaal A','DRIP C']);
});

test('querybouwers staan op beide assetmanagementtabbladen',()=>{
  const html=new URL('../site/index.html',import.meta.url);
  const source=readFileSync(html,'utf8');
  assert.match(source,/id="assetQueryBuilder"/);
  assert.match(source,/id="faultQueryBuilder"/);
  assert.match(source,/Queryfilter bouwen/);
});
