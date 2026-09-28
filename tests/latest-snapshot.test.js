import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {datumUitBestandsnaam,isOndersteundeMomentopname,momentopnameTijd,nieuwsteMomentopnameUitBestanden,nieuwsteMomentopnameUitMap,mapToestemming,schrijfBestandNaarMap} from '../site/core/latest-snapshot.js';

const file=(name,json,lastModified=0)=>({name,lastModified,text:async()=>typeof json==='string'?json:JSON.stringify(json)});

test('herkent alleen integrale en DVM-totaal-momentopnamen',()=>{
  assert.equal(isOndersteundeMomentopname({formaat:'BiDash-integraal'}),true);
  assert.equal(isOndersteundeMomentopname({formaat:'DVM-dienstimpact-totaal'}),true);
  assert.equal(isOndersteundeMomentopname({formaat:'BiDash-kwaliteitsaudit'}),false);
  assert.equal(isOndersteundeMomentopname([]),false);
});

test('bepaalt de datum eerst uit opgeslagen metadata en daarna uit bestandsnaam',()=>{
  const bron=file('dvm-dienstimpact-totaal_2026-09-24.json',{},123);
  assert.equal(datumUitBestandsnaam(bron.name),Date.parse('2026-09-24T00:00:00Z'));
  assert.equal(momentopnameTijd(bron,{opgeslagen:'2026-09-25T10:30:00Z'}),Date.parse('2026-09-25T10:30:00Z'));
  assert.equal(momentopnameTijd(file('zonder-datum.json',{},456),{}),456);
});

test('kiest de nieuwste geldige stand en slaat andere of kapotte JSON over',async()=>{
  const resultaat=await nieuwsteMomentopnameUitBestanden([
    file('bidash-kwaliteitsaudit_2026-09-28.json',{formaat:'BiDash-kwaliteitsaudit',opgeslagen:'2026-09-28T12:00:00Z'}),
    file('kapot_2026-09-29.json','{kapot'),
    file('dvm-dienstimpact-totaal_2026-09-24.json',{formaat:'DVM-dienstimpact-totaal',opgeslagen:'2026-09-24T08:00:00Z'}),
    file('bidash-integraal_2026-09-25.json',{formaat:'BiDash-integraal',opgeslagen:'2026-09-25T09:00:00Z'})
  ]);
  assert.equal(resultaat.file.name,'bidash-integraal_2026-09-25.json');
  assert.equal(resultaat.formaat,'BiDash-integraal');
  assert.equal(resultaat.gevonden,2);
  assert.equal(resultaat.onderzocht,4);
});

test('leest alleen JSON-bestanden uit de gekozen map',async()=>{
  const entries=[
    {kind:'file',name:'uitleg.txt',getFile:async()=>file('uitleg.txt','tekst')},
    {kind:'directory',name:'archief'},
    {kind:'file',name:'dvm-dienstimpact-totaal_2026-09-24.json',getFile:async()=>file('dvm-dienstimpact-totaal_2026-09-24.json',{formaat:'DVM-dienstimpact-totaal'})}
  ];
  const handle={async *values(){yield* entries;}};
  const resultaat=await nieuwsteMomentopnameUitMap(handle);
  assert.equal(resultaat.file.name,'dvm-dienstimpact-totaal_2026-09-24.json');
  assert.equal(resultaat.onderzocht,1);
});

test('vraagt maptoestemming alleen wanneer dat nodig en toegestaan is',async()=>{
  let requested=0,queryMode='',requestMode='';
  const handle={queryPermission:async options=>{queryMode=options.mode;return 'prompt';},requestPermission:async options=>{requested++;requestMode=options.mode;return 'granted';}};
  assert.equal(await mapToestemming(handle),'prompt');
  assert.equal(queryMode,'read');
  assert.equal(requested,0);
  assert.equal(await mapToestemming(handle,{vragen:true,mode:'readwrite'}),'granted');
  assert.equal(requested,1);
  assert.equal(requestMode,'readwrite');
});

test('schrijft een export transactioneel naar de gekoppelde map',async()=>{
  let written=null,closed=false;
  const writable={write:async blob=>{written=blob;},close:async()=>{closed=true;}};
  const handle={queryPermission:async()=> 'granted',getFileHandle:async(name,options)=>{
    assert.equal(name,'bidash-integraal_2026-09-28.json');
    assert.deepEqual(options,{create:true});
    return {createWritable:async()=>writable};
  }};
  const result=await schrijfBestandNaarMap(handle,{name:'bidash-integraal_2026-09-28.json',data:{formaat:'BiDash-integraal'}});
  assert.equal(await written.text(),'{"formaat":"BiDash-integraal"}');
  assert.equal(closed,true);
  assert.equal(result.bytes,30);
});

test('weigert een exportnaam die buiten de gekoppelde map kan schrijven',async()=>{
  await assert.rejects(()=>schrijfBestandNaarMap({getFileHandle(){throw Error('mag niet worden bereikt');}},{name:'../export.json',data:{}}),/Ongeldige bestandsnaam/);
});

test('Data en export bevat de knop en behoudt de lokale netwerkgrens',()=>{
  const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(html,/id="loadLatestSnapshot"[^>]*>Laad laatste stand<\/button>/);
  assert.match(html,/id="chooseLatestSnapshotFolder"/);
  assert.match(html,/connect-src 'none'/);
  assert.match(app,/showDirectoryPicker\(\{mode:'readwrite'/);
  assert.match(app,/schrijfExportOokNaarGekoppeldeMap\(data,name/);
});
