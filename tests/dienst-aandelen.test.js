/* Bewaakt dat de subprocesaandelen gesloten zijn voordat er wordt doorgerekend.
   Zonder normalisatie weegt v68Dienst met lege gewichten en levert de
   dienstverlening een betekenisloze band 0,00-0,00% op het overzicht en in de
   hub-samenvatting. De test laadt de echte engine-bestanden; hij controleert
   gedrag, niet de aanwezigheid van een regel broncode. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const lees=pad=>readFileSync(new URL('../'+pad,import.meta.url),'utf8');

/* dvm-1.js draait in een kale context: de DOM-aanroepen op het hoogste niveau
   staan in try/catch, dus de regeldefinities laden ook zonder browser. */
function laadRegels(){
  const ctx=vm.createContext({console,JSON,Math,Number,String,Object,Array,Date,isNaN,parseFloat,parseInt});
  vm.runInContext(lees('site/engines/dvm-1.js'),ctx,{filename:'dvm-1.js'});
  // const-declaraties blijven lexicaal; haal ze uit dezelfde scope op.
  return vm.runInContext('({DIENSTEN,SUBPROCESSEN})',ctx);
}

/* Haalt één functie letterlijk uit een bronbestand, zodat de test de verzonden
   implementatie uitvoert en geen nagebouwde variant. */
function haalFunctie(bron,naam){
  const start=bron.indexOf('function '+naam+'(');
  assert.notEqual(start,-1,'functie '+naam+' niet gevonden');
  let diepte=0,i=bron.indexOf('{',start);
  for(let j=i;j<bron.length;j++){
    if(bron[j]==='{')diepte++;
    else if(bron[j]==='}'&&--diepte===0)return bron.slice(start,j+1);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}

test('subprocesaandelen zijn gesloten zodra de regels geladen zijn',()=>{
  const ctx=laadRegels();
  for(const dienst of ctx.DIENSTEN){
    const subs=ctx.SUBPROCESSEN[dienst.id]||[];
    assert.ok(subs.length>0,'dienst '+dienst.id+' heeft subprocessen');
    for(const sp of subs){
      assert.equal(typeof sp.gewicht,'number','aandeel van "'+sp.naam+'" is ingevuld');
      assert.ok(sp.gewicht>0,'aandeel van "'+sp.naam+'" is groter dan nul');
    }
    const som=subs.reduce((s,sp)=>s+sp.gewicht,0);
    assert.ok(Math.abs(som-1)<1e-9,'aandelen van '+dienst.id+' tellen op tot 1, nu '+som);
  }
});

test('afhankelijkheden binnen een subproces blijven ongemoeid',()=>{
  const ctx=laadRegels();
  // Normalisatie mag alleen de dienstaandelen sluiten, niet de assetgewichten.
  const im=ctx.SUBPROCESSEN.im.find(sp=>/signalering/i.test(sp.naam)||sp.afh?.signalering!=null);
  assert.ok(im,'incidentmanagement heeft een subproces met signaleringsafhankelijkheid');
  const som=Object.values(im.afh).reduce((a,b)=>a+Number(b),0);
  assert.ok(Math.abs(som-1)<1e-9,'afh binnen een subproces telt op tot 1, nu '+som);
});

test('v68Dienst weegt een nog niet genormaliseerd aandeel als 1',()=>{
  const bron=lees('site/engines/dvm-2.js');
  const ctx=vm.createContext({Math,Number,Object,console});
  // Vier subprocessen zonder gewicht; alleen het tweede leunt op een bekende bron.
  ctx.SUBPROCESSEN={vm:[{naam:'a'},{naam:'b'},{naam:'c'},{naam:'d'}]};
  ctx.v68Subproces=sp=>sp.naam==='b'
    ? {naam:sp.naam,loB:60,hiB:60,loP:60,hiP:60,bekend:1,exact:true,bronnen:[]}
    : {naam:sp.naam,loB:100,hiB:100,loP:100,hiP:100,bekend:1,exact:true,bronnen:[]};
  vm.runInContext(haalFunctie(bron,'v68Dienst'),ctx,{filename:'v68Dienst'});

  const r=ctx.v68Dienst({id:'vm',naam:'Verkeersmanagement',norm:99},{});
  assert.equal(r.exact,true,'volledige dekking geeft een exacte waarde');
  assert.ok(Math.abs(r.dekking-1)<1e-9,'dekking is 1, nu '+r.dekking);
  // Gelijke aandelen: (100 + 60 + 100 + 100) / 4 = 90
  assert.ok(Math.abs(r.besch-90)<1e-9,'dienstwaarde is 90, nu '+r.besch);
  assert.notEqual(r.besch,null,'een ontbrekend aandeel levert geen lege dienstwaarde');
});

test('v68Dienst volgt expliciete aandelen wanneer die er zijn',()=>{
  const bron=lees('site/engines/dvm-2.js');
  const ctx=vm.createContext({Math,Number,Object,console});
  ctx.SUBPROCESSEN={vm:[{naam:'a',gewicht:0.75},{naam:'b',gewicht:0.25}]};
  ctx.v68Subproces=sp=>sp.naam==='b'
    ? {naam:sp.naam,loB:0,hiB:0,loP:0,hiP:0,bekend:1,exact:true,bronnen:[]}
    : {naam:sp.naam,loB:100,hiB:100,loP:100,hiP:100,bekend:1,exact:true,bronnen:[]};
  vm.runInContext(haalFunctie(bron,'v68Dienst'),ctx,{filename:'v68Dienst'});

  const r=ctx.v68Dienst({id:'vm',naam:'Verkeersmanagement',norm:99},{});
  // 0,75 x 100 + 0,25 x 0 = 75
  assert.ok(Math.abs(r.besch-75)<1e-9,'dienstwaarde is 75, nu '+r.besch);
});

test('onvolledige dekking blijft een band zonder exacte waarde',()=>{
  const bron=lees('site/engines/dvm-2.js');
  const ctx=vm.createContext({Math,Number,Object,console});
  ctx.SUBPROCESSEN={vm:[{naam:'a'},{naam:'b'}]};
  ctx.v68Subproces=sp=>sp.naam==='b'
    ? {naam:sp.naam,loB:0,hiB:100,loP:0,hiP:100,bekend:0,exact:false,bronnen:[]}
    : {naam:sp.naam,loB:80,hiB:80,loP:80,hiP:80,bekend:1,exact:true,bronnen:[]};
  vm.runInContext(haalFunctie(bron,'v68Dienst'),ctx,{filename:'v68Dienst'});

  const r=ctx.v68Dienst({id:'vm',naam:'Verkeersmanagement',norm:99},{});
  assert.equal(r.exact,false,'halve dekking is niet exact');
  assert.equal(r.besch,null,'onbekende beschikbaarheid blijft leeg');
  assert.ok(Math.abs(r.loB-40)<1e-9,'ondergrens is 40, nu '+r.loB);
  assert.ok(Math.abs(r.hiB-90)<1e-9,'bovengrens is 90, nu '+r.hiB);
});
