import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterConfigFromCard,liveDashboardCountModel,installLiveOverviewFilterSync} from '../site/core/live-overview-filter-sync.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function fakeCard(valuesByField){
  return {
    querySelectorAll(selector){
      const m=/data-field=\"([^\"]+)\"/.exec(selector);if(!m)return [];
      return (valuesByField[m[1]]||[]).map(x=>({checked:x.checked,dataset:{value:x.value}}));
    }
  };
}

test('kaartselectie wordt omgezet naar liveOverviewFilter zonder onzichtbare uitsluitingen te verliezen',()=>{
  const current={excluded:{gevolg:['OUDE-WAARDE'],assetType:['CAM']}};
  const card=fakeCard({
    gevolg:[{value:'HINDER',checked:true},{value:'GEEN BEELD',checked:false}],
    assetType:[{value:'MSI',checked:true},{value:'CAM',checked:true}]
  });
  const next=filterConfigFromCard(card,current);
  assert.deepEqual(next.excluded.gevolg,['GEEN BEELD','OUDE-WAARDE']);
  assert.deepEqual(next.excluded.assetType,[]);
});

test('dashboardmodel onderscheidt bronselectie en werkelijk doorgerekende meldingen',()=>{
  assert.deepEqual(liveDashboardCountModel({total:657,included:600,excluded:57,active:2},435),{
    total:657,included:600,excluded:57,processed:435,active:2
  });
});

test('syncmodule is inert buiten de browser',()=>{
  assert.equal(installLiveOverviewFilterSync(globalThis),false);
});

test('runtime gebruikt debounce en bestaande DVM filter-API om wijzigingen direct door te rekenen',()=>{
  const source=read('site/core/live-overview-filter-sync.js');
  const forecast=read('site/core/signal-forecast.js');
  assert.match(source,/setTimeout\(\(\)=>applyFromCard\(card\),350\)/);
  assert.match(source,/api\.set\(filterConfigFromCard\(card,api\.get\(\)\)\)/);
  assert.match(source,/doorgerekende meldingen/);
  assert.match(forecast,/installLiveOverviewFilterSync\(globalThis\)/);
});
