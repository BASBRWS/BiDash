import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTable,normalizeRows,parseDelimited,makeDvmPartBundle,normHeader,recognizeFile} from '../site/core/universal-importer.js';

test('herkent assetregister op inhoud en afwijkende kolomnamen',()=>{
  const rows=[{'Asset ID':'a1','Asset naam':'MSI A12 1','Rijksweg':'A12','Hectometer':'12,3','Asset type':'MSI','Bouwjaar':2018,'Verkeerscentrale':'MN'}];
  const c=classifyTable(rows,{fileName:'areaal.xlsx'});
  assert.equal(c.part,'assetregister');
  const r=normalizeRows(rows,'assetregister')[0];
  assert.equal(r.entityid,'a1');
  assert.equal(r.asset,'MSI A12 1');
  assert.equal(r.wegnummer,'A12');
  assert.equal(r['hm-bord'],'12,3');
  assert.equal(r['ci-type'],'MSI');
});

test('herkent actuele storingen zonder vaste bestandsnaam',()=>{
  const rows=[{'Object service id':'A1 Li 6.685','Storingsmelding':'Fatale fout','Aantal dagen':12,'Gevolg':'geen beeld','Noodmaatregel':'zak','Startdatum':'2026-01-01','Einddatum':'2026-01-10','VC':'NWN'}];
  const c=classifyTable(rows,{fileName:'meldingen.xlsx'});
  assert.equal(c.part,'liveStoringen');
  const r=normalizeRows(rows,'liveStoringen')[0];
  assert.equal(r.os_id,'A1 Li 6.685');
  assert.equal(r.melding,'Fatale fout');
  assert.equal(r._liveOpen,true);
});

test('onderscheidt historie, werkzaamheden en U-routes',()=>{
  assert.equal(classifyTable([{incident_id:'x',locatie:'A1 L 29,860',weg:'A1',start:'2025-06-02'}],{fileName:'storingshistorie.csv'}).part,'storingshistorie');
  assert.equal(classifyTable([{'Werk ID':'w1','Weg':'A12','Start':'2026-01-01','Einde':'2026-01-02','Afsluiting':'ja','Omleiding':'U12','Extra reistijd min':10,'Werkzaamheden':'asfalt'}],{fileName:'bron.csv'}).part,'werkzaamheden');
  assert.equal(classifyTable([{Route_ID:'u1',U_route:'U16',OSM_relation_id:123,OSM_relation_URL:'https://example.invalid/123'}],{fileName:'routes.csv'}).part,'uRoutes');
});

test('CSV parser ondersteunt puntkomma en quoted velden',()=>{
  const csv='Weg;Start;Einde;Werkzaamheden\nA1;2026-01-01;2026-01-02;"Asfalt; voegovergang"\n';
  assert.deepEqual(parseDelimited(csv),[{Weg:'A1',Start:'2026-01-01',Einde:'2026-01-02',Werkzaamheden:'Asfalt; voegovergang'}]);
});

test('los herkend onderdeel wordt compatibele DVM deelimport',()=>{
  const b=makeDvmPartBundle('werkzaamheden',[{'Werk ID':'w1','Weg':'A12','Start':'2026-01-01','Einde':'2026-01-02','Werkzaamheden':'asfalt'}],{fileName:'werken.csv'});
  assert.equal(b.formaat,'DVM-dienstimpact-totaal');
  assert.equal(b.exportSelectie.werkzaamheden,true);
  assert.equal(b.exportSelectie.assetregister,false);
  assert.equal(b.werkzaamheden.rijen.length,1);
});

test('oude DVM totaalexport blijft ongewijzigd en direct bruikbaar',async()=>{
  const bron={formaat:'DVM-dienstimpact-totaal',versie:27,assetregister:{bestand:'assets.csv',rijen:[{entityid:'1',asset:'MSI 1'}]}};
  const file=new File([JSON.stringify(bron)],'dvm-dienstimpact-totaal_oud.json',{type:'application/json'});
  const r=await recognizeFile(file);
  assert.equal(r.kind,'known-json');
  assert.equal(r.passthrough,true);
  assert.equal(r.files[0],file);
});

test('header normalisatie is hoofdletter-, accent- en scheidingstekenongevoelig',()=>{
  assert.equal(normHeader('  Extra_reistijd-min  '),'extra reistijd min');
  assert.equal(normHeader('RÍJKSWEG'),'rijksweg');
});
