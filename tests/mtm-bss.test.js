import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';
function runtime(){const r=dvmRuntime();for(const file of ['dvm-storingsbundelaar.js','dvm-mtm-bss.js'])vm.runInContext(readFileSync(new URL('../site/engines/'+file,import.meta.url),'utf8'),r);return r;}
const pause=async()=>{},empty=()=>({open:[],historie:[],laatstePerVc:{},snapshotDekking:{}});
const line=(action,id,date='01-03-2026 12:00',unit=1,code='1003')=>`${action} BSS : BSS_ID= ${id}, ${code} Fatale fout bij MSI ${unit}\tA77 R 11,250\t${date}`;
const info=vc=>({vc,datum:new Date(2026,2,1)}),file=vc=>({name:'010326storinglijst.txt',webkitRelativePath:`mtm/${vc}/storinglijst/2026/03/01/010326storinglijst.txt`});
const read=(r,text,vc='mn')=>r.DVM_MTM_BSS.read(text,file(vc),info(vc),{pause});
const run=(r,base,inputs,extra={})=>r.DVM_MTM_BSS.process(base,inputs,{pause,...extra});

test('BSS-registratie en expliciet herstel leveren één gesloten incident, niet een snapshot',async()=>{
 const r=runtime(),input=await read(r,[line('Registreer','11'),line('Hef op','11','01-03-2026 12:05'),line('Registreer','12','01-03-2026 12:06',2)].join('\n'));
 assert.equal(input.kind,'bss');assert.equal(input.rows,3);
 const result=await run(r,empty(),[input]);assert.equal(result.open.length,1);assert.equal(result.open[0].event_id,'12');assert.equal(result.historie.length,2);
 const closed=result.historie.find(x=>x.event_id==='11');assert.equal(closed.levenscyclus_status,'HERSTELD_BEVESTIGD');assert.equal(closed.hersteld_op,new Date(2026,2,1,12,5).toISOString());assert.equal(closed.duur_uur,5/60);assert.equal(closed.tijdprecisie,'minuut');assert.equal(closed.duurBetrouwbaar,false);
 assert.equal(result.bssBronnen.mn.bronBalans,true);assert.equal(result.bssBronnen.mn.verantwoordeRijen,3);
 const repeat=await run(r,result,[input]);assert.equal(repeat.open.length,1);assert.equal(repeat.historie.length,2);
});
test('BSS_ID onderscheidt dezelfde minuut, foutcode, locatie en andere VC',async()=>{
 const r=runtime(),mn=await read(r,[line('Registreer','1'),line('Registreer','2'),line('Hef op','1','01-03-2026 12:01')].join('\n'));
 const nwn=await read(r,line('Registreer','1'),'nwn'),result=await run(r,empty(),[mn,nwn]);
 assert.equal(result.historie.length,3);assert.equal(result.open.length,2);assert.ok(result.open.some(x=>x.vc==='mn'&&x.event_id==='2'));assert.ok(result.open.some(x=>x.vc==='nwn'&&x.event_id==='1'));
});
test('een los herstel houdt een onbekende start, nul minuten blijft een echte bronwaarde',async()=>{
 const r=runtime(),input=await read(r,[line('Hef op','1'),line('Registreer','2'),line('Hef op','2')].join('\n'));
 const s=await run(r,empty(),[input]);assert.equal(s.open.length,0);assert.equal(s.historie.find(x=>x.event_id==='1').van,'');assert.equal(s.historie.find(x=>x.event_id==='1').duur_uur,null);assert.equal(s.historie.find(x=>x.event_id==='1').start_onbekend,true);assert.equal(s.historie.find(x=>x.event_id==='2').duur_uur,0);
});
test('herstel over dagen werkt na JSON-roundtrip en raakt geen andere code of MSI',async()=>{
 const r=runtime(),first=await read(r,[line('Registreer','1'),line('Registreer','2','01-03-2026 12:00',2)].join('\n'));
 let s=await run(r,empty(),[first]);s=JSON.parse(JSON.stringify(s));
 const wrong=await read(r,line('Hef op','1','02-03-2026 12:00',3));s=await run(r,s,[wrong]);assert.equal(s.open.length,2);
 const end=await read(r,line('Hef op','1','02-03-2026 12:01'));s=await run(r,s,[end]);assert.equal(s.open.length,1);assert.equal(s.open[0].event_id,'2');assert.equal(s.historie.find(x=>x.event_id==='1'&&x.MSI==='MSI 1').levenscyclus_status,'HERSTELD_BEVESTIGD');
});
test('oude gesloten BSS worden tijdens verwerking verwijderd, oude open blijven',async()=>{
 const r=runtime(),input=await read(r,[line('Registreer','1'),line('Hef op','1','01-03-2026 12:01'),line('Registreer','2')].join('\n'));
 const s=await run(r,empty(),[input],{historyCutoff:+new Date(2026,3,1)});assert.equal(s.historie.length,1);assert.equal(s.open.length,1);assert.equal(s.bssVerwijderd,1);assert.equal(s.open[0].event_id,'2');
});
test('bestaande tabel en BSS-log koppelen via ID en start tot één incident',async()=>{
 const r=runtime(),h=r.__BIDASH_STORINGSBUNDELAAR__;
 const snapshot=await read(r,'MTM storinglijst\n01-03-2026 12:01:00\n|11|1003|1003 Fatale fout bij MSI 1|A77 R 11,250|01-03-2026 12:00:00|');
 const bss=await read(r,[line('Registreer','11'),line('Hef op','11','01-03-2026 12:02')].join('\n'));
 const s=await run(r,empty(),[snapshot,bss]);assert.equal(s.open.length,0);assert.equal(s.historie.length,1);assert.equal(s.historie[0].levenscyclus_status,'HERSTELD_BEVESTIGD');
 const first=await run(r,empty(),[snapshot]);const second=await run(r,first,[bss]);assert.equal(second.open.length,0);assert.equal(second.historie.length,1);
});
test('een log zonder herstel maakt andere open meldingen niet gesloten',async()=>{
 const r=runtime(),one=await read(r,line('Registreer','1')),two=await read(r,line('Registreer','2','02-03-2026 12:00'));
 const s=await run(r,await run(r,empty(),[one]),[two]);assert.equal(s.open.length,2);assert.ok(s.open.every(x=>x.hersteld_op===null));
});
test('afwijkende BSS-regel en ongeldige klok blokkeren vóór toepassing',async()=>{
 const r=runtime();await assert.rejects(read(r,line('Registreer','1')+'\nkapotte regel'),/regel 2/);await assert.rejects(read(r,line('Registreer','1','01-03-2026 25:00')),/datum/);
});

test('expliciet BSS-herstel vervangt afgeleid herstel van dezelfde melding',async()=>{
 const r=runtime(),make=(hour,rows)=>read(r,`MTM storinglijst\n01-03-2026 ${hour}:00:00\n`+rows);
 const first=await make('12','|11|1003|1003 Fatale fout bij MSI 1|A77 R 11,250|01-03-2026 11:00:00|'),second=await make('13',''),third=await make('14','');
 let s=await run(r,empty(),[first,second,third]);assert.equal(s.historie[0].levenscyclus_status,'HERSTELD_AFGELEID');
 const proof=await read(r,line('Hef op','11','01-03-2026 12:30'));s=await run(r,s,[proof]);assert.equal(s.open.length,0);assert.equal(s.historie.length,1);assert.equal(s.historie[0].levenscyclus_status,'HERSTELD_BEVESTIGD');assert.equal(s.historie[0].hersteld_op,new Date(2026,2,1,12,30).toISOString());
});
test('een log zonder actuele tabel is geen bewijs van een volledige openstand',async()=>{
 const r=runtime(),s=await run(r,empty(),[await read(r,line('Registreer','1'))]);assert.equal(s.snapshotDekking.mn.structuurVolledig,true);assert.equal(s.snapshotDekking.mn.volledig,false);assert.equal(s.levenscyclusAudit.bronDekkingVolledig,false);
});

test('een groot daglog wordt volledig verwerkt zonder argumentlimiet of oude gesloten rijen',async()=>{
 const r=runtime(),lines=[];for(let i=1;i<=70000;i++){lines.push(line('Registreer',String(i)));lines.push(line('Hef op',String(i)));}
 const input=await read(r,lines.join('\n')),s=await run(r,empty(),[input],{historyCutoff:+new Date(2026,3,1)});
 assert.equal(input.rows,140000);assert.equal(s.bssBronnen.mn.verantwoordeRijen,140000);assert.equal(s.bssVerwijderd,70000);assert.equal(s.historie.length,0);assert.equal(s.open.length,0);
});
test('herstel dat een latere open waarneming tegenspreekt vervangt de stand niet',async()=>{
 const r=runtime(),input=await read(r,'MTM storinglijst\n01-03-2026 14:00:00\n|11|1003|1003 Fatale fout bij MSI 1|A77 R 11,250|01-03-2026 12:00:00|'),base=await run(r,empty(),[input]),before=JSON.stringify(base);
 const repair=await read(r,line('Hef op','11','01-03-2026 13:00'));await assert.rejects(run(r,base,[repair]),/latere open waarneming/);assert.equal(JSON.stringify(base),before);
});

test('herlezen van een oude registratie heft een later brongat niet op',async()=>{
 const r=runtime(),input=await read(r,line('Registreer','1'));
 let base=await run(r,empty(),[input]);base.open[0]={...base.open[0],levenscyclus_status:'ONBEKEND_DOOR_BRONGAT',_liveOpen:false,bron_peildatum:new Date(2026,2,2).toISOString()};base.historie=[base.open[0]];base.laatstePerVc.mn=+new Date(2026,2,2);
 const s=await run(r,base,[input]);assert.equal(s.open.length,1);assert.equal(s.open[0].levenscyclus_status,'ONBEKEND_DOOR_BRONGAT');assert.equal(s.open[0]._liveOpen,false);
});

test('een BSS-herstel voor een andere detector op dezelfde locatie sluit de eerste niet',async()=>{
 const r=runtime(),log='Registreer BSS : BSS_ID= 11, 1006 Beide lussen fout bij det.2\tA77 R 11,250\t01-03-2026 12:00\nHef op BSS : BSS_ID= 11, 1006 Beide lussen fout bij det.3\tA77 R 11,250\t01-03-2026 12:01';
 const s=await run(r,empty(),[await read(r,log)]);assert.equal(s.open.length,1);assert.match(s.open[0].melding,/det.2/);assert.equal(s.open[0].hersteld_op,null);
});

test('een nieuwe BSS-scan past de jaargrens ook op eerder bewaarde afgesloten historie toe',async()=>{
 const r=runtime(),first=await read(r,[line('Registreer','1'),line('Hef op','1','01-03-2026 12:01'),line('Registreer','2')].join('\n'));
 const base=await run(r,empty(),[first]);assert.equal(base.historie.length,2);
 const next=await run(r,base,[await read(r,line('Registreer','3','01-05-2026 12:00'))],{historyCutoff:+new Date(2026,3,1)});
 assert.equal(next.historie.length,2);assert.deepEqual(Array.from(next.open,x=>x.event_id).sort(),['2','3']);assert.equal(next.bssVerwijderd,1);
});
