/* De lokaal geladen matrix bepaalt de rapportagegrenzen. Geen brondata ingebed. */
(() => {
  const clean=v=>String(v??'').trim();
  const header=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const number=v=>clean(v)===''?null:Number(clean(v).replace(',','.'));
  const road=v=>{const m=clean(v).toUpperCase().match(/^([AN])\s*0*(\d{1,3})$/);return m?m[1]+Number(m[2]):'';};
  const vc=v=>{
    const s=header(v).replace(/^vc/,'');
    if(s.startsWith('noordwestnederland'))return 'NWN';
    if(s.startsWith('zuidwestnederland'))return 'ZWN';
    if(s.startsWith('middennederland'))return 'MN';
    if(s.startsWith('noordenoostnederland')||s.startsWith('noordoostnederland')||s.startsWith('oostnederland'))return 'NON';
    if(s.startsWith('zuidnederland'))return 'ZN';
    return normAssetVc(v);
  };
  const state=()=>window.DVM_NETWERKSCHAKELS_STATE||null;
  let cache=null;
  function parse(rows,bestand){
    if(!Array.isArray(rows)||!rows.length)throw Error('De netwerkschakelmatrix bevat geen regels.');
    const required=['code','verkeerscentrale','rijksweg','netwerkschakel','hmpvan','hmptot'];
    const ranges=[],identities=new Map(),seen=new Set();
    rows.forEach((raw,i)=>{
      const r=Object.fromEntries(Object.entries(raw).map(([k,v])=>[header(k),v]));
      if(Object.values(r).every(v=>!clean(v)))return;
      if(required.some(k=>!Object.hasOwn(r,k)))throw Error('Verplichte kolommen ontbreken, Code, Verkeerscentrale, Rijksweg, Netwerkschakel, HMP van en HMP tot.');
      const code=clean(r.code).toUpperCase(),naam=clean(r.netwerkschakel),weg=road(r.rijksweg),v=vc(r.verkeerscentrale);
      const van=number(r.hmpvan),tot=number(r.hmptot),richting=normAssetRichting(r.zijde||r.rijrichting||'');
      if(!code||!naam||!weg||!['NWN','ZWN','MN','NON','ZN'].includes(v)||van===null||tot===null||!Number.isFinite(van)||!Number.isFinite(tot)||van<0||tot<0||van===tot)
        throw Error('Ongeldige netwerkschakel op Excelregel '+(i+2)+'. Controleer code, VC, weg en HMP-grenzen.');
      const signature=JSON.stringify([v,weg,naam]);
      if(identities.has(code)&&identities.get(code)!==signature)throw Error('Code '+code+' beschrijft verschillende netwerkschakels. Gebruik per schakel één unieke code.');
      identities.set(code,signature);
      const key=JSON.stringify([code,van,tot,richting,clean(r.hectoletter)]);
      if(seen.has(key))throw Error('Dubbele grensregel voor '+code+'.');
      seen.add(key);
      const lengte=number(r.rekenlengtekm);
      if(lengte!==null&&(!Number.isFinite(lengte)||lengte<=0))throw Error('Ongeldige rekenlengte voor '+code+'.');
      ranges.push({code,naam,vc:v,weg,van,tot,min:Math.min(van,tot),max:Math.max(van,tot),richting,
        richtingHmp:clean(r.richtinghmp),lengte:lengte??Math.abs(tot-van),status:clean(r.status)||'Niet gecontroleerd',
        controlepunt:clean(r.controlepunt),bronHmp:clean(r.bronhmp),bronGeometrie:clean(r.brongeometrie),
        vanNaam:clean(r.van),totNaam:clean(r.tot),hectoletter:clean(r.hectoletter).toUpperCase()});
    });
    if(!ranges.length)throw Error('De netwerkschakelmatrix bevat geen bruikbare grenzen.');
    return {bestand:clean(bestand)||'Netwerkschakelmatrix',rijen:structuredClone(rows),schakels:ranges,geladenOp:new Date().toISOString()};
  }
  function match(a){
    const S=state();if(!S)return null;
    const weg=road(a.weg),hm=number(a.hm),v=vc(a.vc),ri=normAssetRichting(a.richting);
    if(!weg||hm===null||!Number.isFinite(hm))return {reden:'Weg of hectometer ontbreekt'};
    let candidates=S.schakels.filter(s=>s.weg===weg&&(!v||s.vc===v)&&(!s.richting||s.richting===ri)&&(!s.hectoletter||s.hectoletter===clean(a.hectoletter).toUpperCase())&&hm>=s.min&&hm<=s.max);
    // Een gedeelde grens hoort bij het vak dat op die HMP begint. Dit werkt ook
    // bij aflopende hectometrering. Overlap buiten een gedeelde grens blijft twijfel.
    candidates=candidates.filter(s=>!(hm===s.max&&candidates.some(t=>t!==s&&t.vc===s.vc&&t.min===hm&&t.max>hm&&t.richting===s.richting)));
    const codes=new Set(candidates.map(s=>s.code));
    if(codes.size===1)return {schakel:candidates[0],reden:''};
    return {reden:codes.size?'Meerdere netwerkschakels passen':'Buiten matrix of afwijkende VC, zijde of hectoletter'};
  }
  function classify(a){
    const result=match(a);
    a.netwerkschakel=result?.schakel?.code||'';
    a.netwerkKoppeling=result?.reden||'';
    a._netwerkSchakel=result?.schakel||null;
    a.netwerkGroep=state()?groupKey(a):'';
    a.netwerkLengte=result?.schakel?info(a).netwerkLengte:null;
    a.netwerkLabel=state()?basis(a)+' · VC '+(a._netwerkSchakel?.vc||vc(a.vc)):'';
    return a;
  }
  function basis(a){
    const s=a._netwerkSchakel,ri=normAssetRichting(a.richting);
    return s?s.code+' '+s.naam+(ri?' '+ri:'')+' [HMP '+state().schakels.filter(r=>r.code===s.code&&(!r.richting||r.richting===ri)).map(r=>r.van+'-'+r.tot).sort().join(', ')+']':'Niet gekoppeld, '+(road(a.weg)||'onbekende weg')+(ri?' '+ri:'')+', '+a.netwerkKoppeling;
  }
  function groupKey(a){return basis(a)+'|vc:'+(a._netwerkSchakel?.vc||vc(a.vc)||'geen VC');}
  function empty(a,key){return {weg:road(a.weg)||a.weg,richting:normAssetRichting(a.richting),vc:a._netwerkSchakel?.vc||vc(a.vc),rd:a.rd,district:a.district,
    n:0,availUren:0,perfUren:0,posities:new Set(),typePosities:{},typeLoss:{},typen:{},meldingen:[],basisKey:basis(a),bestuurKey:key,
    netwerkschakel:a.netwerkschakel,netwerkKoppeling:a.netwerkKoppeling,_netwerkSchakel:a._netwerkSchakel};}
  function register(){
    const S=state(),R=typeof ASSET_REGISTER_STATE==='undefined'?null:ASSET_REGISTER_STATE;
    if(!S)return null;
    if(cache&&cache.S===S&&cache.R===R&&cache.version===ASSET_CONFIG_VERSIE)return cache;
    const groups=new Map(),assets=new Map(),seen=new Set();
    for(const a of R?.assets||[]){
      classify(a);if(!a.prognoseActief||seen.has(a.key))continue;seen.add(a.key);
      const key=groupKey(a);assets.set(a.key,key);
      if(!groups.has(key))groups.set(key,{a,counts:{sig:0,cam:0,lus:0,drip:0,wisselbord:0},assets:[]});
      const g=groups.get(key),t={MSI:'sig',CAM:'cam',LUS:'lus',DRIP:'drip',WISSELBORD:'wisselbord'}[a.tp];
      if(t)g.counts[t]++;g.assets.push(a);
    }
    return cache={S,R,version:ASSET_CONFIG_VERSIE,groups,assets};
  }
  function prepare(meldingen){
    const R=register();if(!R)return {};
    const out={};
    R.groups.forEach((g,k)=>{out[k]=empty(g.a,k);});
    meldingen.forEach(classify);
    return out;
  }
  function areaal(agg){
    const g=register()?.groups.get(agg.bestuurKey);if(!g)return null;
    return {...g.counts,bron:'geladen-netwerkschakelregister',vc:agg.vc,key:agg.basisKey};
  }
  function info(agg){
    const s=agg._netwerkSchakel;
    if(!s)return {netwerkschakel:'',netwerkKoppeling:agg.netwerkKoppeling||'',netwerkStatus:state()?'Niet gekoppeld':''};
    const ranges=state().schakels.filter(r=>r.code===s.code&&(!r.richting||r.richting===agg.richting));
    const spans=ranges.map(r=>[r.min,r.max]).sort((a,b)=>a[0]-b[0]);let lengte=0,end=-Infinity;
    spans.forEach(([lo,hi])=>{lengte+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);});
    return {netwerkschakel:s.code,netwerkKoppeling:'',netwerkNaam:s.naam,netwerkStatus:[...new Set(ranges.map(r=>r.status))].join(', '),
      netwerkGrenzen:ranges.map(r=>({van:r.van,tot:r.tot})),netwerkLengte:lengte,netwerkBron:state().bestand};
  }
  function reportRows(){
    const S=state();if(!S)return [];
    register();
    const W=typeof STATE==='undefined'?null:STATE;
    return [...new Map(S.schakels.map(s=>[s.code,s])).values()].map(s=>{
      const parts=(W?.wegdelen||[]).filter(w=>w.netwerkschakel===s.code),blinde=(W?.nietDoorgerekend||[]).filter(m=>m.netwerkschakel===s.code).length,assets=(typeof ASSET_REGISTER_STATE==='undefined'?[]:ASSET_REGISTER_STATE?.assets||[]).filter(a=>a.prognoseActief&&a.netwerkschakel===s.code);
      const weighted=(field)=>{const usable=parts.filter(p=>Number.isFinite(p[field])),n=usable.reduce((n,p)=>n+p.N,0);return !blinde&&n?usable.reduce((n,p)=>n+p[field]*p.N,0)/n:null;};
      const diensten=Object.fromEntries(DIENSTEN.map(d=>{const n=parts.reduce((n,p)=>n+p.N,0);return [d.id,!blinde&&n?parts.reduce((n,p)=>n+p.diensten[d.id].besch*p.N,0)/n:null];}));
      const kosten=W?.stats?.actueel?parts.filter(w=>w.n>0).map(kostenDagResultaat):[],known=kosten.filter(c=>Number.isFinite(c.kosten));
      return {s,parts,diensten,blinde,kosten:known.length?known.reduce((n,c)=>n+c.kosten,0):null,kostenCompleet:known.length>0&&known.length===kosten.length,assets:new Set(assets.map(a=>a.key)).size,n:parts.reduce((n,p)=>n+p.n,0),besch:weighted('besch'),prestatie:weighted('prestatie')};
    });
  }
  function reportHtml(){
    const rows=reportRows(),S=state();if(!S)return '<p>Laad de netwerkschakelmatrix via Bronbeheer om op netwerkschakels te rapporteren. Tot die tijd gebruikt de berekening de bestaande wegindeling.</p>';
    const rest=(typeof STATE==='undefined'?[]:STATE?.wegdelen||[]).filter(w=>!w.netwerkschakel);
    return `<div class="card"><h3>Netwerkschakels uit de matrix</h3><p>Bron ${esc(S.bestand)}. ${rows.length} netwerkschakels. Rijrichtingen worden apart doorgerekend. Het schakelgemiddelde weegt met hetzelfde areaalgewicht als het netwerk. HMP-richting is geen rijrichting. Zonder gekoppeld areaal of actuele bron blijft het resultaat onbekend.</p><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Code</th><th>Netwerkschakel</th><th>VC</th><th>HMP-grenzen</th><th>Bronstatus</th><th>Actieve assets</th><th>Open herkende storingen</th><th>Niet doorgerekend</th><th>MSI beschikbaarheid</th>${DIENSTEN.map(d=>`<th>${esc(d.naam||d.id)}</th>`).join('')}<th>Kosten per brondag</th><th>Rekenverslag per richting</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.s.code)}</td><td>${esc(r.s.naam)}</td><td>${esc(r.s.vc)}</td><td>${S.schakels.filter(s=>s.code===r.s.code).map(s=>esc(s.van+' tot '+s.tot)).join('<br>')}</td><td>${esc(r.s.status)}<br>${esc(r.s.controlepunt)}</td><td>${r.assets}</td><td>${typeof STATE!=='undefined'&&STATE?.stats?.actueel?r.n+r.blinde:'Onbekend'}</td><td>${typeof STATE!=='undefined'&&STATE?.stats?.actueel?r.blinde:'Onbekend'}</td><td>${r.besch===null?'Onbekend':fmt(r.besch,2)+'%'}</td>${DIENSTEN.map(d=>`<td>${r.diensten[d.id]===null?'Onbekend':fmt(r.diensten[d.id],2)+'%'}</td>`).join('')}<td>${r.kosten===null?'Onbekend':kostenEuro(r.kosten)+(r.kostenCompleet?'':' bekend subtotaal')}</td><td>${r.parts.map(w=>`<button class="tb-btn" onclick="openNetwerkschakelVerslag('${encodeURIComponent(w.key).replace(/'/g,'%27')}')">${esc(w.richting||'Zijde onbekend')}</button>`).join('')||'Geen gekoppeld areaal'}</td></tr>`).join('')}</tbody></table></div><p>${rest.reduce((n,w)=>n+w.n,0)} doorgerekende meldingen vallen buiten een eenduidige netwerkschakelkoppeling. Ze blijven apart zichtbaar in de detailtabel en de kosten. Voorlopige grenzen blijven scenario-invoer. Dienstpercentages volgen de bestaande ketenformules, geen bewijs van volledige brondekking. De kosten zijn een som van richtingsscenario’s, controleer overlap.</p></div>`;
  }
  async function load(file){
    if(!window.XLSX)throw Error('De Excel-lezer is niet beschikbaar. Herlaad de pagina.');
    zetImportVoortgang(file.name,10,'Netwerkschakelmatrix lezen',{direct:true});await uiPauze();
    const book=XLSX.read(await file.arrayBuffer(),{type:'array',raw:true});let rows=null;
    for(const name of book.SheetNames){
      const part=XLSX.utils.sheet_to_json(book.Sheets[name],{defval:'',raw:true});
      if(part.length&&Object.keys(part[0]).map(header).includes('hmpvan')&&Object.keys(part[0]).map(header).includes('hmptot')){
        if(rows)throw Error('Meerdere werkbladen bevatten een netwerkschakelmatrix. Gebruik één matrixblad.');rows=part;
      }
    }
    const next=parse(rows,file.name); // eerst volledig valideren, pas daarna vervangen
    zetImportVoortgang(file.name,55,'Assets en storingen aan netwerkschakels koppelen',{direct:true});await uiPauze();
    window.DVM_NETWERKSCHAKELS_STATE=next;cache=null;window.invalidateDvmForecast?.();
    await datasetNaMutatie('Netwerkschakelmatrix geladen; areaal en doorrekening opnieuw opgebouwd.');
    importKlaar(file.name,'Netwerkschakelmatrix geladen');
    return next;
  }
  window.netwerkschakelsActief=()=>!!state();
  window.normaliseerNetwerkschakels=parse;
  window.koppelNetwerkschakel=match;
  window.netwerkClassificeer=classify;
  window.netwerkPrepare=prepare;
  window.netwerkBasisKey=basis;
  window.netwerkBestuurKey=groupKey;
  window.netwerkLeegAggregate=empty;
  window.netwerkAreaalVoor=areaal;
  window.netwerkAggregateInfo=info;
  window.netwerkRegister=register;
  window.netwerkRapportRijen=reportRows;
  window.netwerkRapportHtml=reportHtml;
  window.leesNetwerkschakelBestand=load;
  window.herstelNetwerkschakels=b=>{window.DVM_NETWERKSCHAKELS_STATE=b?parse(b.rijen,b.bestand):null;cache=null;window.invalidateDvmForecast?.();if(!b&&typeof ASSET_REGISTER_STATE!=='undefined')for(const a of ASSET_REGISTER_STATE?.assets||[])classify(a);};
  window.openNetwerkschakelVerslag=key=>{WV_SEL=decodeURIComponent(key);renderWegdeelverslag();toonTab('wegdeelverslag');};
  const render=renderWegdelen;
  renderWegdelen=function(){if(!STATE){document.getElementById('tab-wegdelen').innerHTML=reportHtml();return;}const result=render.apply(this,arguments);document.getElementById('tab-wegdelen')?.insertAdjacentHTML('afterbegin',reportHtml());return result;};
  const verslag=renderWegdeelverslag;
  renderWegdeelverslag=function(){if(!STATE?.wegdelen?.length){document.getElementById('tab-wegdeelverslag').innerHTML=reportHtml();return;}const result=verslag.apply(this,arguments),w=STATE.wegdelen.find(w=>w.key===WV_SEL);if(w?.netwerkschakel)document.getElementById('tab-wegdeelverslag').insertAdjacentHTML('afterbegin',`<p class="dataset-note">Netwerkschakel ${esc(w.netwerkschakel)}, ${esc(w.netwerkStatus)}. HMP-grenzen ${esc(w.netwerkGrenzen.map(g=>g.van+' tot '+g.tot).join(', '))}. Bron ${esc(w.netwerkBron)}. Areaal geteld binnen deze grenzen en rijrichting.</p>`);return result;};
  window.__BIDASH_NETWERKSCHAKELS_ACTIVE__=true;
})();
