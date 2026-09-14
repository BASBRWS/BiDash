import test from 'node:test';
import assert from 'node:assert/strict';
import {dvmAssetMatchMemoKey,installDvmAnalysisRebuildPerformance} from '../site/core/dvm-analysis-rebuild-performance.js';

function basisScope(extra={}){
  return {
    koppelMeldingAanAsset(){return {asset:null,status:'niet-gekoppeld'};},
    zetImportVoortgang(){},
    koppelDripHistorieAanAreaal(){},
    herberekenRegisterDekking(){},
    inspecteerStoringsRijen(){return {herkenbaar:1};},
    gecombineerdeStoringsRijen(){return [];},
    herbouwAssetMatchBeeld(){},
    probeerAnalyseActiveren(){},
    async totaalImportJson(){},
    ...extra
  };
}

test('memo-key verandert bij relevante assetlocatievelden',()=>{
  const a={osid:'A12 RE 10.200',weg:'A12',richting:'RE',hm:10.2,strook:'1',vc:'MN'};
  const b={...a,hm:10.3};
  assert.notEqual(dvmAssetMatchMemoKey(a,'MSI'),dvmAssetMatchMemoKey(b,'MSI'));
  assert.equal(dvmAssetMatchMemoKey(a,'MSI'),dvmAssetMatchMemoKey({...a},'MSI'));
});

test('totaalimport hergebruikt identieke assetmatches en voorkomt dubbele matchbeeldopbouw vanuit DRIP-historie',async()=>{
  let matchCalls=0,dripOptions=null;
  const scope=basisScope({
    koppelMeldingAanAsset(m,typeId){matchCalls++;return {asset:{key:typeId+'|'+m.weg+'|'+m.hm},status:'gekoppeld',suggesties:[]};},
    koppelDripHistorieAanAreaal(options){dripOptions=options||{};return 'ok';}
  });
  scope.totaalImportJson=async function(){
    scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{direct:true});
    const row={osid:'A12 RE 10.200',weg:'A12',richting:'RE',hm:10.2,strook:'1',vc:'MN'};
    for(let i=0;i<200;i++)scope.koppelMeldingAanAsset({...row},'MSI');
    scope.koppelDripHistorieAanAreaal({bron:'test'});
    return 'klaar';
  };
  assert.equal(installDvmAnalysisRebuildPerformance(scope),true);
  assert.equal(await scope.totaalImportJson(),'klaar');
  assert.equal(matchCalls,1);
  assert.equal(dripOptions.bron,'test');
  assert.equal(dripOptions.slaMatchBeeldOver,true);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.hits,199);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.misses,1);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.cacheEntries,1);
});

test('memoisatie is alleen actief tijdens de analysebeeldfase van totaalimport',async()=>{
  let matchCalls=0;
  const scope=basisScope({
    koppelMeldingAanAsset(){matchCalls++;return {asset:null,status:'niet-gekoppeld'};}
  });
  scope.totaalImportJson=async function(){
    const row={weg:'A1',hm:1.2};
    scope.koppelMeldingAanAsset(row,'MSI');
    scope.koppelMeldingAanAsset(row,'MSI');
    scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{});
    scope.koppelMeldingAanAsset(row,'MSI');
    scope.koppelMeldingAanAsset(row,'MSI');
  };
  installDvmAnalysisRebuildPerformance(scope);
  await scope.totaalImportJson();
  assert.equal(matchCalls,3);
  scope.koppelMeldingAanAsset({weg:'A1',hm:1.2},'MSI');
  assert.equal(matchCalls,4);
});

test('herhaalde 92-procentmelding wist de matchcache niet opnieuw',async()=>{
  let matchCalls=0;
  const scope=basisScope({
    koppelMeldingAanAsset(){matchCalls++;return {asset:{key:'A1'},status:'gekoppeld'};}
  });
  scope.totaalImportJson=async function(){
    const row={weg:'A1',richting:'RE',hm:12.3,strook:'1',vc:'MN'};
    scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{});
    scope.koppelMeldingAanAsset(row,'MSI');
    scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{});
    scope.koppelMeldingAanAsset({...row},'MSI');
  };
  installDvmAnalysisRebuildPerformance(scope);
  await scope.totaalImportJson();
  assert.equal(matchCalls,1);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.hits,1);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.misses,1);
});

test('dektabel wordt niet dubbel opgebouwd als assetregister in dezelfde totaalimport al is opgebouwd',async()=>{
  let coverageCalls=0,evalCalls=0;
  const scope=basisScope({
    eval(){evalCalls++;},
    herberekenRegisterDekking(){coverageCalls++;}
  });
  scope.totaalImportJson=async function(){
    scope.zetImportVoortgang('totaal.json',20,'Assetregister opbouwen',{});
    scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{});
    scope.herberekenRegisterDekking();
  };
  installDvmAnalysisRebuildPerformance(scope);
  await scope.totaalImportJson();
  assert.equal(coverageCalls,0);
  assert.equal(evalCalls,1);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.coverageSkips,1);
});

test('lege historische inspectie wordt niet nogmaals door de matchbeeldpass gehaald',async()=>{
  let rowsSeen=-1;
  const historyRows=Array.from({length:500},(_,i)=>({locatie:'A1 '+i}));
  const scope=basisScope({
    inspecteerStoringsRijen(){return {herkenbaar:0};},
    gecombineerdeStoringsRijen(){return historyRows;},
    herbouwAssetMatchBeeld(){rowsSeen=scope.gecombineerdeStoringsRijen().length;}
  });
  scope.totaalImportJson=async function(){
    scope.zetImportVoortgang('totaal.json',92,'Koppelingen en analysebeeld herbouwen',{});
    scope.inspecteerStoringsRijen(historyRows);
    scope.herbouwAssetMatchBeeld();
  };
  installDvmAnalysisRebuildPerformance(scope);
  await scope.totaalImportJson();
  assert.equal(rowsSeen,0);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.historyRecognizable,0);
  assert.equal(scope.__BIDASH_LAST_REBUILD_PERF__.historyPassSkipped,true);
});
