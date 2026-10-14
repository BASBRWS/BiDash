/* Grenscorrecties blijven lokaal en gaan mee met de zelfstandige matrixbron. */
(() => {
  const clean=v=>String(v??'').trim();
  const header=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const fields=['Code','Netwerkschakel','Rijksweg','Verkeerscentrale','HMP van','HMP tot','Zijde','Hectoletter'];
  const value=(row,key)=>Object.entries(row).find(([k])=>header(k)===header(key))?.[1]??'';
  function set(row,key,v){for(const k of Object.keys(row))if(header(k)===header(key))delete row[k];row[key]=v;}
  let draft=null,source=null,busy=false,issues=[],selected=null,assetPage=0;
  const pageSize=20;
  let disabledBefore=new WeakMap();
  function checks(){
    const groups=new Map(),S=window.DVM_NETWERKSCHAKELS_STATE;
    if(!S)return [];
    const add=(a,kind)=>{
      const result=koppelNetwerkschakel(a);if(!result?.reden&&!result?.vcAfwijking)return;
      const candidates=(result.kandidaten||[]).map(s=>s.code).sort().join(', ');
      const reason=result.reden||result.vcAfwijking;
      const key=JSON.stringify([clean(a.weg).toUpperCase(),normAssetRichting(a.richting),clean(a.hectoletter).toUpperCase(),normAssetVc(a.vc),reason,candidates]);
      let g=groups.get(key);
      if(!g){g={key,weg:a.weg||'',richting:a.richting||'',hectoletter:a.hectoletter||'',vc:a.vc||'',reden:reason,kandidaten:candidates,min:null,max:null,assets:0,meldingen:0,assetKeys:[],losseMeldingen:[]};groups.set(key,g);}
      g[kind]++;
      const assetKey=a.assetKey||a._assetKey||a.key;
      if(assetKey&&ASSET_INDEX?.byKey.has(assetKey)){if(!g.assetKeys.includes(assetKey))g.assetKeys.push(assetKey);}
      else if(kind==='meldingen')g.losseMeldingen.push({logId:assetLogId(a,a.typeId),weg:a.weg,richting:a.richting,hm:a.hm,type:a.typeId,foutcode:a.foutcode});
      if(a.hm!=null&&clean(a.hm)!==''&&Number.isFinite(Number(a.hm))){const hm=Number(a.hm);g.min=g.min===null?hm:Math.min(g.min,hm);g.max=g.max===null?hm:Math.max(g.max,hm);}
    };
    for(const a of typeof ASSET_REGISTER_STATE==='undefined'?[]:ASSET_REGISTER_STATE?.assets||[])if(a.prognoseActief!==false)add(a,'assets');
    const W=typeof STATE==='undefined'?null:STATE;
    for(const m of [...W?.meldingen||[],...W?.nietDoorgerekend||[]])add(m,'meldingen');
    return [...groups.values()].sort((a,b)=>a.weg.localeCompare(b.weg,'nl',{numeric:true})||a.richting.localeCompare(b.richting));
  }
  function checkHtml(){
    const rows=issues=checks();
    if(!rows.length)return '<p>Geen koppelproblemen in het geladen actieve areaal en de huidige analyse. Dit controleert geen ontbrekende brongegevens.</p>';
    return '<div class="tbl-scroll" style="max-height:30vh;overflow:auto"><table class="tbl"><thead><tr><th>Weg en zijde</th><th>HMP</th><th>Bron-VC</th><th>Reden</th><th>Passende codes</th><th>Assets</th><th>Meldingen</th><th>Actie</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+esc((r.weg+' '+r.richting+(r.hectoletter?' letter '+r.hectoletter:'')).trim())+'</td><td>'+esc(r.min===null?'Onbekend':r.min+(r.max!==r.min?' tot '+r.max:''))+'</td><td>'+esc(r.vc||'Onbekend')+'</td><td>'+esc(r.reden)+'</td><td>'+esc(r.kandidaten||'Geen')+'</td><td>'+r.assets+'</td><td>'+r.meldingen+'</td><td><button type="button" data-netwerk-issue="'+i+'">Oplossen</button></td></tr>').join('')+'</tbody></table></div>';
  }
  function issueHtml(){
    const host=document.getElementById('netwerkIssueAssets');if(!host||!selected)return;
    const current=[...STATE?.meldingen||[],...STATE?.nietDoorgerekend||[]],loose=[];
    for(const m of selected.losseMeldingen){
      const active=current.filter(a=>assetLogSleutel(assetLogId(a,a.typeId))===assetLogSleutel(m.logId));
      for(const a of active)if(a.assetKey&&ASSET_INDEX?.byKey.has(a.assetKey)){if(!selected.assetKeys.includes(a.assetKey))selected.assetKeys.push(a.assetKey);}
      if(active.some(a=>!a.assetKey))loose.push(m);
    }
    const needle=clean(document.getElementById('netwerkIssueFilter').value).toUpperCase();
    const assets=selected.assetKeys.map(key=>ASSET_INDEX?.byKey.get(key)).filter(Boolean).filter(a=>[a.naam,a.entityid,a.weg,a.richting,a.hm].join(' ').toUpperCase().includes(needle));
    const pages=Math.max(1,Math.ceil(assets.length/pageSize));assetPage=Math.max(0,Math.min(assetPage,pages-1));
    document.getElementById('netwerkIssueTitel').textContent='Oplossen, '+selected.weg+' '+selected.richting;
    document.getElementById('netwerkIssueReden').textContent='Probleem bij openen, '+selected.reden+'. De actuele koppeling staat bij elk asset. Een VC-verschil is alleen een melding, de matrix-VC wordt al gebruikt.';
    host.innerHTML='<p>'+assets.length+' betrokken assets. Pagina '+(assetPage+1)+' van '+pages+'.</p><p><button type="button" data-netwerk-page="-1" '+(assetPage===0?'disabled':'')+'>Vorige assets</button> <button type="button" data-netwerk-page="1" '+(assetPage===pages-1?'disabled':'')+'>Volgende assets</button></p>'+assets.slice(assetPage*pageSize,(assetPage+1)*pageSize).map(a=>{
      const result=koppelNetwerkschakel(a),label=result?.schakel?'Gekoppeld aan '+result.schakel.code+(result.vcAfwijking?', '+result.vcAfwijking:''):result?.reden||'Niet gekoppeld';
      return '<details data-netwerk-asset="'+esc(a.key)+'"><summary>'+esc(a.naam)+' · '+esc(a.weg+' '+a.richting+' HM '+(a.hm??'onbekend'))+' · '+esc(label)+'</summary>'+assetLocatieEditorHtml(a,{netwerkBeheer:true})+'</details>';
    }).join('')+(assets.length?'':'<p>Geen betrokken registerassets gevonden. Gebruik de assetkoppeling voor een losse melding.</p>')+
    (loose.length?'<h4>Meldingen zonder gekoppeld registerasset</h4><p>Corrigeer eerst de assetkoppeling. De oorspronkelijke storingsbron blijft bewaard.</p>'+loose.slice(0,pageSize).map(m=>'<p>'+esc([m.type,m.logId,m.weg,m.richting,m.hm,m.foutcode].filter(v=>v!=null&&v!=='').join(' · '))+' <button type="button" data-netwerk-log="'+esc(encodeURIComponent(m.logId))+'">Assetkoppeling oplossen</button></p>').join('')+(loose.length>pageSize?'<p>Open meldingen staan ook in Impactregels bij de assetkoppelingen.</p>':''):'');
  }
  function chooseIssue(i){
    capture();selected=issues[i];if(!selected)return;assetPage=0;
    document.getElementById('netwerkIssuePane').hidden=false;document.getElementById('netwerkIssueFilter').value='';issueHtml();
    document.getElementById('netwerkIssuePane').scrollIntoView({block:'start'});
  }
  function focusMatrix(){
    if(!selected)return;capture();
    document.getElementById('netwerkGrenzenFilter').value=/^[AN][1-9]\d*$/.test(selected.weg)?selected.weg:'';
    filterRows();document.getElementById('netwerkMatrixPane').open=true;
    document.getElementById('netwerkMatrixPane').scrollIntoView({block:'start'});
  }
  function addRow(fromIssue=false){
    capture();draft.push({Code:'',Netwerkschakel:'',Rijksweg:fromIssue&&/^[AN][1-9]\d*$/.test(selected?.weg)?selected.weg:'',Verkeerscentrale:fromIssue?normAssetVc(selected?.vc):'','HMP van':'','HMP tot':'',Zijde:fromIssue&&['LI','RE'].includes(selected?.richting)?selected.richting:'',Status:'Handmatig toegevoegd, niet NWB-gecontroleerd'});
    document.getElementById('netwerkGrenzenFilter').value='';rowsHtml();document.getElementById('netwerkMatrixPane').open=true;
    document.querySelector('#netwerkGrenzenBody tr:last-child input')?.focus();
  }
  function setBusy(v){
    busy=v;if(v)disabledBefore=new WeakMap();
    document.getElementById('netwerkBeheerDialog').querySelectorAll('button,input,select').forEach(el=>{if(v){disabledBefore.set(el,el.disabled);el.disabled=true;}else if(disabledBefore.has(el))el.disabled=disabledBefore.get(el);});
  }
  async function saveAsset(button,reset){
    if(busy)return;const status=document.getElementById('netwerkBeheerStatus');
    if(source!==window.DVM_NETWERKSCHAKELS_STATE){status.textContent='De matrix is intussen vervangen. Sluit dit scherm en open het opnieuw.';return;}
    capture();const key=reset?button.dataset.netwerkLocationReset:button.dataset.netwerkLocationSave;
    const host=button.closest('[data-asset-locatie]'),loc=Object.fromEntries([...host.querySelectorAll('[data-asset-locatie-field]')].map(el=>[el.dataset.assetLocatieField,el.value]));
    setBusy(true);status.textContent='Assetlocatie controleren en opnieuw doorrekenen.';
    try{
      if(reset)await assetConfigLocatieHerstellen(key);else await assetConfigBewaarLocatie(key,loc);
      status.textContent=reset?'Bronlocatie hersteld en opnieuw doorgerekend.':'Assetlocatie opgeslagen en opnieuw doorgerekend. De matrixinvoer blijft bewaard.';
    }catch(error){status.textContent=error.message;}
    finally{setBusy(false);}
  }
  function refresh(){
    document.getElementById('netwerkKoppelControle').innerHTML=checkHtml();issueHtml();
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
      const inputs=[...tr.querySelectorAll('input')].map(el=>el.value).join(' ').toUpperCase();
      const exactRoad=/^[AN][1-9]\d*$/.test(needle);tr.hidden=!!needle&&(exactRoad?clean(tr.querySelector('[data-netwerk-field="Rijksweg"]').value).toUpperCase()!==needle:!inputs.includes(needle));
    }
  }
  function close(){if(!busy){capture();document.getElementById('netwerkBeheerDialog')?.close();}}
  async function save(reset=false){
    const dialog=document.getElementById('netwerkBeheerDialog'),status=document.getElementById('netwerkBeheerStatus');
    if(busy)return;
    if(source!==window.DVM_NETWERKSCHAKELS_STATE){status.textContent='De matrix is intussen vervangen. Sluit dit scherm en open het opnieuw.';return;}
    setBusy(true);
    try{
      if(!reset)capture();
      status.textContent='Grenzen controleren en opnieuw doorrekenen.';
      await netwerkBewaarGrenzen(reset?source.oorspronkelijkeRijen||source.rijen:draft);
      if(reset){delete window.DVM_NETWERKSCHAKELS_STATE.oorspronkelijkeRijen;delete window.DVM_NETWERKSCHAKELS_STATE.aangepastOp;}
      source=window.DVM_NETWERKSCHAKELS_STATE;draft=structuredClone(source.rijen);
      refresh();rowsHtml();
      status.textContent=reset?'Oorspronkelijke Excel-grenzen hersteld en opnieuw doorgerekend.':'Grenzen opgeslagen en opnieuw doorgerekend. Maak een totaalexport om deze stand te bewaren.';
    }catch(error){status.textContent=error.message;}
    finally{setBusy(false);issueHtml();}
  }
  function open(){
    const next=window.DVM_NETWERKSCHAKELS_STATE;if(!next)return;
    if(source!==next||!draft){draft=structuredClone(next.rijen);selected=null;}
    source=next;
    let dialog=document.getElementById('netwerkBeheerDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='netwerkBeheerDialog';dialog.style.cssText='width:92vw;max-width:1500px;max-height:88vh;overflow:auto';document.body.appendChild(dialog);}
    dialog.innerHTML='<div style="position:sticky;top:0;background:var(--bg,#fff);z-index:2;padding:8px"><h2>Netwerkschakels controleren</h2><button type="button" id="netwerkGrenzenSave">Opslaan en opnieuw doorrekenen</button> <button type="button" id="netwerkGrenzenClose">Sluiten</button><p id="netwerkBeheerStatus" role="status" aria-live="polite"></p></div><p>'+esc(source.bestand)+'</p><p>Klik op Oplossen bij een probleem om de betrokken assetlocaties te wijzigen of de matrixregels te openen. De oorspronkelijke bron-VC blijft bewaard. Een VC-verschil blokkeert een eenduidige locatiekoppeling niet. Gebruik gecontroleerde HMP-grenzen. Richting HMP bepaalt geen rijrichting.</p><details open><summary>Koppelproblemen en VC-verschillen</summary><div id="netwerkKoppelControle">'+checkHtml()+'</div></details><section id="netwerkIssuePane" hidden><h3 id="netwerkIssueTitel"></h3><p id="netwerkIssueReden"></p><p><button type="button" id="netwerkIssueMatrix">Matrixregels bekijken</button> <button type="button" id="netwerkIssueAdd">Ontbrekende grensregel toevoegen</button></p><label>Zoek binnen betrokken assets <input id="netwerkIssueFilter" type="search"></label><div id="netwerkIssueAssets"></div></section><details id="netwerkMatrixPane" open><summary>Matrixgrenzen aanpassen</summary><p>Wijzig hier de schakelgrenzen. Voor een verkeerde assetlocatie gebruik je Oplossen hierboven. HMP-grenzen worden niet uit assetposities geraden.</p><label>Zoek weg, code of naam <input id="netwerkGrenzenFilter" type="search"></label><div class="tbl-scroll" style="max-height:40vh;overflow:auto"><table class="tbl"><thead><tr>'+fields.map(k=>'<th>'+esc(k)+'</th>').join('')+'<th></th></tr></thead><tbody id="netwerkGrenzenBody"></tbody></table></div><p><button type="button" id="netwerkGrenzenAdd">Grensregel toevoegen</button> <button type="button" id="netwerkGrenzenReset">Oorspronkelijke Excel-grenzen herstellen</button></p></details>';
    dialog.oncancel=e=>{if(busy)e.preventDefault();else capture();};
    document.getElementById('netwerkGrenzenFilter').oninput=filterRows;
    document.getElementById('netwerkGrenzenAdd').onclick=()=>addRow();
    document.getElementById('netwerkKoppelControle').onclick=e=>{const b=e.target.closest('[data-netwerk-issue]');if(b&&!busy)chooseIssue(Number(b.dataset.netwerkIssue));};
    document.getElementById('netwerkIssueFilter').oninput=()=>{assetPage=0;issueHtml();};
    document.getElementById('netwerkIssueMatrix').onclick=focusMatrix;
    document.getElementById('netwerkIssueAdd').onclick=()=>addRow(true);
    document.getElementById('netwerkIssueAssets').onclick=e=>{
      const b=e.target.closest('button');if(!b||busy)return;
      if(b.hasAttribute('data-netwerk-location-save'))saveAsset(b,false);
      else if(b.hasAttribute('data-netwerk-location-reset'))saveAsset(b,true);
      else if(b.hasAttribute('data-netwerk-page')){assetPage+=Number(b.dataset.netwerkPage);issueHtml();}
      else if(b.hasAttribute('data-netwerk-log')){capture();close();openAssetConfigForLog(b.dataset.netwerkLog);}
    };
    document.getElementById('netwerkGrenzenBody').onclick=e=>{const b=e.target.closest('[data-netwerk-remove]');if(!b)return;capture();draft.splice(Number(b.dataset.netwerkRemove),1);rowsHtml();};
    document.getElementById('netwerkGrenzenSave').onclick=()=>save();
    document.getElementById('netwerkGrenzenReset').onclick=()=>save(true);
    document.getElementById('netwerkGrenzenClose').onclick=close;
    rowsHtml();dialog.showModal();if(selected){document.getElementById('netwerkIssuePane').hidden=false;issueHtml();}
  }
  window.netwerkKoppelControle=checks;
  window.openNetwerkschakelBeheer=open;
  window.netwerkVerversBeheer=refresh;
})();
