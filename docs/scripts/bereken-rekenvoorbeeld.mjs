/* Rekent het voorbeeld uit docs/rekenvoorbeeld-signaalgevers.md door met de
   echte prognosemodule van de applicatie (site/core/signal-forecast.js).
   Draaien vanuit de projectmap:  node docs/scripts/bereken-rekenvoorbeeld.mjs
   Schrijft docs/rekenvoorbeeld.json en drukt de tabel af. */
import {simulateSignalForecast,normalizeForecastRules,buildForecastTriggers,localEolModel}
  from '../../site/core/signal-forecast.js';
import {writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HIER=dirname(fileURLToPath(import.meta.url));

/* ── De corridor ───────────────────────────────────────────────────────
   A12 rechterrijbaan, hm 60,0 tot 78,0, verkeerscentrale Zuidwest-Nederland.
   Dertig portalen om de 600 meter, drie rijstroken breed: 90 matrixsignaal-
   gevers, aangelegd in drie fases met een modellevensduur van 20 jaar.
   De aanname van dit voorbeeld: tussen 2026 en 2036 wordt niets vervangen. */
const FASES=[
  {vanHm:60.0,totHm:66.0,bouwjaar:2012},
  {vanHm:66.0,totHm:72.0,bouwjaar:2016},
  {vanHm:72.0,totHm:78.0,bouwjaar:2020}
];
const assets=[];
for(const f of FASES)
  for(let hm=f.vanHm; hm<f.totHm-1e-9; hm+=0.6)
    for(let strook=1; strook<=3; strook++)
      assets.push({
        key:`A12-RE-${hm.toFixed(1)}-${strook}`,
        tp:'MSI', weg:'A12', richting:'RE', vc:'ZWN',
        hm:Number(hm.toFixed(1)),
        bouwjaar:f.bouwjaar, modelLevensduur:20,
        naam:`MSI hm ${hm.toFixed(1)} strook ${strook}`,
        context: strook===1?'rijbaanbreed portaal':'opvolgend portaal',
        prognoseActief:true
      });

const rules=normalizeForecastRules({});          // de standaardregels van de tool
const res=await simulateSignalForecast(assets,rules);
const road=res.roads[0];

/* ── Van signaalgever naar dienst ──────────────────────────────────────
   Het effectieve gewicht van signalering binnen elke dienst, afgeleid uit
   SUBPROCESSEN in site/engines/dvm-1.js. Elk subproces weegt daar even zwaar
   (normaliseerSubprocesAandelen kent 1/n toe zolang er geen eigen gewicht
   staat) en binnen een subproces tellen de afh-waarden op tot 1,0.
   Omdat in dit voorbeeld alleen de signaalgevers verslechteren geldt:
     dienstbeschikbaarheid = 100 − gewicht(signalering) × uitvalspercentage   */
const SIGNAALAANDEEL={
  im :[0.1,0.8,0.3,0,0],      // 5 subprocessen
  vm :[0,0.9,0.7,0.6],        // 4 subprocessen
  rri:[0,0,0.5],              // 3 subprocessen
  wiu:[0.7,0.2,0,0.5]         // 4 subprocessen
};
const NORM={im:99.0,vm:99.0,rri:98.0,wiu:98.0};
const NAAM={im:'Incidentmanagement',vm:'Verkeersmanagement',rri:'Reis- & route-informatie',wiu:'Werk in Uitvoering'};
const wMSI=Object.fromEntries(Object.entries(SIGNAALAANDEEL)
  .map(([k,v])=>[k, v.reduce((a,b)=>a+b,0)/v.length]));

const rows=[];
let cumKosten=0, cumFte=0;
for(const y of road.years){
  const uitval=y.modelPct;                        // % signaalgevers niet beschikbaar
  cumKosten+=y.cost; cumFte+=y.fte;
  rows.push({
    jaar:y.year,
    uitvalPct:+uitval.toFixed(2),
    beschPct:+(100-uitval).toFixed(2),
    permPct:+y.permanentPct.toFixed(2),
    aangetastKm:+y.affectedKm.toFixed(2),
    fte:+y.fte.toFixed(2),
    kosten:Math.round(y.cost),
    cumKosten:Math.round(cumKosten),
    diensten:Object.fromEntries(Object.keys(NORM)
      .map(k=>[k, +(100-wMSI[k]*uitval).toFixed(2)]))
  });
}

const eolJaren=[...new Set(assets.map(a=>
  localEolModel(a,rules.degradeStartPct,assets,rules.referenceYear,rules.defaultLifeYears).eol))].sort();

writeFileSync(join(HIER,'..','rekenvoorbeeld.json'),JSON.stringify({
  gemaakt:new Date().toISOString().slice(0,10),
  corridor:{weg:'A12',richting:'RE',vc:'ZWN',vanHm:60.0,totHm:78.0,
            aantalSignaalgevers:assets.length,routeKm:+road.routeKm.toFixed(1),fases:FASES,eolJaren},
  regels:rules, signaalgewichtPerDienst:wMSI, normen:NORM,
  cumulatief:{fteJaren:+cumFte.toFixed(2),kosten:Math.round(cumKosten)},
  triggers:buildForecastTriggers(res,rules),
  rows
},null,1));

/* ── Afdruk ──────────────────────────────────────────────────────────── */
const pct=v=>v.toFixed(2).padStart(6);
console.log(`Corridor: ${assets.length} signaalgevers over ${road.routeKm.toFixed(1)} km · EoL-jaren ${eolJaren.join(', ')}`);
console.log('Signaleringsgewicht per dienst: '+Object.entries(wMSI).map(([k,v])=>`${k} ${(v*100).toFixed(1)}%`).join(' · '));
console.log('Kantelpunt (uitval waarbij de norm breekt): '+Object.keys(NORM)
  .map(k=>`${k} ${((100-NORM[k])/wMSI[k]).toFixed(2)}%`).join(' · '));
console.log('');
console.log(['jaar','uitval','besch','perm','km','FTE','kosten','cumulatief','IM','VM','RRI','WIU'].join('\t'));
for(const r of rows)console.log([r.jaar,pct(r.uitvalPct),pct(r.beschPct),pct(r.permPct),
  r.aangetastKm.toFixed(2),r.fte.toFixed(2),r.kosten,r.cumKosten,
  pct(r.diensten.im),pct(r.diensten.vm),pct(r.diensten.rri),pct(r.diensten.wiu)].join('\t'));
console.log('');
console.log(`Cumulatief 2026-2036: ${cumFte.toFixed(2)} FTE-jaren · € ${Math.round(cumKosten).toLocaleString('nl-NL')}`);
for(const k of Object.keys(NORM)){
  const eerste=rows.find(r=>r.diensten[k]<NORM[k]);
  console.log(`${NAAM[k]} zakt onder ${NORM[k]}% in ${eerste?eerste.jaar:'geen enkel jaar binnen het venster'}`);
}
console.log('');
console.log('Landelijk beoordeelde signalen uit buildForecastTriggers():');
const trig=buildForecastTriggers(res,rules);
if(!trig.length)console.log(' (geen)');
for(const t of trig)console.log(` - ${t.sev.toUpperCase()} ${t.titel} · ${t.val}`);
