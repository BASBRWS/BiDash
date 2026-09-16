/* Een referentielijst zonder herkende markerkolom krijgt de soort die met de knop
   is gekozen. Dat is een aanname over de hele lijst en die moet zichtbaar zijn,
   niet stil toegepast. Deze test controleert drie dingen: welke kopteksten wél en
   niet als markering tellen, dat de herkomst wordt vastgelegd en door de export
   heen komt, en dat de brondekking de aanname toont.

   De test voert de verzonden implementaties uit: classifiedRows en exportState uit
   dvm-special-drip-lists.js en specialMeta letterlijk uit dvm-source-manager.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const special=read('site/engines/dvm-special-drip-lists.js');
const manager=read('site/engines/dvm-source-manager.js');

function haalFunctie(tekst,naam){
  const start=tekst.indexOf('function '+naam+'(');
  assert.notEqual(start,-1,'functie '+naam+' niet gevonden');
  let diepte=0;
  for(let j=tekst.indexOf('{',start);j<tekst.length;j++){
    if(tekst[j]==='{')diepte++;
    else if(tekst[j]==='}'&&--diepte===0)return tekst.slice(start,j+1);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}

/* De module leest window.DVM_SPECIAL_DRIP_LISTS bij het laden, dus een vooraf
   gevulde toestand laat zich door exportState en restoreDripSpecialLists voeren. */
function laadSpeciaal(begin){
  const window=begin?{DVM_SPECIAL_DRIP_LISTS:begin}:{};window.window=window;
  vm.runInNewContext(special,{window,console,setTimeout,clearTimeout,Date});
  return window;
}

/* specialMeta leunt op specialKind, specialState en specialHerkomst uit dezelfde
   module. Die halen we letterlijk op en draaien ze tegen een gestubde toestand. */
function brondekking(type,state){
  const ctx=vm.createContext({Number,String,Object,Array,console,
    window:{DVM_SPECIAL_DRIP_LISTS:state},
    PLACEHOLDERS:{windDrips:{meta:'leeg'},ria4Drips:{meta:'leeg'}}});
  for(const naam of ['specialKind','specialState','specialHerkomst','specialMeta'])
    vm.runInContext(haalFunctie(manager,naam),ctx,{filename:naam});
  return vm.runInContext(`specialMeta(${JSON.stringify(type)})`,ctx);
}

test('een samengestelde kop als "RIA-4 DRIP" telt als markering',()=>{
  const h=laadSpeciaal().__BIDASH_SPECIAL_DRIP_CLASSIFICATION__;
  const split=h.classifiedRows([{'DRIP (CDMS)':'D80','RIA-4 DRIP':'x'}],'ria4');
  assert.equal(split.explicit,true);
  assert.equal(split.herkomst,'markering');
  assert.equal(split.hasRia4,true);
  assert.equal(split.ria4.length,1);
  assert.deepEqual(Array.from(split.markerKolommen),['RIA-4 DRIP']);
});

test('"Windwaarschuwing DRIP" telt als markering, een windmeting niet',()=>{
  const h=laadSpeciaal().__BIDASH_SPECIAL_DRIP_CLASSIFICATION__;
  const markering=h.classifiedRows([{'DRIP (CDMS)':'D81','Windwaarschuwing DRIP':'ja'}],'wind');
  assert.equal(markering.herkomst,'markering');
  assert.equal(markering.wind.length,1);
  /* Windrichting en windsnelheid zeggen iets over het weer, niet over de soort
     DRIP. Zouden ze als markerkolom tellen, dan zou een gevulde meting de hele
     lijst als windwaarschuwing markeren. */
  const meting=h.classifiedRows([{'DRIP (CDMS)':'D82',Windrichting:'ZW',Windsnelheid:'22'}],'wind');
  assert.equal(meting.explicit,false);
  assert.equal(meting.herkomst,'aanname');
  assert.deepEqual(Array.from(meting.markerKolommen),[]);
});

test('zonder markerkolom is de gekozen soort een vastgelegde aanname',()=>{
  const h=laadSpeciaal().__BIDASH_SPECIAL_DRIP_CLASSIFICATION__;
  const rows=[{DRIP:'D1'},{DRIP:'D2'},{DRIP:'D3'}];
  const split=h.classifiedRows(rows,'wind');
  assert.equal(split.explicit,false);
  assert.equal(split.herkomst,'aanname');
  assert.equal(split.rijenBron,3);
  assert.equal(split.wind.length,3);
  assert.equal(split.ria4.length,0);
});

test('de herkomst overleeft export en herstel van een totaalbundel',()=>{
  const begin={
    wind:{bestand:'wind.xlsx',geladenOp:'2026-09-16T08:00:00.000Z',rijen:3,rijenBron:3,
      herkomst:'aanname',markerKolommen:[],
      identifiers:[{raw:'D1',token:'D1X',kolom:'DRIP'}],records:[{ids:[{raw:'D1',token:'D1X',kolom:'DRIP'}],locatie:{}}]},
    ria4:{bestand:'ria4.xlsx',geladenOp:'2026-09-16T08:05:00.000Z',rijen:2,rijenBron:5,
      herkomst:'markering',markerKolommen:['RIA-4 DRIP'],
      identifiers:[{raw:'D2',token:'D2X',kolom:'DRIP'}],records:[{ids:[{raw:'D2',token:'D2X',kolom:'DRIP'}],locatie:{}}]}
  };
  const window=laadSpeciaal(begin),bundel=window.getDripSpecialListsExport();
  assert.equal(bundel.wind.herkomst,'aanname');
  assert.equal(bundel.wind.rijenBron,3);
  assert.equal(bundel.ria4.herkomst,'markering');
  assert.deepEqual(Array.from(bundel.ria4.markerKolommen),['RIA-4 DRIP']);

  const leeg=laadSpeciaal({wind:null,ria4:null});
  leeg.restoreDripSpecialLists(JSON.parse(JSON.stringify(bundel)));
  assert.equal(leeg.DVM_SPECIAL_DRIP_LISTS.wind.herkomst,'aanname');
  assert.equal(leeg.DVM_SPECIAL_DRIP_LISTS.wind.rijenBron,3);
  assert.deepEqual(Array.from(leeg.DVM_SPECIAL_DRIP_LISTS.ria4.markerKolommen),['RIA-4 DRIP']);
});

test('de brondekking benoemt de aanname en anders de markerkolom',()=>{
  const aanname=brondekking('windDrips',{wind:{bestand:'wind.xlsx',rijen:412,rijenBron:412,
    herkomst:'aanname',markerKolommen:[],identifiers:[{},{}],matchedAssets:2,unmatchedCount:0}});
  assert.match(aanname,/geen markerkolom herkend/);
  assert.match(aanname,/alle 412 regels/);
  assert.match(aanname,/Windwaarschuwing/);

  const markering=brondekking('ria4Drips',{ria4:{bestand:'ria4.xlsx',rijen:20,rijenBron:50,
    herkomst:'markering',markerKolommen:['RIA-4 DRIP'],identifiers:[{}],matchedAssets:1,unmatchedCount:0}});
  assert.match(markering,/soort uit kolom RIA-4 DRIP/);
  assert.doesNotMatch(markering,/aangenomen/);
});

test('de melding na het laden noemt de aanname met het aantal regels',()=>{
  assert.match(special,/geen markerkolom herkend; alle \$\{split\.rijenBron\} regels gelden als \$\{label\}/);
  assert.match(special,/markering uit \$\{split\.markerKolommen\.join\(', '\)\}/);
});
