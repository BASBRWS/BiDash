import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const scope=vm.createContext({});vm.runInContext(read('site/engines/planning-analysis.js'),scope);
const api=scope.PlanningAnalysis;
const plain=value=>JSON.parse(JSON.stringify(value));

// Onafhankelijke referentie: de eerdere volledige scan per taak/meetmoment en
// de eerdere afzonderlijke VWM-reductie per rol. Geen operationele gegevens.
function reference(input){
  const buckets=[];
  for(let t=input.t0;t<=input.t1+0.001;t+=1/52.1775){const b={t};input.services.forEach(d=>b[d]=0);buckets.push(b);}
  for(const task of input.tasks)for(const b of buckets){
    if(b.t>=task.start-0.001&&b.t<task.finish-0.001)for(const a of task.allocations)if(a.fte>0)b[a.service]=(b[a.service]||0)+a.fte;
  }
  for(const b of buckets)b.VWM=input.roles.reduce((sum,role)=>sum+input.vwm.reduce((total,task)=>total+((b.t>=task.start-0.0001&&b.t<task.finish-0.0001)?(task.rates[role]||0):0),0),0);
  return {buckets,t0:input.t0,t1:input.t1};
}
test('de gerichte berekening levert exact dezelfde weekwaarden als de volledige scan',()=>{
  const services=['GPO','CIV','VWM','PPO','Regio'],roles=['IBP','AM','Operatie'];
  const tasks=[],vwm=[];
  for(let i=0;i<300;i++){
    const start=2029+(i%83)/18,finish=start+(i%9)/52.1775;
    tasks.push({start,finish,allocations:[{service:services[i%5],fte:(i%7)/10},{service:'CIV',fte:i%2?0:-1}]});
    vwm.push({start,finish,rates:{IBP:(i%11)/10,AM:i%4===0?-0.25:0.5,Operatie:0}});
  }
  const input={t0:2030,t1:2034,services,roles,tasks,vwm},actual=plain(api.weekly(input));
  assert.deepEqual({buckets:actual.buckets,t0:actual.t0,t1:actual.t1},reference(input));
  for(let i=0;i<actual.buckets.length;i++)assert.equal(roles.reduce((sum,role)=>sum+actual.vwmRoles[role][i],0),actual.buckets[i].VWM);
});
test('start en einde behouden de verschillende generieke en VWM-toleranties',()=>{
  const t=2030,input={t0:t,t1:t+1,services:['CIV','VWM'],roles:['IBP'],tasks:[{start:t+0.0005,finish:t+0.03,allocations:[{service:'CIV',fte:2}]}],vwm:[{start:t+0.0005,finish:t+0.03,rates:{IBP:3}}]};
  const actual=plain(api.weekly(input));assert.equal(actual.buckets[0].CIV,2);assert.equal(actual.buckets[0].VWM,0);
  assert.deepEqual({buckets:actual.buckets,t0:actual.t0,t1:actual.t1},reference(input));
});
test('lege toewijzingen en activiteiten buiten het bereik leveren geen inzet op',()=>{
  const input={t0:2030,t1:2031,services:['CIV','VWM'],roles:['IBP'],tasks:[{start:2025,finish:2026,allocations:[{service:'CIV',fte:8}]},{start:2030,finish:2031,allocations:[]}],vwm:[]};
  assert(plain(api.weekly(input)).buckets.every(b=>b.CIV===0&&b.VWM===0));
});
test('de bucketselectie bewaart begin inclusief en einde exclusief',()=>{
  const buckets=[0,1,2,3,4].map(t=>({t}));
  assert.deepEqual(plain(api.range(buckets,1,3)),[1,3]);
  assert.deepEqual(plain(api.range(buckets,-Infinity,Infinity)),[0,5]);
  assert.deepEqual(plain(api.range(buckets,NaN,3)),[0,0]);
  assert.deepEqual(plain(api.range(buckets,3,3)),[0,0]);
});

test('de BI-controle slaat ongewijzigde invoer over en herkent bron, scenario en regels',()=>{
  const source=read('site/engines/bi-1.js'),start=source.indexOf('let IPL_WATCH_MODEL='),end=source.indexOf('/* wijzigingen in het iframe',start);
  const state={shift:0,mshift:{},mapping:{},config:{fte:{}}},frame={IPL_MODEL:{},IPL_RAW_FILENAME:'test.xml',app_collectState:()=>({ipl:state})};
  const db={vwmFte:{},cap:{},vwmRolCap:{},civFormatie:{},capgrens:{},p6Capaciteit:null},context=vm.createContext({DB:db,iplWin:()=>frame});
  vm.runInContext(source.slice(start,end),context);
  const changed=()=>vm.runInContext('ipl_bridgeInvoerGewijzigd()',context);
  assert.equal(changed(),true);assert.equal(changed(),false);
  state.mshift.a=1;assert.equal(changed(),true);assert.equal(changed(),false);
  state.mapping.a='CIV';assert.equal(changed(),true);
  state.config.fte.a=[{dienst:'CIV',fte:2}];assert.equal(changed(),true);
  db.capgrens.CIV=3;assert.equal(changed(),true);
  db.vwmFte.fase={IBP:0.5};assert.equal(changed(),true);
  db.p6Capaciteit={perActiviteit:{}};assert.equal(changed(),true);assert.equal(changed(),false);
  frame.IPL_MODEL={};assert.equal(changed(),true);
  frame.IPL_RAW_FILENAME='ander.xml';assert.equal(changed(),true);
});
