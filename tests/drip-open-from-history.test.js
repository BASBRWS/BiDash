import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRIP_OPEN_VIRTUAL_KEY,isOpenDripIncident,dripOpenRow,deriveOpenDripRows,deriveOpenDripFaults,installDripOpenFromHistory} from '../site/core/drip-open-from-history.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('alleen censored DRIP-incident aan het actuele broneinde wordt als open beschouwd',()=>{
  assert.equal(isOpenDripIncident({censored:true,einde:123,duurUren:2},123),true);
  assert.equal(isOpenDripIncident({censored:true,einde:123,duurUren:2},123+2*86400e3),false);
  assert.equal(isOpenDripIncident({censored:false,einde:123,duurUren:2}),false);
});

test('expliciet open technische toestand en ontbrekende eindduur tellen als open',()=>{
  assert.equal(isOpenDripIncident({technischeToestand:'Openstaand'}),true);
  assert.equal(isOpenDripIncident({einde:null,duurUren:null}),true);
  assert.equal(isOpenDripIncident({einde:null,duurUren:4}),false);
});

test('open DRIP-rij wordt herkenbaar voor de live DVM-keten',()=>{
  const row=dripOpenRow({code:'DRIP-123',locatie:'A12 RE 44.2',weg:'A12',richting:'RE',hm:44.2,start:Date.UTC(2026,8,15,8),alarmmeldingen:'Paneel uit',sourceName:'drip.xlsx'});
  assert.match(row.os_id,/DRIP/i);
  assert.match(row.melding,/DRIP openstaand/i);
  assert.equal(row.status,'open');
  assert.equal(row.wegnummer,'A12');
  assert.equal(row.richting,'RE');
  assert.equal(row.hm,44.2);
  assert.equal(row.source_name,'drip.xlsx');
});

test('alleen open incidenten worden afgeleid en dubbele incidenten worden ontdubbeld',()=>{
  const basis={code:'D1',weg:'A1',hm:10,start:Date.UTC(2026,8,14),einde:Date.UTC(2026,8,15),duurUren:24,censored:true,sourceKey:'bron-a'};
  const rows=deriveOpenDripRows([basis,{...basis},{code:'D2',weg:'A2',hm:20,start:Date.UTC(2026,7,1),einde:Date.UTC(2026,7,2),duurUren:24,censored:true,sourceKey:'bron-a'}]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].drip_code,'D1');
});

test('publieke open-storingenlijst krijgt DRIP-bron en assetkoppeling zonder verzonnen impact',()=>{
  const faults=deriveOpenDripFaults([{code:'D1',asset:'DRIP D1',weg:'A1',richting:'RE',hm:10,start:1000,technischeToestand:'openstaand',matchAssetKey:'DRIP:D1',sourceName:'drip.xlsx',alarmmeldingen:'Geen beeld'}]);
  assert.equal(faults.length,1);
  assert.equal(faults[0].assetKey,'DRIP:D1');
  assert.equal(faults[0].typeId,'DRIP');
  assert.equal(faults[0].bron,'DRIP-historie');
  assert.equal(faults[0].impact,null);
  assert.match(faults[0].omschrijving,/drip\.xlsx/i);
});

test('runtimepatch gebruikt een virtuele live bron en vult HUB.faults aan',()=>{
  const source=read('site/core/drip-open-from-history.js');
  const forecast=read('site/core/signal-forecast.js');
  const dvm=read('site/engines/dvm-2.js');
  assert.match(source,new RegExp(DRIP_OPEN_VIRTUAL_KEY));
  assert.match(source,/LIVE_STORINGSBRONNEN=zonder/);
  assert.match(source,/afgeleidVan:'dripHistorie'/);
  assert.match(source,/hub\.faults=function/);
  assert.match(source,/probeerAnalyseActiveren\('drips'\)/);
  assert.match(source,/probeerAnalyseActiveren\('overzicht'\)/);
  assert.match(source,/LIVE_STORINGS_INSPECTIE=.*inspecteerStoringsRijen/);
  assert.match(dvm,/actuele selectie afgeleid uit DRIP-historie/);
  assert.match(dvm,/bron\.bronNamen/);
  assert.match(forecast,/installDripOpenFromHistory\(globalThis\)/);
});

test('browserpatch doet niets buiten browser',()=>{
  assert.equal(installDripOpenFromHistory(globalThis),false);
});
