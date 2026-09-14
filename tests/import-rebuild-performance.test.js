import test from 'node:test';
import assert from 'node:assert/strict';
import {dvmAssetMatchMemoKey,installDvmAnalysisRebuildPerformance} from '../site/core/dvm-analysis-rebuild-performance.js';

test('memo-key verandert bij relevante assetlocatievelden',()=>{
  const a={osid:'A12 RE 10.200',weg:'A12',richting:'RE',hm:10.2,strook:'1',vc:'MN'};
  const b={...a,hm:10.3};
  assert.notEqual(dvmAssetMatchMemoKey(a,'MSI'),dvmAssetMatchMemoKey(b,'MSI'));
  assert.equal(dvmAssetMatchMemoKey(a,'MSI'),dvmAssetMatchMemoKey({...a},'MSI'));
});

test('totaalimport hergebruikt identieke assetmatches en voorkomt dubbele matchbeeldopbouw vanuit DRIP-historie',async()=>{
  let matchCalls=0,dripOptions=null;
  const scope={
    koppelMeldingAanAsset(m,typeId){matchCalls++;return {asset:{key:typeId+'|'+m.weg+'|'+m.hm},status:'gekoppeld',suggesties:[]};},
    zetImportVoortgang(){},
    koppelDripHistorieAanAreaal(options){dripOptions=options||{};return 'ok';},
    async totaalImportJson(){
      scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{direct:true});
      const row={osid:'A12 RE 10.200',weg:'A12',richting:'RE',hm:10.2,strook:'1',vc:'MN'};
      for(let i=0;i<200;i++)scope.koppelMeldingAanAsset({...row},'MSI');
      scope.koppelDripHistorieAanAreaal({bron:'test'});
      return 'klaar';
    }
  };
  assert.equal(installDvmAnalysisRebuildPerformance(scope),true);
  assert.equal(await scope.totaalImportJson(),'klaar');
  assert.equal(matchCalls,1);
  assert.equal(dripOptions.bron,'test');
  assert.equal(dripOptions.slaMatchBeeldOver,true);
  assert.deepEqual(scope.__BIDASH_LAST_REBUILD_PERF__,{hits:199,misses:1,cacheEntries:1});
});

test('memoisatie is alleen actief tijdens de analysebeeldfase van totaalimport',async()=>{
  let matchCalls=0;
  const scope={
    koppelMeldingAanAsset(){matchCalls++;return {asset:null,status:'niet-gekoppeld'};},
    zetImportVoortgang(){},
    koppelDripHistorieAanAreaal(){},
    async totaalImportJson(){
      const row={weg:'A1',hm:1.2};
      scope.koppelMeldingAanAsset(row,'MSI');
      scope.koppelMeldingAanAsset(row,'MSI');
      scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{});
      scope.koppelMeldingAanAsset(row,'MSI');
      scope.koppelMeldingAanAsset(row,'MSI');
    }
  };
  installDvmAnalysisRebuildPerformance(scope);
  await scope.totaalImportJson();
  assert.equal(matchCalls,3);
  scope.koppelMeldingAanAsset({weg:'A1',hm:1.2},'MSI');
  assert.equal(matchCalls,4);
});
