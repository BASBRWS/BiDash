import {workspaceParts,workspaceDecoder} from './workspace-parts.js';
export function createWorkspaceStorage(databaseName='bidash-integraal'){
const FORMAT='BiDash-workspace-parts',PREFIX='bidash-workspace-part';
let writeQueue=Promise.resolve();
const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(databaseName,1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const isManifest=v=>v?.storage===FORMAT&&v.version===1&&typeof v.generation==='string'&&Number.isSafeInteger(v.parts)&&v.parts>=0;
const range=generation=>IDBKeyRange.bound([PREFIX,generation,0],[PREFIX,generation,Number.MAX_SAFE_INTEGER]);
function clearGeneration(store,generation){const r=store.openCursor(range(generation));r.onsuccess=()=>{const c=r.result;if(c){c.delete();c.continue();}};}
function put(db,key,value){return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.oncomplete=resolve;tx.onerror=e=>reject(tx.error||e.target?.error||Error('Opslag mislukt'));tx.onabort=()=>reject(tx.error||Error('Opslag afgebroken'));try{tx.objectStore('workspace').put(value,key);}catch(error){tx.abort();reject(error);}});}
function removeGeneration(db,generation){return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.oncomplete=resolve;tx.onerror=e=>reject(tx.error||e.target?.error||Error('Opslag mislukt'));tx.onabort=()=>reject(tx.error||Error('Opslag afgebroken'));clearGeneration(tx.objectStore('workspace'),generation);});}
async function readValue(key){
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace'),store=tx.objectStore('workspace');let result,failure;
    tx.oncomplete=()=>failure?reject(failure):resolve(result);tx.onerror=e=>reject(failure||tx.error||e.target?.error||Error('Lezen mislukt'));tx.onabort=()=>reject(failure||tx.error||Error('Lezen afgebroken'));
    const r=store.get(key);r.onsuccess=()=>{
      const value=r.result;
      if(key==='current'&&value?.storage===FORMAT&&!isManifest(value)){failure=Error('Onbekende of beschadigde opslagindeling van de werkruimte.');tx.abort();return;}
      if(key!=='current'||!isManifest(value)){result=value;return;}
      const decoder=workspaceDecoder();let count=0;
      const cursor=store.openCursor(range(value.generation));cursor.onsuccess=()=>{
        try{const c=cursor.result;if(!c){if(count!==value.parts)throw Error('Opgeslagen werkruimte is onvolledig, opslagblokken ontbreken.');result=decoder.finish(value.root);return;}
          if(c.key[2]!==count||count>=value.parts)throw Error('Opgeslagen werkruimte bevat ongeldige opslagblokken.');decoder.add(c.value);count++;c.continue();
        }catch(error){failure=error;tx.abort();}
      };
    };
  });}finally{db.close();}
}
async function writeValue(key,value){
  if(key==='current')return write(value);
  const db=await openDB();try{await put(db,key,value);}finally{db.close();}
}
async function read(){return readValue('current');}
function write(state){
  // Eén bevroren bronstand; de stapsgewijze opslag mag geen latere edits mengen.
  let snapshot;try{snapshot=structuredClone(state);}catch(error){return Promise.reject(error);}
  const operation=writeQueue.then(()=>persistWorkspace(snapshot));
  writeQueue=operation.catch(()=>{});return operation;
}
async function persistWorkspace(snapshot){
  const generation=crypto.randomUUID(),db=await openDB();let parts=0;
  try{
    const generator=workspaceParts(snapshot);let step=generator.next();
    while(!step.done){await put(db,[PREFIX,generation,parts++],step.value);step=generator.next();}
    const manifest={storage:FORMAT,version:1,generation,parts,root:step.value};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');
      tx.oncomplete=resolve;tx.onerror=e=>reject(tx.error||e.target?.error||Error('Opslag mislukt'));tx.onabort=()=>reject(tx.error||Error('Opslag afgebroken'));
      const old=store.get('current');old.onsuccess=()=>{
        try{store.put(manifest,'current');if(isManifest(old.result))clearGeneration(store,old.result.generation);}catch(error){tx.abort();reject(error);}
      };
    });
  }catch(error){try{await removeGeneration(db,generation);}catch{}throw error;}
  finally{db.close();}
}

return {read,write,readValue,writeValue};
}
const defaultStorage=createWorkspaceStorage();
export const {read,write,readValue,writeValue}=defaultStorage;
