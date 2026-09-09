/* BI blijft eigenaar van formatie, planning, contracten en interne bedienketens. */
(() => {
 const notify=()=>parent!==window&&parent.postMessage({type:'hub:changed',engine:'bi'},location.origin);
 const clean=db=>{
  // Bewaar oude berekeningen voor herleidbaarheid, maar tel ze niet opnieuw mee.
  const duplicate=(db.assets||[]).filter(a=>/^ndw_(msi|drip)_/i.test(a.id));
  if(duplicate.length){db.legacyDvmAssets=[...(db.legacyDvmAssets||[]),...duplicate];db.assets=db.assets.filter(a=>!duplicate.includes(a));}
  if(db.storingsRegels?.foutcodes?.length&&!db.legacyDvmRegels)db.legacyDvmRegels=structuredClone(db.storingsRegels);
  db.storingsRegels={assetTypen:[],foutcodes:[],locatieRegels:[],combiRegels:[]};
  return db;
 };
 DB=clean(DB);
 window.verwerkMeldingen=()=>alert('Laad DVM-storingen in Dienstimpact. De gezamenlijke omgeving gebruikt uitsluitend die impactregels.');
 window.HUB={
  import(db){DB=clean(migreerDB(structuredClone(db)));saveDB();return this.summary();},
  export(){const db=structuredClone(DB);delete db.storingsRegels;return db;},
  async planningWindow(){renderPlanning();for(let i=0;i<200;i++){const w=iplWin();if(w?.ipl_parseXML)return w;await new Promise(r=>setTimeout(r,50));}throw Error('Planning is niet gereed.');},
  async importPlanning(p){
   const w=await this.planningWindow();
   // Laat de oorspronkelijke importer ook mapping, afgeleide datums en renders verzorgen.
   const parsed=w.ipl_parseXML(p.xml);if(!parsed?.regels?.length)throw Error('Deze XML bevat geen herkenbare planningsactiviteiten.');
   const f=new w.File([p.xml],p.name||'planning.xml',{type:'text/xml'});
   w.ipl_handleFile({files:[f],value:''});
   for(let i=0;i<300;i++){if(w.IPL_RAW_XML===p.xml)break;await new Promise(r=>setTimeout(r,50));}
   if(w.IPL_RAW_XML!==p.xml)throw Error('De planning kon niet worden hersteld.');
   if(p.state)w.app_applyState(p.state);
   try{const cap=p6ParseCapaciteit(p.xml,p.name||'planning.xml');if(cap.nActiviteiten)DB.p6Capaciteit=cap;else delete DB.p6Capaciteit;}catch(e){console.info('Geen P6 resource-toewijzingen:',e.message);}
   refresh();notify();
  },
  planning(){const w=iplWin();return w?.IPL_RAW_XML?{name:w.IPL_RAW_FILENAME,xml:w.IPL_RAW_XML,state:w.app_collectState()}:null;},
  summary(){const p=activeParams(),model=bridgeModel();return {peildatum:DB.meta?.peildatum||null,functies:DB.functies.map(f=>({id:f.id,naam:f.naam,benodigd:Number(f.benodigdFte)*(1+p.verzuim/100),actueel:Number(f.actueelFte)*(1+p.ftePct/100)})),triggers:evalTriggers(p),planning:model?{naam:model.bestand,regels:model.regels.length,van:model.t0,tot:model.t1}:null,legacyDvmAssets:DB.legacyDvmAssets?.length||0};},
  open(tab){goto(tab);}
 };
 const save=saveDB;window.saveDB=function(){clean(DB);save();notify();};
 document.addEventListener('change',()=>setTimeout(notify,800));
 let last='';setInterval(()=>{const w=iplWin();if(!w)return;const key=[w.IPL_RAW_XML?.length,w.IPL_RAW_FILENAME,JSON.stringify(w.app_collectState().ipl)].join('|');if(key!==last){last=key;notify();}},2000);
 window.addEventListener('load',()=>parent.postMessage({type:'hub:ready',engine:'bi'},location.origin));
})();
