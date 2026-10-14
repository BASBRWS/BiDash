import {OPERATIONAL_STATUS} from './asset-operational-status.js?v=20261014-1551';

/* Alleen bediening. Status en speciale selectie worden in de gepagineerde
   presentatielijst toegepast; HUB.assets blijft het volledige bronregister. */
(() => {
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const IDS={wind:'assetWind',ria4:'assetRia4',status:'assetOperationalStatus'};
  function rerender(){
    const source=document.getElementById('assetSource');
    if(source)source.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function control(id,label,title){
    const wrap=document.createElement('label');wrap.className='check';wrap.title=title;
    const input=document.createElement('input');input.type='checkbox';input.id=id;
    input.addEventListener('change',rerender);
    wrap.append(input,document.createTextNode(' '+label));return wrap;
  }
  function statusControl(){
    const label=document.createElement('label');label.textContent='Operationele status';
    const select=document.createElement('select');select.id=IDS.status;
    select.innerHTML=`<option value="">Alle statussen</option><option>${OPERATIONAL_STATUS.OPERATIONAL}</option><option>${OPERATIONAL_STATUS.FAULT_OUTAGE}</option><option>${OPERATIONAL_STATUS.NOT_OPERATIONAL}</option><option>${OPERATIONAL_STATUS.UNKNOWN}</option>`;
    select.addEventListener('change',rerender);label.append(select);return label;
  }
  function ensureControls(){
    const fault=document.getElementById('assetFaultOnly');if(!fault)return false;
    const row=fault.closest('.filter-row');if(!row)return false;
    if(!document.getElementById(IDS.status))row.insertBefore(statusControl(),fault.closest('label'));
    if(!document.getElementById(IDS.wind))row.append(control(IDS.wind,'Windwaarschuwing','Toon alleen assets uit de geladen Windwaarschuwing-DRIP referentielijst.'));
    if(!document.getElementById(IDS.ria4))row.append(control(IDS.ria4,'RIA4','Toon alleen assets uit de geladen RIA4-DRIP referentielijst.'));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureControls,{once:true});
  else ensureControls();
})();
