/* Grenscorrecties blijven lokaal en gaan mee met de zelfstandige matrixbron. */
(() => {
  const clean=v=>String(v??'').trim();
  const header=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const fields=['Code','Netwerkschakel','Rijksweg','Verkeerscentrale','HMP van','HMP tot','Zijde','Hectoletter'];
  const value=(row,key)=>Object.entries(row).find(([k])=>header(k)===header(key))?.[1]??'';
  function set(row,key,v){for(const k of Object.keys(row))if(header(k)===header(key))delete row[k];row[key]=v;}
  let draft=null,source=null,busy=false;
  function checks(){
    const groups=new Map(),S=window.DVM_NETWERKSCHAKELS_STATE;
    if(!S)return [];
    const add=(a,kind)=>{
      const result=koppelNetwerkschakel(a);if(!result?.reden&&!result?.vcAfwijking)return;
      const candidates=(result.kandidaten||[]).map(s=>s.code).sort().join(', ');
      const reason=result.reden||result.vcAfwijking;
      const key=JSON.stringify([clean(a.weg).toUpperCase(),normAssetRichting(a.richting),clean(a.hectoletter).toUpperCase(),normAssetVc(a.vc),reason,candidates]);
      let g=groups.get(key);
      if(!g){g={weg:a.weg||'',richting:a.richting||'',hectoletter:a.hectoletter||'',vc:a.vc||'',reden:reason,kandidaten:candidates,min:null,max:null,assets:0,meldingen:0};groups.set(key,g);}
      g[kind]++;
      if(a.hm!=null&&clean(a.hm)!==''&&Number.isFinite(Number(a.hm))){const hm=Number(a.hm);g.min=g.min===null?hm:Math.min(g.min,hm);g.max=g.max===null?hm:Math.max(g.max,hm);}
    };
    for(const a of typeof ASSET_REGISTER_STATE==='undefined'?[]:ASSET_REGISTER_STATE?.assets||[])if(a.prognoseActief!==false)add(a,'assets');
    const W=typeof STATE==='undefined'?null:STATE;
    for(const m of [...W?.meldingen||[],...W?.nietDoorgerekend||[]])add(m,'meldingen');
    return [...groups.values()].sort((a,b)=>a.weg.localeCompare(b.weg,'nl',{numeric:true})||a.richting.localeCompare(b.richting));
  }
  function checkHtml(){
    const rows=checks();
    if(!rows.length)return '<p>Geen koppelproblemen in het geladen actieve areaal en de huidige analyse. Dit controleert geen ontbrekende brongegevens.</p>';
    return '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Weg en zijde</th><th>HMP</th><th>Bron-VC</th><th>Reden</th><th>Passende codes</th><th>Assets</th><th>Meldingen</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.weg+' '+r.richting+(r.hectoletter?' letter '+r.hectoletter:''))+'</td><td>'+esc(r.min===null?'Onbekend':r.min+(r.max!==r.min?' tot '+r.max:''))+'</td><td>'+esc(r.vc||'Onbekend')+'</td><td>'+esc(r.reden)+'</td><td>'+esc(r.kandidaten||'Geen')+'</td><td>'+r.assets+'</td><td>'+r.meldingen+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function rowHtml(row,i){
    return '<tr data-netwerk-row="'+i+'">'+fields.map((key,k)=>{
      const v=value(row,key),type=k===4||k===5?'number':'text';
      // Een bestaande Rijrichting-kolom krijgt dezelfde betekenis als Zijde.
      const shown=key==='Zijde'?(v||value(row,'Rijrichting')):v;
      return '<td><input data-netwerk-field="'+key+'" aria-label="'+key+' regel '+(i+1)+'" type="'+type+'" '+(type==='number'?'min="0" step="any" ':'')+'value="'+esc(shown)+'" style="width:'+(k===1?'240':'110')+'px"></td>';
    }).join('')+'<td><button type="button" data-netwerk-remove="'+i+'">Verwijderen</button></td></tr>';
  }
  function capture(){
    for(const tr of document.querySelectorAll('#netwerkGrenzenBody tr')){
      const row=draft[Number(tr.dataset.netwerkRow)];
      for(const input of tr.querySelectorAll('[data-netwerk-field]')){
        const key=input.dataset.netwerkField,v=input.value;
        const old=key==='Zijde'?(value(row,key)||value(row,'Rijrichting')):value(row,key);
        if(clean(old)!==clean(v)){
          if(key==='Zijde')for(const k of Object.keys(row))if(header(k)==='rijrichting')delete row[k];
          set(row,key,v);set(row,'Status','Handmatig aangepast, niet NWB-gecontroleerd');
          set(row,'Controlepunt','Grenscorrectie in Bronbeheer. Controleer locatie en zijde.');
          // De oude rekenlengte hoort niet bij een gewijzigde HMP-grens.
          if(key==='HMP van'||key==='HMP tot')for(const k of Object.keys(row))if(header(k)==='rekenlengtekm')delete row[k];
        }
      }
    }
  }
  function rowsHtml(){
    document.getElementById('netwerkGrenzenBody').innerHTML=draft.map(rowHtml).join('');filterRows();
  }
  function filterRows(){
    const needle=clean(document.getElementById('netwerkGrenzenFilter').value).toUpperCase();
    for(const tr of document.querySelectorAll('#netwerkGrenzenBody tr')){
      const inputs=[...tr.querySelectorAll('input')].map(el=>el.value).join(' ').toUpperCase();tr.hidden=!!needle&&!inputs.includes(needle);
    }
  }
  function close(){if(!busy)document.getElementById('netwerkBeheerDialog')?.close();}
  async function save(reset=false){
    const dialog=document.getElementById('netwerkBeheerDialog'),status=document.getElementById('netwerkBeheerStatus');
    if(busy)return;
    if(source!==window.DVM_NETWERKSCHAKELS_STATE){status.textContent='De matrix is intussen vervangen. Sluit dit scherm en open het opnieuw.';return;}
    busy=true;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);
    try{
      if(!reset)capture();
      status.textContent='Grenzen controleren en opnieuw doorrekenen.';
      await netwerkBewaarGrenzen(reset?source.oorspronkelijkeRijen||source.rijen:draft);
      if(reset){delete window.DVM_NETWERKSCHAKELS_STATE.oorspronkelijkeRijen;delete window.DVM_NETWERKSCHAKELS_STATE.aangepastOp;}
      source=window.DVM_NETWERKSCHAKELS_STATE;draft=structuredClone(source.rijen);
      document.getElementById('netwerkKoppelControle').innerHTML=checkHtml();rowsHtml();
      status.textContent=reset?'Oorspronkelijke Excel-grenzen hersteld en opnieuw doorgerekend.':'Grenzen opgeslagen en opnieuw doorgerekend. Maak een totaalexport om deze stand te bewaren.';
    }catch(error){status.textContent=error.message;}
    finally{busy=false;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
  }
  function open(){
    source=window.DVM_NETWERKSCHAKELS_STATE;if(!source)return;
    draft=structuredClone(source.rijen);
    let dialog=document.getElementById('netwerkBeheerDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='netwerkBeheerDialog';dialog.style.cssText='width:92vw;max-width:1500px;max-height:88vh;overflow:auto';document.body.appendChild(dialog);}
    dialog.innerHTML='<h2>Netwerkschakels controleren</h2><p>'+esc(source.bestand)+'</p><p>Een eenduidige locatie wordt gekoppeld aan de matrix-VC. De oorspronkelijke bron-VC blijft bewaard. Bij overlap of ontbrekende grenzen kun je hieronder de matrix corrigeren. Gebruik gecontroleerde HMP-grenzen. Zijde is de rijrichting, bijvoorbeeld LI of RE. Richting HMP bepaalt geen rijrichting.</p><details open><summary>Koppelproblemen en VC-verschillen</summary><div id="netwerkKoppelControle">'+checkHtml()+'</div></details><h3>Matrixgrenzen aanpassen</h3><label>Zoek weg, code of naam <input id="netwerkGrenzenFilter" type="search"></label><div class="tbl-scroll"><table class="tbl"><thead><tr>'+fields.map(k=>'<th>'+esc(k)+'</th>').join('')+'<th></th></tr></thead><tbody id="netwerkGrenzenBody"></tbody></table></div><p><button type="button" id="netwerkGrenzenAdd">Grensregel toevoegen</button> <button type="button" id="netwerkGrenzenSave">Opslaan en opnieuw doorrekenen</button> <button type="button" id="netwerkGrenzenReset">Oorspronkelijke Excel-grenzen herstellen</button> <button type="button" id="netwerkGrenzenClose">Sluiten</button></p><p id="netwerkBeheerStatus" role="status" aria-live="polite"></p>';
    dialog.oncancel=e=>{if(busy)e.preventDefault();};
    document.getElementById('netwerkGrenzenFilter').oninput=filterRows;
    document.getElementById('netwerkGrenzenAdd').onclick=()=>{capture();draft.push({Code:'',Netwerkschakel:'',Rijksweg:'',Verkeerscentrale:'','HMP van':'','HMP tot':'',Status:'Handmatig toegevoegd, niet NWB-gecontroleerd'});document.getElementById('netwerkGrenzenFilter').value='';rowsHtml();document.querySelector('#netwerkGrenzenBody tr:last-child input')?.focus();};
    document.getElementById('netwerkGrenzenBody').onclick=e=>{const b=e.target.closest('[data-netwerk-remove]');if(!b)return;capture();draft.splice(Number(b.dataset.netwerkRemove),1);rowsHtml();};
    document.getElementById('netwerkGrenzenSave').onclick=()=>save();
    document.getElementById('netwerkGrenzenReset').onclick=()=>save(true);
    document.getElementById('netwerkGrenzenClose').onclick=close;
    rowsHtml();dialog.showModal();
  }
  window.netwerkKoppelControle=checks;
  window.openNetwerkschakelBeheer=open;
})();
