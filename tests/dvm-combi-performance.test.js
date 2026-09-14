import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCombiRulesIndexed,patchDoorrekenenSource,installDvmCombiPerformance} from '../site/core/dvm-combi-performance.js';

function clone(v){return structuredClone(v);}

function applyNaive(M,rules,cfg={}){
  let hits=0;
  rules.filter(c=>c.actief).forEach(c=>{
    const zelfde=c.type1===c.type2&&String(c.code1)===String(c.code2);
    for(let i=0;i<M.length;i++)for(let j=0;j<M.length;j++){
      if(i===j||(zelfde&&i>=j))continue;
      const a=M[i],b=M[j];
      if(a.weg!==b.weg||a.richting!==b.richting)continue;
      if(!(a.typeId===c.type1&&(!c.code1||a.code===String(c.code1))))continue;
      if(!(b.typeId===c.type2&&(!c.code2||b.code===String(c.code2))))continue;
      if(+c.maxKm>0&&(a.hm==null||b.hm==null||Math.abs(a.hm-b.hm)>+c.maxKm))continue;
      if(c.venMin!=null&&a.t&&b.t&&Math.abs(a.t-b.t)>c.venMin*60000)continue;
      const vA=a.avail,vP=a.perf;
      a.avail=Math.min(+c.capAvail,a.avail+ +c.extraAvail);
      a.perf=Math.min(+c.capPerf,a.perf+ +c.extraPerf);
      const model=(cfg&&cfg.impactModel)||'cap';
      a.zwaarteA=model==='stapel'?a.zwaarteA+(+c.extraAvail)/100:Math.min(1,a.avail/100);
      a.zwaarteP=model==='stapel'?a.zwaarteP+(+c.extraPerf)/100:Math.min(1,a.perf/100);
      a.trace.zwaarteA=a.zwaarteA;a.trace.zwaarteP=a.zwaarteP;
      a.combi=(a.combi||[]).concat(c.id);
      a.trace.combi.push({id:c.id,oms:c.oms,partner:b.weg+' '+b.richting+(b.hm!=null?(' hm '+b.hm):''),partnerCode:b.code,extraAvail:+c.extraAvail,extraPerf:+c.extraPerf,vaVoor:vA,vaNa:a.avail,vpVoor:vP,vpNa:a.perf});
      hits++;
    }
  });
  return hits;
}

const rules=[
  {id:'COMBO_001',actief:true,type1:'MSI',code1:'1003',type2:'LUS',code2:'1006',maxKm:.3,venMin:1440,capAvail:100,capPerf:100,extraAvail:10,extraPerf:5,oms:'MSI plus lus'},
  {id:'COMBO_002',actief:true,type1:'MSI',code1:'1003',type2:'MSI',code2:'1003',maxKm:.8,venMin:1440,capAvail:100,capPerf:100,extraAvail:7,extraPerf:3,oms:'MSI plus MSI'},
  {id:'COMBO_003',actief:true,type1:'CAM',code1:'',type2:'LUS',code2:'1006',maxKm:.5,venMin:1440,capAvail:100,capPerf:100,extraAvail:6,extraPerf:4,oms:'camera plus lus'}
];

function sample(seed=1,n=140){
  let s=seed>>>0;
  const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  return Array.from({length:n},()=>({
    weg:['A1','A2','A12'][Math.floor(rnd()*3)],
    richting:['RE','LI'][Math.floor(rnd()*2)],
    typeId:['MSI','LUS','CAM'][Math.floor(rnd()*3)],
    code:['1003','1006','4021'][Math.floor(rnd()*3)],
    hm:rnd()<.04?null:Math.round(rnd()*150)/10,
    t:rnd()<.04?null:1700000000000+Math.floor(rnd()*40)*86400000,
    avail:30,perf:20,zwaarteA:.3,zwaarteP:.2,trace:{combi:[]}
  }));
}

test('geïndexeerde combiregels geven exact dezelfde uitkomst als de oude dubbele lus',()=>{
  for(let seed=1;seed<=20;seed++){
    const basis=sample(seed),old=clone(basis),fast=clone(basis);
    const oldHits=applyNaive(old,rules,{impactModel:'cap'});
    const perf=applyCombiRulesIndexed(fast,rules,{impactModel:'cap'});
    assert.equal(perf.hits,oldHits,'hit count seed '+seed);
    assert.deepEqual(fast,old,'inhoud seed '+seed);
  }
});

test('grote historie beperkt kandidaatvergelijkingen sterk',()=>{
  const n=20000;
  const rows=Array.from({length:n},(_,i)=>({
    weg:'A'+(1+i%20),richting:i%2?'RE':'LI',
    typeId:i%3===0?'LUS':'MSI',code:i%3===0?'1006':'1003',
    hm:(i%500)/10,t:1700000000000+(i%365)*86400000,
    avail:30,perf:20,zwaarteA:.3,zwaarteP:.2,trace:{combi:[]}
  }));
  const perf=applyCombiRulesIndexed(rows,rules.slice(0,2),{impactModel:'cap'});
  assert.equal(perf.messages,n);
  assert.ok(perf.candidateChecks<n*50,`te veel kandidaten: ${perf.candidateChecks}`);
  assert.ok(perf.candidateChecks<n*n/1000,'kandidaatselectie moet ruim onder N² blijven');
});

test('runtime patch vervangt alleen stap 5 en behoudt de rest van doorrekenen',()=>{
  const source=`function doorrekenen(rijenRaw,opties){\n  const M=[];\n  // stap 5: combiregels\n  let combiHits=0;\n  RULES.combiRegels.filter(c=>c.actief).forEach(c=>{for(let i=0;i<M.length;i++)for(let j=0;j<M.length;j++){};});\n\n  // rapportageperiode uit de van/tot data\n  const periodeJr=1;\n  return {M,combiHits,periodeJr};\n}`;
  const patched=patchDoorrekenenSource(source);
  assert.ok(patched);
  assert.match(patched,/applyCombiRulesIndexed\(M,RULES\.combiRegels,RULES\.cfg\)/);
  assert.doesNotMatch(patched,/for\(let j=0;j<M\.length;j\+\+\)/);
  assert.match(patched,/const periodeJr=1/);
});

test('browserpatch doet niets in Node',()=>{
  assert.equal(installDvmCombiPerformance(globalThis),false);
});
