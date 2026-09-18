import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../site/engines/dvm-fault-rule-manager.js',import.meta.url),'utf8');

function load(){
  const context={
    RULES:{cfg:{},assetTypen:[{id:'DRIP',actief:true,functie:'paneel'}],foutcodes:[{code:'D9',actief:true,patroon:'langdurig',assetType:'DRIP',severity:'hoog',availPct:80,perfPct:90,oms:'Langdurige uitval'}]},
    STATE:{nietDoorgerekend:[{eventId:'m1',typeId:'DRIP',melding:'led status fout',rekenStatus:'Passende foutregel ontbreekt',weg:'A1'},{eventId:'m2',typeId:'DRIP',rekenStatus:'Assetkoppeling heeft een locatieconflict',assetMatchStatus:'locatieconflict'}]},
    foutregel:()=>null,renderRegels:()=>{},toonRuleSubtab:()=>{},parametersToepassen:()=>{},ASSET_CFG_UI:{subtab:'regels'},
    document:{querySelectorAll:()=>[],getElementById:()=>null},alert:()=>{},confirm:()=>true,Date,encodeURIComponent,decodeURIComponent,console
  };
  context.window=context;context.HUB={open:async()=>{}};
  vm.runInNewContext(source,context);
  return context;
}

test('zelfgemaakte foutcode kan worden gemaakt en expliciet toegewezen',()=>{
  const context=load(),api=context.BIDASH_FAULT_RULES;
  const rule=api.createRule({code:'D10',patroon:'led status',assetType:'DRIP',severity:'middel',availPct:25,perfPct:40,oms:'LED-status gedeeltelijk gestoord'});
  assert.equal(rule.userMade,true);
  assert.equal(api.assign(['m1'],'D10'),1);
  assert.equal(context.RULES.cfg.foutToewijzingen.m1.code,'D10');
  assert.equal(context.foutregel(context.STATE.nietDoorgerekend[0],'DRIP').code,'D10');
});

test('locatieconflict kan niet met een foutcode worden omzeild',()=>{
  const context=load(),api=context.BIDASH_FAULT_RULES;
  assert.equal(api.isAssignable(context.STATE.nietDoorgerekend[1]),false);
  assert.throws(()=>api.assign(['m2'],'D9'),/Geen geselecteerde melding/);
});

test('foutcode vereist expliciete geldige impactpercentages',()=>{
  const {BIDASH_FAULT_RULES:api}=load();
  assert.throws(()=>api.createRule({code:'D11',patroon:'x',assetType:'DRIP',severity:'hoog',availPct:'',perfPct:20,oms:'reden'}),/Beschikbaarheidsimpact/);
  assert.throws(()=>api.createRule({code:'D11',patroon:'x',assetType:'DRIP',severity:'hoog',availPct:101,perfPct:20,oms:'reden'}),/Beschikbaarheidsimpact/);
});

test('manager wordt na de publieke DVM-adapter geladen',()=>{
  const adapter=readFileSync(new URL('../site/engines/dvm-adapter.js',import.meta.url),'utf8');
  assert.ok(adapter.indexOf('dvm-fault-rule-manager.js')>adapter.indexOf('dvm-adapter-original.js'));
});
