const JSON_EXTENSION=/\.json$/i;
const SNAPSHOT_FORMATS=new Set(['BiDash-integraal','DVM-dienstimpact-totaal']);

function datumWaarde(value){
  const tijd=Date.parse(String(value||''));
  return Number.isFinite(tijd)?tijd:0;
}

export function datumUitBestandsnaam(name=''){
  const match=String(name).match(/(?:^|[^0-9])(20\d{2})-(\d{2})-(\d{2})(?:[^0-9]|$)/);
  if(!match)return 0;
  const tijd=Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isFinite(tijd)?tijd:0;
}

export function isOndersteundeMomentopname(json){
  return !!json&&typeof json==='object'&&!Array.isArray(json)&&SNAPSHOT_FORMATS.has(json.formaat);
}

export function momentopnameTijd(file,json){
  return datumWaarde(json?.opgeslagen)||datumUitBestandsnaam(file?.name)||Number(file?.lastModified)||0;
}

export async function nieuwsteMomentopnameUitBestanden(files){
  const jsonFiles=[...files].filter(file=>file&&JSON_EXTENSION.test(file.name||''));
  const geldige=[];
  for(const file of jsonFiles){
    try{
      const json=JSON.parse(await file.text());
      if(!isOndersteundeMomentopname(json))continue;
      geldige.push({file,json,tijd:momentopnameTijd(file,json),formaat:json.formaat,opgeslagen:json.opgeslagen||null});
    }catch(_error){
      // Een kapotte of andersoortige JSON in dezelfde map mag een geldige back-up
      // niet blokkeren. De gewone import valideert de uiteindelijk gekozen inhoud.
    }
  }
  geldige.sort((a,b)=>b.tijd-a.tijd
    ||Number(b.formaat==='BiDash-integraal')-Number(a.formaat==='BiDash-integraal')
    ||String(b.file.name).localeCompare(String(a.file.name),'nl'));
  if(!geldige.length)throw Error('Geen geldige BiDash-integraal- of DVM-totaal-JSON gevonden in deze map.');
  return {...geldige[0],gevonden:geldige.length,onderzocht:jsonFiles.length};
}

export async function nieuwsteMomentopnameUitMap(directoryHandle){
  if(!directoryHandle||typeof directoryHandle.values!=='function')throw Error('De gekoppelde map is niet meer beschikbaar. Kies de map opnieuw.');
  const files=[];
  for await(const entry of directoryHandle.values()){
    if(entry?.kind!=='file'||!JSON_EXTENSION.test(entry.name||''))continue;
    files.push(await entry.getFile());
  }
  return nieuwsteMomentopnameUitBestanden(files);
}

export async function mapToestemming(directoryHandle,{vragen=false,mode='read'}={}){
  if(!directoryHandle)return 'prompt';
  if(typeof directoryHandle.queryPermission!=='function')return 'granted';
  let toestemming=await directoryHandle.queryPermission({mode});
  if(toestemming==='prompt'&&vragen&&typeof directoryHandle.requestPermission==='function'){
    toestemming=await directoryHandle.requestPermission({mode});
  }
  return toestemming;
}

export async function schrijfBestandNaarMap(directoryHandle,{name,data,type='application/json'}={}){
  if(!directoryHandle||typeof directoryHandle.getFileHandle!=='function')throw Error('De gekoppelde map ondersteunt geen schrijfacties.');
  if(!name||/[\\/\0]/.test(name))throw Error('Ongeldige bestandsnaam voor export.');
  const toestemming=await mapToestemming(directoryHandle,{vragen:true,mode:'readwrite'});
  if(toestemming!=='granted')throw Error('Geen schrijfrechten voor de gekoppelde map. Geef toestemming of koppel de map opnieuw.');
  const fileHandle=await directoryHandle.getFileHandle(name,{create:true});
  if(!fileHandle||typeof fileHandle.createWritable!=='function')throw Error('De browser kan in deze gekoppelde map geen bestand maken.');
  const writable=await fileHandle.createWritable();
  const inhoud=typeof data==='string'?data:JSON.stringify(data);
  try{
    await writable.write(new Blob([inhoud],{type}));
    await writable.close();
  }catch(error){
    if(typeof writable.abort==='function')try{await writable.abort();}catch(_abortError){}
    throw error;
  }
  return {name,type,bytes:new Blob([inhoud]).size};
}
