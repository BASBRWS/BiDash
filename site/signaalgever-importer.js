import './core/signaalgever-import.js?v=20261015-1320';
import {createWorkspaceStorage} from './core/storage.js?v=20261015-1320';
import {BIDASH_VERSIE} from './core/versie.js?v=20261015-1320';
const C=globalThis.BIDASH_SIGNAALGEVER_IMPORT,$=id=>document.getElementById(id);
const storage=createWorkspaceStorage('bidash-signaalgever-importer');
let stands={},busy=false,cancelled=false,H,frame;
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
$('until').value=today();$('version').textContent='Versie '+BIDASH_VERSIE;
const pause=()=>new Promise(r=>setTimeout(r,0));
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function controls(){for(const id of ['vc','from','until','basis','pick','folder'])$(id).disabled=busy||!H;$('cancel').hidden=!busy;$('cancel').disabled=!busy;$('download').disabled=busy||!Object.keys(stands).length;$('downloadVc').disabled=busy||!stands[$('vc').value];}
function render(){
  $('results').replaceChildren();
  for(const vc of C.vcs){const s=stands[vc];if(!s)continue;
    const counts=frame.DVM_INCIDENT_LIFECYCLE.summary(s.open),uncertain=counts.onzeker;
    const tr=document.createElement('tr'),t=s.laatstePerVc[vc],d=s.snapshotDekking?.[vc];
    const values=[vc.toUpperCase(),t?new Date(t).toLocaleString('nl-NL'):'Onbekend',counts.meldingen-uncertain,uncertain,s.historie.filter(C.closed).length,d?.volledig&&!d.bronGap&&!d.volumeVerdacht?'Structuur gecontroleerd':'Controle nodig'];
    for(const value of values){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}$('results').append(tr);
  }
  controls();
}
function config(){
  const vanaf=$('from').value,tot=$('until').value;if(!vanaf||!tot||vanaf>tot)throw Error('Kies een geldige begin- en einddatum.');
  return {vcs:new Set([$('vc').value]),vanaf,tot};
}
function checkCancel(){if(cancelled)throw Error('Verwerking gestopt. De vorige opgeslagen stand is behouden.');}
async function process(files,cfg){
  const normalized=files.map(f=>{
    const path=String(f.webkitRelativePath||f._pad||f.name).replace(/\\/g,'/'),parts=path.split('/');
    // De alternatieve mapkiezer geeft bij een VC-map geen mtm-hoofdmap mee.
    if(C.vc(parts[0])&&parts[1]?.toLowerCase()==='storinglijst')return {name:f.name,_pad:'mtm/'+path,_handle:{getFile:async()=>f}};
    return f;
  });
  const vc=[...cfg.vcs][0],selected=H.sbFilterBestanden(normalized,cfg);if(!selected.length)throw Error('Geen MTM-storinglijsten gevonden voor '+vc.toUpperCase()+' in deze periode.');
  const now=Date.now();let stand=stands[vc]||{open:[],historie:[],laatstePerVc:{},snapshotDekking:{},histRest:[],liveRest:[]};
  const basis=$('basis').files[0];
  if(basis){const b=H.sbSignaalgeverBasis(JSON.parse(await basis.text()));stand=H.sbSignaalgeverCombineerStand(stand,{...b,open:b.open.filter(r=>C.rowVc(r)===vc),historie:b.historie.filter(r=>C.rowVc(r)===vc),laatstePerVc:b.laatstePerVc[vc]?{[vc]:b.laatstePerVc[vc]}:{},snapshotDekking:b.snapshotDekking[vc]?{[vc]:b.snapshotDekking[vc]}:{},histRest:[],liveRest:[]});}
  const days=new Map();for(const f of selected){const p=f.webkitRelativePath||f._pad||f.name,info=H.sbPadInfoMtm(p),key=+info.datum;if(!days.has(key))days.set(key,[]);days.get(key).push({f,info});}
  let done=0,verwijderd=0;
  for(const [,items] of [...days].sort((a,b)=>a[0]-b[0])){
    checkCancel();const invoer=[];
    for(const {f,info} of items){
      checkCancel();const name=f.webkitRelativePath||f._pad||f.name;
      status(vc.toUpperCase()+', bestand '+(done+1)+' van '+selected.length+', '+name);await pause();
      let text;try{text=await H.sbLeesTekst(f);}catch(e){throw Error('Bestand niet gelezen, '+name+'. '+e.message);}
      invoer.push(await frame.DVM_MTM_BSS.read(text,f,info,{pause,checkCancel,onProgress:(n,total)=>{checkCancel();status(vc.toUpperCase()+', '+name+', '+n.toLocaleString('nl-NL')+' van '+total.toLocaleString('nl-NL')+' regels.');}}));done++;$('progress').value=5+85*done/selected.length;
    }
    stand=await frame.DVM_MTM_BSS.process(stand,invoer,{historyCutoff:C.cutoff(now),pause,checkCancel,onProgress:(n,total)=>{checkCancel();status(vc.toUpperCase()+', levenscyclus verwerken, '+n.toLocaleString('nl-NL')+' van '+total.toLocaleString('nl-NL')+' gebeurtenissen.');}});
    const removed=stand.bssVerwijderd||0;stand=C.retain(stand,now);verwijderd+=stand.bewaring.verwijderd+removed;
    status(vc.toUpperCase()+', '+done+' van '+selected.length+' bestanden verwerkt.');await pause();
  }
  checkCancel();stand.bewaring.verwijderd=verwijderd;
  const next={...stands,[vc]:stand};status('Stand lokaal opslaan.');$('progress').value=95;$('cancel').disabled=true;await storage.write({schema:1,stands:next});stands=next;render();$('progress').value=100;
  status(vc.toUpperCase()+' opgeslagen. '+selected.length+' bestanden verwerkt. '+stand.open.length+' actuele meldingen inclusief onzeker. '+verwijderd+' afgesloten meldingen buiten de bewaartermijn verwijderd. Kies de volgende verkeerscentrale of download de JSON.');
}
async function run(getFiles){
  if(busy||!H)return;let cfg;try{cfg=config();}catch(e){status(e.message,true);return;}
  busy=true;cancelled=false;controls();$('progress').value=0;
  try{const files=await getFiles(cfg);if(files)await process(files,cfg);else status('Mapkeuze geannuleerd.');}
  catch(e){if(e.name==='AbortError')status('Mapkeuze geannuleerd.');else status(e.message+'. Er is geen nieuwe stand opgeslagen voor deze verkeerscentrale.',true);}
  finally{busy=false;controls();}
}
$('pick').onclick=()=>run(async cfg=>{
  if(typeof window.showDirectoryPicker!=='function'){status('Gebruik de alternatieve mapkeuze. Kies de mtm-map of de VC-map.');return null;}
  const handle=await window.showDirectoryPicker({mode:'read',id:'bidash-signaalgever-importer'});status('Gekozen verkeerscentrale en periode in de map zoeken.');
  return H.sgVerzamelViaHandle(handle,cfg,(dirs,count)=>{checkCancel();status(dirs+' mappen bekeken, '+count+' bestanden gevonden.');});
});
$('folder').onchange=event=>{const files=[...event.target.files];event.target.value='';if(files.length)run(()=>files);};
$('cancel').onclick=()=>{cancelled=true;status('Stoppen na de lopende bestandslezing.');};
$('vc').onchange=controls;
function download(selected){
  if(busy)return;try{
    const now=Date.now(),kept=Object.fromEntries(Object.entries(selected).map(([v,s])=>[v,C.retain(s,now)]));const data=C.bundle(kept,{now});
    const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='signaalgevers_'+data.signaalgeverImport.vcs.join('-')+'_'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }catch(e){status(e.message,true);}
}
$('download').onclick=()=>download(stands);$('downloadVc').onclick=()=>download({[$('vc').value]:stands[$('vc').value]});
try{
  const iframe=$('runtime');
  await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('De MTM-verwerking kon niet worden gestart. Herlaad de pagina.')),30000);const ready=()=>{if(iframe.contentWindow?.__BIDASH_STORINGSBUNDELAAR__&&iframe.contentWindow?.DVM_INCIDENT_LIFECYCLE&&iframe.contentWindow?.DVM_MTM_BSS){clearTimeout(deadline);resolve();}};iframe.addEventListener('load',ready,{once:true});ready();});
  frame=iframe.contentWindow;H=frame.__BIDASH_STORINGSBUNDELAAR__;
  const saved=await storage.read();if(saved&&saved.schema!==1)throw Error('Onbekende opslagversie van de importer.');
  stands=Object.fromEntries(Object.entries(saved?.stands||{}).filter(([v])=>C.vcs.includes(v)).map(([v,s])=>[v,C.retain(s)]));
  render();status('Gereed. Kies een verkeerscentrale en daarna de bronmap.');
}catch(e){H=null;controls();status(e.message,true);}
