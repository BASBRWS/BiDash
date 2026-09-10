/* Geen tweede planningmodel: deze adapter opent de bestaande schermfuncties. */
document.body.dataset.module='planning';
window.HUB={
 open(screen='s16'){if(!['s16','s11','s17','s18','s19','s20','s15'].includes(screen))throw Error('Onbekend planningscherm');showScreen(screen);},
 fullscreen(active){document.body.classList.toggle('hub-planning-focus',!!active);document.getElementById('main').scrollTop=0;requestAnimationFrame(()=>{renderIPL();});},
 summary(){return {geladen:!!IPL_MODEL,naam:IPL_RAW_FILENAME||'',activiteiten:IPL_MODEL?.regels?.length||0};}
};
const originalPlanningScreen=showScreen;
window.showScreen=function(id,...args){const r=originalPlanningScreen(id,...args);if(parent!==window)parent.postMessage({type:'hub:planning-screen',screen:id},location.origin);return r;};
document.addEventListener('change',()=>parent.postMessage({type:'hub:changed',engine:'planning'},location.origin));
window.addEventListener('load',()=>HUB.open('s16'));

// De knop in de planning bedient hetzelfde volledige scherm als de hoofdapp.
window.ipl_openLiveFullscreen=()=>parent.postMessage({type:'hub:planning-fullscreen',active:true},location.origin);
window.ipl_closeLiveFullscreen=()=>parent.postMessage({type:'hub:planning-fullscreen',active:false},location.origin);
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.ipl_closeLiveFullscreen();});
