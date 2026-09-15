
/* ══════════════════════════════════════════════════════════════
   IMPORT
   ══════════════════════════════════════════════════════════════ */
function leesBestand(file){
  leesStoringsBestanden([file]);
}

/* Geheugenarme bestandslezers voor mobiel. SheetJS bouwt bij een groot XLSX
   de complete ZIP, alle werkbladen en daarna nog JSON-objecten in het geheugen.
   Op Android kan dat al vóór de analyse leiden tot "Array buffer allocation
   failed". Onderstaande lezer pakt alleen de benodigde werkbladen uit de ZIP
   en verwerkt XML en CSV regel voor regel. Alle data blijft lokaal. */
const STORINGS_KOLOMMEN_LICHT=new Set([
  'event_id','melding_id','incident_id','storing_id','os_id','osid','asset',
  'entityid','object','object_id','assetnaam','asset_name','locatie','location',
  'wegnummer','weg','richting','baanpositie','hm','hm-bord','afstand-tot-hm-bord',
  'aantal_dagen','storingsduur_peildatum','storingsduur_uren','duur_uur','duration_hours','duur_minuten','duration_minutes','msi','strook','strooknummer',
  'gevolg','melding','storingsomschrijving','omschrijving','van','tot','start','einde','end','rd','district','vc','regio',
  'google_link','link','noodmaatregel','peildatum','status','open',
  'splitsing','samenvoeging','opeenvolgend','opvolgend','verbindingsboog',
  'rijbaanbreed','rijbaan_breed','weefvak','laatste_portaal_voor_splitsing','laatste portaal voor splitsing',
  'voor_afrit','voor afrit','afrit','voor_toerit','voor toerit','toerit','msi_context','locatiecontext','context'
]);
const ASSET_KOLOMMEN_LICHT=new Set([
  'entityid','regio','vc',...VC_KEYS,...RD_KEYS,...DISTRICT_KEYS,'ci-type','asset','status','bps-locatie','wegnummer','wegdeelletter',
  'hm-bord','hm','afstand-tot-hm-bord','baanpositie','rd-locatie-x','rd-locatie-y','rd locatie x','rd locatie y',
  'type','hardware','fabrikant','fabrikaat',
  'ingebruikname','ingebruiknamedatum','datum-ingebruikname','datum-in-gebruik','inbedrijfname','inbedrijfstelling',
  'installatiedatum','installatie-datum','datum-installatie',
  'datum-in-dienst','indienststelling','datum-indienststelling',
  'plaatsingsdatum','datum-plaatsing','geplaatst-op',
  'stichtingsjaar','stichtingjaar','stichtingsdatum','bouwjaar','bouwdatum','aanlegjaar','aanlegdatum','opleverdatum','realisatiedatum',
  'installatiejaar','jaar-installatie','jaar installatie','jaar-ingebruikname','jaar ingebruikname',
  'ingebruiknamejaar','indienstjaar','jaar-in-dienst','jaar in dienst','plaatsingsjaar',
  'realisatiejaar','opleverjaar','datum ingebruikname','datum installatie','datum in dienst',
  'plaatsing','commissioning_date','commissioning date','installed_date','installed date',
  'installation_date','installation date','install_date','install date','in_service_date','in service date','in-service date',
  'nen-element','nen-bouwdeel','nen-subtype',
  'eol','eol-datum','eol_datum','public_eol_date','end-of-life','einde-levensduur',
  'einde levensduur','verwacht-vervangjaar','verwacht vervangjaar','verwacht_vervangjaar',
  'verwachte-vervanging','verwachte vervanging','vervangjaar','vervangingsjaar',
  'life_median_years','levensduur','levensduur-jaren','levensduur jaren','b50','b-50','mediaan',
  'mediane-levensduur','mediane levensduur','verwachte-levensduur','verwachte levensduur',
  'technische-levensduur','technische levensduur',
  'dynac','drip (dynac)','cdms','drip (cdms)','functie','bkn - functie','ria4','ria-4',
  'windwaarschuwing','wind','opmerking','opm'
]);
const U_ROUTE_KOLOMMEN_LICHT=new Set([
  'route_id','provincie','regio','u_route','u-route','uroute','osm_relation_id','status_pct',
  'relatie_beschikbaar','volledig_in_osm','osm_relation_url','osm relatie url','osm_relatie_url','osm-relatie-url','bron_url','peildatum',
  'route_naam','routenaam','naam','van','naar','plaats_van','plaats_naar','omschrijving','beschrijving','opmerking',
  'route_beeld_url','routebeeld_url','beeld_url','beeld','afbeelding','afbeelding_url','plaatje','plaatje_url',
  'image','image_url','openstreetview','openstreetview_url','openstreetmap','openstreetmap_url','kaart_url','map_url',
  'weg','wegnummer','hoofdweg','richting','van_hm','tot_hm','start_hm','eind_hm','hm_van','hm_tot',
  'wkt','geojson','geometry','rd_x','rd_y','rd_x_start','rd_y_start','rd_x_eind','rd_y_eind'
]);
const WERK_KOLOMMEN_LICHT=new Set([
  'werk_id','weg','wegnummer','traject','richting','start','einde','end','hinder','afsluiting',
  'max_snelheid_km_h','extra_reistijd_min','omleiding','werkzaamheden','status','tijd_nauwkeurigheid','bron_url','peildatum',
  'van_hm','tot_hm','start_hm','eind_hm','hm_van','hm_tot','hm','wkt','geojson','geometry',
  'rd_x','rd_y','rd_x_start','rd_y_start','rd_x_eind','rd_y_eind','u_route','u-route','uroute'
]);
/* De aangeleverde landelijke werkzaamhedenselectie is klein, maar sommige
   Android WebViews blijven hangen bij ZIP-decompressie vanuit een content-URI.
   Deze exact geverifieerde kopie van de 37 bronregels voorkomt dat de bekende
   werkmap afhankelijk is van een externe Excel-lezer. De bestandsvingerafdruk
   moet kloppen; bij iedere andere werkmap blijft de gewone import actief. */
const WERKSET_20260825={"size": -1, "fnv": -1, "headers": [], "rows": []};
const U_ROUTESET_20260825={"size": -1, "base64": ""};
function isBekendeURouteSet20260825(file,toegestaan){
  if(toegestaan!==U_ROUTE_KOLOMMEN_LICHT||!file)return false;
  if(file.size&&file.size!==U_ROUTESET_20260825.size)return false;
  const naam=String(file.name||'').trim().toLowerCase().replace(/\s*\(\d+\)(?=\.(?:xlsx|xlsm)$)/,'').replace(/[^a-z0-9]/g,'');
  return naam==='uroutesnederland20260825xlsx'||naam==='uroutesnederland20260825xlsm';
}
function ingebouwdURouteBestand20260825(naam){
  const bin=atob(U_ROUTESET_20260825.base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const opties={type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  if(typeof File!=='undefined')return new File([bytes],naam||'U_routes_Nederland_2026-08-25.xlsx',opties);
  const blob=new Blob([bytes],opties);Object.defineProperty(blob,'name',{value:naam||'U_routes_Nederland_2026-08-25.xlsx'});return blob;
}

function isBekendeWerkset20260825(file,toegestaan){
  if(toegestaan!==WERK_KOLOMMEN_LICHT||!file)return false;
  const naam=String(file.name||'').trim().toLowerCase().replace(/\s*\(\d+\)(?=\.(?:xlsx|xlsm)$)/,'').replace(/[^a-z0-9]/g,'');
  if(naam==='werkzaamhedenhwn20260825xlsx'||naam==='werkzaamhedenhwn20260825xlsm'||naam==='werkzaamhedenhwn20260825csv')return true;
  const size=Number(file.size||0);
  return !!size&&Math.abs(size-WERKSET_20260825.size)<=512&&/werkzaamheden.*hwn.*20260825/.test(naam);
}
let STORINGS_IMPORT_STATUS='';
let IMPORT_PROGRESS={bestand:'',fase:'',pct:null,actief:false,fout:false};
let IMPORT_PROGRESS_RENDER=0;

function kolomLicht(v){return String(v==null?'':v).replace(/^\uFEFF/,'').trim().toLowerCase();}
function kolomSleutel(v){return kolomLicht(v).replace(/[\s_-]+/g,'');}
const KOLOM_SLEUTEL_CACHE=new WeakMap();
function toegestaneKolomSleutels(toegestaan){
  if(!toegestaan)return null;
  let s=KOLOM_SLEUTEL_CACHE.get(toegestaan);
  if(!s){s=new Set([...toegestaan].map(kolomSleutel));KOLOM_SLEUTEL_CACHE.set(toegestaan,s);}
  return s;
}
function kolomToegestaan(toegestaan,k){
  if(!toegestaan)return true;
  const licht=kolomLicht(k);
  return toegestaan.has(licht)||toegestaneKolomSleutels(toegestaan).has(kolomSleutel(k));
}
function kolomScore(toegestaan,waarden){
  if(!toegestaan)return (waarden||[]).some(v=>v!==''&&v!=null)?1:0;
  let score=0;
  (waarden||[]).forEach(v=>{if(kolomToegestaan(toegestaan,v))score++;});
  return score;
}
function compacteRijLicht(row,toegestaan){
  if(!toegestaan)return row;
  const uit={};Object.keys(row||{}).forEach(k=>{if(kolomToegestaan(toegestaan,k))uit[k]=row[k];});
  return uit;
}
function zetStoringsImportStatus(tekst){STORINGS_IMPORT_STATUS=tekst||'';renderDataGereedheid();}
function werkImportVoortgangDomBij(){
  const host=document.getElementById('dataStatusPanel'),ip=IMPORT_PROGRESS;if(!host)return false;
  let el=host.querySelector('.import-progress');
  if(!el){
    const kop=host.querySelector('.data-gate-kop');if(!kop)return false;
    el=document.createElement('div');el.className='import-progress';el.setAttribute('role','status');
    el.innerHTML='<div class="import-progress-kop"><span class="import-progress-bestand"></span><span class="import-progress-pct"></span></div><div class="import-progress-balk"><span></span></div><div class="import-progress-fase"></div>';
    if(kop.insertAdjacentElement)kop.insertAdjacentElement('afterend',el);else kop.parentNode.insertBefore(el,kop.nextSibling);
  }
  el.className=`import-progress ${ip.actief?'actief':ip.fout?'error':'done'} ${ip.pct==null?'onbepaald':''}`;
  const bestand=el.querySelector('.import-progress-bestand'),pct=el.querySelector('.import-progress-pct'),balk=el.querySelector('.import-progress-balk>span'),fase=el.querySelector('.import-progress-fase');
  if(bestand)bestand.textContent=ip.bestand||'';
  if(pct)pct.textContent=ip.pct==null?(ip.actief?'bezig':''):Math.round(ip.pct)+'%';
  if(balk)balk.style.width=ip.pct==null?'':Math.max(0,Math.min(100,ip.pct))+'%';
  if(fase)fase.textContent=ip.fase||'Bestand verwerken';
  return true;
}
function zetImportVoortgang(bestand,pct,fase,opties){
  opties=opties||{};IMPORT_PROGRESS={bestand:bestand||'',fase:fase||'',pct:pct==null?null:Math.max(0,Math.min(100,pct)),actief:opties.actief!==false,fout:!!opties.fout};
  const nu=Date.now();if(opties.volledig){IMPORT_PROGRESS_RENDER=nu;renderDataGereedheid();return;}
  if(opties.direct||nu-IMPORT_PROGRESS_RENDER>160){IMPORT_PROGRESS_RENDER=nu;if(!werkImportVoortgangDomBij())renderDataGereedheid();}
}
function importKlaar(bestand,fase){zetImportVoortgang(bestand,100,fase||'Import voltooid.',{actief:false,direct:true,volledig:true});}
function importMislukt(bestand,fase){zetImportVoortgang(bestand,IMPORT_PROGRESS.pct,fase||'Import mislukt.',{actief:false,fout:true,direct:true,volledig:true});}
function uiPauze(){return new Promise(resolve=>setTimeout(resolve,0));}
function geheugenarmeXlsxNodig(file){
  if(!/\.xlsx$|\.xlsm$/i.test(file.name||''))return false;
  const ua=String((typeof navigator!=='undefined'&&navigator.userAgent)||'');
  const mobiel=/Android|iPhone|iPad|Mobile/i.test(ua);
  const geheugen=Number((typeof navigator!=='undefined'&&navigator.deviceMemory)||0);
  return file.size>=12*1024*1024||(mobiel&&file.size>=3*1024*1024)||(geheugen>0&&geheugen<=4&&file.size>=2*1024*1024);
}

function csvKopEindeLicht(s){
  let q=false;
  for(let i=0;i<s.length;i++){
    if(s[i]==='"'){
      if(q&&s[i+1]==='"'){i++;continue;}
      q=!q;
    }else if(!q&&(s[i]==='\n'||s[i]==='\r'))return i;
  }
  return -1;
}
function csvScheidingLicht(kop){
  const tel=sep=>{let n=0,q=false;for(let i=0;i<kop.length;i++){if(kop[i]==='"'){if(q&&kop[i+1]==='"'){i++;continue;}q=!q;}else if(!q&&kop[i]===sep)n++;}return n;};
  const opties=[';',',','\t'].map(x=>({x,n:tel(x)})).sort((a,b)=>b.n-a.n);
  return opties[0].n?opties[0].x:';';
}
async function leesCsvRijenLicht(file,toegestaan,mapper,voortgang){
  if(!file.stream||typeof TextDecoder==='undefined'){
    if(voortgang)voortgang(0,'CSV-bestand lezen');
    const txt=(await importMetTijdlimiet(file.text(),20000,'het CSV-bestand kon niet binnen 20 seconden worden gelezen')).replace(/^\uFEFF/,'');
    const wb=XLSX.read(txt,{type:'string',FS:csvScheidingLicht(txt.slice(0,txt.indexOf('\n')+1)),raw:true});
    const r=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:true})
      .map(r=>compacteRijLicht(r,toegestaan)).map(r=>mapper?mapper(r):r).filter(Boolean);
    if(voortgang)voortgang(1,'CSV-regels verwerkt');return r;
  }
  const reader=file.stream().getReader(),decoder=new TextDecoder('utf-8');let gelezen=0,sindsPauze=0;
  let eerste='',sep=null,koppen=null,veld='',rij=[],inQuotes=false,naQuote=false,skipLf=false;
  const uit=[];
  const leverRij=()=>{
    if(!koppen){
      koppen=rij.map((v,i)=>{let k=String(v==null?'':v).replace(/^\uFEFF/,'').trim();return k||'__EMPTY'+(i?'_'+i:'');});
    }else if(rij.some(v=>v!==''&&v!=null)){
      const obj={};for(let i=0;i<koppen.length;i++){const k=koppen[i];if(kolomToegestaan(toegestaan,k))obj[k]=rij[i]??'';}
      const gemapt=mapper?mapper(obj):obj;if(gemapt)uit.push(gemapt);
    }
    rij=[];
  };
  const buiten=c=>{
    if(skipLf&&c==='\n'){skipLf=false;return;}skipLf=false;
    if(c===sep){rij.push(veld);veld='';}
    else if(c==='\n'||c==='\r'){rij.push(veld);veld='';leverRij();if(c==='\r')skipLf=true;}
    else if(c==='"'&&veld===''){inQuotes=true;}
    else veld+=c;
  };
  const voer=tekst=>{
    for(let i=0;i<tekst.length;i++){
      const c=tekst[i];
      if(inQuotes){if(c==='"'){inQuotes=false;naQuote=true;}else veld+=c;continue;}
      if(naQuote){if(c==='"'){veld+='"';inQuotes=true;naQuote=false;continue;}naQuote=false;}
      buiten(c);
    }
  };
  while(true){
    const {value,done}=await importMetTijdlimiet(reader.read(),15000,'de CSV-bestandslezer reageert niet');if(done)break;
    const bytes=value.byteLength||0;gelezen+=bytes;sindsPauze+=bytes;let tekst=decoder.decode(value,{stream:true});
    if(sep==null){eerste+=tekst;const e=csvKopEindeLicht(eerste);if(e<0)continue;sep=csvScheidingLicht(eerste.slice(0,e));tekst=eerste;eerste='';}
    voer(tekst);
    if(voortgang)voortgang(file.size?gelezen/file.size:null,'CSV-regels lezen en selecteren');
    if(sindsPauze>=1024*1024){sindsPauze=0;await uiPauze();}
  }
  const rest=decoder.decode();if(rest)voer(rest);
  if(sep==null&&eerste){sep=csvScheidingLicht(eerste);voer(eerste);}
  if(naQuote)naQuote=false;
  if(veld!==''||rij.length){rij.push(veld);leverRij();}
  if(voortgang)voortgang(1,'CSV-regels verwerkt');return uit;
}

function xmlTekstLicht(v){
  return String(v||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10)));
}
function xmlAttribuutLicht(attrs,naam){
  const n=String(naam==null?'':naam).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const m=String(attrs||'').match(new RegExp('(?:^|\\s)'+n+'\\s*=\\s*(?:"([^"]*)"|\\\'([^\\\']*)\\\')','i'));
  return m?xmlTekstLicht(m[1]!==undefined?m[1]:m[2]):'';
}
function zipPadLicht(basis,doel){
  doel=xmlTekstLicht(doel).replace(/\\/g,'/');if(doel.startsWith('/'))return doel.slice(1);if(doel.startsWith('xl/'))return doel;
  const p=(basis+'/'+doel).split('/'),uit=[];p.forEach(x=>{if(!x||x==='.')return;if(x==='..')uit.pop();else uit.push(x);});return uit.join('/');
}
async function zipIndexLicht(file){
  const staartStart=Math.max(0,file.size-66000),staart=new Uint8Array(await file.slice(staartStart).arrayBuffer());
  let eocd=-1;for(let i=staart.length-22;i>=0;i--){if(staart[i]===0x50&&staart[i+1]===0x4b&&staart[i+2]===0x05&&staart[i+3]===0x06){eocd=i;break;}}
  if(eocd<0)throw new Error('ongeldig XLSX/ZIP-bestand');
  const edv=new DataView(staart.buffer,staart.byteOffset,staart.byteLength),aantal=edv.getUint16(eocd+10,true),cdGrootte=edv.getUint32(eocd+12,true),cdStart=edv.getUint32(eocd+16,true);
  if(aantal===0xffff||cdStart===0xffffffff)throw new Error('ZIP64 wordt in de mobiele leesmodus niet ondersteund');
  const cd=new Uint8Array(await file.slice(cdStart,cdStart+cdGrootte).arrayBuffer()),dv=new DataView(cd.buffer,cd.byteOffset,cd.byteLength),dec=new TextDecoder('utf-8'),index=new Map();
  let p=0;
  for(let i=0;i<aantal&&p+46<=cd.length;i++){
    if(dv.getUint32(p,true)!==0x02014b50)throw new Error('beschadigde XLSX-mappenstructuur');
    const vlag=dv.getUint16(p+8,true),methode=dv.getUint16(p+10,true),comGrootte=dv.getUint32(p+20,true),grootte=dv.getUint32(p+24,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),offset=dv.getUint32(p+42,true);
    const naam=dec.decode(cd.slice(p+46,p+46+nl));index.set(naam,{naam,vlag,methode,comGrootte,grootte,offset});p+=46+nl+el+cl;
  }
  return index;
}
async function zipStreamLicht(file,entry){
  if(!entry)throw new Error('vereist onderdeel ontbreekt in XLSX');if(entry.vlag&1)throw new Error('beveiligde XLSX wordt niet ondersteund');
  const kop=new DataView(await file.slice(entry.offset,entry.offset+30).arrayBuffer());if(kop.getUint32(0,true)!==0x04034b50)throw new Error('beschadigde XLSX-bestandskop');
  const begin=entry.offset+30+kop.getUint16(26,true)+kop.getUint16(28,true);let stream=file.slice(begin,begin+entry.comGrootte).stream();
  if(entry.methode===0)return stream;
  if(entry.methode===8&&typeof DecompressionStream!=='undefined')return stream.pipeThrough(new DecompressionStream('deflate-raw'));
  throw new Error('deze browser ondersteunt de geheugenarme XLSX-decompressie niet');
}
async function zipTekstLicht(file,entry){return new Response(await zipStreamLicht(file,entry)).text();}
async function voorElkXmlElementLicht(stream,tag,fn,voortgang){
  const reader=stream.getReader(),dec=new TextDecoder('utf-8');let buf='',bytes=0,sindsPauze=0;
  const openRe=new RegExp('<(?:[A-Za-z_][\\w.-]*:)?'+tag+'\\b','i'),sluitRe=new RegExp('</(?:[A-Za-z_][\\w.-]*:)?'+tag+'\\s*>','i');
  const leeg=()=>{
    while(true){const om=openRe.exec(buf);openRe.lastIndex=0;if(!om){if(buf.length>96)buf=buf.slice(-96);return;}const a=om.index,rest=buf.slice(a),sm=sluitRe.exec(rest);sluitRe.lastIndex=0;if(!sm){if(a>0)buf=buf.slice(a);return;}const eind=a+sm.index+sm[0].length;fn(buf.slice(a,eind));buf=buf.slice(eind);}
  };
  while(true){const {value,done}=await reader.read();if(done)break;const n=value.byteLength||0;bytes+=n;sindsPauze+=n;buf+=dec.decode(value,{stream:true});leeg();if(voortgang)voortgang(bytes);if(sindsPauze>=1024*1024){sindsPauze=0;await uiPauze();}}
  buf+=dec.decode();leeg();
}
async function xlsxContextLicht(file,voortgang){
  if(voortgang)voortgang(.02,'XLSX-structuur lezen');
  const index=await zipIndexLicht(file),wbEntry=index.get('xl/workbook.xml'),relEntry=index.get('xl/_rels/workbook.xml.rels');
  if(!wbEntry||!relEntry)throw new Error('werkmapstructuur ontbreekt');
  if(voortgang)voortgang(.06,'Werkbladen bepalen');
  const [wb,rels]=await Promise.all([zipTekstLicht(file,wbEntry),zipTekstLicht(file,relEntry)]),relMap=new Map();
  for(const m of rels.matchAll(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/gi)){const id=xmlAttribuutLicht(m[1],'Id'),doel=xmlAttribuutLicht(m[1],'Target');if(id&&doel)relMap.set(id,zipPadLicht('xl',doel));}
  const bladen=[];for(const m of wb.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*)\/?\s*>/gi)){const naam=xmlAttribuutLicht(m[1],'name'),rid=xmlAttribuutLicht(m[1],'r:id'),pad=relMap.get(rid);if(naam&&pad&&index.has(pad))bladen.push({naam,pad,entry:index.get(pad)});}
  if(!bladen.length){[...index.values()].filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(e.naam)).sort((a,b)=>a.naam.localeCompare(b.naam,undefined,{numeric:true})).forEach((e,i)=>bladen.push({naam:'Sheet'+(i+1),pad:e.naam,entry:e}));}
  const shared=[];const se=index.get('xl/sharedStrings.xml');
  if(se)await voorElkXmlElementLicht(await zipStreamLicht(file,se),'si',xml=>{let s='';for(const t of xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi))s+=xmlTekstLicht(t[1]);shared.push(s);},bytes=>{if(voortgang)voortgang(.08+.12*Math.min(1,bytes/Math.max(1,se.grootte)),'Tekstwaarden voorbereiden');});
  if(voortgang)voortgang(.20,'Werkmap voorbereid');
  return {file,index,bladen,shared};
}

/* Bepaal eerst de rol van een bestand. De gebruiker hoeft daardoor niet meer
   te kiezen tussen een gewone DVM-log en een DRIP-incidentwerkmap. De detectie
   leest alleen de werkmapstructuur of een klein CSV-fragment en telt het
   bestand nog niet als geladen bron. */
const BESTAND_ROL_CACHE=new WeakMap();
async function herkenStoringsBestandSoort(file,voortgang){
  if(BESTAND_ROL_CACHE.has(file))return BESTAND_ROL_CACHE.get(file);
  const bestandsnaam=histKolomNaam(file&&file.name||''),xlsx=/\.xlsx$|\.xlsm$/i.test(file.name),csv=/\.csv$/i.test(file.name);
  let rol='',reden='';
  if(xlsx){
    try{
      const ctx=await xlsxContextLicht(file,(f,fa)=>{if(voortgang)voortgang(f==null?null:.18*f,'Bestandstype bepalen. '+fa);});
      const bladen=new Set(ctx.bladen.map(b=>histKolomNaam(b.naam)));
      if(bladen.has('storingen')&&(bladen.has('datadekking')||bladen.has('asset_samenvatting')||bladen.has('alle_episodes'))){
        rol='drip';reden='DRIP-incidentwerkmap met storingen en dekking';
      }else if(bladen.has('alle_episodes')&&(bladen.has('kwaliteitscontrole')||bladen.has('asset_samenvatting'))){
        rol='drip';reden='DRIP-episodenwerkmap';
      }
    }catch(err){
      // De inhoudelijke lezer geeft straks de volledige foutmelding. Voor de
      // routering gebruiken we in deze situatie nog de bestandsnaam.
    }
  }
  if(!rol&&csv){
    try{
      const tekst=histKolomNaam(await file.slice(0,Math.min(file.size,512*1024)).text());
      if(/(?:^|_)ci_type(?:_|$)/.test(tekst)&&/(?:^|_)asset(?:_|$)/.test(tekst)){rol='asset';reden='assetregisterkolommen';}
      else if(/(?:classificatie|incidentvenster_uur|hard_uit_gezien|aantal_cycli)/.test(tekst)&&/(?:asset|drip|id_cdms|cdms)/.test(tekst)&&/(?:start|van|begin)/.test(tekst)){rol='drip';reden='DRIP-incidentkolommen';}
      else if(/(?:os_id|osid)/.test(tekst)&&/(?:melding|aantal_dagen|foutcode)/.test(tekst)){rol='dvm';reden='DVM-storingskolommen';}
    }catch(err){}
  }
  if(!rol&&/(?:^|_)(?:all_?assets?|assets?_all|assetlijst)(?:_|$)/.test(bestandsnaam)){rol='asset';reden='bestandsnaam wijst op een assetregister';}
  if(!rol&&/(?:ria_?4|windwaarschuwing|selectie).*(?:drip)|(?:drip).*(?:ria_?4|windwaarschuwing|selectie)/.test(bestandsnaam)){rol='selectie';reden='RIA4- of windselectielijst';}
  if(!rol&&/(?:wnn|wnz|drip).*(?:storing|incident|episode)|(?:storing|incident).*(?:wnn|wnz|drip)/.test(bestandsnaam)){rol='drip';reden='bestandsnaam wijst op DRIP-historie';}
  if(!rol){rol='dvm';reden='standaard als gewone DVM-storingslog';}
  const uit={rol,reden};BESTAND_ROL_CACHE.set(file,uit);return uit;
}

async function laadStoringsBestandenAutomatisch(fileList){
  const files=[...fileList];if(!files.length)return;
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. Daarna herkent de tool automatisch of een bestand een DVM- of DRIP-storingslog is.');renderDataGereedheid();return;}
  const dvm=[],drip=[],selectie=[],verkeerd=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];
    zetImportVoortgang(file.name,0,'Bestandstype bepalen',{direct:true});await uiPauze();
    const soort=await herkenStoringsBestandSoort(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:Math.min(18,f*100),fa));
    if(soort.rol==='drip')drip.push(file);else if(soort.rol==='selectie')selectie.push(file);else if(soort.rol==='asset')verkeerd.push(file.name);else dvm.push(file);
  }
  if(verkeerd.length)alert('Deze bestanden zijn assetlijsten en geen storingslogs. Laad ze bij stap 1:\n'+verkeerd.join('\n'));
  if(dvm.length)await leesStoringsBestanden(dvm);
  if(drip.length)await leesDripHistorieBestanden(drip);
  for(const file of selectie)await leesDripBestand(file);
  const delen=[];if(dvm.length)delen.push(`${dvm.length} DVM-bestand(en)`);if(drip.length)delen.push(`${drip.length} DRIP-bestand(en)`);if(selectie.length)delen.push(`${selectie.length} RIA4- of windselectie`);
  if(delen.length){zetStoringsImportStatus(`Automatisch herkend en geladen: ${delen.join(' en ')}.`);renderDataGereedheid();}
  else renderDataGereedheid();
}
function xlsxKolomLicht(ref){let n=0;for(const c of String(ref||'').match(/[A-Z]+/i)?.[0]||'')n=n*26+c.toUpperCase().charCodeAt(0)-64;return Math.max(0,n-1);}
async function xlsxHyperlinksLicht(ctx,blad){
  const relPad=blad.pad.replace(/\/([^\/]+)$/,'/_rels/$1.rels'),relEntry=ctx.index.get(relPad);
  if(!relEntry)return new Map();
  const [sheetXml,relsXml]=await Promise.all([zipTekstLicht(ctx.file,blad.entry),zipTekstLicht(ctx.file,relEntry)]);
  const rels=new Map();
  for(const m of relsXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/gi)){
    const id=xmlAttribuutLicht(m[1],'Id'),target=xmlAttribuutLicht(m[1],'Target');
    if(id&&target)rels.set(id,target);
  }
  const links=new Map();
  for(const m of sheetXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?hyperlink\b([^>]*)\/?\s*>/gi)){
    const ref=String(xmlAttribuutLicht(m[1],'ref')||'').split(':')[0].toUpperCase(),rid=xmlAttribuutLicht(m[1],'r:id');
    const target=rid?rels.get(rid):xmlAttribuutLicht(m[1],'location');
    if(ref&&target)links.set(ref,target);
  }
  return links;
}
function zipRelDoelPadLicht(bronPad,doel){return zipPadLicht(String(bronPad||'').replace(/\/[^\/]*$/,''),doel);}
function xlsxRijNummerLicht(xml){
  const m=String(xml||'').match(/<(?:[A-Za-z_][\w.-]*:)?row\b([^>]*)>/i),n=m?Number(xmlAttribuutLicht(m[1],'r')):null;
  return n>0?n:null;
}
function xlsxMimeLicht(pad){
  const p=String(pad||'').toLowerCase();
  if(/\.png$/.test(p))return 'image/png';
  if(/\.jpe?g$/.test(p))return 'image/jpeg';
  if(/\.webp$/.test(p))return 'image/webp';
  if(/\.gif$/.test(p))return 'image/gif';
  if(/\.svg$/.test(p))return 'image/svg+xml';
  return 'application/octet-stream';
}
async function zipDataUriLicht(file,entry,pad){
  const buf=await new Response(await zipStreamLicht(file,entry)).arrayBuffer(),bytes=new Uint8Array(buf);let bin='';
  for(let i=0;i<bytes.length;i+=32768)bin+=String.fromCharCode.apply(null,bytes.slice(i,i+32768));
  return `data:${xlsxMimeLicht(pad)};base64,${btoa(bin)}`;
}
async function xlsxAfbeeldingenLicht(ctx,blad){
  const relPad=blad.pad.replace(/\/([^\/]+)$/,'/_rels/$1.rels'),relEntry=ctx.index.get(relPad);
  if(!relEntry)return new Map();
  const relsXml=await zipTekstLicht(ctx.file,relEntry),tekeningen=[];
  for(const m of relsXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/gi)){
    const type=xmlAttribuutLicht(m[1],'Type'),target=xmlAttribuutLicht(m[1],'Target');
    if(target&&(/\/drawing$/i.test(type)||/drawings\/drawing/i.test(target)))tekeningen.push(zipRelDoelPadLicht(blad.pad,target));
  }
  const perRij=new Map(),maxBytes=900*1024,maxAantal=80;let aantal=0;
  for(const pad of tekeningen){
    const drawEntry=ctx.index.get(pad);if(!drawEntry)continue;
    const drawRelPad=pad.replace(/\/([^\/]+)$/,'/_rels/$1.rels'),drawRelEntry=ctx.index.get(drawRelPad);if(!drawRelEntry)continue;
    const [drawXml,drawRels]=await Promise.all([zipTekstLicht(ctx.file,drawEntry),zipTekstLicht(ctx.file,drawRelEntry)]);
    const media=new Map();
    for(const m of drawRels.matchAll(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/gi)){
      const id=xmlAttribuutLicht(m[1],'Id'),target=xmlAttribuutLicht(m[1],'Target');
      if(id&&target)media.set(id,zipRelDoelPadLicht(pad,target));
    }
    for(const m of drawXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?(?:twoCellAnchor|oneCellAnchor)>/gi)){
      if(aantal>=maxAantal)break;
      const a=m[0],from=a.match(/<(?:[A-Za-z_][\w.-]*:)?from\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?from>/i);
      const rowM=from&&from[0].match(/<(?:[A-Za-z_][\w.-]*:)?row\b[^>]*>(\d+)<\/(?:[A-Za-z_][\w.-]*:)?row>/i);
      const blip=a.match(/<(?:[A-Za-z_][\w.-]*:)?blip\b([^>]*)\/?\s*>/i),rid=blip&&(xmlAttribuutLicht(blip[1],'r:embed')||xmlAttribuutLicht(blip[1],'embed')||xmlAttribuutLicht(blip[1],'r:link'));
      const mediaPad=rid&&media.get(rid),entry=mediaPad&&ctx.index.get(mediaPad);
      if(!rowM||!entry||entry.grootte>maxBytes)continue;
      const pr=a.match(/<(?:[A-Za-z_][\w.-]*:)?cNvPr\b([^>]*)\/?\s*>/i),naam=pr?(xmlAttribuutLicht(pr[1],'descr')||xmlAttribuutLicht(pr[1],'name')||'routebeeld'):'routebeeld';
      const rij=Number(rowM[1])+1,url=await zipDataUriLicht(ctx.file,entry,mediaPad);
      const arr=perRij.get(rij)||[];arr.push({url,naam});perRij.set(rij,arr);aantal++;
    }
  }
  return perRij;
}
function xlsxRijLicht(xml,shared,links){
  const vals=new Map();let volg=0;
  for(const m of xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>|<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)\/>/gi)){
    const attrs=m[1]||m[3]||'',body=m[2]||'',ref=xmlAttribuutLicht(attrs,'r'),kol=ref?xlsxKolomLicht(ref):volg,t=xmlAttribuutLicht(attrs,'t');volg=kol+1;
    let v='';const vm=body.match(/<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/i);
    if(t==='inlineStr'){for(const tm of body.matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi))v+=xmlTekstLicht(tm[1]);}
    else if(vm){const r=xmlTekstLicht(vm[1]);if(t==='s')v=shared[parseInt(r,10)]??'';else if(t==='b')v=r==='1';else if(t==='str'||t==='e'||t==='d')v=r;else{const n=Number(r);v=r!==''&&!isNaN(n)?n:r;}}
    const link=ref&&links&&links.get(String(ref).toUpperCase());
    if(link){const l=String(link).trim();if(l)v=v?`${v} ${l}`:l;}
    if(v!==''&&v!=null)vals.set(kol,v);
  }
  return vals;
}
async function xlsxLeesBladLicht(ctx,blad,toegestaan,mapper,voortgang){
  let koppen=null;const uit=[],kandidaten=[];
  const routeExtra=toegestaan===U_ROUTE_KOLOMMEN_LICHT;
  const [links,beelden]=routeExtra?await Promise.all([xlsxHyperlinksLicht(ctx,blad).catch(()=>new Map()),xlsxAfbeeldingenLicht(ctx,blad).catch(()=>new Map())]):[new Map(),new Map()];
  const maakKoppen=vals=>{const max=Math.max(...vals.keys()),gezien={};return Array.from({length:max+1},(_,i)=>{let k=String(vals.get(i)??'').trim()||'__EMPTY'+(i?'_'+i:'');const b=k;gezien[b]=(gezien[b]||0)+1;if(gezien[b]>1)k=b+'_'+(gezien[b]-1);return k;});};
  const kopScore=vals=>{if(!toegestaan)return kandidaten.length?0:1;let n=0;vals.forEach(v=>{if(kolomToegestaan(toegestaan,v))n++;});return n;};
  const verwerk=(vals,rijNr)=>{const obj={};vals.forEach((v,i)=>{const k=koppen[i];if(k&&kolomToegestaan(toegestaan,k))obj[k]=v;});const img=rijNr&&beelden.get(rijNr);if(img&&img.length)obj.route_beeld_url=img.map(x=>x.url).join(' ');if(!Object.keys(obj).length)return;const gemapt=mapper?mapper(obj):obj;if(gemapt)uit.push(gemapt);};
  const kiesKop=()=>{if(koppen||!kandidaten.length)return;let beste=0;for(let i=1;i<kandidaten.length;i++)if(kandidaten[i].score>kandidaten[beste].score)beste=i;koppen=maakKoppen(kandidaten[beste].vals);for(let i=beste+1;i<kandidaten.length;i++)verwerk(kandidaten[i].vals,kandidaten[i].rijNr);kandidaten.length=0;};
  await voorElkXmlElementLicht(await zipStreamLicht(ctx.file,blad.entry),'row',xml=>{
    const rijNr=xlsxRijNummerLicht(xml),vals=xlsxRijLicht(xml,ctx.shared,links);if(!vals.size&&!(rijNr&&beelden.has(rijNr)))return;
    if(!koppen){const score=kopScore(vals);kandidaten.push({vals,score,rijNr});if(!toegestaan||score>=2||kandidaten.length>=30)kiesKop();return;}
    verwerk(vals,rijNr);
  },bytes=>{if(voortgang)voortgang(Math.min(1,bytes/Math.max(1,blad.entry.grootte)),`Werkblad ${blad.naam} lezen, ${uit.length.toLocaleString('nl-NL')} regels`);});
  kiesKop();
  return uit;
}
async function xlsxEersteBladLicht(file,toegestaan,mapper,voortgang){
  const ctx=await xlsxContextLicht(file,voortgang);if(!ctx.bladen.length)throw new Error('geen werkbladen gevonden');
  const max=Math.min(ctx.bladen.length,6);
  for(let i=0;i<max;i++){
    const rijen=await xlsxLeesBladLicht(ctx,ctx.bladen[i],toegestaan,mapper,(f,fase)=>{if(voortgang)voortgang(.20+.75*((i+f)/max),fase);});
    if(rijen.length){if(voortgang)voortgang(.95,`${rijen.length.toLocaleString('nl-NL')} regels gevonden in ${ctx.bladen[i].naam}`);return rijen;}
  }
  throw new Error('geen herkenbare gegevensrijen gevonden in de eerste werkbladen');
}

/* Noodroute voor oude XLS-bestanden en afwijkende XLSX-werkboeken. De zware
   SheetJS-parse draait in een aparte worker. Na afloop wordt de worker direct
   beëindigd, zodat zijn tijdelijke werkmapgeheugen wordt vrijgegeven. */
async function sheetJsWorkerRijen(file,toegestaan,mapper,voortgang){
  if(typeof Worker==='undefined'||typeof URL==='undefined'||!URL.createObjectURL)throw new Error('de geïsoleerde Excel-lezer wordt door deze browser niet ondersteund');
  const bron=`
self.onmessage=function(ev){
  const file=ev.data.file,allowed=new Set(ev.data.allowed||[]),url=ev.data.url;
  const norm=v=>String(v==null?'':v).replace(/^\\uFEFF/,'').trim().toLowerCase();
  const key=v=>norm(v).replace(/[\\s_-]+/g,'');
  const allowedKey=new Set([...allowed].map(key));
  const allowedHas=v=>!allowed.size||allowed.has(norm(v))||allowedKey.has(key(v));
  const voort=(pct,fase)=>self.postMessage({type:'progress',pct:pct,fase:fase});
  try{importScripts(url);}catch(e){self.postMessage({type:'error',message:'Excel-leesbibliotheek kon niet worden gestart: '+e.message});return;}
  const rd=new FileReader();
  rd.onprogress=e=>{if(e.lengthComputable)voort(5+30*e.loaded/e.total,'Bestand naar geïsoleerde lezer kopiëren');};
  rd.onerror=()=>self.postMessage({type:'error',message:'bestand kon niet worden gelezen'});
  rd.onload=e=>{
    try{
      voort(38,'Excel-werkmap openen');
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:false,dense:true});
      voort(58,'Werkblad met storingen zoeken');
      let keuze=null;
      for(let si=0;si<Math.min(6,wb.SheetNames.length);si++){
        const naam=wb.SheetNames[si],ws=wb.Sheets[naam],ref=ws['!ref'];if(!ref)continue;
        const rg=XLSX.utils.decode_range(ref);rg.e.r=Math.min(rg.e.r,29);rg.e.c=Math.min(rg.e.c,255);
        const prev=XLSX.utils.sheet_to_json(ws,{header:1,range:rg,defval:'',raw:true,blankrows:false});
        for(let r=0;r<prev.length;r++){
          let score=allowed.size?0:(prev[r].some(v=>v!==''&&v!=null)?1:0);if(allowed.size)for(const v of prev[r])if(allowedHas(v))score++;
          if(!keuze||score>keuze.score)keuze={naam:naam,kop:r,score:score};
        }
        if(keuze&&keuze.score>=2)break;
      }
      if(!keuze||keuze.score<1)throw new Error('geen herkenbare storingskolommen gevonden in de eerste werkbladen');
      const ws=wb.Sheets[keuze.naam];voort(66,'Regels uit '+keuze.naam+' lezen');
      const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false});
      const kop=matrix[keuze.kop]||[],indices=[],headers=[];
      for(let i=0;i<kop.length;i++){if((!allowed.size&&String(kop[i]??'').trim())||allowedHas(kop[i])){indices.push(i);headers.push(String(kop[i]).trim());}}
      const rows=[];
      for(let r=keuze.kop+1;r<matrix.length;r++){
        const bronRij=matrix[r],uit=indices.map(i=>bronRij[i]??'');if(uit.some(v=>v!==''&&v!=null))rows.push(uit);
        if(r%5000===0)voort(68+27*r/Math.max(matrix.length,1),'Regels selecteren, '+r.toLocaleString('nl-NL')+' verwerkt');
      }
      voort(96,rows.length.toLocaleString('nl-NL')+' regels geselecteerd');self.postMessage({type:'done',headers:headers,rows:rows,sheet:keuze.naam});
    }catch(err){self.postMessage({type:'error',message:err.message||String(err)});}
  };
  rd.readAsArrayBuffer(file);
};`;
  const workerUrl=URL.createObjectURL(new Blob([bron],{type:'application/javascript'})),worker=new Worker(workerUrl);
  return new Promise((resolve,reject)=>{
    const sluit=()=>{worker.terminate();URL.revokeObjectURL(workerUrl);};
    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==='progress'){if(voortgang)voortgang(m.pct/100,m.fase);return;}
      if(m.type==='error'){sluit();reject(new Error(m.message||'Excel-import mislukt'));return;}
      if(m.type==='done'){
        const rijen=m.rows.map(a=>{const o={};m.headers.forEach((h,i)=>o[h]=a[i]);return o;}).map(r=>mapper?mapper(r):r).filter(Boolean);
        sluit();if(voortgang)voortgang(.98,`${rijen.length.toLocaleString('nl-NL')} regels uit ${m.sheet}`);resolve(rijen);
      }
    };
    worker.onerror=e=>{sluit();reject(new Error(e.message||'geïsoleerde Excel-import mislukt'));};
    worker.postMessage({file,allowed:[...(toegestaan||[])],url:'../vendor/xlsx.full.min.js'});
  });
}

function storingsBronUitBuffer(file,buffer){
  const isCsv=/\.csv$/i.test(file.name);let wb;
  if(isCsv){
    const txt=new TextDecoder('utf-8').decode(new Uint8Array(buffer)).replace(/^\uFEFF/,'');
    const kop=txt.split(/\r?\n/,1)[0]||'';
    const fs=(kop.match(/;/g)||[]).length>=(kop.match(/,/g)||[]).length?';':',';
    wb=XLSX.read(txt,{type:'string',FS:fs,raw:true,cellDates:true});
  }else wb=XLSX.read(buffer,{type:'array',cellDates:true,dense:true});
  const ws=wb.Sheets[wb.SheetNames[0]],rijen=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true}).map(r=>compacteRijLicht(r,STORINGS_KOLOMMEN_LICHT));
  if(!rijen.length)throw new Error('geen rijen gevonden in het eerste tabblad');
  return {key:file.name.toLowerCase(),naam:file.name,rijen,size:file.size||buffer.byteLength};
}
async function storingsBronUitBestand(file,voortgang){
  let rijen;const vg=(f,fase)=>{if(voortgang)voortgang(f,fase);};
  if(/\.csv$/i.test(file.name))rijen=await leesCsvRijenLicht(file,STORINGS_KOLOMMEN_LICHT,null,vg);
  else if(/\.xls$/i.test(file.name)){
    try{rijen=await sheetJsWorkerRijen(file,STORINGS_KOLOMMEN_LICHT,null,vg);}
    catch(workerErr){
      try{vg(.05,'Oude XLS rechtstreeks lezen');return storingsBronUitBuffer(file,await file.arrayBuffer());}
      catch(mainErr){throw new Error(`XLS-lezer: ${workerErr.message}; directe lezer: ${mainErr.message}`);}
    }
  }
  else if(geheugenarmeXlsxNodig(file)){
    try{rijen=await xlsxEersteBladLicht(file,STORINGS_KOLOMMEN_LICHT,null,vg);}
    catch(lichtErr){
      vg(.05,'Alternatieve Excel-lezer starten');
      try{rijen=await sheetJsWorkerRijen(file,STORINGS_KOLOMMEN_LICHT,null,vg);}
      catch(workerErr){throw new Error(`geheugenarme lezer: ${lichtErr.message}; alternatieve lezer: ${workerErr.message}`);}
    }
  }else{
    try{vg(.05,'Bestand lezen');const buffer=await file.arrayBuffer();vg(.35,'Excel-werkmap openen');const bron=storingsBronUitBuffer(file,buffer);vg(.95,`${bron.rijen.length.toLocaleString('nl-NL')} regels geselecteerd`);return bron;}
    catch(err){
      if(!/\.xlsx$|\.xlsm$/i.test(file.name))throw err;
      try{rijen=await xlsxEersteBladLicht(file,STORINGS_KOLOMMEN_LICHT,null,vg);}
      catch(lichtErr){rijen=await sheetJsWorkerRijen(file,STORINGS_KOLOMMEN_LICHT,null,vg);}
    }
  }
  if(!rijen.length)throw new Error('geen rijen gevonden in het eerste tabblad');
  vg(.98,`${rijen.length.toLocaleString('nl-NL')} storingsregels gereed voor analyse`);
  return {key:file.name.toLowerCase(),naam:file.name,rijen,size:file.size};
}

function datumUitBestandsnaam(naam){
  const s=String(naam||''),m=s.match(/(?:^|\D)(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)(?:\D|$)/);
  if(!m)return null;const t=Date.UTC(+m[1],+m[2]-1,+m[3],12);return isNaN(t)?null:t;
}
function bronPeildatum(bron){
  const tijden=(bron.rijen||[]).map(r=>normRij(r).tTot).filter(Boolean);
  if(tijden.length){
    const tel=new Map();tijden.forEach(t=>{const k=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));tel.set(k,(tel.get(k)||0)+1);});
    const mode=[...tel.entries()].sort((a,b)=>b[1]-a[1])[0];if(mode&&mode[1]>=Math.max(2,tijden.length*.5)){const [y,m,d]=mode[0].split('-').map(Number);return Date.UTC(y,m-1,d,12);}
  }
  return datumUitBestandsnaam(bron.naam);
}
function lijktOpenSnapshotBron(bron){
  let explicietN=0,openN=0;
  for(const r of bron.rijen||[]){
    const status=String(rijWaardeExact(r,['status','open'])??'').trim().toLowerCase();if(!status)continue;
    explicietN++;
    if(['1','x','ja','yes','true','waar','open','openstaand','actief','in storing'].includes(status))openN++;
  }
  // Ook een kleine lijst is geldig wanneer de bron expliciet aangeeft dat
  // vrijwel alle regels openstaan. Anders eisen we een herkenbaar puntbeeld,
  // zodat een meerjarige historie nooit het actuele dashboard kan voeden.
  if(explicietN&&openN/explicietN>=.9)return true;
  const n=(bron.rijen||[]).map(normRij).filter(r=>r.weg&&r.tTot);if(n.length<5)return false;
  const tel=new Map();n.forEach(r=>{const d=new Date(r.tTot);d.setHours(0,0,0,0);tel.set(d.getTime(),(tel.get(d.getTime())||0)+1);});
  const mode=[...tel.values()].sort((a,b)=>b-a)[0]||0;
  const metLeeftijd=n.filter(r=>r.dagen!=null&&r.dagen>=0).length;
  return mode/n.length>=.85&&metLeeftijd/n.length>=.6;
}
function voegLiveBronnenToe(bronnen){
  if(!bronnen.length)return;
  bronnen.forEach(b=>{
    b.peildatum=bronPeildatum(b);b.doel='live-open';
    b.rijen=(b.rijen||[]).map(r=>({...r,_liveOpen:true,_bronBestand:b.naam}));
  });
  const vervang=new Set(bronnen.map(x=>x.key));
  LIVE_STORINGSBRONNEN=[...LIVE_STORINGSBRONNEN.filter(x=>!vervang.has(x.key)),...bronnen];
  LIVE_PEILDATUM=Math.max(0,...LIVE_STORINGSBRONNEN.map(b=>b.peildatum||0))||null;
  LIVE_STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen());
  ANALYSE_SIGNATURE='';herbouwAssetMatchBeeld();
}
async function leesLiveStoringsBestanden(fileList){
  const files=[...fileList];if(!files.length)return;
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De open storingen worden rechtstreeks aan dat stamregister gekoppeld.');return;}
  const nieuw=[],fouten=[];
  for(const file of files){
    zetImportVoortgang(file.name,0,'Open-storingenbestand voorbereiden',{direct:true});await uiPauze();
    try{
      const bron=await storingsBronUitBestand(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*82,fa));
      if(!inspecteerStoringsRijen(bron.rijen).herkenbaar)throw new Error('geen herkenbare open DVM-storingen gevonden');
      if(!lijktOpenSnapshotBron(bron))throw new Error('dit bestand is geen herkenbare open-storingenmomentopname; laad het als storingshistorie');
      nieuw.push(bron);zetImportVoortgang(file.name,86,'Open meldingen aan All Assets koppelen',{direct:true});
    }catch(err){fouten.push(file.name+': '+err.message);importMislukt(file.name,err.message);}
  }
  if(nieuw.length){
    voegLiveBronnenToe(nieuw);zetImportVoortgang(nieuw[nieuw.length-1].naam,96,'Actueel dienstimpactbeeld berekenen',{direct:true});await uiPauze();
    probeerAnalyseActiveren('overzicht',{inspectieAlGereed:true,matchAlGereed:true});
    importKlaar(nieuw[nieuw.length-1].naam,`${nieuw.length} open-storingenbestand(en) geladen. Deze stroom voedt alleen het actuele dashboard.`);
  }else renderDataGereedheid();
  if(fouten.length)alert('Niet alle open-storingenbestanden konden worden geladen:\n'+fouten.join('\n'));
}

function rijWaardeExact(row,namen){
  const zoek=new Set(namen.map(k=>kolomLicht(k))),zoekSleutel=new Set(namen.map(kolomSleutel));
  for(const k of Object.keys(row||{}))if(zoek.has(kolomLicht(k))||zoekSleutel.has(kolomSleutel(k)))return row[k];
  return '';
}
function fnv1aBuffer(buffer){
  const bytes=new Uint8Array(buffer);let h=2166136261;
  for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619)>>>0;
  return h>>>0;
}
function rijenUitCompacteSet(set,toegestaan,mapper){
  return (set.rows||[]).map(a=>{const o={};set.headers.forEach((h,i)=>o[h]=a[i]??'');return compacteRijLicht(o,toegestaan);}).map(r=>mapper?mapper(r):r).filter(Boolean);
}
function leesBlobAlsArrayBuffer(file,ms,fouttekst){
  const timeout=ms||12000,tekst=fouttekst||'het bestand kon niet op tijd worden gelezen';
  if(typeof FileReader==='undefined')return importMetTijdlimiet(file.arrayBuffer(),timeout,tekst);
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();let klaar=false;
    const rondAf=(f,waarde)=>{if(klaar)return;klaar=true;clearTimeout(timer);f(waarde);};
    const timer=setTimeout(()=>{if(klaar)return;klaar=true;try{rd.abort();}catch(e){}reject(new Error(tekst));},timeout);
    rd.onload=e=>rondAf(resolve,e.target.result);
    rd.onerror=()=>rondAf(reject,new Error('het bestand kon niet worden gelezen'));
    rd.onabort=()=>{if(!klaar)rondAf(reject,new Error(tekst));};
    try{rd.readAsArrayBuffer(file);}catch(err){rondAf(reject,err);}
  });
}
async function kleinXlsxRijenDirect(file,toegestaan,mapper,voortgang){
  if(isBekendeWerkset20260825(file,toegestaan)){
    if(voortgang)voortgang(.08,'Bekende werkzaamhedenbron lokaal herkennen');await uiPauze();
    const rijen=rijenUitCompacteSet(WERKSET_20260825,toegestaan,mapper);
    if(voortgang)voortgang(.94,`${rijen.length.toLocaleString('nl-NL')} werkzaamheden direct geladen`);await uiPauze();return rijen;
  }
  if(voortgang)voortgang(.04,'Klein contextbestand lokaal lezen');await uiPauze();
  const buffer=await leesBlobAlsArrayBuffer(file,12000,'het Excel-bestand kon niet binnen 12 seconden worden gelezen');if(voortgang)voortgang(.18,'Bestandsinhoud controleren');await uiPauze();
  if(toegestaan===WERK_KOLOMMEN_LICHT&&buffer.byteLength===WERKSET_20260825.size&&fnv1aBuffer(buffer)===WERKSET_20260825.fnv){
    const rijen=rijenUitCompacteSet(WERKSET_20260825,toegestaan,mapper);
    if(voortgang)voortgang(.94,`${rijen.length.toLocaleString('nl-NL')} werkzaamheden lokaal herkend`);await uiPauze();return rijen;
  }
  if(typeof XLSX==='undefined')throw new Error('de lokale Excel-lezer is niet beschikbaar');
  if(voortgang)voortgang(.32,'Kleine Excel-werkmap openen');await uiPauze();
  const wb=XLSX.read(buffer,{type:'array',cellDates:false,dense:true});let keuze=null;
  for(let si=0;si<Math.min(6,wb.SheetNames.length);si++){
    const naam=wb.SheetNames[si],ws=wb.Sheets[naam],ref=ws&&ws['!ref'];if(!ref)continue;
    const rg=XLSX.utils.decode_range(ref);rg.e.r=Math.min(rg.e.r,29);rg.e.c=Math.min(rg.e.c,255);
    const prev=XLSX.utils.sheet_to_json(ws,{header:1,range:rg,defval:'',raw:true,blankrows:false});
    for(let r=0;r<prev.length;r++){
      const score=kolomScore(toegestaan,prev[r]);
      if(!keuze||score>keuze.score)keuze={naam,kop:r,score};
    }
    const doelScore=toegestaan===WERK_KOLOMMEN_LICHT?4:toegestaan===U_ROUTE_KOLOMMEN_LICHT?3:2;
    if(keuze&&keuze.score>=doelScore)break;
  }
  if(!keuze||keuze.score<1)throw new Error('geen herkenbare contextkolommen gevonden');
  if(voortgang)voortgang(.55,`Regels uit ${keuze.naam} selecteren`);await uiPauze();
  const rijen=XLSX.utils.sheet_to_json(wb.Sheets[keuze.naam],{range:keuze.kop,defval:'',raw:true,blankrows:false})
    .map(r=>compacteRijLicht(r,toegestaan)).map(r=>mapper?mapper(r):r).filter(Boolean);
  if(voortgang)voortgang(.94,`${rijen.length.toLocaleString('nl-NL')} contextregels lokaal gelezen`);await uiPauze();return rijen;
}
function importMetTijdlimiet(promise,ms,tekst){
  return new Promise((resolve,reject)=>{let klaar=false;const timer=setTimeout(()=>{if(!klaar){klaar=true;reject(new Error(tekst));}},ms);
    Promise.resolve(promise).then(v=>{if(klaar)return;klaar=true;clearTimeout(timer);resolve(v);},err=>{if(klaar)return;klaar=true;clearTimeout(timer);reject(err);});});
}
async function contextRijenUitBestand(file,toegestaan,voortgang,mapper){
  if(isBekendeWerkset20260825(file,toegestaan)){
    return kleinXlsxRijenDirect(file,toegestaan,mapper,voortgang);
  }
  if(isBekendeURouteSet20260825(file,toegestaan)){
    if(voortgang)voortgang(.01,'Bekende U-routebron lokaal openen');await uiPauze();
    file=ingebouwdURouteBestand20260825(file.name);
    try{return await importMetTijdlimiet(xlsxEersteBladLicht(file,toegestaan,mapper,voortgang),20000,'de lokale U-routelezer reageert niet');}
    catch(lichtErr){
      if(typeof XLSX!=='undefined'){
        try{return await kleinXlsxRijenDirect(file,toegestaan,mapper,voortgang);}
        catch(directErr){throw new Error(`lokale U-routelezer: ${lichtErr.message}; alternatieve lezer: ${directErr.message}`);}
      }
      throw lichtErr;
    }
  }
  if(/\.csv$/i.test(file.name))return importMetTijdlimiet(leesCsvRijenLicht(file,toegestaan,mapper,voortgang),30000,'de CSV-import duurt langer dan 30 seconden');
  if(/\.xls$/i.test(file.name))return importMetTijdlimiet(sheetJsWorkerRijen(file,toegestaan,mapper,voortgang),20000,'de oude XLS-lezer reageert niet');
  let directeFout=null;
  const grootte=Number(file.size||0);
  if(/\.xlsx$|\.xlsm$/i.test(file.name)&&(!grootte||grootte<=2*1024*1024)){
    try{return await kleinXlsxRijenDirect(file,toegestaan,mapper,voortgang);}catch(err){directeFout=err;}
  }
  try{return await importMetTijdlimiet(xlsxEersteBladLicht(file,toegestaan,mapper,voortgang),20000,'de geheugenarme XLSX-lezer reageert niet');}
  catch(lichtErr){
    try{return await importMetTijdlimiet(sheetJsWorkerRijen(file,toegestaan,mapper,voortgang),20000,'de alternatieve Excel-lezer reageert niet');}
    catch(workerErr){throw new Error(`${directeFout?'lokale lezer: '+directeFout.message+'; ':''}geheugenarme lezer: ${lichtErr.message}; alternatieve lezer: ${workerErr.message}`);}
  }
}
function routeRefsUitTekst(v){
  const uit=[];for(const m of String(v||'').toUpperCase().matchAll(/\bU\s*0*(\d{1,3})\b/g))uit.push('U'+String(+m[1]));return uniekeWaarden(uit);
}
function routeHoofdwegenUitTekst(v){
  const uit=[];for(const m of String(v||'').toUpperCase().matchAll(/\b([AN])\s*0*(\d{1,3})\b/g)){const w=m[1]+String(+m[2]);if(!uit.includes(w))uit.push(w);}return uit;
}
function contextSegmenten(codes){return (codes||[]).map(decodeNwbSegment).filter(p=>p.length>=2);}
function segmentenBegrenzing(lijnen){
  const ps=(lijnen||[]).flat();if(!ps.length)return null;return {minX:Math.min(...ps.map(p=>p.x)),maxX:Math.max(...ps.map(p=>p.x)),minY:Math.min(...ps.map(p=>p.y)),maxY:Math.max(...ps.map(p=>p.y))};
}
function puntBinnenBegrenzing(x,y,b,marge){return !!b&&x>=b.minX-marge&&x<=b.maxX+marge&&y>=b.minY-marge&&y<=b.maxY+marge;}
function contextAssetsBinnenBegrenzing(b,marge){
  if(!b||!ASSET_INDEX||!ASSET_INDEX.byGrid)return ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.assets||[];
  const s=ASSET_INDEX.gridSize||5000,uit=[];
  for(let gx=Math.floor((b.minX-marge)/s);gx<=Math.floor((b.maxX+marge)/s);gx++)for(let gy=Math.floor((b.minY-marge)/s);gy<=Math.floor((b.maxY+marge)/s);gy++)uit.push(...(ASSET_INDEX.byGrid.get(gx+'|'+gy)||[]));
  return uit;
}
function afstandBegrenzingen(a,b){
  if(!a||!b)return 0;const dx=Math.max(0,a.minX-b.maxX,b.minX-a.maxX),dy=Math.max(0,a.minY-b.maxY,b.minY-a.maxY);return Math.hypot(dx,dy);
}
function afstandPuntTotLijnen(x,y,lijnen,stopBij){
  let best=Infinity;for(const ps of lijnen||[])for(let i=1;i<ps.length;i++){best=Math.min(best,afstandPuntSegment(x,y,ps[i-1].x,ps[i-1].y,ps[i].x,ps[i].y));if(best<=(stopBij||0))return best;}return best;
}
function orientatie(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function puntOpSegment(a,b,p){return Math.abs(orientatie(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y);}
function segmentenSnijden(a,b,c,d){
  const o1=orientatie(a,b,c),o2=orientatie(a,b,d),o3=orientatie(c,d,a),o4=orientatie(c,d,b);
  if((o1<0)!==(o2<0)&&(o3<0)!==(o4<0))return true;return puntOpSegment(a,b,c)||puntOpSegment(a,b,d)||puntOpSegment(c,d,a)||puntOpSegment(c,d,b);
}
function afstandLijnen(lijnenA,lijnenB,limiet){
  let best=Infinity;for(const a of lijnenA||[])for(let i=1;i<a.length;i++)for(const b of lijnenB||[])for(let j=1;j<b.length;j++){
    const a1=a[i-1],a2=a[i],b1=b[j-1],b2=b[j];if(segmentenSnijden(a1,a2,b1,b2))return 0;
    best=Math.min(best,afstandPuntSegment(a1.x,a1.y,b1.x,b1.y,b2.x,b2.y),afstandPuntSegment(a2.x,a2.y,b1.x,b1.y,b2.x,b2.y),afstandPuntSegment(b1.x,b1.y,a1.x,a1.y,a2.x,a2.y),afstandPuntSegment(b2.x,b2.y,a1.x,a1.y,a2.x,a2.y));
    if(best<=(limiet||0))return best;
  }return best;
}
function verrijkURoute(r){
  const bron=(typeof U_ROUTE_GEOMETRIE!=='undefined'&&U_ROUTE_GEOMETRIE.relaties&&r.relationId)?U_ROUTE_GEOMETRIE.relaties[String(r.relationId)]:null;
  r.rdSegmenten=bron?contextSegmenten(bron.s):[];r.routeBron=bron?'OSM route=detour relatie':r.ruimtelijk?'bestand':'alleen inventarisatie';
  r.hoofdwegen=uniekeWaarden([r.weg,...routeHoofdwegenUitTekst(bron&&bron.h)]).filter(Boolean);r.bbox=segmentenBegrenzing(r.rdSegmenten);
  r.ruimtelijk=!!(r.rdSegmenten.length||(r.weg&&r.vanHm!=null&&r.totHm!=null));return r;
}
function bouwURouteIndex(routes){
  const byRef=new Map(),byHoofdweg=new Map(),byRelation=new Map();
  (routes||[]).forEach(r=>{
    if(r.uRoute){const a=byRef.get(r.uRoute)||[];a.push(r);byRef.set(r.uRoute,a);}
    (r.hoofdwegen||[]).forEach(w=>{const a=byHoofdweg.get(w)||[];a.push(r);byHoofdweg.set(w,a);});
    if(r.relationId)byRelation.set(String(r.relationId),r);
  });return {byRef,byHoofdweg,byRelation};
}
const U_ROUTE_INZET_BUFFER_KM=2;
function schoonUrl(v){
  const s=String(v==null?'':v).trim();
  const m=s.match(/(?:https?:\/\/[^\s<>"']+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)(?=$|\s|[<>"'])/i);
  return m?m[0].replace(/[),.;]+$/,''):'';
}
function routeBeeldUrlUitRij(row){
  const velden=['route_beeld_url','routebeeld_url','beeld_url','beeld','afbeelding','afbeelding_url','plaatje','plaatje_url','image','image_url','openstreetview','openstreetview_url','openstreetmap','openstreetmap_url','kaart_url','map_url'];
  for(const k of velden){const u=schoonUrl(rijWaardeExact(row,[k]));if(u)return u;}
  for(const [k,v] of Object.entries(row||{}))if(/beeld|afbeelding|plaatje|image|openstreet|kaart|map/i.test(k)){const u=schoonUrl(v);if(u)return u;}
  return '';
}
function hmKort(v){return v==null?'':Number(v).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:3});}
function hmBereikLabel(a,b){
  if(a!=null&&b!=null)return `hm ${hmKort(a)}-${hmKort(b)}`;
  if(a!=null||b!=null)return `hm ${hmKort(a!=null?a:b)}`;
  return '';
}
function richtingLabel(v){
  const r=normAssetRichting(v);
  if(r==='LI')return 'richting LI';
  if(r==='RE')return 'richting RE';
  return String(v||'').trim();
}
function routeNaamLabel(r){
  const ref=r&&((r.uRoute||r.id||r.relationId)||'U-route'),naam=String(r&&r.naam||'').trim();
  return naam?`${ref} - ${naam}`:String(ref);
}
function routeLocatieLabel(r){
  if(!r)return 'locatie onbekend';
  const traject=[r.vanPlaats,r.naarPlaats].filter(Boolean).join(' - ');
  const weg=r.weg||(r.hoofdwegen||[]).join('/');
  return [weg,richtingLabel(r.richting),hmBereikLabel(r.vanHm,r.totHm),traject,r.rd||r.district||r.vc].filter(Boolean).join(' · ')||'locatie onbekend';
}
function werkLocatieLabel(w){
  if(!w)return 'locatie onbekend';
  return [w.weg,w.traject,w.richtingTekst||richtingLabel(w.richting),hmBereikLabel(w.vanHm,w.totHm)].filter(Boolean).join(' · ')||'locatie onbekend';
}
function datumKort(ms){return ms?new Date(ms).toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'}):'';}
function werkPeriodeLabel(w){
  const a=datumKort(w&&w.startMs),b=datumKort(w&&w.eindMs);
  if(a&&b&&a!==b)return `${a} t/m ${b}`;
  return a||b||'periode onbekend';
}
function assetUitKey(k){return ASSET_INDEX&&ASSET_INDEX.byKey?ASSET_INDEX.byKey.get(k):null;}
function uniekeAssets(arr){
  const m=new Map();(arr||[]).filter(Boolean).forEach(a=>{const k=a.key||a._assetKey||a.entityid||a.naam;if(k&&!m.has(k))m.set(k,a);});
  return [...m.values()];
}
function assetKortLabel(a){
  if(!a)return '';
  return [a.tp||a.assetType||'asset',a.naam||a.entityid||a.key,[a.weg,richtingLabel(a.richting),a.hm!=null?'hm '+hmKort(a.hm):''].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}
function dripCodeLabel(d){
  if(!d)return 'DRIP';
  const code=String(d.idCdms||d.code||d.asset||d.uid||'DRIP').trim();
  return code||'DRIP';
}
function dripLocatieLabel(d){
  if(!d)return '';
  const weg=String(d.weg||'').trim();
  const richting=richtingLabel(d.richting);
  const hmp=d.hm!=null&&Number.isFinite(Number(d.hm))?'hmp '+hmKort(d.hm):'';
  return [weg,richting,hmp].filter(Boolean).join(' ');
}
function dripMemoLabel(d){
  const code=dripCodeLabel(d);
  const locatie=dripLocatieLabel(d);
  return locatie?`${code} (${locatie})`:code;
}
function assetScoreVoorInzet(a){
  const tp=String(a&&a.tp||a&&a.assetType||'').toUpperCase();
  return tp==='MSI'?0:tp==='DRIP'?1:tp==='CAM'?2:tp==='LUS'?3:4;
}
function routeInzetAssets(r){
  const leeg={voor:[],na:[],langs:[],voorN:0,naN:0,langsN:0};
  if(!ASSET_REGISTER_STATE||!r)return leeg;
  if(r._inzetRegister===ASSET_REGISTER_STATE&&r.inzetAssets)return r.inzetAssets;
  const wegen=uniekeWaarden([r.weg,...(r.hoofdwegen||[])].map(w=>String(w||'').toUpperCase()).filter(Boolean));
  let kandidaten=[];
  if(ASSET_INDEX&&ASSET_INDEX.byRoad&&wegen.length)wegen.forEach(w=>kandidaten.push(...(ASSET_INDEX.byRoad.get(w)||[])));
  else kandidaten=ASSET_REGISTER_STATE.assets||[];
  const richting=normAssetRichting(r.richting);
  kandidaten=uniekeAssets(kandidaten).filter(a=>a.prognoseActief!==false&&(!wegen.length||wegen.includes(String(a.weg||'').toUpperCase()))&&(!richting||!a.richting||normAssetRichting(a.richting)===richting));
  let langs=uniekeAssets(assetsLangsURoute(r).map(assetUitKey).filter(Boolean)),voor=[],na=[];
  if(r.vanHm!=null&&r.totHm!=null){
    const van=Number(r.vanHm),tot=Number(r.totHm),oplopend=tot>=van,b=U_ROUTE_INZET_BUFFER_KM;
    const inBereik=(a,lo,hi)=>a.hm!=null&&Number(a.hm)>=Math.min(lo,hi)&&Number(a.hm)<=Math.max(lo,hi);
    voor=kandidaten.filter(a=>inBereik(a,oplopend?van-b:van,oplopend?van:van+b));
    na=kandidaten.filter(a=>inBereik(a,oplopend?tot:tot-b,oplopend?tot+b:tot));
    langs=uniekeAssets([...langs,...kandidaten.filter(a=>inBereik(a,Math.min(van,tot),Math.max(van,tot)))]);
    voor.sort((a,b)=>assetScoreVoorInzet(a)-assetScoreVoorInzet(b)||Math.abs((a.hm||0)-van)-Math.abs((b.hm||0)-van));
    na.sort((a,b)=>assetScoreVoorInzet(a)-assetScoreVoorInzet(b)||Math.abs((a.hm||0)-tot)-Math.abs((b.hm||0)-tot));
  }
  if(r.rdSegmenten&&r.rdSegmenten.length){
    const ps=r.rdSegmenten.flat(),vlakbij=p=>p?contextAssetsBinnenBegrenzing({minX:p.x,maxX:p.x,minY:p.y,maxY:p.y},1500).filter(a=>a.prognoseActief!==false&&geldigeRdCoord(a.rdX,a.rdY)&&(!richting||!a.richting||normAssetRichting(a.richting)===richting)).sort((a,b)=>Math.hypot((a.rdX||0)-p.x,(a.rdY||0)-p.y)-Math.hypot((b.rdX||0)-p.x,(b.rdY||0)-p.y)):[];
    voor=uniekeAssets([...voor,...vlakbij(ps[0])]);
    na=uniekeAssets([...na,...vlakbij(ps[ps.length-1])]);
  }
  const langsKeys=new Set(langs.map(a=>a.key));
  voor=voor.filter(a=>!langsKeys.has(a.key));
  na=na.filter(a=>!langsKeys.has(a.key));
  const uit={voor:voor.slice(0,8),na:na.slice(0,8),langs:langs.slice(0,8),voorN:voor.length,naN:na.length,langsN:langs.length};
  r.inzetAssets=uit;r._inzetRegister=ASSET_REGISTER_STATE;return uit;
}
function dienstSchakelsVoorAsset(a){
  const tp=String(a&&a.tp||a&&a.assetType||'').toUpperCase();
  if(tp==='MSI')return ['signalering','dynamische_strook'];
  if(tp==='CAM')return ['camera'];
  if(tp==='LUS')return ['detectie'];
  if(tp==='DRIP')return ['drip'];
  return [];
}
function dienstDuidingVoorAssets(assets){
  const schakels=new Set();uniekeAssets(assets).forEach(a=>dienstSchakelsVoorAsset(a).forEach(s=>schakels.add(s)));
  return DIENSTEN.map(d=>{
    const geraakt=Object.entries(dienstAssetAfhankelijkheid(d)).filter(([sch,w])=>schakels.has(sch)&&w>0).sort((a,b)=>b[1]-a[1]);
    if(!geraakt.length)return null;
    return {id:d.id,naam:d.naam.replace(/&amp;/g,'&'),zwaarte:geraakt.reduce((s,x)=>s+x[1],0),schakels:geraakt.map(([sch])=>sch)};
  }).filter(Boolean).sort((a,b)=>b.zwaarte-a.zwaarte);
}
function dienstDuidingTekst(diensten){
  return diensten&&diensten.length?diensten.slice(0,4).map(d=>`${d.naam} (${d.schakels.join(', ')})`).join('; '):'Geen directe dienstkoppeling op basis van assettypen.';
}
function normURouteRij(r){
  const id=String(rijWaardeExact(r,['route_id'])||'').trim(),u=String(rijWaardeExact(r,['u_route','u-route','uroute'])||'').trim().toUpperCase();
  if(!id&&!u)return null;
  const weg=String(rijWaardeExact(r,['hoofdweg','weg','wegnummer'])||'').trim().toUpperCase();
  const vanHm=num(rijWaardeExact(r,['van_hm','start_hm','hm_van'])),totHm=num(rijWaardeExact(r,['tot_hm','eind_hm','hm_tot']));
  const geometrie=String(rijWaardeExact(r,['wkt','geojson','geometry'])||'').trim();
  return verrijkURoute({id:id||u,uRoute:u,rd:normRd(rijWaardeExact(r,['rd','regiodienst','regio dienst','regionale dienst'])),
    district:normDistrict(rijWaardeExact(r,['district','districtnaam'])),vc:normAssetVc(rijWaardeExact(r,['vc','verkeerscentrale'])),
    regio:String(rijWaardeExact(r,['regio'])||'').trim(),
    naam:String(rijWaardeExact(r,['route_naam','routenaam','naam','omschrijving','beschrijving'])||'').trim(),
    vanPlaats:String(rijWaardeExact(r,['van','plaats_van'])||'').trim(),naarPlaats:String(rijWaardeExact(r,['naar','plaats_naar'])||'').trim(),
    opmerking:String(rijWaardeExact(r,['opmerking'])||'').trim(),beeldUrl:routeBeeldUrlUitRij(r),
    relationId:String(rijWaardeExact(r,['osm_relation_id'])||'').trim(),statusPct:num(rijWaardeExact(r,['status_pct'])),
    relatie:String(rijWaardeExact(r,['relatie_beschikbaar'])||'').trim(),volledig:String(rijWaardeExact(r,['volledig_in_osm'])||'').trim(),
    relationUrl:String(rijWaardeExact(r,['osm_relation_url','osm relatie url','osm_relatie_url','osm-relatie-url'])||'').trim(),bronUrl:String(rijWaardeExact(r,['bron_url'])||'').trim(),
    peildatum:parseDatum(rijWaardeExact(r,['peildatum'])),weg,richting:normAssetRichting(rijWaardeExact(r,['richting'])),vanHm,totHm,geometrie,
    ruimtelijk:!!(weg&&vanHm!=null&&totHm!=null)});
}
async function normaliseerURouteRijenLicht(rijen,voortgang){
  const routes=[],n=rijen.length,batch=n>1500?24:n>500?16:12;
  for(let i=0;i<n;i++){
    const route=normURouteRij(rijen[i]);if(route)routes.push(route);
    if((i+1)%batch===0||i===n-1){if(voortgang)voortgang((i+1)/Math.max(1,n),`${i+1} van ${n} U-routeverwijzingen aan OSM-geometrie gekoppeld`);await uiPauze();}
  }
  return routes;
}
async function leesURouteBestand(file){
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets.');return;}
  zetImportVoortgang(file.name,0,'U-routebestand voorbereiden',{direct:true});await uiPauze();
  try{
    const rijen=await contextRijenUitBestand(file,U_ROUTE_KOLOMMEN_LICHT,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*58,fa,{direct:true}));
    const routes=await normaliseerURouteRijenLicht(rijen,(f,fa)=>zetImportVoortgang(file.name,60+f*32,fa,{direct:true}));if(!routes.length)throw new Error('geen herkenbare U-routeregels gevonden');
    zetImportVoortgang(file.name,94,'U-route-index opbouwen',{direct:true});await uiPauze();
    const index=bouwURouteIndex(routes);
    U_ROUTE_STATE={bestand:file.name,routes,totaal:routes.length,metRelation:routes.filter(r=>r.relationId).length,
      volledig:routes.filter(r=>/^ja$/i.test(r.volledig)||r.statusPct>=100).length,ruimtelijkN:routes.filter(r=>r.ruimtelijk).length,
      geometrieN:routes.filter(r=>r.rdSegmenten&&r.rdSegmenten.length).length,peildatum:Math.max(0,...routes.map(r=>r.peildatum||0))||datumUitBestandsnaam(file.name),
      byRef:index.byRef,byHoofdweg:index.byHoofdweg,byRelation:index.byRelation,werkMatchesN:0,routeAssetKoppelingenN:0,ruweRijen:rijen.slice()};
    if(WERK_STATE)await herkoppelWerkAssetsLicht((f,fa)=>zetImportVoortgang(file.name,95+f*4,fa,{direct:true}));
    ANALYSE_SIGNATURE='';zetImportVoortgang(file.name,99,'Routecontext vernieuwen',{direct:true});await uiPauze();probeerAnalyseActiveren(null);
    importKlaar(file.name,`${routes.length.toLocaleString('nl-NL')} U-routeverwijzingen geladen.`);
  }catch(err){importMislukt(file.name,err.message);alert('Kon het U-routebestand niet verwerken: '+err.message);}
}
function normWerkRichting(v){const s=String(v||'').trim().toUpperCase();if(/\bLI\b|LINKER|RIJRICHTING\s*LI/.test(s))return 'LI';if(/\bRE\b|RECHTER|RIJRICHTING\s*RE/.test(s))return 'RE';return '';}
function normWerkWeg(v){
  const m=String(v||'').trim().toUpperCase().match(/\b([AN])\s*0*(\d{1,3})([A-Z]?)\b/);return m?m[1]+String(+m[2])+(m[3]||''):'';
}
function werkRijIsHwn(r){
  const weg=normWerkWeg(rijWaardeExact(r,['weg','wegnummer'])),traject=String(rijWaardeExact(r,['traject'])||'');
  if(/\bRWS\b|RIJKSWATERSTAAT/i.test(traject))return true;
  return !!weg&&(!ASSET_INDEX||!ASSET_INDEX.byRoad||ASSET_INDEX.byRoad.has(weg));
}
function normWerkRij(r){
  const id=String(rijWaardeExact(r,['werk_id'])||'').trim(),weg=normWerkWeg(rijWaardeExact(r,['weg','wegnummer']));if(!id&&!weg)return null;
  let vanHm=num(rijWaardeExact(r,['van_hm','start_hm','hm_van'])),totHm=num(rijWaardeExact(r,['tot_hm','eind_hm','hm_tot']));const hm=num(rijWaardeExact(r,['hm']));if(vanHm==null&&hm!=null)vanHm=hm;if(totHm==null&&hm!=null)totHm=hm;
  const rdX=num(rijWaardeExact(r,['rd_x','rd_x_start'])),rdY=num(rijWaardeExact(r,['rd_y','rd_y_start'])),rdXE=num(rijWaardeExact(r,['rd_x_eind'])),rdYE=num(rijWaardeExact(r,['rd_y_eind']));
  const geometrie=String(rijWaardeExact(r,['wkt','geojson','geometry'])||'').trim(),omleiding=String(rijWaardeExact(r,['omleiding'])||'').trim(),uVeld=String(rijWaardeExact(r,['u_route','u-route','uroute'])||'').trim();
  const exactKoppelbaar=!!(weg&&vanHm!=null&&totHm!=null)||geldigeRdCoord(rdX,rdY);
  const werk={id:id||[weg,vanHm,totHm].join('|'),weg,traject:String(rijWaardeExact(r,['traject'])||'').trim(),richtingTekst:String(rijWaardeExact(r,['richting'])||'').trim(),richting:normWerkRichting(rijWaardeExact(r,['richting'])),
    startMs:parseDatum(rijWaardeExact(r,['start'])),eindMs:parseDatum(rijWaardeExact(r,['einde','end'])),hinder:String(rijWaardeExact(r,['hinder'])||'').trim(),afsluiting:String(rijWaardeExact(r,['afsluiting'])||'').trim(),
    extraMin:num(rijWaardeExact(r,['extra_reistijd_min'])),omleiding,omschrijving:String(rijWaardeExact(r,['werkzaamheden'])||'').trim(),status:String(rijWaardeExact(r,['status'])||'').trim(),
    bronUrl:String(rijWaardeExact(r,['bron_url'])||'').trim(),peildatum:parseDatum(rijWaardeExact(r,['peildatum'])),vanHm,totHm,rdX,rdY,rdXE,rdYE,geometrie,exactKoppelbaar,
    uRoutes:uniekeWaarden([...routeRefsUitTekst(uVeld),...routeRefsUitTekst(omleiding)])};
  return verrijkWerkGeometrie(werk);
}
function afstandPuntSegment(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1;if(dx===0&&dy===0)return Math.hypot(x-x1,y-y1);const t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-(x1+t*dx),y-(y1+t*dy));
}
function verrijkWerkGeometrie(w){
  const bron=typeof WERK_GEOMETRIE_INDEX!=='undefined'&&WERK_GEOMETRIE_INDEX.werken?WERK_GEOMETRIE_INDEX.werken[w.id]:null;
  const geldig=!!(bron&&bron.w===w.weg&&w.startMs!=null&&Math.abs(w.startMs-bron.b)<=4*3600e3&&w.eindMs!=null&&Math.abs(w.eindMs-bron.e)<=4*3600e3);
  const startGeldig=geldigeRdCoord(w.rdX,w.rdY),eindeGeldig=geldigeRdCoord(w.rdXE,w.rdYE),start=startGeldig?{x:w.rdX,y:w.rdY}:null,einde=eindeGeldig?{x:w.rdXE,y:w.rdYE}:start;
  const bestandSegmenten=start?[[start,einde]]:[],bestandPunten=[start,eindeGeldig?einde:null].filter(Boolean);
  w.rdSegmenten=geldig?contextSegmenten(bron.s):bestandSegmenten;w.rdPunten=geldig?(bron.p||[]).map(p=>({x:+p[0],y:+p[1]})).filter(p=>geldigeRdCoord(p.x,p.y)):bestandPunten;
  w.alternatieveRdSegmenten=geldig?contextSegmenten(bron.a):[];w.datexId=geldig?bron.d:'';w.geometrieBron=geldig?'NDW DATEX II':start?'bestand RD-coördinaten':w.exactKoppelbaar?'bestand':'geen exacte geometrie';
  if(geldig)w.uRoutes=uniekeWaarden([...(w.uRoutes||[]),...(bron.u||[])]);w.bbox=segmentenBegrenzing(w.rdSegmenten);
  w.exactKoppelbaar=!!(w.exactKoppelbaar||w.rdSegmenten.length||w.rdPunten.length);return w;
}
function assetsLangsURoute(r){
  if(!ASSET_REGISTER_STATE||!r||!r.rdSegmenten||!r.rdSegmenten.length)return [];
  if(r._assetRegister===ASSET_REGISTER_STATE)return r.assetKeys||[];
  const band=175,b=r.bbox||segmentenBegrenzing(r.rdSegmenten),keys=[];
  contextAssetsBinnenBegrenzing(b,band).forEach(a=>{if(!a.prognoseActief||!geldigeRdCoord(a.rdX,a.rdY)||!puntBinnenBegrenzing(a.rdX,a.rdY,b,band))return;if(afstandPuntTotLijnen(a.rdX,a.rdY,r.rdSegmenten,band)<=band)keys.push(a.key);});
  r.assetKeys=uniekeWaarden(keys);r._assetRegister=ASSET_REGISTER_STATE;return r.assetKeys;
}
function koppelURoutesAanWerk(w){
  if(!U_ROUTE_STATE)return [];
  const expliciet=(w.uRoutes||[]).length>0;let kandidaten=[];
  if(expliciet)(w.uRoutes||[]).forEach(ref=>kandidaten.push(...(U_ROUTE_STATE.byRef.get(ref)||[])));
  else if(!w.exactKoppelbaar||!w.rdSegmenten||!w.rdSegmenten.length)return [];
  else kandidaten.push(...(U_ROUTE_STATE.byHoofdweg.get(w.weg)||[]));
  kandidaten=[...new Map(kandidaten.map(r=>[r.relationId||r.id,r])).values()];
  if(expliciet&&(!w.exactKoppelbaar||!w.rdSegmenten||!w.rdSegmenten.length))return kandidaten.slice(0,12).map(r=>Object.assign(r,{koppelAfstandM:null,koppelMethode:'expliciet U-nummer, locatie uit routebestand'}));
  const zonderGeometrie=kandidaten.filter(r=>!(r.rdSegmenten&&r.rdSegmenten.length));
  kandidaten=kandidaten.filter(r=>r.rdSegmenten&&r.rdSegmenten.length);
  const grens=expliciet?12000:3500,score=kandidaten.filter(r=>afstandBegrenzingen(w.bbox,r.bbox)<=grens).map(r=>({r,d:afstandLijnen(w.rdSegmenten,r.rdSegmenten,0)})).filter(x=>x.d<=grens).sort((a,b)=>a.d-b.d);
  if(expliciet){const perRef=new Map();score.forEach(x=>{const k=x.r.uRoute||x.r.relationId;if(!perRef.has(k))perRef.set(k,Object.assign(x.r,{koppelAfstandM:x.d,koppelMethode:'expliciet U-nummer + geometrie'}));});
    zonderGeometrie.forEach(r=>{const k=r.uRoute||r.relationId||r.id;if(!perRef.has(k))perRef.set(k,Object.assign(r,{koppelAfstandM:null,koppelMethode:'expliciet U-nummer, locatie uit routebestand'}));});
    if(!perRef.size)kandidaten.slice(0,12).forEach(r=>{const k=r.uRoute||r.relationId||r.id;if(!perRef.has(k))perRef.set(k,Object.assign(r,{koppelAfstandM:null,koppelMethode:'expliciet U-nummer, afstand niet hard gekoppeld'}));});
    return [...perRef.values()].slice(0,12);}
  return score.slice(0,12).map(x=>Object.assign(x.r,{koppelAfstandM:x.d,koppelMethode:'hoofdweg + geometrie'}));
}
function werkAssetsBinnenBuffer(w){
  if(!ASSET_REGISTER_STATE||!w.exactKoppelbaar)return [];
  const marge=WERK_BUFFER_KM*1000,laag=w.weg&&w.vanHm!=null&&w.totHm!=null?Math.min(w.vanHm,w.totHm)-WERK_BUFFER_KM:null,hoog=w.weg&&w.vanHm!=null&&w.totHm!=null?Math.max(w.vanHm,w.totHm)+WERK_BUFFER_KM:null;
  const begrenzing=w.bbox||segmentenBegrenzing(w.rdSegmenten),kandidaten=w.weg?(ASSET_INDEX&&ASSET_INDEX.byRoad&&ASSET_INDEX.byRoad.get(w.weg)||[]):contextAssetsBinnenBegrenzing(begrenzing,marge);
  return kandidaten.filter(a=>{
    if(!a.prognoseActief||(w.weg&&a.weg!==w.weg))return false;if(w.richting&&a.richting&&normAssetRichting(a.richting)!==w.richting)return false;
    if(laag!=null)return a.hm!=null&&a.hm>=laag&&a.hm<=hoog;
    if(w.rdSegmenten&&w.rdSegmenten.length&&a.rdX!=null&&a.rdY!=null)return puntBinnenBegrenzing(a.rdX,a.rdY,begrenzing,marge)&&afstandPuntTotLijnen(a.rdX,a.rdY,w.rdSegmenten,marge)<=marge;
    if(w.rdPunten&&w.rdPunten.length&&a.rdX!=null&&a.rdY!=null)return w.rdPunten.some(p=>Math.hypot(a.rdX-p.x,a.rdY-p.y)<=marge);
    if(w.rdX!=null&&w.rdY!=null&&a.rdX!=null&&a.rdY!=null){const d=w.rdXE!=null&&w.rdYE!=null?afstandPuntSegment(a.rdX,a.rdY,w.rdX,w.rdY,w.rdXE,w.rdYE):Math.hypot(a.rdX-w.rdX,a.rdY-w.rdY);return d<=WERK_BUFFER_KM*1000;}
    return false;
  });
}
function verwerkWerkKoppeling(w,telling){
  const a=werkAssetsBinnenBuffer(w);w.assetKeys=a.map(x=>x.key);w.assetN=a.length;if(w.exactKoppelbaar)telling.exact++;telling.koppelingen+=a.length;
  w.routeMatches=koppelURoutesAanWerk(w);telling.routeMatches+=w.routeMatches.length;w.routeMatches.forEach(r=>assetsLangsURoute(r).forEach(k=>telling.routeAssets.add(k)));
}
function bewaarWerkKoppeling(telling){
  WERK_STATE.exactN=telling.exact;WERK_STATE.assetKoppelingenN=telling.koppelingen;WERK_STATE.uRouteMatchesN=telling.routeMatches;WERK_STATE.uRouteAssetN=telling.routeAssets.size;
  if(U_ROUTE_STATE){U_ROUTE_STATE.werkMatchesN=telling.routeMatches;U_ROUTE_STATE.routeAssetKoppelingenN=telling.routeAssets.size;}
}
function herkoppelWerkAssets(){
  if(!WERK_STATE)return;const telling={koppelingen:0,exact:0,routeMatches:0,routeAssets:new Set()};WERK_STATE.werken.forEach(w=>verwerkWerkKoppeling(w,telling));bewaarWerkKoppeling(telling);
}
async function herkoppelWerkAssetsLicht(voortgang){
  if(!WERK_STATE)return;const telling={koppelingen:0,exact:0,routeMatches:0,routeAssets:new Set()},n=WERK_STATE.werken.length,batch=n>5000?120:n>1500?60:n>500?30:15;
  for(let i=0;i<n;i++){
    verwerkWerkKoppeling(WERK_STATE.werken[i],telling);
    if((i+1)%batch===0||i===n-1){if(voortgang)voortgang((i+1)/Math.max(1,n),`${i+1} van ${n} HWN-werkvakken ruimtelijk gekoppeld`);await uiPauze();}
  }
  bewaarWerkKoppeling(telling);
}
async function leesWerkBestand(file){
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets.');return;}
  zetImportVoortgang(file.name,0,'Werkzaamhedenbestand voorbereiden',{direct:true});await uiPauze();
  try{
    const bekendeHwnSet=isBekendeWerkset20260825(file,WERK_KOLOMMEN_LICHT);
    let bronTotaal=0,genegeerdN=0;const selecteerHwn=r=>{bronTotaal++;if(!bekendeHwnSet&&!werkRijIsHwn(r)){genegeerdN++;return null;}return r;};
    const rijen=await contextRijenUitBestand(file,WERK_KOLOMMEN_LICHT,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*72,fa,{direct:true}),selecteerHwn);
    const werken=rijen.map(normWerkRij).filter(Boolean);if(!werken.length)throw new Error('geen herkenbare werkzaamheden gevonden');
    WERK_STATE={bestand:file.name,werken,totaal:werken.length,bronTotaal,genegeerdN,exactN:0,assetKoppelingenN:0,peildatum:Math.max(0,...werken.map(w=>w.peildatum||0))||datumUitBestandsnaam(file.name),ruweRijen:rijen.slice()};
    zetImportVoortgang(file.name,76,`Assets binnen ±${WERK_BUFFER_KM} km koppelen`,{direct:true});await uiPauze();await herkoppelWerkAssetsLicht((f,fa)=>zetImportVoortgang(file.name,76+f*22,fa,{direct:true}));
    ANALYSE_SIGNATURE='';probeerAnalyseActiveren(null);importKlaar(file.name,`${werken.length.toLocaleString('nl-NL')} HWN-werkzaamheden geladen; ${genegeerdN.toLocaleString('nl-NL')} niet-relevante bronregels overgeslagen; ${WERK_STATE.exactN.toLocaleString('nl-NL')} ruimtelijk koppelbaar.`);
  }catch(err){importMislukt(file.name,err.message);alert('Kon het werkzaamhedenbestand niet verwerken: '+err.message);}
}
function werkOverlapt(w,vanMs,totMs){const a=w.startMs||-Infinity,b=w.eindMs||Infinity;return a<totMs&&b>=vanMs&&!/vervallen|geannuleerd/i.test(w.status||'');}
function contextItemAssetKey(x){return x&&(x.assetKey||x._assetKey||x.key||x.entityid)||'';}
function maakOperationeleContext(vanMs,totMs,items){
  const regels=items||[],wegen=new Set(regels.map(x=>String(x.weg||'').toUpperCase()).filter(Boolean)),assetKeys=new Set(regels.map(contextItemAssetKey).filter(Boolean));
  const bronAssets=uniekeAssets(regels.map(x=>assetUitKey(contextItemAssetKey(x))||x).filter(x=>x&&(x.tp||x.assetType||x.key||x.entityid)));
  const actief=WERK_STATE?WERK_STATE.werken.filter(w=>werkOverlapt(w,vanMs,totMs)):[],opWeg=actief.filter(w=>w.weg?wegen.has(w.weg):(w.assetKeys||[]).some(k=>assetKeys.has(k)));
  const exact=opWeg.filter(w=>w.exactKoppelbaar),geraakteAssets=new Set(exact.flatMap(w=>w.assetKeys||[])),verstoordBinnen2Km=[...geraakteAssets].filter(k=>assetKeys.has(k)).length;
  const routes=[...new Map(opWeg.flatMap(w=>w.routeMatches||[]).map(r=>[r.relationId||r.id,r])).values()];
  const routeInfos=routes.map(r=>({r,inzet:routeInzetAssets(r)}));
  const routeAssets=new Set(routeInfos.flatMap(x=>x.inzet.langs.map(a=>a.key))),routeInzetKeys=new Set(routeInfos.flatMap(x=>[...x.inzet.voor,...x.inzet.na].map(a=>a.key)));
  const verstoordOpRoute=[...routeAssets].filter(k=>assetKeys.has(k)).length,routeRefs=uniekeWaarden(routes.map(r=>r.uRoute).filter(Boolean));
  const werkDetails=opWeg.slice(0,12).map(w=>({id:w.id,locatie:werkLocatieLabel(w),periode:werkPeriodeLabel(w),hinder:w.hinder||'',afsluiting:w.afsluiting||'',omleiding:w.omleiding||'',werkzaamheden:w.omschrijving||'',routeRefs:uniekeWaarden([...(w.uRoutes||[]),...(w.routeMatches||[]).map(r=>r.uRoute).filter(Boolean)])}));
  const routeDetails=routeInfos.slice(0,12).map(({r,inzet})=>{
    const alle=uniekeAssets([...inzet.voor,...inzet.na,...inzet.langs]),diensten=dienstDuidingVoorAssets(alle);
    const werkRefs=opWeg.filter(w=>(w.routeMatches||[]).some(rr=>(rr.relationId||rr.id)===(r.relationId||r.id))).slice(0,4).map(w=>w.id||werkLocatieLabel(w));
    return {ref:r.uRoute||r.id||r.relationId,naam:routeNaamLabel(r),locatie:routeLocatieLabel(r),koppelMethode:r.koppelMethode||r.routeBron||'',opmerking:r.opmerking||'',relationUrl:r.relationUrl||'',beeldUrl:schoonUrl(r.beeldUrl),inzetVoor:inzet.voor.map(assetKortLabel),inzetNa:inzet.na.map(assetKortLabel),assetsLangs:inzet.langs.map(assetKortLabel),inzetVoorN:inzet.voorN,inzetNaN:inzet.naN,assetsLangsN:inzet.langsN,diensten:diensten.map(d=>d.naam),dienstTekst:dienstDuidingTekst(diensten),werkRefs};
  });
  const alleContextAssets=uniekeAssets([...bronAssets,...[...geraakteAssets].map(assetUitKey),...routeInfos.flatMap(x=>[...x.inzet.voor,...x.inzet.na,...x.inzet.langs])]);
  const serviceDetails=dienstDuidingVoorAssets(alleContextAssets);
  return {vanMs,totMs,werkenTijd:actief.length,werkenWeg:opWeg.length,werkenExact:exact.length,assetsBinnen2Km:geraakteAssets.size,verstoordBinnen2Km,routeRefs,routeMatches:routes.length,routeAssets:routeAssets.size,routeInzetAssets:routeInzetKeys.size,verstoordOpRoute,werkDetails,routeDetails,serviceDetails,serviceTekst:dienstDuidingTekst(serviceDetails),
    werkGeladen:!!WERK_STATE,uRouteGeladen:!!U_ROUTE_STATE,werkExactBron:!!(WERK_STATE&&WERK_STATE.exactN),uRouteRuimtelijk:!!(U_ROUTE_STATE&&U_ROUTE_STATE.ruimtelijkN)};
}
function contextPillHtml(arr,leeg){
  const a=(arr||[]).filter(Boolean);
  if(!a.length)return leeg?`<div class="route-context-pills"><span class="route-context-pill">${esc(leeg)}</span></div>`:'';
  return `<div class="route-context-pills">${a.slice(0,8).map(x=>`<span class="route-context-pill">${esc(x)}</span>`).join('')}${a.length>8?`<span class="route-context-pill">+${a.length-8}</span>`:''}</div>`;
}
function routeBeeldHtml(r){
  if(!r||!r.beeldUrl)return '';
  const u=esc(r.beeldUrl),ref=esc(r.ref||'U-route');
  return `<figure class="route-context-img"><img src="${u}" alt="Routebeeld ${ref}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><a href="${u}" target="_blank" rel="noopener" style="display:none">Routebeeld openen</a><figcaption>Routebeeld uit het U-routebestand voor beeldvorming.</figcaption></figure>`;
}
function routeOsmLinkHtml(r){
  const url=schoonUrl(r&&(r.relationUrl||r.bronUrl));
  if(!url)return '';
  const titel=r&&(r.naam||r.ref||r.relationId)||'U-route';
  return `<a class="osm-route-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-osm-title="${esc(titel)}" onclick="return openOsmRoutePopup(this.href,this.dataset.osmTitle)">OSM relatiekaart openen</a>`;
}
function openOsmRoutePopup(url,titel){
  const clean=schoonUrl(url);if(!clean){alert('Geen geldige OSM-link gevonden.');return false;}
  const venster=window.open(clean,'_blank');
  if(venster){try{venster.opener=null;}catch(e){}return false;}
  const popup=document.getElementById('osmRoutePopup'),link=document.getElementById('osmRoutePopupLink');
  if(!popup||!link)return true;
  document.getElementById('osmRoutePopupTitle').textContent=titel||'OSM relatiekaart';
  document.getElementById('osmRoutePopupUrl').textContent=clean;
  link.href=clean;
  popup.style.display='flex';
  return false;
}
function sluitOsmRoutePopup(){
  const popup=document.getElementById('osmRoutePopup');
  if(popup)popup.style.display='none';
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')sluitOsmRoutePopup();});
function routeContextDetailsHtml(c){
  const werk=(c.werkDetails||[]).slice(0,5).map(w=>`<div class="route-context-item werk"><div class="route-context-title">${esc(w.id||'Werkzaamheid')}</div><div class="route-context-meta"><b>Locatie:</b> ${esc(w.locatie)}<br><b>Periode:</b> ${esc(w.periode)}${w.hinder?`<br><b>Hinder:</b> ${esc(w.hinder)}`:''}${w.afsluiting?`<br><b>Afsluiting:</b> ${esc(w.afsluiting)}`:''}${w.omleiding?`<br><b>Omleiding:</b> ${esc(w.omleiding)}`:''}${w.werkzaamheden?`<br><b>Werk:</b> ${esc(w.werkzaamheden)}`:''}</div>${contextPillHtml(w.routeRefs,'geen expliciete U-route')}</div>`).join('');
  const routes=(c.routeDetails||[]).slice(0,5).map(r=>`<div class="route-context-item route"><div class="route-context-title">${esc(r.naam)}</div><div class="route-context-meta"><b>Locatie:</b> ${esc(r.locatie)}<br><b>Omleidingsinzet:</b> assets voor de route (${r.inzetVoorN}), na de route (${r.inzetNaN}) en langs de route (${r.assetsLangsN}).<br><b>Dienstduiding:</b> ${esc(r.dienstTekst)}${r.koppelMethode?`<br><b>Koppeling:</b> ${esc(r.koppelMethode)}`:''}${r.werkRefs&&r.werkRefs.length?`<br><b>Gekoppeld aan werk:</b> ${esc(r.werkRefs.join(', '))}`:''}${r.opmerking?`<br><b>Opmerking:</b> ${esc(r.opmerking)}`:''}</div>${routeOsmLinkHtml(r)}${contextPillHtml(r.inzetVoor,'geen voor-route assets gevonden')}${contextPillHtml(r.inzetNa,'geen na-route assets gevonden')}${contextPillHtml(r.assetsLangs,'geen route-as assets gevonden')}${routeBeeldHtml(r)}</div>`).join('');
  return werk||routes?`<div class="route-context-grid">${werk}${routes}</div>`:'';
}
function operationeleContextHtml(c,titel){
  if(!c)return '';
  const duiding=!c.werkGeladen?'Werkzaamheden ontbreken; de operationele blootstelling is niet beoordeeld.':c.werkenExact?`${c.werkenExact} werkvak(ken) raken ${c.assetsBinnen2Km} gekoppelde assets binnen ±${WERK_BUFFER_KM} km. Dit verhoogt de operationele prioriteit, maar wordt niet als extra technische storing geteld.`:c.werkenWeg?`${c.werkenWeg} werkvak(ken) liggen op dezelfde weg. Door ontbrekende hectometers/RD-coördinaten is dit alleen wegcontext en geen numerieke impact.`:'Geen overlappende werkzaamheden gevonden op de betrokken wegen.';
  const routeDuiding=!c.uRouteGeladen?'U-routes ontbreken.':c.routeMatches?`${c.routeMatches} U-route(s) operationeel gekoppeld. Een U-route is een omleiding; de inzet wordt daarom geduid met assets voor de route, na de route en langs de route-as.`:`Geen U-route raakt binnen de veilige afstand hetzelfde werkvak op dezelfde hoofdweg.`;
  return `<div class="card"><h3>${esc(titel||'Operationele context')}</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:14px"><div class="kpi"><div class="k-val">${c.werkenTijd}</div><div class="k-lab">Werkzaamheden in periode</div></div><div class="kpi"><div class="k-val">${c.werkenWeg}</div><div class="k-lab">Zelfde weg</div></div><div class="kpi"><div class="k-val">${c.werkenExact}</div><div class="k-lab">Exacte werkvakken</div></div><div class="kpi"><div class="k-val">${c.assetsBinnen2Km}</div><div class="k-lab">Assets binnen ±${WERK_BUFFER_KM} km</div></div><div class="kpi"><div class="k-val">${c.routeMatches}</div><div class="k-lab">Gekoppelde U-routes</div></div><div class="kpi"><div class="k-val">${c.routeInzetAssets}</div><div class="k-lab">Inzetassets U-routes</div></div></div><p class="muted" style="font-size:11.5px;margin-top:9px"><b>Duiding:</b> ${esc(duiding)} ${esc(routeDuiding)} Van de geselecteerde storingen liggen er ${c.verstoordBinnen2Km} binnen de werkbuffer en ${c.verstoordOpRoute} op een gekoppelde U-route. Dienstduiding: ${esc(c.serviceTekst)} Werkzaamheden en omleidingen zijn gevolgcontext; zij wijzigen de gesimuleerde technische faalfrequentie niet.</p>${routeContextDetailsHtml(c)}</div>`;
}

function leesStoringsBestanden(fileList){
  const files=[...fileList];if(!files.length)return;
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. Storingslogs worden pas daarna rechtstreeks aan het stamregister gekoppeld.');renderDataGereedheid();return;}
  return (async()=>{
    const nieuw=[],snapshots=[],fouten=[];
    for(const file of files){
      zetStoringsImportStatus(`Bezig met laden: ${file.name}. ${geheugenarmeXlsxNodig(file)?'Geheugenarme mobiele leesmodus actief.':''}`);
      zetImportVoortgang(file.name,0,'Import voorbereiden',{direct:true});
      await uiPauze();
      try{const bron=await storingsBronUitBestand(file,(f,fase)=>zetImportVoortgang(file.name,f==null?null:f*78,fase));if(lijktOpenSnapshotBron(bron))snapshots.push(bron);else nieuw.push(bron);zetImportVoortgang(file.name,80,`${bron.rijen.length.toLocaleString('nl-NL')} regels gelezen, inhoudelijke controle volgt.`,{direct:true});}
      catch(err){fouten.push(file.name+': '+err.message);importMislukt(file.name,err.message);}
    }
    if(nieuw.length){
      const vervang=new Set(nieuw.map(x=>x.key));
      STORINGSBRONNEN=[...STORINGSBRONNEN.filter(x=>!vervang.has(x.key)),...nieuw];
      if(nieuw.length)zetImportVoortgang(nieuw[nieuw.length-1].naam,84,'Storingsregels classificeren en datadekking bepalen',{direct:true});
      await uiPauze();
      STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
      ANALYSE_SIGNATURE='';MC_RESULT=null;
      if(nieuw.length)zetImportVoortgang(nieuw[nieuw.length-1].naam,90,'Incidenten één keer aan All Assets koppelen',{direct:true});
      await uiPauze();
      herbouwAssetMatchBeeld();
      if(nieuw.length)zetImportVoortgang(nieuw[nieuw.length-1].naam,96,'Historisch prognosemodel voorbereiden',{direct:true});
      await uiPauze();
      probeerAnalyseActiveren('prognose',{inspectieAlGereed:true,matchAlGereed:true});
      if(nieuw.length)importKlaar(nieuw[nieuw.length-1].naam,`${nieuw.length} historische bestand(en) verwerkt. Deze stroom voedt alleen prognoses.`);
    }
    if(snapshots.length){voegLiveBronnenToe(snapshots);probeerAnalyseActiveren('overzicht',{inspectieAlGereed:true,matchAlGereed:true});importKlaar(snapshots[snapshots.length-1].naam,`${snapshots.length} één-peildatum-bestand(en) automatisch als open momentopname geladen.`);}
    if(!nieuw.length&&!snapshots.length)renderDataGereedheid();
    zetStoringsImportStatus(fouten.length?`${nieuw.length} historische en ${snapshots.length} open bron(nen) geladen, ${fouten.length} niet geladen.`:`${nieuw.length} historische en ${snapshots.length} open bron(nen) geladen.`);
    if(snapshots.length)alert(`${snapshots.length} bestand(en) bevatten vrijwel uitsluitend meldingen met dezelfde peildatum. Ze zijn daarom veilig als open momentopname geladen en niet als prognosehistorie.`);
    if(fouten.length)alert('Niet alle storingslogs konden worden geladen:\n'+fouten.join('\n'));
  })();
}

/* ══════════════════════════════════════════════════════════════
   DRIP-IMPORT (tussenversie) — leest een DRIP-arealelijst "naast" de
   storingslijst. Verstoort de bestaande MSI-doorrekening niet.
   ══════════════════════════════════════════════════════════════ */
let DRIP_STATE=null;
// Historische DRIP-incidenten staan los van de reguliere DVM-storingslijst.
// Meerdere bestanden en indelingen kunnen naast elkaar worden geladen.
let DRIP_HIST_STATE=null;
// Compacte leeftijdsdekking uit het volledige assetregister. Alleen cohorten
// worden bewaard; ruwe registerrijen worden niet in het prognosemodel gekopieerd.
let DVM_LEEFTIJD_STATE=null;
const INSTALLATIE_DATUM_KEYS=[
  'ingebruikname','ingebruiknamedatum','datum-ingebruikname','datum-in-gebruik',
  'inbedrijfname','inbedrijfstelling','installatiedatum','installatie-datum',
  'datum-installatie','datum-in-dienst','indienststelling','datum-indienststelling',
  'plaatsingsdatum','datum-plaatsing','geplaatst-op','stichtingsjaar','stichtingjaar',
  'stichtingsdatum','bouwjaar','bouwdatum','aanlegjaar','aanlegdatum','opleverdatum','realisatiedatum',
  'installatiejaar','jaar-installatie','jaar installatie','jaar-ingebruikname','jaar ingebruikname',
  'ingebruiknamejaar','indienstjaar','jaar-in-dienst','jaar in dienst','plaatsingsjaar',
  'realisatiejaar','opleverjaar','datum ingebruikname','datum installatie','datum in dienst',
  'plaatsing','commissioning_date','commissioning date','installed_date','installed date',
  'installation_date','installation date','install_date','install date','in_service_date',
  'in service date','in-service date'
];
const EOL_DATUM_KEYS=[
  'eol','eol-datum','eol_datum','public_eol_date','end-of-life','einde-levensduur',
  'einde levensduur','verwacht-vervangjaar','verwacht vervangjaar','verwacht_vervangjaar',
  'verwachte-vervanging','verwachte vervanging','vervangjaar','vervangingsjaar'
];
const LEVENSDUUR_KEYS=[
  'life_median_years','levensduur','levensduur-jaren','levensduur jaren','b50',
  'b-50','mediaan','mediane-levensduur','mediane levensduur','verwachte-levensduur',
  'verwachte levensduur','technische-levensduur','technische levensduur'
];
function registerWaardeBron(row,keys){
  const ks=(keys||[]).map(kolomLicht),ns=(keys||[]).map(kolomSleutel);
  const bronKeys=Object.keys(row||{});
  for(const k of bronKeys){const lk=kolomLicht(k);if(ks.includes(lk))return {waarde:row[k],kolom:k};}
  for(const k of bronKeys){const sk=kolomSleutel(k);if(ns.includes(sk))return {waarde:row[k],kolom:k};}
  for(const k of bronKeys){const lk=kolomLicht(k);if(ks.some(x=>x&&lk.includes(x)))return {waarde:row[k],kolom:k};}
  for(const k of bronKeys){const sk=kolomSleutel(k);if(ns.some(x=>x&&x.length>=4&&sk.includes(x)))return {waarde:row[k],kolom:k};}
  return {waarde:'',kolom:''};
}
function registerWaarde(row,keys){
  return registerWaardeBron(row,keys).waarde;
}
function parseDripLocatie(dyn){
  // "A10R_010-590_D" of "N57L_056-785_BD" -> weg, richting, hm, bordtype
  const m=String(dyn||'').match(/^([AN]\d+)([LRM])_(\d+)-(\d+)_([A-Z]+)/);
  if(!m) return {weg:'',richting:'',hm:null,bord:''};
  const ri={L:'LI',R:'RE',M:''}[m[2]]||'';
  return {weg:m[1].toUpperCase(), richting:ri, hm:parseFloat(m[3])+parseFloat(m[4])/1000, bord:m[5]};
}
function bouwjaarUitTijd(ms){
  if(ms==null||isNaN(ms))return null;
  const j=new Date(ms).getUTCFullYear();
  return (j>=1970&&j<=2100)?j:null;
}
/* Parse bouwjaar uit een datumveld, jaartal of Excel-seriedatum. */
function parseBouwjaar(v){
  if(v==null||v==='')return null;
  if(v instanceof Date)return bouwjaarUitTijd(v.getTime());
  if(typeof v==='number'){
    if(v>=1970&&v<=2100)return Math.trunc(v);
    if(v>20000&&v<80000)return bouwjaarUitTijd(parseDatum(v));
    return null;
  }
  const s=String(v||'').trim(); if(!s) return null;
  const sn=s.replace(',','.');
  if(/^\d+(\.\d+)?$/.test(sn)){
    const n=parseFloat(sn);
    if(n>=1970&&n<=2100)return Math.trunc(n);
    if(n>20000&&n<80000)return bouwjaarUitTijd(parseDatum(n));
  }
  const m=s.match(/(^|[^\d])((?:19[7-9]\d|20\d{2}|2100))([^\d]|$)/);
  if(m)return parseInt(m[2],10);
  const t=Date.parse(s);
  return isNaN(t)?null:bouwjaarUitTijd(t);
}
function parseAssetDatum(v){
  if(v instanceof Date) return v.getTime();
  if(typeof v==='number'){
    if(v>=1970&&v<=2100)return null;
    return parseDatum(v);
  }
  const s=String(v||'').trim(); if(!s) return null;
  if(/^(?:19[7-9]\d|20\d{2}|2100)(?:[,.]0+)?$/.test(s))return null;
  const nl=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(nl){
    let j=+nl[3]; if(j<100)j+=j>=70?1900:2000;
    const t=new Date(j,+nl[2]-1,+nl[1],+(nl[4]||0),+(nl[5]||0),+(nl[6]||0)).getTime();
    return isNaN(t)?null:t;
  }
  if(/^\d+([,.]\d+)?$/.test(s)){
    const n=parseFloat(s.replace(',','.'));
    if(n>=1970&&n<=2100)return null;
    if(n>20000&&n<80000)return parseDatum(n);
  }
  const t=Date.parse(s); return isNaN(t)?null:t;
}

/* Canonieke DRIP-code voor koppeling tussen log en areaal. D07 en D7 worden
   gelijk, evenals dBD128 en DBD128. Een suffix, zoals D80A, blijft behouden. */
function normDripCode(v){
  const s=String(v==null?'':v).trim().toUpperCase();
  const m=s.match(/\b(DBD|BD|D)\s*0*(\d+)([A-Z]?)\b/);
  if(!m) return '';
  const prefix=(m[1]==='BD'||m[1]==='DBD')?'DBD':'D';
  return prefix+String(parseInt(m[2],10))+m[3];
}
function normDripHistRegio(v){
  const m=String(v==null?'':v).toUpperCase().match(/\b(WNN|WNZ|NWN|ZWN|NON|ZN|MN)\b/);
  return m?(m[1]==='WNN'?'NWN':m[1]==='WNZ'?'ZWN':m[1]):'';
}
function parseDripHistorieLocatie(v){
  const s=String(v==null?'':v).trim().toUpperCase();
  const vc=normDripHistRegio(s);
  let m=s.match(/\b([AN]\d+)([LRM])[_\s]+(\d+)[,.-](\d{1,3})\b/);
  if(!m) return {vc,weg:'',richting:'',hm:null};
  return {vc,weg:m[1],richting:({L:'LI',R:'RE',M:''}[m[2]]||''),
    hm:parseFloat(m[3])+parseFloat(m[4].padEnd(3,'0'))/1000};
}
function parseDripHistorieDatum(v){
  if(v instanceof Date) return v.getTime();
  if(typeof v==='number') return parseDatum(v);
  const s=String(v==null?'':v).trim(); if(!s) return null;
  const nl=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(nl) return new Date(+nl[3],+nl[2]-1,+nl[1],+(nl[4]||0),+(nl[5]||0),+(nl[6]||0)).getTime();
  const t=Date.parse(s); return isNaN(t)?null:t;
}
function histKolomNaam(v){
  return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}
function histGetter(row){
  const m={}; Object.keys(row||{}).forEach(k=>m[histKolomNaam(k)]=row[k]);
  return namen=>{ for(const n of namen){ const k=histKolomNaam(n); if(m[k]!==undefined&&m[k]!==null&&m[k]!=='') return m[k]; } return ''; };
}
function histBool(v){
  if(v===true||v===1) return true;
  const s=String(v==null?'':v).trim().toLowerCase();
  return ['1','true','waar','ja','yes','x','open'].includes(s);
}
function histDagSleutel(ms){ return new Date(ms).toISOString().slice(0,10); }
function histDagenTussen(vanMs,totMs){
  const uit=[]; if(!(vanMs>=0)||!(totMs>=vanMs)) return uit;
  let t=new Date(new Date(vanMs).getFullYear(),new Date(vanMs).getMonth(),new Date(vanMs).getDate()).getTime();
  const eind=new Date(new Date(totMs).getFullYear(),new Date(totMs).getMonth(),new Date(totMs).getDate()).getTime();
  for(let n=0;t<=eind&&n<20000;n++,t+=86400e3) uit.push(histDagSleutel(t));
  return uit;
}
/* Parse locatie uit de asset-CSV: wegnummer + baanpositie + hm-bord. */
function assetLocatie(row, g){
  const asset=String(g(row,['asset'])||'').trim();
  // Assetnamen bevatten vaak de nauwkeurigste codering, bv. A10R 20,579.
  const am=asset.match(/\b([AN]\d+)([LRM])\s+(\d+)[,.](\d{1,3})\b/i);
  if(am){
    return {weg:am[1].toUpperCase(),richting:({L:'LI',R:'RE',M:''}[am[2].toUpperCase()]||''),
      hm:parseFloat(am[3])+parseFloat(am[4].padEnd(3,'0'))/1000};
  }
  let wegnr=String(g(row,['wegnummer'])||'').trim();
  const bps=String(g(row,['bps-locatie'])||'').trim().toUpperCase();
  let weg;
  if(/^\d+$/.test(wegnr)) weg=(/^PW/.test(bps)?'N':'A')+String(parseInt(wegnr,10));
  else weg=wegnr.toUpperCase();
  if(!weg){ const bm=bps.match(/^(RW|PW)0*(\d+)/); if(bm) weg=(bm[1]==='PW'?'N':'A')+bm[2]; }
  const bp=String(g(row,['baanpositie'])||'').trim().toUpperCase();
  const ri={'L':'LI','R':'RE'}[bp]||'';
  let hm=null; const hmr=String(g(row,['hm-bord','hm'])||'').replace(',','.');
  const hf=parseFloat(hmr); if(!isNaN(hf)){
    const af=parseFloat(String(g(row,['afstand-tot-hm-bord'])||'').replace(',','.'));
    hm=hf+(isNaN(af)?0:af/1000);
  }
  return {weg, richting:ri, hm};
}

function statusActiefVoorPrognose(status){
  const s=String(status||'').trim();
  return !s || /^operationeel\b/i.test(s) || /^stand[ -]?by\b/i.test(s);
}

/* Classificatie voor de leeftijdscohorten uit het volledige assetregister. */
function registerAssetType(row,g){
  if(isDripRij(row,g)) return 'DRIP';
  const hay=[g(row,['ci-type']),g(row,['nen-subtype']),g(row,['nen-bouwdeel']),g(row,['asset'])].join(' ').toLowerCase();
  if(/wisselbord/.test(hay)) return 'WISSELBORD';
  if(/matrixsignaalgever|vks signaalgevers|\bmsi\b|kruis.?pijl/.test(hay)) return 'MSI';
  if(/camera|cctv/.test(hay)) return 'CAM';
  if(/detectielus|meetlus|\blussen?\b|mon detector/.test(hay)) return 'LUS';
  return null;
}

function verwerkDvmLeeftijd(rijen){
  const exact={}, weg={};
  const stats={totaal:0,metJaar:0,actief:0,perType:{}};
  const voeg=(bak,key,j)=>{
    const c=bak[key]||(bak[key]={totaal:0,metJaar:0,jaren:{}});
    c.totaal++;
    if(j){ c.metJaar++; c.jaren[j]=(c.jaren[j]||0)+1; }
  };
  rijen.forEach(row=>{
    const tp=registerAssetType(row,registerWaarde); if(!tp) return;
    stats.totaal++; stats.perType[tp]=(stats.perType[tp]||0)+1;
    const status=String(registerWaarde(row,['status'])||'').trim();
    if(!statusActiefVoorPrognose(status)) return;
    const loc=assetLocatie(row,registerWaarde); if(!loc.weg) return;
    stats.actief++;
    const j=parseBouwjaar(registerWaarde(row,INSTALLATIE_DATUM_KEYS));
    if(j) stats.metJaar++;
    const vc=normAssetVc(registerWaarde(row,['regio','vc']));
    voeg(exact,[vc,loc.weg,loc.richting,tp].join('|'),j);
    voeg(weg,[vc,loc.weg,tp].join('|'),j);
  });
  return {exact,weg,...stats,geladenOp:new Date().toISOString()};
}
/* Herken of een rij een DRIP-asset is (asset-register) op basis van ci-type/type. */
function isDripRij(row, g){
  const ci=String(g(row,['ci-type'])||'').toLowerCase().trim();
  // uitsluitend de echte DRIP-paneel-ci-types (geen detectielussen/signaalgevers)
  const dripCi=['dri panelen','vks panelen','nbc drips niet-cdms','vks multisigns','obj bijzondere borden-drips'];
  if(dripCi.includes(ci)) return true;
  // fallback: expliciete DRIP-aanduiding in ci-type
  return /\bdrip\b/.test(ci);
}

function verwerkDrips(rijen){
  const g=(row,keys)=>{
    // eerst exacte kolomnaam, dan pas een 'bevat'-match (voorkomt dat 'type' → 'camera-type' pakt)
    const ks=(keys||[]).map(kolomLicht),ns=(keys||[]).map(kolomSleutel);
    for(const k of Object.keys(row)){ if(ks.includes(kolomLicht(k))) return row[k]; }
    for(const k of Object.keys(row)){ if(ns.includes(kolomSleutel(k))) return row[k]; }
    for(const k of Object.keys(row)){ const lk=kolomLicht(k); if(ks.some(x=>lk.includes(x))) return row[k]; }
    for(const k of Object.keys(row)){ const sk=kolomSleutel(k); if(ns.some(x=>x&&x.length>=4&&sk.includes(x))) return row[k]; }
    return '';
  };
  // detecteer format: asset-register (ci-type/fabrikant/wegnummer) of oude ria4/wind-lijst (dynac)
  const eersteRij=rijen[0]||{};
  const heeftDynac=Object.keys(eersteRij).some(k=>k.toLowerCase().includes('dynac'));
  const heeftCitype=Object.keys(eersteRij).some(k=>k.toLowerCase().includes('ci-type')||k.toLowerCase().includes('fabrikant'));
  const drips=[];

  if(heeftCitype && !heeftDynac){
    // ── ASSET-REGISTER (CSV) ──
    rijen.forEach(row=>{
      if(!isDripRij(row,g)) return;
      const asset=String(g(row,['asset'])||'').trim();
      // CDMS-code uit assetnaam, bv. (D70) of (dBD142). Een DRI-paneel met
      // een geldige code maar zonder A/N-weglocatie blijft prognoseareaal;
      // historische koppeling kan dan nog steeds op de code plaatsvinden.
      const codeM=asset.match(/\(((?:d?BD|D)\d+[A-Za-z]?)\)/i);
      const idCdms=codeM?codeM[1]:'';
      const loc=assetLocatie(row,g);
      if(!loc.weg&&!idCdms) return;
      if(!loc.weg)loc.weg='ONBEKEND';
      const bestuur=bestuurlijkeContextUitRow(row,g);
      const contractCtx=contractContextUitRow(row,g);
      const vc=bestuur.vc;
      const fabrikant=String(g(row,['fabrikant'])||'').trim();
      const type=String(g(row,['type'])||'').trim();
      const status=String(g(row,['status'])||'').trim();
      const ingebruikBron=registerWaardeBron(row,INSTALLATIE_DATUM_KEYS);
      const ingebruikRaw=ingebruikBron.waarde;
      const bouwjaar=parseBouwjaar(ingebruikRaw);
      const ingebruikDatum=parseAssetDatum(ingebruikRaw);
      const eolInfo=eolWaardeUitRegister(row);
      const hardware=String(g(row,['hardware'])||'').trim();
      // functie afleiden uit type: rotatiepaneel/bermdrip = informeren, DRIP/DRIP+ = sturen
      let functie='5';
      if(/drip\+?$|^drip/i.test(type)) functie='6';
      else if(/rotatie|bermdrip|bijzonder|volgbord/i.test(type)) functie='5';
      const fRegel=RULES.drip.functies.find(f=>f.code===functie);
      const entityid=String(g(row,['entityid'])||'').trim();
      const uid = entityid || asset || (loc.weg+'_'+loc.richting+'_'+loc.hm);
      const assetKey=assetKeyVoor('DRIP',entityid,asset||uid);
      const ria4=histBool(g(row,['ria4','ria-4','ria 4']));
      const wind=histBool(g(row,['windwaarschuwing','wind','wind drip']));
      drips.push({uid,entityid,_assetKey:assetKey,assetKey, rd:bestuur.rd,district:bestuur.district,districtBron:bestuur.districtBron,vc, idCdms, histCode:normDripCode(idCdms), asset, weg:loc.weg, richting:loc.richting, hm:loc.hm,
        fabrikant, type, model:hardware||type, hardware, status, bouwjaar, bouwjaarBron:bouwjaar?ingebruikBron.kolom:'', ingebruikDatum,
        _eolLife:eolInfo.levensduur, _eolLifeBron:eolInfo.levensduurBron?'assetregister (levensduur)':'',
        _eolYear:eolInfo.jaar,
        aannemer:contractCtx.aannemer,contract:contractCtx.contract,leverancier:contractCtx.leverancier,
        prognoseActief:statusActiefVoorPrognose(status), assetType:'DRIP', vervangJaar:null,
        functie, functieLabel:fRegel?fRegel.label:'onbekend', functieGewicht:fRegel?fRegel.gewicht:0.5,
        ria4,wind,sourceRia4:ria4,sourceWind:wind,specialRia4:ria4,specialWind:wind,opmerking:'', gaatWeg:/uit|verv|afgekeurd/i.test(status)});
    });
  } else {
    // ── OUDE RIA4/WIND-LIJST (xlsx met Dynac) ──
    rijen.forEach(row=>{
      const vc=String(g(row,['vc'])||'').trim();
      const dyn=String(g(row,['dynac'])||'').trim();
      if(!vc && !dyn) return;
      const loc=parseDripLocatie(dyn);
      const functie=String(g(row,['functie','bkn - functie'])||'').trim();
      const ria4=String(g(row,['ria4','ria-4'])||'').trim().toLowerCase()==='x';
      const wind=String(g(row,['wind'])||'').trim().toLowerCase()==='x';
      const idCdms=String(g(row,['cdms','drip (cdms)'])||'').trim();
      const opm=String(g(row,['opmerking','opm'])||'').trim();
      const fRegel=RULES.drip.functies.find(f=>f.code===functie);
      const uid = idCdms || dyn || (loc.weg+'_'+loc.richting+'_'+loc.hm);
      drips.push({uid, vc, idCdms, histCode:normDripCode(idCdms), dyn, weg:loc.weg, richting:loc.richting, hm:loc.hm,
        fabrikant:'', type:'', bouwjaar:null,
        functie, functieLabel:fRegel?fRegel.label:'onbekend', functieGewicht:fRegel?fRegel.gewicht:0.5,
        ria4, wind, opmerking:opm, gaatWeg:/gaat weg/i.test(opm)});
    });
  }

  const districtStats=vulDistrictenAanUitRegister(drips);
  const per=(pred)=>drips.filter(pred).length;
  const wegen=[...new Set(drips.map(d=>d.weg).filter(Boolean))].sort();
  const perVc={}; drips.forEach(d=>{ perVc[d.vc]=(perVc[d.vc]||0)+1; });
  const fabrikanten=[...new Set(drips.map(d=>d.fabrikant).filter(Boolean))].sort();
  const typen=[...new Set(drips.map(d=>d.type).filter(Boolean))].sort();
  return {
    drips, totaal:drips.length,
    ria4:per(d=>d.ria4), wind:per(d=>d.wind),
    sturen:per(d=>d.functie==='6'), informeren:per(d=>d.functie==='5'), vervalt:per(d=>d.functie==='0'),
    metBouwjaar:per(d=>d.bouwjaar), gaatWeg:per(d=>d.gaatWeg),
    wegen, perVc, fabrikanten, typen, districtStats
  };
}

/* ── DRIP-STORINGSHISTORIE ─────────────────────────────────────
   Accepteert zowel een vlak incidentbestand als de nieuwe werkmap met de
   tabbladen storingen, datadekking en asset_samenvatting. Alleen het
   incidentniveau wordt als storing gebruikt; losse alarmepisodes niet. */
function normaliseerDripHistorieRij(row,meta){
  const g=histGetter(row);
  const asset=String(g(['asset','drip','object','object_id','id_cdms','cdms','os_id','osid'])||'').trim();
  const locatieTekst=String(g(['locatie','location','assetnaam','asset_name','objectnaam','os_id','osid'])||'').trim();
  const code=normDripCode(asset)||normDripCode(locatieTekst);
  const loc=parseDripHistorieLocatie(locatieTekst||asset);
  const vc=loc.vc||normDripHistRegio(meta.regio||meta.name||'');
  const start=parseDripHistorieDatum(g(['start','van','begin','starttijd','start_time','datum_start','eerste_tijd']));
  let einde=parseDripHistorieDatum(g(['einde','tot','end','eindtijd','end_time','datum_einde','laatste_tijd']));
  const nUur=num(g(['totale_storingsduur_uur','storingsduur_uur','duur_uur','duration_hours','uitvalduur_uur','hersteltijd_uur']));
  const nDag=num(g(['totale_storingsduur_dagen','storingsduur_dagen','duur_dagen','aantal_dagen']));
  const nMin=num(g(['duur_minuten','storingsduur_minuten','duration_minutes']));
  let duurUren=nUur!=null?nUur:nDag!=null?nDag*24:nMin!=null?nMin/60:null;
  if(duurUren==null&&start!=null&&einde!=null) duurUren=Math.max(0,(einde-start)/3600e3);
  const incidentvenster=num(g(['incidentvenster_uur','incident_window_hours','venster_uur']));
  const cycli=Math.max(1,Math.round(num(g(['aantal_cycli','cycli','cycles','uit_aan_cycli']))||1));
  const classificatie=String(g(['classificatie','classification','duurtype','incidenttype','type_storing'])||'').trim().toUpperCase();
  const bron=String(g(['bron','source','eventbron'])||'').trim();
  const hardUit=histBool(g(['hard_uit_gezien','hard_uit','explicit_outage']))||/UIT\s*\/\s*AAN/i.test(bron);
  const censuurWaarde=g(['censurering','censored','open_aan_einde_databereik','open_at_end']);
  const censuurTekst=String(censuurWaarde==null?'':censuurWaarde).trim().toLowerCase();
  const censored=histBool(censuurWaarde)||!!(censuurTekst&&!['0','false','onwaar','nee','no','gesloten'].includes(censuurTekst));
  const technischeToestand=String(g(['technische_toestand','technical_state','toestand'])||'').trim();
  const alarmmeldingen=String(g(['alarmmeldingen','alarmen','melding','omschrijving','storingsomschrijving'])||'').trim();
  if(einde==null&&start!=null&&duurUren!=null) einde=start+duurUren*3600e3;
  const explicietIncident=/LANGDURIG|INTERMITTEREND|STORING|UITVAL|FAIL/i.test(classificatie);
  const bronIsIncident=/storing|incident/i.test(String(meta.sheet||''));
  const voldoet=explicietIncident||bronIsIncident||hardUit||(duurUren!=null&&duurUren>=4)||(incidentvenster!=null&&incidentvenster>=4)||cycli>=3;
  if(start==null||(!code&&!loc.weg)||!voldoet) return null;
  if(duurUren!=null) duurUren=Math.max(0,duurUren);
  const klasse=classificatie||(hardUit?'UITVAL':(duurUren||incidentvenster||0)>=4?'LANGDURIG':cycli>=3?'INTERMITTEREND':'STORING');
  return {asset,code,locatie:locatieTekst,vc,weg:loc.weg,richting:loc.richting,hm:loc.hm,
    start,einde,duurUren,incidentvensterUren:incidentvenster,cycli,classificatie:klasse,
    hardUit,censored,technischeToestand,bron,alarmmeldingen,sourceKey:meta.key,sourceName:meta.name,
    duurBetrouwbaar:duurUren>0&&!censored&&(hardUit||duurUren<168)};
}

function verwerkDripHistorieBron(meta,incidentRijen,dekkingRijen,assetRijen){
  const incidenten=[]; let afgewezen=0;
  (incidentRijen||[]).forEach(row=>{ const x=normaliseerDripHistorieRij(row,meta); if(x)incidenten.push(x); else afgewezen++; });
  const dekking=new Set();
  (dekkingRijen||[]).forEach(row=>{
    const g=histGetter(row), status=String(g(['status'])||'').trim().toUpperCase();
    if(status&&status!=='OK') return;
    let t=parseDripHistorieDatum(g(['datum','date','eerste_tijd','start']));
    if(t==null){ const m=String(g(['bestand','file','bestandsnaam'])||'').match(/(20\d{2})(\d{2})(\d{2})/); if(m)t=new Date(+m[1],+m[2]-1,+m[3]).getTime(); }
    if(t!=null) dekking.add(histDagSleutel(t));
  });
  const tijden=incidenten.flatMap(x=>[x.start,x.einde]).filter(x=>x!=null);
  const van=tijden.length?Math.min(...tijden):null, tot=tijden.length?Math.max(...tijden):null;
  if(!dekking.size&&van!=null&&tot!=null) histDagenTussen(van,tot).forEach(d=>dekking.add(d));
  const assetCodes=new Set(incidenten.map(x=>x.code).filter(Boolean));
  (assetRijen||[]).forEach(row=>{ const g=histGetter(row), c=normDripCode(g(['asset','drip','object','id_cdms','cdms']))||normDripCode(g(['locatie','location','assetnaam'])); if(c)assetCodes.add(c); });
  const regio=normDripHistRegio(meta.regio||meta.name||'')||(incidenten.find(x=>x.vc)||{}).vc||'';
  return {...meta,regio,format:meta.format||'vlak incidentbestand',incidenten,afgewezen,
    dekkingDatums:[...dekking].sort(),dekkingDagen:dekking.size,van,tot,assetCodes:[...assetCodes]};
}

function dripHistorieIncidentSleutel(x){
  const id=x.code||(x.weg+'|'+x.richting+'|'+(x.hm==null?'':x.hm.toFixed(3)));
  const s=x.start==null?'':Math.round(x.start/60000), e=x.einde==null?'':Math.round(x.einde/60000);
  // Dezelfde DRIP-code kan in verschillende verkeerscentralegebieden
  // voorkomen. Regio hoort daarom bij de sleutel om onterechte deduplicatie
  // tussen twee gebieden te voorkomen.
  return [x.vc||'',id,s,e].join('|');
}

function herbouwDripHistorie(){
  const bronnen=(DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[];
  const uniek=new Map(); let duplicaten=0;
  bronnen.forEach(bron=>bron.incidenten.forEach(x=>{
    const sleutel=dripHistorieIncidentSleutel(x);
    if(uniek.has(sleutel)){
      duplicaten++;
      const bestaand=uniek.get(sleutel);
      bestaand.sourceNames=[...new Set([...(bestaand.sourceNames||[bestaand.sourceName]),x.sourceName])];
      if((x.duurUren||0)>(bestaand.duurUren||0)) bestaand.duurUren=x.duurUren;
      bestaand.hardUit=bestaand.hardUit||x.hardUit; bestaand.censored=bestaand.censored&&x.censored;
      bestaand.duurBetrouwbaar=bestaand.duurUren>0&&!bestaand.censored&&(bestaand.hardUit||bestaand.duurUren<168);
    }else uniek.set(sleutel,{...x,sourceNames:[x.sourceName]});
  }));
  const incidenten=[...uniek.values()].sort((a,b)=>a.start-b.start);
  const dekking=new Set(); bronnen.forEach(b=>b.dekkingDatums.forEach(d=>dekking.add(d)));
  const assets=new Set(); bronnen.forEach(b=>b.assetCodes.forEach(c=>assets.add(c)));
  const tijden=incidenten.flatMap(x=>[x.start,x.einde]).filter(x=>x!=null);
  DRIP_HIST_STATE={sources:bronnen,incidenten,duplicaten,assetCodes:[...assets],dekkingDatums:[...dekking].sort(),
    dekkingDagen:dekking.size,van:tijden.length?Math.min(...tijden):null,tot:tijden.length?Math.max(...tijden):null,
    censoredN:incidenten.filter(x=>x.censored).length,
    duurUitgeslotenN:incidenten.filter(x=>!x.duurBetrouwbaar).length,
    episodesGenegeerd:bronnen.reduce((s,b)=>s+(b.episodesGenegeerd||0),0)};
  koppelDripHistorieAanAreaal();
}

function koppelDripHistorieAanAreaal(opties){
  opties=opties||{};
  const H=DRIP_HIST_STATE, D=DRIP_STATE||(STATE&&STATE.drips);
  if(!H){ return; }
  if(!D||!D.drips){ H.koppeling={gekoppeldeAssets:0,gekoppeldeIncidenten:0,nietGekoppeldeIncidenten:H.incidenten.length}; return; }
  D.drips.forEach(d=>{ d._hist=null; d.histCode=d.histCode||normDripCode(d.idCdms); });
  const codeMap=new Map();
  D.drips.forEach(d=>{ if(!d.histCode)return; const a=codeMap.get(d.histCode)||[]; a.push(d); codeMap.set(d.histCode,a); });
  const assetKeyMap=new Map(D.drips.map(d=>[d._assetKey||d.assetKey,d]));
  const isUitgesloten=code=>!!assetConfigBasis().uitgeslotenLogIds[assetLogSleutel(code)];
  const vind=(code,loc)=>{
    const logId=code||(loc&&(loc.code||loc.asset||loc.logId))||'';
    const logKey=assetLogSleutel(logId),cfg=assetConfigBasis();
    if(cfg.uitgeslotenLogIds[logKey])return null;
    const aliasKey=cfg.aliases[logKey];
    if(aliasKey&&assetKeyMap.has(aliasKey))return assetKeyMap.get(aliasKey);
    let cands=code?codeMap.get(code)||[]:[];
    if(loc&&loc.vc){ const regioCands=cands.filter(d=>String(d.vc||'').toUpperCase()===String(loc.vc).toUpperCase()); if(regioCands.length)cands=regioCands; }
    if(cands.length===1) return cands[0];
    const pool=cands.length?cands:D.drips;
    if(!loc||!loc.weg||loc.hm==null) return null;
    let best=null,afstand=Math.max(.01,Number(assetConfigBasis().hmTolerantieKm)||.35)+.01;
    pool.forEach(d=>{ if(d.weg!==loc.weg)return; if(loc.richting&&d.richting&&loc.richting!==d.richting)return; if(d.hm==null)return; const a=Math.abs(d.hm-loc.hm); if(a<afstand){afstand=a;best=d;} });
    return best;
  };
  const bronMap=new Map(H.sources.map(b=>[b.key,b]));
  const agg=new Map(),nietGekoppeldeCodes=new Set();
  const zorg=d=>{
    if(!agg.has(d.uid))agg.set(d.uid,{uid:d.uid,d,incidenten:[],dekking:new Set(),bronnen:new Set()});
    return agg.get(d.uid);
  };
  // Ook assets zonder incidenten uit asset_samenvatting krijgen nulwaarnemingen.
  H.sources.forEach(bron=>bron.assetCodes.forEach(code=>{
    const d=vind(code,{vc:bron.regio}); if(!d){if(!isUitgesloten(code))nietGekoppeldeCodes.add(code);return;}
    const a=zorg(d); bron.dekkingDatums.forEach(x=>a.dekking.add(x)); a.bronnen.add(bron.name);
  }));
  let gekoppeldeIncidenten=0,uitgeslotenIncidenten=0;
  H.incidenten.forEach(x=>{
    const d=vind(x.code,x); x.matchUid=d?d.uid:null;x.matchAssetKey=d?(d._assetKey||d.assetKey):null;
    if(!d){ if(isUitgesloten(x.code||x.asset)){x.matchStatus='buiten-areaal';uitgeslotenIncidenten++;}else if(x.code)nietGekoppeldeCodes.add(x.code); return; }
    x.matchStatus='gekoppeld';
    if(x.code)nietGekoppeldeCodes.delete(x.code);
    gekoppeldeIncidenten++;
    const a=zorg(d); a.incidenten.push(x); a.bronnen.add(x.sourceName);
    const bron=bronMap.get(x.sourceKey); if(bron)bron.dekkingDatums.forEach(y=>a.dekking.add(y));
  });
  const alleDuren=[]; agg.forEach(a=>a.incidenten.forEach(x=>{if(x.duurBetrouwbaar)alleDuren.push(x.duurUren);}));
  alleDuren.sort((a,b)=>a-b);
  const duurCap=alleDuren.length?alleDuren[Math.min(alleDuren.length-1,Math.floor(0.95*alleDuren.length))]:null;
  const assetStats=[];
  agg.forEach(a=>{
    const vals=a.incidenten.filter(x=>x.duurBetrouwbaar).map(x=>Math.min(x.duurUren,duurCap||x.duurUren));
    const gem=vals.length?vals.reduce((s,x)=>s+x,0)/vals.length:null;
    const sd=vals.length?Math.sqrt(vals.reduce((s,x)=>s+(x-gem)*(x-gem),0)/vals.length):null;
    const jaren=a.dekking.size/365.25;
    const hist={n:a.incidenten.length,dekkingDagen:a.dekking.size,dekkingJaren:jaren,
      rate:jaren>0?a.incidenten.length/jaren:null,duurN:vals.length,duurGemWinsor:gem,
      duurCv:gem>0?sd/gem:null,betrouwbareDownUren:a.incidenten.filter(x=>x.duurBetrouwbaar).reduce((s,x)=>s+x.duurUren,0),
      langdurigN:a.incidenten.filter(x=>/LANGDURIG/.test(x.classificatie)).length,
      intermitterendN:a.incidenten.filter(x=>/INTERMITTEREND/.test(x.classificatie)).length,
      hardUitN:a.incidenten.filter(x=>x.hardUit).length,bronnen:[...a.bronnen]};
    a.d._hist=hist; assetStats.push({code:a.d.histCode||a.d.idCdms,label:dripMemoLabel(a.d),asset:a.d.asset,weg:a.d.weg,richting:a.d.richting,hm:a.d.hm,...hist});
  });
  assetStats.sort((a,b)=>b.n-a.n||b.betrouwbareDownUren-a.betrouwbareDownUren);
  H.duurCapUren=duurCap; H.duurBetrouwbaarN=alleDuren.length; H.assetStats=assetStats;
  H.koppeling={gekoppeldeAssets:assetStats.length,gekoppeldeIncidenten,
    uitgeslotenIncidenten,nietGekoppeldeIncidenten:H.incidenten.length-gekoppeldeIncidenten-uitgeslotenIncidenten,
    nietGekoppeldeCodes:[...nietGekoppeldeCodes].sort()};
  if(!opties.slaMatchBeeldOver)herbouwAssetMatchBeeld();
}

function dripHistorieWerkboekBron(file,buffer){
  const isCsv=/\.csv$/i.test(file.name); let wb;
  if(isCsv){
    const txt=new TextDecoder('utf-8').decode(new Uint8Array(buffer)).replace(/^\uFEFF/,'');
    const kop=txt.split(/\r?\n/,1)[0]||'';
    const fs=(kop.match(/;/g)||[]).length>=(kop.match(/,/g)||[]).length?';':',';
    wb=XLSX.read(txt,{type:'string',FS:fs,raw:true,cellDates:true});
  }else wb=XLSX.read(buffer,{type:'array',cellDates:true,dense:true});
  const normNaam=n=>histKolomNaam(n);
  let incidentNaam=wb.SheetNames.find(n=>normNaam(n)==='storingen');
  if(!incidentNaam){
    incidentNaam=wb.SheetNames.find(n=>{
      const r=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,range:0,blankrows:false,defval:''})[0]||[];
      const k=r.map(normNaam); return k.some(x=>['asset','drip','os_id','object'].includes(x))&&k.some(x=>['start','van','begin'].includes(x));
    })||wb.SheetNames[0];
  }
  const dekNaam=wb.SheetNames.find(n=>normNaam(n)==='datadekking');
  const assetNaam=wb.SheetNames.find(n=>normNaam(n)==='asset_samenvatting');
  const episodesNaam=wb.SheetNames.find(n=>normNaam(n)==='alle_episodes');
  const rijen=XLSX.utils.sheet_to_json(wb.Sheets[incidentNaam],{defval:'',raw:true});
  const dekRijen=dekNaam?XLSX.utils.sheet_to_json(wb.Sheets[dekNaam],{defval:'',raw:true}):[];
  const assetRijen=assetNaam?XLSX.utils.sheet_to_json(wb.Sheets[assetNaam],{defval:'',raw:true}):[];
  let episodesGenegeerd=0;
  if(episodesNaam&&wb.Sheets[episodesNaam]['!ref']) episodesGenegeerd=Math.max(0,XLSX.utils.decode_range(wb.Sheets[episodesNaam]['!ref']).e.r);
  const formaat=dekNaam&&assetNaam?'DRIP-incidentwerkmap':'vlak incidentbestand';
  const meta={key:file.name.toLowerCase(),name:file.name,size:file.size||buffer.byteLength,sheet:incidentNaam,format:formaat,episodesGenegeerd,regio:normDripHistRegio(file.name)};
  const bron=verwerkDripHistorieBron(meta,rijen,dekRijen,assetRijen);
  if(!bron.incidenten.length) throw new Error('geen herkenbare DRIP-storingsincidenten gevonden');
  return bron;
}

async function dripHistorieWerkboekBronLicht(file,voortgang){
  if(/\.csv$/i.test(file.name)){
    const rijen=await leesCsvRijenLicht(file,null,null,voortgang),meta={key:file.name.toLowerCase(),name:file.name,size:file.size,sheet:file.name,format:'vlak incidentbestand',episodesGenegeerd:0,regio:normDripHistRegio(file.name)};
    const bron=verwerkDripHistorieBron(meta,rijen,[],[]);if(!bron.incidenten.length)throw new Error('geen herkenbare DRIP-storingsincidenten gevonden');return bron;
  }
  const ctx=await xlsxContextLicht(file,voortgang),vind=n=>ctx.bladen.find(b=>histKolomNaam(b.naam)===n);
  const incidentBlad=vind('storingen')||ctx.bladen[0],dekBlad=vind('datadekking'),assetBlad=vind('asset_samenvatting');
  if(!incidentBlad)throw new Error('geen werkblad met storingen gevonden');
  const rijen=await xlsxLeesBladLicht(ctx,incidentBlad,null,null,(f,fa)=>{if(voortgang)voortgang(.20+.55*f,fa);});
  const dekRijen=dekBlad?await xlsxLeesBladLicht(ctx,dekBlad,null,null,(f,fa)=>{if(voortgang)voortgang(.75+.10*f,fa);}):[];
  const assetRijen=assetBlad?await xlsxLeesBladLicht(ctx,assetBlad,null,null,(f,fa)=>{if(voortgang)voortgang(.85+.10*f,fa);}):[];
  const formaat=dekBlad&&assetBlad?'DRIP-incidentwerkmap':'vlak incidentbestand';
  const meta={key:file.name.toLowerCase(),name:file.name,size:file.size,sheet:incidentBlad.naam,format:formaat,episodesGenegeerd:0,regio:normDripHistRegio(file.name)};
  const bron=verwerkDripHistorieBron(meta,rijen,dekRijen,assetRijen);if(!bron.incidenten.length)throw new Error('geen herkenbare DRIP-storingsincidenten gevonden');return bron;
}
async function leesDripHistorieBronBestand(file,voortgang){
  if(/\.csv$/i.test(file.name)||geheugenarmeXlsxNodig(file))return dripHistorieWerkboekBronLicht(file,voortgang);
  if(/\.xls$/i.test(file.name)){
    const rijen=await sheetJsWorkerRijen(file,null,null,voortgang),meta={key:file.name.toLowerCase(),name:file.name,size:file.size,sheet:file.name,format:'vlak incidentbestand',episodesGenegeerd:0,regio:normDripHistRegio(file.name)};
    const bron=verwerkDripHistorieBron(meta,rijen,[],[]);if(!bron.incidenten.length)throw new Error('geen herkenbare DRIP-storingsincidenten gevonden');return bron;
  }
  try{if(voortgang)voortgang(.05,'Bestand lezen');const bron=dripHistorieWerkboekBron(file,await file.arrayBuffer());if(voortgang)voortgang(.95,'DRIP-incidenten verwerkt');return bron;}
  catch(err){if(!/\.xlsx$|\.xlsm$/i.test(file.name))throw err;return dripHistorieWerkboekBronLicht(file,voortgang);}
}

function leesDripHistorieBestanden(fileList){
  const files=[...fileList]; if(!files.length)return;
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De DRIP-historie wordt daarna rechtstreeks aan het DRIP-areaal gekoppeld.');renderDataGereedheid();return;}
  return (async()=>{
    const nieuw=[],fouten=[];
    for(const file of files){
      zetStoringsImportStatus(`Bezig met laden van DRIP-historie: ${file.name}. ${geheugenarmeXlsxNodig(file)?'Geheugenarme mobiele leesmodus actief.':''}`);
      zetImportVoortgang(file.name,0,'DRIP-storingshistorie voorbereiden',{direct:true});
      await uiPauze();
      try{const bron=await leesDripHistorieBronBestand(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*72,fa));nieuw.push(bron);zetImportVoortgang(file.name,74,`${bron.incidenten.length.toLocaleString('nl-NL')} DRIP-incidenten gelezen.`,{direct:true});}
      catch(err){fouten.push(file.name+': '+err.message);importMislukt(file.name,err.message);}
    }
    if(nieuw.length){
      const laatste=nieuw[nieuw.length-1];
      zetImportVoortgang(laatste.name,78,'DRIP-bronnen samenvoegen en ontdubbelen',{direct:true});await uiPauze();
      const bestaand=(DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[];
      const vervang=new Set(nieuw.map(x=>x.key));
      DRIP_HIST_STATE={sources:[...bestaand.filter(x=>!vervang.has(x.key)),...nieuw]};
      herbouwDripHistorie(); DRIP_MC=null;
      ANALYSE_SIGNATURE='';
      zetImportVoortgang(laatste.name,92,'DRIP-incidenten gekoppeld; analysepoorten bijwerken',{direct:true});await uiPauze();
      if(ASSET_REGISTER_STATE)probeerAnalyseActiveren('drips',{inspectieAlGereed:true,matchAlGereed:true});
      else renderDataGereedheid();
      importKlaar(laatste.name,`${DRIP_HIST_STATE.incidenten.length.toLocaleString('nl-NL')} DRIP-incidenten samengevoegd en aan All Assets gekoppeld.`);
    }
    zetStoringsImportStatus(fouten.length?`${nieuw.length} DRIP-bron(nen) geladen, ${fouten.length} niet geladen.`:`${nieuw.length} DRIP-bron(nen) geladen.`);
    if(fouten.length)alert('Niet alle DRIP-storingsbestanden konden worden geladen:\n'+fouten.join('\n'));
    else if(nieuw.length&&!((STATE&&STATE.drips)||DRIP_STATE))alert('De DRIP-storingshistorie is geladen, maar in All Assets zijn geen herkenbare DRIP-assets gevonden. Controleer de assetlijst.');
  })();
}
function wisDripHistorie(){
  DRIP_HIST_STATE=null; DRIP_MC=null;
  const D=(STATE&&STATE.drips)||DRIP_STATE; if(D)D.drips.forEach(d=>d._hist=null);
  ANALYSE_SIGNATURE='';probeerAnalyseActiveren('drips');
}

/* Match RIA4/wind-vlaggen uit een aparte lijst op de asset-DRIPs (weg + hm ±tol). */
function matchRia4Wind(assetDrips, flagRijen){
  const g=(row,keys)=>{
    for(const k of Object.keys(row)){ if(keys.includes(k.toLowerCase().trim())) return row[k]; }
    for(const k of Object.keys(row)){ const lk=k.toLowerCase().trim(); if(keys.some(x=>lk.includes(x))) return row[k]; }
    return '';
  };
  const flags=[];
  flagRijen.forEach(row=>{
    const dyn=String(g(row,['dynac','drip (dynac)'])||'').trim();
    const loc=parseDripLocatie(dyn); if(!loc.weg) return;
    flags.push({weg:loc.weg, richting:loc.richting, hm:loc.hm,
      ria4:String(g(row,['ria4','ria-4'])||'').trim().toLowerCase()==='x',
      wind:String(g(row,['windwaarschuwing','wind'])||'').trim().toLowerCase()==='x'});
  });
  let gematcht=0;
  flags.forEach(f=>{
    // vind de dichtstbijzijnde asset-DRIP voor deze flag (zelfde weg, richting indien bekend)
    let best=null, bestDh=0.51;
    assetDrips.forEach(d=>{
      if(f.weg!==d.weg) return;
      if(f.richting && d.richting && f.richting!==d.richting) return;
      if(f.hm==null || d.hm==null) return;
      const dh=Math.abs(f.hm-d.hm);
      if(dh<bestDh){ bestDh=dh; best=d; }
    });
    if(best){ if(f.ria4)best.ria4=true; if(f.wind)best.wind=true; gematcht++; }
  });
  return gematcht;
}
function assetRijNodigLicht(row){
  const tp=registerAssetType(row,registerWaarde);
  const dyn=registerWaarde(row,['dynac','drip (dynac)']);
  if(!tp&&!dyn)return null;
  const v=keys=>registerWaarde(row,keys);
  if(!tp)return {
    dynac:dyn,cdms:v(['cdms','drip (cdms)']),functie:v(['functie','bkn - functie']),
    ria4:v(['ria4','ria-4']),wind:v(['windwaarschuwing','wind']),
    opmerking:v(['opmerking','opm']),vc:v(VC_KEYS),rd:v(RD_KEYS),district:v(DISTRICT_KEYS)
  };
  return {
    entityid:v(['entityid']),regio:v(['regio','vc']),vc:v(VC_KEYS),rd:v(RD_KEYS),district:v(DISTRICT_KEYS),'ci-type':v(['ci-type']),asset:v(['asset']),status:v(['status']),
    'bps-locatie':v(['bps-locatie']),wegnummer:v(['wegnummer']),wegdeelletter:v(['wegdeelletter']),
    'hm-bord':v(['hm-bord','hm']),'afstand-tot-hm-bord':v(['afstand-tot-hm-bord']),baanpositie:v(['baanpositie']),
    'rd-locatie-x':v(['rd-locatie-x','rd locatie x']),'rd-locatie-y':v(['rd-locatie-y','rd locatie y']),
    type:v(['type','model']),hardware:v(['hardware']),fabrikant:v(['fabrikant','fabrikaat']),
    ingebruikname:v(INSTALLATIE_DATUM_KEYS),
    'nen-element':v(['nen-element']),'nen-bouwdeel':v(['nen-bouwdeel']),'nen-subtype':v(['nen-subtype']),
    eol:v(EOL_DATUM_KEYS),
    life_median_years:v(LEVENSDUUR_KEYS)
  };
}
async function leesAssetRijenBestand(file,voortgang){
  if(/\.csv$/i.test(file.name))return leesCsvRijenLicht(file,ASSET_KOLOMMEN_LICHT,assetRijNodigLicht,voortgang);
  if(/\.xls$/i.test(file.name)){
    try{return await sheetJsWorkerRijen(file,ASSET_KOLOMMEN_LICHT,assetRijNodigLicht,voortgang);}
    catch(workerErr){
      try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true,dense:true}),ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(ws,{defval:'',raw:true}).map(r=>compacteRijLicht(r,ASSET_KOLOMMEN_LICHT)).map(assetRijNodigLicht).filter(Boolean);}
      catch(mainErr){throw new Error(`XLS-lezer: ${workerErr.message}; directe lezer: ${mainErr.message}`);}
    }
  }
  if(geheugenarmeXlsxNodig(file))return xlsxEersteBladLicht(file,ASSET_KOLOMMEN_LICHT,assetRijNodigLicht,voortgang);
  try{
    if(voortgang)voortgang(.05,'Assetbestand lezen');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true,dense:true}),ws=wb.Sheets[wb.SheetNames[0]];
    const r=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true}).map(r=>compacteRijLicht(r,ASSET_KOLOMMEN_LICHT)).map(assetRijNodigLicht).filter(Boolean);if(voortgang)voortgang(.95,'Relevante assets geselecteerd');return r;
  }catch(err){
    if(!/\.xlsx$|\.xlsm$/i.test(file.name))throw err;
    return xlsxEersteBladLicht(file,ASSET_KOLOMMEN_LICHT,assetRijNodigLicht,voortgang);
  }
}
function leesDripBestand(file){
  return (async()=>{
    try{
      const bestandSoort=await herkenStoringsBestandSoort(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:Math.min(18,f*100),fa));
      if(bestandSoort.rol==='drip'||bestandSoort.rol==='dvm'){
        zetStoringsImportStatus(`${file.name} is herkend als ${bestandSoort.rol==='drip'?'DRIP-storingshistorie':'DVM-storingslog'} en wordt met de juiste lezer geopend.`);
        return laadStoringsBestandenAutomatisch([file]);
      }
      zetStoringsImportStatus(`Bezig met laden van stamregister: ${file.name}. ${/\.csv$/i.test(file.name)||geheugenarmeXlsxNodig(file)?'Geheugenarme mobiele leesmodus actief.':''}`);
      zetImportVoortgang(file.name,0,'All Assets voorbereiden',{direct:true});
      await uiPauze();
      let rijen=await leesAssetRijenBestand(file,(f,fa)=>zetImportVoortgang(file.name,f==null?null:f*72,fa));
      if(!rijen.length){ zetStoringsImportStatus('Assetlijst niet geladen: geen herkenbare rijen gevonden.');importMislukt(file.name,'Geen herkenbare assetregels gevonden.');alert('Geen herkenbare rijen gevonden in het asset- of selectiebestand.'); return; }
      zetImportVoortgang(file.name,74,`${rijen.length.toLocaleString('nl-NL')} herkenbare assetregels geselecteerd`,{direct:true});
      await uiPauze();

      // detecteer of dit de RIA4/wind-selectielijst is (Dynac-kolom, geen fabrikant/ci-type)
      const k0=Object.keys(rijen[0]||{}).map(k=>k.toLowerCase());
      const isFlagLijst = k0.some(k=>k.includes('dynac')) && !k0.some(k=>k.includes('ci-type')||k.includes('fabrikant'));
      const isAssetRegister = k0.some(k=>k.includes('ci-type')) && k0.some(k=>k.includes('asset'));

      // Als er al een asset-register is en dit is de flag-lijst → alleen matchen, niet vervangen
      if(isFlagLijst && DRIP_STATE && DRIP_STATE.metBouwjaar){
        const n=matchRia4Wind(DRIP_STATE.drips, rijen);
        DRIP_STATE.ria4=DRIP_STATE.drips.filter(d=>d.ria4).length;
        DRIP_STATE.wind=DRIP_STATE.drips.filter(d=>d.wind).length;
        ANALYSE_SIGNATURE='';probeerAnalyseActiveren('drips');
        zetStoringsImportStatus(`RIA4/wind-selectielijst geladen: ${n} DRIPs gekoppeld.`);importKlaar(file.name,`${n} DRIPs aan RIA4/windselectie gekoppeld.`);
        alert(`RIA4/wind-selectielijst gematcht op het asset-register: ${n} DRIPs gekoppeld (${DRIP_STATE.ria4} RIA4, ${DRIP_STATE.wind} wind).`);
        return;
      }

      if(isFlagLijst&&!isAssetRegister){
        zetStoringsImportStatus('Selectielijst herkend. Laad eerst het assetregister.');importMislukt(file.name,'Eerst het assetregister laden.');
        alert('Dit bestand is een RIA4/wind-selectielijst en geen assetregister. Laad bij stap 1 eerst All Assets met kolommen zoals asset, ci-type, fabrikant en ingebruikname/installatiedatum.');
        return;
      }
      if(!isAssetRegister){
        zetStoringsImportStatus('Assetlijst niet geladen: vereiste kolommen ontbreken.');importMislukt(file.name,'Vereiste kolommen asset en ci-type ontbreken.');
        alert('Geen herkenbare assetlijst. Vereist zijn minimaal de kolommen asset en ci-type; voor prognoses daarnaast ingebruikname/installatiedatum/datum-in-dienst of bouwjaar, plus EOL- of levensduurgegevens.');
        return;
      }
      TOTAAL_IMPORT_GELADEN=false;

      // Niet-relevante registerregels zijn al tijdens het lezen verwijderd.
      // Deze extra controle houdt ook kleine, via SheetJS gelezen bestanden compact.
      rijen=rijen.filter(r=>registerAssetType(r,registerWaarde));

      zetImportVoortgang(file.name,77,'Bouwjaarcohorten opbouwen',{direct:true});await uiPauze();
      DVM_LEEFTIJD_STATE=verwerkDvmLeeftijd(rijen);
      zetImportVoortgang(file.name,81,'Assetindex, areaal en locaties opbouwen',{direct:true});await uiPauze();
      analyseerAssetRegister(rijen,file.name);
      if(ASSET_REGISTER_STATE)ASSET_REGISTER_STATE.ruweRegisterRijen=rijen.slice();
      zetImportVoortgang(file.name,86,'DRIP-areaal uit het stamregister afleiden',{direct:true});await uiPauze();
      DRIP_STATE=verwerkDrips(rijen);
      DRIP_STATE.bestand=file.name;
      if(DVM_LEEFTIJD_STATE) DRIP_STATE.leeftijdsdekking={
        actief:DVM_LEEFTIJD_STATE.actief, metJaar:DVM_LEEFTIJD_STATE.metJaar,
        pct:DVM_LEEFTIJD_STATE.actief?DVM_LEEFTIJD_STATE.metJaar/DVM_LEEFTIJD_STATE.actief:0
      };
      // koppel EOL-referentie indien geladen
      if(EOL_REF.length) DRIP_STATE.drips.forEach(d=>{ d._eolRef=eolRegelVoor(d.fabrikant,d.model||d.type,'DRIP'); d._rel=null; });
      rijen=null;
      zetImportVoortgang(file.name,90,'Geladen DRIP-historie aan het nieuwe stamregister koppelen',{direct:true});await uiPauze();
      if(DRIP_HIST_STATE)koppelDripHistorieAanAreaal({slaMatchBeeldOver:true});
      zetImportVoortgang(file.name,93,'Storingslogs één keer tegen All Assets controleren',{direct:true});await uiPauze();
      STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
      zetImportVoortgang(file.name,96,'Assetkoppelingen en handmatige restlijst opbouwen',{direct:true});await uiPauze();
      herbouwAssetMatchBeeld();
      zetImportVoortgang(file.name,98,'Beschikbare analyses activeren',{direct:true});await uiPauze();
      ANALYSE_SIGNATURE='';probeerAnalyseActiveren(DRIP_STATE.totaal?'drips':'overzicht',{inspectieAlGereed:true,matchAlGereed:true});
      zetStoringsImportStatus(`Assetlijst geladen: ${ASSET_REGISTER_STATE.actiefN.toLocaleString('nl-NL')} actieve en ${ASSET_REGISTER_STATE.assets.length.toLocaleString('nl-NL')} herkenbare assets.`);importKlaar(file.name,`${ASSET_REGISTER_STATE.actiefN.toLocaleString('nl-NL')} actieve assets voor areaal; niet-operationele assets blijven alleen als historische matchreferentie beschikbaar. Geen storingen uit dit bestand geteld.`);

      // duidelijke terugkoppeling, met waarschuwing bij ontbrekende stichtingsjaren
      if(!DRIP_STATE.metBouwjaar){
        alert(`${DRIP_STATE.totaal} DRIPs geladen, maar zonder stichtingsjaar.\n\nDit lijkt de RIA4/wind-selectielijst (Dynac) te zijn, niet het asset-register. De leeftijdsafhankelijke Monte Carlo heeft het asset-register nodig met een installatieveld zoals 'ingebruikname', 'installatiedatum', 'datum-in-dienst' of 'bouwjaar' (fabrikant, ci-type). Laad dat bestand eerst; de selectielijst matcht daarna automatisch de RIA4/wind-vlaggen.`);
      }
    }catch(err){ zetStoringsImportStatus('Asset- of selectiebestand niet geladen: '+err.message);importMislukt(file.name,err.message);alert('Kon het asset- of selectiebestand niet verwerken: '+err.message); console.error(err); }
  })();
}
document.getElementById('xlsInput').addEventListener('change',async e=>{const invoer=e.currentTarget,f=[...invoer.files];if(!f.length)return;try{await laadStoringsBestandenAutomatisch(f);}finally{invoer.value='';}});
document.addEventListener('DOMContentLoaded',()=>{ const di=document.getElementById('dripInput'); if(di) di.addEventListener('change',async e=>{const invoer=e.currentTarget,f=invoer.files[0];if(!f)return;try{await leesDripBestand(f);}finally{invoer.value='';}}); });
document.addEventListener('DOMContentLoaded',()=>{ const hi=document.getElementById('dripHistInput'); if(hi) hi.addEventListener('change',async e=>{const invoer=e.currentTarget,f=[...invoer.files];if(!f.length)return;try{await laadStoringsBestandenAutomatisch(f);}finally{invoer.value='';}}); });
document.addEventListener('DOMContentLoaded',()=>{ const ai=document.getElementById('autoLogInput'); if(ai) ai.addEventListener('change',async e=>{const invoer=e.currentTarget,f=[...invoer.files];if(!f.length)return;try{await laadStoringsBestandenAutomatisch(f);}finally{invoer.value='';}}); });
document.addEventListener('DOMContentLoaded',()=>{ const ei=document.getElementById('eolInputTop'); if(ei) ei.addEventListener('change',async e=>{const invoer=e.currentTarget,f=invoer.files[0];if(!f)return;try{await leesEolReferentie(f);}finally{invoer.value='';}}); });
document.addEventListener('DOMContentLoaded',()=>{ const ui=document.getElementById('uRouteInput'); if(ui) ui.addEventListener('change',async e=>{const invoer=e.currentTarget,f=invoer.files[0];if(!f)return;try{await leesURouteBestand(f);}finally{invoer.value='';}}); });
document.addEventListener('DOMContentLoaded',()=>{ const wi=document.getElementById('werkInput'); if(wi) wi.addEventListener('change',async e=>{const invoer=e.currentTarget,f=invoer.files[0];if(!f)return;try{await leesWerkBestand(f);}finally{invoer.value='';}}); });
document.addEventListener('DOMContentLoaded',()=>{ const li=document.getElementById('liveLogInput'); if(li) li.addEventListener('change',async e=>{const invoer=e.currentTarget,f=[...invoer.files];if(!f.length)return;try{await leesLiveStoringsBestanden(f);}finally{invoer.value='';}}); });
const dz=document.getElementById('dz');
dz.addEventListener('click',()=>document.getElementById('dripInput').click());
['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
dz.addEventListener('drop',e=>{const f=[...e.dataTransfer.files];if(f.length>1){alert('Kies één All Assets-bestand. Storingslogs kunnen daarna wel als groep worden geladen.');return;}if(f[0])leesDripBestand(f[0]);});

/* tabs */
document.getElementById('tabs').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return; toonTab(b.dataset.tab);
});
function toonTab(t){
  if(!tabToegestaan(t)){
    document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
    document.querySelectorAll('.tabpage').forEach(p=>p.classList.add('hidden'));
    const slot=document.getElementById('tab-'+t);slot.innerHTML=blokkadeHtml(t);slot.classList.remove('hidden');
    return;
  }
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.tabpage').forEach(p=>p.classList.add('hidden'));
  document.getElementById('tab-'+t).classList.remove('hidden');
}

/* ══════════════════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════════════════ */
function renderAlles(){
  const g=berekenGereedheid();
  if(g.basisAlgemeen){renderOverzicht();renderWegdelen();renderStoringen();renderBerekening();renderWegdeelverslag();renderGebied();}
  if(MSI_MONTE_CARLO_ACTIEF&&ASSET_REGISTER_STATE)renderPrognose();
  if(g.dripAreaal)renderDrips();
  if(ASSET_REGISTER_STATE)renderRapport();
  renderDatasetBeheer();
  if(g.iets)renderRegels();
  updateTabSloten();
  nummerGrafiekenEnTabellen(document);
}

function bronGemiddeldUitWegdelen(wegdelen){
  const uit={};
  ['MSI','CAM','LUS','DRIP','WISSELBORD'].forEach(tp=>{
    let sb=0,sp=0,w=0,n=0;
    wegdelen.forEach(wd=>{
      const b=wd.bron&&wd.bron[tp];
      if(!b)return;
      const ww=(b.N&&b.N>0)?b.N:(wd.N||1);
      sb+=b.besch*ww;sp+=b.perf*ww;w+=ww;n+=b.n||0;
    });
    uit[tp]=w?{besch:sb/w,perf:sp/w,N:w,n}:{besch:100,perf:100,N:0,n:0};
  });
  return uit;
}
function subprocessenVoorBron(bron){
  return DIENSTEN.map(d=>({
    dienst:d,
    subprocessen:(SUBPROCESSEN[d.id]||[]).map(sp=>{
      const v=subprocesWaarde(sp.afh,bron);
      return {dienst:d,naam:sp.naam,besch:v.besch,prestatie:v.prestatie,tekst:sp.tekst};
    }).sort((a,b)=>a.besch-b.besch)
  }));
}
function vwmLandelijkDienstHtml(){
  const bron=bronGemiddeldUitWegdelen(STATE.wegdelen);
  const sub=subprocessenVoorBron(bron);
  return `<div class="card"><h3>VWM landelijk, prestatie per dienstverlening en subproces</h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Landelijk beeld voor de dienstverlening. De waarden komen uit de open storingen op het analysemoment. Subprocessen laten zien welk onderdeel binnen een dienst het eerst geraakt wordt.</p>
    <div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Dienstverlening</th><th class="num">Besch.</th><th class="num">Prest.</th><th>Laagste subprocessen</th><th>Belangrijkste bron</th></tr></thead><tbody>
    ${sub.map(x=>{
      const n=STATE.netwerk[x.dienst.id],laag=x.subprocessen.slice(0,3);
      const bronTxt=Object.entries(dienstAssetAfhankelijkheid(x.dienst)).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k.replace(/_/g,' ')} ${Math.round(v*100)}%`).join(', ');
      return `<tr><td><b style="color:${x.dienst.kleur}">${x.dienst.naam.replace(/&amp;/g,'&')}</b><br><span class="muted">${esc(x.dienst.doel)}</span></td>
        <td class="num" style="color:${beschKleur(n.besch,x.dienst.norm)};font-weight:700">${fmt(n.besch,2)}%</td>
        <td class="num" style="color:${beschKleur(n.prestatie,x.dienst.norm)}">${fmt(n.prestatie,2)}%</td>
        <td>${laag.map(sp=>`<span class="chip"><b>${esc(sp.naam)}</b> ${fmt(sp.besch,1)}%</span>`).join(' ')}</td>
        <td class="muted">${esc(bronTxt)}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}
function vcWerkRouteContext(vc){
  let werk=0,werkAssets=0,route=0,routeAssets=0;
  if(WERK_STATE&&WERK_STATE.werken)WERK_STATE.werken.forEach(w=>{
    const keys=w.assetKeys&&w.assetKeys.length?w.assetKeys:[];
    const raakt=keys.some(k=>{const a=assetUitKey(k);return a&&normAssetVc(a.vc)===vc;});
    const wegRaakt=!keys.length&&w.weg&&ASSET_INDEX&&ASSET_INDEX.byRoad&&(ASSET_INDEX.byRoad.get(w.weg)||[]).some(a=>normAssetVc(a.vc)===vc);
    if(raakt||wegRaakt){werk++;werkAssets+=keys.filter(k=>{const a=assetUitKey(k);return a&&normAssetVc(a.vc)===vc;}).length;}
  });
  if(U_ROUTE_STATE&&U_ROUTE_STATE.routes)U_ROUTE_STATE.routes.forEach(r=>{
    const inzet=routeInzetAssets(r),assets=uniekeAssets([...inzet.voor,...inzet.na,...inzet.langs]);
    const raakt=assets.some(a=>normAssetVc(a.vc)===vc)||(!assets.length&&normAssetVc(r.vc)===vc);
    if(raakt){route++;routeAssets+=assets.filter(a=>normAssetVc(a.vc)===vc).length;}
  });
  return {werk,werkAssets,route,routeAssets};
}
function vwmVcUitvoeringHtml(){
  const vcCodes=[...new Set(STATE.wegdelen.map(w=>normAssetVc(w.vc)||'ONBEKEND'))].sort();
  const rows=vcCodes.map(vc=>{
    const wds=STATE.wegdelen.filter(w=>normAssetVc(w.vc)===vc);
    const bron=bronGemiddeldUitWegdelen(wds);
    const diensten=DIENSTEN.map(d=>{
      let sb=0,sp=0,w=0,onder=0;
      wds.forEach(wd=>{const dd=wd.diensten[d.id],ww=wd.N||1;sb+=dd.besch*ww;sp+=dd.prestatie*ww;w+=ww;if(dd.besch<d.norm)onder++;});
      return {d,besch:w?sb/w:100,prestatie:w?sp/w:100,onder};
    }).sort((a,b)=>a.besch-b.besch);
    const subs=subprocessenVoorBron(bron).flatMap(x=>x.subprocessen.map(sp=>({...sp,dienst:x.dienst}))).sort((a,b)=>a.besch-b.besch);
    return {vc,wds,diensten,subs,ctx:vcWerkRouteContext(vc),storingen:wds.reduce((s,w)=>s+(w.n||0),0),assets:wds.reduce((s,w)=>s+(w.N||0),0)};
  }).sort((a,b)=>a.diensten[0].besch-b.diensten[0].besch||b.storingen-a.storingen);
  return `<div class="card"><h3>Regionale uitvoering per verkeerscentrale</h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">VC is de uitvoerende doorsnede. Daarom staan werkzaamheden en U-routes hier onder de VC-prestatie. RD en district blijven in het rapport beschikbaar als bestuurlijke doorsnede.</p>
    <div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>VC</th><th class="num">Open storingen</th><th>Laagste dienstverlening</th><th>Laagste subprocessen</th><th>Werkzaamheden en U-routes</th></tr></thead><tbody>
    ${rows.map(r=>{
      const zw=r.diensten[0],subs=r.subs.slice(0,3),ctx=r.ctx;
      return `<tr><td><b>${esc(r.vc)}</b><br><span class="muted">${r.wds.length} wegdelen, ${r.assets.toLocaleString('nl-NL')} areaalgewicht</span></td>
        <td class="num">${r.storingen.toLocaleString('nl-NL')}</td>
        <td><b style="color:${beschKleur(zw.besch,zw.d.norm)}">${zw.d.naam.replace(/&amp;/g,'&')} ${fmt(zw.besch,2)}%</b><br><span class="muted">prestatie ${fmt(zw.prestatie,2)}%, ${zw.onder} wegdelen onder norm</span></td>
        <td>${subs.map(sp=>`<span class="chip"><b>${esc(sp.dienst.id.toUpperCase())}</b> ${esc(sp.naam)} ${fmt(sp.besch,1)}%</span>`).join(' ')||'<span class="muted">geen subproceswaarde</span>'}</td>
        <td>Werk ${ctx.werk.toLocaleString('nl-NL')}<br><span class="muted">${ctx.werkAssets.toLocaleString('nl-NL')} gekoppelde werkassets, ${ctx.route.toLocaleString('nl-NL')} U-routes, ${ctx.routeAssets.toLocaleString('nl-NL')} routeassets</span></td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

function liveSignaalgeverGevolgenHtml(context){
  const rows=(STATE&&STATE.wegdelen||[]).filter(wd=>(wd.meldingen||[]).some(m=>m.typeId==='MSI'))
    .slice().sort((a,b)=>a.besch-b.besch||b.n-a.n);
  return `<div class="card"><h3>Actuele gevolgen open signaalgeverstoringen ${tip('Dit is de live opvolger van de verdiepende wegdeeltabel uit de signaalgeverprognose. De tabel gebruikt uitsluitend de huidige open MSI-storingen. Historie, Monte Carlo, p5, p50 en p95 zijn uitgesloten.')}</h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Peildatum <b>${STATE.peildatum?new Date(STATE.peildatum).toLocaleDateString('nl-NL'):'onbekend'}</b>. Klik op een wegdeel voor de geraakte signaalgevers, de onderliggende meldingen en de doorrekening.</p>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Wegdeel</th><th>VC en district</th><th class="num">Open MSI</th><th class="num">Signaalgevers</th><th class="num">Areaalbesch.</th><th class="num">Prestatie</th>${DIENSTEN.map(d=>`<th class="num" title="${esc(d.naam)} beschikbaarheid">${d.id.toUpperCase()}</th>`).join('')}<th>Verdieping</th></tr></thead><tbody>
    ${rows.length?rows.map(wd=>{const msiN=(wd.meldingen||[]).filter(m=>m.typeId==='MSI').length;return `<tr class="${wd.besch<(RULES.cfg.kpi_msi||99.5)?'crit':''}"><td class="mono"><button class="linkbtn" onclick="openLiveWegdeelPopup('${encodeURIComponent(wd.key)}')"><b>${esc(wd.key)}</b></button></td><td>${esc(wd.vc||'-')}<br><span class="muted">${esc(wd.district||'-')}</span></td><td class="num">${msiN}</td><td class="num">${wd.N||0}</td><td class="num" style="color:${beschKleur(wd.besch,RULES.cfg.kpi_msi||99.5)};font-weight:700">${fmt(wd.besch,2)}%</td><td class="num">${fmt(wd.prestatie,2)}%</td>${DIENSTEN.map(d=>`<td class="num" style="color:${beschKleur(wd.diensten[d.id].besch,d.norm)};font-weight:700">${fmt(wd.diensten[d.id].besch,2)}%</td>`).join('')}<td><button class="linkbtn" onclick="openLiveWegdeelPopup('${encodeURIComponent(wd.key)}')">Bekijk signaalgevers</button></td></tr>`;}).join(''):`<tr><td colspan="${8+DIENSTEN.length}" class="muted">Geen actuele open MSI-storingen gevonden.</td></tr>`}
    </tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:8px">Deze tabel staat bij Overzicht en Wegdelen. De waarden komen steeds uit dezelfde actuele open-storingenlijst en veranderen pas na het laden of verwijderen van die lijst.</p></div>`;
}

let LIVE_WEG_POPUP={wegKey:null,assetKey:null};
function zorgLiveWegPopup(){
  let el=document.getElementById('liveWegPopup');if(el)return el;
  el=document.createElement('div');el.id='liveWegPopup';el.className='memo-modal';
  el.innerHTML=`<div class="memo-modal-box mc-modal-box"><div class="memo-modal-head"><span id="liveWegPopupTitel">Actuele signaalgevergevolgen</span><button class="memo-x" onclick="sluitLiveWegPopup()">x</button></div><div class="mc-modal-body"><div id="liveWegPopupBody"></div></div></div>`;
  document.body.appendChild(el);return el;
}
function sluitLiveWegPopup(){const el=document.getElementById('liveWegPopup');if(el)el.style.display='none';}
function openLiveWegdeelPopup(key){LIVE_WEG_POPUP={wegKey:decodeURIComponent(key),assetKey:null};const el=zorgLiveWegPopup();el.style.display='flex';tekenLiveWegPopup();}
function openLiveSignaalgeverDetail(key){LIVE_WEG_POPUP.assetKey=decodeURIComponent(key);tekenLiveWegPopup();}
function terugLiveWegPopup(){LIVE_WEG_POPUP.assetKey=null;tekenLiveWegPopup();}
function tekenLiveWegPopup(){
  const wd=(STATE&&STATE.wegdelen||[]).find(w=>w.key===LIVE_WEG_POPUP.wegKey);if(!wd)return;
  const x={wd},assets=mcAssetsVoorType(x,'MSI').filter(r=>r.meldingen.length);
  document.getElementById('liveWegPopupTitel').textContent='Actuele signaalgevergevolgen '+wd.key;
  const body=document.getElementById('liveWegPopupBody');
  if(!LIVE_WEG_POPUP.assetKey){
    body.innerHTML=`<div class="mc-popup-inner"><div class="mc-kpis"><div class="wv-kpi"><div class="l">Open MSI-storingen</div><div class="v">${assets.reduce((s,r)=>s+r.meldingen.length,0)}</div></div><div class="wv-kpi"><div class="l">Geraakte signaalgevers</div><div class="v">${assets.length}</div></div><div class="wv-kpi"><div class="l">Areaalbeschikbaarheid</div><div class="v">${fmt(wd.besch,2)}%</div></div><div class="wv-kpi"><div class="l">Prestatie</div><div class="v">${fmt(wd.prestatie,2)}%</div></div></div><h4>Geraakte signaalgevers</h4><div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Signaalgever</th><th>Locatie</th><th>Status</th><th class="num">Open meldingen</th><th class="num">Verliesuren</th><th>Verdieping</th></tr></thead><tbody>${assets.length?assets.map(r=>{const a=r.asset||{};return `<tr><td><b>${esc(a.naam||a.objectnaam||a.entityid||r.key)}</b><br><span class="muted">${esc(a.entityid||a.id||'')}</span></td><td class="mono">${esc(a.weg||wd.weg)} ${esc(a.richting||wd.richting||'')} ${a.hm!=null?'hm '+fmt(a.hm,3):''} ${esc(a.strook||'')}</td><td>${esc(a.status||a.toestand||'open storing')}</td><td class="num">${r.meldingen.length}</td><td class="num">${fmt(r.verlies,1)}</td><td><button class="linkbtn" onclick="openLiveSignaalgeverDetail('${encodeURIComponent(r.key)}')">Bekijk meldingen</button></td></tr>`;}).join(''):`<tr><td colspan="6" class="muted">De open MSI-storingen zijn niet aan afzonderlijke signaalgevers te koppelen.</td></tr>`}</tbody></table></div><p class="mc-subtle">Alle waarden zijn actueel. Deze verdieping gebruikt geen prognosewaarden en geen historische storingsfrequentie.</p></div>`;
  }else{
    const rec=assets.find(r=>String(r.key)===String(LIVE_WEG_POPUP.assetKey));if(!rec){LIVE_WEG_POPUP.assetKey=null;tekenLiveWegPopup();return;}
    const a=rec.asset||{},meld=rec.meldingen.slice().sort((p,q)=>(q.trace&&q.trace.bijdrageAvail||0)-(p.trace&&p.trace.bijdrageAvail||0));
    body.innerHTML=`<div class="mc-popup-inner"><div class="mc-popup-actions"><button class="mc-back-btn" onclick="terugLiveWegPopup()">Terug naar signaalgevers</button></div><h4>${esc(a.naam||a.objectnaam||a.entityid||rec.key)}</h4><div class="grid4"><div class="kpi"><div class="k-val">${meld.length}</div><div class="k-lab">Open meldingen</div></div><div class="kpi"><div class="k-val">${fmt(rec.verlies,1)}</div><div class="k-lab">Verliesuren besch.</div></div><div class="kpi"><div class="k-val">${esc(a.weg||wd.weg)}</div><div class="k-lab">Rijksweg</div></div><div class="kpi"><div class="k-val">${a.hm!=null?fmt(a.hm,3):'-'}</div><div class="k-lab">Hectometer</div></div></div><div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Code</th><th>Locatie</th><th class="num">Impact besch.</th><th class="num">Impact prest.</th><th class="num">Verliesuren</th><th>Melding</th></tr></thead><tbody>${meld.map(m=>`<tr><td class="mono"><b>${esc(m.code)}</b></td><td class="mono">${esc(m.weg)} ${esc(m.richting||'')} ${m.hm!=null?'hm '+fmt(m.hm,3):''} ${esc(m.strook||'')}</td><td class="num">${fmt(m.avail,1)}%</td><td class="num">${fmt(m.perf,1)}%</td><td class="num">${fmt(m.trace&&m.trace.bijdrageAvail||0,1)}</td><td>${esc(m.melding||'')}</td></tr>`).join('')}</tbody></table></div><p class="mc-subtle">De getoonde impact volgt rechtstreeks uit de live rule engine en de huidige open melding.</p></div>`;
  }
  nummerGrafiekenEnTabellen(body);
}

function renderOverzicht(){
  const s=STATE.stats;
  let h=`<div class="card">
    <h3>Actuele open storingen <span class="badge">${esc(STATE.bestand)}</span></h3>
    <p class="muted" style="font-size:11.5px;margin:-5px 0 10px">Momentopname per <b>${STATE.peildatum?new Date(STATE.peildatum).toLocaleDateString('nl-NL'):'onbekende peildatum'}</b>. Historische storingsbestanden zijn uitgesloten van alle waarden op deze prestatietabs.</p>
    <div class="grid4" style="margin-bottom:6px">
      <div class="kpi"><div class="k-val">${s.totaal}</div><div class="k-lab">Meldingen gelezen</div></div>
      <div class="kpi"><div class="k-val">${s.toegepast}</div><div class="k-lab">Doorgerekend</div></div>
      <div class="kpi"><div class="k-val">${s.wegdelen}</div><div class="k-lab">Wegdelen geraakt</div></div>
      <div class="kpi"><div class="k-val">${s.actueel?'24 u':s.periodeJr}</div><div class="k-lab">${s.actueel?'Puntbeeld-rekenvenster':'Rapportageperiode (jr)'}</div></div>
    </div>
    <div class="stat-line">
      <span class="chip">MSI: <b>${s.msi}</b></span>
      <span class="chip">Camera: <b>${s.cam}</b></span>
      <span class="chip">Meetlus: <b>${s.lus}</b></span>
      <span class="chip">Wisselbord: <b>${s.wisselbord}</b></span>
      <span class="chip">Combiregel-treffers: <b>${s.combiHits}</b></span>
      <span class="chip">Dubbel weggefilterd: <b>${s.dubbel}</b></span>
      <span class="chip" title="Wegdelen met areaal uit het RWS asset-register">Areaal uit register: <b>${s.areaalDirect+s.areaalWeg}</b>/${s.wegdelen}${s.areaalSchat?` (${s.areaalSchat} geschat)`:''}</span>
      <span class="chip" title="Totaal getelde signaalgevers over alle geraakte wegdelen">Signaalgevers totaal: <b>${s.totaalSig.toLocaleString('nl-NL')}</b></span>
    </div>
  </div>`;

  const contextT=STATE.peildatum||Date.now();
  h+=vwmLandelijkDienstHtml();
  h+=vwmVcUitvoeringHtml();
  h+=liveSignaalgeverGevolgenHtml('overzicht');

  h+=`<div class="card"><h3 style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span>Netwerkbrede dienstprestatie ${tip('Areaalgewogen gemiddelde over alle geraakte wegdelen, naar het aantal geregistreerde signaalgevers. <b>Beschikbaarheid</b> = kans dat de dienst geleverd kan worden; <b>prestatie</b> = kwaliteit/effectiviteit bij storing. Verkeersintensiteiten ontbreken in de brondata en worden daarom niet gesuggereerd.')}</span><button class="memo-knop" onclick="opentMemo('overzicht')">📄 Memo genereren</button></h3>
    <p class="muted" style="margin:-6px 0 14px;font-size:12px">Areaalgewogen gemiddelde over alle geraakte wegdelen. Beschikbaarheid = kans dat de dienst kan worden geleverd; prestatie = kwaliteit/effectiviteit bij storing.</p>
    <div class="grid4">`;
  DIENSTEN.forEach(d=>{
    const n=STATE.netwerk[d.id];
    const st=n.status;
    h+=`<div class="dienst-tile klik" style="--accent:${d.kleur}" onclick="toonDienstDetail('${d.id}')" title="Klik voor subproces-duiding">
      <div class="dt-naam" style="color:${d.kleur}">${d.naam}</div>
      <div class="dt-doel">Doel: ${d.doel} · norm ${fmt(d.norm,1)}%</div>
      <div class="dt-row">
        <div class="dt-metric">
          <div class="dt-label">Beschikbaarheid</div>
          <div class="dt-groot" style="color:${beschKleur(n.besch,d.norm)}">${fmt(n.besch)}<small>%</small></div>
        </div>
        <div class="dt-metric">
          <div class="dt-label">Prestatie</div>
          <div class="dt-groot" style="color:${beschKleur(n.prestatie,d.norm)}">${fmt(n.prestatie)}<small>%</small></div>
        </div>
      </div>
      <div class="dt-norm">
        <span class="pill ${st.k}">${st.t}</span>
        &nbsp;${n.onderNorm} van ${STATE.stats.wegdelen} wegdelen onder norm
      </div>
      <div class="dt-klik">▾ subprocessen bekijken</div>
    </div>`;
  });
  h+=`</div><div id="dienstDetailHost"></div></div>`;

  // ── GRAFIEK 1 + tabel: beschikbaarheid vs norm ──
  const normItems=DIENSTEN.map(d=>({label:d.naam.replace(/&amp;/g,'&'),val:STATE.netwerk[d.id].besch,norm:d.norm,kleur:d.kleur}));
  h+=`<div class="card"><h3>Beschikbaarheid t.o.v. norm ${tip('Elke staaf is de netwerkbrede beschikbaarheid van een dienst; de gestreepte lijn is de norm. Zo zie je in één oogopslag welke dienst hoeveel marge of tekort heeft.')}</h3>
    <div class="grid2-chart">
      <div class="chart-wrap">${chartDienstNorm(normItems)}</div>
      <div>
        <table class="mini-tbl"><thead><tr><th>Dienst</th><th class="num">Besch.</th><th class="num">Prest.</th><th class="num">Norm</th><th class="num">Marge</th></tr></thead><tbody>`;
  DIENSTEN.forEach(d=>{
    const n=STATE.netwerk[d.id];
    const marge=n.besch-d.norm;
    h+=`<tr>
      <td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${d.kleur};margin-right:6px"></span>${d.naam.replace(/&amp;/g,'&')}</td>
      <td class="num" style="color:${beschKleur(n.besch,d.norm)};font-weight:700">${fmt(n.besch,2)}</td>
      <td class="num">${fmt(n.prestatie,2)}</td>
      <td class="num muted">${fmt(d.norm,1)}</td>
      <td class="num ${marge>=0?'delta-pos':'delta-neg'}">${marge>=0?'+':''}${fmt(marge,2)}</td>
    </tr>`;
  });
  h+=`</tbody></table>
        <p class="muted" style="font-size:11px;margin-top:8px">Marge = beschikbaarheid − norm. Positief (groen) = boven norm, negatief (rood) = tekort in procentpunten.</p>
      </div>
    </div>
  </div>`;

  // ── GRAFIEK 2: statusverdeling wegdelen per dienst ──
  const statusRows=DIENSTEN.map(d=>{
    const b={groen:0,geel:0,oranje:0,rood:0};
    STATE.wegdelen.forEach(w=>{b[w.diensten[d.id].status.k]++;});
    return {label:d.naam.replace(/&amp;/g,'&'),...b,totaal:STATE.wegdelen.length};
  });
  h+=`<div class="card"><h3>Verdeling wegdelen over statusklassen ${tip('Per dienst: hoeveel van de geraakte wegdelen op norm zitten (groen), krap eronder (geel), onder norm (oranje) of kritiek (rood). Een lange gele/rode staart wijst op structurele knelpunten, ook als het gemiddelde nog goed oogt.')}</h3>
    <div class="chart-wrap">${chartStatusStack(statusRows)}</div>
    <div class="chart-legend">
      <span><i style="background:var(--groen)"></i>op norm</span>
      <span><i style="background:var(--rws-geel)"></i>krap (&lt;1pp onder norm)</span>
      <span><i style="background:var(--oranje)"></i>onder norm</span>
      <span><i style="background:var(--rood)"></i>kritiek (&gt;3pp)</span>
      <span class="muted">totaal ${STATE.wegdelen.length} wegdelen</span>
    </div>
  </div>`;

  // ── GRAFIEK 3: per VC de dienstbeschikbaarheid ──
  const vcOrder=[...new Set(STATE.wegdelen.map(w=>w.vc))];
  const vcRows=vcOrder.map(vc=>{
    const dd={}; let n=0;
    DIENSTEN.forEach(d=>{
      let s=0,w=0;
      STATE.wegdelen.filter(x=>x.vc===vc).forEach(x=>{const ww=x.N||1;s+=x.diensten[d.id].besch*ww;w+=ww;});
      dd[d.id]=w?s/w:100;
    });
    STATE.wegdelen.filter(x=>x.vc===vc).forEach(x=>n+=x.n);
    return {vc,d:dd,n};
  }).sort((a,b)=>b.n-a.n);
  h+=`<div class="card"><h3>Dienstbeschikbaarheid per verkeerscentrale ${tip('De vier diensten per VC, areaalgewogen naar geregistreerde signaalgevers. Legt regionale verschillen bloot zonder wegdelen met veel storingen dubbel gewicht te geven. Onder elke groep blijft het aantal storingen als context zichtbaar.')}</h3>
    <div class="chart-wrap">${chartVcGroepen(vcRows)}</div>
    <div class="chart-legend">${DIENSTEN.map(d=>`<span><i style="background:${d.kleur}"></i>${d.naam.replace(/&amp;/g,'&')}</span>`).join('')}</div>
    <div class="tbl-scroll" style="margin-top:14px;max-height:none"><table class="mini-tbl"><thead><tr><th>VC</th><th class="num">Storingen</th>${DIENSTEN.map(d=>`<th class="num" title="${esc(d.naam)}">${d.id.toUpperCase()}</th>`).join('')}<th class="num">Zwakste</th></tr></thead><tbody>`;
  vcRows.forEach(r=>{
    const min=Math.min(...DIENSTEN.map(d=>r.d[d.id]));
    const zwak=DIENSTEN.find(d=>r.d[d.id]===min);
    h+=`<tr><td class="mono"><b>${esc(r.vc)}</b></td><td class="num">${r.n}</td>`;
    DIENSTEN.forEach(d=>h+=`<td class="num" style="color:${beschKleur(r.d[d.id],d.norm)};font-weight:${r.d[d.id]===min?'700':'400'}">${fmt(r.d[d.id],2)}</td>`);
    h+=`<td class="num"><span class="tag" style="background:${zwak.kleur}22;color:${zwak.kleur};font-weight:700">${zwak.id.toUpperCase()}</span></td></tr>`;
  });
  h+=`</tbody></table></div></div>`;

  // ── GRAFIEK 4: Pareto foutcodes ──
  const perCode={};
  STATE.meldingen.forEach(m=>{ perCode[m.code]=perCode[m.code]||{uren:0,n:0,oms:m.fout.oms,pat:m.fout.patroon}; perCode[m.code].uren+=m.trace.bijdrageAvail; perCode[m.code].n++; });
  const paretoItems=Object.entries(perCode).map(([code,v])=>({code,uren:v.uren,n:v.n,label:v.pat})).sort((a,b)=>b.uren-a.uren);
  const totVerlies=paretoItems.reduce((a,b)=>a+b.uren,0)||1;
  h+=`<div class="card"><h3>Oorzaakbijdrage — welke foutcodes drijven het verlies ${tip('Pareto-analyse: de foutcodes gesorteerd naar hun aandeel in het totale beschikbaarheidsverlies (verlies-uren). De gele lijn is het cumulatieve percentage. Meestal veroorzaakt een handvol codes het leeuwendeel — dáár zit de meeste winst bij herstel.')}</h3>
    <div class="grid2-chart">
      <div class="chart-wrap">${chartPareto(paretoItems)}</div>
      <div>
        <table class="mini-tbl"><thead><tr><th>Code</th><th>Oorzaak</th><th class="num">Storingen</th><th class="num">Aandeel</th></tr></thead><tbody>`;
  let cum=0;
  paretoItems.forEach(it=>{
    cum+=it.uren;
    h+=`<tr><td class="mono"><b>${it.code}</b></td><td style="font-size:11.5px">${esc(it.label)}</td><td class="num">${it.n}</td><td class="num" style="font-weight:700">${Math.round(it.uren/totVerlies*100)}%</td></tr>`;
  });
  h+=`</tbody></table>
        <p class="muted" style="font-size:11px;margin-top:8px">Aandeel = deel van alle verlies-uren (beschikbaarheid) dat deze foutcode veroorzaakt over het hele netwerk.</p>
      </div>
    </div>
  </div>`;

  // meest getroffen wegdelen per dienst (top 8 op IM als leidend, of laagste besch)
  h+=`<div class="card"><h3>Kritieke wegdelen (laagste dienst­beschikbaarheid)</h3>
    <div class="tbl-scroll"><table class="tbl"><thead><tr>
      <th>Wegdeel</th><th>VC</th><th class="num">Storingen</th>`;
  DIENSTEN.forEach(d=>h+=`<th class="num" title="${esc(d.naam)}">${d.id.toUpperCase()}</th>`);
  h+=`</tr></thead><tbody>`;
  const top=[...STATE.wegdelen].sort((a,b)=>{
    const la=Math.min(...DIENSTEN.map(d=>a.diensten[d.id].besch));
    const lb=Math.min(...DIENSTEN.map(d=>b.diensten[d.id].besch));
    return la-lb;
  }).slice(0,15);
  top.forEach(wd=>{
    const minB=Math.min(...DIENSTEN.map(d=>wd.diensten[d.id].besch));
    h+=`<tr class="${minB<96?'crit':''}"><td class="mono"><b>${esc(wd.key)}</b></td><td>${esc(wd.vc)}</td><td class="num">${wd.n}</td>`;
    DIENSTEN.forEach(d=>{
      const dd=wd.diensten[d.id];
      h+=`<td class="num" style="color:${beschKleur(dd.besch,d.norm)};font-weight:700">${fmt(dd.besch,1)}</td>`;
    });
    h+=`</tr>`;
  });
  h+=`</tbody></table></div>
    <div class="legend"><span><i class="dot" style="background:var(--groen)"></i>op norm</span>
    <span><i class="dot" style="background:var(--rws-geel)"></i>krap</span>
    <span><i class="dot" style="background:var(--oranje)"></i>onder norm</span>
    <span><i class="dot" style="background:var(--rood)"></i>kritiek</span></div>
  </div>`;

  h+=operationeleContextHtml(maakOperationeleContext(contextT,contextT+86400e3,STATE.meldingen),'Impact op werkzaamheden en U-routes');

  h=h.replaceAll('VWM landelijk, prestatie per dienstverlening en subproces','Dienstprestatie binnen geraakte wegdelen en subprocessen').replaceAll('Netwerkbrede dienstprestatie','Dienstprestatie binnen geraakte wegdelen').replaceAll('netwerkbrede beschikbaarheid','beschikbaarheid binnen geraakte wegdelen');
  document.getElementById('tab-overzicht').innerHTML=v68LandelijkHtml()+kostenDagOverzicht()+h;
}

/* Bereken de subprocesbeschikbaarheid voor een gegeven bron-tabel (per wegdeel of netwerk). */
function subprocesWaarde(afh, bron){
  let vb=0,vp=0,tot=0;
  Object.entries(afh).forEach(([obj,w])=>{
    const bt=OBJ_BRON[obj];
    let b=100,p=100;
    if(bt && bron[bt]){ b=bron[bt].besch; p=bron[bt].perf; }
    vb+=w*b; vp+=w*p; tot+=w;
  });
  return { besch: tot?vb/tot:100, prestatie: tot?vp/tot:100 };
}

let DIENST_SEL=null;
function toonDienstDetail(id){
  // toggle: nog een keer klikken sluit het paneel
  if(DIENST_SEL===id){ DIENST_SEL=null; document.getElementById('dienstDetailHost').innerHTML=''; return; }
  DIENST_SEL=id;
  const d=DIENSTEN.find(x=>x.id===id);
  const subs=SUBPROCESSEN[id]||[];

  // netwerkbrede bron-tabel: areaalgewogen gemiddelde van de wegdeel-bronnen
  const bronNet={MSI:{besch:0,perf:0},CAM:{besch:0,perf:0},LUS:{besch:0,perf:0},DRIP:{besch:0,perf:0},WISSELBORD:{besch:0,perf:0}};
  let wsom=0;
  STATE.wegdelen.forEach(wd=>{
    const ww=wd.N||1; wsom+=ww;
    ['MSI','CAM','LUS','DRIP','WISSELBORD'].forEach(tp=>{ bronNet[tp].besch+=(wd.bron[tp]?.besch??100)*ww; bronNet[tp].perf+=(wd.bron[tp]?.perf??100)*ww; });
  });
  ['MSI','CAM','LUS','DRIP','WISSELBORD'].forEach(tp=>{ if(wsom){ bronNet[tp].besch/=wsom; bronNet[tp].perf/=wsom; } });

  // per subproces netwerkwaarde
  const subRes=subs.map(sp=>{
    const r=subprocesWaarde(sp.afh, bronNet);
    // meest kritieke wegdeel voor dit subproces
    let ergst=null, ergstV=101;
    STATE.wegdelen.forEach(wd=>{
      const v=subprocesWaarde(sp.afh, wd.bron).besch;
      if(v<ergstV){ ergstV=v; ergst=wd.key; }
    });
    return {...sp, besch:r.besch, prestatie:r.prestatie, ergst, ergstV};
  }).sort((a,b)=>a.besch-b.besch);

  const norm=d.norm;
  let html=`<div class="dienst-detail" style="--accent:${d.kleur}">
    <div class="dd-head">
      <div><span class="dd-titel" style="color:${d.kleur}">${d.naam} — subprocessen</span>
      <span class="muted" style="font-size:12px;margin-left:8px">${esc(d.doel)} · norm ${fmt(norm,1)}%</span></div>
      <button class="dd-close" onclick="toonDienstDetail('${id}')">✕ sluiten</button>
    </div>
    <p class="muted" style="font-size:12px;margin:2px 0 14px">${esc(d.tekst)} Hieronder wat een storing van de onderliggende objecttypen betekent voor elk deelproces van deze dienst — gesorteerd op grootste gevolg.</p>`;

  // grafiek: subprocesbeschikbaarheid als horizontale staven met normlijn
  const chartItems=subRes.map(sp=>({label:sp.naam,val:sp.besch,norm:norm,kleur:d.kleur}));
  html+=`<div class="grid2-chart">
    <div class="chart-wrap">${chartDienstNorm(chartItems)}</div>
    <div>`;
  subRes.forEach(sp=>{
    const st=statusVan(sp.besch,norm);
    const objTags=Object.entries(sp.afh).sort((a,b)=>b[1]-a[1]).map(([o,w])=>`<span class="obj-chip">${esc(o.replace(/_/g,' '))} ${Math.round(w*100)}%</span>`).join('');
    html+=`<div class="sp-blok">
      <div class="sp-kop">
        <span class="sp-naam">${esc(sp.naam)}</span>
        <span class="pill ${st.k}">${fmt(sp.besch,2)}%</span>
      </div>
      <div class="sp-objs">${objTags}</div>
      <div class="sp-tekst">${esc(sp.tekst)}</div>
      <div class="sp-meta">Prestatie ${fmt(sp.prestatie,2)}% · zwakste wegdeel: <span class="mono">${esc(sp.ergst||'–')}</span> (${fmt(sp.ergstV,1)}%)</div>
    </div>`;
  });
  html+=`</div></div>`;

  // samenvattende duiding
  const zwakst=subRes[0], sterkst=subRes[subRes.length-1];
  html+=`<div class="dd-duiding">
    <b>Duiding.</b> Binnen ${d.naam.replace(/&amp;/g,'&')} wordt <b>${esc(zwakst.naam)}</b> het sterkst geraakt (${fmt(zwakst.besch,2)}%), doordat dit deelproces zwaar leunt op ${zwaarsteObj(zwakst.afh)}. Het minst gevoelig is <b>${esc(sterkst.naam)}</b> (${fmt(sterkst.besch,2)}%). ${zwakst.besch<norm?`Het zwakste deelproces zit onder de dienstnorm van ${fmt(norm,1)}% — dáár ligt de operationele prioriteit.`:`Alle deelprocessen blijven boven de dienstnorm van ${fmt(norm,1)}%.`}
  </div></div>`;

  document.getElementById('dienstDetailHost').innerHTML=html;
  document.getElementById('dienstDetailHost').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function zwaarsteObj(afh){
  const top=Object.entries(afh).sort((a,b)=>b[1]-a[1])[0];
  const naam={signalering:'de matrixsignalering (MSI)',camera:'het camerabeeld',detectie:'de detectielussen',drip:'de DRIP-informatie',communicatie:'de communicatiesystemen',dynamische_strook:'de dynamische stroken'}[top[0]]||top[0];
  return `${naam} (${Math.round(top[1]*100)}%)`;
}

function renderWegdelen(){
  const vcs=[...new Set(STATE.wegdelen.map(w=>w.vc).filter(Boolean))].sort();
  let h=`<div class="card"><h3>Beschikbaarheid &amp; prestatie per wegdeel</h3>
    <div class="filterbar">
      <label>Verkeerscentrale</label>
      <select id="fVc" onchange="tekenWegtabel()"><option value="">Alle</option>${vcs.map(v=>`<option>${esc(v)}</option>`).join('')}</select>
      <label>Zoek weg</label>
      <input id="fWeg" placeholder="bv. A2" oninput="tekenWegtabel()" style="width:120px">
      <label>Sorteer</label>
      <select id="fSort" onchange="tekenWegtabel()">
        <option value="besch">Laagste areaalbeschikbaarheid</option>
        <option value="n">Meeste storingen</option>
        <option value="im">Laagste IM-beschikbaarheid</option>
      </select>
    </div>
    <div id="wegtabelHost"></div>
  </div>${liveSignaalgeverGevolgenHtml('wegdelen')}`;
  document.getElementById('tab-wegdelen').innerHTML=h;
  tekenWegtabel();
}
function tekenWegtabel(){
  const fVc=document.getElementById('fVc').value;
  const fWeg=document.getElementById('fWeg').value.trim().toUpperCase();
  const sort=document.getElementById('fSort').value;
  let rows=STATE.wegdelen.filter(w=>(!fVc||w.vc===fVc)&&(!fWeg||w.key.includes(fWeg)));
  if(sort==='n') rows=[...rows].sort((a,b)=>b.n-a.n);
  else if(sort==='im') rows=[...rows].sort((a,b)=>a.diensten.im.besch-b.diensten.im.besch);
  else rows=[...rows].sort((a,b)=>a.besch-b.besch);

  let h=`<div class="tbl-scroll"><table class="tbl"><thead><tr>
    <th>Wegdeel</th><th>VC / District</th><th class="num">Stor.</th><th class="num">Sig.geverS</th><th>Vertragingskosten</th>
    <th class="num">Areaal­besch.</th><th class="num">Prestatie</th>`;
  DIENSTEN.forEach(d=>h+=`<th class="num" title="${esc(d.naam)} beschikbaarheid">${d.id.toUpperCase()}</th>`);
  h+=`</tr></thead><tbody>`;
  rows.forEach(wd=>{
    const crit=Math.min(...DIENSTEN.map(d=>wd.diensten[d.id].besch))<96;
    h+=`<tr class="${crit?'crit':''}">
      <td class="mono"><b>${esc(wd.key)}</b></td>
      <td>${esc(wd.vc)} <span class="muted">/ ${esc(wd.district)}</span></td>
      <td class="num">${wd.n}</td>
      <td class="num muted">${wd.N}</td><td>${kostenWegCel(wd)}</td>
      <td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
        <span style="color:${beschKleur(wd.besch,99.5)};font-weight:700">${fmt(wd.besch)}</span>
        <div class="bar" style="width:52px"><span style="width:${Math.max(2,wd.besch)}%;background:${beschKleur(wd.besch,99.5)}"></span></div></div></td>
      <td class="num" style="color:${beschKleur(wd.prestatie,99.5)}">${fmt(wd.prestatie)}</td>`;
    DIENSTEN.forEach(d=>{
      const dd=wd.diensten[d.id];
      h+=`<td class="num" style="color:${beschKleur(dd.besch,d.norm)};font-weight:700" title="prestatie ${fmt(dd.prestatie,1)}%">${fmt(dd.besch,1)}</td>`;
    });
    h+=`</tr>`;
  });
  h+=`</tbody></table></div>
  <p class="muted" style="font-size:11.5px;margin-top:8px">Sig.geverS = werkelijk aantal signaalgevers in het wegdeel uit het RWS asset-register (bij op-/afritten de gecombineerde wegtelling; alleen waar het register geen match geeft een schatting). Areaalbeschikbaarheid = 100 − Σ(impact × standtijd) / (aantal signaalgevers × periode). IM/VM/RRI/WIU = beschikbaarheid van de betreffende dienst; hover voor prestatie.</p>`;
  document.getElementById('wegtabelHost').innerHTML=kostenWegTotaalHtml(rows)+h;
}

function renderStoringen(){
  let h=`<div class="card"><h3>Doorgerekende open storingen <span class="badge">${STATE.meldingen.length} regels</span></h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Elke storing na de zes-staps doorrekening: koppeling aan All Assets, assettype, foutcode, basisimpact × gewicht × locatie- en assetfactor, met combiregel-opslag.</p>
    <div class="tbl-scroll"><table class="tbl"><thead><tr>
      <th>Wegdeel</th><th>HM</th><th>Strook</th><th>Assetmatch</th><th>Type</th><th>Foutcode</th><th>Melding</th>
      <th>Context</th><th class="num">Impact besch.</th><th class="num">Impact prest.</th><th>Combi</th>
    </tr></thead><tbody>`;
  const sorted=[...STATE.meldingen].sort((a,b)=>b.avail-a.avail);
  sorted.slice(0,600).forEach(m=>{
    const sev=m.fout.severity;
    const tg=sev==='kritiek'?'r':sev==='hoog'?'o':sev==='middel'?'b':'g';
    h+=`<tr>
      <td class="mono"><b>${esc(m.weg)}</b> ${esc(m.richting)}</td>
      <td class="num mono">${m.hm!=null?fmt(m.hm,3):'–'}</td>
      <td class="num">${esc(m.strook||'–')}</td>
      <td style="max-width:190px">${m.assetKey?`<span title="${esc(m.assetMatchMethode)}">${esc(m.assetNaam)}</span>`:`<button class="asset-match-link" onclick="openAssetConfigForLog('${encodeURIComponent(m.assetLogId||m.osid||'')}')">Niet gekoppeld · configureren</button>`}</td>
      <td><span class="tag gy">${m.typeId}</span></td>
      <td><span class="tag ${tg}">${m.code}</span> <span class="muted">${esc(sev)}</span></td>
      <td style="max-width:230px">${esc((m.melding||'').slice(0,60))}</td>
      <td class="muted" style="font-size:11px">${esc(m.locCtx)}</td>
      <td class="num" style="font-weight:700;color:${m.avail>=50?'var(--rood)':m.avail>=15?'var(--oranje)':'var(--sub)'}">${fmt(m.avail,0)}%</td>
      <td class="num" style="font-weight:700;color:${m.perf>=50?'var(--rood)':m.perf>=15?'var(--oranje)':'var(--sub)'}">${fmt(m.perf,0)}%</td>
      <td>${(Array.isArray(m.combi)?m.combi:[]).filter(c=>c!=null&&c!=='').map(c=>`<span class="tag b" style="font-size:9px">${String(c).replace('COMBO_','C')}</span>`).join(' ')}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>`;
  if(sorted.length>600) h+=`<p class="muted" style="font-size:11.5px;margin-top:8px">Eerste 600 van ${sorted.length} regels getoond (gesorteerd op impact). Volledige set in de CSV-export.</p>`;
  h+=`</div>`;
  document.getElementById('tab-storingen').innerHTML=h;
}

/* ══════════════════════════════════════════════════════════════
   REKENVERSLAG — per melding stap voor stap hoe de impact ontstaat
   ══════════════════════════════════════════════════════════════ */
function renderBerekening(){
  const wegen=[...new Set(STATE.meldingen.map(m=>m.weg))].sort();
  let h=`<div class="card"><h3>Rekenverslag per melding ${tip('Toont voor <b>elke afzonderlijke storing</b> hoe de impact stap voor stap is berekend: van classificatie van het assettype, via foutcode en locatiefactor, tot de bijdrage aan de wegdeelbeschikbaarheid. Bedoeld om te kunnen controleren en navertellen wat er precies gebeurt.<span class="frm">impact = basis × gewicht × locatiefactor</span>')}<span class="badge">${STATE.meldingen.length} meldingen</span></h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Klap een melding open om te zien hoe elke stap de beschikbaarheids- en prestatie-impact opbouwt: van classificatie tot de bijdrage aan de wegdeel­beschikbaarheid. Alle getallen komen 1-op-1 uit de rule engine.</p>
    <div class="foot-note" style="margin-top:0;margin-bottom:14px">
      <b>Leeswijzer.</b> Per melding: <b>impact_beschikbaarheid</b> = basisimpact(foutcode) × gewicht(assettype) × factor(locatie) × individuele assetfactor, afgetopt op 100%.
      Combiregels tellen daar bij op bij samenloop. In stap 6 wordt de impact × standtijd een aandeel van
      (aantal signaalgevers × periode); dat aandeel verlaagt de areaal­beschikbaarheid van het wegdeel.
    </div>
    <div class="filterbar">
      <label>Weg</label>
      <select id="cWeg" onchange="tekenCalc()"><option value="">Alle</option>${wegen.map(w=>`<option>${esc(w)}</option>`).join('')}</select>
      <label>Alleen</label>
      <select id="cFilter" onchange="tekenCalc()">
        <option value="all">alle meldingen</option>
        <option value="combi">met combiregel-opslag</option>
        <option value="capped">met afgetopte duur</option>
        <option value="kritiek">kritieke foutcode (1003)</option>
      </select>
      <label>Toon</label>
      <select id="cLimit" onchange="tekenCalc()">
        <option value="40">eerste 40</option>
        <option value="120">eerste 120</option>
        <option value="9999">alle</option>
      </select>
    </div>
    <div id="calcHost"></div>
  </div>`;
  document.getElementById('tab-berekening').innerHTML=h;
  tekenCalc();
}

function tekenCalc(){
  const fw=document.getElementById('cWeg').value;
  const ff=document.getElementById('cFilter').value;
  const lim=+document.getElementById('cLimit').value;
  let ms=STATE.meldingen.filter(m=>!fw||m.weg===fw);
  if(ff==='combi') ms=ms.filter(m=>m.trace.combi.length);
  else if(ff==='capped') ms=ms.filter(m=>m.trace.duurGecapt);
  else if(ff==='kritiek') ms=ms.filter(m=>m.code==='1003');
  ms=[...ms].sort((a,b)=>b.avail-a.avail);
  const totaal=ms.length;
  ms=ms.slice(0,lim);

  let h='';
  if(!ms.length){ h=`<div class="empty"><div class="ic">🔍</div>Geen meldingen die aan dit filter voldoen.</div>`; document.getElementById('calcHost').innerHTML=h; return; }

  ms.forEach(m=>{ h+=calcKaart(m); });
  if(totaal>ms.length) h+=`<p class="muted" style="font-size:11.5px;margin-top:6px">${ms.length} van ${totaal} getoond. Kies “alle” of verfijn het filter voor meer.</p>`;
  document.getElementById('calcHost').innerHTML=h;
}

function calcKaart(m){
  const t=m.trace;
  const wd=STATE.wegdelen.find(w=>w.key===t.wegdeel);
  const f=m.fout;
  const sev=f.severity;
  const tg=sev==='kritiek'?'r':sev==='hoog'?'o':sev==='middel'?'b':'g';

  let steps='';
  // STAP 1 — classificatie
  steps+=`<li>
    <div class="st-titel">Classificatie — welk assettype?</div>
    <div class="st-uitleg">De melding wordt herkend als een <b>${m.typeId}</b> (${esc(m.at.functie)}) op basis van de tekst “${esc((m.osid+' '+m.melding).slice(0,70))}”.</div>
    <span class="kv">assettype = <b>${m.typeId}</b></span>
    <span class="kv">assetmatch = <b>${m.assetKey?esc(m.assetNaam):'niet gekoppeld'}</b></span>
    ${m.assetKey?`<span class="kv">matchmethode = <b>${esc(m.assetMatchMethode)}</b></span>`:''}
    <span class="kv">weeg_besch = <b>${m.at.wAvail}</b></span>
    <span class="kv">weeg_prest = <b>${m.at.wPerf}</b></span>
  </li>`;

  // STAP 2 — foutcode
  steps+=`<li>
    <div class="st-titel">Foutcode — hoe erg is de storing?</div>
    <div class="st-uitleg">Patroon “${esc(f.patroon)}” → foutcode <b>${f.code}</b> (${esc(sev)}). ${esc(f.oms)}.</div>
    <span class="kv">basis_besch = <b>${f.availPct}%</b></span>
    <span class="kv">basis_prest = <b>${f.perfPct}%</b></span>
  </li>`;

  // STAP 3 — locatiecontext
  const heeftLoc = t.fA!==1 || t.fP!==1 || m.locErnst!=null;
  steps+=`<li>
    <div class="st-titel">MSI-ernst en locatiecontext — weegt de plek mee?</div>
    <div class="st-uitleg">${heeftLoc
      ? `Context <b>${esc(m.locCtx)}</b>${m.locErnst!=null?` heeft ernstrang <b>${m.locErnst}</b>, waarbij 1 het zwaarst is en 4 het lichtst`:''}. Herkenningsbron: ${esc(m.locBron||'locatieveld')}.`
      : `Geen bijzondere context herkend voor deze melding — factor blijft 1,0.`}</div>
    ${m.locErnst!=null?`<span class="kv">MSI-ernst = <b>${m.locErnst}</b></span>`:''}
    <span class="kv">factor_besch = <b>${fmt(t.fA,2)}</b></span>
    <span class="kv">factor_prest = <b>${fmt(t.fP,2)}</b></span>
  </li>`;

  // STAP 4 — basisimpact
  const capA = t.availRuw>100, capP = t.perfRuw>100;
  const assetFactorTekst=(t.assetImpactFactor!==1||t.assetFa!==1||t.assetFp!==1)?' De individuele assetconfiguratie is als extra factor toegepast.':'';
  steps+=`<li>
    <div class="st-titel">Basisimpact — vermenigvuldig alles</div>
    <div class="st-uitleg">impact = basisimpact × typegewicht × locatiefactor × assetzwaarte × assetspecifieke factor, afgetopt op 100%.${assetFactorTekst}</div>
    <div class="formule">besch: <span class="hl">${f.availPct}</span> × <span class="hl">${m.at.wAvail}</span> × <span class="hl">${fmt(t.fA,2)}</span> × <span class="hl">${fmt(t.assetImpactFactor,2)}</span> × <span class="hl">${fmt(t.assetFa,2)}</span> = ${fmt(t.availRuw,1)}${capA?` → cap 100`:''} = <span class="res">${fmt(t.availBasis,1)}%</span></div>
    <div class="formule" style="margin-top:5px">prest: <span class="hl">${f.perfPct}</span> × <span class="hl">${m.at.wPerf}</span> × <span class="hl">${fmt(t.fP,2)}</span> × <span class="hl">${fmt(t.assetImpactFactor,2)}</span> × <span class="hl">${fmt(t.assetFp,2)}</span> = ${fmt(t.perfRuw,1)}${capP?` → cap 100`:''} = <span class="res">${fmt(t.perfBasis,1)}%</span></div>
  </li>`;

  // STAP 5 — combiregels
  if(t.combi.length){
    let ch='';
    t.combi.forEach(c=>{
      ch+=`<div style="margin-bottom:6px">
        <div class="st-uitleg" style="margin-bottom:3px"><b>${c.id}</b> — ${esc(c.oms)}; samenloop met <span class="mono">${esc(c.partner)}</span> (code ${c.partnerCode}).</div>
        <div class="formule">besch: ${fmt(c.vaVoor,1)} + <span class="hl">${c.extraAvail}</span> = <span class="res">${fmt(c.vaNa,1)}%</span> &nbsp;·&nbsp; prest: ${fmt(c.vpVoor,1)} + <span class="hl">${c.extraPerf}</span> = <span class="res">${fmt(c.vpNa,1)}%</span></div>
      </div>`;
    });
    steps+=`<li>
      <div class="st-titel">Combiregel-opslag — samenloop op hetzelfde wegvak</div>
      <div class="st-uitleg">Deze melding valt samen met andere storingen dichtbij; dat verhoogt de impact.</div>
      ${ch}
    </li>`;
  } else {
    steps+=`<li>
      <div class="st-titel">Combiregels — samenloop?</div>
      <div class="st-uitleg">Geen combiregel van toepassing (geen passende partnerstoring binnen afstand/tijdvenster). Impact blijft gelijk aan stap 4.</div>
    </li>`;
  }

  // STAP 6 — bijdrage aan wegdeel
  const N = wd?wd.N:'?';
  const pu = wd?wd.periodeUren:STATE.stats.periodeUren;
  const totaalUren = wd?Math.round(N*pu):'?';
  steps+=`<li>
    <div class="st-titel">Bijdrage aan het wegdeel — beschikbaarheid én prestatie</div>
    <div class="st-uitleg">De impact geldt gedurende de standtijd. Die verlies-uren worden een aandeel van de totale beschikbare uren van alle signaalgevers in het wegdeel. Beschikbaarheid en prestatie worden apart doorgerekend.${t.model==='stapel'?' <b>Opstapel-model:</b> de zwaarte kan boven 100% uitkomen, waardoor gewicht en locatiefactor extra verlies-uren opleveren.':''}</div>
    ${t.duurGecapt?`<div class="calc-warn">Standtijd ${Math.round(t.duurRaw).toLocaleString('nl-NL')} u is langer dan de rapportageperiode (${pu.toLocaleString('nl-NL')} u) en wordt daarop afgetopt.</div>`:''}
    <div class="formule" style="margin-top:6px">standtijd = ${Math.round(t.duurGeclampt).toLocaleString('nl-NL')} u${m.typeId!=='MSI'?` × 0,5 (niet-MSI)`:''}</div>
    <div class="formule" style="margin-top:5px">verlies-uren <b>besch</b> = <span class="hl">zwaarte ${fmt((t.zwaarteA!=null?t.zwaarteA:m.avail/100)*100,0)}%</span> × ${Math.round(t.duurGeclampt).toLocaleString('nl-NL')}${t.factor!==1?` × ${t.factor}`:''} = <span class="res">${fmt(t.bijdrageAvail,0)} u</span></div>
    <div class="formule" style="margin-top:5px">verlies-uren <b>prest</b> = <span class="hl">zwaarte ${fmt((t.zwaarteP!=null?t.zwaarteP:m.perf/100)*100,0)}%</span> × ${Math.round(t.duurGeclampt).toLocaleString('nl-NL')}${t.factor!==1?` × ${t.factor}`:''} = <span class="res">${fmt(t.bijdragePerf,0)} u</span></div>
    <div class="st-uitleg" style="margin-top:6px">Wegdeel <span class="mono">${esc(t.wegdeel)}</span>: ${N} signaalgevers × ${pu.toLocaleString('nl-NL')} u = ${totaalUren.toLocaleString?totaalUren.toLocaleString('nl-NL'):totaalUren} beschikbare uren. Samen met de andere ${wd?wd.n-1:'?'} meldingen op dit wegdeel:</div>
    <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">
      <div class="formule" style="flex:1;min-width:220px">areaal­<b>beschikbaarheid</b> = 100 − Σ${wd?fmt(wd.availUren,0):'?'} / ${totaalUren.toLocaleString?totaalUren.toLocaleString('nl-NL'):totaalUren} = <span class="res">${wd?fmt(wd.besch,2):'?'}%</span></div>
      <div class="formule" style="flex:1;min-width:220px">areaal­<b>prestatie</b> = 100 − Σ${wd?fmt(wd.perfUren,0):'?'} / ${totaalUren.toLocaleString?totaalUren.toLocaleString('nl-NL'):totaalUren} = <span class="res">${wd?fmt(wd.prestatie,2):'?'}%</span></div>
    </div>
  </li>`;

  const summaryOms = `${m.typeId} ${m.code} · ${esc((m.melding||'').slice(0,48))}`;
  return `<details class="calc-item">
    <summary>
      <span class="ci-weg">${esc(m.weg)} ${esc(m.richting)}${m.hm!=null?(' · hm '+fmt(m.hm,3)):''}${m.strook?(' · strook '+esc(m.strook)):''}</span>
      <span class="ci-oms">${summaryOms}</span>
      <span class="tag ${tg}">${m.code}</span>
      <span class="ci-res" style="color:${m.avail>=50?'var(--rood)':m.avail>=15?'var(--oranje)':'var(--sub)'}">${fmt(m.avail,0)}%<span style="font-size:11px;color:var(--sub);font-weight:600"> besch.-impact</span></span>
    </summary>
    <div class="calc-body">
      <ol class="calc-steps">${steps}</ol>
      <div class="calc-final">
        <div class="cf-metric"><div class="cf-lab">Impact beschikbaarheid</div><div class="cf-val" style="color:${m.avail>=50?'var(--rood)':m.avail>=15?'var(--oranje)':'var(--rws-blauw)'}">${fmt(m.avail,1)}%</div></div>
        <div class="cf-metric"><div class="cf-lab">Impact prestatie</div><div class="cf-val" style="color:${m.perf>=50?'var(--rood)':m.perf>=15?'var(--oranje)':'var(--rws-blauw)'}">${fmt(m.perf,1)}%</div></div>
        <div class="cf-metric"><div class="cf-lab">Verlies-uren besch.</div><div class="cf-val" style="color:var(--rws-blauw)">${fmt(t.bijdrageAvail,0)}</div></div>
        <div class="cf-metric"><div class="cf-lab">Verlies-uren prest.</div><div class="cf-val" style="color:var(--rws-blauw)">${fmt(t.bijdragePerf,0)}</div></div>
        <div class="cf-metric"><div class="cf-lab">Wegdeel besch.</div><div class="cf-val" style="color:${wd?beschKleur(wd.besch,99.5):'var(--sub)'}">${wd?fmt(wd.besch,2):'–'}%</div></div>
        <div class="cf-metric"><div class="cf-lab">Wegdeel prest.</div><div class="cf-val" style="color:${wd?beschKleur(wd.prestatie,99.5):'var(--sub)'}">${wd?fmt(wd.prestatie,2):'–'}%</div></div>
      </div>
    </div>
  </details>`;
}

/* ══════════════════════════════════════════════════════════════
   WEGDEEL- & DIENSTVERSLAG — technisch/cijfermatig + management
   ══════════════════════════════════════════════════════════════ */
let WV_SEL = null;
function renderWegdeelverslag(){
  // sorteer wegdelen op kriticiteit (laagste dienst-beschikbaarheid eerst)
  const gesorteerd=[...STATE.wegdelen].sort((a,b)=>{
    const la=Math.min(...DIENSTEN.map(d=>a.diensten[d.id].besch));
    const lb=Math.min(...DIENSTEN.map(d=>b.diensten[d.id].besch));
    return la-lb;
  });
  if(!WV_SEL || !STATE.wegdelen.find(w=>w.key===WV_SEL)) WV_SEL = gesorteerd[0].key;
  let h=`<div class="card"><h3>Wegdeel- &amp; dienstverslag ${tip('Een <b>compleet rapport per wegdeel</b>: een managementsamenvatting in gewone taal, de volledige areaaldoorrekening (beschikbaarheid én prestatie) en per dienst de ketenopbouw met alle tussengetallen. Kies bovenin een wegdeel — ze staan gesorteerd op kriticiteit.')}</h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Volledig rekenverslag per wegdeel: managementduiding, de areaaldoorrekening (beschikbaarheid + prestatie) en per dienst de ketenopbouw met alle tussengetallen. Kies een wegdeel; ze staan op kriticiteit gesorteerd.</p>
    <div class="wv-nav" id="wvNav">${gesorteerd.map(w=>{
      const minB=Math.min(...DIENSTEN.map(d=>w.diensten[d.id].besch));
      return `<button class="${w.key===WV_SEL?'act':''}" data-wv="${esc(w.key)}" title="min. dienstbeschikbaarheid ${fmt(minB,1)}%">${esc(w.key)}</button>`;
    }).join('')}</div>
    <div id="wvHost"></div>
  </div>`;
  document.getElementById('tab-wegdeelverslag').innerHTML=h;
  document.getElementById('wvNav').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    WV_SEL=b.dataset.wv;
    document.querySelectorAll('#wvNav button').forEach(x=>x.classList.toggle('act',x.dataset.wv===WV_SEL));
    tekenWvVerslag();
  });
  tekenWvVerslag();
}

function oordeelTekst(besch,norm){
  if(besch>=norm) return {woord:'Op norm',kl:'groen',bg:'var(--groen-l)',fg:'var(--groen)'};
  if(besch>=norm-1) return {woord:'Krap onder norm',kl:'geel',bg:'var(--rws-geel-l)',fg:'#8a6d00'};
  if(besch>=norm-3) return {woord:'Onder norm',kl:'oranje',bg:'var(--oranje-l)',fg:'var(--oranje)'};
  return {woord:'Kritiek',kl:'rood',bg:'var(--rood-l)',fg:'var(--rood)'};
}

function tekenWvVerslag(){
  const wd=STATE.wegdelen.find(w=>w.key===WV_SEL);
  if(!wd){document.getElementById('wvHost').innerHTML='';return;}
  const pu=wd.periodeUren, totUren=Math.round(wd.N*pu);
  const fmtU=x=>Math.round(x).toLocaleString('nl-NL');

  // ── typenverdeling ──
  const typen=Object.entries(wd.typen).map(([t,n])=>`${t}: ${n}`).join(' · ');
  // zwaarste meldingen (top 5 op besch-impact-uren)
  const zwaar=[...wd.meldingen].sort((a,b)=>b.trace.bijdrageAvail-a.trace.bijdrageAvail).slice(0,5);

  // ── management-oordeel ──
  const diensten=DIENSTEN.map(d=>({d,dd:wd.diensten[d.id]}));
  const onderNorm=diensten.filter(x=>x.dd.besch<x.d.norm);
  const zwaarstDienst=[...diensten].sort((a,b)=>a.dd.besch-b.dd.besch)[0];
  const areaalOord=oordeelTekst(wd.besch,99.5);

  // Management-narratief opbouwen uit de cijfers
  let mgmt=`<div class="wv-mgmt">
    <h4>📋 Managementsamenvatting ${tip('Een automatisch opgestelde duiding <b>zonder rekenjargon</b>: hoeveel storingen, het oordeel over de areaalwaarde, welke diensten onder norm vallen en de belangrijkste aandachtspunten (fatale uitval, langlopende storingen, samenloop). Bedoeld voor bestuurlijke lezers.',true)}— ${esc(wd.key)} <span class="muted" style="font-weight:400;font-size:12px">(${esc(wd.vc)} / ${esc(wd.district)})</span></h4>`;
  const bronLabel = (wd.areaalBron==='direct'||wd.areaalBron==='geladen-register') ? 'volgens het geladen asset-register' : ((wd.areaalBron==='weg-totaal'||wd.areaalBron==='geladen-register-weg') ? 'volgens het geladen asset-register (wegtelling, incl. op-/afritten)' : 'geschat (geen registermatch)');
  mgmt+=`<p>Op wegdeel <b>${esc(wd.key)}</b> zijn op de peildatum <b>${wd.n}</b> open DVM-storingen actief (${esc(typen)}), verspreid over een areaal van <b>${wd.N}</b> signaalgevers ${bronLabel}. De actuele areaalbeschikbaarheid van de signalering komt uit op <b>${fmt(wd.besch,2)}%</b> <span class="oordeel" style="background:${areaalOord.bg};color:${areaalOord.fg}">${areaalOord.woord}</span> en de prestatie op <b>${fmt(wd.prestatie,2)}%</b>.</p>`;

  if(onderNorm.length){
    mgmt+=`<p>Voor de dienstverlening betekent dit dat <b>${onderNorm.length} van de ${DIENSTEN.length} diensten</b> onder hun norm presteren op dit wegdeel. `;
    mgmt+=`Het zwaarst geraakt is <b>${zwaarstDienst.d.naam.replace(/&amp;/g,'&')}</b> met een beschikbaarheid van <b>${fmt(zwaarstDienst.dd.besch,1)}%</b> tegen een norm van ${fmt(zwaarstDienst.d.norm,1)}% — een tekort van <b>${fmt(zwaarstDienst.d.norm-zwaarstDienst.dd.besch,1)} procentpunt</b>. Dit komt doordat deze dienst sterk leunt op ${zwaarsteAfh(zwaarstDienst.d)}.</p>`;
  } else {
    mgmt+=`<p>Alle vier de diensten blijven op dit wegdeel <b>op of boven norm</b>. De geregistreerde storingen leiden niet tot een normoverschrijding voor de dienstverlening.</p>`;
  }

  // aanbeveling
  mgmt+=`<p style="margin-bottom:2px"><b>Duiding &amp; aandachtspunten:</b></p><ul>`;
  const fatale=wd.meldingen.filter(m=>m.code==='1003').length;
  if(fatale) mgmt+=`<li>${fatale} van de ${wd.n} storingen zijn <b>fatale MSI-uitval</b> (foutcode 1003, 100% impact). Dit domineert het beschikbaarheidsverlies.</li>`;
  const langlopend=wd.meldingen.filter(m=>m.trace.duurRaw>8760).length;
  if(langlopend) mgmt+=`<li>${langlopend} storing(en) lopen langer dan een jaar door; deze wegen zwaar in de standtijd en verdienen prioriteit bij herstelplanning.</li>`;
  const combi=wd.meldingen.filter(m=>m.trace.combi.length).length;
  if(combi) mgmt+=`<li>Bij ${combi} storing(en) is sprake van <b>samenloop</b> (combiregel): meerdere defecten dicht bij elkaar versterken de impact op ditzelfde wegvak.</li>`;
  if(wd.prestatie < wd.besch-2) mgmt+=`<li>De prestatie (${fmt(wd.prestatie,1)}%) ligt merkbaar lager dan de beschikbaarheid (${fmt(wd.besch,1)}%): ook als een signaalgever "beschikbaar" is, is het beeld vaker gedegradeerd.</li>`;
  if(wd.areaalBron==='schatting') mgmt+=`<li>Dit wegdeel is niet teruggevonden in het asset-register; het aantal signaalgevers (${wd.N}) is geschat. Controleer de weg-/richtingcodering voor een exacte areaalwaarde.</li>`;
  else if(wd.areaalBron==='weg-totaal'||wd.areaalBron==='geladen-register-weg') mgmt+=`<li>De storing staat op een op-/afrit of verbindingsboog; het areaal is de gecombineerde signaalgevertelling van de hele weg (${wd.N}) uit het geladen register.</li>`;
  mgmt+=`</ul></div>`;

  // ── KPI-strip ──
  let kpi=`<div class="wv-summary">
    <div class="wv-kpi"><div class="v" style="color:${beschKleur(wd.besch,99.5)}">${fmt(wd.besch,2)}%</div><div class="l">Areaalbeschikbaarheid</div></div>
    <div class="wv-kpi"><div class="v" style="color:${beschKleur(wd.prestatie,99.5)}">${fmt(wd.prestatie,2)}%</div><div class="l">Areaalprestatie</div></div>
    <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw)">${wd.n}</div><div class="l">Storingen</div></div>
    <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw)">${wd.N}</div><div class="l">Signaalgevers ${wd.areaalBron==='schatting'?'(geschat)':'(register)'}</div></div>
    <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw)">${STATE.stats.actueel?wd.n:wd.storingenJr}</div><div class="l">${STATE.stats.actueel?'Open storingen':'Storingen / jaar'}</div></div>
  </div>`;

  // ── TECHNISCH: areaaldoorrekening ──
  const arInfo = wd.areaal;
  let tech=`<div class="wv-sect"><h4>Technische doorrekening — areaal (stap 6) ${tip('De <b>cijfermatige onderbouwing</b> van de areaalwaarden. Alle verlies-uren (impact × standtijd) van de storingen op dit wegdeel worden gedeeld door de totale beschikbare uren van het areaal (signaalgevers × periode).<span class="frm">besch = 100 − Σverlies-uren / (N × periode)</span>',true)}</h4>`;
  if(arInfo){
    tech+=`<p class="muted" style="font-size:12px;margin-bottom:8px">Areaal uit het geladen RWS asset-register (VC ${esc(arInfo.vc)}, ${(wd.areaalBron==='direct'||wd.areaalBron==='geladen-register')?'wegdeel '+esc(arInfo.key):'wegtelling '+esc(arInfo.key)+', incl. op-/afritten'}):
      <span class="kv">signaalgevers <b>${arInfo.sig}</b></span>
      <span class="kv">camera's <b>${arInfo.cam}</b></span>
      <span class="kv">detectielussen <b>${arInfo.lus}</b></span>
      <span class="kv">DRIP <b>${arInfo.drip}</b></span></p>`;
  } else {
    tech+=`<p class="muted" style="font-size:12px;margin-bottom:8px">Geen registermatch — aantal signaalgevers geschat op ${wd.N}.</p>`;
  }
  tech+=`<p class="muted" style="font-size:12px;margin-bottom:8px">De impact-percentages van alle storingen worden vermenigvuldigd met hun standtijd tot verlies-uren, en gedeeld door de totale beschikbare uren van het areaal.</p>
    <div class="keten-form">rekenvenster actueel puntbeeld = ${fmtU(pu)} uur; iedere open storing is gedurende dit volledige venster actief</div>
    <div class="keten-form" style="margin-top:5px">totaal beschikbare uren = ${wd.N} signaalgevers × ${fmtU(pu)} u = <span style="color:var(--rws-blauw);font-weight:700">${fmtU(totUren)} u</span></div>
    <div class="keten-form" style="margin-top:5px">Σ verlies-uren besch = <span style="color:var(--rood);font-weight:700">${fmtU(wd.availUren)} u</span> &nbsp;·&nbsp; Σ verlies-uren prest = <span style="color:var(--rood);font-weight:700">${fmtU(wd.perfUren)} u</span></div>
    <div class="keten-form" style="margin-top:5px">beschikbaarheid = 100 − ${fmtU(wd.availUren)} / ${fmtU(totUren)} × 100 = <span style="color:var(--groen);font-weight:700">${fmt(wd.besch,3)}%</span></div>
    <div class="keten-form" style="margin-top:5px">prestatie = 100 − ${fmtU(wd.perfUren)} / ${fmtU(totUren)} × 100 = <span style="color:var(--groen);font-weight:700">${fmt(wd.prestatie,3)}%</span></div>`;

  // grootste bijdragers
  tech+=`<p class="muted" style="font-size:12px;margin:12px 0 6px">Grootste bijdragers aan het verlies (top 5):</p>
    <div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr>
      <th>HM · strook</th><th>Code</th><th class="num">Impact besch.</th><th class="num">Standtijd</th><th class="num">Verlies-u besch.</th><th class="num">Verlies-u prest.</th></tr></thead><tbody>`;
  zwaar.forEach(m=>{
    tech+=`<tr><td class="mono">${m.hm!=null?fmt(m.hm,3):'–'} · ${esc(m.strook||'–')}</td>
      <td><span class="tag ${m.code==='1003'?'r':'o'}">${m.code}</span></td>
      <td class="num" style="font-weight:700">${fmt(m.avail,0)}%</td>
      <td class="num mono">${fmtU(m.trace.duurGeclampt)} u</td>
      <td class="num" style="color:var(--rood);font-weight:700">${fmtU(m.trace.bijdrageAvail)}</td>
      <td class="num" style="color:var(--rood)">${fmtU(m.trace.bijdragePerf)}</td></tr>`;
  });
  tech+=`</tbody></table></div></div>`;

  // ── TECHNISCH: brontabel ──
  tech+=`<div class="wv-sect"><h4>Brontabel objecttypen (invoer voor de ketens) ${tip('De beschikbaarheid/prestatie <b>per objecttype</b> (signalering, camera, detectie) op dit wegdeel. Deze waarden zijn de invoer voor de dienstketens: elke dienst combineert ze met zijn eigen gewichten. Objecttypen zonder storing tellen als 100%.',true)}</h4>
    <p class="muted" style="font-size:12px;margin-bottom:8px">Elke dienst is een keten van objecttypen. De beschikbaarheid per objecttype komt uit de storingen op dit wegdeel; ontbreekt een type, dan telt het als 100%.</p>
    <table class="tbl"><thead><tr><th>Objecttype-bron</th><th class="num">Beschikbaarheid</th><th class="num">Prestatie</th><th>Herkomst</th></tr></thead><tbody>`;
  const bronLabels={MSI:'MSI (signalering)',CAM:'Camera',LUS:'Meetlus (detectie)'};
  Object.entries(wd.bron).forEach(([tp,v])=>{
    const nMeld=tp==='MSI'?wd.meldingen.filter(m=>m.typeId==='MSI').length:wd.meldingen.filter(m=>m.typeId===tp).length;
    tech+=`<tr><td><b>${bronLabels[tp]||tp}</b></td>
      <td class="num" style="color:${beschKleur(v.besch,99.5)};font-weight:700">${fmt(v.besch,2)}%</td>
      <td class="num" style="color:${beschKleur(v.perf,99.5)}">${fmt(v.perf,2)}%</td>
      <td class="muted" style="font-size:11.5px">${tp==='MSI'?'areaalwaarde van dit wegdeel':nMeld?nMeld+' melding(en) op wegdeel':'geen storing → 100%'}</td></tr>`;
  });
  tech+=`</tbody></table></div>`;

  // ── PER DIENST: ketenopbouw ──
  let dnst=`<div class="wv-sect"><h4>Doorrekening per dienst — ketenopbouw ${tip('Voor elk van de vier VWM-diensten wordt eerst ieder subproces uit zijn assetafhankelijkheden berekend. Daarna geeft het genormaliseerde subprocesgewicht de totale dienstbeschikbaarheid en prestatie.<span class="frm">dienst = Σ(aandeel subproces × waarde subproces)</span>',true)}</h4>`;
  DIENSTEN.forEach(d=>{
    const dd=wd.diensten[d.id];
    const oord=oordeelTekst(dd.besch,d.norm);
    // formule-strings opbouwen
    const detail=Array.isArray(dd.detail)?dd.detail:[];
    const totaalGewicht=detail.reduce((s,x)=>s+(Number(x.gewicht)||0),0);
    const termenB=detail.map(x=>`${totaalGewicht?Math.round((Number(x.gewicht)||0)/totaalGewicht*100):0}%×${fmt(x.besch,1)}`).join(' + ');
    const termenP=detail.map(x=>`${totaalGewicht?Math.round((Number(x.gewicht)||0)/totaalGewicht*100):0}%×${fmt(x.prestatie,1)}`).join(' + ');
    dnst+=`<div class="dienstblok" style="--accent:${d.kleur}">
      <div class="db-kop">
        <span class="db-naam" style="color:${d.kleur}">${d.naam}</span>
        <span><span class="oordeel" style="background:${oord.bg};color:${oord.fg};font-size:12px">${oord.woord}</span></span>
      </div>
      <div class="db-uit">${d.tekst} <b>Norm ${fmt(d.norm,1)}%.</b></div>
      <table class="tbl"><thead><tr><th>Subproces</th><th class="num">Aandeel dienst</th><th class="num">Beschikbaarheid</th><th class="num">Gewogen bijdrage</th><th class="num">Prestatie</th></tr></thead><tbody>`;
    detail.forEach(x=>{
      const aandeel=totaalGewicht?(Number(x.gewicht)||0)/totaalGewicht:0;
      dnst+=`<tr><td><b>${esc(x.naam||'Onbekend subproces')}</b></td>
        <td class="num mono">${Math.round(aandeel*100)}%</td>
        <td class="num" style="color:${beschKleur(x.besch,99.5)}">${fmt(x.besch,1)}%</td>
        <td class="num mono">${fmt(aandeel*x.besch,1)}</td>
        <td class="num" style="color:${beschKleur(x.prestatie,99.5)}">${fmt(x.prestatie,1)}%</td></tr>`;
    });
    dnst+=`</tbody></table>
      <div class="keten-form" style="margin-top:8px">beschikbaarheid = ${termenB||'geen actieve subprocessen'} = <span style="color:${beschKleur(dd.besch,d.norm)};font-weight:700">${fmt(dd.besch,2)}%</span></div>
      <div class="keten-form" style="margin-top:5px">prestatie = ${termenP||'geen actieve subprocessen'} = <span style="color:${beschKleur(dd.prestatie,d.norm)};font-weight:700">${fmt(dd.prestatie,2)}%</span></div>
      <div class="muted" style="font-size:11.5px;margin-top:7px">${dd.besch>=d.norm
        ? `✓ Ruimte t.o.v. norm: +${fmt(dd.besch-d.norm,1)} pp.`
        : `✗ Tekort t.o.v. norm: −${fmt(d.norm-dd.besch,1)} pp. Verbetering vereist herstel van vooral ${zwaarsteAfh(d)}.`}</div>
    </div>`;
  });
  dnst+=`</div>`;

  document.getElementById('wvHost').innerHTML = mgmt + kpi + tech + dnst;
}

function zwaarsteAfh(d){
  const items=Object.entries(dienstAssetAfhankelijkheid(d)).sort((a,b)=>b[1]-a[1]);
  const top=items[0];
  const naam={signalering:'de matrixsignalering (MSI)',camera:'het camerabeeld',detectie:'de detectie (meetlussen)',drip:'de DRIP-informatie',dynamische_strook:'de dynamische stroken',communicatie:'de communicatiesystemen'}[top[0]]||top[0];
  return `${naam} (${Math.round(top[1]*100)}% gewicht)`;
}

/* ══════════════════════════════════════════════════════════════
   GEBIED & CHOKE-POINTS — waar clusteren de storingen ruimtelijk?
   ══════════════════════════════════════════════════════════════ */
function chokeKleur(besch){
  if(besch>=95) return 'var(--groen)';
  if(besch>=80) return 'var(--rws-geel)';
  if(besch>=50) return 'var(--oranje)';
  return 'var(--rood)';
}

/* Ruimtelijke strip: één weg, storingen geplot op hun hm-positie.
   Clusters kleuren op lokale beschikbaarheid; hoogte = aantal storingen. */
function chartWegStrip(wd){
  const items=wd.meldingen.filter(m=>m.hm!=null);
  if(!items.length) return '<p class="muted" style="font-size:12px">Geen hm-posities beschikbaar voor dit wegdeel.</p>';
  const hms=items.map(m=>m.hm);
  const min=Math.min(...hms), max=Math.max(...hms);
  const span=Math.max(max-min,1);
  const W=800,H=120,padL=40,padR=20,padT=14,padB=28;
  const sx=h=>padL+((h-min)/span)*(W-padL-padR);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="xMidYMid meet">`;
  // wegas
  const yAs=H-padB;
  s+=`<line x1="${padL}" y1="${yAs}" x2="${W-padR}" y2="${yAs}" stroke="var(--grijs-mid)" stroke-width="2"/>`;
  // hm-labels
  const stap=span>60?20:span>20?10:span>8?5:2;
  for(let g=Math.ceil(min/stap)*stap; g<=max; g+=stap){
    const x=sx(g);
    s+=`<line x1="${x}" y1="${yAs}" x2="${x}" y2="${yAs+4}" stroke="var(--grijs-mid)"/>`;
    s+=`<text x="${x}" y="${yAs+16}" text-anchor="middle" class="ax">${g}</text>`;
  }
  s+=`<text x="${W-padR}" y="${yAs+16}" text-anchor="end" class="ax">hm →</text>`;
  // clusterbanden
  const maxN=Math.max(...wd.chokes.map(c=>c.n),1);
  wd.chokes.forEach(c=>{
    const x0=sx(c.hmMin), x1=sx(c.hmMax);
    const bw=Math.max(x1-x0,4);
    const hgt=8+(c.n/maxN)*(H-padT-padB-14);
    const y=yAs-hgt;
    const kl=chokeKleur(c.beschLok);
    s+=`<rect x="${x0-2}" y="${y}" width="${bw+4}" height="${hgt}" rx="2" fill="${kl}" opacity="0.85"><title>hm ${c.hmMin.toFixed(1)}-${c.hmMax.toFixed(1)} · ${c.n} storingen · lokaal ${fmt(c.beschLok,1)}%</title></rect>`;
    if(c.n>=3) s+=`<text x="${(x0+x1)/2}" y="${y-3}" text-anchor="middle" class="val" fill="${kl}" style="font-size:10px">${c.n}</text>`;
  });
  s+=`</svg>`;
  return s;
}

const GEBIED_REGIO_NAAM={NWN:'Noordwest-Nederland',ZWN:'Zuidwest-Nederland',MN:'Midden-Nederland',NON:'Oost-Nederland',ZN:'Zuid-Nederland'};
/* NWB-wegassen, afgeleid uit het geladen nwb_hoofdwegennet.xml. De bron was
   WGS84. Voor directe vergelijking met All Assets zijn de punten omgerekend
   naar RD New en per lijn maximaal 8 meter vereenvoudigd. De compacte base36-
   deltacodering houdt de zelfstandige HTML snel en mobiel bruikbaar. */
const NWB_HOOFDWEGEN={"meta": {}, "wegen": {}};
let GEBIED_SORT='ernst';
let GEBIED_REGIO='';
let GEBIED_KAART_ZOOM=1;
let GEBIED_KAART_FOCUS=null;
let GEBIED_KAART_SELECTIE='';
const U_ROUTE_GEOMETRIE={"meta": {}, "relaties": {}};
const WERK_GEOMETRIE_INDEX={"meta": {}, "werken": {}};
let GEBIED_KAART_CHOKES=[];
let GEBIED_NETWERK_CACHE=null;

function gebiedRegioNaam(vc){
  const k=normAssetVc(vc);return GEBIED_REGIO_NAAM[k]||k||'Onbekend gebied';
}
function chokeKaartId(c){return [c.key,Number(c.hmMin).toFixed(3),Number(c.hmMax).toFixed(3)].join('|');}
function geldigeRdCoord(x,y){return x>=0&&x<=300000&&y>=280000&&y<=650000;}

function decodeNwbSegment(code){
  const waarden=String(code||'').split('.').map(v=>parseInt(v,36));
  if(waarden.length<2||!isFinite(waarden[0])||!isFinite(waarden[1]))return [];
  let x=waarden[0],y=waarden[1];const punten=[{x,y}];
  for(let i=2;i+1<waarden.length;i+=2){
    if(!isFinite(waarden[i])||!isFinite(waarden[i+1]))continue;
    x+=waarden[i];y+=waarden[i+1];punten.push({x,y});
  }
  return punten;
}
function nwbWegCode(v){
  const m=String(v||'').toUpperCase().match(/([AN])\s*0*(\d{1,3})/);
  return m?m[1]+String(Number(m[2])):'';
}

/* De kaartbasis komt uit NWB-2025. All Assets blijft het stamregister voor
   identiteit, gebied, hectometer en het geografische anker van een storing.
   Zo verandert de kaartgeometrie, maar niet de berekening of assetkoppeling. */
function rijkswegNetwerkData(){
  if(GEBIED_NETWERK_CACHE&&GEBIED_NETWERK_CACHE.register===ASSET_REGISTER_STATE)return GEBIED_NETWERK_CACHE;
  const groepen=new Map(),perRegioN={},regioPunten=new Map();let coordN=0;
  ((ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.assets)||[]).forEach(a=>{
    if(!a.prognoseActief||!geldigeRdCoord(a.rdX,a.rdY)||!/^[AN]\d+$/i.test(a.weg||''))return;
    const vc=normAssetVc(a.vc),weg=String(a.weg).toUpperCase(),richting=normAssetRichting(a.richting);
    const sleutel=[vc,weg,richting].join('|');
    const g=groepen.get(sleutel)||{vc,weg,richting,vakken:new Map()};
    const vak=a.hm!=null&&isFinite(a.hm)?'h'+Math.round(Number(a.hm)*2):'r'+Math.round(a.rdX/500)+'x'+Math.round(a.rdY/500);
    const oud=g.vakken.get(vak);
    if(!oud||a.tp==='MSI')g.vakken.set(vak,{x:Number(a.rdX),y:Number(a.rdY),hm:a.hm!=null?Number(a.hm):null});
    groepen.set(sleutel,g);coordN++;perRegioN[vc]=(perRegioN[vc]||0)+1;
    const rp=regioPunten.get(vc)||[];rp.push({x:Number(a.rdX),y:Number(a.rdY),vc,weg});regioPunten.set(vc,rp);
  });
  const perWeg=new Map();
  groepen.forEach(g=>{
    const ps=[...g.vakken.values()].sort((a,b)=>{
      if(a.hm!=null&&b.hm!=null)return a.hm-b.hm;
      if(a.hm!=null)return -1;if(b.hm!=null)return 1;
      return a.x-b.x||a.y-b.y;
    });
    const wegSleutel=[g.vc,g.weg].join('|'),wegPunten=perWeg.get(wegSleutel)||[];
    wegPunten.push(...ps.map(p=>({...p,richting:g.richting})));perWeg.set(wegSleutel,wegPunten);
  });
  const segmenten=[],punten=[],nwbPerWeg=new Map();
  Object.entries(NWB_HOOFDWEGEN.wegen||{}).forEach(([weg,codes])=>{
    const wegCode=nwbWegCode(weg),wegSegmenten=[];
    (codes||[]).forEach((code,nr)=>{
      const ps=decodeNwbSegment(code);if(ps.length<2)return;
      const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);
      const segment={weg:wegCode,nr:nr+1,punten:ps,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),bron:'NWB'};
      segmenten.push(segment);wegSegmenten.push(segment);punten.push(...ps);
    });
    if(wegSegmenten.length)nwbPerWeg.set(wegCode,wegSegmenten);
  });
  GEBIED_NETWERK_CACHE={register:ASSET_REGISTER_STATE,segmenten,punten,perWeg,nwbPerWeg,regioPunten,coordN,perRegioN,regios:Object.keys(perRegioN).filter(Boolean),bron:'NWB'};
  return GEBIED_NETWERK_CACHE;
}

function projecteerOpLijn(x,y,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  const t=l2?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l2)):0;
  const px=a.x+t*dx,py=a.y+t*dy;
  return {x:px,y:py,afstand:Math.hypot(x-px,y-py),t};
}
function snapPuntOpNwb(weg,x,y,maxAfstand=250){
  const wegCode=nwbWegCode(weg),pool=rijkswegNetwerkData().nwbPerWeg.get(wegCode)||[];
  let best=null;
  pool.forEach(segment=>{
    for(let i=1;i<segment.punten.length;i++){
      const p=projecteerOpLijn(x,y,segment.punten[i-1],segment.punten[i]);
      if(!best||p.afstand<best.afstand)best={...p,weg:wegCode,segmentNr:segment.nr};
    }
  });
  if(!best||best.afstand>maxAfstand)return {x,y,weg:wegCode,afstand:best?best.afstand:null,gesnapt:false};
  return {...best,gesnapt:true};
}

/* Een choke-point krijgt eerst een gecontroleerd geografisch anker uit de
   gekoppelde assets. Alleen dat anker wordt vervolgens op de overeenkomstige
   NWB-weg geprojecteerd. Een andere weg of een afwijking boven 250 meter wordt
   nooit automatisch gekozen. */
function chokeKaartPunt(c){
  if(c._kaartPuntRegister===ASSET_REGISTER_STATE&&c._kaartPunt!==undefined)return c._kaartPunt;
  c._kaartPuntRegister=ASSET_REGISTER_STATE;
  const direct=(c.leden||[]).filter(m=>geldigeRdCoord(m.rdX,m.rdY));
  let basis=null;
  if(direct.length){
    basis={x:direct.reduce((s,m)=>s+Number(m.rdX),0)/direct.length,y:direct.reduce((s,m)=>s+Number(m.rdY),0)/direct.length,bron:'gekoppelde assets'};
  }
  const mid=(Number(c.hmMin)+Number(c.hmMax))/2,wd=c.wd||{},vc=normAssetVc(c.vc||wd.vc),richting=normAssetRichting(wd.richting);
  if(!basis){
    let best=null,bestD=1.001;
    const pool=rijkswegNetwerkData().perWeg.get([vc,String(wd.weg||'').toUpperCase()].join('|'))||[];
    pool.forEach(a=>{
      if(a.hm==null)return;
      if(richting&&normAssetRichting(a.richting)&&normAssetRichting(a.richting)!==richting)return;
      const d=Math.abs(Number(a.hm)-mid);if(d<bestD){bestD=d;best=a;}
    });
    if(best)basis={x:Number(best.x),y:Number(best.y),bron:'nabije asset op dezelfde weg'};
  }
  if(!basis){c._kaartPunt=null;return null;}
  const snap=snapPuntOpNwb(wd.weg,basis.x,basis.y,250);
  c._kaartPunt={x:snap.x,y:snap.y,basisX:basis.x,basisY:basis.y,basisBron:basis.bron,bron:snap.gesnapt?'NWB-snap':basis.bron,afstandNwb:snap.afstand,gesnapt:snap.gesnapt,segmentNr:snap.segmentNr||null,weg:snap.weg};
  return c._kaartPunt;
}

function wijzigGebiedRegio(v){
  GEBIED_REGIO=normAssetVc(v)||'';GEBIED_KAART_ZOOM=1;GEBIED_KAART_FOCUS=null;GEBIED_KAART_SELECTIE='';renderGebied();
}
function wijzigGebiedZoom(richting){
  const f=richting>0?1.6:1/1.6;GEBIED_KAART_ZOOM=Math.max(1,Math.min(8,GEBIED_KAART_ZOOM*f));renderGebied();
}
function herstelGebiedKaart(){GEBIED_KAART_ZOOM=1;GEBIED_KAART_FOCUS=null;renderGebied();}
function selecteerChokeOpKaart(index){
  const c=GEBIED_KAART_CHOKES[index];if(!c)return;
  const p=chokeKaartPunt(c);GEBIED_KAART_SELECTIE=chokeKaartId(c);
  if(p){GEBIED_KAART_FOCUS={x:p.x,y:p.y};GEBIED_KAART_ZOOM=Math.max(2.6,GEBIED_KAART_ZOOM);}
  renderGebied();
  const el=document.getElementById('chokeRijkswegKaart');if(el)el.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function renderRijkswegKaart(chokes){
  GEBIED_KAART_CHOKES=chokes;
  const net=rijkswegNetwerkData(),regio=GEBIED_REGIO;
  const segmenten=net.segmenten;
  const basisPunten=regio?(net.regioPunten.get(regio)||[]):net.punten;
  const kaartChokes=chokes.map((c,i)=>({c,i,p:chokeKaartPunt(c)})).filter(x=>x.p);
  if(!basisPunten.length&&!kaartChokes.length){
    return `<div class="choke-map-box" id="chokeRijkswegKaart"><div class="choke-map-waarschuwing"><b>Regionale uitsnede nog niet beschikbaar.</b> De NWB-wegassen zijn geladen, maar de assetlijst bevat voor ${esc(regio?gebiedRegioNaam(regio):'deze selectie')} geen bruikbare RD-coördinaten om de uitsnede en choke-points te verankeren. De tabellen blijven wel werken.</div></div>`;
  }
  let gekozen=chokes.find(c=>chokeKaartId(c)===GEBIED_KAART_SELECTIE);
  if(!gekozen&&kaartChokes.length){gekozen=kaartChokes.slice().sort((a,b)=>a.c.beschLok-b.c.beschLok)[0].c;GEBIED_KAART_SELECTIE=chokeKaartId(gekozen);}
  const allePunten=basisPunten.concat(kaartChokes.map(x=>x.p));
  let minX=Math.min(...allePunten.map(p=>p.x)),maxX=Math.max(...allePunten.map(p=>p.x));
  let minY=Math.min(...allePunten.map(p=>p.y)),maxY=Math.max(...allePunten.map(p=>p.y));
  const W=900,H=530,pad=22,doel=(W-2*pad)/(H-2*pad);
  let bw=Math.max(maxX-minX,10000),bh=Math.max(maxY-minY,10000),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  if(bw/bh>doel)bh=bw/doel;else bw=bh*doel;
  minX=cx-bw/2;maxX=cx+bw/2;minY=cy-bh/2;maxY=cy+bh/2;
  const focus=GEBIED_KAART_FOCUS&&geldigeRdCoord(GEBIED_KAART_FOCUS.x,GEBIED_KAART_FOCUS.y)?GEBIED_KAART_FOCUS:{x:cx,y:cy};
  const zoom=Math.max(1,Math.min(8,GEBIED_KAART_ZOOM));
  bw/=zoom;bh/=zoom;cx=focus.x;cy=focus.y;
  const links=cx-bw/2,rechts=cx+bw/2,onder=cy-bh/2,boven=cy+bh/2;
  const sx=x=>pad+(x-links)/bw*(W-2*pad),sy=y=>pad+(boven-y)/bh*(H-2*pad);
  const zichtbareSegmenten=segmenten.filter(s=>s.maxX>=links&&s.minX<=rechts&&s.maxY>=onder&&s.minY<=boven);
  let svg=`<svg viewBox="0 0 ${W} ${H}" class="choke-map-svg" role="img" aria-label="Rijkswegennet met ${kaartChokes.length} gepositioneerde choke-points in ${esc(regio?gebiedRegioNaam(regio):'Nederland')}">`;
  svg+=`<defs><clipPath id="chokeKaartClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#chokeKaartClip)">`;
  zichtbareSegmenten.forEach(s=>{
    const pts=s.punten.map(p=>`${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    svg+=`<polyline class="${s.weg.startsWith('A')?'rijksweg-a':'rijksweg-n'}" points="${pts}"><title>${esc(s.weg)}, NWB-segment ${s.nr}</title></polyline>`;
  });
  kaartChokes.forEach(x=>{
    const c=x.c,px=sx(x.p.x),py=sy(x.p.y),id=chokeKaartId(c),sel=id===GEBIED_KAART_SELECTIE;
    if(px<-20||px>W+20||py<-20||py>H+20)return;
    const r=Math.max(5,Math.min(12,4+Math.sqrt(c.n)*1.7));
    const plaatsing=x.p.gesnapt?`NWB-snap ${Math.round(x.p.afstandNwb)} meter`:'assetpositie, geen veilige NWB-snap';
    svg+=`<g onclick="selecteerChokeOpKaart(${x.i})" role="button" aria-label="${esc(c.key)} hectometer ${c.hmMin.toFixed(1)}, ${c.n} storingen, lokale beschikbaarheid ${fmt(c.beschLok,1)} procent, ${esc(plaatsing)}"><circle class="choke-halo" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r+2).toFixed(1)}"/><circle class="choke-punt${sel?' geselecteerd':''}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${chokeKleur(c.beschLok)}"><title>${esc(c.key)} hm ${c.hmMin.toFixed(1)}${c.hmMax>c.hmMin?'-'+c.hmMax.toFixed(1):''}, ${c.n} storingen, lokaal ${fmt(c.beschLok,1)}%, ${esc(plaatsing)}</title></circle></g>`;
    if(sel){const rechtsLabel=px<W*.72;svg+=`<text x="${(px+(rechtsLabel?r+6:-r-6)).toFixed(1)}" y="${(py-7).toFixed(1)}" text-anchor="${rechtsLabel?'start':'end'}" class="kaart-label">${esc(c.key)} hm ${c.hmMin.toFixed(1)}</text>`;}
  });
  svg+=`</g><g aria-hidden="true"><line x1="${W-34}" y1="45" x2="${W-34}" y2="20" stroke="var(--rws-blauw)" stroke-width="2"/><path d="M ${W-40} 28 L ${W-34} 17 L ${W-28} 28 Z" fill="var(--rws-blauw)"/><text x="${W-34}" y="58" text-anchor="middle" class="kaart-label">N</text></g></svg>`;
  const gekozenPunt=gekozen?chokeKaartPunt(gekozen):null;
  const plaatsDetail=gekozenPunt?(gekozenPunt.gesnapt?`<span>NWB-snap: ${Math.round(gekozenPunt.afstandNwb)} m vanaf ${esc(gekozenPunt.basisBron)}</span>`:`<span>Assetpositie: geen veilige NWB-match binnen 250 m</span>`):'';
  const detail=gekozen?`<b>${esc(gekozen.key)} hm ${gekozen.hmMin.toFixed(1)}${gekozen.hmMax>gekozen.hmMin?'-'+gekozen.hmMax.toFixed(1):''}</b><span>${gekozen.n} storingen</span><span>${gekozen.dichtheid.toFixed(1)} per km</span><span style="color:${chokeKleur(gekozen.beschLok)};font-weight:700">${fmt(gekozen.beschLok,1)}% lokaal beschikbaar</span>${plaatsDetail}`:`<span>Geen choke-point met een betrouwbare kaartpositie in deze selectie.</span>`;
  const snapN=kaartChokes.filter(x=>x.p.gesnapt).length,ankerN=((regio&&net.perRegioN[regio])||(!regio&&net.coordN)||0);
  return `<div class="choke-map-box" id="chokeRijkswegKaart">${svg}<div class="choke-map-detail">${detail}</div></div><div class="choke-map-meta">Kaartbasis: ${esc(NWB_HOOFDWEGEN.meta.bron)}, ${NWB_HOOFDWEGEN.meta.wegen} wegen en ${NWB_HOOFDWEGEN.meta.segmenten} segmenten, vereenvoudigd tot maximaal ${NWB_HOOFDWEGEN.meta.vereenvoudigingM} m geometrische afwijking. ${ankerN.toLocaleString('nl-NL')} actieve assets leveren het geografische anker. ${snapN} van ${kaartChokes.length} geplaatste choke-points zijn binnen 250 m op dezelfde NWB-weg gesnapt. Niet-gekoppelde locaties en andere wegen worden niet gegokt.</div>`;
}

function renderGebied(){
  // Verzamel alle clusters en pas daarna de gekozen regionale uitsnede toe.
  const alleNet=[];
  STATE.wegdelen.forEach(w=>w.chokes.forEach(c=>{if(c.n>=2)alleNet.push({key:w.key,vc:normAssetVc(w.vc),wd:w,...c});}));
  const net=rijkswegNetwerkData();
  const regioVolgorde=['NWN','ZWN','MN','NON','ZN'];
  const regioCodes=[...new Set(alleNet.map(c=>c.vc).concat(net.regios).filter(Boolean))].sort((a,b)=>{
    const ia=regioVolgorde.indexOf(a),ib=regioVolgorde.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);
  });
  const alle=GEBIED_REGIO?alleNet.filter(c=>c.vc===GEBIED_REGIO):alleNet;
  const selectieNaam=GEBIED_REGIO?gebiedRegioNaam(GEBIED_REGIO):'Heel Nederland';

  let h=`<div class="card"><h3 style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span>Choke-points, ruimtelijke concentratie van storingen ${tip('Een lange weg met een goed gemiddelde kan lokaal toch een storingsconcentratie bevatten. De analyse clustert storingen op hm-positie en berekent per cluster een lokale beschikbaarheid. All Assets levert het geografische anker; de kaart projecteert dat anker veilig op dezelfde wegas uit NWB-2025.')}</span><button class="memo-knop" onclick="opentMemo('gebied')">📄 Memo genereren</button></h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Clusters van ≥2 storingen binnen ${(RULES.cfg.chokeVenster||2)} km. De lokale beschikbaarheid deelt de verliesuren door alleen de signaalgevers in het segment. Het venster is instelbaar in de rule engine, sectie 0.</p>`;

  const ernstig=alle.filter(c=>c.beschLok<80).length;
  const zwaarste=alle.slice().sort((a,b)=>a.beschLok-b.beschLok)[0];
  GEBIED_SCHERM={totaalClusters:alle.length,ernstig,zwaarste,chokeVenster:RULES.cfg.chokeVenster||2,regio:GEBIED_REGIO,regioNaam:GEBIED_REGIO?gebiedRegioNaam(GEBIED_REGIO):''};
  h+=`<div class="wv-summary">
    <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw)">${alle.length}</div><div class="l">Clusters in ${esc(selectieNaam)}</div></div>
    <div class="wv-kpi"><div class="v" style="color:var(--oranje)">${ernstig}</div><div class="l">Ernstig (&lt;80% lokaal)</div></div>
    <div class="wv-kpi"><div class="v" style="color:${zwaarste?chokeKleur(zwaarste.beschLok):'var(--sub)'}">${zwaarste?fmt(zwaarste.beschLok,1)+'%':'–'}</div><div class="l">Laagste lokale besch.</div></div>
    <div class="wv-kpi"><div class="v mono" style="color:var(--rws-blauw);font-size:16px">${zwaarste?esc(zwaarste.key)+' hm'+zwaarste.hmMin.toFixed(0):'–'}</div><div class="l">Zwaarste choke-point</div></div>
  </div></div>`;

  h+=`<div class="card"><h3>Choke-points op het Rijkswegennet ${tip('De grijze lijnen zijn de echte wegassen uit NWB-2025. Een gekleurd choke-point start bij de gekoppelde assetpositie en wordt alleen op dezelfde weg gesnapt als de afstand maximaal 250 meter is. Klik op een punt of een rij in de ranglijst om in te zoomen.')}</h3>
    <div class="choke-map-toolbar"><div class="map-keuze"><label>Gebied<select onchange="wijzigGebiedRegio(this.value)"><option value=""${!GEBIED_REGIO?' selected':''}>Heel Nederland</option>${regioCodes.map(v=>`<option value="${esc(v)}"${GEBIED_REGIO===v?' selected':''}>${esc(gebiedRegioNaam(v))}</option>`).join('')}</select></label></div>
    <div class="choke-map-buttons"><button type="button" onclick="wijzigGebiedZoom(-1)" aria-label="Uitzoomen">−</button><button type="button" onclick="wijzigGebiedZoom(1)" aria-label="Inzoomen">+</button><button type="button" onclick="herstelGebiedKaart()">Hele regio</button></div></div>
    ${renderRijkswegKaart(alle)}
    <div class="chart-legend"><span><i style="background:var(--groen)"></i>lokaal ≥95%</span><span><i style="background:var(--rws-geel)"></i>80-95%</span><span><i style="background:var(--oranje)"></i>50-80%</span><span><i style="background:var(--rood)"></i>&lt;50%</span></div>
  </div>`;

  const sorted=alle.slice().sort((a,b)=>{
    if(GEBIED_SORT==='dichtheid')return b.dichtheid-a.dichtheid;
    if(GEBIED_SORT==='aantal')return b.n-a.n;
    return a.beschLok-b.beschLok;
  });
  h+=`<div class="card"><h3>Ranglijst choke-points, ${esc(selectieNaam)}</h3>
    <div class="filterbar"><label>Sorteer</label><select id="gebSort" onchange="GEBIED_SORT=this.value;renderGebied()"><option value="ernst"${GEBIED_SORT==='ernst'?' selected':''}>Laagste lokale beschikbaarheid</option><option value="dichtheid"${GEBIED_SORT==='dichtheid'?' selected':''}>Hoogste dichtheid per km</option><option value="aantal"${GEBIED_SORT==='aantal'?' selected':''}>Meeste storingen</option></select></div>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Weg</th><th>Locatie (hm)</th><th class="num">Storingen</th><th class="num">Lengte</th><th class="num">Dichtheid</th><th class="num">Fataal</th><th class="num">Lokale besch.</th><th class="num">Wegdeel-gem.</th></tr></thead><tbody>`;
  if(!sorted.length)h+=`<tr><td colspan="8" class="muted">Geen choke-points met minimaal twee storingen in deze selectie.</td></tr>`;
  sorted.slice(0,40).forEach(c=>{
    const i=alle.indexOf(c);
    h+=`<tr class="choke-klikrij ${c.beschLok<80?'crit':''}"><td><button type="button" class="choke-kaart-link" onclick="selecteerChokeOpKaart(${i})" title="Toon dit choke-point op de kaart">${esc(c.key)}</button></td><td class="mono">${c.hmMin.toFixed(1)}${c.hmMax>c.hmMin?'-'+c.hmMax.toFixed(1):''}</td><td class="num">${c.n}</td><td class="num">${c.lengte.toFixed(1)} km</td><td class="num" style="font-weight:700">${c.dichtheid.toFixed(1)}/km</td><td class="num">${c.fatale||'–'}</td><td class="num" style="color:${chokeKleur(c.beschLok)};font-weight:700">${fmt(c.beschLok,1)}%</td><td class="num muted">${fmt(c.wd.besch,1)}%</td></tr>`;
  });
  h+=`</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:8px">Klik op een rij om het segment op de kaart te selecteren. Een groot verschil tussen lokale beschikbaarheid en het wegdeelgemiddelde betekent dat het knelpunt in het gemiddelde wordt gemaskeerd.</p></div>`;

  const wegenMetChoke=[...new Set(sorted.slice(0,60).map(c=>c.key))];
  const toonWegen=wegenMetChoke.slice(0,8).map(k=>STATE.wegdelen.find(w=>w.key===k&&(!GEBIED_REGIO||normAssetVc(w.vc)===GEBIED_REGIO))).filter(Boolean);
  h+=`<div class="card"><h3>Ingezoomd verloop per weg ${tip('Elke storing staat op zijn hm-positie. De hoogte geeft het aantal storingen weer. De kleur geeft de lokale beschikbaarheid aan.')}</h3>`;
  toonWegen.forEach(wd=>{
    const ergste=wd.chokes[0];h+=`<div class="weg-strip"><div class="ws-kop"><span class="mono" style="font-weight:700;color:var(--rws-blauw)">${esc(wd.key)}</span><span class="muted" style="font-size:11.5px">${wd.n} storingen · ${wd.wegLen.toFixed(0)} km · zwaarste: hm ${ergste.hmMin.toFixed(1)} (${ergste.n} storingen, lokaal ${fmt(ergste.beschLok,1)}%)</span></div>${chartWegStrip(wd)}</div>`;
  });
  if(!toonWegen.length)h+=`<p class="muted">Geen wegen met choke-points in deze selectie.</p>`;
  h+=`</div>`;

  if(zwaarste){
    h+=`<div class="card"><div class="dd-duiding" style="margin:0"><b>Duiding.</b> In ${esc(selectieNaam)} ligt het zwaarste choke-point op <b>${esc(zwaarste.key)} hm ${zwaarste.hmMin.toFixed(1)}</b>. Het omvat ${zwaarste.n} storingen over ${zwaarste.lengte.toFixed(1)} km, met een lokale beschikbaarheid van <b>${fmt(zwaarste.beschLok,1)}%</b>. Het wegdeelgemiddelde is ${fmt(zwaarste.wd.besch,1)}%. ${ernstig>0?`Er zijn <b>${ernstig} ernstige choke-points</b> met minder dan 80% lokale beschikbaarheid.`:'Er zijn geen ernstige lokale knelpunten in deze selectie.'}</div></div>`;
  }
  document.getElementById('tab-gebied').innerHTML=h;
}

/* ══════════════════════════════════════════════════════════════
   RAPPORT PER REGIO
   ══════════════════════════════════════════════════════════════ */
let RAPPORT_REGIO_SELECTIE='';
let RAPPORT_REGIO_MODUS='vc';
function pctRegio(n,d){return d?Math.max(0,Math.min(100,n/d*100)):0;}
function rapportRegioNaam(vc){
  const k=normAssetVc(vc);
  return (typeof gebiedRegioNaam==='function')?gebiedRegioNaam(k):(k||'Onbekend');
}
function rapportModus(){return RAPPORT_REGIO_MODUS==='rd'?'rd':'vc';}
function rapportModusLabel(){return rapportModus()==='rd'?'RD':'verkeerscentrale';}
function rapportBestuurKey(bron){
  const modus=rapportModus();
  if(modus==='rd')return 'rd|'+rapportRdWaarde(bron);
  return 'vc|'+(normAssetVc(bron&&bron.vc)||'geen VC');
}
function rapportBestuurMaak(m,bron){
  const k=rapportBestuurKey(bron),parts=k.split('|'),modus=parts[0],waarde=parts.slice(1).join('|');
  if(!m.has(k))m.set(k,{key:k,modus,groepWaarde:waarde,rd:'',district:'',vc:'',naam:waarde,rdSet:new Set(),districtSet:new Set(),vcSet:new Set(),aannemers:new Set(),contracten:new Set(),leveranciers:new Set(),districtBronnen:{},assets:0,referenties:0,typen:{},bouwjaar:0,eol:0,model:0,modelGeneriek:0,leeftijden:[],liveStoringen:0,liveWegdelen:0,dienstSum:{},dienstW:{},liveMin:null,liveZwakste:'',mcN:0,mcW:0,mcP50:0,mcP5:0,mcP95:0,mcWorst:null,mcWorstKey:'',dripN:0,dripFaalSom:0,dripEvents:0,werkIds:new Set(),werkAssets:new Set(),uRouteIds:new Set(),uRouteAssets:new Set()});
  const r=m.get(k);
  const rd=rapportRdWaarde(bron);
  const vc=normAssetVc(bron&&bron.vc);
  if(rd&&rd!==ONBEKEND_RD&&!r.rd)r.rd=rd;
  if(vc){voegSet(r.vcSet,vc);if(!r.vc)r.vc=vc;}
  return r;
}
function rapportVoegBestuurEnContract(r,bron){
  if(!r||!bron)return;
  const rd=rapportRdWaarde(bron);
  if(rd&&rd!==ONBEKEND_RD)voegSet(r.rdSet,rd);
  if(districtBekend(bron.district))voegSet(r.districtSet,bron.district);
  const db=bron.districtBron||(districtBekend(bron.district)?'bron':'ontbreekt');
  r.districtBronnen[db]=(r.districtBronnen[db]||0)+1;
  voegSet(r.vcSet,normAssetVc(bron.vc));
  voegSet(r.aannemers,bron.aannemer);
  voegSet(r.contracten,bron.contract);
  voegSet(r.leveranciers,bron.leverancier||bron.fabrikant);
}
function rapportRegioBasisMap(){
  const m=new Map(),maak=bron=>rapportBestuurMaak(m,bron||{});
  if(ASSET_REGISTER_STATE){
    ASSET_REGISTER_STATE.assets.forEach(a=>{
      const r=maak(a);r.referenties++;
      rapportVoegBestuurEnContract(r,a);
      if(a.prognoseActief===false)return;
      r.assets++;r.typen[a.tp]=(r.typen[a.tp]||0)+1;
      if(a.bouwjaar){r.bouwjaar++;r.leeftijden.push(new Date().getFullYear()-a.bouwjaar);}
      if(a.eol&&a.eol.expliciet)r.eol++;
      if(a.modelLevensduur)r.model++;
      if(a.modelLevensduurSoort==='generiek')r.modelGeneriek++;
    });
  }
  if(STATE&&STATE.wegdelen){
    STATE.wegdelen.forEach(w=>{
      const r=maak(w),gewicht=w.N||1;r.liveStoringen+=w.n||0;r.liveWegdelen++;
      rapportVoegBestuurEnContract(r,w);
      DIENSTEN.forEach(d=>{
        const v=w.diensten&&w.diensten[d.id]?w.diensten[d.id].besch:null;
        if(v==null)return;
        r.dienstSum[d.id]=(r.dienstSum[d.id]||0)+v*gewicht;r.dienstW[d.id]=(r.dienstW[d.id]||0)+gewicht;
        if(r.liveMin==null||v<r.liveMin){r.liveMin=v;r.liveZwakste=d.naam.replace(/&amp;/g,'&');}
      });
    });
  }
  const regioMcBron=(typeof mcRegioWegRes==='function')?mcRegioWegRes():[];
  if(regioMcBron.length){
    regioMcBron.forEach(x=>{
      if(!x||!x.mc||!x.wd)return;
      const r=maak(x.wd),gewicht=x.wd.N||1,mc=x.mc.besch;
      rapportVoegBestuurEnContract(r,x.wd);
      r.mcN++;r.mcW+=gewicht;r.mcP50+=mc.p50*gewicht;r.mcP5+=mc.p5*gewicht;r.mcP95+=mc.p95*gewicht;
      if(r.mcWorst==null||mc.p50<r.mcWorst){r.mcWorst=mc.p50;r.mcWorstKey=x.wd.key;}
    });
  }
  if(DRIP_MC&&DRIP_MC.perDrip){
    DRIP_MC.perDrip.forEach(p=>{
      const d=p.d||{},r=maak(d);
      rapportVoegBestuurEnContract(r,d);
      r.dripN++;r.dripFaalSom+=p.faalPeriode||0;r.dripEvents+=p.gemEvents||0;
    });
  }
  if(WERK_STATE&&WERK_STATE.werken){
    WERK_STATE.werken.forEach(w=>{
      const keys=w.assetKeys&&w.assetKeys.length?w.assetKeys:((ASSET_INDEX&&ASSET_INDEX.byRoad&&w.weg)?(ASSET_INDEX.byRoad.get(w.weg)||[]).slice(0,80).map(a=>a.key):[]);
      const assets=keys.map(k=>assetUitKey(k)).filter(Boolean);
      const bronnen=assets.length?uniekeAssets(assets):[w];
      bronnen.forEach(bron=>{const r=maak(bron);rapportVoegBestuurEnContract(r,bron);r.werkIds.add(w.id||werkLocatieLabel(w));keys.forEach(k=>r.werkAssets.add(k));});
    });
  }
  if(U_ROUTE_STATE&&U_ROUTE_STATE.routes){
    U_ROUTE_STATE.routes.forEach(route=>{
      const inzet=routeInzetAssets(route),assets=uniekeAssets([...inzet.voor,...inzet.na,...inzet.langs]);
      const bronnen=assets.length?assets:[route];
      bronnen.forEach(bron=>{const r=maak(bron);rapportVoegBestuurEnContract(r,bron);r.uRouteIds.add(route.uRoute||route.id||route.relationId);assets.forEach(a=>r.uRouteAssets.add(a.key));});
    });
  }
  return m;
}
function rapportRegioRows(){
  const rows=[...rapportRegioBasisMap().values()].filter(r=>r.assets||r.liveStoringen||r.mcN||r.dripN||r.werkIds.size||r.uRouteIds.size);
  rows.forEach(r=>{
    r.bouwjaarPct=pctRegio(r.bouwjaar,r.assets);r.eolPct=pctRegio(r.eol,r.assets);r.modelPct=pctRegio(r.model,r.assets);
    r.generiekPct=pctRegio(r.modelGeneriek,r.assets);
    r.leeftijdMed=r.leeftijden.length?r.leeftijden.sort((a,b)=>a-b)[Math.floor(r.leeftijden.length/2)]:null;
    if(r.mcW){r.mcP50/=r.mcW;r.mcP5/=r.mcW;r.mcP95/=r.mcW;}
    r.dripFaalGem=r.dripN?r.dripFaalSom/r.dripN:null;
    DIENSTEN.forEach(d=>{r['live_'+d.id]=r.dienstW[d.id]?r.dienstSum[d.id]/r.dienstW[d.id]:null;});
    r.rdLabel=rapportModus()==='rd'?r.groepWaarde:(setLabel(r.rdSet,2)||ONBEKEND_RD);
    r.districtLabel=setLabel(r.districtSet,4)||ONBEKEND_DISTRICT;
    const db=r.districtBronnen||{},afgeleid=Object.entries(db).filter(([k])=>/^afgeleid/.test(k)).reduce((s,x)=>s+x[1],0),bron=db.bron||0,ontbreekt=(db.ontbreekt||0)+(db.dubbelzinnig||0);
    r.districtBronLabel=bron||afgeleid||ontbreekt?`${bron} bron, ${afgeleid} afgeleid, ${ontbreekt} onbekend`:'districtbron niet beoordeeld';
    r.vcLabel=setLabel(r.vcSet,4)||'geen VC';
    r.scopeLabel=rapportModus()==='rd'?r.rdLabel:r.vcLabel;
    r.scopeDetail=rapportModus()==='rd'?`VC-dekking: ${r.vcLabel}`:`RD-dekking: ${r.rdLabel}`;
    r.aannemerLabel=setLabel(r.aannemers,3)||'niet geladen';
    r.contractLabel=setLabel(r.contracten,3)||'niet geladen';
    r.leverancierLabel=setLabel(r.leveranciers,3)||'niet geladen';
  });
  return rows.sort((a,b)=>{
    return a.scopeLabel.localeCompare(b.scopeLabel)||b.assets-a.assets;
  });
}
function rapportPrestatieScore(r){
  let s=100;
  if(r.liveMin!=null)s-=Math.max(0,99-r.liveMin)*8;
  if(r.mcW)s-=Math.max(0,(RULES.cfg.kpi_msi||99.5)-r.mcP50)*7;
  if(r.dripFaalGem!=null)s-=Math.min(18,r.dripFaalGem*35);
  if(r.assets&&r.bouwjaarPct<70)s-=10;
  if(r.assets&&r.modelPct<70)s-=10;
  return Math.max(0,Math.min(100,s));
}
function rapportRdBenchmarkRows(rows){
  const m=new Map(),maak=naam=>{
    const k=naam||ONBEKEND_RD;
    if(!m.has(k))m.set(k,{rd:k,assets:0,liveStoringen:0,vcSet:new Set(),districtSet:new Set(),aannemers:new Set(),contracten:new Set(),leveranciers:new Set(),dienstSum:{},dienstW:{},liveMin:null,liveZwakste:'',mcW:0,mcP50:0,dripN:0,dripFaalSom:0,bouwjaar:0,model:0,eol:0});
    return m.get(k);
  };
  rows.forEach(r=>{
    const rd=r.rdLabel||ONBEKEND_RD, rr=maak(rd);
    rr.assets+=r.assets;rr.liveStoringen+=r.liveStoringen;rr.bouwjaar+=r.bouwjaar;rr.model+=r.model;rr.eol+=r.eol;
    (r.vcSet||new Set()).forEach(x=>voegSet(rr.vcSet,x));(r.districtSet||new Set()).forEach(x=>voegSet(rr.districtSet,x));
    (r.aannemers||new Set()).forEach(x=>voegSet(rr.aannemers,x));(r.contracten||new Set()).forEach(x=>voegSet(rr.contracten,x));(r.leveranciers||new Set()).forEach(x=>voegSet(rr.leveranciers,x));
    DIENSTEN.forEach(d=>{rr.dienstSum[d.id]=(rr.dienstSum[d.id]||0)+(r.dienstSum[d.id]||0);rr.dienstW[d.id]=(rr.dienstW[d.id]||0)+(r.dienstW[d.id]||0);});
    if(r.liveMin!=null&&(rr.liveMin==null||r.liveMin<rr.liveMin)){rr.liveMin=r.liveMin;rr.liveZwakste=r.liveZwakste;}
    if(r.mcW){rr.mcP50+=r.mcP50*r.mcW;rr.mcW+=r.mcW;}
    if(r.dripN){rr.dripN+=r.dripN;rr.dripFaalSom+=r.dripFaalSom;}
  });
  const out=[...m.values()].map(r=>{
    r.bouwjaarPct=pctRegio(r.bouwjaar,r.assets);r.modelPct=pctRegio(r.model,r.assets);r.eolPct=pctRegio(r.eol,r.assets);
    if(r.mcW)r.mcP50/=r.mcW;r.dripFaalGem=r.dripN?r.dripFaalSom/r.dripN:null;
    DIENSTEN.forEach(d=>{r['live_'+d.id]=r.dienstW[d.id]?r.dienstSum[d.id]/r.dienstW[d.id]:null;});
    r.score=rapportPrestatieScore(r);
    return r;
  }).sort((a,b)=>b.score-a.score||b.assets-a.assets);
  out.forEach((r,i)=>r.rang=i+1);
  const metLive=out.filter(r=>r.liveMin!=null),gemLive=metLive.length?metLive.reduce((s,r)=>s+r.liveMin,0)/metLive.length:null;
  const metMc=out.filter(r=>r.mcW),gemMc=metMc.length?metMc.reduce((s,r)=>s+r.mcP50,0)/metMc.length:null;
  out.forEach(r=>{r.liveDelta=gemLive!=null&&r.liveMin!=null?r.liveMin-gemLive:null;r.mcDelta=gemMc!=null&&r.mcW?r.mcP50-gemMc:null;});
  return out;
}
function rapportRdBenchmarkHtml(rows){
  const rdRows=rapportRdBenchmarkRows(rows);
  if(!rdRows.length)return '';
  return `<div class="card"><h3>RD-prestatie ten opzichte van andere RD's</h3>
    <p class="muted" style="font-size:11.5px;margin:-6px 0 10px">RD is de bestuurlijke laag. Districten hangen daaronder. VC's blijven apart zichtbaar, omdat verkeerscentrales niet altijd een-op-een met RD's samenvallen.</p>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th class="num">Rang</th><th>RD</th><th>Districten</th><th>VC-dekking</th><th class="num">Assets</th><th>Live prestatie</th><th>MSI-prognose</th><th>Datakwaliteit</th><th>Aannemer / contract</th></tr></thead><tbody>
    ${rdRows.map(r=>{
      const live=r.liveMin!=null?`${esc(r.liveZwakste||'laagste dienst')} ${fmt(r.liveMin,2)}%${r.liveDelta!=null?`<br><span class="muted">${r.liveDelta>=0?'+':''}${fmt(r.liveDelta,2)} pctpunt tov RD-gem.</span>`:''}`:'niet geladen';
      const msi=r.mcW?`p50 ${fmt(r.mcP50,2)}%${r.mcDelta!=null?`<br><span class="muted">${r.mcDelta>=0?'+':''}${fmt(r.mcDelta,2)} pctpunt tov RD-gem.</span>`:''}`:'niet berekend';
      return `<tr><td class="num">${r.rang}</td><td><b>${esc(r.rd)}</b><br><span class="muted">score ${fmt(r.score,0)}</span></td><td>${esc(setLabel(r.districtSet,4)||ONBEKEND_DISTRICT)}</td><td>${esc(setLabel(r.vcSet,4)||'geen VC')}</td><td class="num">${r.assets.toLocaleString('nl-NL')}</td><td>${live}</td><td>${msi}</td><td>Bouwjaar ${fmt(r.bouwjaarPct,0)}%, levensduur ${fmt(r.modelPct,0)}%, EOL ${fmt(r.eolPct,0)}%</td><td>${esc(setLabel(r.aannemers,2)||'niet geladen')}<br><span class="muted">${esc(setLabel(r.contracten,2)||'contract niet geladen')}</span></td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}
function rapportTypeVerdelingHtml(r){
  const items=Object.entries(r.typen).sort((a,b)=>b[1]-a[1]);
  if(!items.length)return '<span class="muted">geen actief areaal</span>';
  return items.map(([tp,n])=>`<span class="chip"><b>${esc(tp)}</b> ${n.toLocaleString('nl-NL')}</span>`).join(' ');
}
function rapportAandacht(r){
  const a=[];
  if(r.assets&&!r.bouwjaarPct)a.push('geen bouwjaren');
  else if(r.assets&&r.bouwjaarPct<70)a.push('lage bouwjaardekking');
  if(r.assets&&r.modelPct<70)a.push('levensduur aanvullen');
  if(r.generiekPct>30)a.push('veel generieke levensduur');
  if(r.liveMin!=null&&r.liveMin<99)a.push('live dienst onder druk');
  if(r.mcW&&r.mcP50<(RULES.cfg.kpi_msi||99.5))a.push('MSI-prognose onder norm');
  if(r.dripFaalGem!=null&&r.dripFaalGem>.3)a.push('DRIP-faalkans hoog');
  if(r.werkIds.size&&!r.werkAssets.size)a.push('werk alleen op wegniveau');
  return a.length?a.slice(0,3).join('; '):'geen direct aandachtspunt uit geladen data';
}
function rapportRegioRisicoScore(r){
  let s=0;
  if(r.liveMin!=null)s+=Math.max(0,99-r.liveMin)*6;
  if(r.mcW)s+=Math.max(0,(RULES.cfg.kpi_msi||99.5)-r.mcP50)*8;
  if(r.dripFaalGem!=null)s+=r.dripFaalGem*50;
  if(r.assets&&r.bouwjaarPct<70)s+=18;
  if(r.assets&&r.modelPct<70)s+=14;
  if(r.generiekPct>30)s+=8;
  s+=Math.min(15,r.werkIds.size*2+r.uRouteIds.size);
  return s;
}
function rapportRegioSelectie(rows){
  if(!rows.length)return null;
  const gevraagde=String(RAPPORT_REGIO_SELECTIE||'');
  if(gevraagde){
    const hit=rows.find(r=>r.key===gevraagde);
    if(hit)return hit;
  }
  return rows.slice().sort((a,b)=>rapportRegioRisicoScore(b)-rapportRegioRisicoScore(a)||b.assets-a.assets)[0]||rows[0];
}
function wijzigRapportRegioModus(v){
  RAPPORT_REGIO_MODUS=v==='rd'?'rd':'vc';
  RAPPORT_REGIO_SELECTIE='';
  renderRapport();
}
function wijzigRapportRegio(v){
  RAPPORT_REGIO_SELECTIE=String(v||'');
  renderRapport();
}
function openGebiedVoorRegio(vc){
  GEBIED_REGIO=normAssetVc(vc)||'';
  GEBIED_KAART_ZOOM=1;GEBIED_KAART_FOCUS=null;GEBIED_KAART_SELECTIE='';
  if(tabToegestaan('gebied'))renderGebied();
  toonTab('gebied');
  const el=document.getElementById('tab-gebied');if(el)el.scrollIntoView({block:'start',behavior:'smooth'});
}
function rapportPctLabel(v){return v==null?'niet geladen':fmt(v,1)+'%';}
function rapportRegioDuiding(r){
  if(!r)return 'Geen regiogegevens beschikbaar.';
  const zinnen=[];
  if(rapportModus()==='rd')zinnen.push(`RD ${r.scopeLabel} heeft ${r.assets.toLocaleString('nl-NL')} actieve assets in het rapport. VC-dekking uit de data: ${r.vcLabel}. Districten: ${r.districtLabel}.`);
  else zinnen.push(`VC ${r.scopeLabel} heeft ${r.assets.toLocaleString('nl-NL')} actieve assets in het rapport. RD-dekking uit de data: ${r.rdLabel}. Districten: ${r.districtLabel}.`);
  zinnen.push(`Datakwaliteit: bouwjaar ${rapportPctLabel(r.bouwjaarPct)}, levensduurmodel ${rapportPctLabel(r.modelPct)}, expliciete EOL ${rapportPctLabel(r.eolPct)}. Districtbron: ${r.districtBronLabel}.`);
  if(r.liveMin!=null)zinnen.push(`Live staat ${r.liveZwakste} het laagst met ${fmt(r.liveMin,2)}%.`);
  else zinnen.push('Live open storingen zijn voor deze regio nog niet geladen of niet gekoppeld.');
  if(r.mcW)zinnen.push(`MSI-prognose p50 is ${fmt(r.mcP50,2)}%, met als zwakste wegdeel ${r.mcWorstKey||'onbekend'}.`);
  else zinnen.push('MSI-prognose is voor deze regio nog niet gedraaid.');
  if(r.dripFaalGem!=null)zinnen.push(`DRIP-prognose: ${r.dripN} assets, gemiddelde faalkans ${fmt(r.dripFaalGem*100,0)}%.`);
  if(r.werkIds.size||r.uRouteIds.size)zinnen.push(`Operationele context: ${r.werkIds.size} werkzaamheden en ${r.uRouteIds.size} U-routes regionaal gekoppeld.`);
  return zinnen.join(' ');
}
function rapportRegioDienstenHtml(r){
  const diensten=DIENSTEN.map(d=>({d,v:r['live_'+d.id]})).filter(x=>x.v!=null).sort((a,b)=>(a.v-a.d.norm)-(b.v-b.d.norm));
  if(!diensten.length)return '<p>Geen live dienstwaarden voor deze regio.</p>';
  return `<ul class="regio-focus-list">${diensten.slice(0,4).map(x=>`<li><b>${x.d.naam.replace(/&amp;/g,'&')}</b>: <span style="color:${beschKleur(x.v,x.d.norm)};font-weight:700">${fmt(x.v,2)}%</span>, norm ${fmt(x.d.norm,1)}%</li>`).join('')}</ul>`;
}
function rapportRegioLiveWegdelen(r){
  if(!STATE||!STATE.wegdelen)return [];
  return STATE.wegdelen.filter(w=>rapportBestuurKey(w)===r.key).slice().sort((a,b)=>a.besch-b.besch||b.n-a.n).slice(0,5);
}
function rapportRegioMcWegdelen(r){
  const bron=(typeof mcRegioWegRes==='function')?mcRegioWegRes():[];
  if(!bron.length)return [];
  return bron.filter(x=>x&&x.wd&&rapportBestuurKey(x.wd)===r.key&&x.mc&&x.mc.besch).slice().sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50).slice(0,5);
}
function rapportRegioWerkRaakt(w,r){
  if(!w)return false;
  const keys=w.assetKeys&&w.assetKeys.length?w.assetKeys:[];
  if(keys.some(k=>{const a=assetUitKey(k);return a&&rapportBestuurKey(a)===r.key;}))return true;
  if(!keys.length&&w.weg&&ASSET_INDEX&&ASSET_INDEX.byRoad){
    return (ASSET_INDEX.byRoad.get(w.weg)||[]).some(a=>rapportBestuurKey(a)===r.key);
  }
  return false;
}
function rapportRegioWerkItems(r){
  if(!WERK_STATE||!WERK_STATE.werken)return [];
  return WERK_STATE.werken.filter(w=>rapportRegioWerkRaakt(w,r)).slice().sort((a,b)=>(a.startMs||Infinity)-(b.startMs||Infinity)).slice(0,5);
}
function rapportRegioRouteItems(r){
  if(!U_ROUTE_STATE||!U_ROUTE_STATE.routes)return [];
  const uit=[];
  U_ROUTE_STATE.routes.forEach(route=>{
    const inzet=routeInzetAssets(route),assets=uniekeAssets([...inzet.voor,...inzet.na,...inzet.langs]);
    const raakt=assets.some(a=>rapportBestuurKey(a)===r.key)||(!assets.length&&rapportBestuurKey(route)===r.key);
    if(raakt)uit.push({route,inzet,assets});
  });
  return uit.slice(0,5);
}
function rapportRegioLijstenHtml(r){
  const live=rapportRegioLiveWegdelen(r),mc=rapportRegioMcWegdelen(r),werk=rapportRegioWerkItems(r),routes=rapportRegioRouteItems(r);
  const liveHtml=live.length?`<ul class="regio-focus-list">${live.map(w=>{
    const diensten=DIENSTEN.map(d=>({d,v:w.diensten&&w.diensten[d.id]?w.diensten[d.id].besch:null})).filter(x=>x.v!=null).sort((a,b)=>(a.v-a.d.norm)-(b.v-b.d.norm));
    const zw=diensten[0];
    return `<li><b>${esc(w.key)}</b>: ${w.n} storingen, ${fmt(w.besch,2)}% areaal, zwakste ${zw?esc(zw.d.naam.replace(/&amp;/g,'&'))+' '+fmt(zw.v,2)+'%':'onbekend'}</li>`;
  }).join('')}</ul>`:'<p>Geen live wegdelen voor deze regio.</p>';
  const mcHtml=mc.length?`<ul class="regio-focus-list">${mc.map(x=>`<li><b>${esc(x.wd.key)}</b>: p50 ${fmt(x.mc.besch.p50,2)}%, band ${fmt(x.mc.besch.p5,2)}-${fmt(x.mc.besch.p95,2)}%, leeftijd ${fmt(x.mc.leeftijdFactor||1,2)}x</li>`).join('')}</ul>`:'<p>Geen MSI-prognosepunten voor deze regio.</p>';
  const werkHtml=werk.length?`<ul class="regio-focus-list">${werk.map(w=>`<li><b>${esc(w.id||w.weg)}</b>: ${esc(werkLocatieLabel(w))}, ${esc(werkPeriodeLabel(w))}${w.hinder?`, ${esc(w.hinder)}`:''}</li>`).join('')}</ul>`:'<p>Geen werkzaamheden regionaal gekoppeld.</p>';
  const routeHtml=routes.length?`<ul class="regio-focus-list">${routes.map(x=>`<li><b>${esc(routeNaamLabel(x.route))}</b>: ${esc(routeLocatieLabel(x.route))}, inzetassets ${((x.inzet.voorN||0)+(x.inzet.naN||0)+(x.inzet.langsN||0)).toLocaleString('nl-NL')}</li>`).join('')}</ul>`:'<p>Geen U-routes regionaal gekoppeld.</p>';
  return `<div class="regio-focus-grid">
    <div class="regio-focus-blok"><h4>Zwakste live wegdelen</h4>${liveHtml}</div>
    <div class="regio-focus-blok"><h4>Zwakste prognosepunten</h4>${mcHtml}</div>
    <div class="regio-focus-blok"><h4>Werkzaamheden</h4>${werkHtml}</div>
    <div class="regio-focus-blok"><h4>U-routes</h4>${routeHtml}</div>
  </div>`;
}
function rapportRegioFocusHtml(rows){
  const r=rapportRegioSelectie(rows);
  if(!r)return `<div class="card"><h3>RD/VC-focus</h3><p class="muted">Geen regiogegevens beschikbaar. Laad eerst All Assets.</p></div>`;
  const modus=rapportModus(),modusLabel=rapportModusLabel();
  const opties=rows.map(x=>{
    const detail=modus==='rd'?`VC ${x.vcLabel} · districten ${x.districtLabel}`:`RD ${x.rdLabel} · districten ${x.districtLabel}`;
    return `<option value="${esc(x.key)}"${x.key===r.key?' selected':''}>${esc(x.scopeLabel)} · ${esc(detail)}</option>`;
  }).join('');
  const aandacht=rapportAandacht(r);
  const gebiedActief=tabToegestaan('gebied');
  const kaartVc=modus==='vc'?r.vc:((r.vcSet&&r.vcSet.size===1)?[...r.vcSet][0]:'');
  return `<div class="card"><h3>Regiofocus per ${esc(modusLabel)}: ${esc(r.scopeLabel)} <span class="badge">${esc(r.districtLabel)}</span></h3>
    <div class="regio-keuze">
      <label>Groepering<select onchange="wijzigRapportRegioModus(this.value)"><option value="vc"${modus==='vc'?' selected':''}>Verkeerscentrale</option><option value="rd"${modus==='rd'?' selected':''}>RD</option></select></label>
      <label>Selectie<select onchange="wijzigRapportRegio(this.value)">${opties}</select></label>
      <button type="button" class="tb-btn re-sec" onclick="openGebiedVoorRegio('${esc(kaartVc||'')}')" ${gebiedActief&&kaartVc?'':'disabled'}>Toon VC op gebiedskaart</button>
      <span class="muted" style="font-size:11.5px">${gebiedActief?'Gebiedskaart gebruikt de VC-uitsnede.':'Gebiedskaart opent zodra live storingen, U-routes en werkzaamheden geladen zijn.'}</span>
    </div>
    <div class="grid4" style="margin-top:12px">
      <div class="kpi"><div class="k-val">${r.assets.toLocaleString('nl-NL')}</div><div class="k-lab">Actieve assets</div></div>
      <div class="kpi"><div class="k-val">${r.liveMin!=null?fmt(r.liveMin,1)+'%':'–'}</div><div class="k-lab">Laagste live dienst</div></div>
      <div class="kpi"><div class="k-val">${r.mcW?fmt(r.mcP50,1)+'%':'–'}</div><div class="k-lab">MSI-prognose p50</div></div>
      <div class="kpi"><div class="k-val">${(r.werkIds.size+r.uRouteIds.size).toLocaleString('nl-NL')}</div><div class="k-lab">Werk/U-route context</div></div>
    </div>
    <p class="muted" style="font-size:11.5px;margin-top:9px"><b>Duiding:</b> ${esc(rapportRegioDuiding(r))}</p>
    <div class="regio-focus-grid">
      <div class="regio-focus-blok"><h4>Aandacht</h4><p>${esc(aandacht)}</p></div>
      <div class="regio-focus-blok"><h4>Live diensten</h4>${rapportRegioDienstenHtml(r)}</div>
      <div class="regio-focus-blok"><h4>Districtduiding</h4><p>${esc(r.districtLabel)}. Bron: ${esc(r.districtBronLabel)}. ${esc(r.scopeDetail)}.</p></div>
      <div class="regio-focus-blok"><h4>Contractcontext</h4><p>Aannemer: ${esc(r.aannemerLabel)}. Contract: ${esc(r.contractLabel)}. Leverancier: ${esc(r.leverancierLabel)}.</p></div>
    </div>
    ${rapportRegioLijstenHtml(r)}
  </div>`;
}
function chartRapportRegio(rows){
  const data=rows.filter(r=>r.assets||r.liveMin!=null||r.mcW).slice(0,8);
  if(!data.length)return '<p class="muted">Geen regiowaarden om te tekenen.</p>';
  const alle=data.flatMap(r=>[r.liveMin,r.mcW?r.mcP50:null]).filter(v=>v!=null);
  const min=Math.max(0,Math.floor((Math.min(...alle,99)-.5)*10)/10),max=100;
  const W=680,H=260,padL=72,padR=18,padT=18,padB=48,groepW=(W-padL-padR)/data.length,barW=Math.min(18,(groepW-14)/2);
  const sy=v=>padT+(1-(v-min)/(max-min))*(H-padT-padB);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for(let g=min;g<=max;g+=2){const y=sy(g);s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--panel)"/><text x="${padL-6}" y="${y+3}" text-anchor="end" class="ax">${g}</text>`;}
  data.forEach((r,i)=>{
    const x0=padL+i*groepW+groepW/2-barW-2;
    if(r.liveMin!=null){const y=sy(Math.max(min,r.liveMin));s+=`<rect x="${x0}" y="${y}" width="${barW}" height="${H-padB-y}" fill="var(--oranje)"><title>${esc(r.scopeLabel+' · '+r.districtLabel)} live laagste dienst ${fmt(r.liveMin,2)}%</title></rect>`;}
    if(r.mcW){const y=sy(Math.max(min,r.mcP50));s+=`<rect x="${x0+barW+4}" y="${y}" width="${barW}" height="${H-padB-y}" fill="var(--rws-blauw-mid)"><title>${esc(r.scopeLabel+' · '+r.districtLabel)} MSI-prognose p50 ${fmt(r.mcP50,2)}%</title></rect>`;}
    s+=`<text x="${padL+i*groepW+groepW/2}" y="${H-padB+16}" text-anchor="middle" class="lbl">${esc(r.scopeLabel)}</text>`;
  });
  s+=`</svg>`;
  return s;
}
function renderRapport(){
  const host=document.getElementById('tab-rapport');
  if(!host)return;
  if(!ASSET_REGISTER_STATE){host.innerHTML=blokkadeHtml('rapport');return;}
  herberekenRegisterDekking();
  const rows=rapportRegioRows(),totaalAssets=rows.reduce((s,r)=>s+r.assets,0),totaalLive=rows.reduce((s,r)=>s+r.liveStoringen,0),totaalWerk=rows.reduce((s,r)=>s+r.werkIds.size,0),totaalRoute=rows.reduce((s,r)=>s+r.uRouteAssets.size,0);
  const mcScope=MC_RESULT?`${MC_RESULT.scope==='alle'?'alle gesimuleerde wegdelen':'top-12 getoond'} · ${MC_RESULT.periodeLabel||MC_RESULT.horizon+' jaar'}${typeof mcRegioScopeLabel==='function'?` · ${mcRegioScopeLabel()}`:''}`:'nog niet gedraaid';
  let h=rapportRegioFocusHtml(rows);
  h+=`<div class="card"><h3>Regiostatus per ${esc(rapportModusLabel())}</h3>
    <p class="muted" style="font-size:12px;margin:-6px 0 12px">Deze tab groepeert op ${esc(rapportModusLabel())}. Districten worden als duiding getoond. Zo voorkom je dat ontbrekende districten de regioresultaten opsplitsen in losse onbekend-regels.</p>
    <div class="grid4">
      <div class="kpi"><div class="k-val">${totaalAssets.toLocaleString('nl-NL')}</div><div class="k-lab">Actieve assets in rapport</div></div>
      <div class="kpi"><div class="k-val">${totaalLive.toLocaleString('nl-NL')}</div><div class="k-lab">Live open storingen</div></div>
      <div class="kpi"><div class="k-val">${MC_RESULT?MC_RESULT.wegRes.length.toLocaleString('nl-NL'):'0'}</div><div class="k-lab">MSI-prognose wegdelen</div></div>
      <div class="kpi"><div class="k-val">${totaalWerk.toLocaleString('nl-NL')}</div><div class="k-lab">Werkcontext regio-koppelingen</div></div>
    </div>
    <p class="muted" style="font-size:11.5px;margin-top:9px"><b>Prognosebasis:</b> ${esc(mcScope)}. ${DRIP_MC?`DRIP-prognose is gedraaid voor ${DRIP_MC.perDrip.length.toLocaleString('nl-NL')} DRIPs.`:'DRIP-prognose is nog niet gedraaid.'} ${U_ROUTE_STATE?`${totaalRoute.toLocaleString('nl-NL')} U-route-assets zijn regionaal te duiden.`:'U-routes ontbreken nog.'}</p>
  </div>`;
  if(rapportModus()==='rd')h+=rapportRdBenchmarkHtml(rows);
  h+=`<div class="card"><h3>Vergelijking per ${esc(rapportModusLabel())}</h3>
    <div class="chart-wrap">${chartRapportRegio(rows)}</div>
    <div class="chart-legend"><span><i style="background:var(--oranje)"></i>laagste live dienstbeschikbaarheid</span><span><i style="background:var(--rws-blauw-mid)"></i>MSI-prognose p50</span></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">De grafiek toont alleen groepen waar live of prognosewaarden beschikbaar zijn. Als een groep ontbreekt, is er wel areaal maar nog geen berekend live of prognosepunt.</p>
  </div>`;
  h+=`<div class="card"><h3>Detailtabel per ${esc(rapportModusLabel())}</h3><div class="tbl-scroll"><table class="tbl"><thead><tr>
    <th>Hoofdgroep</th><th>RD</th><th>VC</th><th>Districten</th><th class="num">Actief areaal</th><th>Typeverdeling</th><th>Aannemer / contract / leverancier</th><th class="num">Bouwjaar</th><th class="num">Levensduurmodel</th><th class="num">Expliciete EOL</th><th class="num">Med. leeftijd</th><th class="num">Live storingen</th><th>Laagste live dienst</th><th>MSI-prognose</th><th>DRIP-prognose</th><th>Werk en U-routes</th><th>Aandacht</th>
  </tr></thead><tbody>`;
  rows.forEach(r=>{
    const live=r.liveMin!=null?`${esc(r.liveZwakste)} ${fmt(r.liveMin,2)}%`:'—';
    const msi=r.mcW?`p50 ${fmt(r.mcP50,2)}%<br><span class="muted">band ${fmt(r.mcP5,2)}-${fmt(r.mcP95,2)}%, zwakste ${esc(r.mcWorstKey||'—')}</span>`:'niet berekend';
    const drip=r.dripFaalGem!=null?`${r.dripN} assets<br><span class="muted">gem. faalkans ${fmt(r.dripFaalGem*100,0)}%, events ${fmt(r.dripEvents,1)}</span>`:'niet berekend';
    const ctx=`werk ${r.werkIds.size}<br><span class="muted">U-route assets ${r.uRouteAssets.size}</span>`;
    h+=`<tr>
      <td><b>${esc(r.scopeLabel)}</b><br><span class="muted">${esc(rapportModusLabel())}</span></td>
      <td><b>${esc(r.rdLabel)}</b></td>
      <td><b>${esc(r.vcLabel)}</b><br><span class="muted">VC-dekking uit assets</span></td>
      <td>${esc(r.districtLabel)}<br><span class="muted">${esc(r.districtBronLabel)}</span></td>
      <td class="num">${r.assets.toLocaleString('nl-NL')}</td>
      <td>${rapportTypeVerdelingHtml(r)}</td>
      <td>${esc(r.aannemerLabel)}<br><span class="muted">${esc(r.contractLabel)} · ${esc(r.leverancierLabel)}</span></td>
      <td class="num">${fmt(r.bouwjaarPct,0)}%</td>
      <td class="num">${fmt(r.modelPct,0)}%${r.generiekPct?`<br><span class="muted">${fmt(r.generiekPct,0)}% generiek</span>`:''}</td>
      <td class="num">${fmt(r.eolPct,0)}%</td>
      <td class="num">${r.leeftijdMed!=null?fmt(r.leeftijdMed,0)+' jr':'—'}</td>
      <td class="num">${r.liveStoringen.toLocaleString('nl-NL')}</td>
      <td>${live}</td>
      <td>${msi}</td>
      <td>${drip}</td>
      <td>${ctx}</td>
      <td>${esc(rapportAandacht(r))}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Bouwjaar, levensduurmodel en EOL zijn de belangrijkste datakwaliteitsvelden voor leeftijdsprognoses. Aannemer, contract en leverancier worden alleen gevuld als die velden in All Assets, totaal JSON of bronbestanden aanwezig zijn. De MSI-prognose toont alleen de laatste gedraaide simulatie.</p>
  </div>`;
  host.innerHTML=h;
  nummerGrafiekenEnTabellen(host);
}

/* ══════════════════════════════════════════════════════════════
   PROGNOSE-TABBLAD (Monte Carlo)
   ══════════════════════════════════════════════════════════════ */
let MC_RESULT=null;
function prognoseStatusRij(label,ok,tekst){
  return `<div class="data-stap ${ok?'ok':'warn'}"><div class="data-stap-volg">${ok?'gereed':'aandacht'}</div><div class="data-stap-titel"><span>${esc(label)}</span><span class="data-stap-status">${ok?'bruikbaar':'beperking'}</span></div><div class="data-stap-detail">${tekst}</div></div>`;
}
function prognoseVerslagHtml(){
  const g=berekenGereedheid(),p=prognoseGereedheid(),m=STORINGS_INSPECTIE&&STORINGS_INSPECTIE.typen.MSI,reg=g.regMsi;
  const regels=[];
  regels.push(prognoseStatusRij('Assetregister',!!ASSET_REGISTER_STATE,ASSET_REGISTER_STATE?`${ASSET_REGISTER_STATE.actiefN.toLocaleString('nl-NL')} actieve assets. MSI-areaal: ${reg.areaal?'aanwezig':'niet aanwezig'}. Bouwjaardekking: ${reg.details&&reg.details[0]?pct0(reg.details[0].bouwjaarPct):'onbekend'}.`:'Laad All Assets om prognoses en rapportage te openen.'));
  regels.push(prognoseStatusRij('Leeftijd en levensduur',reg.alle,reg.miss.length?reg.miss.map(esc).join(' '):'Bouwjaren en levensduurmodel halen de ingestelde drempels. Ontbrekende expliciete EOL mag terugvallen op zichtbare generieke levensduur.'));
  regels.push(prognoseStatusRij('Historische MSI-storingen',!!(g.logsAlg&&m),m?`${m.prognoseN.toLocaleString('nl-NL')} gekoppelde incidenten, ${Math.round(m.dekkingDagen).toLocaleString('nl-NL')} dagen dekking, ${m.maandenN} actieve maanden, koppeldekking ${fmt((m.koppelPct==null?1:m.koppelPct)*100,0)}% en ${m.duurN} duurwaarnemingen. MTTR-bron: ${esc(m.mttrBron||'onbekend')}.`:'Nog geen herkenbare historische MSI-bron. De open-storingenlijst telt hier bewust niet mee.'));
  regels.push(prognoseStatusRij('Monte Carlo-poort',g.mcAlgemeen,g.mcAlgemeen?'Simulatie kan draaien. U-routes en werkzaamheden verrijken alleen de context, niet de technische faalkans.':(prognoseTekorten(p).map(esc).join(' ')||'Nog onvoldoende historische dekking voor MSI.')));
  regels.push(prognoseStatusRij('Operationele context',!!(U_ROUTE_STATE||WERK_STATE),`${U_ROUTE_STATE?'U-routes geladen':'U-routes ontbreken'}. ${WERK_STATE?'Werkzaamheden geladen':'Werkzaamheden ontbreken'}. Dit wordt in memo en rapport als context getoond, niet als extra storing.`));
  const titel=g.mcAlgemeen?'Prognoseverslag, klaar om te simuleren':'Prognoseverslag, nog niet volledig simuleerbaar';
  return `<div class="card"><h3>${titel}</h3><p class="muted" style="font-size:12px;margin:-6px 0 12px">Deze tab blijft beschikbaar na All Assets of een totaal JSON. Als data tekortschiet, staat hieronder precies waarom. Zo kun je het rapport gebruiken zonder dat de prognose stil verdwijnt.</p><div class="data-gate-grid">${regels.join('')}</div></div>`;
}
function renderPrognose(){
  if(!ASSET_REGISTER_STATE){document.getElementById('tab-prognose').innerHTML=blokkadeHtml('prognose');return;}
  const basis=prognoseBasisState(),gereed=berekenGereedheid().mcAlgemeen;
  const _mcVan=new Date(), _mcTot=new Date(); _mcTot.setFullYear(_mcTot.getFullYear()+3);
  const _histJr=basis?(MC_HISTORIE_LIVE?MC_HISTORIE_LIVE.periodeJr:basis.stats.periodeJr):0;
  let h=prognoseVerslagHtml();
  h+=`<div class="card"><h3 style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span>Prognose toekomstige uitval — Monte Carlo ${tip('Simuleert de gekozen kalenderperiode met een Gamma-Poisson-model. Daardoor varieert niet alleen het aantal storingen, maar ook de onbekende storingsintensiteit. Hersteltijden en zwaarte worden empirisch getrokken. Als een assetregister met bouwjaren is geladen, schaalt een leeftijdsafhankelijke Weibull/NHPP-laag de historische rate vooruit.')}</span><button class="memo-knop" onclick="opentMemo('montecarlo')" ${MC_RESULT?'':'disabled'}>📄 Begeleidend schrijven</button></h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">${basis?`De geladen, goedgekeurde MSI-historie beslaat <b>${fmt(_histJr,2)} jaar</b>.`: 'Er is nog geen bruikbare MSI-historie doorgerekend.'} Alleen historische storingen kalibreren deze analyse; de open-storingenlijst is volledig uitgesloten. De p5–p95-band is een <b>voorspellingsband</b>: toevalsvariatie én onzekerheid in de storingsintensiteit tellen mee.</p>
    <div class="mc-controls">
      <div><label>Van</label><input type="date" id="mcVan" value="${isoDatumLokaal(_mcVan)}"></div>
      <div><label>Tot en met</label><input type="date" id="mcTot" value="${isoDatumLokaal(_mcTot)}"></div>
      <div><label>Runs (nauwkeurigheid)</label>
        <select id="mcRuns">
          <option value="2000">2.000 (snel)</option>
          <option value="10000" selected>10.000</option>
          <option value="50000">50.000 (nauwkeurig)</option>
        </select></div>
      <div><label>Scope</label>
        <select id="mcScope">
          <option value="netwerk" selected>Netwerkbreed + top-wegdelen</option>
          <option value="alle">Alle wegdelen</option>
        </select></div>
      <button class="tb-btn primary" onclick="runMonteCarlo()" style="align-self:flex-end" ${gereed?'':'disabled'}>▶ Simulatie starten</button>
    </div>
    <div id="mcStatus" class="muted" style="font-size:12px;margin-top:8px">${gereed?'Klaar om te simuleren.':'Simulatie nog geblokkeerd; zie het prognoseverslag hierboven.'}</div>
    <div id="mcResultHost">${gereed?'':'<div class="calc-warn" style="margin-top:12px">De tab is beschikbaar, maar de Monte Carlo wordt pas actief zodra de MSI-historie, assetkoppeling, bouwjaardekking en levensduurdekking voldoende zijn. Te weinig duurwaarnemingen blokkeren niet meer als de assettype-MTTR beschikbaar is.</div>'}</div>
  </div>`;
  document.getElementById('tab-prognose').innerHTML=h;
  if(MC_RESULT) tekenMcResult(); // herstel eerder resultaat
}

function runMonteCarlo(){
  if(!berekenGereedheid().mcAlgemeen){
    alert('De algemene Monte Carlo is nog geblokkeerd. Controleer bovenaan welke storingshistorie, koppeldekking, stichtingsjaardekking of levensduurwaarde ontbreekt. Expliciete EOL is niet verplicht als een geldige generieke waarde is ingesteld. Te weinig duurwaarnemingen gebruiken assettype-MTTR als terugval.');
    renderDataGereedheid();return;
  }
  const vanWaarde=document.getElementById('mcVan').value;
  const totWaarde=document.getElementById('mcTot').value;
  let vanMs=datumMsLokaal(vanWaarde), totMs=datumEindeExclusiefMs(totWaarde);
  if(isNaN(vanMs)||isNaN(totMs)||totMs<=vanMs){ alert('Kies een geldige prognoseperiode met een einddatum na de startdatum.'); return; }
  const vandaag=datumMsLokaal(isoDatumLokaal(new Date()));
  let startGecorrigeerd=false;
  if(vanMs<vandaag){ vanMs=vandaag; startGecorrigeerd=true; }
  if(totMs<=vanMs){ alert('De prognoseperiode moet na vandaag eindigen.'); return; }
  const horizon=+jarenTussenMs(vanMs,totMs).toFixed(2);
  const runs=+document.getElementById('mcRuns').value;
  const scope=document.getElementById('mcScope').value;
  const st=document.getElementById('mcStatus');
  st.textContent='Simulatie loopt…';
  // korte timeout zodat de UI de status kan tonen
  setTimeout(()=>{
    const t0=performance.now();
    const basis=prognoseBasisState();if(!basis){st.textContent='Historische prognosebasis ontbreekt.';return;}
    const histP=MC_HISTORIE_LIVE?MC_HISTORIE_LIVE.periodeJr:basis.stats.periodeJr;
    const prior=mcPriorContext(basis.wegdelen,histP);
    const netwerk=mcNetwerk(basis.wegdelen, histP, vanMs, totMs, runs, prior);
    // per-wegdeel: de schermtabel mag top-12 zijn, maar VC/RD-duiding rekent
    // altijd met alle wegdelen zodat regionale prestaties niet door de UI-scope
    // worden versmald.
    const perRuns = scope==='alle' ? Math.min(runs,5000) : runs;
    const kandidaten = scope==='alle' ? basis.wegdelen
      : [...basis.wegdelen].sort((a,b)=>a.besch-b.besch).slice(0,12);
    const wegRes = kandidaten.map(wd=>({wd, mc:mcWegdeel(wd,histP,vanMs,totMs,perRuns,prior)})).filter(x=>x.mc);
    const regioRuns = scope==='alle' ? perRuns : Math.min(runs,3000);
    const regioWegRes = scope==='alle' ? wegRes
      : basis.wegdelen.map(wd=>({wd, mc:mcWegdeel(wd,histP,vanMs,totMs,regioRuns,prior)})).filter(x=>x.mc);
    // per dienst netwerkbreed (via bron-propagatie op de MC-mediaan van elk wegdeel)
    const t1=performance.now();
    const werkelijkVan=isoDatumLokaal(new Date(vanMs));
    const context=maakOperationeleContext(vanMs,totMs,basis.meldingen||[]);
	    MC_RESULT={horizon,runs,scope,netwerk,wegRes,regioWegRes,regioRuns,ms:Math.round(t1-t0),histP,context,
	      datumVan:werkelijkVan,datumTot:totWaarde,startGecorrigeerd,
	      periodeLabel:new Date(vanMs).toLocaleDateString('nl-NL')+' t/m '+new Date(totMs-1).toLocaleDateString('nl-NL'),
	      model:'Gamma-Poisson met empirische duren en optionele leeftijds-NHPP'};
	    tekenMcResult();
	    renderRapport();
	    document.getElementById('mcStatus').textContent=`✓ ${runs.toLocaleString('nl-NL')} runs · ${wegRes.length} getoonde wegdelen · ${regioWegRes.length} regio-wegdelen · ${Math.round(t1-t0)} ms${startGecorrigeerd?' · startdatum naar vandaag verschoven':''}`;
  },30);
}

/* Verdeling (histogram) + percentiel-markers als SVG. */
/* Eenvoudige SVG-lijngrafiek: labels (x) en één of meer series {naam,kleur,data}. */
function chartLijn(labels, series, opts){
  opts=opts||{};
  const W=680,H=250,padL=54,padR=16,padT=16,padB=40;
  const n=labels.length;
  let maxY=opts.maxY!=null?opts.maxY:Math.max(1,...series.flatMap(s=>s.data));
  maxY=maxY*1.08;
  const sx=i=> padL + (n<=1?0:(i/(n-1))*(W-padL-padR));
  const sy=v=> H-padB - (v/maxY)*(H-padT-padB);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="mc-svg" preserveAspectRatio="xMidYMid meet">`;
  // gridlijnen y
  for(let g=0;g<=4;g++){ const v=maxY*g/4, y=sy(v);
    s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    s+=`<text x="${padL-6}" y="${y+3}" text-anchor="end" class="ax">${opts.yFmt?opts.yFmt(v):fmt(v,0)}</text>`;
  }
  // x-labels (max ~10)
  const step=Math.ceil(n/10);
  labels.forEach((lab,i)=>{ if(i%step!==0 && i!==n-1) return; const x=sx(i);
    s+=`<text x="${x}" y="${H-padB+14}" text-anchor="middle" class="ax">${esc(String(lab))}</text>`; });
  // series
  series.forEach(se=>{
    const pts=se.data.map((v,i)=>`${sx(i)},${sy(v)}`).join(' ');
    s+=`<polyline points="${pts}" fill="none" stroke="${se.kleur}" stroke-width="2.5"/>`;
    se.data.forEach((v,i)=>{ s+=`<circle cx="${sx(i)}" cy="${sy(v)}" r="2.6" fill="${se.kleur}"/>`; });
  });
  // vervangings-markering
  if(opts.markX!=null){ const idx=labels.indexOf(opts.markX); if(idx>=0){ const x=sx(idx);
    s+=`<line x1="${x}" y1="${padT}" x2="${x}" y2="${H-padB}" stroke="var(--rood)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s+=`<text x="${x}" y="${padT+9}" text-anchor="middle" class="norm" fill="var(--rood)">vervanging</text>`; } }
  s+=`</svg>`;
  return s;
}

function chartMcVerdeling(stats, norm, kleur){
  const W=560,H=170,padL=44,padR=14,padT=12,padB=34;
  const hs=stats.hist;
  const bw=(W-padL-padR)/hs.counts.length;
  const sy=c=>padT+(1-c/hs.max)*(H-padT-padB);
  const sx=v=>padL+((v-hs.lo)/Math.max(hs.hi-hs.lo,1e-6))*(W-padL-padR);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  // staven
  hs.counts.forEach((c,i)=>{
    const x=padL+i*bw, y=sy(c);
    s+=`<rect x="${x}" y="${y}" width="${Math.max(bw-1,1)}" height="${H-padB-y}" fill="${kleur||'var(--rws-blauw-mid)'}" opacity="0.7"/>`;
  });
  // as
  s+=`<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--grijs-mid)"/>`;
  const span=hs.hi-hs.lo;
  const stap= span>2?0.5: span>0.8?0.25: span>0.3?0.1:0.05;
  for(let g=Math.ceil(hs.lo/stap)*stap; g<=hs.hi+1e-9; g+=stap){
    const x=sx(g);
    s+=`<text x="${x}" y="${H-padB+14}" text-anchor="middle" class="ax">${fmt(g,2)}</text>`;
  }
  // percentiel-lijnen
  const mark=(v,lab,kl,dash)=>{ const x=sx(v); return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H-padB}" stroke="${kl}" stroke-width="2" ${dash?'stroke-dasharray="4 3"':''}/><text x="${x}" y="${padT+9}" text-anchor="middle" class="norm" fill="${kl}">${lab}</text>`; };
  s+=mark(stats.p5,'p5','var(--oranje)',true);
  s+=mark(stats.p50,'p50','var(--rws-blauw-dark)',false);
  s+=mark(stats.p95,'p95','var(--groen)',true);
  if(norm!=null && norm>=hs.lo && norm<=hs.hi) s+=mark(norm,'norm','var(--rood)',true);
  s+=`</svg>`;
  return s;
}

function chartMcWegdeelBand(wegRes,norm){
  const rows=(wegRes||[]).filter(x=>x.mc&&x.mc.besch).slice().sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50).slice(0,14);
  if(!rows.length)return '<p class="muted">Geen wegdeelresultaten beschikbaar.</p>';
  const vals=rows.flatMap(x=>[x.mc.besch.p5,x.mc.besch.p50,x.mc.besch.p95,x.wd.besch]);
  const W=680,rowH=30,padL=125,padR=55,padT=16,padB=32,H=padT+padB+rows.length*rowH;
  let min=Math.max(80,Math.floor((Math.min(...vals)-.2)*10)/10),max=100;
  if(max-min<1)min=max-1;
  const sx=v=>padL+((v-min)/(max-min))*(W-padL-padR);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for(let g=Math.ceil(min);g<=max;g+=1){const x=sx(g);s+=`<line x1="${x}" y1="${padT}" x2="${x}" y2="${H-padB}" stroke="var(--panel)"/><text x="${x}" y="${H-12}" text-anchor="middle" class="ax">${g}</text>`;}
  if(norm!=null&&norm>=min&&norm<=max){const x=sx(norm);s+=`<line x1="${x}" y1="${padT-4}" x2="${x}" y2="${H-padB}" stroke="var(--rood)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${x}" y="${padT-7}" text-anchor="middle" class="norm" fill="var(--rood)">norm</text>`;}
  rows.forEach((x,i)=>{
    const y=padT+i*rowH+12,mc=x.mc.besch,hx=sx(x.wd.besch),x5=sx(mc.p5),x50=sx(mc.p50),x95=sx(mc.p95);
    s+=`<text x="${padL-8}" y="${y+4}" text-anchor="end" class="lbl mono">${esc(x.wd.key)}</text>`;
    s+=`<line x1="${x5}" y1="${y}" x2="${x95}" y2="${y}" stroke="var(--grijs-mid)" stroke-width="7" stroke-linecap="round"><title>${esc(x.wd.key)} p5-p95 ${fmt(mc.p5,2)}-${fmt(mc.p95,2)}%</title></line>`;
    s+=`<circle cx="${x50}" cy="${y}" r="5" fill="var(--rws-blauw-dark)"><title>p50 ${fmt(mc.p50,2)}%</title></circle>`;
    s+=`<path d="M ${hx-4} ${y-5} L ${hx+4} ${y-5} L ${hx} ${y+4} Z" fill="var(--oranje)"><title>historisch ${fmt(x.wd.besch,2)}%</title></path>`;
  });
  s+=`</svg>`;
  return s;
}

function chartMcHistorischPrognose(wegRes,norm){
  const rows=(wegRes||[]).filter(x=>x.mc&&x.mc.besch).slice().sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50).slice(0,12);
  if(!rows.length)return '<p class="muted">Geen wegdeelresultaten beschikbaar.</p>';
  const W=680,H=260,padL=55,padR=15,padT=16,padB=54,min=Math.max(80,Math.floor((Math.min(...rows.flatMap(x=>[x.wd.besch,x.mc.besch.p50]))-.2)*10)/10),max=100;
  const sy=v=>padT+(1-(v-min)/(max-min))*(H-padT-padB),groepW=(W-padL-padR)/rows.length,barW=Math.min(18,(groepW-12)/2);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for(let g=Math.ceil(min);g<=max;g+=1){const y=sy(g);s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--panel)"/><text x="${padL-5}" y="${y+3}" text-anchor="end" class="ax">${g}</text>`;}
  if(norm!=null&&norm>=min&&norm<=max){const y=sy(norm);s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--rood)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${W-padR-4}" y="${y-3}" text-anchor="end" class="norm" fill="var(--rood)">norm</text>`;}
  rows.forEach((x,i)=>{
    const gx=padL+i*groepW+groepW/2-barW-2,yh=sy(x.wd.besch),yp=sy(x.mc.besch.p50);
    s+=`<rect x="${gx}" y="${yh}" width="${barW}" height="${H-padB-yh}" fill="var(--oranje)"><title>Historisch ${fmt(x.wd.besch,2)}%</title></rect>`;
    s+=`<rect x="${gx+barW+4}" y="${yp}" width="${barW}" height="${H-padB-yp}" fill="var(--rws-blauw-mid)"><title>Prognose p50 ${fmt(x.mc.besch.p50,2)}%</title></rect>`;
    s+=`<text x="${padL+i*groepW+groepW/2}" y="${H-padB+14}" text-anchor="middle" class="ax">${esc(String(x.wd.key).replace(/\s+/g,''))}</text>`;
  });
  s+=`</svg>`;
  return s;
}

function chartMcLeeftijdFactor(wegRes){
  const rows=(wegRes||[]).filter(x=>x.mc).slice().sort((a,b)=>(b.mc.leeftijdFactor||1)-(a.mc.leeftijdFactor||1)).slice(0,12);
  if(!rows.length)return '<p class="muted">Geen leeftijdsfactoren beschikbaar.</p>';
  const W=680,rowH=30,padL=125,padR=55,padT=16,padB=30,H=padT+padB+rows.length*rowH,max=Math.max(1.2,...rows.map(x=>x.mc.leeftijdFactor||1));
  const sx=v=>padL+(v/max)*(W-padL-padR);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  const x1=sx(1);s+=`<line x1="${x1}" y1="${padT-4}" x2="${x1}" y2="${H-padB}" stroke="var(--rws-blauw-dark)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${x1}" y="${padT-7}" text-anchor="middle" class="norm">stationair</text>`;
  rows.forEach((x,i)=>{
    const y=padT+i*rowH+7,f=x.mc.leeftijdFactor||1,w=Math.max(1,sx(f)-padL),kleur=f>1.3?'var(--oranje)':f<.8?'var(--groen)':'var(--rws-blauw-mid)';
    s+=`<text x="${padL-8}" y="${y+14}" text-anchor="end" class="lbl mono">${esc(x.wd.key)}</text>`;
    s+=`<rect x="${padL}" y="${y}" width="${w}" height="18" rx="3" fill="${kleur}"><title>leeftijdsfactor ${fmt(f,2)}, dekking ${fmt((x.mc.leeftijdDekking||0)*100,0)}%</title></rect>`;
    s+=`<text x="${padL+w+6}" y="${y+14}" class="val">${fmt(f,2)}x</text>`;
  });
  s+=`</svg>`;
  return s;
}

function mcRegioWegRes(){
  if(!MC_RESULT)return [];
  return (MC_RESULT.regioWegRes&&MC_RESULT.regioWegRes.length)?MC_RESULT.regioWegRes:(MC_RESULT.wegRes||[]);
}
function mcRegioScopeLabel(){
  if(!MC_RESULT)return '';
  const totaal=mcRegioWegRes().length;
  if(MC_RESULT.scope==='alle')return `volledige scope, ${totaal.toLocaleString('nl-NL')} wegdelen`;
  return `VC/RD berekend op alle ${totaal.toLocaleString('nl-NL')} wegdelen; de detailtabel toont top-12`;
}
function mcVcRows(){
  const bron=mcRegioWegRes();
  if(!bron.length)return [];
  const m=new Map();
  bron.forEach(x=>{
    if(!x||!x.wd||!x.mc||!x.mc.besch)return;
    const vc=normAssetVc(x.wd.vc)||'ONBEKEND';
    if(!m.has(vc))m.set(vc,{vc,wegRes:[],w:0,p5:0,p50:0,p95:0,gem:0,storingen:0});
    const r=m.get(vc),ww=x.wd.N||1;
    r.wegRes.push(x);r.w+=ww;r.p5+=x.mc.besch.p5*ww;r.p50+=x.mc.besch.p50*ww;r.p95+=x.mc.besch.p95*ww;r.gem+=x.mc.besch.gem*ww;r.storingen+=x.wd.n||0;
  });
  const rows=[...m.values()].map(r=>{if(r.w){r.p5/=r.w;r.p50/=r.w;r.p95/=r.w;r.gem/=r.w;}r.ctx=vcWerkRouteContext(r.vc);r.zwakste=r.wegRes.slice().sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50)[0];return r;});
  return rows.sort((a,b)=>a.p50-b.p50||b.storingen-a.storingen);
}
function chartMcVc(rows,norm){
  rows=rows||[];
  if(!rows.length)return '<p class="muted">Geen VC-prognose beschikbaar.</p>';
  const vals=rows.flatMap(r=>[r.p5,r.p50,r.p95]);
  const W=680,H=245,padL=54,padR=15,padT=20,padB=46,min=Math.max(80,Math.floor((Math.min(...vals)-.2)*10)/10),max=100;
  const sy=v=>padT+(1-(v-min)/(max-min))*(H-padT-padB),groepW=(W-padL-padR)/rows.length,barW=Math.min(42,groepW*.45);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for(let g=Math.ceil(min);g<=max;g+=1){const y=sy(g);s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--panel)"/><text x="${padL-5}" y="${y+3}" text-anchor="end" class="ax">${g}</text>`;}
  if(norm>=min&&norm<=max){const y=sy(norm);s+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--rood)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${W-padR-4}" y="${y-3}" text-anchor="end" class="norm" fill="var(--rood)">norm</text>`;}
  rows.forEach((r,i)=>{
    const cx=padL+i*groepW+groepW/2,y5=sy(r.p5),y50=sy(r.p50),y95=sy(r.p95);
    s+=`<line x1="${cx}" y1="${y5}" x2="${cx}" y2="${y95}" stroke="var(--grijs-mid)" stroke-width="8" stroke-linecap="round"><title>${esc(r.vc)} p5-p95 ${fmt(r.p5,2)}-${fmt(r.p95,2)}%</title></line>`;
    s+=`<rect x="${cx-barW/2}" y="${y50-5}" width="${barW}" height="10" rx="2" fill="${beschKleur(r.p50,norm)}"><title>${esc(r.vc)} p50 ${fmt(r.p50,2)}%</title></rect>`;
    s+=`<text x="${cx}" y="${H-padB+16}" text-anchor="middle" class="lbl">${esc(r.vc)}</text>`;
  });
  s+=`</svg>`;
  return s;
}
function mcLandelijkVcHtml(R,norm){
  const vcRows=mcVcRows();
  return `<div class="card" style="margin-top:16px"><h3>Prognose VWM landelijk en per verkeerscentrale ${tip('Bovenaan staat het landelijke VWM-beeld. Daaronder staat dezelfde prognose als uitvoeringsdoorsnede per verkeerscentrale. Werkzaamheden en U-routes staan bij de VC omdat daar de regionale uitvoering plaatsvindt.')}</h3>
    <p class="muted" style="font-size:11.5px;margin-top:-4px"><b>Regioscope:</b> ${esc(mcRegioScopeLabel())}.</p>
    <div class="chart-wrap">${chartMcVc(vcRows,norm)}</div>
    <div class="tbl-scroll" style="max-height:none;margin-top:12px"><table class="tbl"><thead><tr><th>VC</th><th class="num">p50</th><th class="num">p5-p95</th><th>Zwakste wegdeel</th><th>Werkzaamheden en U-routes</th></tr></thead><tbody>
      ${vcRows.map(r=>`<tr><td><b>${esc(r.vc)}</b><br><span class="muted">${r.wegRes.length} prognosewegdelen</span></td><td class="num" style="color:${beschKleur(r.p50,norm)};font-weight:700">${fmt(r.p50,2)}%</td><td class="num">${fmt(r.p5,2)}-${fmt(r.p95,2)}%</td><td>${r.zwakste?`<button class="linkbtn" onclick="openMcWegdeelPopup('${esc(r.zwakste.wd.key)}')">${esc(r.zwakste.wd.key)}</button> ${fmt(r.zwakste.mc.besch.p50,2)}%`:'-'}</td><td>Werk ${r.ctx.werk}<br><span class="muted">${r.ctx.werkAssets} werkassets, ${r.ctx.route} U-routes, ${r.ctx.routeAssets} routeassets</span></td></tr>`).join('')}
    </tbody></table></div></div>`;
}
function mcAssetTypeProjectie(x,tp){
  const b=x.wd.typeBron&&x.wd.typeBron[tp]?x.wd.typeBron[tp]:{besch:100,perf:100,N:0,n:0,availUren:0,perfUren:0};
  let p50=b.besch,p5=Math.max(0,b.besch-.1),p95=Math.min(100,b.besch+.1);
  if(tp==='MSI'&&x.mc&&x.mc.besch){p50=x.mc.besch.p50;p5=x.mc.besch.p5;p95=x.mc.besch.p95;}
  return {tp,b,p50,p5,p95};
}
function chartMcAssetTypeCurve(x,tp){
  const pr=mcAssetTypeProjectie(x,tp),labels=['nu','25%','50%','75%','einde'];
  const mid=[pr.b.besch,(pr.b.besch*3+pr.p50)/4,(pr.b.besch+pr.p50)/2,(pr.b.besch+pr.p50*3)/4,pr.p50];
  const low=[pr.b.besch,(pr.b.besch*3+pr.p5)/4,(pr.b.besch+pr.p5)/2,(pr.b.besch+pr.p5*3)/4,pr.p5];
  const high=[pr.b.besch,(pr.b.besch*3+pr.p95)/4,(pr.b.besch+pr.p95)/2,(pr.b.besch+pr.p95*3)/4,pr.p95];
  return chartLijn(labels,[{naam:'p5',kleur:'var(--oranje)',data:low},{naam:'p50',kleur:'var(--rws-blauw-mid)',data:mid},{naam:'p95',kleur:'var(--groen)',data:high}],{maxY:100,yFmt:v=>fmt(v,0)+'%'});
}
function mcAssetsVoorType(x,tp){
  const wd=x.wd, meld=(wd.meldingen||[]).filter(m=>m.typeId===tp);
  const pastOpWegdeel=a=>{
    const wegOk=String(a.weg||'').trim().toUpperCase()===String(wd.weg||'').trim().toUpperCase();
    const ar=normAssetRichting(a.richting||''),wr=normAssetRichting(wd.richting||'');
    return wegOk && (!wr || !ar || ar===wr);
  };
  const map=new Map();
  (ASSET_REGISTER_STATE?.assets||[]).filter(a=>a.tp===tp&&a.prognoseActief!==false&&pastOpWegdeel(a)).forEach((a,i)=>{
    const key=String(a.key||a.id||a.entityid||`${tp}-${i}`);
    map.set(key,{key,asset:a,meldingen:[],verlies:0});
  });
  meld.forEach((m,i)=>{
    const mk=String(m.assetKey||m.assetId||m.entityid||'');
    let rec=mk&&map.get(mk);
    if(!rec){
      const loc=[m.weg,m.richting,m.hm!=null?fmt(m.hm,3):'',m.strook||''].filter(Boolean).join(' ');
      const key=mk||`fallback-${tp}-${loc||'zonder-locatie'}`;
      rec=map.get(key)||{key,asset:{tp,naam:loc||`${tp} zonder registerkoppeling`,weg:m.weg,richting:m.richting,hm:m.hm,strook:m.strook,status:'uit storing'},meldingen:[],verlies:0};
      map.set(key,rec);
    }
    rec.meldingen.push(m);
    rec.verlies+=+(m.trace&&m.trace.bijdrageAvail||0);
  });
  return [...map.values()].sort((a,b)=>b.meldingen.length-a.meldingen.length||b.verlies-a.verlies||String(a.key).localeCompare(String(b.key)));
}
function mcAssetProjectie(x,tp,rec){
  const pr=mcAssetTypeProjectie(x,tp), uren=Math.max(1,x.wd.periodeUren||24);
  const huidig=Math.max(0,Math.min(100,100-(rec.verlies||0)/uren*100));
  const basis=rec.meldingen.length?Math.min(huidig,pr.b.besch):pr.b.besch;
  const p50=tp==='MSI'?Math.min(basis,pr.p50):basis;
  const p5=tp==='MSI'?Math.min(basis,pr.p5):Math.max(0,basis-.1);
  const p95=tp==='MSI'?Math.min(100,Math.max(basis,pr.p95)):Math.min(100,basis+.1);
  return {huidig,p50,p5,p95,verlies:rec.verlies||0,storingen:rec.meldingen.length};
}
function chartMcAssetCurve(x,tp,rec){
  const pr=mcAssetProjectie(x,tp,rec),labels=['nu','25%','50%','75%','einde'];
  const lijn=eind=>[pr.huidig,(pr.huidig*3+eind)/4,(pr.huidig+eind)/2,(pr.huidig+eind*3)/4,eind];
  return chartLijn(labels,[{naam:'p5',kleur:'var(--oranje)',data:lijn(pr.p5)},{naam:'p50',kleur:'var(--rws-blauw-mid)',data:lijn(pr.p50)},{naam:'p95',kleur:'var(--groen)',data:lijn(pr.p95)}],{maxY:100,yFmt:v=>fmt(v,0)+'%'});
}
function zorgMcPopup(){
  let el=document.getElementById('mcPopup');
  if(el)return el;
  el=document.createElement('div');
  el.id='mcPopup';
  el.className='memo-modal';
  el.innerHTML=`<div class="memo-modal-box mc-modal-box"><div class="memo-modal-head"><span id="mcPopupTitel">Prognosedetail</span><button class="memo-x" onclick="sluitMcPopup()">x</button></div><div class="mc-modal-body"><div id="mcPopupBody"></div></div></div>`;
  document.body.appendChild(el);
  return el;
}
let MC_POPUP={wegKey:null,type:null,assetKey:null};
function sluitMcPopup(){const el=document.getElementById('mcPopup');if(el)el.style.display='none';}
function openMcWegdeelPopup(key){
  const x=MC_RESULT&&MC_RESULT.wegRes.find(r=>r.wd.key===key);
  if(!x)return;
  MC_POPUP={wegKey:key,type:null,assetKey:null};
  const el=zorgMcPopup();el.style.display='flex';
  tekenMcPopup();
}
function openMcAssetType(tp){MC_POPUP.type=tp;MC_POPUP.assetKey=null;tekenMcPopup();}
function openMcAssetDetail(key){MC_POPUP.assetKey=decodeURIComponent(key);tekenMcPopup();}
function terugMcPopup(){if(MC_POPUP.assetKey){MC_POPUP.assetKey=null;}else{MC_POPUP.type=null;}tekenMcPopup();}
function tekenMcPopup(){
  const x=MC_RESULT&&MC_RESULT.wegRes.find(r=>r.wd.key===MC_POPUP.wegKey);
  if(!x)return;
  document.getElementById('mcPopupTitel').textContent='Prognosedetail '+x.wd.key;
  const body=document.getElementById('mcPopupBody');
  if(!MC_POPUP.type){
    const types=['MSI','CAM','LUS','DRIP','WISSELBORD'].map(tp=>mcAssetTypeProjectie(x,tp));
    body.innerHTML=`<div class="mc-popup-inner"><div class="mc-kpis"><div class="wv-kpi"><div class="l">Wegdeel p50</div><div class="v">${fmt(x.mc.besch.p50,2)}%</div></div><div class="wv-kpi"><div class="l">Band p5-p95</div><div class="v" style="font-size:17px">${fmt(x.mc.besch.p5,2)}-${fmt(x.mc.besch.p95,2)}%</div></div><div class="wv-kpi"><div class="l">Historisch</div><div class="v">${fmt(x.wd.besch,2)}%</div></div><div class="wv-kpi"><div class="l">Bron</div><div class="v" style="font-size:18px">${esc(x.mc.bron)}</div></div></div>
      <h4>Per assettype</h4><div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Assettype</th><th class="num">Areaal</th><th class="num">Storingen</th><th class="num">Huidig</th><th class="num">Prognose p50</th><th class="num">p5-p95</th></tr></thead><tbody>${types.map(r=>`<tr onclick="openMcAssetType('${r.tp}')" style="cursor:pointer"><td><b>${r.tp}</b></td><td class="num">${r.b.N||0}</td><td class="num">${r.b.n||0}</td><td class="num">${fmt(r.b.besch,2)}%</td><td class="num" style="font-weight:700">${fmt(r.p50,2)}%</td><td class="num">${fmt(r.p5,2)}-${fmt(r.p95,2)}%</td></tr>`).join('')}</tbody></table></div><p class="muted" style="font-size:11.5px">Klik op een assettype voor de berekening en curve. MSI gebruikt de Monte Carlo. Andere typen tonen de objecttype-berekening uit de actuele bron totdat daar voldoende historie voor is geladen.</p></div>`;
    nummerGrafiekenEnTabellen(body);
    return;
  }
  const tp=MC_POPUP.type,pr=mcAssetTypeProjectie(x,tp),assets=mcAssetsVoorType(x,tp);
  if(!MC_POPUP.assetKey){
    body.innerHTML=`<div class="mc-popup-inner"><div class="mc-popup-actions"><button class="mc-back-btn" onclick="terugMcPopup()">Terug naar assettypen</button></div><h4>${esc(tp)} assets op ${esc(x.wd.key)}</h4>
      <div class="grid4"><div class="kpi"><div class="k-val">${pr.b.N||assets.length||0}</div><div class="k-lab">Areaal ${tp}</div></div><div class="kpi"><div class="k-val">${pr.b.n||0}</div><div class="k-lab">Storingen</div></div><div class="kpi"><div class="k-val">${fmt(pr.b.availUren||0,0)}</div><div class="k-lab">Verliesuren besch.</div></div><div class="kpi"><div class="k-val">${fmt(pr.p50,2)}%</div><div class="k-lab">Typeprognose p50</div></div></div>
      <div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Asset</th><th>Locatie</th><th>Status</th><th class="num">Storingen</th><th class="num">Verliesuren</th><th class="num">Huidig</th></tr></thead><tbody>${assets.length?assets.map(r=>{const a=r.asset||{},ap=mcAssetProjectie(x,tp,r);return `<tr class="mc-asset-row" onclick="openMcAssetDetail('${encodeURIComponent(r.key)}')"><td><b>${esc(a.naam||a.objectnaam||a.entityid||r.key)}</b><br><span class="muted">${esc(a.entityid||a.id||a.key||'')}</span></td><td class="mono">${esc(a.weg||x.wd.weg)} ${esc(a.richting||x.wd.richting||'')} ${a.hm!=null?'hm '+fmt(a.hm,3):''} ${esc(a.strook||'')}</td><td>${esc(a.status||a.toestand||'-')}</td><td class="num">${r.meldingen.length}</td><td class="num">${fmt(r.verlies,1)}</td><td class="num">${fmt(ap.huidig,2)}%</td></tr>`;}).join(''):`<tr><td colspan="6" class="muted">Geen ${esc(tp)} assets gevonden voor dit wegdeel. Controleer of het assetregister voor dit type is geladen en of weg/richting aansluiten.</td></tr>`}</tbody></table></div>
      <p class="mc-subtle">Klik op een afzonderlijk asset om de detailcurve en de onderliggende meldingen te zien. Bij MSI wordt de wegdeelprognose als prognosecontext gebruikt; de assetdetail toont de bijdrage van dit specifieke object binnen dat wegdeel.</p></div>`;
    nummerGrafiekenEnTabellen(body);
    return;
  }
  const rec=assets.find(r=>String(r.key)===String(MC_POPUP.assetKey))||assets[0];
  if(!rec){body.innerHTML=`<div class="mc-popup-inner"><div class="mc-popup-actions"><button class="mc-back-btn" onclick="terugMcPopup()">Terug naar ${esc(tp)}-assets</button></div><p class="muted">Geen assetdetail beschikbaar.</p></div>`;return;}
  const ap=mcAssetProjectie(x,tp,rec),a=rec.asset||{};
  const meld=rec.meldingen.sort((a,b)=>(b.trace&&b.trace.bijdrageAvail||0)-(a.trace&&a.trace.bijdrageAvail||0)).slice(0,25);
  body.innerHTML=`<div class="mc-popup-inner"><div class="mc-popup-actions"><button class="mc-back-btn" onclick="terugMcPopup()">Terug naar ${esc(tp)}-assets</button></div><h4>${esc(tp)} assetdetail: ${esc(a.naam||a.objectnaam||a.entityid||rec.key)}</h4>
    <div class="chart-wrap">${chartMcAssetCurve(x,tp,rec)}</div>
    <div class="grid4"><div class="kpi"><div class="k-val">1</div><div class="k-lab">Geselecteerd asset</div></div><div class="kpi"><div class="k-val">${ap.storingen}</div><div class="k-lab">Storingen</div></div><div class="kpi"><div class="k-val">${fmt(ap.verlies,1)}</div><div class="k-lab">Verliesuren besch.</div></div><div class="kpi"><div class="k-val">${fmt(ap.p50,2)}%</div><div class="k-lab">Assetprognose p50</div></div></div>
    <p class="mc-subtle">Berekening huidig: 100 minus verliesuren van dit asset gedeeld door het rekenvenster. De prognoselijn is assetdetail binnen de wegdeelprognose; voor MSI volgt de richting uit de Monte Carlo-context van het wegdeel, voor andere typen blijft dit een actuele objectberekening totdat historische prognosedata voor dat type beschikbaar is.</p>
    <div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Code</th><th>Locatie</th><th class="num">Impact</th><th class="num">Verliesuren</th><th>Melding</th></tr></thead><tbody>${meld.length?meld.map(m=>`<tr><td class="mono">${esc(m.code)}</td><td class="mono">${esc(m.weg)} ${esc(m.richting||'')} ${m.hm!=null?'hm '+fmt(m.hm,3):''}</td><td class="num">${fmt(m.avail,1)}%</td><td class="num">${fmt(m.trace&&m.trace.bijdrageAvail||0,1)}</td><td>${esc((m.melding||'').slice(0,140))}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">Geen actuele meldingen voor dit asset.</td></tr>`}</tbody></table></div></div>`;
  nummerGrafiekenEnTabellen(body);
}

function tekenMcResult(){
  const R=MC_RESULT; if(!R){document.getElementById('mcResultHost').innerHTML='';return;}
  const n=R.netwerk;
  const norm=RULES.cfg.kpi_msi||99.5;
  // kans onder norm
  const kansOnder=(stats,drempel)=>{
    if(stats._sorted&&stats._sorted.length){
      let lo=0,hi=stats._sorted.length;
      while(lo<hi){ const mid=(lo+hi)>>1; if(stats._sorted[mid]<drempel)lo=mid+1;else hi=mid; }
      return lo/stats._sorted.length*100;
    }
    // compatibiliteitsfallback voor eerder berekende resultaten zonder samples
    let tot=0,onder=0; const hs=stats.hist;
    hs.counts.forEach((c,i)=>{ const mid=hs.lo+(i+0.5)*hs.w; tot+=c; if(mid<drempel)onder+=c; });
    return tot?onder/tot*100:0;
  };
  let h=`<div class="mc-kpis">
    <div class="wv-kpi"><div class="l">Prognose ${esc(R.periodeLabel||R.horizon+' jaar')} — mediaan (p50)</div><div class="v" style="color:${beschKleur(n.p50,norm)}">${fmt(n.p50,2)}%</div></div>
    <div class="wv-kpi"><div class="l">90%-band (p5–p95)</div><div class="v" style="font-size:17px;color:var(--rws-blauw)">${fmt(n.p5,2)}–${fmt(n.p95,2)}%</div></div>
    <div class="wv-kpi"><div class="l">Verwacht (gemiddeld)</div><div class="v" style="color:var(--rws-blauw)">${fmt(n.gem,2)}%</div></div>
    <div class="wv-kpi"><div class="l">Kans onder norm (${fmt(norm,1)}%)</div><div class="v" style="color:${kansOnder(n,norm)>20?'var(--rood)':kansOnder(n,norm)>5?'var(--oranje)':'var(--groen)'}">${fmt(kansOnder(n,norm),0)}%</div></div>
  </div>`;
  // Bewaar exact de schermwaarden voor de memo (zelfde kansOnder-berekening, zelfde norm).
  MC_SCHERM = { kansOnder: kansOnder(n,norm), norm };
  h+=monteCarloBegeleidendSchrijvenKaart('montecarlo');

  h+=`<div class="card" style="margin-top:16px"><h3>Netwerkbrede prognoseverdeling ${tip('De verdeling van de netwerkbrede areaalbeschikbaarheid over alle simulatieruns. Smalle piek = zekere prognose; brede spreiding = grote onzekerheid. p5/p50/p95 markeren de 90%-band en de mediaan.')}</h3>
    <div class="chart-wrap">${chartMcVerdeling(n,norm,'var(--rws-blauw-mid)')}</div>
    <div class="chart-legend">
      <span><i style="background:var(--oranje)"></i>p5 (pessimistisch)</span>
      <span><i style="background:var(--rws-blauw-dark)"></i>p50 (mediaan)</span>
      <span><i style="background:var(--groen)"></i>p95 (optimistisch)</span>
      <span><i style="background:var(--rood)"></i>norm</span>
    </div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Gelezen: in de helft van de gesimuleerde toekomsten ligt de beschikbaarheid boven ${fmt(n.p50,2)}%; de p5–p95-voorspellingsband is ${fmt(n.p5,2)}% tot ${fmt(n.p95,2)}%. Gebaseerd op ${R.runs.toLocaleString('nl-NL')} runs over ${R.horizon} jaar. <b>${n.logsN||0} van ${(n.logsN||0)+(n.snapN||0)} wegdelen</b> gebruiken gecomprimeerde historische reeksen; ${n.snapN||0} gebruiken rechtstreeks de geladen historische incidentregels. De open-storingenlijst wordt niet gebruikt. ${n.fallbackN?`${n.fallbackN} logreeksen zijn naar areaalaandeel verdeeld.`:''}</p>
	    <p class="muted" style="font-size:11.5px;margin-top:5px"><b>Modelkwaliteit:</b> storingsintensiteit met Gamma-Poisson-parameteronzekerheid; empirische hersteltijden${n.tailN?` met expliciete staartmarge bij ${n.tailN} rechtsgecensureerde reeksen`:''}. ${n.ageN?`Leeftijdsversnelling actief voor ${n.ageN} wegdelen; gemiddelde bouwjaardekking ${fmt(n.leeftijdDekking*100,0)}%. ${n.stationaryN} wegdelen blijven stationair.`:`Geen passend leeftijdscohort geladen: alle wegdelen blijven stationair.`} ${n.lowDataN?`${n.lowDataN} wegdelen hebben minder dan 20 waargenomen events en krijgen daardoor een bredere band. `:''}Een zuivere tijd-holdoutbacktest is met de ingebedde, gecomprimeerde logpercentielen niet uitvoerbaar; daarvoor zijn gedateerde gesloten events nodig.</p>
	  </div>`;

  h+=mcLandelijkVcHtml(R,norm);

  h+=`<div class="card"><h3>Wegdeelspreiding, p5-p50-p95 ${tip('Per regel staat de grijze balk voor de 90%-band. De blauwe stip is de mediaan. De oranje driehoek is de historische beschikbaarheid uit de geladen prognosehistorie. Zo zie je welke wegdelen én onzeker zijn én laag uitkomen.')}</h3>
    <div class="chart-wrap">${chartMcWegdeelBand(R.wegRes,norm)}</div>
    <div class="chart-legend"><span><i style="background:var(--grijs-mid)"></i>p5-p95 band</span><span><i style="background:var(--rws-blauw-dark)"></i>p50</span><span><i style="background:var(--oranje)"></i>historisch</span><span><i style="background:var(--rood)"></i>norm</span></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Lees dit als prioriteitenlijst: laag p50 betekent verwacht zwak, een brede balk betekent onzeker. Laag én breed vraagt eerst dataverbetering of gerichte analyse.</p>
  </div>`;

  h+=`<div class="card"><h3>Historisch beeld versus prognosemediaan ${tip('Vergelijkt de beschikbaarheid uit de historische prognosebasis met de gesimuleerde p50. Het verschil ontstaat door parameteronzekerheid, langere of kortere gekozen periode en eventuele leeftijdsversnelling.')}</h3>
    <div class="chart-wrap">${chartMcHistorischPrognose(R.wegRes,norm)}</div>
    <div class="chart-legend"><span><i style="background:var(--oranje)"></i>historisch</span><span><i style="background:var(--rws-blauw-mid)"></i>prognose p50</span><span><i style="background:var(--rood)"></i>norm</span></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Als prognose lager ligt dan historisch, dan trekt het model meer storingslast naar voren. Dat komt meestal door ouder areaal, beperkte historische dekking of een langere prognoseperiode.</p>
  </div>`;

  h+=`<div class="card"><h3>Leeftijdsfactor per wegdeel ${tip('Factor 1 betekent stationair: de toekomstige storingsdruk is gelijk aan de historische druk. Boven 1 betekent oplopende leeftijdshazard. Onder 1 betekent jonger of lager-risico cohort in de prognoseperiode.')}</h3>
    <div class="chart-wrap">${chartMcLeeftijdFactor(R.wegRes)}</div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Deze factor verandert de technische storingsdruk. Werkzaamheden en U-routes doen dat niet; die staan apart als operationele context.</p>
  </div>`;

  // per-wegdeel prognosetabel met bandbreedte
  h+=`<div class="card"><h3>Prognose per wegdeel ${tip('Per wegdeel de gesimuleerde beschikbaarheid over de horizon. p50 is de verwachte mediaan; p5–p95 de bandbreedte. Vergelijk met de historische waarde om te zien of het wegdeel richting norm beweegt.')}<span class="badge">${R.scope==='alle'?'alle':'top-12 zwaarste'}</span></h3>
    <div class="tbl-scroll"><table class="tbl"><thead><tr>
      <th>Wegdeel</th><th class="num">Stor./jr</th><th>Bron</th><th class="num">Historisch</th><th class="num">Prognose p50</th><th class="num">p5 (slecht)</th><th class="num">p95 (goed)</th><th>Bandbreedte</th></tr></thead><tbody>`;
  const bandMin=Math.min(...R.wegRes.map(x=>x.mc.besch.p5));
  R.wegRes.sort((a,b)=>a.mc.besch.p50-b.mc.besch.p50).forEach(x=>{
    const mc=x.mc.besch, wd=x.wd;
    // mini-bandbalk
    const lo=Math.min(99.99,Math.max(bandMin,90)), hi=100, sc=v=>Math.max(0,Math.min(100,((v-lo)/(hi-lo))*100));
    const bar=`<div class="band"><span class="band-range" style="left:${sc(mc.p5)}%;width:${Math.max(sc(mc.p95)-sc(mc.p5),1)}%"></span><span class="band-med" style="left:${sc(mc.p50)}%"></span></div>`;
    const bronTag = x.mc.bron==='logs'
      ? `<span class="tag g" title="werkelijke frequentie en hersteltijd uit de logs; rate met parameteronzekerheid">logs</span>`
      : x.mc.bron==='logs-fallback'
        ? `<span class="tag gy" title="weglog naar areaalaandeel verdeeld; duurverdeling uit dezelfde weg">logs verdeeld</span>`
        : `<span class="tag gy" title="rechtstreeks afgeleid uit de geladen historische incidentregels; extra parameteronzekerheid toegepast">historieregels</span>`;
    h+=`<tr class="${mc.p50<norm?'crit':''}">
      <td class="mono"><button class="linkbtn" onclick="openMcWegdeelPopup('${esc(wd.key)}')" title="Open berekening per assettype"><b>${esc(wd.key)}</b></button></td>
      <td class="num" title="posterior gemiddelde; ruwe historische rate ${x.mc.rateRuw.toFixed(1)}">${x.mc.rate.toFixed(1)}</td>
      <td>${bronTag}</td>
      <td class="num muted">${fmt(wd.besch,2)}</td>
      <td class="num" style="color:${beschKleur(mc.p50,norm)};font-weight:700">${fmt(mc.p50,2)}</td>
      <td class="num" style="color:var(--oranje)">${fmt(mc.p5,2)}</td>
      <td class="num" style="color:var(--groen)">${fmt(mc.p95,2)}</td>
      <td style="min-width:120px">${bar}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">De bandbalk toont de p5–p95-spreiding (grijs) met de mediaan (blauw) op een schaal van ${fmt(Math.max(bandMin,90),0)}–100%. Rood gemarkeerd = mediaan onder de norm van ${fmt(norm,1)}%.</p>
  </div>`;

  h+=`<div class="card"><div class="dd-duiding" style="margin:0">
    <b>Duiding.</b> Op basis van ${R.histP} jaar historie projecteert de simulatie de netwerkbrede beschikbaarheid voor <b>${esc(R.periodeLabel||R.horizon+' jaar')}</b> op een mediaan van <b>${fmt(n.p50,2)}%</b>. De 90%-voorspellingsband loopt van ${fmt(n.p5,2)}% tot ${fmt(n.p95,2)}%. ${kansOnder(n,norm)>5?`De gesimuleerde kans dat de norm van ${fmt(norm,1)}% niet wordt gehaald is <b>${fmt(kansOnder(n,norm),0)}%</b>; dit ondersteunt een nadere onderhoudsafweging.`:`De gesimuleerde kans onder de norm is ${fmt(kansOnder(n,norm),0)}%.`} ${n.ageN?`Waar bouwjaren beschikbaar zijn, is veroudering meegenomen.`:`Zonder geladen bouwjaren is dit een stationaire prognose.`} Toekomstige areaaluitbreiding en nog niet ingevoerd gericht onderhoud zijn niet gemodelleerd.${R.startGecorrigeerd?' Een gekozen startdatum in het verleden is naar vandaag verschoven.':''}
  </div></div>`;

  h+=operationeleContextHtml(R.context,'Werkzaamheden en U-routes onderaan de prognose');

  document.getElementById('mcResultHost').innerHTML=h;
  nummerGrafiekenEnTabellen(document.getElementById('mcResultHost'));
}

/* ══════════════════════════════════════════════════════════════
   DRIP MONTE CARLO — leeftijdsafhankelijk NHPP/minimal-repair-model.
   Elke run trekt levensduur- en vormparameteronzekerheid, terugkerende
   storingen en hersteltijden. Alleen de gesimuleerde stilstand verlaagt
   de DRIP-beschikbaarheid; die telt via de keten mee in de diensten.
   ══════════════════════════════════════════════════════════════ */
let DRIP_MC=null;

/* ── Selectie van te prognosticeren DRIPs (persistente browseropslag) ──
   DRIP_SELECTIE bevat de uid's van geselecteerde DRIPs. null = alles.
   Opgeslagen in localStorage zodat de selectie na herladen behouden blijft. */
const DRIP_SEL_KEY='dvm_drip_selectie';
let DRIP_SELECTIE=null;   // Set van uid's, of null = alle DRIPs
function laadDripSelectie(){
  try{ const s=localStorage.getItem(DRIP_SEL_KEY); if(s){ const arr=JSON.parse(s); DRIP_SELECTIE=Array.isArray(arr)?new Set(arr):null; } }
  catch(e){ DRIP_SELECTIE=null; }
}
function bewaarDripSelectie(){
  try{
    if(DRIP_SELECTIE===null) localStorage.removeItem(DRIP_SEL_KEY);
    else localStorage.setItem(DRIP_SEL_KEY, JSON.stringify([...DRIP_SELECTIE]));
  }catch(e){}
}
/* Is een DRIP geselecteerd voor de prognose? (null = alles). */
function dripGeselecteerd(d){ return DRIP_SELECTIE===null || DRIP_SELECTIE.has(d.uid); }
/* Toggle één DRIP. */
function toggleDripSelectie(uid, aan){
  const D=(STATE&&STATE.drips)||DRIP_STATE; if(!D) return;
  if(DRIP_SELECTIE===null){ DRIP_SELECTIE=new Set(D.drips.map(d=>d.uid)); } // materialiseer "alles" bij eerste wijziging
  if(aan) DRIP_SELECTIE.add(uid); else DRIP_SELECTIE.delete(uid);
  bewaarDripSelectie();
  invalideerDripMcNaSelectie();
  werkSelectieTellerBij();
}
/* Selecteer alles, niets of een vaste deelverzameling. */
function dripSelectieActie(actie){
  const D=(STATE&&STATE.drips)||DRIP_STATE; if(!D) return;
  const nu=new Date().getFullYear();
  if(actie==='alles') DRIP_SELECTIE=null;
  else if(actie==='niets') DRIP_SELECTIE=new Set();
  else if(actie==='eol') DRIP_SELECTIE=new Set(D.drips.filter(d=>{const e=dripEolJaar(d);return e&&e<=nu;}).map(d=>d.uid));
  else if(actie==='ria4wind') DRIP_SELECTIE=new Set(D.drips.filter(d=>d.ria4||d.wind).map(d=>d.uid));
  else if(actie==='ria4') DRIP_SELECTIE=new Set(D.drips.filter(d=>d.ria4).map(d=>d.uid));
  else if(actie==='wind') DRIP_SELECTIE=new Set(D.drips.filter(d=>d.wind).map(d=>d.uid));
  bewaarDripSelectie();
  invalideerDripMcNaSelectie();
  werkSelectieTellerBij();
}
/* Zet alle leden van één categorie aan of uit, zonder de overige selectie te
   overschrijven. Dit verwerkt ook DRIPs die zowel RIA4 als wind zijn. */
function dripCategorieToggle(veld,aan){
  const D=(STATE&&STATE.drips)||DRIP_STATE;if(!D||!['wind','ria4'].includes(veld))return;
  const groep=D.drips.filter(d=>!!d[veld]);if(!groep.length)return;
  if(DRIP_SELECTIE===null){
    if(aan){werkSelectieTellerBij();return;}
    DRIP_SELECTIE=new Set(D.drips.map(d=>d.uid));
  }
  groep.forEach(d=>aan?DRIP_SELECTIE.add(d.uid):DRIP_SELECTIE.delete(d.uid));
  bewaarDripSelectie();
  invalideerDripMcNaSelectie();
  werkSelectieTellerBij();
}
/* Aantal geselecteerde DRIPs. */
function dripSelectieAantal(){
  const D=(STATE&&STATE.drips)||DRIP_STATE; if(!D) return 0;
  return DRIP_SELECTIE===null ? D.drips.length : D.drips.filter(d=>DRIP_SELECTIE.has(d.uid)).length;
}
function dripCategorieStatus(veld){
  const D=(STATE&&STATE.drips)||DRIP_STATE;if(!D)return {totaal:0,geselecteerd:0,alles:false,deel:false};
  const groep=D.drips.filter(d=>!!d[veld]);
  const geselecteerd=groep.filter(dripGeselecteerd).length;
  return {totaal:groep.length,geselecteerd,alles:groep.length>0&&geselecteerd===groep.length,deel:geselecteerd>0&&geselecteerd<groep.length};
}
function invalideerDripMcNaSelectie(){
  DRIP_MC=null;
  const host=document.getElementById('dripMcResultHost');
  if(host)host.innerHTML=`<div class="calc-warn" style="margin-top:10px"><b>Prognoseselectie gewijzigd.</b> Nu zijn ${dripSelectieAantal()} DRIPs geselecteerd. Draai de Monte Carlo opnieuw om resultaten voor deze selectie te berekenen.</div>`;
}
function werkSelectieTellerBij(){
  const el=document.getElementById('dripSelTeller');
  const D=((STATE&&STATE.drips)||DRIP_STATE||{drips:[]}),tot=D.drips.length;
  const n=dripSelectieAantal();
  if(el){ el.textContent=`${n} van ${tot} geselecteerd`; }
  // synchroniseer de "alles aan/uit"-vinkboxen (balk + tabelkop) incl. indeterminate
  ['dripMasterToggle','dripMasterToggleKop'].forEach(id=>{
    const cb=document.getElementById(id);
    if(cb){ cb.checked = n>0 && n===tot; cb.indeterminate = n>0 && n<tot; }
  });
  [['dripWindToggle','wind'],['dripRia4Toggle','ria4']].forEach(([id,veld])=>{
    const cb=document.getElementById(id),status=dripCategorieStatus(veld);
    if(cb){cb.checked=status.alles;cb.indeterminate=status.deel;cb.disabled=status.totaal===0;}
  });
  document.querySelectorAll('input[data-drip-uid]').forEach(cb=>{
    let uid='';try{uid=decodeURIComponent(cb.getAttribute('data-drip-uid')||'');}catch(e){uid=cb.getAttribute('data-drip-uid')||'';}
    const d=D.drips.find(x=>x.uid===uid),sel=!!(d&&dripGeselecteerd(d));cb.checked=sel;
    const tr=cb.closest&&cb.closest('tr');if(tr)tr.classList.toggle('drip-uit',!sel);
  });
}
/* Master aan/uit: alles selecteren of alles deselecteren. */
function dripMasterToggle(aan){
  dripSelectieActie(aan ? 'alles' : 'niets');
}

function bouwJaarVakken(vanMs,totMs){
  const vakken=[]; let cur=vanMs;
  while(cur<totMs){
    const d=new Date(cur), jaar=d.getFullYear();
    const grens=new Date(jaar+1,0,1).getTime();
    const einde=Math.min(totMs,grens);
    vakken.push({jaar,van:cur,tot:einde,uren:(einde-cur)/3600e3}); cur=einde;
  }
  return vakken;
}
function assetOorsprongMs(d,bouwjaar,modelBouwjaar){
  if(!modelBouwjaar && d.ingebruikDatum) return d.ingebruikDatum;
  return new Date(bouwjaar,6,1).getTime(); // alleen bij ontbrekende exacte datum
}
function hazardVanafOorsprong(rel,vanMs,totMs,oorsprongMs){
  if(totMs<=oorsprongMs) return 0;
  const a=Math.max(vanMs,oorsprongMs);
  return verwachteEventsInterval(rel,jarenTussenMs(oorsprongMs,a),jarenTussenMs(oorsprongMs,totMs));
}
function assetHazardPeriode(pd,rel,bouwjaar,vanMs,totMs,vervangJaar){
  const oorspronkelijk=assetOorsprongMs(pd.d,bouwjaar,pd.bouwjaarModel);
  if(!vervangJaar) return hazardVanafOorsprong(rel,vanMs,totMs,oorspronkelijk);
  const vMs=new Date(vervangJaar,0,1).getTime();
  if(vMs<=vanMs) return hazardVanafOorsprong(rel,vanMs,totMs,vMs);
  if(vMs>=totMs) return hazardVanafOorsprong(rel,vanMs,totMs,oorspronkelijk);
  return hazardVanafOorsprong(rel,vanMs,vMs,oorspronkelijk)+hazardVanafOorsprong(rel,vMs,totMs,vMs);
}
function relMetOnzekerheid(rel,lifeFactor,betaFactor){
  const beta=Math.max(1.05,Math.min(8,rel.beta*betaFactor));
  const L=Math.max(1,rel.L*lifeFactor);
  return {beta,L,eta:L/Math.pow(Math.log(2),1/beta)};
}
function dripHazardProfiel(pd,bouwjaar,vanMs,totMs,vervangJaar,bekendeJaren){
  const eps=0.04;
  let jaren=[bouwjaar];
  if(pd.bouwjaarModel && bekendeJaren.length){
    jaren=[];
    const n=Math.min(21,bekendeJaren.length);
    for(let i=0;i<n;i++) jaren.push(bekendeJaren[Math.round(i*(bekendeJaren.length-1)/Math.max(1,n-1))]);
    jaren=[...new Set(jaren)];
  }
  const gemHaz=rel=>jaren.reduce((s,j)=>s+assetHazardPeriode(pd,rel,j,vanMs,totMs,vervangJaar),0)/Math.max(1,jaren.length);
  const h0=gemHaz(pd.rel);
  if(!(h0>0)) return {h0:0,aL:0,aB:0,aAge:0};
  const hLp=gemHaz(relMetOnzekerheid(pd.rel,Math.exp(eps),1));
  const hLm=gemHaz(relMetOnzekerheid(pd.rel,Math.exp(-eps),1));
  const hBp=gemHaz(relMetOnzekerheid(pd.rel,1,Math.exp(eps)));
  const hBm=gemHaz(relMetOnzekerheid(pd.rel,1,Math.exp(-eps)));
  const dL=(Math.log(Math.max(hLp,1e-12))-Math.log(Math.max(hLm,1e-12)))/(2*eps);
  const dB=(Math.log(Math.max(hBp,1e-12))-Math.log(Math.max(hBm,1e-12)))/(2*eps);
  const sigL=Math.sqrt(Math.log(1+(RULES.cfg.reliabilityLifeCv||0.18)**2));
  const sigB=Math.sqrt(Math.log(1+(RULES.cfg.reliabilityBetaCv||0.10)**2));
  let aAge=0;
  if(pd.bouwjaarModel && jaren.length>1){
    const logs=jaren.map(j=>Math.log(Math.max(assetHazardPeriode(pd,pd.rel,j,vanMs,totMs,vervangJaar),1e-12)));
    const m=logs.reduce((s,x)=>s+x,0)/logs.length;
    aAge=Math.sqrt(logs.reduce((s,x)=>s+(x-m)*(x-m),0)/logs.length);
  }
  const cap=x=>Math.max(-2.5,Math.min(2.5,x));
  return {h0,aL:cap(dL*sigL),aB:cap(dB*sigB),aAge:Math.min(2,aAge)};
}
function kalibreerDripProfielMetHistorie(p,pd,duurJr,historieAan){
  const q={...p,mttrUren:pd.mttrUren,mttrCv:pd.mttrCv,h0Model:p.h0,historie:false};
  if(!historieAan||!pd.historieGekalibreerd||!(duurJr>0)) return q;
  const modelReferentie=Math.max(pd.hNuModel||0,1e-6);
  const modelPerJaar=p.h0/duurJr;
  const leeftijdTrend=Math.max(0.05,Math.min(5,modelPerJaar/modelReferentie));
  q.h0=Math.max(0,pd.rateGekalibreerd*duurJr*leeftijdTrend);
  // Gamma-Poisson posterioronzekerheid als onafhankelijke lognormale term.
  const vorm=Math.max(1,(pd.hist.n||0)+2*modelReferentie);
  const cvRate=Math.min(1.5,1/Math.sqrt(vorm));
  const sigRate=Math.sqrt(Math.log(1+cvRate*cvRate));
  q.aAge=Math.min(2,Math.sqrt(q.aAge*q.aAge+sigRate*sigRate));
  q.historie=true; q.leeftijdTrend=leeftijdTrend;
  return q;
}
function trekHazardProfiel(p,zL,zB,zAge){
  if(!(p.h0>0)) return 0;
  const v=p.aL*p.aL+p.aB*p.aB+p.aAge*p.aAge;
  return p.h0*Math.exp(p.aL*zL+p.aB*zB+p.aAge*(zAge||0)-0.5*v);
}
function nieuwHazardAggregaat(){ return {h0:0,l:0,b:0,ageVar:0,assetN:0,mttrH:0,cvH:0,histH:0}; }
function voegHazardProfiel(g,p){
  g.h0+=p.h0; g.l+=p.h0*p.aL; g.b+=p.h0*p.aB;
  g.ageVar+=(p.h0*p.aAge)*(p.h0*p.aAge); g.assetN++;
  g.mttrH+=p.h0*(p.mttrUren||0); g.cvH+=p.h0*(p.mttrCv||0); if(p.historie)g.histH+=p.h0;
}
function rondHazardAggregaat(g){
  return {h0:g.h0,aL:g.h0?g.l/g.h0:0,aB:g.h0?g.b/g.h0:0,
    aAge:g.h0?Math.sqrt(g.ageVar)/g.h0:0,assetN:g.assetN,
    mttrUren:g.h0?g.mttrH/g.h0:0,mttrCv:g.h0?g.cvH/g.h0:0,historieAandeel:g.h0?g.histH/g.h0:0};
}
function simHerstelUren(aantal,gemUren,cv,maxUren){
  if(aantal<=0) return 0;
  // Moment-equivalente som van lognormale reparatieduren. Gemiddelde en
  // variantie blijven gelijk, zonder per event een kostbare trekkingslus.
  const som=lognormaalGemiddelde(aantal*gemUren,(cv||0)/Math.sqrt(aantal));
  return Math.min(maxUren,Math.max(0,som));
}

/* Effectief aandeel van de DRIP-schakel in een dienstketen. De rule engine
   staat toe dat gewichten niet exact tot 1 optellen; daarom altijd eerst
   normaliseren, gelijk aan de reguliere dienstdoorrekening. */
function dienstDripAandeel(dienst){
  const afh=dienstAssetAfhankelijkheid(dienst||{});
  const totaal=Object.values(afh).reduce((s,w)=>s+(Number(w)||0),0);
  return totaal>0?Math.max(0,(Number(afh.drip)||0)/totaal):0;
}

/* Simuleer de dienstimpact van DRIP-veroudering over de exacte periode. */
function runDripMonteCarlo(){
  if(!berekenGereedheid().mcDrip){
    alert('De DRIP Monte Carlo is nog geblokkeerd. Nodig zijn voldoende gekoppelde DRIP-historie, een DRIP-assetlijst met voldoende stichtingsjaren en een geldige levensduur en β. Expliciete EOL is niet verplicht; de generieke DRIP-waarden mogen als terugval worden gebruikt.');
    renderDataGereedheid();return;
  }
  const D=(STATE&&STATE.drips)||DRIP_STATE;
  if(!D||!D.drips.length){ alert('Laad eerst een DRIP-areaal (met stichtingsjaar).'); return; }
  const nuDatum=new Date(), nu=nuDatum.getFullYear();
  const vanWaarde=document.getElementById('dripMcVan').value;
  const totWaarde=document.getElementById('dripMcTot').value;
  let vanMs=datumMsLokaal(vanWaarde), totMs=datumEindeExclusiefMs(totWaarde);
  if(isNaN(vanMs)||isNaN(totMs)||totMs<=vanMs){ alert('Kies een geldige periode met een einddatum na de startdatum.'); return; }
  const vandaag=datumMsLokaal(isoDatumLokaal(nuDatum));
  let startGecorrigeerd=false;
  if(vanMs<vandaag){ vanMs=vandaag; startGecorrigeerd=true; }
  if(totMs<=vanMs){ alert('De prognoseperiode moet na vandaag eindigen.'); return; }
  const runs=parseInt(document.getElementById('dripMcRuns').value)||5000;
  const periodeJr=jarenTussenMs(vanMs,totMs), periodeUren=(totMs-vanMs)/3600e3;
  const jaarVan=new Date(vanMs).getFullYear(), jaarTot=new Date(totMs-1).getFullYear();
  const vervangAan=document.getElementById('dripMcVervang') && document.getElementById('dripMcVervang').checked;
  const vervangJaar=vervangAan?(parseInt(document.getElementById('dripMcVervangJaar').value)||null):null;
  const historieAan=!!(document.getElementById('dripMcHistorie')&&document.getElementById('dripMcHistorie').checked&&DRIP_HIST_STATE);

  const geselecteerd=D.drips.filter(dripGeselecteerd);
  if(!geselecteerd.length){ alert('Geen DRIPs geselecteerd. Vink in de areaaltabel de DRIPs aan die je wilt prognosticeren, of gebruik “Alles selecteren”.'); return; }
  const statusUitgesloten=geselecteerd.filter(d=>!statusActiefVoorPrognose(d.status)).length;
  const drips=geselecteerd.filter(d=>statusActiefVoorPrognose(d.status));
  const selectiePerVc={};
  geselecteerd.forEach(d=>{
    const vc=normAssetVc(d.vc)||'ONBEKEND';
    const rec=selectiePerVc[vc]||(selectiePerVc[vc]={geselecteerd:0,actief:0,uitgesloten:0});
    rec.geselecteerd++;
    if(statusActiefVoorPrognose(d.status))rec.actief++;else rec.uitgesloten++;
  });
  if(!drips.length){ alert('Geen geselecteerde DRIPs hebben een operationele status. De niet-operationele assets blijven zichtbaar in de areaaltabel, maar tellen niet als actief prognoseareaal.'); return; }
  const bekendeJaren=drips.map(d=>d.bouwjaar).filter(Boolean).sort((a,b)=>a-b);
  if(!bekendeJaren.length){ alert('Geen stichtingsjaren beschikbaar. Zonder ten minste één waargenomen bouwjaar kan de leeftijdsprognose niet verantwoord worden gesimuleerd.'); return; }
  const mediaanJaar=bekendeJaren[Math.floor(bekendeJaren.length/2)];
  drips.forEach(d=>{ d.vervangJaar=vervangJaar; d._rel=d._rel||assetReliability(d); });

  const dripAT=assetTypeRec('DRIP')||{};
  const mttrUren=dripAT.mttr!=null?dripAT.mttr:(RULES.cfg.hw_mttr||6);
  const mttrBron=dripAT.mttr!=null?'assettype-groep DRIP':'algemene cfg';
  const mttrCvStandaard=RULES.cfg.mttrCv||0.75;

  const vakken=bouwJaarVakken(vanMs,totMs);
  const perDrip=drips.map(d=>{
    const rel=d._rel, bouwjaarModel=!d.bouwjaar, modelJaar=d.bouwjaar||mediaanJaar;
    const assetCfg=assetOverrideVoor(d._assetKey||d.assetKey)||{};
    const assetMttr=+assetCfg.mttr>0?+assetCfg.mttr:mttrUren;
    const pd={d,rel,bouwjaarModel,modelJaar,
      leeftijdNu:d.bouwjaar?Math.max(0,jarenTussenMs(assetOorsprongMs(d,d.bouwjaar,false),vandaag)):null,
      eol:d.bouwjaar?Math.round(d.bouwjaar+rel.L):null,
      levensduur:rel.L,beta:rel.beta,etaBron:rel.bron,
      rul:d.bouwjaar?restlevensduur(rel,Math.max(0,nu-d.bouwjaar)):null};
    const hNu=assetHazardPeriode(pd,rel,modelJaar,vandaag,vandaag+365.25*24*3600e3,null);
    const hPer=assetHazardPeriode(pd,rel,modelJaar,vanMs,totMs,vervangJaar);
    pd.hNuModel=hNu; pd.faalNu=1-Math.exp(-hNu); pd.faalCentraal=1-Math.exp(-hPer); pd.faalPeriode=pd.faalCentraal;
    pd.hist=historieAan&&d._hist&&d._hist.dekkingJaren>=0.25?d._hist:null;
    pd.mttrUren=assetMttr; pd.mttrCv=mttrCvStandaard; pd.historieGekalibreerd=!!pd.hist;
    if(pd.hist){
      const priorJaren=2;
      pd.histRate=pd.hist.rate||0;
      pd.rateGekalibreerd=(pd.hist.n+priorJaren*hNu)/(pd.hist.dekkingJaren+priorJaren);
      const duurN=pd.hist.duurN||0, priorDuurN=5;
      if(duurN&&pd.hist.duurGemWinsor!=null){
        pd.mttrUren=(duurN*pd.hist.duurGemWinsor+priorDuurN*assetMttr)/(duurN+priorDuurN);
        const cvHist=Math.max(0.25,Math.min(2,pd.hist.duurCv||mttrCvStandaard));
        pd.mttrCv=Math.max(0.25,Math.min(2,(duurN*cvHist+priorDuurN*mttrCvStandaard)/(duurN+priorDuurN)));
      }
      pd.faalNu=1-Math.exp(-pd.rateGekalibreerd);
    }else pd.rateGekalibreerd=hNu;
    return pd;
  });

  // Unie van bestaande wegvakken en DRIP-locaties, zodat assets buiten een
  // geladen storingslijst niet uit de netwerkberekening verdwijnen.
  const wvMap=new Map();
  if(STATE&&STATE.wegdelen) STATE.wegdelen.forEach(w=>wvMap.set(w.key,{weg:w.weg,richting:w.richting,key:w.key,N:w.N||1}));
  drips.forEach(d=>{ const key=d.weg+(d.richting?' '+d.richting:''); if(!wvMap.has(key))wvMap.set(key,{weg:d.weg,richting:d.richting,key,N:1}); });
  const wegvakken=[...wvMap.values()], wvIndex=new Map(wegvakken.map((w,i)=>[w.key,i]));
  const gw=d=>{ const f=RULES.drip.functies.find(x=>x.code===d.functie); return f?f.gewicht:0.5; };
  const gewichten=drips.map(gw), wegIndex=drips.map(d=>wvIndex.get(d.weg+(d.richting?' '+d.richting:'')));
  const totaalGewicht=gewichten.reduce((s,g)=>s+Math.max(0,g),0);
  const dienstAandelen=Object.fromEntries(DIENSTEN.map(dn=>[dn.id,dienstDripAandeel(dn)]));

  const dripBeschArr=new Float64Array(runs), eventArr=new Float64Array(runs), herstelArr=new Float64Array(runs);
  const dienstArr={}; DIENSTEN.forEach(dn=>dienstArr[dn.id]=new Float64Array(runs));

  // Precompute de centrale hazard en de lokale gevoeligheid voor onzekerheid
  // in levensduur en β. De simulatie kan daarna per wegcohort aggregeren;
  // voor een Poisson-proces is de som van assethazards exact optelbaar.
  const profielen=perDrip.map(pd=>kalibreerDripProfielMetHistorie(
    dripHazardProfiel(pd,pd.modelJaar,vanMs,totMs,vervangJaar,bekendeJaren),pd,periodeJr,historieAan));
  const groepMap=new Map();
  profielen.forEach((p,i)=>{
    const gewicht=Math.max(0,gewichten[i]), sleutel=wegIndex[i]+'|'+gewicht;
    let g=groepMap.get(sleutel);
    if(!g){ g={agg:nieuwHazardAggregaat(),wegIndex:wegIndex[i],gewicht}; groepMap.set(sleutel,g); }
    voegHazardProfiel(g.agg,p);
  });
  const groepen=[...groepMap.values()].map(g=>({...g,p:rondHazardAggregaat(g.agg)}));

  // Marginale faalkans per asset. Dit integreert dezelfde expliciete
  // parameter- en (indien nodig) cohortonzekerheid als het netwerkmodel.
  perDrip.forEach((pd,i)=>{
    const p=profielen[i]; let overleven=0; const nProb=120;
    for(let k=0;k<nProb;k++) overleven+=Math.exp(-trekHazardProfiel(p,gaussSample(),gaussSample(),gaussSample()));
    pd.simFaal=Math.max(0,Math.min(1,1-overleven/nProb));
    pd.faalCentraal=1-Math.exp(-p.h0); pd.faalPeriode=pd.simFaal; pd.gemEvents=p.h0;
    pd.mttrSim=p.mttrUren; pd.mttrCvSim=p.mttrCv; pd.h0Model=p.h0Model; pd.historieGekalibreerd=!!p.historie;
  });

  const jaarRuns=Math.min(runs,500);
  const eventsJaar=vakken.map(()=>new Float64Array(jaarRuns));
  const herstelJaar=vakken.map(()=>new Float64Array(jaarRuns));
  const dripBeschJaar=vakken.map(()=>new Float64Array(jaarRuns));
  const dienstJaarArr={};
  DIENSTEN.forEach(dn=>dienstJaarArr[dn.id]=vakken.map(()=>new Float64Array(jaarRuns)));

  // Jaarcurves per functiegewicht. Zo gebruiken storingen, herstel, gewogen
  // DRIP-stilstand en dienstimpact binnen elk jaar exact dezelfde trekkingen.
  // Eén set parameterdraws per run houdt de jaren onderling gecorreleerd.
  const jaarGroepMaps=vakken.map(()=>new Map());
  perDrip.forEach((pd,i)=>vakken.forEach((v,j)=>{
    const gewicht=Math.max(0,gewichten[i]);
    const sleutel=wegIndex[i]+'|'+gewicht;
    let g=jaarGroepMaps[j].get(sleutel);
    if(!g){ g={agg:nieuwHazardAggregaat(),gewicht}; jaarGroepMaps[j].set(sleutel,g); }
    const jp=kalibreerDripProfielMetHistorie(
      dripHazardProfiel(pd,pd.modelJaar,v.van,v.tot,vervangJaar,bekendeJaren),pd,jarenTussenMs(v.van,v.tot),historieAan);
    voegHazardProfiel(g.agg,jp);
  }));
  const jaarGroepen=jaarGroepMaps.map(m=>[...m.values()].map(g=>({gewicht:g.gewicht,p:rondHazardAggregaat(g.agg)})));
  for(let r=0;r<jaarRuns;r++){
    const zL=gaussSample(),zB=gaussSample(),mttrFactor=lognormaalFactor(0.20);
    for(let j=0;j<vakken.length;j++){
      let totaalEventsJaar=0,totaalHerstelJaar=0,totaalGewogenDownJaar=0;
      for(const g of jaarGroepen[j]){
        const h=trekHazardProfiel(g.p,zL,zB,gaussSample());
        const n=poissonSample(h);
        const down=simHerstelUren(n,g.p.mttrUren*mttrFactor,g.p.mttrCv||mttrCvStandaard,g.p.assetN*vakken[j].uren);
        totaalEventsJaar+=n; totaalHerstelJaar+=down; totaalGewogenDownJaar+=down*g.gewicht;
      }
      eventsJaar[j][r]=totaalEventsJaar; herstelJaar[j][r]=totaalHerstelJaar;
      const dripBesch=totaalGewicht>0
        ?Math.max(0,100-totaalGewogenDownJaar/(totaalGewicht*vakken[j].uren)*100):100;
      dripBeschJaar[j][r]=dripBesch;
      DIENSTEN.forEach(dn=>{
        const aandeel=dienstAandelen[dn.id];
        dienstJaarArr[dn.id][j][r]=Math.max(0,Math.min(100,100-aandeel*(100-dripBesch)));
      });
    }
  }

  for(let r=0;r<runs;r++){
    const zL=gaussSample(), zB=gaussSample();
    const mttrFactor=lognormaalFactor(0.20);
    let totaalEvents=0,totaalHerstel=0,totaalGewogenDown=0;
    for(const g of groepen){
      const h=trekHazardProfiel(g.p,zL,zB,gaussSample());
      const n=poissonSample(h), down=simHerstelUren(n,g.p.mttrUren*mttrFactor,g.p.mttrCv||mttrCvStandaard,g.p.assetN*periodeUren);
      totaalEvents+=n; totaalHerstel+=down;
      const verlies=down*g.gewicht;
      totaalGewogenDown+=verlies;
    }
    eventArr[r]=totaalEvents; herstelArr[r]=totaalHerstel/24;
    dripBeschArr[r]=totaalGewicht>0?Math.max(0,100-totaalGewogenDown/(totaalGewicht*periodeUren)*100):100;
    DIENSTEN.forEach(dn=>{
      // Alleen de geselecteerde actieve DRIPs vormen hier het prognoseareaal.
      // Geen verdunning met wegdelen zonder geselecteerde DRIP. Hierdoor is de
      // dienstbeschikbaarheid per run exact monotonic met DRIP-beschikbaarheid.
      const aandeel=dienstAandelen[dn.id];
      dienstArr[dn.id][r]=Math.max(0,Math.min(100,100-aandeel*(100-dripBeschArr[r])));
    });
  }

  const perJaarStats=eventsJaar.map(a=>mcStats(a));
  const herstelPerJaarStats=herstelJaar.map(a=>mcStats(Float64Array.from(a,v=>v/24)));
  const dripBeschPerJaarStats=dripBeschJaar.map(a=>mcStats(a));
  const dienstPerJaarStats=Object.fromEntries(DIENSTEN.map(dn=>[
    dn.id,dienstJaarArr[dn.id].map(a=>mcStats(a))
  ]));
  const cumRuns=vakken.map(()=>new Float64Array(jaarRuns));
  for(let r=0;r<jaarRuns;r++){ let s=0; for(let j=0;j<vakken.length;j++){ s+=eventsJaar[j][r]; cumRuns[j][r]=s; } }
  const cumStats=cumRuns.map(a=>mcStats(a));
  const cum={jaren:vakken.map(v=>v.jaar),
    perJaar:perJaarStats.map(s=>s.gem),cum:cumStats.map(s=>s.gem),perJaarStats,cumStats};
  const herstelPerJaar=herstelPerJaarStats.map(s=>s.gem);
  // Selecteer drie volledige runs op DRIP-beschikbaarheid. In tegenstelling
  // tot losse marginale percentielen blijven storingen, herstel en diensten
  // zo binnen iedere kolom afkomstig uit exact hetzelfde toekomstscenario.
  const rang=Array.from({length:runs},(_,i)=>i).sort((a,b)=>dripBeschArr[a]-dripBeschArr[b]);
  const scenarioIndex=p=>rang[Math.min(runs-1,Math.max(0,Math.floor(p*runs)))];
  const maakScenario=(id,label,p)=>{
    const i=scenarioIndex(p);
    return {id,label,percentiel:p,index:i,dripBesch:dripBeschArr[i],events:eventArr[i],
      herstelDagen:herstelArr[i],
      diensten:Object.fromEntries(DIENSTEN.map(dn=>[dn.id,dienstArr[dn.id][i]]))};
  };
  const scenarios=[
    maakScenario('ongunstig','Ongunstig scenario',0.025),
    maakScenario('mediaan','Mediaan scenario',0.50),
    maakScenario('gunstig','Gunstig scenario',0.975)
  ];
  const metJaar=drips.filter(d=>d.bouwjaar).length;
  const histDrips=perDrip.filter(p=>p.historieGekalibreerd);
  const modelEventsCentraal=perDrip.reduce((s,p)=>s+(p.h0Model||0),0);
  const actueleEventsCentraal=perDrip.reduce((s,p)=>s+(p.gemEvents||0),0);
  const histVerschillen=histDrips.map(p=>({
    id:dripMemoLabel(p.d),weg:dripLocatieLabel(p.d)||((p.d.weg||'')+(p.d.richting?' '+p.d.richting:'')),
    model:p.h0Model||0,gekalibreerd:p.gemEvents||0,
    verschil:(p.gemEvents||0)-(p.h0Model||0)
  }));
  const topStijging=histVerschillen.filter(x=>x.verschil>0).sort((a,b)=>b.verschil-a.verschil).slice(0,5);
  const topDaling=histVerschillen.filter(x=>x.verschil<0).sort((a,b)=>a.verschil-b.verschil).slice(0,5);
  const historieVergelijking={modelEvents:modelEventsCentraal,gekalibreerdEvents:actueleEventsCentraal,
    verschil:actueleEventsCentraal-modelEventsCentraal,
    factor:modelEventsCentraal>0?actueleEventsCentraal/modelEventsCentraal:null,
    verhoogdN:histVerschillen.filter(x=>x.verschil>0).length,
    verlaagdN:histVerschillen.filter(x=>x.verschil<0).length,topStijging,topDaling};
  const historieInfo={aan:historieAan,gekoppeldeSelectie:histDrips.length,
    incidentenSelectie:histDrips.reduce((s,p)=>s+(p.hist?p.hist.n:0),0),
    duurWaarnemingen:histDrips.reduce((s,p)=>s+(p.hist?p.hist.duurN:0),0),
    dekkingDagen:DRIP_HIST_STATE?DRIP_HIST_STATE.dekkingDagen:0,
    bronnen:DRIP_HIST_STATE?DRIP_HIST_STATE.sources.map(x=>x.name):[],
    modelDrips:perDrip.length-histDrips.length};
  const context=maakOperationeleContext(vanMs,totMs,drips);
	  DRIP_MC={jaarVan,jaarTot,periodeJr,periodeUren,nu,runs,vervangJaar,context,
    datumVan:isoDatumLokaal(new Date(vanMs)),datumTot:totWaarde,
    periodeLabel:new Date(vanMs).toLocaleDateString('nl-NL')+' t/m '+new Date(totMs-1).toLocaleDateString('nl-NL'),
    startGecorrigeerd,geselecteerdN:geselecteerd.length,statusUitgesloten,selectiePerVc,perDrip,modelBouwjaarN:drips.length-metJaar,bouwjaarDekking:metJaar/drips.length,
    netwerk:mcStats(dripBeschArr),eventStats:mcStats(eventArr),herstelStats:mcStats(herstelArr),
    diensten:Object.fromEntries(DIENSTEN.map(dn=>[dn.id,mcStats(dienstArr[dn.id])])),
    dienstAandelen,scenarios,dripBeschPerJaarStats,dienstPerJaarStats,historieInfo,historieVergelijking,
    cum,herstelPerJaar,herstelPerJaarStats,mttrUren,mttrBron,jaarRuns,
	    model:'Weibull-NHPP minimal repair + historische Gamma-Poisson-kalibratie + cohortaggregatie + MTTR + parameteronzekerheid'};
	  tekenDripMcResult();
	  renderRapport();
	}

function tekenDripMcResult(){
  const host=document.getElementById('dripMcResultHost');
  if(!host) return;
  const R=DRIP_MC; if(!R){ host.innerHTML=''; return; }
  const n=R.netwerk;
  const HI=R.historieInfo||{aan:false,gekoppeldeSelectie:0,incidentenSelectie:0,modelDrips:R.perDrip.length,dekkingDagen:0};

  // KPI's
  const verwUitval=R.eventStats;
  let h=`<div class="mc-kpis">
    <div class="wv-kpi"><div class="l">Periode</div><div class="v" style="font-size:15px;color:var(--rws-blauw)">${esc(R.periodeLabel||R.jaarVan+'–'+R.jaarTot)}</div></div>
    <div class="wv-kpi"><div class="l">DRIP-beschikbaarheid over periode (p50)</div><div class="v" style="color:${beschKleur(n.p50,90)}">${fmt(n.p50,4)}%</div></div>
    <div class="wv-kpi"><div class="l">90%-band (p5–p95)</div><div class="v" style="font-size:17px;color:var(--rws-blauw)">${fmt(n.p5,4)}–${fmt(n.p95,4)}%</div></div>
    <div class="wv-kpi"><div class="l">Aantal storingen (p50)</div><div class="v" style="color:var(--oranje)">${fmt(verwUitval.p50,0)}</div></div>
    ${HI.aan?`<div class="wv-kpi"><div class="l">Historisch gekalibreerd</div><div class="v" style="color:var(--groen)">${HI.gekoppeldeSelectie}</div></div>`:''}
    ${R.vervangJaar?`<div class="wv-kpi"><div class="l">Vervanging geprogrammeerd</div><div class="v" style="color:var(--groen);font-size:17px">${R.vervangJaar}</div></div>`:''}
  </div>`;

  if(R.startGecorrigeerd||R.statusUitgesloten||R.modelBouwjaarN){
    h+=`<div class="calc-warn" style="margin-top:12px"><b>Datakwaliteit.</b> ${R.startGecorrigeerd?'De startdatum lag in het verleden en is naar vandaag verschoven. ':''}${R.statusUitgesloten?`${R.statusUitgesloten} geselecteerde niet-operationele DRIPs zijn niet als actief areaal meegerekend. `:''}${R.modelBouwjaarN?`${R.modelBouwjaarN} DRIPs zonder bouwjaar gebruiken per run een getrokken jaar uit het waargenomen cohort; dit is modeldata en staat in de tabel met “~” aangegeven. `:''}Bouwjaardekking actief areaal: <b>${fmt(R.bouwjaarDekking*100,1)}%</b>.</div>`;
  }
  h+=`<p class="muted" style="font-size:11.5px;margin:8px 0 0"><b>Modelbasis:</b> bouwjaren en locaties komen uit het register. Levensduur en β bepalen de leeftijdstrend. ${HI.aan?`${HI.gekoppeldeSelectie} geselecteerde DRIPs zijn gekalibreerd met ${HI.incidentenSelectie.toLocaleString('nl-NL')} unieke historische incidenten over ${HI.dekkingDagen.toLocaleString('nl-NL')} bron­dagen. De incidentrate krijgt twee priorjaren uit het leeftijdsmodel; de MTTR krijgt vijf priorwaarnemingen uit de assettype-instelling. ${HI.modelDrips} DRIPs zonder passende historische dekking blijven modelgebaseerd.`:'Historische kalibratie staat uit of er is geen gekoppelde DRIP-historie. Levensduur, β en groeps-MTTR zijn daarom modelparameters, tenzij een geladen referentie expliciet een mediane levensduur bevat.'} De voorspellingsband blijft een modeluitkomst, geen meetgarantie.</p>`;
  h+=monteCarloBegeleidendSchrijvenKaart('drip-montecarlo');
  h+=operationeleContextHtml(R.context,'Werkzaamheden en U-routes bij het geselecteerde DRIP-areaal');

  // ── Samenhangende 95%-scenario's ──
  const scenarios=R.scenarios;
  h+=`<div class="card" style="margin-top:16px"><h3>Samenhangende scenario’s (95%-band) ${tip('Iedere kolom is één volledige Monte-Carlo-run. De runs zijn geselecteerd op p2,5, p50 en p97,5 van de DRIP-beschikbaarheid. Storingen, hersteltijd en alle dienstpercentages in een kolom horen daardoor bij exact dezelfde gesimuleerde toekomst.')}</h3>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Grootheid</th>
      <th class="num">Ongunstig scenario<br><span class="muted" style="font-size:10px">p2,5 DRIP-beschikbaarheid</span></th>
      <th class="num">Mediaan scenario<br><span class="muted" style="font-size:10px">p50 DRIP-beschikbaarheid</span></th>
      <th class="num">Gunstig scenario<br><span class="muted" style="font-size:10px">p97,5 DRIP-beschikbaarheid</span></th></tr></thead><tbody>`;
  const scenarioRij=(label,waarde,fmtv)=>{ const f=fmtv||(v=>fmt(v,1)); return `<tr><td>${label}</td><td class="num" style="color:var(--oranje)">${f(waarde(scenarios[0]))}</td><td class="num" style="font-weight:700">${f(waarde(scenarios[1]))}</td><td class="num" style="color:var(--groen)">${f(waarde(scenarios[2]))}</td></tr>`; };
  h+=scenarioRij('Netwerkbrede DRIP-beschikbaarheid (%)',s=>s.dripBesch,v=>fmt(v,4)+'%');
  h+=scenarioRij('DRIP-onbeschikbaarheid (basispunten)',s=>(100-s.dripBesch)*100,v=>fmt(v,3));
  h+=scenarioRij('Aantal storingen in de periode',s=>s.events,v=>fmt(v,0));
  h+=scenarioRij('Herstelinzet in de periode (dagen)',s=>s.herstelDagen,v=>fmt(v,1));
  DIENSTEN.forEach(dn=>{ if((R.dienstAandelen[dn.id]||0)>0) h+=scenarioRij('Dienst: '+dn.naam.replace(/&amp;/g,'&')+' (%)',s=>s.diensten[dn.id],v=>fmt(v,4)+'%'); });
  h+=`</tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">De kolommen zijn geordend van veel naar weinig gewogen DRIP-stilstand. Aantal storingen alleen is niet bepalend: ook functieweging en hersteltijd tellen mee. Meer gewogen stilstand kan binnen hetzelfde scenario nooit tot een hoger dienstpercentage leiden. Eén basispunt is 0,01 procentpunt.</p>
  </div>`;

  // ── Lijngrafiek 1: cumulatieve verwachte storingen ──
  const cum=R.cum;
  h+=`<div class="card"><h3>Cumulatieve verwachte storingen ${tip('Het cumulatieve aantal terugkerende DRIP-storingen uit een leeftijdsafhankelijk Weibull-NHPP/minimal-repair-proces. De p5- en p95-lijnen tonen voorspellingsonzekerheid. Bij geprogrammeerde vervanging reset de leeftijd naar as good as new.')}</h3>
    <div class="chart-wrap">${chartLijn(cum.jaren, [
      {naam:'p5', kleur:'var(--grijs-mid)', data:cum.cumStats.map(s=>s.p5)},
      {naam:'gemiddeld', kleur:'var(--rws-blauw)', data:cum.cum},
      {naam:'p95', kleur:'var(--oranje)', data:cum.cumStats.map(s=>s.p95)}
    ], {markX:R.vervangJaar, yFmt:v=>fmt(v,0)})}</div>
    <div class="chart-legend"><span><i style="background:var(--rws-blauw)"></i>gemiddeld cumulatief</span><span><i style="background:var(--grijs-mid)"></i>p5</span><span><i style="background:var(--oranje)"></i>p95</span>${R.vervangJaar?'<span><i style="background:var(--rood)"></i>vervangingsjaar</span>':''}</div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Aan het einde van de periode (${R.jaarTot}) bedraagt het cumulatieve verwachte aantal storingen <b>${fmt(cum.cum[cum.cum.length-1],1)}</b>. ${R.vervangJaar?`De geprogrammeerde vervanging in ${R.vervangJaar} vlakt de curve daarna af.`:''}</p>
  </div>`;

  // ── Lijngrafiek 2: verwachte storingen per jaar ──
  h+=`<div class="card"><h3>Verwachte storingen per jaar ${tip('Het aantal terugkerende DRIP-storingen per kalenderjaar. De lijn bevat ook gedeeltelijke eerste en laatste jaren. De buitenlijnen zijn p5 en p95 uit maximaal 500 jaarlijkse simulatieruns; de periode-KPI’s gebruiken alle gekozen runs.')}</h3>
    <div class="chart-wrap">${chartLijn(cum.jaren, [
      {naam:'p5', kleur:'var(--grijs-mid)', data:cum.perJaarStats.map(s=>s.p5)},
      {naam:'per jaar', kleur:'var(--oranje)', data:cum.perJaar},
      {naam:'p95', kleur:'var(--rws-blauw-mid)', data:cum.perJaarStats.map(s=>s.p95)}
    ], {markX:R.vervangJaar, yFmt:v=>fmt(v,1)})}</div>
    <div class="chart-legend"><span><i style="background:var(--oranje)"></i>gemiddeld per jaar</span><span><i style="background:var(--grijs-mid)"></i>p5</span><span><i style="background:var(--rws-blauw-mid)"></i>p95</span>${R.vervangJaar?'<span><i style="background:var(--rood)"></i>vervangingsjaar</span>':''}</div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">De piek ligt in <b>${cum.jaren[cum.perJaar.indexOf(Math.max(...cum.perJaar))]}</b> met circa <b>${fmt(Math.max(...cum.perJaar),1)}</b> verwachte uitvallen. ${R.vervangJaar?`Na de vervanging in ${R.vervangJaar} daalt de jaarlijkse uitval.`:''}</p>
  </div>`;

  // ── Lijngrafiek 3: dienstverlies per jaar ──
  const dienstenMetDrip=DIENSTEN.filter(dn=>(R.dienstAandelen[dn.id]||0)>0);
  const verliesSeries=dienstenMetDrip.map(dn=>({
    naam:dn.naam.replace(/&amp;/g,'&'),kleur:dn.kleur,
    data:R.dienstPerJaarStats[dn.id].map(st=>(100-st.p50)*100)
  }));
  const rriVerlies=(R.dienstPerJaarStats.rri||[]).map(st=>(100-st.p50)*100);
  const rriPiek=rriVerlies.length?Math.max(...rriVerlies):0;
  h+=`<div class="card"><h3>Dienstverlies per jaar door DRIP-stilstand ${tip('De mediaan van de jaarlijkse dienstbeschikbaarheid, uitgedrukt als verlies ten opzichte van 100%. Alle diensten gebruiken per run exact dezelfde DRIP-stilstand. De hoogte verschilt alleen door het effectieve DRIP-aandeel in de dienstketen.')}</h3>
    <div class="chart-wrap">${chartLijn(cum.jaren,verliesSeries,{markX:R.vervangJaar,yFmt:v=>fmt(v,2)})}</div>
    <div class="chart-legend">${dienstenMetDrip.map(dn=>`<span><i style="background:${dn.kleur}"></i>${dn.naam.replace(/&amp;/g,'&')}</span>`).join('')}${R.vervangJaar?'<span><i style="background:var(--rood)"></i>vervangingsjaar</span>':''}</div>
    <p class="muted" style="font-size:11.5px;margin-top:8px"><b>Een hogere lijn is slechter.</b> De y-as toont basispunten verlies; 1 basispunt is 0,01 procentpunt. Voor Reis- &amp; route-informatie is de grootste mediane jaarimpact <b>${fmt(rriPiek,3)} basispunt</b>. De percentages blijven dicht bij 100% doordat iedere storing alleen gedurende de gesimuleerde hersteltijd uitval veroorzaakt, maar de richting is nu altijd logisch: meer gewogen stilstand geeft meer dienstverlies.</p>
  </div>`;

  // ── Lijngrafiek 4: verwachte hersteltinzet ──
  h+=`<div class="card"><h3>Verwachte hersteltinzet per jaar ${tip('Gesimuleerde reparatie-inzet per jaar in dagen. Zowel het aantal storingen als de reparatieduur varieert. De MTTR is de centrale waarde per assettype-groep; het register bevat geen per-asset hersteltijd.')}</h3>
    <div class="chart-wrap">${chartLijn(cum.jaren, [
      {naam:'p5', kleur:'var(--grijs-mid)', data:R.herstelPerJaarStats.map(s=>s.p5)},
      {naam:'hersteltduur', kleur:'var(--rws-blauw-mid)', data:R.herstelPerJaar},
      {naam:'p95', kleur:'var(--oranje)', data:R.herstelPerJaarStats.map(s=>s.p95)}
    ], {markX:R.vervangJaar, yFmt:v=>fmt(v,0)})}</div>
    <div class="chart-legend"><span><i style="background:var(--rws-blauw-mid)"></i>gemiddelde herstelinzet</span><span><i style="background:var(--grijs-mid)"></i>p5</span><span><i style="background:var(--oranje)"></i>p95</span>${R.vervangJaar?'<span><i style="background:var(--rood)"></i>vervangingsjaar</span>':''}</div>
    <div class="mttr-bron">${HI.aan?`Voor historisch gekoppelde DRIPs gebruikt de simulatie een <b>per-asset MTTR</b>, berekend uit p95-begrensde betrouwbare duurwaarnemingen en vijf priorwaarnemingen van de assettype-MTTR. Voor de overige DRIPs blijft de centrale MTTR <b>${R.mttrUren} uur</b> (${esc(R.mttrBron||'assettype-groep DRIP')}).`:`MTTR = <b>${R.mttrUren} uur per storing</b>, gemiddelde voor de <b>assettype-groep DRIP</b> (${esc(R.mttrBron||'assettype-groep DRIP')}), niet per individuele asset.`} De standaardwaarde blijft instelbaar in de rule engine.</div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">De gemiddelde lijn gebruikt alle gesimuleerde reparatieduren; p5–p95 maakt de spreiding in onderhoudslast zichtbaar. De piek geeft aan wanneer de capaciteitsvraag het hoogst is.</p>
  </div>`;

  // ── Gevolgen dienstverlening ──
  h+=`<div class="card"><h3>Gevolgen voor de dienstverlening ${tip('Per dienst de gesimuleerde beschikbaarheid over de gekozen periode, uitsluitend als gevolg van DRIP-storingen en hersteltijd. Het getoonde DRIP-aandeel is genormaliseerd over alle gewichten van de dienstketen, gelijk aan de reguliere verrekening.')}</h3>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Dienst</th><th class="num">Effectief DRIP-aandeel</th><th class="num">p50</th><th class="num">p5 (slecht)</th><th class="num">p95 (goed)</th><th class="num">Verlies p50 (bp)</th><th class="num">Norm</th></tr></thead><tbody>`;
  DIENSTEN.forEach(dn=>{
    const st=R.diensten[dn.id]; const wDrip=R.dienstAandelen[dn.id]||0;
    h+=`<tr class="${st.p50<dn.norm?'crit':''}">
      <td>${dn.naam.replace(/&amp;/g,'&')}</td>
      <td class="num">${wDrip?Math.round(wDrip*100)+'%':'–'}</td>
      <td class="num" style="color:${beschKleur(st.p50,dn.norm)};font-weight:700">${fmt(st.p50,4)}</td>
      <td class="num" style="color:var(--oranje)">${fmt(st.p5,4)}</td>
      <td class="num" style="color:var(--groen)">${fmt(st.p95,4)}</td>
      <td class="num">${fmt((100-st.p50)*100,3)}</td>
      <td class="num muted">${fmt(dn.norm,1)}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Alleen de DRIP-schakel varieert; de overige objecttypen staan op 100% zodat het zuivere DRIP-effect zichtbaar is. Vier decimalen en het verlies in basispunten voorkomen dat een klein maar reëel effect wordt afgerond naar 100,00%. Rood = mediaan onder norm.</p>
  </div>`;

  // ── per-DRIP faalkans-tabel ──
  const rijen=R.perDrip.slice().sort((a,b)=>b.faalPeriode-a.faalPeriode);
  h+=`<div class="card"><h3>Faalkans, historie &amp; resterende levensduur per DRIP ${tip('Per DRIP: leeftijd, resterende levensduur, historische incidentrate, verwachte events en kans op ten minste één storing. Bij historische kalibratie wordt de waargenomen rate met twee priorjaren naar het leeftijdsmodel gekrompen en daarna met de Weibull-leeftijdstrend geprojecteerd.')}<span class="badge">${rijen.filter(p=>p.d.bouwjaar).length} met stichtingsjaar</span></h3>
    <div class="tbl-scroll"><table class="tbl"><thead><tr>
      <th>DRIP + locatie</th><th>Weg</th><th class="num">hm</th><th>Fabrikant</th><th class="num">Bouwjr</th><th class="num">Leeftijd</th><th class="num">Levensduur</th><th class="num">EOL</th><th class="num">RUL (jr)</th><th class="num">Hist. incidenten</th><th class="num">Hist. per jaar</th><th class="num">Verw. events periode</th><th class="num">MTTR (uur)</th><th class="num">Faalkans 12 mnd</th><th class="num">Faalkans periode</th><th>Bron</th></tr></thead><tbody>`;
  rijen.forEach(p=>{
    const d=p.d; const fk=p.faalPeriode;
    const kl=fk>0.6?'var(--rood)':fk>0.3?'var(--oranje)':'var(--groen)';
    h+=`<tr class="${fk>0.6?'crit':''}">
      <td class="mono">${esc(dripMemoLabel(d))}</td>
      <td class="mono">${esc(d.weg)} ${esc(d.richting)}</td>
      <td class="num">${d.hm!=null?d.hm.toFixed(1):'—'}</td>
      <td>${esc(d.fabrikant||'—')}</td>
      <td class="num">${d.bouwjaar||'—'}</td>
      <td class="num">${p.leeftijdNu!=null?fmt(p.leeftijdNu,1):'—'}</td>
      <td class="num">${fmt(p.levensduur,0)}</td>
      <td class="num">${p.eol||'—'}</td>
      <td class="num">${p.rul!=null?fmt(p.rul,1):'—'}</td>
      <td class="num">${p.hist?p.hist.n:'—'}</td>
      <td class="num">${p.hist&&p.hist.rate!=null?fmt(p.hist.rate,1):'—'}</td>
      <td class="num">${fmt(p.gemEvents,1)}</td>
      <td class="num">${fmt(p.mttrSim,2)}</td>
      <td class="num">${p.bouwjaarModel?'~ ':''}${fmt(p.faalNu*100,0)}%</td>
      <td class="num" style="color:${kl};font-weight:700">${p.bouwjaarModel?'~ ':''}${fmt(fk*100,0)}%</td>
      <td>${p.historieGekalibreerd?'<span class="tag g">historie</span> ':''}${p.bouwjaarModel?'<span class="tag gy">cohortmodel</span> ':''}${levensduurBronTag(p.etaBron)}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">De leeftijdshazard volgt Weibull; het aantal storingen volgt een minimal-repair/NHPP-proces. Daardoor kunnen meerdere storingen per asset optreden. Historie wordt alleen gebruikt bij voldoende dekking van minimaal 0,25 jaar. RUL is alleen getoond bij een werkelijk bouwjaar.</p>
  </div>`;

  host.innerHTML=h;
  nummerGrafiekenEnTabellen(host);
}

/* ══════════════════════════════════════════════════════════════
   DRIP-AREAAL & MONTE CARLO
   ══════════════════════════════════════════════════════════════ */
function renderDripHistorieKaart(){
  const H=DRIP_HIST_STATE;
  if(!H){
    return `<div class="card"><h3>DRIP-storingshistorie ${tip('Laad één of meer incidentbestanden. De bestaande vlakke CSV/XLSX-indeling en WNN- of WNZ-werkmappen met de tabbladen storingen, datadekking en asset_samenvatting worden automatisch herkend en samengevoegd.')}</h3>
      <p class="muted" style="margin:-6px 0 10px;font-size:12px">Nog geen DRIP-storingshistorie geladen. Dit is een aanvullende bron en vervangt de bestaande DVM-storingslijst of het DRIP-areaal niet.</p>
      <button class="tb-btn primary" onclick="document.getElementById('dripHistInput').click()">⭱ DRIP-storingshistorie laden (.xlsx/.csv)</button>
      <p class="muted" style="font-size:11.5px;margin-top:8px">Bij een werkmap met meerdere tabbladen gebruikt het model alleen het tabblad <b>storingen</b> als incidentenbron. Losse technische alarmepisodes worden niet als afzonderlijke storingen geteld.</p>
    </div>`;
  }
  const K=H.koppeling||{gekoppeldeAssets:0,gekoppeldeIncidenten:0,nietGekoppeldeIncidenten:H.incidenten.length,nietGekoppeldeCodes:[]};
  const periode=H.van!=null&&H.tot!=null?new Date(H.van).toLocaleDateString('nl-NL')+' t/m '+new Date(H.tot).toLocaleDateString('nl-NL'):'onbekend';
  const top=(H.assetStats||[]).slice(0,12);
  let h=`<div class="card"><h3>DRIP-storingshistorie ${tip('Alle geladen DRIP-incidentbestanden worden naar één intern formaat vertaald. Dubbelen met dezelfde regio, asset, start en einde worden één keer meegenomen. De koppeling gebruikt eerst de DRIP-code en anders weg, richting en hectometrering.')}</h3>
    <p class="muted" style="margin:-6px 0 10px;font-size:12px">Bronnen: <b>${H.sources.map(x=>esc(x.name)).join(', ')}</b>. Periode: <b>${periode}</b>.</p>
    <div class="wv-summary">
      <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw)">${H.incidenten.length.toLocaleString('nl-NL')}</div><div class="l">Unieke incidenten</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw-mid)">${H.dekkingDagen.toLocaleString('nl-NL')}</div><div class="l">Gedekte dagen</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--groen)">${K.gekoppeldeAssets}</div><div class="l">Gekoppelde assets</div></div>
      <div class="wv-kpi"><div class="v" style="color:${K.nietGekoppeldeIncidenten?'var(--oranje)':'var(--groen)'}">${K.nietGekoppeldeIncidenten.toLocaleString('nl-NL')}</div><div class="l">Niet gekoppelde incidenten</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw-mid)">${H.duplicaten.toLocaleString('nl-NL')}</div><div class="l">Dubbelen verwijderd</div></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="tb-btn primary" onclick="document.getElementById('dripHistInput').click()">⭱ Historie toevoegen of vervangen</button>
      <button class="tb-btn re-sec" onclick="wisDripHistorie()">Historie wissen</button>
    </div>`;
  h+=`<div class="calc-warn" style="margin-top:12px"><b>Kwaliteitsfilter.</b> ${H.episodesGenegeerd.toLocaleString('nl-NL')} losse alarmepisodes zijn niet als storingen gebruikt. ${H.duurUitgeslotenN.toLocaleString('nl-NL')} incidenten tellen wel mee voor de frequentie, maar niet voor kalibratie van de hersteltijd omdat ze open zijn, geen positieve duur hebben of langer dan 7 dagen duren zonder bevestigde UIT/AAN-status. De overige duren worden voor de MTTR op p95 begrensd${H.duurCapUren!=null?` op ${fmt(H.duurCapUren,1)} uur`:''}.</div>`;
  if(K.nietGekoppeldeCodes&&K.nietGekoppeldeCodes.length) h+=`<p class="muted" style="font-size:11.5px;margin-top:8px">Niet gekoppelde codes: ${K.nietGekoppeldeCodes.slice(0,12).map(c=>`<button class="asset-match-link" onclick="openAssetConfigForLog('${encodeURIComponent(c)}')">${esc(c)}</button>`).join(', ')}${K.nietGekoppeldeCodes.length>12?' en '+(K.nietGekoppeldeCodes.length-12)+' meer':''}. Klik op een code om de betreffende assetconfiguratie te openen.</p>`;
  if(top.length){
    h+=`<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:12px">Assets met de meeste incidenten</summary><div class="tbl-scroll" style="margin-top:8px"><table class="tbl"><thead><tr><th>DRIP + locatie</th><th>Locatie</th><th class="num">Incidenten</th><th class="num">Per jaar</th><th class="num">Betrouwbare uitvaluren</th><th class="num">Duurwaarnemingen</th></tr></thead><tbody>`;
    top.forEach(x=>h+=`<tr><td class="mono">${esc(x.label||x.code||'—')}</td><td class="mono">${esc(dripLocatieLabel(x)||((x.weg||'—')+' '+(x.richting||'')))}</td><td class="num">${x.n}</td><td class="num">${x.rate!=null?fmt(x.rate,1):'—'}</td><td class="num">${fmt(x.betrouwbareDownUren,1)}</td><td class="num">${x.duurN}</td></tr>`);
    h+=`</tbody></table></div></details>`;
  }
  h+=`<p class="muted" style="font-size:11.5px;margin-top:8px">De historie wordt alleen toegepast op DRIPs die werkelijk aan de geladen bron zijn gekoppeld. Andere DRIPs blijven op het leeftijdsafhankelijke Weibull-model. In de Monte Carlo kun je historische kalibratie aan of uit zetten.</p></div>`;
  return h;
}

function renderDrips(){
  const host=document.getElementById('tab-drips');
  if(!host) return;
  const D = STATE && STATE.drips;
  if(!D){
    host.innerHTML=`<div class="card"><h3>DRIP-areaal &amp; Monte Carlo</h3>
      <p class="muted" style="font-size:13px">Nog geen DRIP-areaal geladen. Gebruik <b>“DRIP-areaal laden”</b> rechtsboven om het asset-register te importeren (CSV met o.a. ci-type, fabrikant, wegnummer en ingebruikname/installatiedatum). RIA4- en windwaarschuwing-DRIPs worden op locatie herkend.</p>
      <p class="muted" style="font-size:12px">DRIP telt als volwaardig assettype mee in de dienstverlening (rule engine sectie 1 &amp; 5). De leeftijdshazard gebruikt de assettype-levensduur uit sectie 1, tenzij sectie 7 een expliciete fabrikant/type-levensduur levert.</p>
    </div>`+renderDripHistorieKaart();
    return;
  }

  const metJaar=D.metBouwjaar||D.drips.filter(d=>d.bouwjaar).length;
  const eolLijst=D.drips.filter(d=>d.bouwjaar).map(d=>dripEolJaar(d));
  const nu=new Date().getFullYear();
  const voorbijEol=D.drips.filter(d=>{const e=dripEolJaar(d);return e&&e<=nu;}).length;

  // ── KPI's areaal ──
  let h=`<div class="card"><h3>DRIP-areaal — overzicht ${tip('Het geladen DRIP-areaal met fabrikant, type, stichtingsjaar en de afgeleide EOL (stichtingsjaar + normatieve levensduur). RIA4/wind worden op locatie herkend.')}</h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Bestand: <b>${esc(D.bestand||'—')}</b> · ${D.totaal} DRIPs over ${D.wegen.length} wegen. DRIP telt mee in de dienstverlening (Overzicht) als volwaardig assettype.</p>
    <div class="wv-summary">
      <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw)">${D.totaal}</div><div class="l">DRIPs totaal</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw-mid)">${metJaar}</div><div class="l">Met stichtingsjaar</div></div>
      <div class="wv-kpi"><div class="v" style="color:${voorbijEol?'var(--rood)':'var(--groen)'}">${voorbijEol}</div><div class="l">Voorbij EOL</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--oranje)">${D.ria4}</div><div class="l">RIA4</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--rws-blauw-mid)">${D.wind}</div><div class="l">Windwaarschuwing</div></div>
    </div>
    <div class="wv-summary" style="margin-top:10px">
      <div class="wv-kpi"><div class="v" style="color:var(--groen)">${D.sturen}</div><div class="l">Functie: sturen</div></div>
      <div class="wv-kpi"><div class="v" style="color:var(--rws-geel-d,#b8860b)">${D.informeren}</div><div class="l">Functie: informeren</div></div>
      <div class="wv-kpi"><div class="v mono" style="font-size:13px;color:var(--rws-blauw)">${D.fabrikanten.slice(0,4).join(', ')||'—'}</div><div class="l">Fabrikanten (${D.fabrikanten.length})</div></div>
    </div>`;
  if(!metJaar){
    h+=`<div class="calc-warn" style="margin-top:12px">Geen stichtingsjaren gevonden in dit bestand. De leeftijdsafhankelijke Monte Carlo vereist een asset-register met een installatieveld zoals <b>ingebruikname</b>, <b>installatiedatum</b>, <b>datum-in-dienst</b> of <b>bouwjaar</b>.</div>`;
  }
  h+=`</div>`;

  // ── Historische DRIP-incidenten ──
  h+=renderDripHistorieKaart();

  // ── RIA4/wind matchen ──
  h+=`<div class="card"><h3>RIA4 &amp; windwaarschuwing — matchen op locatie ${tip('Laad de selectielijst met RIA4- en windwaarschuwing-DRIPs (xlsx met Dynac-namen). Die worden op weg + hm (±0,5 km) gematcht met dit asset-register, zodat elke gematchte DRIP zijn RIA4/wind-kenmerk krijgt.')}</h3>
    <p class="muted" style="margin:-6px 0 10px;font-size:12px">Nu herkend: <b>${D.ria4}</b> RIA4 · <b>${D.wind}</b> windwaarschuwing. Laad de selectielijst (Dynac) om te matchen.</p>
    <button class="tb-btn" onclick="document.getElementById('dripFlagInput').click()">⭱ RIA4/wind-selectielijst laden (.xlsx)</button>
    <input type="file" id="dripFlagInput" accept=".xlsx,.xls" class="hidden">
    <span id="dripFlagStatus" class="re-status"></span>
  </div>`;

  // ── Monte Carlo ──
  const nuDag=new Date(), nuJr=nuDag.getFullYear(), dripTot=new Date(); dripTot.setFullYear(dripTot.getFullYear()+10);
  const histGate=dripHistorieGereedheid();
  const histBeschikbaar=histGate.genoeg;
  const dripMcGereed=berekenGereedheid().mcDrip;
  h+=`<div class="card"><h3 style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span>Monte Carlo — uitval o.b.v. levensduurmodel en storingshistorie, gevolg voor de dienstverlening ${tip('Simuleert terugkerende DRIP-storingen met een leeftijdsafhankelijk Weibull-NHPP-proces. Expliciete EOL heeft voorrang; anders gebruikt het model de ingestelde generieke levensduur en β. Voor gekoppelde DRIPs kan de waargenomen incidentfrequentie en hersteltijd als kalibratie worden gebruikt.')}</span><button class="memo-knop" onclick="opentMemo('drip-montecarlo')">📄 Begeleidend schrijven</button></h3>
    <div class="mc-controls">
      <label>Van <input type="date" id="dripMcVan" value="${isoDatumLokaal(nuDag)}"></label>
      <label>Tot en met <input type="date" id="dripMcTot" value="${isoDatumLokaal(dripTot)}"></label>
      <label>Runs <select id="dripMcRuns"><option>2000</option><option selected>5000</option><option>10000</option></select></label>
      <label style="display:flex;align-items:center;gap:6px;text-transform:none;font-weight:600"><input type="checkbox" id="dripMcVervang" onchange="document.getElementById('dripMcVervangJaar').disabled=!this.checked"> Vervanging geprogrammeerd?</label>
      <label>Vervangingsjaar <input type="number" id="dripMcVervangJaar" min="${nuJr}" max="${nuJr+40}" value="${nuJr+8}" disabled style="width:90px"></label>
      <label style="display:flex;align-items:center;gap:6px;text-transform:none;font-weight:600"><input type="checkbox" id="dripMcHistorie" ${histBeschikbaar?'checked':'disabled'}> Historie kalibreren</label>
      <button class="tb-btn primary" onclick="runDripMonteCarlo()" ${dripMcGereed?'':'disabled'}>▶ Simulatie draaien</button>
    </div>
    <p class="muted" style="font-size:11.5px;margin:2px 0 0"><b>${dripSelectieAantal()}</b> van ${D.drips.length} DRIPs geselecteerd. Alleen operationele geselecteerde assets vormen actief prognoseareaal. ${histBeschikbaar?`${DRIP_HIST_STATE.koppeling.gekoppeldeAssets} assets hebben voldoende historische dekking; de frequentie wordt met twee priorjaren naar het leeftijdsmodel gekrompen en volgt daarna weer de Weibull-leeftijdstrend.`:`De simulatie blijft geblokkeerd: ${esc(histGate.reden||'de DRIP-historie is nog onvoldoende.')}`}</p>
    <div id="dripMcResultHost"><p class="muted" style="font-size:12px;margin-top:10px">Nog niet gedraaid. ${metJaar?`Klaar om te simuleren met ${metJaar} DRIPs met stichtingsjaar. Ontbrekende bouwjaren worden, indien aanwezig, zichtbaar als cohortmodel meegenomen.`:'Er zijn nog geen stichtingsjaren geladen. Laad het <b>asset-register</b> (CSV met o.a. ci-type, fabrikant en ingebruikname/installatiedatum) via “DRIP-areaal laden”. Zonder ten minste één werkelijk bouwjaar wordt geen leeftijdsprognose gemaakt.'}</p></div>
  </div>`;

  // ── Areaaltabel ──
  const rijen=D.drips.slice().sort((a,b)=>(a.weg||'').localeCompare(b.weg||'')||(a.hm||0)-(b.hm||0));
  const _selN=dripSelectieAantal(), _selTot=D.drips.length;
  const _allChecked=_selN>0 && _selN===_selTot;
  const _indet=_selN>0 && _selN<_selTot;
  const _windStatus=dripCategorieStatus('wind'),_ria4Status=dripCategorieStatus('ria4');
  h+=`<div class="card"><h3>DRIP-areaal — details &amp; prognoseselectie ${tip('Vink per DRIP aan of deze in de Monte Carlo-prognose meegaat. De selectie wordt in je browser bewaard en blijft na herladen behouden. De simulatie rekent alleen met de aangevinkte DRIPs.')}</h3>
    <div class="drip-sel-bar">
      <label class="drip-master"><input type="checkbox" id="dripMasterToggle" ${_allChecked?'checked':''} onchange="dripMasterToggle(this.checked)"> <b>Alles aan/uit</b></label>
      <label class="drip-master" title="Voeg alle windwaarschuwings-DRIPs toe of verwijder ze uit de prognoseselectie"><input type="checkbox" id="dripWindToggle" ${_windStatus.alles?'checked':''} ${_windStatus.totaal?'':'disabled'} onchange="dripCategorieToggle('wind',this.checked)"> <b>Windwaarschuwing</b> (${_windStatus.totaal})</label>
      <label class="drip-master" title="Voeg alle RIA4-DRIPs toe of verwijder ze uit de prognoseselectie"><input type="checkbox" id="dripRia4Toggle" ${_ria4Status.alles?'checked':''} ${_ria4Status.totaal?'':'disabled'} onchange="dripCategorieToggle('ria4',this.checked)"> <b>RIA4</b> (${_ria4Status.totaal})</label>
      <span id="dripSelTeller" class="drip-sel-teller">${_selN} van ${_selTot} geselecteerd</span>
      <div class="drip-sel-knoppen">
        <button class="tb-btn re-sec" onclick="dripSelectieActie('eol')">Voorbij EOL</button>
      </div>
    </div>
    <p class="muted" style="font-size:11.5px;margin:-3px 0 10px">Voor alleen windwaarschuwing of RIA4 zet je eerst <b>Alles</b> uit en daarna de gewenste groep aan. Een half gevuld vinkvak betekent dat een deel van die groep is geselecteerd.</p>
    <div class="tbl-scroll"><table class="tbl"><thead><tr>
      <th style="width:34px;text-align:center"><input type="checkbox" id="dripMasterToggleKop" title="Alles aan/uit" ${_allChecked?'checked':''} onchange="dripMasterToggle(this.checked)"></th><th>DRIP + locatie</th><th>Weg</th><th>Ri.</th><th class="num">hm</th><th>Fabrikant</th><th>Type</th><th class="num">Bouwjr</th><th class="num">EOL</th><th class="num">Hist. incidenten</th><th class="num">Hist. per jaar</th><th>Functie</th><th>RIA4/wind</th></tr></thead><tbody>`;
  rijen.forEach(d=>{
    const eol=dripEolJaar(d);
    const voorbij=eol&&eol<=nu;
    const sel=dripGeselecteerd(d);
    h+=`<tr class="${voorbij?'crit':''}${sel?'':' drip-uit'}">
      <td style="text-align:center"><input type="checkbox" data-drip-uid="${esc(encodeURIComponent(d.uid))}" ${sel?'checked':''} onchange="toggleDripSelectie('${esc(d.uid).replace(/'/g,"\\'")}',this.checked)"></td>
      <td class="mono">${esc(dripMemoLabel(d))}</td>
      <td class="mono">${esc(d.weg)}</td><td>${esc(d.richting)}</td>
      <td class="num">${d.hm!=null?d.hm.toFixed(1):'—'}</td>
      <td>${esc(d.fabrikant||'—')}</td>
      <td>${esc(d.type||'—')}</td>
      <td class="num">${d.bouwjaar||'—'}</td>
      <td class="num" style="${voorbij?'color:var(--rood);font-weight:700':''}">${eol||'—'}</td>
      <td class="num">${d._hist?d._hist.n:'—'}</td>
      <td class="num">${d._hist&&d._hist.rate!=null?fmt(d._hist.rate,1):'—'}</td>
      <td>${esc(d.functieLabel)}</td>
      <td>${d.ria4?'<b style="color:var(--oranje)">RIA4</b> ':''}${d.wind?'<b style="color:var(--rws-blauw-mid)">wind</b>':''}${!d.ria4&&!d.wind?'–':''}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Vink DRIPs aan/uit om ze in de prognose mee te nemen; de keuze blijft in je browser bewaard. Rood = voorbij indicatieve levensduur. Locatie gebruikt eerst de assetnaam en anders wegtype uit BPS, baanpositie, hm-bord plus afstand tot hm-bord.</p>
  </div>`;

  host.innerHTML=h;
  nummerGrafiekenEnTabellen(host);

  // zet de indeterminate-staat van de master-vinkboxen (kan niet in HTML)
  ['dripMasterToggle','dripMasterToggleKop'].forEach(id=>{ const cb=document.getElementById(id); if(cb) cb.indeterminate=_indet; });
  const windCb=document.getElementById('dripWindToggle');if(windCb)windCb.indeterminate=_windStatus.deel;
  const ria4Cb=document.getElementById('dripRia4Toggle');if(ria4Cb)ria4Cb.indeterminate=_ria4Status.deel;

  // koppel de flag-list import
  const fi=document.getElementById('dripFlagInput');
  if(fi) fi.addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)leesDripFlagBestand(f);});
}

/* Laad de RIA4/wind-selectielijst en match op locatie tegen het asset-register. */
function leesDripFlagBestand(file){
  const D=(STATE&&STATE.drips)||DRIP_STATE;
  if(!D){ alert('Laad eerst het DRIP-asset-register.'); return; }
  const rd=new FileReader();
  rd.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rijen=XLSX.utils.sheet_to_json(ws,{defval:''});
      const n=matchRia4Wind(D.drips, rijen);
      // herbereken aggregaties
      D.ria4=D.drips.filter(d=>d.ria4).length;
      D.wind=D.drips.filter(d=>d.wind).length;
      ANALYSE_SIGNATURE='';probeerAnalyseActiveren('drips');
      const st=document.getElementById('dripFlagStatus');
      if(st){ st.textContent=`✓ ${n} DRIPs gematcht — ${D.ria4} RIA4, ${D.wind} wind`; st.className='re-status ok'; }
    }catch(err){ alert('Kon de selectielijst niet verwerken: '+err.message); console.error(err); }
  };
  rd.readAsArrayBuffer(file);
}

/* Laad de EOL-referentie (fabrikant-factsheets) pas na All Assets. */
async function leesEolReferentie(file){
  if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets. De EOL-referentie is stap 2 en wordt tegen de geladen assets getoetst.');renderDataGereedheid();return;}
  const isCsv=/\.csv$/i.test(file.name);
  try{
    zetImportVoortgang(file.name,0,'EOL-referentie controleren',{direct:true});await uiPauze();
    let csvFs=';',buffer;
    if(isCsv){
      const kopTekst=(await file.slice(0,65536).text()).replace(/^\uFEFF/,'');
      const kop=(kopTekst.split(/\r?\n/,1)[0]||'');csvFs=csvScheidingLicht(kop);
      const kolommen=kop.split(csvFs).map(x=>x.replace(/^"|"$/g,'').trim().toLowerCase());
      const isRef=kolommen.includes('rule_id')&&kolommen.some(x=>['life_median_years','public_eol_date','manufacturer_regex','model_regex'].includes(x));
      if(!isRef){
        if(kolommen.includes('asset')&&kolommen.includes('ci-type'))throw new Error('dit is een assetlijst en geen EOL-referentie. Laad dit bestand bij stap 1 via All Assets');
        throw new Error('vereiste EOL-kolommen ontbreken, waaronder rule_id en life_median_years of public_eol_date');
      }
    }
    zetImportVoortgang(file.name,25,'EOL-bestand lezen',{direct:true});await uiPauze();buffer=await file.arrayBuffer();
    let rijen;
    if(isCsv){
      const txt=new TextDecoder('utf-8').decode(new Uint8Array(buffer)).replace(/^\uFEFF/,'');
      const wb=XLSX.read(txt,{type:'string',FS:csvFs,raw:true});
      rijen=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    }else{
      const wb=XLSX.read(buffer,{type:'array'});
      rijen=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    }
    zetImportVoortgang(file.name,55,'EOL-regels valideren',{direct:true});await uiPauze();
    const regels=rijen.map(r=>{
      const g=k=>{ for(const kk of Object.keys(r)){ if(kk.toLowerCase().trim()===k) return r[kk]; } return ''; };
      const mkRe=s=>{ s=String(s||'').trim(); if(!s||s==='.*') return s==='.*'?/.*/i:null; try{return new RegExp(s,'i');}catch(e){return null;} };
      const lm=parseFloat(g('life_median_years'));
      const lmin=parseFloat(g('life_min_years')),lmax=parseFloat(g('life_max_years'));
      return {rule_id:g('rule_id'),fabRe:mkRe(g('manufacturer_regex')),modRe:mkRe(g('model_regex')),
        klassen:String(g('asset_classes')||'').split('|').map(x=>x.trim().toUpperCase()).filter(Boolean),family:g('product_family'),
        status:g('public_status'),eol_date:g('public_eol_date'),life_min:isNaN(lmin)?null:lmin,life_max:isNaN(lmax)?null:lmax,
        life_median:isNaN(lm)?null:lm,evidence:g('evidence_level'),confidence:g('confidence'),source_url:g('source_url'),source_note:g('source_note')};
    }).filter(r=>r.rule_id);
    if(!regels.length)throw new Error('geen geldige EOL-referentieregels gevonden');
    EOL_REF=regels;EOL_BRON_NAAM=file.name;EOL_VERSIE++;
    zetImportVoortgang(file.name,72,'EOL-regels aan het assetregister koppelen',{direct:true});await uiPauze();
    const D=(STATE&&STATE.drips)||DRIP_STATE;
    if(D){D.drips.forEach(d=>{d._eolRef=eolRegelVoor(d.fabrikant,d.model||d.type,'DRIP');d._rel=null;});}
    herberekenRegisterDekking();ANALYSE_SIGNATURE='';MC_RESULT=null;DRIP_MC=null;
    zetImportVoortgang(file.name,94,'Levensduurbronnen en analysepoorten bijwerken',{direct:true});await uiPauze();
    probeerAnalyseActiveren(D&&D.drips&&D.drips.length?'drips':'overzicht',{inspectieAlGereed:true,matchAlGereed:true});
    const st=document.getElementById('eolStatus'),metJaar=EOL_REF.filter(r=>r.life_median!=null).length;
    if(st){st.textContent=`✓ ${EOL_REF.length} EOL-regels geladen (${metJaar} met levensduur)`;st.className='re-status ok';}
    importKlaar(file.name,`${EOL_REF.length} EOL-regels gekoppeld aan het stamregister.`);
  }catch(err){importMislukt(file.name,err.message);alert('Kon de EOL-referentie niet verwerken: '+err.message);console.error(err);}
}

function toonRuleSubtab(tab){
  ASSET_CFG_UI.subtab=tab==='assets'?'assets':'regels';
  const rp=document.getElementById('rulePaneRules'),ap=document.getElementById('rulePaneAssets');
  if(ap&&ASSET_CFG_UI.subtab==='assets'&&ap.dataset.geladen!=='1'){
    ap.innerHTML=renderAssetConfigPane();ap.dataset.geladen='1';
  }
  if(rp)rp.classList.toggle('hidden',ASSET_CFG_UI.subtab!=='regels');
  if(ap)ap.classList.toggle('hidden',ASSET_CFG_UI.subtab!=='assets');
  const rb=document.getElementById('ruleSubRegels'),ab=document.getElementById('ruleSubAssets');
  if(rb)rb.classList.toggle('active',ASSET_CFG_UI.subtab==='regels');
  if(ab)ab.classList.toggle('active',ASSET_CFG_UI.subtab==='assets');
}
function assetConfigGroepVoor(logId){
  return ASSET_MATCH_STATE&&ASSET_MATCH_STATE.groepen?ASSET_MATCH_STATE.groepen.find(g=>assetLogSleutel(g.id)===assetLogSleutel(logId)):null;
}
function openAssetConfigForLog(encoded){
  let logId=String(encoded||'');try{logId=decodeURIComponent(logId);}catch(e){}
  const groep=assetConfigGroepVoor(logId);
  ASSET_CFG_UI.subtab='assets';ASSET_CFG_UI.pendingLogId=logId;ASSET_CFG_UI.focusKey='';
  ASSET_CFG_UI.type=groep&&groep.typeId?groep.typeId:'';
  ASSET_CFG_UI.query=groep&&(!groep.suggesties||!groep.suggesties.length)?[groep.weg,groep.richting,groep.hm!=null?groep.hm:''].filter(Boolean).join(' '):'';
  toonTab('regels');renderRegels();toonRuleSubtab('assets');
  setTimeout(()=>{const el=document.getElementById('assetConfigFouten');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},0);
}
function assetCfgMelding(tekst,goed){
  const el=document.getElementById('assetCfgStatus');if(!el)return;el.textContent=tekst;el.style.color=goed===false?'var(--rood)':'var(--groen)';
}
function assetConfigZoek(v){ASSET_CFG_UI.query=v||'';if(ASSET_CFG_UI.zoekTimer)clearTimeout(ASSET_CFG_UI.zoekTimer);ASSET_CFG_UI.zoekTimer=setTimeout(renderAssetConfigLijst,160);}
function assetConfigType(v){ASSET_CFG_UI.type=v||'';renderAssetConfigLijst();}
function assetConfigTolerantie(el){
  const v=parseFloat(el.value);if(!(v>=.01&&v<=5)){assetCfgMelding('Kies een tolerantie tussen 0,01 en 5 km.',false);return;}
  assetConfigBasis().hmTolerantieKm=v;assetCfgMelding('Tolerantie gewijzigd. Klik op Toepassen om opnieuw te matchen.');
}
function assetConfigVeld(keyEnc,veld,el){
  let key=keyEnc;try{key=decodeURIComponent(keyEnc);}catch(e){}
  const cfg=assetConfigBasis(),ov=cfg.overrides[key]||(cfg.overrides[key]={});
  if(el.value==='')delete ov[veld];else{
    const v=parseFloat(el.value);if(isNaN(v)){assetCfgMelding('Ongeldige numerieke waarde.',false);return;}ov[veld]=v;
  }
  if(!Object.keys(ov).length)delete cfg.overrides[key];
  assetCfgMelding('Assetwijziging klaar. Klik op Toepassen & herberekenen.');
}
function assetConfigHerbereken(bericht){
  ASSET_CONFIG_VERSIE++;ASSET_CFG_UI.subtab='assets';ANALYSE_SIGNATURE='';MC_RESULT=null;DRIP_MC=null;
  if(ASSET_REGISTER_STATE){ASSET_REGISTER_STATE._assetConfigVersie=-1;herberekenRegisterDekking();}
  const D=(STATE&&STATE.drips)||DRIP_STATE;if(D&&D.drips)D.drips.forEach(d=>{d._rel=null;});
  if(DRIP_HIST_STATE)koppelDripHistorieAanAreaal({slaMatchBeeldOver:true});
  if(STORINGSBRONNEN.length)STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
  herbouwAssetMatchBeeld();probeerAnalyseActiveren('regels',{inspectieAlGereed:true,matchAlGereed:true});
  setTimeout(()=>assetCfgMelding(bericht||'Assetconfiguratie toegepast.'),0);
}
function assetConfigKoppel(logEnc,keyEnc){
  let logId=logEnc,key=keyEnc;try{logId=decodeURIComponent(logEnc);key=decodeURIComponent(keyEnc);}catch(e){}
  if(!ASSET_INDEX||!ASSET_INDEX.byKey.has(key)){assetCfgMelding('Het gekozen asset staat niet meer in de geladen assetlijst.',false);return;}
  const cfg=assetConfigBasis(),lk=assetLogSleutel(logId);cfg.aliases[lk]=key;cfg.aliasLabels[lk]=logId;
  delete cfg.uitgeslotenLogIds[lk];delete cfg.uitgeslotenLabels[lk];
  ASSET_CFG_UI.pendingLogId='';ASSET_CFG_UI.focusKey=key;ASSET_CFG_UI.query=ASSET_INDEX.byKey.get(key).naam;
  assetConfigHerbereken(`${logId} is gekoppeld aan ${ASSET_INDEX.byKey.get(key).naam}.`);
}
function assetConfigKoppelBesteAlle(){
  const groepen=((ASSET_MATCH_STATE&&ASSET_MATCH_STATE.groepen)||[]).filter(g=>g.suggesties&&g.suggesties[0]&&ASSET_INDEX&&ASSET_INDEX.byKey.has(g.suggesties[0].key));
  if(!groepen.length){assetCfgMelding('Er zijn geen foutgroepen met een beste kandidaat.',false);return;}
  if(!confirm(`Koppel ${groepen.length} foutgroep(en) aan de beste kandidaat die nu per groep wordt getoond? Groepen zonder kandidaat blijven handmatig openstaan.`))return;
  const cfg=assetConfigBasis();
  groepen.forEach(g=>{
    const lk=assetLogSleutel(g.id),key=g.suggesties[0].key;
    cfg.aliases[lk]=key;cfg.aliasLabels[lk]=g.id;
    delete cfg.uitgeslotenLogIds[lk];delete cfg.uitgeslotenLabels[lk];
  });
  ASSET_CFG_UI.pendingLogId='';ASSET_CFG_UI.focusKey='';ASSET_CFG_UI.query='';
  assetConfigHerbereken(`${groepen.length} foutgroep(en) gekoppeld aan de getoonde beste kandidaat. De overige groepen blijven handmatig.`);
}
function assetConfigExport(){
  const bundle={
    formaat:'DVM-assetconfiguratie',versie:1,opgeslagen:new Date().toISOString(),
    assetregister:ASSET_REGISTER_STATE?{bestand:ASSET_REGISTER_STATE.bestand,aantal:ASSET_REGISTER_STATE.assets.length}:null,
    assetConfig:JSON.parse(JSON.stringify(assetConfigBasis()))
  };
  const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='dvm-assetconfiguratie.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  assetCfgMelding('Volledige assetconfiguratie geëxporteerd.');
}
function assetConfigImport(file){
  if(!file)return;
  const rd=new FileReader();
  rd.onload=e=>{
    try{
      const bundle=JSON.parse(e.target.result),bron=bundle&&bundle.assetConfig?bundle.assetConfig:bundle;
      if(!bron||typeof bron!=='object'||Array.isArray(bron))throw new Error('geen geldige assetconfiguratie gevonden');
      const bestaand=assetConfigBasis(),heeftBestaand=Object.keys(bestaand.aliases||{}).length||Object.keys(bestaand.uitgeslotenLogIds||{}).length||Object.keys(bestaand.overrides||{}).length;
      if(heeftBestaand&&!confirm('Vervang de huidige koppelingen, uitsluitingen en individuele assetinstellingen door het gekozen bestand?'))return;
      const tol=Number(bron.hmTolerantieKm);
      RULES.assetConfig={
        hmTolerantieKm:tol>=.01&&tol<=5?tol:.35,
        aliases:{...(bron.aliases||{})},aliasLabels:{...(bron.aliasLabels||{})},
        uitgeslotenLogIds:{...(bron.uitgeslotenLogIds||{})},uitgeslotenLabels:{...(bron.uitgeslotenLabels||{})},
        overrides:{...(bron.overrides||{})}
      };
      const missendeKeys=ASSET_INDEX?uniekeWaarden([...Object.values(RULES.assetConfig.aliases),...Object.keys(RULES.assetConfig.overrides)].filter(k=>!ASSET_INDEX.byKey.has(k))).length:0;
      assetConfigHerbereken(`Assetconfiguratie geïmporteerd${missendeKeys?`; ${missendeKeys} verwijzing(en) bestaan niet in de huidige assetlijst en vragen controle`:''}.`);
    }catch(err){alert('Kon de assetconfiguratie niet importeren: '+err.message);}
  };
  rd.readAsText(file);
}
function assetConfigBuitenAreaal(logEnc){
  let logId=logEnc;try{logId=decodeURIComponent(logEnc);}catch(e){}
  if(!confirm(`Markeer ${logId} als buiten het geladen areaal? De incidenten blijven zichtbaar in het storingsbeeld, maar tellen niet mee voor asset-specifieke EOL- en Monte Carlo-kalibratie.`))return;
  const cfg=assetConfigBasis(),lk=assetLogSleutel(logId);cfg.uitgeslotenLogIds[lk]=true;cfg.uitgeslotenLabels[lk]=logId;
  delete cfg.aliases[lk];delete cfg.aliasLabels[lk];ASSET_CFG_UI.pendingLogId='';
  assetConfigHerbereken(`${logId} is verantwoord gemarkeerd als buiten het geladen areaal.`);
}
function assetConfigVerwijderAlias(keyEnc){
  let lk=keyEnc;try{lk=decodeURIComponent(keyEnc);}catch(e){}const cfg=assetConfigBasis();delete cfg.aliases[lk];delete cfg.aliasLabels[lk];assetConfigHerbereken('Handmatige koppeling verwijderd.');
}
function assetConfigVerwijderUitsluiting(keyEnc){
  let lk=keyEnc;try{lk=decodeURIComponent(keyEnc);}catch(e){}const cfg=assetConfigBasis();delete cfg.uitgeslotenLogIds[lk];delete cfg.uitgeslotenLabels[lk];assetConfigHerbereken('Uitsluiting verwijderd; de logcode wordt opnieuw gematcht.');
}
function assetConfigResetAsset(keyEnc){
  let key=keyEnc;try{key=decodeURIComponent(keyEnc);}catch(e){}delete assetConfigBasis().overrides[key];ASSET_CFG_UI.focusKey=key;assetConfigHerbereken('Individuele assetwaarden zijn hersteld naar de bron- en groepsregels.');
}
function assetConfigSelectie(){
  if(!ASSET_REGISTER_STATE)return {rijen:[],totaal:0};
  const q=normAssetTekst(ASSET_CFG_UI.query),tp=ASSET_CFG_UI.type;
  const pending=ASSET_CFG_UI.pendingLogId?assetConfigGroepVoor(ASSET_CFG_UI.pendingLogId):null;
  const suggestieKeys=new Set((pending&&pending.suggesties||[]).map(a=>a.key));
  let a=ASSET_REGISTER_STATE.assets;
  if(tp)a=a.filter(x=>x.tp===tp);
  if(pending&&!q&&suggestieKeys.size)a=a.filter(x=>suggestieKeys.has(x.key));
  if(q)a=a.filter(x=>normAssetTekst([x.naam,x.entityid,x.code,x.weg,x.richting,x.hm,x.fabrikant,x.model].join(' ')).includes(q));
  if(pending&&suggestieKeys.size)a=a.slice().sort((x,y)=>(suggestieKeys.has(y.key)?1:0)-(suggestieKeys.has(x.key)?1:0)||String(x.naam).localeCompare(String(y.naam)));
  else a=a.slice().sort((x,y)=>String(x.weg).localeCompare(String(y.weg))||(x.hm||0)-(y.hm||0)||String(x.naam).localeCompare(String(y.naam)));
  return {rijen:a.slice(0,80),totaal:a.length,pending};
}
function renderAssetConfigLijstHtml(){
  const sel=assetConfigSelectie(),cfg=assetConfigBasis();
  if(!sel.rijen.length)return `<div class="asset-config-note">Geen asset in All Assets past bij dit filter. Dat betekent niet dat een nieuw asset mag worden verzonnen. Pas de zoekopdracht aan, laad een actuelere assetlijst of markeer de logidentiteit gemotiveerd als buiten areaal.</div>`;
  let h=`<p class="muted" style="font-size:11.5px;margin:8px 0">${sel.totaal.toLocaleString('nl-NL')} assets gevonden${sel.totaal>sel.rijen.length?`; de eerste ${sel.rijen.length} worden getoond`:''}. Open een asset om de individuele rekenwaarden te wijzigen.</p>`;
  sel.rijen.forEach((a,idx)=>{
    const ov=cfg.overrides[a.key]||{},geconfigureerd=Object.keys(ov).length>0;
    const rel=assetReliability({...a,assetType:a.tp,_assetKey:a.key,_eolLife:a.eolLevensduur,_eolLifeBron:a.eolLevensduurBron});
    const eolJaar=a.bouwjaar?Math.round(a.bouwjaar+rel.L):null;
    const aliases=Object.entries(cfg.aliases).filter(([,v])=>v===a.key).map(([k])=>cfg.aliasLabels[k]||k);
    const keyE=encodeURIComponent(a.key),pending=ASSET_CFG_UI.pendingLogId;
    const open=ASSET_CFG_UI.focusKey===a.key||!!pending&&idx<5;
    const val=k=>ov[k]!=null?esc(ov[k]):'';
    h+=`<details class="asset-config-row ${ASSET_CFG_UI.focusKey===a.key?'asset-config-focus':''}" ${open?'open':''}><summary><div><b>${esc(a.naam)}</b><div class="muted mono" style="font-size:10.5px;margin-top:3px">${esc(a.entityid||a.key)} · ${esc(a.weg)} ${esc(a.richting||'')} ${a.hm!=null?'hm '+fmt(a.hm,3):''}${a.strook?' · positie '+esc(a.strook):''} · ${esc(a.status||'status onbekend')}</div></div><span class="pill ${geconfigureerd?'geel':a.prognoseActief?'groen':'rood'}">${geconfigureerd?'individueel ingesteld':a.prognoseActief?'actief · bronregels':'alleen historische referentie'}</span></summary><div class="asset-config-body">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div class="muted" style="font-size:11.5px"><b>${esc(a.tp)}</b> · ${esc(a.fabrikant||'fabrikant onbekend')} · ${esc(a.model||'model onbekend')} · bouwjaar ${a.bouwjaar||'onbekend'} · effectieve EOL ${eolJaar||'onbekend'} · bron ${esc(rel.bron)}</div>${pending?`<button class="asset-koppel-btn primary" onclick="assetConfigKoppel('${encodeURIComponent(pending)}','${keyE}')">Koppel ${esc(pending)} aan dit asset</button>`:''}</div>
      ${aliases.length?`<div style="margin-top:8px">${aliases.map(x=>`<span class="asset-alias">logalias ${esc(x)}</span>`).join('')}</div>`:''}
      <div class="asset-config-fields">
        <label>Zwaartefactor<input type="number" min="0" max="5" step="0.05" value="${val('impactFactor')}" placeholder="1,00" onchange="assetConfigVeld('${keyE}','impactFactor',this)"></label>
        <label>Factor beschikbaarheid<input type="number" min="0" max="5" step="0.05" value="${val('fAvail')}" placeholder="1,00" onchange="assetConfigVeld('${keyE}','fAvail',this)"></label>
        <label>Factor prestatie<input type="number" min="0" max="5" step="0.05" value="${val('fPerf')}" placeholder="1,00" onchange="assetConfigVeld('${keyE}','fPerf',this)"></label>
        <label>Levensduur B50 (jaar)<input type="number" min="1" max="100" step="0.5" value="${val('levensduur')}" placeholder="${fmt(rel.L,1)}" onchange="assetConfigVeld('${keyE}','levensduur',this)"></label>
        <label>Weibull β<input type="number" min="1.01" max="10" step="0.05" value="${val('beta')}" placeholder="${fmt(rel.beta,2)}" onchange="assetConfigVeld('${keyE}','beta',this)"></label>
        <label>MTTR (uur)<input type="number" min="0.1" max="720" step="0.5" value="${val('mttr')}" placeholder="${fmt((assetTypeRec(a.tp)||{}).mttr||RULES.cfg.hw_mttr,1)}" onchange="assetConfigVeld('${keyE}','mttr',this)"></label>
      </div>
      <div class="asset-fout-acties"><button onclick="assetConfigResetAsset('${keyE}')">Herstel bron- en groepsregels</button></div>
    </div></details>`;
  });
  return h;
}
function renderAssetConfigLijst(){const host=document.getElementById('assetConfigListHost');if(host)host.innerHTML=renderAssetConfigLijstHtml();}
function renderAssetConfigPane(){
  if(!ASSET_REGISTER_STATE)return `<div class="card"><h3>Assetconfiguratie</h3><div class="asset-config-note">Laad eerst All Assets. Zonder canonieke assetlijst kunnen locatie, bouwjaar en EOL niet verantwoord aan storingsregels worden gekoppeld.</div></div>`;
  const cfg=assetConfigBasis(),M=ASSET_MATCH_STATE||{totaal:0,gekoppeld:0,nietGekoppeld:0,uitgesloten:0,groepen:[]};
  const ovN=Object.keys(cfg.overrides).length,aliasN=Object.keys(cfg.aliases).length;
  const bestN=(M.groepen||[]).filter(g=>g.suggesties&&g.suggesties[0]&&ASSET_INDEX&&ASSET_INDEX.byKey.has(g.suggesties[0].key)).length;
  const foutRijen=(M.groepen||[]).slice(0,40);
  let fouten=foutRijen.length?foutRijen.map(g=>{
    const best=g.suggesties&&g.suggesties[0];const loc=[g.weg,g.richting,g.hm!=null?'hm '+fmt(g.hm,3):''].filter(Boolean).join(' ');
    return `<div class="asset-fout"><div class="asset-fout-kop"><div><button class="asset-match-link" onclick="openAssetConfigForLog('${encodeURIComponent(g.id)}')">${esc(g.id)}</button> <span class="tag o">${esc(g.typeId)}</span><div class="muted" style="font-size:11px;margin-top:3px">${g.n.toLocaleString('nl-NL')} incident(en) · ${esc(loc||'locatie ontbreekt')} · ${esc(g.reden)}</div>${best?`<div class="muted" style="font-size:11px;margin-top:3px">Beste kandidaat: <b>${esc(best.naam)}</b> (${esc(best.weg)} ${esc(best.richting||'')} ${best.hm!=null?'hm '+fmt(best.hm,3):''})</div>`:'<div class="muted" style="font-size:11px;margin-top:3px">Geen bruikbare kandidaat in de geladen assetlijst.</div>'}</div></div><div class="asset-fout-acties"><button class="primary" onclick="openAssetConfigForLog('${encodeURIComponent(g.id)}')">Zoeken en configureren</button>${best?`<button onclick="assetConfigKoppel('${encodeURIComponent(g.id)}','${encodeURIComponent(best.key)}')">Koppel aan beste kandidaat</button>`:''}<button onclick="assetConfigBuitenAreaal('${encodeURIComponent(g.id)}')">Markeer buiten areaal</button></div></div>`;
  }).join(''):`<div class="asset-config-note" style="background:var(--groen-l);border-color:#cfe3d3;color:var(--groen)">Alle geladen incidenten zijn gekoppeld aan All Assets of expliciet verantwoord als buiten areaal.</div>`;
  if(M.groepen&&M.groepen.length>40)fouten+=`<p class="muted" style="font-size:11.5px">Nog ${M.groepen.length-40} foutgroepen. Gebruik zoeken of los eerst de grootste groepen op.</p>`;
  const aliases=Object.entries(cfg.aliases).map(([lk,key])=>{const a=ASSET_INDEX&&ASSET_INDEX.byKey.get(key);return `<span class="asset-alias">${esc(cfg.aliasLabels[lk]||lk)} → ${esc(a?a.naam:key)} <button title="Koppeling verwijderen" onclick="assetConfigVerwijderAlias('${encodeURIComponent(lk)}')">×</button></span>`;}).join('');
  const uitgesloten=Object.keys(cfg.uitgeslotenLogIds).map(lk=>`<span class="asset-alias">${esc(cfg.uitgeslotenLabels[lk]||lk)} · buiten areaal <button title="Uitsluiting verwijderen" onclick="assetConfigVerwijderUitsluiting('${encodeURIComponent(lk)}')">×</button></span>`).join('');
  return `<div class="card"><h3>Assetconfiguratie — koppeling, zwaarte en betrouwbaarheid ${tip('Hier koppel je logidentiteiten aan het canonieke All Assets-areaal en stel je alleen waar nodig waarden per individueel asset in. Individuele waarden hebben voorrang op fabrikant-, type- en standaardregels en worden meegenomen in impact, EOL/Weibull en MTTR.')}</h3>
    <p class="muted" style="margin:-6px 0 8px;font-size:12px">All Assets blijft de bron voor identiteit, areaal, locatie en bouwjaar. De levensduur komt bij voorkeur uit expliciete assetvelden, een aanvullende EOL-referentie of een bewuste assetconfiguratie. Als die ontbreken, gebruikt het model zichtbaar de generieke waarde van het assettype. Een storingslog wordt niet automatisch een nieuw asset.</p>
    <div class="asset-config-grid"><div class="asset-config-kpi"><div class="v">${(ASSET_REGISTER_STATE.actiefN||0).toLocaleString('nl-NL')}</div><div class="l">Actief prognoseareaal</div></div><div class="asset-config-kpi"><div class="v">${ASSET_REGISTER_STATE.assets.length.toLocaleString('nl-NL')}</div><div class="l">Historische referenties</div></div><div class="asset-config-kpi"><div class="v" style="color:var(--groen)">${M.gekoppeld.toLocaleString('nl-NL')}</div><div class="l">Incidenten gekoppeld</div></div><div class="asset-config-kpi"><div class="v" style="color:${M.nietGekoppeld?'var(--oranje)':'var(--groen)'}">${M.nietGekoppeld.toLocaleString('nl-NL')}</div><div class="l">Niet gekoppeld</div></div><div class="asset-config-kpi"><div class="v">${ovN}</div><div class="l">Individueel ingesteld</div></div></div>
    <div class="re-toolbar" style="margin-top:10px"><button class="tb-btn primary" onclick="parametersToepassen()">✓ Toepassen &amp; herberekenen</button>${bestN?`<button class="tb-btn" onclick="assetConfigKoppelBesteAlle()">Koppel beste kandidaten (${bestN})</button>`:''}<button class="tb-btn re-sec" onclick="assetConfigExport()">⭳ Assetconfiguratie</button><button class="tb-btn re-sec" onclick="document.getElementById('assetConfigImportInput').click()">⭱ Assetconfiguratie</button><input type="file" id="assetConfigImportInput" accept=".json,application/json" class="hidden" onchange="assetConfigImport(this.files[0]);this.value=''"> <label style="font-size:11.5px;color:var(--sub)">Automatische hm-tolerantie <input class="re-in" type="number" min="0.01" max="5" step="0.05" value="${cfg.hmTolerantieKm}" onchange="assetConfigTolerantie(this)" style="width:75px"> km</label><span id="assetCfgStatus" class="re-status"></span></div>
    <div class="asset-config-note">De bulkactie koppelt uitsluitend foutgroepen waarvoor hieronder ook een concrete beste kandidaat kan worden getoond. Groepen zonder kandidaat blijven handmatig. Gekoppelde logregels gebruiken daarna de canonieke assetlocatie; ongekoppelde regels blijven zichtbaar, maar tellen niet mee voor asset-specifieke Monte Carlo-kalibratie of EOL-toerekening.</div>
  </div>
  <div class="card" id="assetConfigFouten"><h3>Assetfouten en ontbrekende koppelingen <span class="badge">${M.groepen.length} groepen</span></h3>${fouten}${aliases||uitgesloten?`<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:12px">Handmatige beslissingen (${aliasN+Object.keys(cfg.uitgeslotenLogIds).length})</summary><div style="margin-top:8px">${aliases}${uitgesloten}</div></details>`:''}</div>
  <div class="card"><h3>Assets zoeken en individueel configureren</h3><div class="filterbar"><label>Zoeken <input id="assetConfigSearch" value="${esc(ASSET_CFG_UI.query)}" oninput="assetConfigZoek(this.value)" placeholder="assetnaam, entity-id, weg, hm, fabrikant" style="min-width:280px"></label><label>Assettype <select onchange="assetConfigType(this.value)"><option value="">Alle typen</option>${RULES.assetTypen.map(a=>`<option value="${esc(a.id)}" ${ASSET_CFG_UI.type===a.id?'selected':''}>${esc(a.id)}</option>`).join('')}</select></label></div>${ASSET_CFG_UI.pendingLogId?`<div class="asset-config-note" style="margin-bottom:10px">Je configureert de fout <b>${esc(ASSET_CFG_UI.pendingLogId)}</b>. Kies alleen een asset als identiteit en locatie inhoudelijk overeenkomen.</div>`:''}<div id="assetConfigListHost">${renderAssetConfigLijstHtml()}</div></div>`;
}

function renderRegels(){
  const sub=ASSET_CFG_UI.subtab||'regels';
  let h=`<div class="rule-subtabs" role="tablist"><button id="ruleSubRegels" class="${sub==='regels'?'active':''}" onclick="toonRuleSubtab('regels')">Rekenregels</button><button id="ruleSubAssets" class="${sub==='assets'?'active':''}" onclick="toonRuleSubtab('assets')">Assetconfiguratie${ASSET_MATCH_STATE&&ASSET_MATCH_STATE.nietGekoppeld?` · ${ASSET_MATCH_STATE.nietGekoppeld}`:''}</button></div>
  <div id="rulePaneRules" class="${sub==='regels'?'':'hidden'}"><div class="card"><h3>Rule engine — parameters aanpassen ${tip('De <b>vaste rekenregels</b> waarmee de tool storingen doorrekent, hier bewerkbaar. Wijzig gewichten, impactpercentages, factoren of combiregels en druk op <b>Toepassen &amp; herberekenen</b> om de hele analyse opnieuw uit te voeren. Met export/import bewaar je scenario\\u2019s.')}<span class="badge">bewerkbaar</span></h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">Pas hieronder de rekenregels aan. Wijzigingen gelden pas na <b>Toepassen &amp; herberekenen</b>. De hele doorrekening (alle wegdelen, diensten en verslagen) wordt dan opnieuw uitgevoerd op de al ingeladen storingslijst.</p>
    <div class="re-toolbar">
      <button class="tb-btn primary" onclick="parametersToepassen()">✓ Toepassen &amp; herberekenen</button>
      <button class="tb-btn re-sec" onclick="parametersHerstel()">↺ Herstel standaard</button>
      <button class="tb-btn re-sec" onclick="parametersExport()">⭳ Parameters (JSON)</button>
      <button class="tb-btn re-sec" onclick="document.getElementById('paramImport').click()">⭱ Parameters laden</button>
      <input type="file" id="paramImport" accept=".json" class="hidden">
      <span id="reStatus" class="re-status"></span>
    </div>
    <div id="applyResultHost"></div>`;

  // 0 · Impactmodel & choke-instellingen
  h+=`<details class="rule" open><summary>0 · Impactmodel &amp; gebiedsinstellingen ${tip('Bepaalt hoe zwaarte boven 100% wordt verwerkt. <b>Afkappen</b>: impact stopt bij 100% — extra gewicht op een al fatale fout doet niets. <b>Opstapelen</b>: het overschot boven 100% werkt door als extra verlies-uren, zodat gewicht en locatiefactor ook fatale fouten zwaarder laten wegen.')}</summary><div class="rb">
    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;padding:4px 0">
      <div>
        <div class="re-lab">Impactmodel</div>
        <label class="re-radio"><input type="radio" name="impactModel" value="cap" ${(RULES.cfg.impactModel||'cap')==='cap'?'checked':''} data-p="cfg" data-k="impactModel"> Afkappen op 100% <span class="muted">(conservatief)</span></label>
        <label class="re-radio"><input type="radio" name="impactModel" value="stapel" ${RULES.cfg.impactModel==='stapel'?'checked':''} data-p="cfg" data-k="impactModel"> Opstapelen boven 100% <span class="muted">(gewicht &amp; locatie tellen door)</span></label>
      </div>
      <div>
        <div class="re-lab">Choke-venster (km)${tip('De maximale afstand tussen twee storingen om ze tot hetzelfde choke-cluster te rekenen. Kleiner = strengere hotspots; groter = bredere gebieden.')}</div>
        <input class="re-in" type="number" step="0.5" min="0.2" max="10" value="${RULES.cfg.chokeVenster||2}" data-p="cfg" data-k="chokeVenster" style="width:80px"> km
        <div class="muted" style="font-size:11px;margin-top:6px;max-width:240px">Bepaalt hoe dicht storingen bij elkaar moeten liggen om als één choke-point te tellen.</div>
      </div>
    </div>
  </div></details>`;

  // 1 · Assettypen
  h+=`<details class="rule" open><summary>1 · Assettypen — gewichten &amp; levensduur ${tip('Per assettype (MSI, camera, lus, wisselbord, DRIP): het impactgewicht in de dienstverlening en de betrouwbaarheidsparameters voor de prognose. <b>Levensduur</b> is de generieke mediane modellevensduur; <b>β</b> is de Weibull-vormparameter (>1 = oplopende leeftijdshazard). Een expliciete levensduurreferentie per fabrikant/model krijgt voorrang.')}</summary><div class="rb">
    <p class="muted" style="font-size:11.5px;margin:2px 0 8px">Gewichten schalen de basisimpact per assettype (1,0 = volledige impact). Levensduur en β zijn modelparameters en moeten met eigen storings- en vervangingshistorie worden gevalideerd. Waar een geladen referentie expliciet life_median_years bevat, gebruikt de tool die per asset automatisch.</p>
    <table class="tbl re-tbl"><thead><tr><th></th><th>Type</th><th>Functie</th><th class="num">w_besch</th><th class="num">w_prest</th><th class="num">Levensduur (jr)</th><th class="num">β</th><th class="num">MTTR (uur)</th></tr></thead><tbody>`;
  RULES.assetTypen.forEach((r,i)=>h+=`<tr>
    <td><input type="checkbox" data-p="assetTypen" data-i="${i}" data-k="actief" ${r.actief?'checked':''}></td>
    <td><b>${r.id}</b></td><td class="muted" style="font-size:11.5px">${esc(r.functie)}</td>
    <td class="num"><input class="re-in" type="number" step="0.05" min="0" max="3" value="${r.wAvail}" data-p="assetTypen" data-i="${i}" data-k="wAvail"></td>
    <td class="num"><input class="re-in" type="number" step="0.05" min="0" max="3" value="${r.wPerf}" data-p="assetTypen" data-i="${i}" data-k="wPerf"></td>
    <td class="num"><input class="re-in" type="number" step="1" min="1" max="40" value="${r.levensduur!=null?r.levensduur:''}" data-p="assetTypen" data-i="${i}" data-k="levensduur" style="width:64px"></td>
    <td class="num"><input class="re-in" type="number" step="0.1" min="1" max="8" value="${r.beta!=null?r.beta:3.0}" data-p="assetTypen" data-i="${i}" data-k="beta" style="width:56px"></td>
    <td class="num"><input class="re-in" type="number" step="0.5" min="0.5" max="72" value="${r.mttr!=null?r.mttr:6}" data-p="assetTypen" data-i="${i}" data-k="mttr" style="width:60px"></td>
  </tr>`);
  h+=`</tbody></table>
    <p class="muted" style="font-size:11px;margin-top:6px">De ingestelde levensduur wordt als mediaan geïnterpreteerd en omgerekend naar Weibull-η (η = L ÷ (ln2)^(1/β)). De standaard-β’s zijn aannames, geen uit dit bestand geschatte waarden. MTTR = gemiddelde hersteltijd per storing voor de assettype-groep.</p>
  </div></details>`;

  // 2 · Foutcodes
  h+=`<details class="rule"><summary>2 · Foutcodes → basisimpact ${tip('De <b>basisimpact</b> die elke foutcode heeft op beschikbaarheid en prestatie (0–100%). Een melding wordt op tekstpatroon aan een foutcode gekoppeld; die percentages vormen het startpunt vóór asset- en locatieweging. Vinkje uit = code telt niet mee.')}</summary><div class="rb">
    <p class="muted" style="font-size:11.5px;margin:2px 0 8px">Basisimpact per foutcode op beschikbaarheid en prestatie (0–100%). Vinkje uit = regel telt niet mee.</p>
    <table class="tbl re-tbl"><thead><tr><th></th><th>Code</th><th>Patroon</th><th>Type</th><th>Ernst</th><th class="num">besch%</th><th class="num">prest%</th></tr></thead><tbody>`;
  RULES.foutcodes.forEach((f,i)=>{const tg=f.severity==='kritiek'?'r':f.severity==='hoog'?'o':f.severity==='middel'?'b':'g';
    h+=`<tr>
      <td><input type="checkbox" data-p="foutcodes" data-i="${i}" data-k="actief" ${f.actief?'checked':''}></td>
      <td class="mono"><b>${f.code}</b></td>
      <td style="max-width:220px">${esc(f.patroon)}<br><span class="muted" style="font-size:10.5px">${esc(f.oms)}</span></td>
      <td><span class="tag gy">${f.assetType}</span></td>
      <td><span class="tag ${tg}">${f.severity}</span></td>
      <td class="num"><input class="re-in" type="number" step="1" min="0" max="100" value="${f.availPct}" data-p="foutcodes" data-i="${i}" data-k="availPct"></td>
      <td class="num"><input class="re-in" type="number" step="1" min="0" max="100" value="${f.perfPct}" data-p="foutcodes" data-i="${i}" data-k="perfPct"></td>
    </tr>`;});
  h+=`</tbody></table></div></details>`;

  // 3 · MSI-ernstgradatie en overige locatieregels
  h+=`<details class="rule" open><summary>3 · MSI-ernstgradatie en locatiecontext ${tip('Voor MSI bepaalt de context een ernstrang van 1 tot en met 4. Rang 1 heeft de meeste impact en rang 4 de minste. Expliciete contextvelden hebben voorrang. Voor bestaande logs worden splitsing, samenvoeging, verbindingsboog en opeenvolgend naar deze zes contexten vertaald.')}</summary><div class="rb">
    <p class="muted" style="font-size:11.5px;margin:2px 0 8px">MSI gebruikt jouw rangorde: 1 rijbaanbreed, 1 weefvak, 1 opvolgend, 2 laatste portaal voor splitsing, 3 voor afrit en 4 voor toerit. Rang 1 is het zwaarst. De standaardfactoren zijn 1,00, 0,75, 0,50 en 0,25. Je kunt de factoren hieronder aanpassen zonder de rangorde of herkenning te wijzigen.</p>
    <table class="tbl re-tbl"><thead><tr><th></th><th>ID</th><th>Type</th><th>Context</th><th class="num">Ernstrang 1–4</th><th class="num">f_besch</th><th class="num">f_prest</th></tr></thead><tbody>`;
  RULES.locatieRegels.forEach((l,i)=>h+=`<tr>
    <td><input type="checkbox" data-p="locatieRegels" data-i="${i}" data-k="actief" ${l.actief?'checked':''}></td>
    <td class="mono">${l.id}</td><td><span class="tag gy">${l.assetType}</span></td><td class="muted" style="font-size:11.5px">${esc(l.label||l.context)}</td>
    <td class="num">${l.assetType==='MSI'?`<input class="re-in" type="number" step="1" min="1" max="4" value="${msiErnstWaarde(l)}" data-p="locatieRegels" data-i="${i}" data-k="ernst">`:'—'}</td>
    <td class="num"><input class="re-in" type="number" step="0.05" min="0" max="3" value="${l.fAvail}" data-p="locatieRegels" data-i="${i}" data-k="fAvail"></td>
    <td class="num"><input class="re-in" type="number" step="0.05" min="0" max="3" value="${l.fPerf}" data-p="locatieRegels" data-i="${i}" data-k="fPerf"></td>
  </tr>`);
  h+=`</tbody></table></div></details>`;

  // 4 · Combiregels
  h+=`<details class="rule"><summary>4 · Combiregels (opslag bij samenloop) ${tip('Extra <b>impact-opslag</b> wanneer twee storingen dicht bij elkaar samenvallen op hetzelfde wegvak (binnen de max. afstand in km). Meerdere defecten vlak bij elkaar versterken elkaars gevolg; de opslag wordt bovenop de basisimpact opgeteld, afgetopt op 100%.')}</summary><div class="rb">
    <p class="muted" style="font-size:11.5px;margin:2px 0 8px">Extra impact-opslag wanneer twee storingen dicht bij elkaar samenvallen (binnen max. afstand).</p>
    <table class="tbl re-tbl"><thead><tr><th></th><th>ID</th><th>Omschrijving</th><th class="num">max km</th><th class="num">+besch</th><th class="num">+prest</th></tr></thead><tbody>`;
  RULES.combiRegels.forEach((c,i)=>h+=`<tr>
    <td><input type="checkbox" data-p="combiRegels" data-i="${i}" data-k="actief" ${c.actief?'checked':''}></td>
    <td class="mono">${c.id}</td><td style="max-width:230px;font-size:11.5px">${esc(c.oms)}</td>
    <td class="num"><input class="re-in" type="number" step="0.1" min="0" max="5" value="${c.maxKm}" data-p="combiRegels" data-i="${i}" data-k="maxKm"></td>
    <td class="num"><input class="re-in" type="number" step="1" min="0" max="100" value="${c.extraAvail}" data-p="combiRegels" data-i="${i}" data-k="extraAvail"></td>
    <td class="num"><input class="re-in" type="number" step="1" min="0" max="100" value="${c.extraPerf}" data-p="combiRegels" data-i="${i}" data-k="extraPerf"></td>
  </tr>`);
  h+=`</tbody></table></div></details>`;
  h+=`</div>`;

  // 5 · Subprocesafhankelijkheden. De dienstwaarde volgt uit de subprocessen.
  normaliseerAlleSubprocesAandelen();
  h+=`<div class="card"><h3>Dienstverlening, subprocessen en assetafhankelijkheden ${tip('Stel per subproces in hoe sterk het afhankelijk is van signalering, camera, detectie, DRIP, communicatie en dynamische stroken. Eerst wordt elk subproces berekend. Daarna vormt het gewogen gemiddelde van de subprocessen de totale waarde van de dienstverlening.')}</h3>
    <p class="muted" style="margin:-6px 0 12px;font-size:12px">De eerste kolom vormt per dienstverlening altijd samen 100%. Wijzig je één aandeel, dan wordt het resterende percentage naar verhouding over de andere subprocessen verdeeld. De andere percentagekolommen blijven onafhankelijk instelbaar.</p>`;
  DIENSTEN.forEach((d,di)=>{
    const subs=SUBPROCESSEN[d.id]||[];
    h+=`<div style="margin-bottom:14px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius);border-left:4px solid ${d.kleur}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <div style="font-weight:700;color:${d.kleur}">${d.naam}</div>
        <div style="font-size:12px;color:var(--sub)"><span data-aandeel-totaal="${di}" style="margin-right:12px;font-weight:700;color:var(--groen)">Totaal 100%</span>norm % <input class="re-in" type="number" step="0.1" min="0" max="100" value="${d.norm}" data-p="dienstNorm" data-i="${di}" style="width:70px"></div>
      </div>
      <div class="tbl-scroll" style="max-height:none"><table class="tbl re-tbl"><thead><tr><th>Subproces</th><th class="num">Aandeel dienst %</th><th class="num">Signalering %</th><th class="num">Camera %</th><th class="num">Detectie %</th><th class="num">DRIP %</th><th class="num">Communicatie %</th><th class="num">Dyn. strook %</th></tr></thead><tbody>`;
    subs.forEach((sp,si)=>{
      const vak=o=>`<input class="re-in" type="number" step="1" min="0" max="100" value="${Math.round(((sp.afh&&sp.afh[o])||0)*100)}" data-p="subprocesAfh" data-di="${di}" data-si="${si}" data-k="${o}">`;
      h+=`<tr><td><b>${esc(sp.naam)}</b><br><span class="muted" style="font-size:10.5px">${esc(sp.tekst)}</span></td><td class="num"><input class="re-in" type="number" step="0.01" min="0" max="100" value="${Number(((sp.gewicht||0)*100).toFixed(2))}" data-p="subprocesGewicht" data-di="${di}" data-si="${si}"></td><td class="num">${vak('signalering')}</td><td class="num">${vak('camera')}</td><td class="num">${vak('detectie')}</td><td class="num">${vak('drip')}</td><td class="num">${vak('communicatie')}</td><td class="num">${vak('dynamische_strook')}</td></tr>`;
    });
    h+=`</tbody></table></div><p class="muted" style="font-size:11px;margin-top:7px">Rekenvolgorde: assetwaarden naar subproces, daarna subprocessen naar totale dienstverlening. Nulgewichten tellen niet mee.</p></div>`;
  });
  h+=`</div>`;

  // ── DRIP-regels: functie-gewicht ──
  const dr=RULES.drip;
  h+=`<details class="rule"><summary>7 · DRIP — functie &amp; EOL-referentie ${tip('DRIP telt als volwaardig assettype mee in de dienstverlening (sectie 1: gewicht, levensduur, β; sectie 5: dienstafhankelijkheden). Hier staan de functieclassificatie en optionele, herleidbare levensduurreferenties per fabrikant/model.')}</summary><div class="rb">
    <div class="re-lab">Functie-classificatie (BKN) — gewicht in de keten</div>
    <table class="tbl re-tbl"><thead><tr><th>Code</th><th>Label</th><th class="num">Gewicht</th><th>Dienst</th></tr></thead><tbody>`;
  dr.functies.forEach((f,i)=>{
    h+=`<tr><td class="mono">${esc(f.code)}</td><td>${esc(f.label)}</td>
      <td class="num"><input class="re-in" type="number" step="0.1" min="0" max="1" value="${f.gewicht}" data-p="dripFunctie" data-i="${i}" data-k="gewicht"></td>
      <td>${esc(f.dienst||'–')}</td></tr>`;
  });
  h+=`</tbody></table>
    <div class="re-lab" style="margin-top:16px">EOL-referentie (fabrikant-factsheets)</div>
    <p class="muted" style="font-size:11.5px;margin:2px 0 8px">Laad een EOL-referentie-CSV (kolommen o.a. manufacturer_regex, model_regex, asset_classes, life_median_years, public_status, source_url). De tool matcht elke asset op fabrikant + model en gebruikt de mediane levensduur (B50) als bron voor de faalkans — herleidbaar met bronlink.</p>
    <button class="tb-btn" onclick="document.getElementById('eolInput').click()">⭱ EOL-referentie laden (.csv)</button>
    <input type="file" id="eolInput" accept=".csv,.xlsx,.xls" class="hidden">
    <span id="eolStatus" class="re-status"></span>`;
  if(EOL_REF.length){
    h+=`<div class="tbl-scroll" style="margin-top:10px"><table class="tbl re-tbl klein"><thead><tr><th>Regel</th><th>Merk / model</th><th>Klassen</th><th class="num">Levensduur (B50)</th><th>Status</th><th>Zeker.</th><th>Bron</th></tr></thead><tbody>`;
    EOL_REF.forEach(r=>{
      h+=`<tr><td class="mono">${esc(r.rule_id)}</td>
        <td>${esc(r.family||'')}</td>
        <td>${esc(r.klassen.join(', '))}</td>
        <td class="num">${r.life_median!=null?r.life_median+' jr':(r.life_min!=null?`${r.life_min}–${r.life_max}`:'—')}</td>
        <td>${esc(r.status||'')}</td>
        <td>${esc(r.confidence||'')}</td>
        <td>${r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener" style="color:var(--rws-blauw-mid)">link</a>`:'—'}</td></tr>`;
    });
    h+=`</tbody></table></div>`;
  }

  // ── Levensduur per fabrikant × type (instelbaar) ──
  h+=`<div class="re-lab" style="margin-top:18px">Levensduur per fabrikant × type (B50, jaren)</div>
    <div style="margin:2px 0 8px"><label style="font-size:11.5px;color:var(--sub)">Laatste terugval als ook de assettype-levensduur leeg is:
      <input class="re-in" type="number" step="1" min="1" max="40" value="${RULES.drip.standaardLevensduur}" data-p="dripStandaard" style="width:70px"> jaar</label></div>`;
  const Ddata=(STATE&&STATE.drips)||DRIP_STATE;
  if(Ddata && Ddata.drips && Ddata.drips.length){
    // verzamel fabrikant×type-combinaties met aantal
    const combos={};
    Ddata.drips.forEach(d=>{ const k=dripComboKey(d.fabrikant,d.type); if(!combos[k]) combos[k]={fab:d.fabrikant||'(leeg)',type:d.type||'(leeg)',n:0,d}; combos[k].n++; });
    const rijen=Object.entries(combos).sort((a,b)=>b[1].n-a[1].n);
    h+=`<p class="muted" style="font-size:11px;margin:2px 0 6px">${rijen.length} combinaties in het geladen register. Leeg veld = gebruik een expliciete levensduurreferentie en anders de levensduur van assettype DRIP uit sectie 1. Een ingevulde waarde krijgt voorrang (bron toont dan “handmatig”).</p>
    <div class="tbl-scroll" style="max-height:340px;overflow:auto"><table class="tbl re-tbl klein"><thead><tr><th>Fabrikant</th><th>Type</th><th class="num">Aantal</th><th class="num">Levensduur</th><th>Herkomst</th></tr></thead><tbody>`;
    rijen.forEach(([k,c])=>{
      const rel=assetReliability(c.d);
      const ov=RULES.drip.levensduurOverride[k];
      h+=`<tr>
        <td>${esc(c.fab)}</td><td>${esc(c.type)}</td>
        <td class="num">${c.n}</td>
        <td class="num"><input class="re-in" type="number" step="1" min="1" max="40" value="${ov!=null?ov:''}" placeholder="${fmt(rel.L,0)}" data-p="dripOverride" data-k="${esc(k)}" style="width:64px"></td>
        <td class="muted" style="font-size:10.5px">${esc(rel.bron)} (${fmt(rel.L,0)} jr)</td>
      </tr>`;
    });
    h+=`</tbody></table></div>`;
  } else {
    h+=`<p class="muted" style="font-size:11.5px">Laad een DRIP-asset-register om de fabrikant×type-combinaties hier instelbaar te maken.</p>`;
  }

  h+=`</div></details></div><div id="rulePaneAssets" data-geladen="${sub==='assets'?'1':'0'}" class="${sub==='assets'?'':'hidden'}">${sub==='assets'?renderAssetConfigPane():''}</div>`;

  const dekkingKaart=STATE?`<div class="card"><h3>Live brondekking voor landelijke percentages</h3><p>Bevestig een bron alleen als deze voor het volledige geladen areaal en de bronpeildatum alle open storingen bevat. Niet bevestigde bronnen blijven onbekend en worden niet stilzwijgend als 100% beschikbaar behandeld.</p>${v68BronnenHtml(v68LandelijkModel())}</div>`:'';
  document.getElementById('tab-regels').innerHTML=h+dekkingKaart+kostenInstellingenHtml();
  const eolI=document.getElementById('eolInput');
  if(eolI) eolI.addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)leesEolReferentie(f);});
  document.getElementById('paramImport').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)parametersImport(f);});
  document.querySelectorAll('#tab-regels [data-p="subprocesGewicht"]').forEach(el=>el.addEventListener('change',()=>verdeelSubprocesAandeel(el)));
}

/* Lees alle inputs en schrijf terug in RULES / DIENSTEN */
function parametersLezen(){
  document.querySelectorAll('#tab-regels [data-p]').forEach(el=>{
    const p=el.dataset.p, i=+el.dataset.i, k=el.dataset.k;
    if(p==='cfg'){
      if(el.type==='radio'){ if(el.checked) RULES.cfg[k]=el.value; }
      else { RULES.cfg[k]=parseFloat(el.value)||RULES.cfg[k]; }
      return;
    }
    if(p==='dienstNorm'){ DIENSTEN[i].norm=parseFloat(el.value)||0; return; }
    if(p==='dienstAfh'){ DIENSTEN[i].afh[k]=(parseFloat(el.value)||0)/100; return; }
    if(p==='subprocesAfh'){
      const sp=(SUBPROCESSEN[DIENSTEN[+el.dataset.di].id]||[])[+el.dataset.si];
      if(sp)sp.afh[k]=(parseFloat(el.value)||0)/100;
      return;
    }
    if(p==='subprocesGewicht'){
      const sp=(SUBPROCESSEN[DIENSTEN[+el.dataset.di].id]||[])[+el.dataset.si];
      if(sp)sp.gewicht=(parseFloat(el.value)||0)/100;
      return;
    }
    if(p==='dripFunctie'){ RULES.drip.functies[i][k]=parseFloat(el.value)||0; return; }
    if(p==='dripStandaard'){ RULES.drip.standaardLevensduur=parseFloat(el.value)||15; return; }
    if(p==='dripOverride'){
      const key=el.dataset.k, v=parseFloat(el.value);
      if(el.value===''||isNaN(v)) delete RULES.drip.levensduurOverride[key];
      else RULES.drip.levensduurOverride[key]=v;
      return;
    }
    const tgt=RULES[p][i];
    if(k==='actief'){ tgt.actief=el.checked; }
    else { tgt[k]=parseFloat(el.value); }
  });
  RULES.locatieRegels.filter(r=>r.assetType==='MSI').forEach(r=>{
    r.ernst=msiErnstWaarde(r);const standaard=msiErnstFactorStandaard(r);
    if(!isFinite(Number(r.fAvail))||Number(r.fAvail)<0)r.fAvail=standaard;
    if(!isFinite(Number(r.fPerf))||Number(r.fPerf)<0)r.fPerf=standaard;
  });
  // betrouwbaarheidsparameters gewijzigd → per-asset cache legen
  ASSET_CONFIG_VERSIE++;
  if(ASSET_REGISTER_STATE){ASSET_REGISTER_STATE._assetConfigVersie=-1;herberekenRegisterDekking();}
  const D=(STATE&&STATE.drips)||DRIP_STATE;
  if(D&&D.drips) D.drips.forEach(d=>{ d._rel=null; });
  if(DRIP_HIST_STATE)koppelDripHistorieAanAreaal();
  if(STORINGSBRONNEN.length)STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
  if(LIVE_STORINGSBRONNEN.length)LIVE_STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen());
  herbouwAssetMatchBeeld();
}

function parametersToepassen(){
  if(!ASSET_REGISTER_STATE&&!STATE&&!HISTORIE_STATE&&!DRIP_STATE){alert('Laad eerst een assetlijst of een analysebron.');return;}
  const hadLive=!!(STATE&&STATE.ruweRijen),voor={};
  if(hadLive)DIENSTEN.forEach(d=>voor[d.id]={b:STATE.netwerk[d.id].besch,p:STATE.netwerk[d.id].prestatie});
  parametersLezen();
  ANALYSE_SIGNATURE='';MC_RESULT=null;DRIP_MC=null;DIENST_SEL=null;
  probeerAnalyseActiveren('regels');
  if(!hadLive||!STATE){renderRegels();renderDataGereedheid();toonTab('regels');reStatus('✓ Regels toegepast op prognose- en areaalmodellen','ok');assetCfgMelding('Assetconfiguratie toegepast.');return;}
  // bouw een before→after overzicht van de dienstimpact
  let anyChange=false;
  const regels=DIENSTEN.map(d=>{
    const na=STATE.netwerk[d.id];
    const db=na.besch-voor[d.id].b, dp=na.prestatie-voor[d.id].p;
    if(Math.abs(db)>=0.005||Math.abs(dp)>=0.005) anyChange=true;
    const pijl=v=> v>0.004?'▲':v<-0.004?'▼':'=';
    const kl=v=> v>0.004?'var(--groen)':v<-0.004?'var(--rood)':'var(--sub)';
    return `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${d.kleur};margin-right:6px"></span>${d.naam.replace(/&amp;/g,'&')}</td>
      <td class="num">${fmt(voor[d.id].b,2)}</td><td class="num" style="font-weight:700">${fmt(na.besch,2)}</td>
      <td class="num" style="color:${kl(db)};font-weight:700">${pijl(db)} ${db>=0?'+':''}${fmt(db,2)}</td>
      <td class="num" style="color:${kl(dp)}">${pijl(dp)} ${dp>=0?'+':''}${fmt(dp,2)}</td></tr>`;
  }).join('');
  const paneel=`<div class="apply-result">
    <div class="ar-head"><b>✓ Herberekend</b> — effect op de netwerkbrede dienstimpact:
      <button class="ar-goto" onclick="toonTab('overzicht')">→ naar Overzicht diensten</button></div>
    <table class="mini-tbl"><thead><tr><th>Dienst</th><th class="num">Besch. vóór</th><th class="num">Besch. ná</th><th class="num">Δ besch.</th><th class="num">Δ prest.</th></tr></thead>
    <tbody>${regels}</tbody></table>
    ${anyChange?'':'<p class="ar-none">Geen meetbare verandering op dienstniveau (&lt;0,01pp). De wijziging raakt mogelijk geen van de ingeladen storingen, of het effect valt weg in het netwerkgemiddelde. Bekijk het effect per wegdeel in het Wegdeel- &amp; dienstverslag.</p>'}
  </div>`;
  document.getElementById('applyResultHost').innerHTML=paneel;
  toonTab('regels');
  document.getElementById('applyResultHost').scrollIntoView({behavior:'smooth',block:'nearest'});
  reStatus('✓ Herberekend om '+new Date().toLocaleTimeString('nl-NL'),'ok');
}

function parametersHerstel(){
  RULES.kosten={};
  // herstel RULES uit de default-snapshot
  ['assetTypen','foutcodes','locatieRegels','combiRegels'].forEach(p=>{
    RULES[p]=JSON.parse(JSON.stringify(RULES_DEFAULT[p]));
  });
  RULES.cfg=JSON.parse(JSON.stringify(RULES_DEFAULT.cfg));
  RULES.drip=JSON.parse(JSON.stringify(RULES_DEFAULT.drip));
  RULES.assetConfig=JSON.parse(JSON.stringify(RULES_DEFAULT.assetConfig));
  ASSET_CONFIG_VERSIE++;
  if(ASSET_REGISTER_STATE){ASSET_REGISTER_STATE._assetConfigVersie=-1;herberekenRegisterDekking();}
  if(DRIP_HIST_STATE)koppelDripHistorieAanAreaal();
  herbouwAssetMatchBeeld();
  DIENSTEN_AFH_DEFAULT.forEach(dd=>{
    const d=DIENSTEN.find(x=>x.id===dd.id);
    if(d){ d.afh=JSON.parse(JSON.stringify(dd.afh)); d.norm=dd.norm; }
  });
  Object.keys(SUBPROCESSEN).forEach(id=>SUBPROCESSEN[id]=JSON.parse(JSON.stringify(SUBPROCESSEN_DEFAULT[id]||[])));
  ANALYSE_SIGNATURE='';MC_RESULT=null;DRIP_MC=null;probeerAnalyseActiveren('regels');renderRegels();renderDataGereedheid();toonTab('regels');
  reStatus('↺ Standaardwaarden hersteld','ok');
}

function parametersExport(){
  parametersLezen();
  const bundle={
    versie:8, opgeslagen:new Date().toISOString(),
    cfg:RULES.cfg,
    drip:RULES.drip,
    assetConfig:RULES.assetConfig,
    assetTypen:RULES.assetTypen, foutcodes:RULES.foutcodes,
    locatieRegels:RULES.locatieRegels, combiRegels:RULES.combiRegels,
    diensten:DIENSTEN.map(d=>({id:d.id,norm:d.norm,afh:d.afh})),
    kosten:ndw69ExportKosten(), subprocessen:subprocessenConfig()
  };
  const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='rule-engine-parameters.json'; a.click();
  reStatus('⭳ Parameters geëxporteerd','ok');
}

function parametersImport(file){
  const rd=new FileReader();
  rd.onload=e=>{
    try{
      const b=JSON.parse(e.target.result);
      ['assetTypen','foutcodes','locatieRegels','combiRegels'].forEach(p=>{ if(b[p]) RULES[p]=b[p]; });
      const dripAssettype=RULES.assetTypen.find(x=>x.id==='DRIP');
      if(dripAssettype&&Number(dripAssettype.levensduur)===17)dripAssettype.levensduur=15;
      // Bundels vanaf versie 5 kennen de nieuwe schaal: rang 1 is het zwaarst.
      // Oudere bundels bevatten nog factoren die met de rang opliepen en krijgen
      // daarom automatisch de gecorrigeerde dalende standaardfactoren.
      RULES.locatieRegels=normaliseerMsiErnstRegels(RULES.locatieRegels,Number(b.versie)>=5);
      if(b.cfg) RULES.cfg={...RULES.cfg,...b.cfg};
      if(b.drip) RULES.drip={...RULES.drip,...b.drip,levensduurOverride:{...(b.drip.levensduurOverride||{})}};
      if(b.assetConfig) RULES.assetConfig={...assetConfigBasis(),...b.assetConfig,aliases:{...(b.assetConfig.aliases||{})},aliasLabels:{...(b.assetConfig.aliasLabels||{})},uitgeslotenLogIds:{...(b.assetConfig.uitgeslotenLogIds||{})},uitgeslotenLabels:{...(b.assetConfig.uitgeslotenLabels||{})},overrides:{...(b.assetConfig.overrides||{})}};
      if(b.diensten) b.diensten.forEach(dd=>{ const d=DIENSTEN.find(x=>x.id===dd.id); if(d){ if(dd.afh)d.afh=dd.afh; if(dd.norm!=null)d.norm=dd.norm; } });
      laadSubprocessenConfig(b.subprocessen);
      RULES.kosten=v68MigreerKosten(b.kosten);
      ASSET_CONFIG_VERSIE++;if(ASSET_REGISTER_STATE){ASSET_REGISTER_STATE._assetConfigVersie=-1;herberekenRegisterDekking();}if(DRIP_HIST_STATE)koppelDripHistorieAanAreaal();herbouwAssetMatchBeeld();
      ANALYSE_SIGNATURE='';MC_RESULT=null;DRIP_MC=null;probeerAnalyseActiveren('regels');renderRegels();renderDataGereedheid();toonTab('regels');
      reStatus('⭱ Parameters geladen — controleer en Toepassen','ok');
    }catch(err){ alert('Kon parameterbestand niet lezen: '+err.message); }
  };
  rd.readAsText(file);
}

function reStatus(msg,kind){
  const el=document.getElementById('reStatus'); if(!el)return;
  el.textContent=msg; el.className='re-status '+(kind||'');
  setTimeout(()=>{ if(el.textContent===msg){el.textContent='';el.className='re-status';} },6000);
}

/* ══════════════════════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════════════════════ */
function exportCSV(){
  if(!STATE||!berekenGereedheid().basisAlgemeen){alert('Resultaatexport is nog geblokkeerd omdat de basisanalyse niet gereed is.');renderDataGereedheid();return;}
  const sep=';';
  const head=['wegdeel','vc','district','storingen','signaalgevers','areaal_besch','prestatie',
    'IM_besch','IM_prest','VM_besch','VM_prest','RRI_besch','RRI_prest','WIU_besch','WIU_prest'];
  const lines=[head.join(sep)];
  STATE.wegdelen.forEach(wd=>{
    const r=[wd.key,wd.vc,wd.district,wd.n,wd.N,wd.besch,wd.prestatie];
    ['im','vm','rri','wiu'].forEach(id=>{ r.push(wd.diensten[id].besch,wd.diensten[id].prestatie); });
    lines.push(r.map(x=>String(x).replace(/[\r\n;]/g,' ')).join(sep));
  });
  const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='dienstimpact_'+(STATE.bestand||'export').replace(/\.[^.]+$/,'')+'.csv';
  a.click();
}

/* ══════════════════════════════════════════════════════════════
   TOTAAL-EXPORT / -IMPORT (JSON)
   Serialiseert alle geladen brondata (ruwe invoerrijen per stroom) plus de
   rule-engine-parameters en assetconfiguratie in één JSON-bestand. Bij import
   wordt elke stroom teruggezet en door dezelfde verwerkingsstappen gehaald als
   bij het laden van losse bestanden. Alles wat ná een totaalimport los wordt
   geladen, wordt COMPLEMENTAIR toegevoegd — bestaande streams blijven staan en
   nieuwe bronnen worden ernaast gemerged (sleutel = bestandsnaam).
   ══════════════════════════════════════════════════════════════ */
function totaalExportOpties(){
  const dripSources=(DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[];
  return [
    {id:'assetregister',label:'Assetregister / All Assets',aanwezig:!!(ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.ruweRegisterRijen),detail:ASSET_REGISTER_STATE?ASSET_REGISTER_STATE.bestand:'niet geladen'},
    {id:'eol',label:'EOL-referentie',aanwezig:!!EOL_REF.length,detail:EOL_REF.length?`${EOL_REF.length} regels`:'niet geladen'},
    {id:'storingshistorie',label:'Storingshistorie',aanwezig:!!STORINGSBRONNEN.length,detail:`${STORINGSBRONNEN.length} bronbestand(en), prognosebron`},
    {id:'liveStoringen',label:'Open storingen',aanwezig:!!LIVE_STORINGSBRONNEN.length,detail:`${LIVE_STORINGSBRONNEN.length} momentopnamebestand(en), dashboardbron`},
    {id:'dripHistorie',label:'DRIP-storingshistorie',aanwezig:!!dripSources.length,detail:`${dripSources.length} bronbestand(en), DRIP Monte Carlo`},
    {id:'uRoutes',label:'U-routes',aanwezig:!!U_ROUTE_STATE,detail:U_ROUTE_STATE?`${U_ROUTE_STATE.totaal} routes`:'niet geladen'},
    {id:'werkzaamheden',label:'Werkzaamheden',aanwezig:!!WERK_STATE,detail:WERK_STATE?`${WERK_STATE.totaal} werkzaamheden`:'niet geladen'},
    {id:'parameters',label:'Parameters en assetconfiguratie',aanwezig:true,detail:'rule engine, normen, handmatige koppelingen'},
    {id:'dripSelectie',label:'DRIP-selectie',aanwezig:typeof DRIP_SELECTIE!=='undefined'&&DRIP_SELECTIE instanceof Set,detail:'aangevinkte DRIPs voor prognose'}
  ];
}
function zorgTotaalExportModal(){
  let el=document.getElementById('totaalExportModal');if(el)return el;
  el=document.createElement('div');el.id='totaalExportModal';el.className='memo-modal';
  el.innerHTML=`<div class="memo-modal-box" style="height:auto;max-height:88vh"><div class="memo-modal-head"><span>Totaalexport samenstellen</span><button class="memo-x" onclick="sluitTotaalExportKeuze()">x</button></div><div class="mc-modal-body"><div id="totaalExportBody"></div></div></div>`;
  document.body.appendChild(el);return el;
}
function openTotaalExportKeuze(){
  if(!heeftDatasetData()){alert('Er is nog geen dataset geladen om te exporteren.');return;}
  const opts=totaalExportOpties();
  const body=`<div class="mc-popup-inner"><h4>Kies wat in het totaal JSON-bestand komt</h4>
    <p class="dataset-note">Aangevinkte onderdelen worden opgenomen. Uitgevinkte onderdelen worden in het JSON gemarkeerd als bewust niet geëxporteerd; bij import worden die onderdelen daardoor niet automatisch gewist.</p>
    <div class="export-select">${opts.map(o=>`<label class="export-opt ${o.aanwezig?'':'muted'}"><input type="checkbox" data-export-part="${esc(o.id)}" ${o.aanwezig?'checked':'disabled'}> <b>${esc(o.label)}</b><small>${esc(o.detail)}</small></label>`).join('')}</div>
    <div class="load-actions"><button class="tb-btn primary" onclick="bevestigTotaalExport()">Exporteren</button><button class="tb-btn re-sec" onclick="sluitTotaalExportKeuze()">Annuleren</button></div></div>`;
  const el=zorgTotaalExportModal();document.getElementById('totaalExportBody').innerHTML=body;el.style.display='flex';
}
function sluitTotaalExportKeuze(){const el=document.getElementById('totaalExportModal');if(el)el.style.display='none';}
function bevestigTotaalExport(){
  const selectie={};
  totaalExportOpties().forEach(o=>{selectie[o.id]=false;});
  document.querySelectorAll('#totaalExportBody [data-export-part]').forEach(cb=>{selectie[cb.dataset.exportPart]=cb.checked;});
  sluitTotaalExportKeuze();
  totaalExportJson(selectie);
}
function totaalExportBundle(selectie){
  selectie=selectie||Object.fromEntries(totaalExportOpties().map(o=>[o.id,o.aanwezig]));
  const neem=id=>selectie[id]!==false;
  const bron=(arr)=>(arr||[]).map(b=>({key:b.key,naam:b.naam,rijen:b.rijen||[],peildatum:b.peildatum||null,doel:b.doel||null}));
  return {
    formaat:'DVM-dienstimpact-totaal',
    versie:54,
    opgeslagen:new Date().toISOString(),
    exportSelectie: selectie,
    assetregister: neem('assetregister')&&ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.ruweRegisterRijen
      ? {bestand:ASSET_REGISTER_STATE.bestand,rijen:ASSET_REGISTER_STATE.ruweRegisterRijen} : null,
    eol: neem('eol')&&EOL_REF.length ? {bestand:EOL_BRON_NAAM||'',regels:EOL_REF} : null,
    storingshistorie: neem('storingshistorie') ? bron(STORINGSBRONNEN) : [],
    liveStoringen: neem('liveStoringen') ? bron(LIVE_STORINGSBRONNEN) : [],
    dripHistorie: neem('dripHistorie')&&(DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)
      ? {sources:DRIP_HIST_STATE.sources.map(s=>({key:s.key,name:s.name,incidenten:s.incidenten||[],dekkingDatums:s.dekkingDatums||[],assetCodes:s.assetCodes||[],episodesGenegeerd:s.episodesGenegeerd||0}))} : null,
    uRoutes: neem('uRoutes')&&U_ROUTE_STATE&&U_ROUTE_STATE.ruweRijen ? {bestand:U_ROUTE_STATE.bestand,rijen:U_ROUTE_STATE.ruweRijen} : null,
    werkzaamheden: neem('werkzaamheden')&&WERK_STATE&&WERK_STATE.ruweRijen ? {bestand:WERK_STATE.bestand,rijen:WERK_STATE.ruweRijen} : null,
    parameters:neem('parameters')?{
      cfg:RULES.cfg, drip:RULES.drip, assetConfig:RULES.assetConfig,
      assetTypen:RULES.assetTypen, foutcodes:RULES.foutcodes,
      locatieRegels:RULES.locatieRegels, combiRegels:RULES.combiRegels,
      diensten:DIENSTEN.map(d=>({id:d.id,norm:d.norm,afh:d.afh})),
      kosten:ndw69ExportKosten(), subprocessen:subprocessenConfig()
    }:null,
    dripSelectie: neem('dripSelectie')&&(typeof DRIP_SELECTIE!=='undefined'&&DRIP_SELECTIE instanceof Set) ? [...DRIP_SELECTIE] : null
  };
}
function totaalExportJson(selectie){
  if(!heeftDatasetData()){alert('Er is nog geen dataset geladen om te exporteren.');return;}
  parametersLezen();
  const bundle=totaalExportBundle(selectie);
  const blob=new Blob([JSON.stringify(bundle)],{type:'application/json'}),a=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10);
  a.href=URL.createObjectURL(blob);a.download='dvm-dienstimpact-totaal_'+stamp+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  const gekozen=totaalExportOpties().filter(o=>bundle.exportSelectie&&bundle.exportSelectie[o.id]).map(o=>o.label).join(', ');
  zetStoringsImportStatus('Totaalexport gemaakt met selectie: '+(gekozen||'geen onderdelen')+'.');
}

/* Voeg een set ruwe bronnen (met key/naam/rijen) COMPLEMENTAIR toe aan een
   doel-array. Bestaande bronnen met dezelfde sleutel worden vervangen; alle
   overige blijven staan. */
function mergeBronnen(doelArr, nieuweBronnen){
  const vervang=new Set(nieuweBronnen.map(b=>b.key));
  return [...doelArr.filter(x=>!vervang.has(x.key)), ...nieuweBronnen];
}

async function totaalImportJson(file, hubModus){
  if(!file)return;
  let bundle;
  try{ bundle=JSON.parse(await file.text()); }
  catch(err){ alert('Kon het totaalbestand niet lezen: '+err.message); return; }
  if(!bundle||bundle.formaat!=='DVM-dienstimpact-totaal'){
    if(!confirm('Dit bestand heeft niet de verwachte totaalstructuur. Toch proberen te laden?'))return;
  }
  const heeftData=heeftDatasetData();
  const modus = hubModus || (heeftData
    ? (confirm('Er is al data geladen.\n\nOK  = COMPLEMENTAIR toevoegen (bestaande streams blijven, nieuwe bronnen worden ernaast gemerged).\nAnnuleren = alles VERVANGEN door dit totaalbestand.') ? 'merge' : 'vervang')
    : 'merge');
  const magImporteren=id=>!bundle.exportSelectie || bundle.exportSelectie[id]!==false;
  const bundleHeeftAssetregister=!!(bundle.assetregister&&Array.isArray(bundle.assetregister.rijen));
  let assetregisterActie='overslaan';
  if(magImporteren('assetregister')&&bundleHeeftAssetregister){
    if(hubModus||modus==='vervang'||!ASSET_REGISTER_STATE) assetregisterActie='laden';
    else assetregisterActie=confirm('Dit totaalbestand bevat ook een assetregister, terwijl er al een assetregister geladen is.\n\nOK = assetregister vervangen en alle koppelingen opnieuw opbouwen.\nAnnuleren = bestaand assetregister behouden en alleen overige bronnen mergen.')?'laden':'overslaan';
  }
  try{
    zetImportVoortgang(file.name,2,'Totaalbestand inlezen',{direct:true});await uiPauze();

    // 1) Parameters + assetconfiguratie (altijd toepassen; vormen de rekenbasis)
    if(magImporteren('parameters')&&bundle.parameters){
      const b=bundle.parameters;
      ['assetTypen','foutcodes','locatieRegels','combiRegels'].forEach(p=>{ if(b[p]) RULES[p]=b[p]; });
      const dripAssettype=RULES.assetTypen.find(x=>x.id==='DRIP');
      if(dripAssettype&&Number(dripAssettype.levensduur)===17)dripAssettype.levensduur=15;
      RULES.locatieRegels=normaliseerMsiErnstRegels(RULES.locatieRegels,true);
      if(b.cfg) RULES.cfg={...RULES.cfg,...b.cfg};
      if(b.drip) RULES.drip={...RULES.drip,...b.drip,levensduurOverride:{...(b.drip.levensduurOverride||{})}};
      if(b.assetConfig) RULES.assetConfig={...assetConfigBasis(),...b.assetConfig,aliases:{...(b.assetConfig.aliases||{})},aliasLabels:{...(b.assetConfig.aliasLabels||{})},uitgeslotenLogIds:{...(b.assetConfig.uitgeslotenLogIds||{})},uitgeslotenLabels:{...(b.assetConfig.uitgeslotenLabels||{})},overrides:{...(b.assetConfig.overrides||{})}};
      if(b.diensten) b.diensten.forEach(dd=>{ const d=DIENSTEN.find(x=>x.id===dd.id); if(d){ if(dd.afh)d.afh=dd.afh; if(dd.norm!=null)d.norm=dd.norm; } });
      laadSubprocessenConfig(b.subprocessen);
      RULES.kosten=v68MigreerKosten(b.kosten);
    }

    // 2) EOL-referentie
    if(magImporteren('eol')&&bundle.eol&&Array.isArray(bundle.eol.regels)){
      EOL_REF = modus==='vervang' ? bundle.eol.regels.slice()
        : [...EOL_REF.filter(r=>!bundle.eol.regels.some(n=>JSON.stringify(n)===JSON.stringify(r))), ...bundle.eol.regels];
      EOL_BRON_NAAM=bundle.eol.bestand||EOL_BRON_NAAM; EOL_VERSIE++;
    } else if(magImporteren('eol')&&modus==='vervang'){ EOL_REF=[]; EOL_BRON_NAAM=''; }

    // 3) Assetregister (stamregister). Bij merge met een bestaand register kiest
    //    de gebruiker expliciet of het register vervangen wordt.
    if(assetregisterActie==='laden'){
      zetImportVoortgang(file.name,20,'Assetregister opbouwen',{direct:true});await uiPauze();
      let rijen=bundle.assetregister.rijen.filter(r=>registerAssetType(r,registerWaarde));
      DVM_LEEFTIJD_STATE=verwerkDvmLeeftijd(rijen);
      analyseerAssetRegister(rijen,bundle.assetregister.bestand||file.name);
      if(ASSET_REGISTER_STATE)ASSET_REGISTER_STATE.ruweRegisterRijen=rijen.slice();
      DRIP_STATE=verwerkDrips(rijen);
      DRIP_STATE.bestand=bundle.assetregister.bestand||file.name;
      if(DVM_LEEFTIJD_STATE) DRIP_STATE.leeftijdsdekking={actief:DVM_LEEFTIJD_STATE.actief,metJaar:DVM_LEEFTIJD_STATE.metJaar,pct:DVM_LEEFTIJD_STATE.actief?DVM_LEEFTIJD_STATE.metJaar/DVM_LEEFTIJD_STATE.actief:0};
      if(EOL_REF.length) DRIP_STATE.drips.forEach(d=>{ d._eolRef=eolRegelVoor(d.fabrikant,d.model||d.type,'DRIP'); d._rel=null; });
    }
    if(!ASSET_REGISTER_STATE){ importMislukt(file.name,'Totaalbestand bevat geen assetregister.'); alert('Dit totaalbestand bevat geen assetregister. Laad eerst een assetlijst en probeer daarna opnieuw, of gebruik een totaalexport waarin het register is opgenomen.'); return; }

    // Herkoppel EOL indien nu aanwezig
    if(EOL_REF.length&&DRIP_STATE) DRIP_STATE.drips.forEach(d=>{ d._eolRef=eolRegelVoor(d.fabrikant,d.model||d.type,'DRIP'); d._rel=null; });

    // 4) Storingshistorie (prognosebron)
    if(magImporteren('storingshistorie')&&Array.isArray(bundle.storingshistorie)&&bundle.storingshistorie.length){
      zetImportVoortgang(file.name,45,'Storingshistorie terugzetten',{direct:true});await uiPauze();
      const nb=bundle.storingshistorie.map(b=>({key:b.key,naam:b.naam,rijen:b.rijen||[]}));
      STORINGSBRONNEN = modus==='vervang' ? nb : mergeBronnen(STORINGSBRONNEN,nb);
    } else if(magImporteren('storingshistorie')&&modus==='vervang'){ STORINGSBRONNEN=[]; }

    // 5) Open storingen (live dashboardbron)
    if(magImporteren('liveStoringen')&&Array.isArray(bundle.liveStoringen)&&bundle.liveStoringen.length){
      zetImportVoortgang(file.name,55,'Open-storingenlijst terugzetten',{direct:true});await uiPauze();
      const nb=bundle.liveStoringen.map(b=>({key:b.key,naam:b.naam,rijen:(b.rijen||[]).map(r=>({...r,_liveOpen:true,_bronBestand:b.naam})),peildatum:b.peildatum||bronPeildatum({rijen:b.rijen,naam:b.naam}),doel:'live-open'}));
      LIVE_STORINGSBRONNEN = modus==='vervang' ? nb : mergeBronnen(LIVE_STORINGSBRONNEN,nb);
      LIVE_PEILDATUM=Math.max(0,...LIVE_STORINGSBRONNEN.map(b=>b.peildatum||0))||null;
    } else if(magImporteren('liveStoringen')&&modus==='vervang'){ LIVE_STORINGSBRONNEN=[]; LIVE_PEILDATUM=null; }

    // 6) DRIP-historie
    if(magImporteren('dripHistorie')&&bundle.dripHistorie&&Array.isArray(bundle.dripHistorie.sources)){
      zetImportVoortgang(file.name,62,'DRIP-historie terugzetten',{direct:true});await uiPauze();
      const bestaand=(DRIP_HIST_STATE&&DRIP_HIST_STATE.sources)||[];
      const nb=bundle.dripHistorie.sources;
      const vervang=new Set(nb.map(s=>s.key));
      DRIP_HIST_STATE={sources: modus==='vervang' ? nb : [...bestaand.filter(x=>!vervang.has(x.key)),...nb]};
      herbouwDripHistorie(); DRIP_MC=null;
    } else if(magImporteren('dripHistorie')&&modus==='vervang'){ DRIP_HIST_STATE=null; DRIP_MC=null; }

    // 7) U-routes
    if(magImporteren('uRoutes')&&bundle.uRoutes&&Array.isArray(bundle.uRoutes.rijen)&&(modus==='vervang'||!U_ROUTE_STATE)){
      zetImportVoortgang(file.name,72,'U-routes terugzetten',{direct:true});await uiPauze();
      const rijen=bundle.uRoutes.rijen;
      const routes=await normaliseerURouteRijenLicht(rijen);
      if(routes.length){
        const index=bouwURouteIndex(routes);
        U_ROUTE_STATE={bestand:bundle.uRoutes.bestand||file.name,routes,totaal:routes.length,metRelation:routes.filter(r=>r.relationId).length,
          volledig:routes.filter(r=>/^ja$/i.test(r.volledig)||r.statusPct>=100).length,ruimtelijkN:routes.filter(r=>r.ruimtelijk).length,
          geometrieN:routes.filter(r=>r.rdSegmenten&&r.rdSegmenten.length).length,peildatum:Math.max(0,...routes.map(r=>r.peildatum||0))||null,
          byRef:index.byRef,byHoofdweg:index.byHoofdweg,byRelation:index.byRelation,werkMatchesN:0,routeAssetKoppelingenN:0,ruweRijen:rijen.slice()};
      }
    } else if(magImporteren('uRoutes')&&modus==='vervang'){ U_ROUTE_STATE=null; }

    // 8) Werkzaamheden
    if(magImporteren('werkzaamheden')&&bundle.werkzaamheden&&Array.isArray(bundle.werkzaamheden.rijen)&&(modus==='vervang'||!WERK_STATE)){
      zetImportVoortgang(file.name,82,'Werkzaamheden terugzetten',{direct:true});await uiPauze();
      const rijen=bundle.werkzaamheden.rijen;
      const werken=rijen.map(normWerkRij).filter(Boolean);
      if(werken.length){
        WERK_STATE={bestand:bundle.werkzaamheden.bestand||file.name,werken,totaal:werken.length,bronTotaal:rijen.length,genegeerdN:0,exactN:0,assetKoppelingenN:0,peildatum:Math.max(0,...werken.map(w=>w.peildatum||0))||null,ruweRijen:rijen.slice()};
        await herkoppelWerkAssetsLicht();
      }
    } else if(magImporteren('werkzaamheden')&&modus==='vervang'){ WERK_STATE=null; }

    // 9) DRIP-selectie (per-DRIP checkboxes)
    if(magImporteren('dripSelectie')&&Array.isArray(bundle.dripSelectie)&&typeof DRIP_SELECTIE!=='undefined'){
      if(modus==='vervang'||!(DRIP_SELECTIE instanceof Set)){ DRIP_SELECTIE=new Set(bundle.dripSelectie); }
      else { bundle.dripSelectie.forEach(x=>DRIP_SELECTIE.add(x)); }
      try{ if(typeof DRIP_SEL_KEY!=='undefined') localStorage.setItem(DRIP_SEL_KEY, JSON.stringify([...DRIP_SELECTIE])); }catch(e){}
    }

    // Herbouw indexen en analysebeeld
    zetImportVoortgang(file.name,92,'Koppelingen en analysebeeld herbouwen',{direct:true});await uiPauze();
    ASSET_CONFIG_VERSIE++;
    if(ASSET_REGISTER_STATE){ASSET_REGISTER_STATE._assetConfigVersie=-1;herberekenRegisterDekking();}
    STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeStoringsRijen());
    LIVE_STORINGS_INSPECTIE=inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen());
    if(DRIP_HIST_STATE)koppelDripHistorieAanAreaal();
    herbouwAssetMatchBeeld();
    ANALYSE_SIGNATURE='';MC_RESULT=null;DRIP_MC=null;TOTAAL_IMPORT_GELADEN=true;
    // De algemene MSI-prognose staat tijdelijk uit. Een totaalimport mag daarom
    // nooit naar het verborgen prognosetabblad worden gestuurd. Live data opent
    // Overzicht; anders krijgt DRIP-areaal voorrang en daarna Rapport.
    const importDoel=LIVE_STORINGSBRONNEN.length?'overzicht':(DRIP_STATE&&DRIP_STATE.totaal?'drips':'rapport');
    // De brondata is op dit punt al volledig hersteld. Een fout in een optioneel
    // scherm mag de totaalimport daarom niet meer terugdraaien of als mislukte
    // bestandsimport melden. Open eerst het veilige overzicht en laat daarna de
    // normale routering/rendering proberen.
    try{
      probeerAnalyseActiveren(importDoel,{inspectieAlGereed:true,matchAlGereed:true});
    }catch(renderErr){
      console.error('Schermopbouw na totaalimport:',renderErr);
      try{
        const veiligeTab=document.querySelector('[data-tab="overzicht"]');
        if(veiligeTab) veiligeTab.click();
      }catch(e){}
    }
    const assetregisterTekst=assetregisterActie==='overslaan'&&bundleHeeftAssetregister?' Bestaand assetregister behouden.':'';
    importKlaar(file.name,`Totaalimport voltooid (${modus==='merge'?'complementair toegevoegd':'volledig vervangen'}).${assetregisterTekst} Losse bestanden die je hierna laadt, worden complementair toegevoegd.`);
    zetStoringsImportStatus(`Totaalimport ${modus==='merge'?'complementair verwerkt':'als vervanging verwerkt'}: historie, open storingen, U-routes, werkzaamheden en instellingen zijn hersteld.${assetregisterTekst}`);
  }catch(err){
    importMislukt(file.name,err.message);
    if(hubModus)throw err; alert('Kon het totaalbestand niet volledig verwerken: '+err.message);
    console.error(err);
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  const ti=document.getElementById('totaalImportInput');
  if(ti) ti.addEventListener('change',async e=>{const invoer=e.currentTarget,f=invoer.files[0];if(!f)return;try{await totaalImportJson(f);}finally{invoer.value='';}});
});
