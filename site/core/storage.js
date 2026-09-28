const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('bidash-integraal',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function readValue(key){const db=await openDB();try{return await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function writeValue(key,value){const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Opslag afgebroken'));});}finally{db.close();}}
export async function read(){return readValue('current');}
export async function write(state){return writeValue('current',state);}
