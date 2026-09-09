/* Publieke adapter: alle uitkomsten komen uit de oorspronkelijke DVM-engine. */
(() => {
 const notify=()=>parent!==window&&parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);
 window.HUB={
  async import(bundle){
   const b=structuredClone(bundle);
   if(b.formaat!=='DVM-dienstimpact-totaal')throw Error('Geen DVM-totaalbestand.');
   if(!b.assetregister?.rijen?.length)throw Error('Een DVM-berekening vereist een assetregister. Importeer een volledige dataset of combineer de selectie met het bestaande register.');
   STATE=null; HISTORIE_STATE=null; STORINGSBRONNEN=[]; LIVE_STORINGSBRONNEN=[]; DRIP_HIST_STATE=null; U_ROUTE_STATE=null; WERK_STATE=null; EOL_REF=[];
   await totaalImportJson(new File([JSON.stringify(b)],'dvm-lokaal.json',{type:'application/json'}),'vervang');
   if(!ASSET_REGISTER_STATE)throw Error('Het assetregister is niet verwerkt.');
   return this.summary();
  },
  export(){return totaalExportBundle(Object.fromEntries(totaalExportOpties().map(o=>[o.id,true])));},
  summary(){
   const model=v68LandelijkModel();
   const roads=kostenDagRows().map(w=>{const c=kostenDagResultaat(w);return {id:w.key,naam:w.naam||w.wegdeel||w.key,vc:w.vc||'',kosten:c.kosten,vvu:c.vvu,status:c.status,bron:c.bron};});
   return {peildatum:STATE?.peildatum||null,assets:model.assets,roads,diensten:model.diensten.map(r=>({id:r.d.id,naam:String(r.d.naam||r.d.label||r.d.id).replace(/&amp;/g,'&'),norm:r.d.norm,besch:r.besch,prestatie:r.prestatie,lo:r.loB,hi:r.hiB,dekking:r.dekking})),liveBronnen:LIVE_STORINGSBRONNEN.length};
  },
  open(tab){const el=document.querySelector('[data-tab="'+tab+'"]');if(el)el.click();},
 };
 for(const name of ['sc67Bewaar','kostenBewaar','parametersLezen']){
  const fn=window[name];if(typeof fn==='function')window[name]=function(...args){const r=fn.apply(this,args);notify();return r;};
 }
 document.addEventListener('change',()=>setTimeout(notify,800));
 // Een bestaand bestand via de oorspronkelijke invoer blijft ook werken.
 const original=totaalImportJson;
 window.totaalImportJson=async function(...args){const result=await original(...args);notify();return result;};
 window.addEventListener('load',()=>parent.postMessage({type:'hub:ready',engine:'dvm'},location.origin));
})();
