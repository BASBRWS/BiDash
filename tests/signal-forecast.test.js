import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateSignalForecast,normalizeForecastRules,buildForecastTriggers} from '../site/core/signal-forecast.js';

const assets=[
 {key:'a1',tp:'MSI',weg:'A4',richting:'RE',vc:'ZWN',hm:10,bouwjaar:2008,modelLevensduur:20,naam:'rijbaanbreed MSI 1'},
 {key:'a2',tp:'MSI',weg:'A4',richting:'RE',vc:'ZWN',hm:20,bouwjaar:2010,modelLevensduur:20,naam:'voor afrit MSI 2'},
 {key:'a3',tp:'MSI',weg:'A12',richting:'LI',vc:'ZWN',hm:30,bouwjaar:2012,modelLevensduur:20,naam:'MSI 3'}
];
const rules=normalizeForecastRules({referenceYear:2026,startYear:2026,endYear:2032,mcRuns:250,seed:7102026,permanentChancePct:75,degradeStartPct:20,ftePerReferenceKm:12,referenceKm:95,baseFte:300,fteCostYear:95000,triggerExtraFtePct:0,triggerAnnualCost:0,triggerPermanentPct:0});

test('forecast is deterministic for a fixed seed',async()=>{
 const a=await simulateSignalForecast(assets,rules),b=await simulateSignalForecast(assets,rules);
 assert.deepEqual(a.annual,b.annual);
});

test('reference year has zero incremental WIS',async()=>{
 const r=await simulateSignalForecast(assets,rules);
 const ref=r.annual.find(x=>x.year===2026);
 assert.equal(ref.extraFte,0);
 assert.equal(ref.annualCost,0);
 for(const road of r.roads)assert.equal(road.years.find(x=>x.year===2026).fte,0);
});

test('permanent outage is non-decreasing and cost follows FTE price',async()=>{
 const r=await simulateSignalForecast(assets,rules);
 for(let i=1;i<r.annual.length;i++)assert.ok(r.annual[i].permanent>=r.annual[i-1].permanent-1e-12);
 for(const y of r.annual)assert.equal(y.annualCost,y.extraFte*rules.fteCostYear);
});

test('forecast can feed trigger signals',async()=>{
 const r=await simulateSignalForecast(assets,rules);
 const t=buildForecastTriggers(r,rules);
 assert.ok(t.some(x=>x.id==='forecast-wis-fte'));
 assert.ok(t.some(x=>x.id==='forecast-wis-cost'));
 assert.ok(t.some(x=>x.id==='forecast-msi-permanent'));
});
