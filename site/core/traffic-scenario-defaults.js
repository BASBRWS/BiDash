export const TRAFFIC_SCENARIO_DEFAULTS=Object.freeze({
  amStart:7,
  amEnd:10,
  pmStart:16,
  pmEnd:19,
  uren:6,
  reductie:30
});

const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_TRAFFIC_SCENARIO_DEFAULTS_ACTIVE__)return;
  const H=globalThis.__BIDASH_TRAFFIC_SCENARIO_DEFAULTS__;
  if(!H||typeof sc67Config!=='function')return;

  const originalSc67Config=sc67Config;
  sc67Config=function(w){
    const basis=originalSc67Config(w);
    if(!basis||typeof basis!=='object')return basis;
    const c={...basis};

    // Alleen lege waarden automatisch invullen. Bewuste handmatige invoer,
    // inclusief 0, blijft dus leidend.
    if(c.uren===''||c.uren==null||!Number.isFinite(Number(c.uren))){
      c.uren=H.uren;
      c.spitsAuto=true;
    }
    if(c.reductie===''||c.reductie==null||!Number.isFinite(Number(c.reductie))){
      c.reductie=H.reductie;
      c.reductieAuto=true;
    }

    if(!String(c.bron||'').trim()){
      const verkeersbron=c.ndwUsed?'NDW verkeersintensiteit':'Verkeersscenario';
      c.bron=verkeersbron+'; spits 07:00–10:00 en 16:00–19:00; generieke snelheidsreductie 30%';
    }
    return c;
  };

  globalThis.__BIDASH_TRAFFIC_SCENARIO_DEFAULTS_ACTIVE__=true;
})();`;

export function installTrafficScenarioDefaults(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_TRAFFIC_SCENARIO_DEFAULTS_ACTIVE__)return true;
  scope.__BIDASH_TRAFFIC_SCENARIO_DEFAULTS__=TRAFFIC_SCENARIO_DEFAULTS;
  try{
    scope.eval(PATCH_SOURCE);
    return !!scope.__BIDASH_TRAFFIC_SCENARIO_DEFAULTS_ACTIVE__;
  }catch(error){
    console.error('BiDash verkeersscenario-defaults konden niet worden gestart.',error);
    return false;
  }
}
