const DVM_PARTS=['assetregister','eol','storingshistorie','liveStoringen','dripHistorie','uRoutes','werkzaamheden','parameters','dripSelectie'];
const PART_LABELS={assetregister:'Assetregister',eol:'EOL / levensduur',storingshistorie:'Storingshistorie',liveStoringen:'Open storingen',dripHistorie:'DRIP-historie',uRoutes:'U-routes',werkzaamheden:'Werkzaamheden'};

export function normHeader(value){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' en ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
const aliases={
  id:['entityid','entity id','asset id','assetid','object id','objectid','uuid','guid','id'],
  asset:['asset','assetnaam','asset naam','naam','name','objectnaam','object naam','object'],
  type:['ci type','ci-type','assettype','asset type','objecttype','object type','type','klasse','class'],
  status:['status','asset status','object status','toestand'],
  road:['wegnummer','weg nummer','weg','rijksweg','road','road number','roadnumber','route'],
  direction:['richting','rijrichting','rij richting','direction','dir','baanrichting','wegdeelletter','wegdeel letter','baanpositie','baan positie'],
  hm:['hm','hectometer','hectometrering','hm bord','hm-bord','kilometrering','km','kilometer'],
  rdX:['rd x','rd_x','rd-locatie-x','rd locatie x','x coordinaat','x coordinate','x'],
  rdY:['rd y','rd_y','rd-locatie-y','rd locatie y','y coordinaat','y coordinate','y'],
  vc:['vc','verkeerscentrale','verkeers centrale','regio','region'],
  district:['district','districtnaam','district naam'],
  manufacturer:['fabrikant','manufacturer','merk','brand','vendor','leverancier'],
  model:['model','hardware','product','producttype','subtype'],
  inService:['ingebruikname','in gebruik name','bouwjaar','installatiejaar','installatie jaar','construction year','year built','commissioning date','commissioning year'],
  eol:['eol','end of life','end-of-life','einde levensduur','eol jaar','eol year'],
  life:['life median years','life_median_years','levensduur','levensduur jaren','expected life','lifetime'],
  incident:['incident id','incident_id','event id','eventid','storing id','storingid','melding id','meldingid','ticket','ticket id'],
  location:['locatie','location','positie','position','objectlocatie','object locatie'],
  start:['start','starttijd','start tijd','startdatum','start datum','van','begin','begindatum','begin datum','date start'],
  end:['einde','eind','eindtijd','eind tijd','einddatum','eind datum','tot','end','date end'],
  message:['melding','storingsmelding','storing','omschrijving','description','foutmelding','fault','fault description','message'],
  osid:['os id','os_id','osid','object service id','objectserviceid','asset code','assetcode'],
  days:['aantal dagen','aantal_dagen','duur dagen','days','duration days'],
  consequence:['gevolg','effect','consequence','impact'],
  mitigation:['noodmaatregel','maatregel','mitigation','workaround'],
  workId:['werk id','werk_id','work id','work_id','project id','maatregel id'],
  work:['werkzaamheden','werkzaamheid','werk','work','activity','activiteit','project'],
  closure:['afsluiting','closure','closed','wegafsluiting'],
  detour:['omleiding','detour','diversion'],
  delay:['extra reistijd min','extra_reistijd_min','extra reistijd','vertraging','delay','delay minutes'],
  fromHm:['van hm','van_hm','from hm','start hm','start_hm'],
  toHm:['tot hm','tot_hm','to hm','end hm','eind hm','eind_hm'],
  routeId:['route id','route_id','u route id','uroute id'],
  uRoute:['u route','u_route','uitwijkroute','uitwijk route','omleidingsroute'],
  osmId:['osm relation id','osm_relation_id','osm relatie id','relation id'],
  osmUrl:['osm relation url','osm_relation_url','osm relatie url','osm url'],
  province:['provincie','province'],
  source:['bron url','bron_url','source url','source_url','bron'],
  manufacturerRegex:['manufacturer regex','manufacturer_regex','fabrikant regex'],
  modelRegex:['model regex','model_regex'],
  assetClasses:['asset classes','asset_classes','assetclass','asset class'],
  evidence:['evidence level','evidence_level','bewijsniveau'],
  confidence:['confidence','betrouwbaarheid']
};
const aliasNorm=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[k,new Set(v.map(normHeader))]));

function headersOf(rows){
  const out=new Set();
  for(const row of rows.slice(0,30))if(row&&typeof row==='object'&&!Array.isArray(row))for(const k of Object.keys(row))out.add(normHeader(k));
  return out;
}
function has(headers,key){for(const a of aliasNorm[key]||[])if(headers.has(a))return true;return false;}
function nameTokens(fileName='',sheetName=''){return normHeader(fileName+' '+sheetName);}
function named(text,...terms){return terms.some(t=>text.includes(normHeader(t)));}

export function classifyTable(rows,{fileName='',sheetName='',hint='auto'}={}){
  if(!Array.isArray(rows)||!rows.length||typeof rows[0]!=='object'||Array.isArray(rows[0]))return {kind:'unknown',confidence:0,scores:[]};
  const h=headersOf(rows),name=nameTokens(fileName,sheetName),scores=[];
  const push=(part,score,reasons=[])=>scores.push({part,score,reasons});

  let s=0,r=[];
  if(has(h,'id')){s+=3;r.push('asset-id');} if(has(h,'asset')){s+=3;r.push('assetnaam');} if(has(h,'type'))s+=3; if(has(h,'road'))s+=2; if(has(h,'hm'))s+=2; if(has(h,'status'))s+=1; if(has(h,'inService')||has(h,'eol')||has(h,'life'))s+=2; if(has(h,'rdX')&&has(h,'rdY'))s+=2; if(named(name,'asset','all assets','areaal','cmdb'))s+=3; push('assetregister',s,r);

  s=0;r=[];
  if(has(h,'manufacturerRegex')){s+=5;r.push('manufacturer_regex');} if(has(h,'modelRegex'))s+=5; if(has(h,'life'))s+=4; if(has(h,'assetClasses'))s+=2; if(has(h,'evidence')||has(h,'confidence'))s+=2; if(named(name,'eol','levensduur','lifetime'))s+=3; push('eol',s,r);

  s=0;r=[];
  if(has(h,'workId')){s+=5;r.push('werk-id');} if(has(h,'work'))s+=4; if(has(h,'start')&&has(h,'end'))s+=3; if(has(h,'closure'))s+=3; if(has(h,'detour'))s+=2; if(has(h,'delay'))s+=2; if(has(h,'fromHm')||has(h,'toHm'))s+=2; if(named(name,'werkzaamheden','werkplanning','road works','roadworks'))s+=4; push('werkzaamheden',s,r);

  s=0;r=[];
  if(has(h,'routeId')){s+=5;r.push('route-id');} if(has(h,'uRoute'))s+=5; if(has(h,'osmId'))s+=4; if(has(h,'osmUrl'))s+=3; if(has(h,'province'))s+=1; if(named(name,'u route','u-route','uitwijkroute','omleidingsroute'))s+=5; push('uRoutes',s,r);

  s=0;r=[];
  if(has(h,'osid')){s+=4;r.push('os-id');} if(has(h,'message'))s+=4; if(has(h,'days'))s+=4; if(has(h,'consequence'))s+=2; if(has(h,'mitigation'))s+=3; if(has(h,'vc'))s+=1; if(has(h,'start')||has(h,'end'))s+=2; if(named(name,'live','open storing','open storingen','kruislamp','actueel'))s+=5; push('liveStoringen',s,r);

  s=0;r=[];
  if(has(h,'incident')){s+=4;r.push('incident-id');} if(has(h,'location'))s+=3; if(has(h,'road'))s+=2; if(has(h,'start'))s+=4; if(has(h,'end'))s+=1; if(has(h,'message'))s+=1; if(named(name,'historie','historisch','history','storingslog','incident'))s+=4; if(named(name,'live','open storing','kruislamp'))s-=5; push('storingshistorie',s,r);

  s=0;r=[];
  if(named(name,'drip'))s+=5; if(has(h,'incident'))s+=2; if(has(h,'osid'))s+=2; if(has(h,'start'))s+=2; if(has(h,'end'))s+=2; if(has(h,'message'))s+=1; push('dripHistorie',s,r);

  scores.sort((a,b)=>b.score-a.score);
  const top=scores[0],second=scores[1];
  const threshold=6;
  if(!top||top.score<threshold)return {kind:'unknown',confidence:0,scores,headers:[...h]};
  const diff=top.score-(second?.score||0);
  const confidence=Math.max(0,Math.min(1,(top.score-4)/10 + diff/20));
  return {kind:'dvm-part',part:top.part,label:PART_LABELS[top.part],score:top.score,confidence,ambiguous:diff<2,scores,headers:[...h]};
}

function rowIndex(row){
  const map=new Map();
  for(const [k,v] of Object.entries(row||{})){const n=normHeader(k);if(!map.has(n))map.set(n,v);}
  return map;
}
function value(row,key){
  const idx=rowIndex(row);for(const a of aliasNorm[key]||[])if(idx.has(a)){const v=idx.get(a);if(v!==''&&v!=null)return v;}return '';
}
function put(out,key,v){if((out[key]===undefined||out[key]==='')&&v!==''&&v!=null)out[key]=v;}
function sourceName(fileName,sheetName){return sheetName?`${fileName} · ${sheetName}`:fileName;}

export function normalizeRows(rows,part){
  return rows.filter(r=>r&&typeof r==='object'&&!Array.isArray(r)).map(raw=>{
    const out={...raw};
    if(part==='assetregister'){
      put(out,'entityid',value(raw,'id'));put(out,'asset',value(raw,'asset'));put(out,'ci-type',value(raw,'type'));put(out,'status',value(raw,'status'));put(out,'wegnummer',value(raw,'road'));put(out,'richting',value(raw,'direction'));put(out,'hm-bord',value(raw,'hm'));put(out,'regio',value(raw,'vc'));put(out,'rd-locatie-x',value(raw,'rdX'));put(out,'rd-locatie-y',value(raw,'rdY'));put(out,'fabrikant',value(raw,'manufacturer'));put(out,'hardware',value(raw,'model'));put(out,'ingebruikname',value(raw,'inService'));put(out,'eol',value(raw,'eol'));put(out,'life_median_years',value(raw,'life'));
    }else if(part==='storingshistorie'){
      put(out,'incident_id',value(raw,'incident'));put(out,'locatie',value(raw,'location'));put(out,'weg',value(raw,'road'));put(out,'start',value(raw,'start'));put(out,'einde',value(raw,'end'));put(out,'melding',value(raw,'message'));put(out,'os_id',value(raw,'osid'));put(out,'vc',value(raw,'vc'));
    }else if(part==='liveStoringen'){
      put(out,'RD',value(raw,'vc'));put(out,'District',value(raw,'district'));put(out,'vc',value(raw,'vc'));put(out,'os_id',value(raw,'osid')||value(raw,'asset'));put(out,'melding',value(raw,'message'));put(out,'aantal_dagen',value(raw,'days'));put(out,'van',value(raw,'start'));put(out,'tot',value(raw,'end'));put(out,'Gevolg',value(raw,'consequence'));put(out,'Noodmaatregel',value(raw,'mitigation'));out._liveOpen=true;
    }else if(part==='werkzaamheden'){
      put(out,'Werk_ID',value(raw,'workId'));put(out,'Weg',value(raw,'road'));put(out,'Richting',value(raw,'direction'));put(out,'Start',value(raw,'start'));put(out,'Einde',value(raw,'end'));put(out,'Afsluiting',value(raw,'closure'));put(out,'Extra_reistijd_min',value(raw,'delay'));put(out,'Omleiding',value(raw,'detour'));put(out,'Werkzaamheden',value(raw,'work'));put(out,'van_hm',value(raw,'fromHm')||value(raw,'hm'));put(out,'tot_hm',value(raw,'toHm'));put(out,'RD_X',value(raw,'rdX'));put(out,'RD_Y',value(raw,'rdY'));
    }else if(part==='uRoutes'){
      put(out,'Route_ID',value(raw,'routeId'));put(out,'Provincie',value(raw,'province'));put(out,'Regio',value(raw,'vc'));put(out,'U_route',value(raw,'uRoute'));put(out,'OSM_relation_id',value(raw,'osmId'));put(out,'OSM_relation_URL',value(raw,'osmUrl'));put(out,'Bron_URL',value(raw,'source'));
    }else if(part==='eol'){
      put(out,'manufacturer_regex',value(raw,'manufacturerRegex')||value(raw,'manufacturer'));put(out,'model_regex',value(raw,'modelRegex')||value(raw,'model'));put(out,'asset_classes',value(raw,'assetClasses')||value(raw,'type'));put(out,'life_median_years',value(raw,'life'));put(out,'evidence_level',value(raw,'evidence'));put(out,'confidence',value(raw,'confidence'));put(out,'source_url',value(raw,'source'));
    }
    return out;
  });
}

function slug(v){return normHeader(v).replace(/ /g,'-').slice(0,120)||'bron';}
function peildatum(rows){
  let max=null;
  for(const r of rows){for(const k of ['tot','einde','einddatum','peildatum','datum','van','start']){const v=r[k]??r[k[0].toUpperCase()+k.slice(1)];const t=Date.parse(v);if(Number.isFinite(t)&&(!max||t>max))max=t;}}
  return max;
}
export function makeDvmPartBundle(part,rows,{fileName='bron',sheetName=''}={}){
  const name=sourceName(fileName,sheetName),norm=normalizeRows(rows,part),exportSelectie=Object.fromEntries(DVM_PARTS.map(k=>[k,k===part]));
  let payload;
  if(part==='assetregister'||part==='uRoutes'||part==='werkzaamheden')payload={bestand:name,rijen:norm};
  else if(part==='eol')payload={bestand:name,rijen:norm};
  else if(part==='storingshistorie')payload=[{key:slug(name),naam:name,rijen:norm,peildatum:peildatum(norm),doel:'historie'}];
  else if(part==='liveStoringen')payload=[{key:slug(name),naam:name,rijen:norm,peildatum:peildatum(norm),doel:'live'}];
  else if(part==='dripHistorie')payload={sources:[{key:slug(name),name,rijen:norm}]};
  else throw new Error('Dit herkende DVM-onderdeel kan nog niet als losse bron worden opgebouwd: '+part);
  return {formaat:'DVM-dienstimpact-totaal',versie:54,opgeslagen:new Date().toISOString(),exportSelectie,[part]:payload};
}

export function parseDelimited(text,delimiter){
  const src=String(text??'').replace(/^\ufeff/,'');
  if(!delimiter){const line=src.split(/\r?\n/,1)[0]||'';const cands=[';','\t',',','|'];delimiter=cands.map(d=>[d,(line.match(new RegExp('\\'+d,'g'))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];}
  const table=[];let row=[],field='',quoted=false;
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(quoted){if(ch==='"'&&src[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;continue;}
    if(ch==='"'){quoted=true;continue;}
    if(ch===delimiter){row.push(field);field='';continue;}
    if(ch==='\r')continue;
    if(ch==='\n'){row.push(field);table.push(row);row=[];field='';continue;}
    field+=ch;
  }
  if(field.length||row.length){row.push(field);table.push(row);}
  while(table.length&&table[table.length-1].every(v=>String(v).trim()===''))table.pop();
  if(!table.length)return [];
  const headers=table.shift().map((h,i)=>String(h||`kolom_${i+1}`).trim()||`kolom_${i+1}`);
  return table.filter(r=>r.some(v=>String(v).trim()!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}

function knownJson(json){
  if(!json||typeof json!=='object')return false;
  if(json.formaat==='DVM-dienstimpact-totaal'||json.formaat==='BiDash-integraal')return true;
  if(Array.isArray(json.assets)&&Array.isArray(json.functies))return true;
  return false;
}
function partialDvmObject(json){
  if(!json||typeof json!=='object'||Array.isArray(json))return null;
  const parts=DVM_PARTS.filter(k=>Object.prototype.hasOwnProperty.call(json,k));
  if(!parts.length)return null;
  const exportSelectie=Object.fromEntries(DVM_PARTS.map(k=>[k,parts.includes(k)]));
  return {formaat:'DVM-dienstimpact-totaal',versie:Number(json.versie)||54,opgeslagen:json.opgeslagen||new Date().toISOString(),exportSelectie,...Object.fromEntries(parts.map(k=>[k,json[k]]))};
}
function extractTables(json){
  if(Array.isArray(json))return [{name:'',rows:json}];
  if(!json||typeof json!=='object')return [];
  const out=[];
  for(const [k,v] of Object.entries(json)){
    if(Array.isArray(v)&&v.length&&typeof v[0]==='object'&&!Array.isArray(v[0]))out.push({name:k,rows:v});
    else if(v&&typeof v==='object'&&Array.isArray(v.rijen))out.push({name:k,rows:v.rijen});
    else if(v&&typeof v==='object'&&Array.isArray(v.rows))out.push({name:k,rows:v.rows});
    else if(v&&typeof v==='object'&&Array.isArray(v.records))out.push({name:k,rows:v.records});
    else if(v&&typeof v==='object'&&Array.isArray(v.data))out.push({name:k,rows:v.data});
  }
  if(Array.isArray(json.rijen))out.unshift({name:'',rows:json.rijen});
  if(Array.isArray(json.rows))out.unshift({name:'',rows:json.rows});
  if(Array.isArray(json.records))out.unshift({name:'',rows:json.records});
  if(Array.isArray(json.data))out.unshift({name:'',rows:json.data});
  return out;
}

function mergeBundles(bundles){
  const out={formaat:'DVM-dienstimpact-totaal',versie:54,opgeslagen:new Date().toISOString(),exportSelectie:Object.fromEntries(DVM_PARTS.map(k=>[k,false]))};
  for(const b of bundles){
    for(const part of DVM_PARTS){if(b.exportSelectie?.[part]!==true||!Object.prototype.hasOwnProperty.call(b,part))continue;out.exportSelectie[part]=true;
      if(['storingshistorie','liveStoringen'].includes(part))out[part]=[...(out[part]||[]),...(b[part]||[])];
      else if(part==='dripHistorie')out[part]={sources:[...(out[part]?.sources||[]),...(b[part]?.sources||[])]};
      else out[part]=b[part];
    }
  }
  return out;
}

async function ensureXlsx(){
  if(globalThis.XLSX)return globalThis.XLSX;
  await new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-bidash-xlsx]');if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}const s=document.createElement('script');s.src='vendor/xlsx.full.min.js';s.dataset.bidashXlsx='1';s.onload=resolve;s.onerror=()=>reject(new Error('Excel-lezer kon niet worden geladen.'));document.head.appendChild(s);});
  if(!globalThis.XLSX)throw new Error('Excel-lezer is niet beschikbaar.');return globalThis.XLSX;
}

async function workbookTables(file){
  const XLSX=await ensureXlsx(),buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellDates:true,raw:false});
  return wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:false})})).filter(x=>x.rows.length);
}

function makeJsonFile(obj,name){return new File([JSON.stringify(obj)],name,{type:'application/json'});}
export async function recognizeFile(file,{hint='auto'}={}){
  const lower=String(file.name||'').toLowerCase();
  if(hint==='planning'||/\.xml$/i.test(lower))return {files:[file],label:`Planning XML: ${file.name}`,kind:'planning',passthrough:true};

  if(/\.json$/i.test(lower)||/\.geojson$/i.test(lower)||/\.ndjson$/i.test(lower)||/\.jsonl$/i.test(lower)){
    const text=await file.text();let json;
    if(/\.(ndjson|jsonl)$/i.test(lower))json=text.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));else json=JSON.parse(text);
    if(knownJson(json))return {files:[file],label:`Bestaand JSON-formaat: ${file.name}`,kind:'known-json',passthrough:true};
    const partial=partialDvmObject(json);if(partial)return {files:[makeJsonFile(partial,file.name.replace(/\.json$/i,'')+'.dvm.json')],label:`DVM-deelbestand herkend: ${file.name}`,kind:'dvm-partial'};
    const tables=extractTables(json),bundles=[],recognized=[];
    for(const t of tables){const c=classifyTable(t.rows,{fileName:file.name,sheetName:t.name,hint});if(c.kind==='dvm-part'&&!c.ambiguous){bundles.push(makeDvmPartBundle(c.part,t.rows,{fileName:file.name,sheetName:t.name}));recognized.push(`${c.label}${t.name?' ('+t.name+')':''}`);}}
    if(bundles.length)return {files:[makeJsonFile(mergeBundles(bundles),file.name.replace(/\.json$/i,'')+'.genormaliseerd.json')],label:`${file.name}: ${recognized.join(', ')}`,kind:'normalized-json'};
    if(hint==='bi'&&json&&typeof json==='object')return {files:[file],label:`BI JSON: ${file.name}`,kind:'bi',passthrough:true};
    throw new Error(`Bestand ${file.name} is geldige JSON, maar de inhoud kan niet betrouwbaar aan een BiDash-bron worden gekoppeld.`);
  }

  let tables=[];
  if(/\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lower))tables=await workbookTables(file);
  else if(/\.(csv|tsv|txt)$/i.test(lower)){const text=await file.text();tables=[{name:'',rows:parseDelimited(text,/\.tsv$/i.test(lower)?'\t':undefined)}];}
  else throw new Error(`Bestandstype van ${file.name} wordt nog niet ondersteund.`);

  const bundles=[],recognized=[],ambiguous=[];
  for(const t of tables){const c=classifyTable(t.rows,{fileName:file.name,sheetName:t.name,hint});if(c.kind!=='dvm-part')continue;if(c.ambiguous){ambiguous.push(`${t.name||'eerste tabel'}: ${c.scores.slice(0,2).map(x=>`${PART_LABELS[x.part]||x.part} ${x.score}`).join(' / ')}`);continue;}bundles.push(makeDvmPartBundle(c.part,t.rows,{fileName:file.name,sheetName:t.name}));recognized.push(`${c.label}${t.name?' ('+t.name+')':''}`);}
  if(!bundles.length){const extra=ambiguous.length?' Mogelijke matches: '+ambiguous.join('; ')+'.':'';throw new Error(`Ik herken in ${file.name} geen bron met voldoende zekerheid.${extra}`);}
  return {files:[makeJsonFile(mergeBundles(bundles),file.name+'.genormaliseerd.json')],label:`${file.name}: ${recognized.join(', ')}`,kind:'table'};
}

export async function normalizeSelectedFiles(files,{hint='auto'}={}){
  const out=[],labels=[];
  for(const file of files){const r=await recognizeFile(file,{hint});out.push(...r.files);labels.push(r.label);}
  return {files:out,labels};
}

export function installUniversalImporter(){
  if(typeof document==='undefined')return false;
  const input=document.getElementById('files'),type=document.getElementById('importType');
  if(!input||typeof input.onchange!=='function'||input.dataset.bidashUniversalImporter)return false;
  const original=input.onchange;
  input.accept='.json,.geojson,.jsonl,.ndjson,.xml,.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods';
  if(type){const auto=type.querySelector('option[value="auto"]');if(auto)auto.textContent='Automatisch herkennen';if(!type.querySelector('option[value="dvm"]')){const o=document.createElement('option');o.value='dvm';o.textContent='DVM bron automatisch herkennen';type.appendChild(o);}}
  const section=input.closest('section'),p=section?.querySelector('input#files + p');if(p)p.textContent='BiDash herkent DVM totaalexports, integrale BiDash JSON, BI JSON, planning XML en losse DVM-bronnen uit JSON, CSV, TSV en Excel. Kolomnamen mogen afwijken; de importer normaliseert bekende aliassen en toont vóór verwerking welk brontype is herkend.';
  input.onchange=async event=>{
    const selected=[...(event.target.files||[])];if(!selected.length)return;
    input.disabled=true;
    try{
      const hint=type?.value||'auto';
      if(hint==='planning'||hint==='bi')return await original.call(input,event);
      const normalized=await normalizeSelectedFiles(selected,{hint});
      const fake={target:{files:normalized.files,value:''}};
      return await original.call(input,fake);
    }catch(error){const status=document.getElementById('status');if(status){status.textContent=error.message||String(error);status.classList.add('error');}console.error(error);}
    finally{input.disabled=false;event.target.value='';}
  };
  input.dataset.bidashUniversalImporter='1';
  globalThis.BIDASH_IMPORTER={classifyTable,normalizeRows,recognizeFile,normalizeSelectedFiles};
  return true;
}

function scheduleInstall(){
  let tries=0;const run=()=>{if(installUniversalImporter())return;if(++tries<200)setTimeout(run,25);};run();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(scheduleInstall,0),{once:true});else setTimeout(scheduleInstall,0);
}
